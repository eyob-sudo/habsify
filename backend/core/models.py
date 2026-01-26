from django.db import models
from django.contrib.auth.models import AbstractUser


class Company(models.Model):
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="owned_companies"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class User(AbstractUser):
    ROLE_CHOICES = [
        ('business_admin', 'Business Admin'),
        ('employee', 'Employee'),
        ('super_admin', 'Super Admin'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    email = models.EmailField(unique=True)
    company = models.ForeignKey(
        Company,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users"
    )

    REQUIRED_FIELDS = ['email']

