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
    updated_at = models.DateTimeField(auto_now=True)


class User(AbstractUser):
    ROLE_BUSINESS_ADMIN ='business_admin'
    ROLE_EMPLOYEE = 'employee'
    ROLE_SUPER_ADMIN = 'super_admin'

    ROLE_CHOICES = [
        (ROLE_BUSINESS_ADMIN, 'Business Admin'),
        (ROLE_EMPLOYEE, 'Employee'),
        (ROLE_SUPER_ADMIN, 'Super Admin'),
    ]


    role = models.CharField(max_length=20, choices=ROLE_CHOICES,default=ROLE_BUSINESS_ADMIN)
    email = models.EmailField(unique=True)
    company = models.ForeignKey(
        Company,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users"
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'role']

