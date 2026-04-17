"""
Django settings for habsify project.
"""

from pathlib import Path
from decouple import config
from datetime import timedelta
from celery.schedules import crontab
import os
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent

# =========================================================================
# BASIC SETTINGS
# ==============================================================================
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = ["habsifybackend-prod-7a317b11fa8d.herokuapp.com"]
# ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1").split(",")

# ==============================================================================
# APPLICATIONS & MIDDLEWARE
# ==============================================================================
INSTALLED_APPS = [
    'corsheaders',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'django_filters',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'djoser',
    'phonenumber_field',
    'django_ratelimit',
    'django_celery_beat',

    # Local apps
    'home',
    'accounts',
    'core',
    'subscriptions',
    'crm',
    'suppliers',
    'sales_purchases',
    'inventory',
    'finance',
    'notifications',
    'tasks',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ==============================================================================
# DJANGO CORE SETTINGS
# ==============================================================================
ROOT_URLCONF = 'habsify.urls'
WSGI_APPLICATION = 'habsify.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="habsify_db"),
        "USER": config("POSTGRES_USER", default="habsify_user"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="habsify_password"),
        "HOST": config("POSTGRES_HOST", default="db"),
        "PORT": config("POSTGRES_PORT", default="5432"),
    }
}

if not DEBUG:
    DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ==============================================================================
# STATIC & MEDIA
# ==============================================================================
STATIC_URL = '/static/'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ==============================================================================
# CUSTOM SETTINGS
# ==============================================================================
BASE_URL = config("BASE_URL", default="localhost:8000")
SITE_DOMAIN = config("SITE_DOMAIN", default="localhost:5173")
CLIENT_URL = config("CLIENT_URL", default="localhost:5173")
SITE_PROTOCOL = config("SITE_PROTOCOL", default="http")
LOGIN_FIELD = "email"

PHONE_COUNTRY_CODE = '251'
PHONENUMBER_DEFAULT_REGION = None

OTP_EXPIRY_SECONDS = 60 * 60
OTP_MAX_ATTEMPTS = 5
OTP_EXPIRY_MINUTES = config("OTP_EXPIRY_MINUTES", default=2, cast=int)

# ==============================================================================
# REST FRAMEWORK + JWT + DJOSER
# ==============================================================================
REST_FRAMEWORK = {
    'COERCE_DECIMAL_TO_STRING': False,
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_PERMISSION_CLASSES': [
        'crm.permissions.HasActiveSubscription',
    ]
}

SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),
    'BLACKLIST_AFTER_ROTATION': True,
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
}

DJOSER = {
    'LOGIN_FIELD': 'email',
    'ACTIVATION_URL': 'accounts/activate/{uid}/{token}',
    'USER_CREATE_PASSWORD_RETYPE': True,
    'SEND_ACTIVATION_EMAIL': False,
    'SERIALIZERS': {
        'user_create_password_retype': 'accounts.serializers.CreatePasswordRetypeSerializer',
    },
}

# ==============================================================================
# EMAIL + TWILIO
# ==============================================================================
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("EMAIL_HOST")
EMAIL_PORT = config("EMAIL_PORT", default=465, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=False, cast=bool)
EMAIL_USE_SSL = config("EMAIL_USE_SSL", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default=EMAIL_HOST_USER)

TWILIO_ACCOUNT_SID = config('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = config('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = config('TWILIO_PHONE_NUMBER')

# ==============================================================================
# CELERY
# ==============================================================================
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
    'notify-due-tasks': {
        'task': 'tasks.tasks.notify_due_tasks',
        'schedule': crontab(hour=0, minute=0),
    },
}

# ==============================================================================
# CORS (Fixed for your React frontend)
# ==============================================================================
CORS_ALLOWED_ORIGINS = [
    "https://habsify-54f41bb3faf3.herokuapp.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://habsifyerp.onrender.com",
]
CSRF_TRUSTED_ORIGINS = [
    "https://habsify-54f41bb3faf3.herokuapp.com",
]
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = list(default_headers) + ["authorization", "content-type"]

# ==============================================================================
# CACHE (Temporarily using local memory)
# ==============================================================================
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# ==============================================================================
# SECURITY & LOGGING
# ==============================================================================
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'account': {'handlers': ['console'], 'level': 'INFO'},
    },
}

# Silence django-ratelimit warnings (because we are using LocMemCache)
SILENCED_SYSTEM_CHECKS = ['django_ratelimit.E003', 'django_ratelimit.W001']