from django.db import transaction
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings as django_settings
from django.contrib.auth.hashers import check_password
from rest_framework.exceptions import AuthenticationFailed
from djoser.serializers import (
    UserCreatePasswordRetypeSerializer as BaseUserCreatePasswordRetypeSerializer,
    TokenCreateSerializer as BaseTokenCreateSerializer
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from djoser.utils import decode_uid
from rest_framework import serializers
from core.models import Company
from django.utils import timezone
from rest_framework import status
from .utils import create_otp_for_user, send_otp_to_phone, normalize_phone, send_activation_email, send_otp_email
from .models import User, PhoneNumber, OTPCode,Profile
from .validators import validate_unique_email, validate_unique_username
from django.contrib.auth import authenticate
from subscriptions.models import Subscription
from datetime import timedelta
from phonenumber_field.serializerfields import PhoneNumberField


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except AuthenticationFailed:
            raise AuthenticationFailed(
                detail="Invalid email or password",
                code="invalid_credentials"
            )


class CustomTokenCreateSerializer(BaseTokenCreateSerializer):
    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except AuthenticationFailed:
            raise AuthenticationFailed(
                detail="Invalid email or password",
                code="invalid_credentials"
            )
        

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['name']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError({"detail": "Company name cannot be empty."})
        if Company.objects.filter(name=value).exists():
            raise serializers.ValidationError({"detail": "A company with this name already exists."})
        return value

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = ['number']

    def validate_number(self, value):
        if not value:
            return value
        try:
            normalized = normalize_phone(value)
        except serializers.ValidationError as e:
            raise serializers.ValidationError(str(e))
        
        # if PhoneNumber.objects.filter(number=normalized).exists():
        #     raise serializers.ValidationError({"detail": "A phone number with this value already exists."})
        
        return normalized

class CreatePasswordRetypeSerializer(BaseUserCreatePasswordRetypeSerializer):
    email = serializers.EmailField(validators=[validate_unique_email])
    username = serializers.CharField(validators=[validate_unique_username])
    phone = serializers.CharField(required=False, allow_blank=True)
    company = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'username', 'password', 'phone', 'company']

    def validate(self, attrs):
        phone_str = attrs.pop('phone', None)
        if phone_str:
            phone_serializer = PhoneNumberSerializer(data={'number': phone_str})
            if not phone_serializer.is_valid():
                raise serializers.ValidationError(phone_serializer.errors)
            self.phone_data = phone_serializer.validated_data
        else:
            self.phone_data = None

        company_str = attrs.pop('company', None)
        if company_str:
            company_serializer = CompanySerializer(data={'name': company_str})
            if not company_serializer.is_valid():
                raise serializers.ValidationError(company_serializer.errors)
            self.company_data = company_serializer.validated_data
        else:
            self.company_data = None

        if self.phone_data and not self.phone_data.get('number'):
            raise serializers.ValidationError({"detail": "Phone number is required if phone data is provided"})
        return super().validate(attrs)

    def create(self, validated_data):
        company_data = self.company_data
        phone_data = self.phone_data
        with transaction.atomic():
            validated_data['verification_method'] = User.VERIFICATION_PHONE if phone_data else User.VERIFICATION_EMAIL
            validated_data['is_active'] = False

            user = super().create(validated_data)
            if phone_data and phone_data['number']:
                PhoneNumber.objects.create(user=user, number=phone_data['number'])
                try:
                    otp, _ = create_otp_for_user(user, OTPCode.TYPE_SMS, purpose=OTPCode.PURPOSE_SIGNUP)
                    send_otp_to_phone(phone=phone_data['number'], otp_code=otp)
                except ValueError as e:
                    raise serializers.ValidationError({"detail": "Failed to send OTP."})
            else:
                try:
                    send_activation_email(user, request=self.context.get("request"))
                except Exception as e:
                    raise serializers.ValidationError({"detail": "Failed to send activation email."})
            if company_data and company_data.get('name'):
                company = Company.objects.create(
                    name=company_data['name'],
                    owner=user
                )
                user.company = company
                user.save(update_fields=['company'])
        return user

class OTPVerifySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, required=True, trim_whitespace=True)

    def validate(self, attrs):
        code = attrs["code"]
        if len(code) != 6 or not code.isdigit():
            raise serializers.ValidationError({"detail": "OTP must be 6 digits."})
        try:
            otp = OTPCode.objects.filter(
                code=code,
                used=False,
                expires_at__gt=timezone.now()
            ).latest("created_at")
        except OTPCode.DoesNotExist:
            raise serializers.ValidationError({"detail": "No valid OTP found. It may have expired or been used."})

        if otp.is_locked:
            otp.mark_used()
            raise serializers.ValidationError({"detail": "Too many failed attempts. OTP invalidated."})

        attrs["otp"] = otp
        attrs["user"] = otp.user
        return attrs

class ResendActivationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value, is_active=False)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "User not found or already active."})
        return value

class ForgotPasswordSerializer(serializers.Serializer):
    phone = serializers.CharField(required=False, write_only=True)
    email = serializers.EmailField(required=False, write_only=True)

    def validate_phone(self, value):
        if value:
            return normalize_phone(value)
        return value

    def validate(self, attrs):
        phone = attrs.get("phone")
        email = attrs.get("email")
        if not phone and not email:
            raise serializers.ValidationError({"detail": "Provide either phone number or email."})
        if phone:
            user = User.objects.filter(
                phone_numbers__number=phone,
                is_active=True
            ).first()
        else:
            user = User.objects.filter(
                email=email,
                is_active=True
            ).first()
        if not user:
            raise serializers.ValidationError({"detail": "User not found."})
        attrs["user"] = user
        return attrs
    
class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)
    re_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['re_new_password']:
            raise serializers.ValidationError({"detail": "Passwords do not match."})
        try:
            uid_decoded = decode_uid(attrs['uid'])
            self.user = User.objects.get(pk=uid_decoded)
        except (User.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError({"detail": "Invalid UID."})
        if not default_token_generator.check_token(self.user, attrs['token']):
            raise serializers.ValidationError({"detail": "Invalid or expired token."})
        return attrs

    def save(self):
        self.user.set_password(self.validated_data['new_password'])
        self.user.save()

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError({"detail": "Password must be at least 6 characters long."})
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError({"detail": "Wrong password"})
        
        if attrs["new_password"] != attrs["confirm_password"]:
                raise serializers.ValidationError({"detail": "Passwords do not match"})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user

class ProfileSerializer(serializers.ModelSerializer):

    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    user_first_name = serializers.CharField(source="user.first_name")
    user_last_name = serializers.CharField(source="user.last_name")

    role = serializers.CharField(source="user.role", read_only=True)

    phone_number = serializers.CharField(
        source="user.phone_numbers.number",
        required=False,
        allow_null=True,
        allow_blank=True
    )
    is_phone_verified = serializers.CharField(source="user.is_phone_verified", read_only=True)
    is_email_verified = serializers.CharField(source="user.is_email_verified", read_only=True)
    joined_at = serializers.CharField(source="user.company.created_at", read_only=True)
    

    class Meta:
        model = Profile
        fields = [
            "updated_at",
            "avatar",
            "user_email",
            "user_username",
            "user_first_name",
            "user_last_name",
            "role",
            "phone_number",
            "is_phone_verified",
            "is_email_verified",
            "joined_at",
            "street_address",
            "city",
            "state",
            "zip_code",
            "country",
        ]
        read_only_fields = ["updated_at"]

    def update(self, instance, validated_data):

        user_data = validated_data.pop("user", {})
        phone_data = user_data.pop("phone_numbers", None)

        # update user fields
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()

        # update phone number
        if phone_data:
            number = phone_data.get("number")

            phone_obj, created = PhoneNumber.objects.get_or_create(user=user)

            phone_obj.number = number
            phone_obj.save()

        return super().update(instance, validated_data)
    
class EmployeeCreateSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(write_only=True,required=True)
    re_password = serializers.CharField(write_only=True, required=True)
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "password",
            "re_password",
        ]

    def validate(self, attrs):
        password = attrs.get("password")
        re_password = attrs.get("re_password")

        if password != re_password:
            raise serializers.ValidationError({"detail": "Passwords do not match."})

        if password is not None and len(password) < 8: 
            raise serializers.ValidationError({
                "detail": "Password must be at least 8 characters long."
            })

        user = self.context["request"].user

        if user.company is None:
            raise serializers.ValidationError({"detail": "User must be associated with a company."})

        check_company = user.company    

        try:
            check_subs = user.company.subscription
        except Subscription.DoesNotExist:
            raise serializers.ValidationError({"detail": "Company has no subscription."})

        if not check_subs.active:
            raise serializers.ValidationError({"detail": "Subscription is not active."})

        if check_company.member_count >= check_subs.plan.user_limit:
            raise serializers.ValidationError(
                "Employee limit reached for your subscription."
            )

        return attrs

    def validate_phone(self, value):
        if PhoneNumber.objects.filter(number=value).exists():
            raise serializers.ValidationError({"detail": "This phone number is already in use."})
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError({"detail": "This email is already in use."})
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError({"detail": "This username is already in use."})
        return value

    def create(self, validated_data):
        phone_number = validated_data.pop("phone")
        validated_data.pop("re_password")

        password = validated_data.pop("password")

        request = self.context.get("request")
        company = request.user.company

        user = User.objects.create(
            is_active=True,
            role=User.ROLE_EMPLOYEE,
            company=company,
            **validated_data
        )

        user.set_password(password)
        user.save()

        PhoneNumber.objects.create(
            user=user,
            number=phone_number
        )

        return user

class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)

    def validate(self, data):
        if not data['refresh']:
            raise serializers.ValidationError({"detail": "Refresh token cannot be empty."})
        return data
    
class OTPResetSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    phone = serializers.CharField(required=False)
    otp = serializers.CharField(required=True, max_length=6)
    new_password = serializers.CharField(required=True, write_only=True)
    re_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['re_new_password']:
            raise serializers.ValidationError({"detail": "Passwords do not match."})
        email = attrs.get('email')
        phone = attrs.get('phone')
        if not email and not phone:
            raise serializers.ValidationError({"detail": "Provide either phone or email."})
        if phone:
            phone = normalize_phone(phone)
            user = User.objects.filter(phone_numbers__number=phone, is_active=True).first()
            otp_type = OTPCode.TYPE_SMS
        else:
            user = User.objects.filter(email=email, is_active=True).first()
            otp_type = OTPCode.TYPE_EMAIL
        if not user:
            raise serializers.ValidationError({"detail": "User not found."})
        
        # Get the latest unused OTP for this purpose and type
        otp_obj = OTPCode.objects.filter(
            user_id=user.id,
            purpose=OTPCode.PURPOSE_RESET,
            type=otp_type,
            used=False,
            expires_at__gt=timezone.now() - timedelta(seconds=1)  
        ).order_by('-expires_at').first()
        
        if not otp_obj:
            raise serializers.ValidationError({"detail": "No valid OTP found for reset."})
        if otp_obj.is_expired:
            raise serializers.ValidationError({"detail": "OTP has expired."})
        
        if otp_obj.is_locked:
            otp_obj.mark_used()
            raise serializers.ValidationError({"detail": "Too many failed attempts. Please request a new OTP."})
        
        # Verify the OTP using the model's method
        verified = otp_obj.verify(attrs['otp'])
        if verified:
            attrs['user'] = user
            return attrs
        else:
            # Since other cases are handled, this must be an incorrect code
            remaining = otp_obj.remain_attempt()
            raise serializers.ValidationError(f"Invalid OTP. {remaining} attempt{'s' if remaining != 1 else ''} remaining.")

    def save(self):
        user = self.validated_data['user']
        user.set_password(self.validated_data['new_password'])
        user.save()

class CurrentUserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["username", "email", "avatar"]

    def get_avatar(self, obj):
        request = self.context.get("request")
        avatar = obj.profile.avatar
        if avatar:
            return request.build_absolute_uri(avatar.url)
        return None