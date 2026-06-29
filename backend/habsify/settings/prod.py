from .base import *
import dj_database_url
import os

# CORE
DEBUG = False

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="habsify-api.up.railway.app,habsify.up.railway.app"
).split(",")

# DATABASE
DATABASES = {
    "default": dj_database_url.config(
        default=os.environ.get("DATABASE_URL"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"

# CUSTOM URL SETTINGS
CLIENT_URL = config("CLIENT_URL", default="https://habsify.up.railway.app")
SITE_PROTOCOL = config("SITE_PROTOCOL", default="https")

# EMAIL
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# CORS & CSRF
CORS_ALLOWED_ORIGINS = [
    config("CLIENT_URL"),
]

CSRF_TRUSTED_ORIGINS = [
    "https://habsify-api.up.railway.app",
    config("CLIENT_URL"),
]

# SECURITY — Production hardening
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CACHE_MIDDLEWARE_SECONDS = 0

print("🔴 Loaded PROD settings")
