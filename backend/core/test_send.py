# core/test_send.py
import os
import sys
import django

# Add the project root to Python path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'habsify.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("Using EMAIL_HOST:", settings.EMAIL_HOST)
print("Using EMAIL_HOST_USER:", settings.EMAIL_HOST_USER)

try:
    sent = send_mail(
        subject='Gmail SMTP Test - It Works!',
        message='Congratulations Eyob! Your Gmail SMTP is working perfectly.\n\nYou can now receive activation emails.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=['eyob.m.dev@gmail.com'],  # or your personal email
        fail_silently=False,
    )
    print(f"✅ SUCCESS! Email sent: {sent}")
except Exception as e:
    print("❌ Failed:", str(e))