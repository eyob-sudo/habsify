import random
import logging
from datetime import timedelta
from django.utils import timezone
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from django.conf import settings
from accounts.models import OTPCode, Profile
from phonenumber_field.phonenumber import PhoneNumber
from rest_framework.exceptions import ValidationError

logger = logging.getLogger('account')

def generate_otp(length=6):
    """Generate a random numeric OTP of given length."""
    return ''.join(random.choices('0123456789', k=length))

def normalize_phone(phone_str):
    if not phone_str.startswith("+"):
        raise ValidationError("Phone number must be in international format (+...)")
    try:
        phone = PhoneNumber.from_string(phone_str)
    except Exception:
        raise ValidationError("Invalid phone number format")

    if not phone.is_valid():
        raise ValidationError("Invalid phone number")
    return phone.as_e164

def send_otp_to_phone(profile: Profile, otp_code: str, otp_type=OTPCode.TYPE_SMS):
    """Send OTP via Twilio SMS."""
    if not profile.phone:
        raise ValueError("Profile has no phone number.")
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    message_body = f"Your OTP code is {otp_code}. It expires in 10 minutes."
    try:
        message = client.messages.create(
            body=message_body,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=str(profile.phone)
        )
        if message.status in ['failed', 'undelivered']:
            logger.error(f"SMS failed for {profile.phone}: {message.error_message}")
            raise ValueError("SMS delivery failed.")
        logger.info(f"OTP sent to {profile.phone}")
        return True
    except TwilioRestException as e:
        logger.error(f"Twilio error: {e}")
        raise

def create_otp_for_user(user, otp_type=OTPCode.TYPE_SMS):
    """Create OTP with expiration."""
    otp = generate_otp()
    expires_at = timezone.now() + timedelta(minutes=10)
    otp_obj = OTPCode.objects.create(
        user=user,
        code=otp,
        type=otp_type,
        expires_at=expires_at
    )
    return otp, otp_obj

# For async (optional: requires Celery setup)
# from celery import shared_task
# @shared_task
# def send_otp_async(profile_id, otp):
#     profile = Profile.objects.get(id=profile_id)
#     send_otp_to_phone(profile, otp)