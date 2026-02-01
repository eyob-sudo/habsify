from datetime import timedelta
from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from phonenumber_field.modelfields import PhoneNumberField
from core.models import Company


def default_otp_expiry():
    return timezone.now() + timedelta(minutes=10)


class User(AbstractUser):
    ROLE_BUSINESS_ADMIN = 'business_admin'
    ROLE_EMPLOYEE = 'employee'
    ROLE_SUPER_ADMIN = 'super_admin'

    ROLE_CHOICES = [
        (ROLE_BUSINESS_ADMIN, 'Business Admin'),
        (ROLE_EMPLOYEE, 'Employee'),
        (ROLE_SUPER_ADMIN, 'Super Admin'),
    ]

    VERIFICATION_PHONE = 'phone'
    VERIFICATION_EMAIL = 'email'

    VERIFICATION_CHOICES = [
        (VERIFICATION_PHONE, 'Phone'),
        (VERIFICATION_EMAIL, 'Email'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_BUSINESS_ADMIN)
    email = models.EmailField(unique=True)
    company = models.ForeignKey(
        "core.Company", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="users"
    )

    verification_method = models.CharField(max_length=10, choices=VERIFICATION_CHOICES, null=True, blank=True)
    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members"
    )

    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['email', 'role']),
        ]

    def __str__(self):
        return self.email or self.username


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_profile_complete = models.BooleanField(default=False)

    # optional helper for OTP throttling / debugging
    last_otp_sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Profile for {self.user.email or self.user.username}"


class PhoneNumber(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='phone_numbers')
    number = PhoneNumberField(
        unique=True,
        null=True,
        blank=True,
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    is_primary = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['number']),
        ]

    def __str__(self):
        return self.number

    def mark_verified(self):
        """Mark this phone as verified and update the user flags."""
        self.verified_at = timezone.now()
        self.save(update_fields=['verified_at'])
        # update user flags
        user = self.user
        user.is_phone_verified = True
        user.verification_method = user.VERIFICATION_PHONE
        user.save(update_fields=['is_phone_verified', 'verification_method'])


class OTPCode(models.Model):
    MAX_ATTEMPTS = 5

    TYPE_SMS = 'sms'
    TYPE_EMAIL = 'email'
    TYPE_CHOICES = [
        (TYPE_SMS, 'SMS'),
        (TYPE_EMAIL, 'Email'),
    ]
    
    PURPOSE_SIGNUP = "signup"
    PURPOSE_RESET = "reset"
    PURPOSE_VERIFY = "verify"

    PURPOSE_CHOICES = [
        (PURPOSE_SIGNUP, "Signup"),
        (PURPOSE_RESET, "Password Reset"),
        (PURPOSE_VERIFY, "Verify Contact"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='otps')
    code = models.CharField(max_length=6)
    # purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
    type = models.CharField(max_length=5, choices=TYPE_CHOICES, default=TYPE_EMAIL)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True, default=default_otp_expiry)
    used = models.BooleanField(default=False, db_index=True)
    attempts = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('user', 'code')
        indexes = [
            models.Index(fields=['user', 'used', 'expires_at']),
            models.Index(fields=['code']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        identifier = ''
        try:
            identifier = self.user.profile.phone_numbers.first().number
        except Exception:
            pass
        if not identifier:
            identifier = self.user.email or self.user.username
        return f"OTP ({self.type}) for {identifier}"
    
    @property
    def is_locked(self):
        return self.attempts >= self.MAX_ATTEMPTS
    
    @property
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    def can_attempt(self):
            return self.attempts < self.MAX_ATTEMPTS and not self.used
    
    def remain_attempt(self):
        return self.MAX_ATTEMPTS - self.attempts 

    def verify(self, input_code: str) -> bool:
        if self.used or self.is_expired:
            return False

        self.attempts += 1

        if self.code == input_code:
            self.used = True
            self.save(update_fields=["used", "attempts"])
            return True

        self.save(update_fields=["attempts"])
        return False
    
    def mark_used(self):
        self.used = True
        self.save(update_fields=['used'])
