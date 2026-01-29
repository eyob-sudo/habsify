from rest_framework import serializers
from .models import User, PhoneNumber


def validate_unique_email(value):
    if User.objects.filter(email=value).exists():
        raise serializers.ValidationError("Email already exists")


def validate_unique_username(value):
    if User.objects.filter(username=value).exists():
        raise serializers.ValidationError("Username already taken")


# def validate_unique_phone(number):
#     if PhoneNumber.objects.filter(number=number).exists():
#         raise serializers.ValidationError("Phone number already in use")
