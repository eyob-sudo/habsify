"""
Development settings for local Docker environment.
"""
from .base import *
import dj_database_url

DEBUG = True

ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ.get(
            "DATABASE_URL",
            "postgresql://postgres:postgres@db:5432/habsify_db",
        ),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

BASE_URL = config("BASE_URL", default="http://localhost:8000")
SITE_DOMAIN = config("SITE_DOMAIN", default="localhost:5173")
CLIENT_URL = config("CLIENT_URL", default="http://localhost:5173")
SITE_PROTOCOL = config("SITE_PROTOCOL", default="http")


EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"


CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
CORS_ALLOW_ALL_ORIGINS = True   
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]


SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

EMAIL_TIMEOUT = 30

# INSTALLED_APPS += ["debug_toolbar"]
# MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE
# INTERNAL_IPS = ["127.0.0.1"]

print("🟢   Loaded DEV settings")
CACHE_MIDDLEWARE_SECONDS = 0
