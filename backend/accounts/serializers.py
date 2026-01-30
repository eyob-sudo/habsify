from django.db import transaction
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings as django_settings
from djoser.serializers import UserCreatePasswordRetypeSerializer as BaseUserCreatePasswordRetypeSerializer,ActivationSerializer as BaseActivationSerializer
from djoser.utils import encode_uid
from djoser.email import ActivationEmail
from rest_framework import serializers
from core.models import Company
from accounts.utils import create_otp_for_user, send_otp_to_phone, normalize_phone
from .models import User, PhoneNumber,OTPCode
from .validators import validate_unique_email, validate_unique_username

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['name']

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = ['number']

    def validate_number(self, value):
        if not value:
            return value
        return normalize_phone(value)


class CreatePasswordRetypeSerializer(BaseUserCreatePasswordRetypeSerializer):
    email = serializers.EmailField(validators=[validate_unique_email])
    username = serializers.CharField(validators=[validate_unique_username])
    phone = PhoneNumberSerializer(write_only=True, required=False)
    company = CompanySerializer()
    class Meta:
        model = User
        fields = ['id','email','first_name','last_name','username','password','phone','company']

    def validate(self, attrs):
        self.company_data = attrs.pop('company', None)
        self.phone_data = attrs.pop('phone', None)
        return super().validate(attrs)


    def create(self, validated_data):
        company_data = self.company_data
        phone = self.phone_data
        with transaction.atomic():
            validated_data['verification_method'] = User.VERIFICATION_PHONE if phone else User.VERIFICATION_EMAIL
            validated_data['is_active'] = False

            user = super().create(validated_data)
            if phone['number']:
                PhoneNumber.objects.create(user=user, number=phone['number'])
                try:
                    otp, _ = create_otp_for_user(user, OTPCode.TYPE_SMS)
                    send_otp_to_phone(phone=phone['number'], otp_code=otp)  # Or send_otp_async.delay(profile.id, otp) if Celery
                except ValueError as e:
                    # logger.error(f"OTP send failed during signup for {user.email}: {str(e)}")
                    raise serializers.ValidationError("Failed to send OTP.")
            else:
                try:
                    uid = encode_uid(user.pk)
                    token = default_token_generator.make_token(user)
                    protocol = django_settings.SITE_PROTOCOL
                    domain = django_settings.SITE_DOMAIN
                    activation_url = f"{protocol}://{domain}/{django_settings.DJOSER['ACTIVATION_URL'].format(uid=uid, token=token)}"
                    context = {
                        'user': user,
                        'uid': uid,
                        'token': token,
                        'protocol': protocol,
                        'domain': domain,
                        'url': activation_url,
                    }
                    request = self.context.get("request")
                    ActivationEmail(
                        request=request,
                        context=context).send([user.email])
                    # logger.info(f"Activation email sent for {user.email}")
                except Exception as e:
                    # logger.error(f"Email send failed during signup for {user.email}: {str(e)}")
                    raise serializers.ValidationError("Failed to send activation email.")
            if company_data['name']:
                company = Company.objects.create(
                    name=company_data['name'],
                    owner=user
                )
                user.company=company
                user.save(update_fields=['company'])
        return user
    

class ActivationSerializer(BaseActivationSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        return data