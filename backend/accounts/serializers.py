from djoser.serializers import UserCreatePasswordRetypeSerializer as BaseUserCreatePasswordRetypeSerializer
from rest_framework import serializers
from .models import User, PhoneNumber
from core.models import Company

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['name']

class PhoneNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneNumber
        fields = ['number']

class CreatePasswordRetypeSerializer(BaseUserCreatePasswordRetypeSerializer):
    phone = PhoneNumberSerializer()
    company = CompanySerializer()
    class Meta:
        model = User
        fields = ['id','email','first_name','last_name','username','password','phone','company']


    def create(self, validated_data):
        company_data = validated_data.pop('company', None)
        company_data = validated_data.pop('phone', None)
        print("=======================", company_data)
        print("=======================", company_data)
        return super().create(validated_data)