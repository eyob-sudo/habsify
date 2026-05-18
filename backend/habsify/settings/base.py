from pathlib import Path
from datetime import timedelta
from urllib import response
from decouple import config
from celery.schedules import crontab
from corsheaders.defaults import default_headers
import os

# settings/base.py is two levels deep: backend/habsify/settings/base.py
BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY")
DEBUG = False  # Overridden in dev.py
ALLOWED_HOSTS = []  # Overridden in dev.py / prod.py

INSTALLED_APPS = [
    "corsheaders",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "django_filters",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "djoser",
    "phonenumber_field",
    "django_ratelimit",
    "django_celery_beat",

    # Local apps
    "home",
    "accounts",
    "core",
    "subscriptions",
    "crm",
    "suppliers",
    "sales_purchases",
    "inventory",
    "finance",
    "notifications",
    "tasks",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "habsify.urls"
WSGI_APPLICATION = "habsify.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


LOGIN_FIELD = "email"
PHONE_COUNTRY_CODE = "251"
PHONENUMBER_DEFAULT_REGION = None

OTP_EXPIRY_SECONDS = 60 * 60
OTP_MAX_ATTEMPTS = 5
OTP_EXPIRY_MINUTES = config("OTP_EXPIRY_MINUTES", default=2, cast=int)


REST_FRAMEWORK = {
    "COERCE_DECIMAL_TO_STRING": False,
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
    "DEFAULT_PERMISSION_CLASSES": [
        "crm.permissions.HasActiveSubscription",
    ],
}

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
    "BLACKLIST_AFTER_ROTATION": True,
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "TOKEN_OBTAIN_SERIALIZER": "accounts.serializers.CustomTokenObtainPairSerializer",
}

DJOSER = {
    "LOGIN_FIELD": "email",
    "ACTIVATION_URL": "accounts/activate/{uid}/{token}",
    "USER_CREATE_PASSWORD_RETYPE": True,
    "SEND_ACTIVATION_EMAIL": False,
    "SERIALIZERS": {
        "user_create_password_retype": "accounts.serializers.CreatePasswordRetypeSerializer",
        "token_create": "accounts.serializers.CustomTokenCreateSerializer",
    },
}


EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = config("EMAIL_PORT", default=465, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=False, cast=bool)
EMAIL_USE_SSL = config("EMAIL_USE_SSL", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default=EMAIL_HOST_USER)

TWILIO_ACCOUNT_SID = config("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = config("TWILIO_AUTH_TOKEN", default="")
TWILIO_PHONE_NUMBER = config("TWILIO_PHONE_NUMBER", default="")

CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://redis:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

CELERY_BEAT_SCHEDULE = {
    "daily-notifications": {
        "task": "notifications.tasks.generate_daily_notifications",
        "schedule": crontab(hour=0, minute=0),
    },
    "notify-due-tasks": {
        "task": "tasks.tasks.notify_due_tasks",
        "schedule": crontab(hour=0, minute=0),
    },
}


CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = list(default_headers) + ["authorization", "content-type"]


SILENCED_SYSTEM_CHECKS = ["django_ratelimit.E003", "django_ratelimit.W001"]


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "account": {"handlers": ["console"], "level": "INFO"},
    },
}
CACHE_MIDDLEWARE_SECONDS = 0