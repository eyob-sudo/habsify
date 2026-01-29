from djoser.serializers import UserCreatePasswordRetypeSerializer as BaseUserCreatePasswordRetypeSerializer
from rest_framework import serializers
from core.models import Company
from accounts.utils import create_otp_for_user, send_otp_to_phone, normalize_phone
from .models import User, PhoneNumber
from .validators import (
    validate_unique_email,
    validate_unique_username,
)
class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['name']

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = ['number']
    def validate_number(self, value):
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
        return super().create(validated_data)