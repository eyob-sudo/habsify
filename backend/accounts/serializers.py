from django.db import transaction
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings as django_settings
from django.contrib.auth.hashers import check_password
from djoser.serializers import UserCreatePasswordRetypeSerializer as BaseUserCreatePasswordRetypeSerializer
from djoser.utils import decode_uid
from rest_framework import serializers
from core.models import Company
from django.utils import timezone
from rest_framework import status
from .utils import create_otp_for_user, send_otp_to_phone, normalize_phone, send_activation_email, send_otp_email
from .models import User, PhoneNumber, OTPCode,Profile
from .validators import validate_unique_email, validate_unique_username

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['name']

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Company name cannot be empty.")
        return value

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = ['number']

    def validate_number(self, value):
        if not value:
            return value
        try:
            return normalize_phone(value)
        except serializers.ValidationError as e:
            raise serializers.ValidationError(str(e))

class CreatePasswordRetypeSerializer(BaseUserCreatePasswordRetypeSerializer):
    email = serializers.EmailField(validators=[validate_unique_email])
    username = serializers.CharField(validators=[validate_unique_username])
    phone = PhoneNumberSerializer(write_only=True, required=False)
    company = CompanySerializer(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'username', 'password', 'phone', 'company']

    def validate(self, attrs):
        self.company_data = attrs.pop('company', None)
        self.phone_data = attrs.pop('phone', None)
        # if self.phone_data and not self.phone_data.get('number'):
        #     raise serializers.ValidationError({"phone": "Phone number is required if phone data is provided."})
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
                    raise serializers.ValidationError("Failed to send OTP.")
            else:
                try:
                    send_activation_email(user, request=self.context.get("request"))
                except Exception as e:
                    raise serializers.ValidationError("Failed to send activation email.")
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
            raise serializers.ValidationError("OTP must be 6 digits.")
        try:
            otp = OTPCode.objects.filter(
                code=code,
                used=False,
                expires_at__gt=timezone.now()
            ).latest("created_at")
        except OTPCode.DoesNotExist:
            raise serializers.ValidationError("No valid OTP found. It may have expired or been used.")

        if otp.is_locked:
            otp.mark_used()
            raise serializers.ValidationError("Too many failed attempts. OTP invalidated.")

        attrs["otp"] = otp
        attrs["user"] = otp.user
        return attrs

class ResendActivationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value, is_active=False)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found or already active.")
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
            raise serializers.ValidationError("Provide either phone number or email.")
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
            raise serializers.ValidationError("User not found.")
        attrs["user"] = user
        return attrs
    
class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)
    re_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['re_new_password']:
            raise serializers.ValidationError("Passwords do not match.")
        try:
            uid_decoded = decode_uid(attrs['uid'])
            self.user = User.objects.get(pk=uid_decoded)
        except (User.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError("Invalid UID.")
        if not default_token_generator.check_token(self.user, attrs['token']):
            raise serializers.ValidationError("Invalid or expired token.")
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
            raise serializers.ValidationError("Password must be at least 6 characters long.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError({"old_password": "Wrong password"})
        
        if attrs["new_password"] != attrs["confirm_password"]:
                raise serializers.ValidationError({"confirm_password": "Passwords do not match"})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user

class ProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name')
    user_last_name = serializers.CharField(source='user.last_name')
    role = serializers.CharField(source='user.role')

    class Meta:
        model = Profile
        fields = [
            'updated_at',
            'user_email',
            'user_username',
            'user_first_name',
            'user_last_name',
            'role',
            'street_address',
            'city',
            'state',
            'zip_code',
        ]
        read_only_fields = ['updated_at']

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
       
        if user_data:
            for attr, value in user_data.items():
                setattr(instance.user, attr, value)
            instance.user.save()

        return super().update(instance, validated_data)