from djoser.serializers import UserCreatePasswordRetypeSerializer, UserSerializer
from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import authenticate
from accounts.models import User, Profile, OTPCode
from core.models import Company
from accounts.utils import create_otp_for_user, send_otp_to_phone, normalize_phone
import logging
from time import timezone
from datetime import timedelta
from rest_framework import serializers
from djoser.email import ActivationEmail
from djoser.utils import encode_uid
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings as django_settings

logger = logging.getLogger('account')

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['name']

# class UserCreateSerializer(UserCreatePasswordRetypeSerializer):
#     company = CompanySerializer(required=False)  # Optional for non-admin roles
#     phone = serializers.CharField(required=False, max_length=20)

#     class Meta:
#         model = User
#         fields = (
#             'id',
#             'email',
#             'username',
#             'password',
#             'company',
#             'phone',
#             'role',
#         )

#     def validate(self, attrs):
#         company_data = attrs.pop('company', None)
#         phone = attrs.pop('phone', None)
#         attrs = super().validate(attrs)
#         role = attrs.get('role', User.ROLE_BUSINESS_ADMIN)
#         if role == User.ROLE_BUSINESS_ADMIN:
#             if company_data is None:
#                 raise serializers.ValidationError("Company is required for business admins.")
#             attrs['company_data'] = company_data
#         if phone:
#             try:
#                 attrs['phone'] = normalize_phone(phone)
#             except ValueError:
#                 raise serializers.ValidationError("Invalid phone number format (e.g., use +251912345678).")
#         return attrs

#     def create(self, validated_data):
#         company_data = validated_data.pop('company_data', None)
#         phone = validated_data.pop('phone', None)
#         role = validated_data.get('role', User.ROLE_BUSINESS_ADMIN)
#         with transaction.atomic():
#             verification_method = User.VERIFICATION_PHONE if phone else User.VERIFICATION_EMAIL
#             validated_data['verification_method'] = verification_method
#             validated_data['is_active'] = False

#             user = super().create(validated_data)
#             profile = user.profile
#             if phone:
#                 profile.phone = phone
#                 profile.save()
#                 try:
#                     otp, _ = create_otp_for_user(user, OTPCode.TYPE_SMS)
#                     send_otp_to_phone(profile, otp)  # Or send_otp_async.delay(profile.id, otp) if Celery
#                     logger.info(f"OTP sent during signup for {user.email}")
#                 except ValueError as e:
#                     logger.error(f"OTP send failed during signup for {user.email}: {str(e)}")
#                     raise serializers.ValidationError("Failed to send OTP.")
#             else:
#                 try:
#                     uid = encode_uid(user.pk)
#                     token = default_token_generator.make_token(user)
#                     protocol = 'https'
#                     domain = django_settings.BASE_URL
#                     activation_url = f"{protocol}://{domain}/{django_settings.DJOSER['ACTIVATION_URL'].format(uid=uid, token=token)}"
#                     context = {
#                         'user': user,
#                         'uid': uid,
#                         'token': token,
#                         'protocol': protocol,
#                         'domain': domain,
#                         'url': activation_url,
#                     }
#                     request = self.context.get("request")
#                     ActivationEmail(
#                         request=request,
#                         context=context).send([user.email])
#                     logger.info(f"Activation email sent for {user.email}")
#                 except Exception as e:
#                     logger.error(f"Email send failed during signup for {user.email}: {str(e)}")
#                     raise serializers.ValidationError("Failed to send activation email.")

#             if role == User.ROLE_BUSINESS_ADMIN and company_data:
#                 company = Company.objects.create(
#                     name=company_data['name'],
#                     owner=user
#                 )
#                 user.company = company
#                 user.save(update_fields=['company'])
#         return user

class CustomLoginSerializer(serializers.Serializer):
    login = serializers.CharField(required=True)
    password = serializers.CharField(required=True, style={'input_type': 'password'})

    default_error_messages = {
        'invalid_credentials': 'Unable to log in with provided credentials.',
        'inactive_account': 'User account is disabled.',
        'unverified_phone': 'Phone number must be verified to log in with phone.',
    }

    def validate(self, attrs):
        login = attrs.get('login')
        password = attrs.get('password')
        is_email = '@' in login
        normalized_login = login.strip()
        if not is_email:
            try:
                normalized_login = normalize_phone(normalized_login)
            except ValueError:
                raise serializers.ValidationError(self.default_error_messages['invalid_credentials'])
        try:
            if is_email:
                user = User.objects.get(email__iexact=login)
            else:
                profile = Profile.objects.get(phone=normalized_login)
                user = profile.user
                if not profile.is_verified:
                    raise serializers.ValidationError(self.default_error_messages['unverified_phone'])
        except (User.DoesNotExist, Profile.DoesNotExist):
            raise serializers.ValidationError(self.default_error_messages['invalid_credentials'])
        user = authenticate(username=user.email, password=password)
        if user is None:
            raise serializers.ValidationError(self.default_error_messages['invalid_credentials'])
        if not user.is_active:
            raise serializers.ValidationError(self.default_error_messages['inactive_account'])
        attrs['user'] = user
        return attrs

class SendOTPSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False)
    class Meta:
        model = Profile
        fields = ['phone']

    def validate(self, attrs):
        request = self.context['request']
        if request.user.is_authenticated:
            user = request.user
        else:
            phone = attrs.get('phone')
            if not phone:
                raise serializers.ValidationError("Phone number is required if not authenticated.")
            try:
                normalized_phone = normalize_phone(phone)
                profile = Profile.objects.get(phone=normalized_phone)
                user = profile.user
            except (ValueError, Profile.DoesNotExist):
                raise serializers.ValidationError("User with this phone not found.")
        attrs['user'] = user
        try:
            attrs['profile'] = user.profile
        except AttributeError:
            raise serializers.ValidationError("User profile not found.")
        if not attrs['profile'].phone:
            raise serializers.ValidationError("User has no phone number set.")
        return attrs

    def create(self, validated_data):
        user = validated_data['user']
        profile = validated_data['profile']
        # Add cooldown check (e.g., last OTP > 2 min)
        last_otp = OTPCode.objects.filter(user=user, type=OTPCode.TYPE_SMS).order_by('-created_at').first()
        if last_otp and timezone.now() - last_otp.created_at < timedelta(minutes=2):
            raise serializers.ValidationError("Please wait before resending OTP.")
        try:
            otp, _ = create_otp_for_user(user, OTPCode.TYPE_SMS)
            send_otp_to_phone(profile, otp)
            return {'detail': 'OTP sent successfully.'}
        except ValueError as e:
            logger.error(f"OTP send error: {e}")
            raise serializers.ValidationError("Failed to send OTP.")

class VerifyOTPSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)

    def validate(self, attrs):
        request = self.context['request']
        if not request.user.is_authenticated:
            raise serializers.ValidationError("Authentication required for OTP verification.")
        user = request.user
        code = attrs['code']
        try:
            otp = OTPCode.objects.get(
                user=user,
                code=code,
                type=OTPCode.TYPE_SMS,
                used=False,
                expires_at__gt=timezone.now()
            )
            if otp.attempts >= 5:  # Max attempts
                otp.delete()
                raise serializers.ValidationError("Too many attempts. OTP invalidated.")
            otp.attempts += 1
            otp.save()
        except OTPCode.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired OTP.")
        attrs['otp'] = otp
        return attrs

    def create(self, validated_data):
        otp = validated_data['otp']
        otp.used = True
        otp.save()
        profile = otp.user.profile
        profile.is_verified = True
        profile.save()
        user = otp.user
        if user.verification_method == User.VERIFICATION_PHONE:
            user.is_active = True
            user.save()
        logger.info(f"OTP verified for user {otp.user.email}")
        return {'detail': 'OTP verified successfully.'}
    
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
# from ratelimit import RateLimitMixin
# from ratelimit.exceptions import Ratelimited
from djoser.serializers import ActivationSerializer
from django.conf import settings
from accounts.serializers import SendOTPSerializer, VerifyOTPSerializer
import requests

# class RateLimitedAPIView(RateLimitMixin, APIView):
#     ratelimit_key = 'ip'
#     ratelimit_rate = '5/h'
#     ratelimit_block = True
#     ratelimit_method = 'POST'

#     def handle_exception(self, exc):
#         if isinstance(exc, Ratelimited):
#             return Response({'detail': 'Rate limit exceeded.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
#         return super().handle_exception(exc)


# RateLimitedAPIView
class SendOTPView(ViewSet):
    permission_classes = [AllowAny]

    def create(self, request):
        serializer = SendOTPSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                'detail': 'OTP sent successfully.',
                'redirect_url': '/verify-otp/'
            },
            status=status.HTTP_200_OK
        )

class VerifyOTPView(ViewSet):
    permission_classes = []

    def create(self, request):
        serializer = VerifyOTPSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response(result, status=status.HTTP_200_OK)


class ActivationView(APIView):
    permission_classes = []

    def get(self, request, uid, token):
        activation_url = request.build_absolute_uri('/auth/users/activation/')
        payload = {'uid': uid, 'token': token}

        resp = requests.post(activation_url, json=payload)

        if resp.status_code in (200, 204):
            return HttpResponseRedirect(f"{settings.BASE_URL}/auth/jwt/create/")
        else:
            return HttpResponseRedirect(f"{settings.BASE_URL}/auth/users/")
        

from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
# from ratelimit import RateLimitMixin
# from ratelimit.exceptions import Ratelimited
from djoser.serializers import ActivationSerializer
from django.http import HttpResponseRedirect
from django.conf import settings
from accounts.serializers import SendOTPSerializer, VerifyOTPSerializer
import requests

# class RateLimitedAPIView(RateLimitMixin, APIView):
#     ratelimit_key = 'ip'
#     ratelimit_rate = '5/h'
#     ratelimit_block = True
#     ratelimit_method = 'POST'

#     def handle_exception(self, exc):
#         if isinstance(exc, Ratelimited):
#             return Response({'detail': 'Rate limit exceeded.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
#         return super().handle_exception(exc)


# RateLimitedAPIView
class SendOTPView(ViewSet):
    permission_classes = [AllowAny]

    def create(self, request):
        serializer = SendOTPSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                'detail': 'OTP sent successfully.',
                'redirect_url': '/verify-otp/'
            },
            status=status.HTTP_200_OK
        )

class VerifyOTPView(ViewSet):
    permission_classes = []

    def create(self, request):
        serializer = VerifyOTPSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response(result, status=status.HTTP_200_OK)


class ActivationView(APIView):
    permission_classes = []

    def get(self, request, uid, token):
        activation_url = request.build_absolute_uri('/auth/users/activation/')
        payload = {'uid': uid, 'token': token}

        resp = requests.post(activation_url, json=payload)

        if resp.status_code in (200, 204):
            return HttpResponseRedirect(f"{settings.BASE_URL}/auth/jwt/create/")
        else:
            return HttpResponseRedirect(f"{settings.BASE_URL}/auth/users/")
        



        