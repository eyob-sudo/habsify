"""
Production settings for Heroku + Azure PostgreSQL.
"""
from .base import *
import dj_database_url

# CORE
DEBUG = False

ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="habsifybackend-prod-7a317b11fa8d.herokuapp.com",
).split(",")
print("DATABASE_URL =", os.environ.get("DATABASE_URL"))
# DATABASE — Azure PostgreSQL
DATABASES = {
    "default": dj_database_url.config(
        default=os.environ.get("DATABASE_URL"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# Force SSL for Azure
DATABASES["default"].setdefault("OPTIONS", {})["sslmode"] = "require"

# CUSTOM URL SETTINGS
BASE_URL = config("BASE_URL", default="https://habsifybackend-prod-7a317b11fa8d.herokuapp.com")
SITE_DOMAIN = config("SITE_DOMAIN", default="habsify-54f41bb3faf3.herokuapp.com")
CLIENT_URL = config("CLIENT_URL", default="https://habsify-54f41bb3faf3.herokuapp.com")
SITE_PROTOCOL = config("SITE_PROTOCOL", default="https")

# EMAIL — SMTP for real emails
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# CORS — Production frontends
CORS_ALLOWED_ORIGINS = [
    "https://habsify-54f41bb3faf3.herokuapp.com",
]


CSRF_TRUSTED_ORIGINS = [
    "https://habsify-54f41bb3faf3.herokuapp.com",
    "https://habsifybackend-prod-7a317b11fa8d.herokuapp.com",
]

# SECURITY — Production hardening
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# ==============================================================================
# CACHE — Could use Redis here too
# ==============================================================================
# CACHES = {
#     "default": {
#         "BACKEND": "django_redis.cache.RedisCache",
#         "LOCATION": config("REDIS_URL"),
#     }
# }
CACHE_MIDDLEWARE_SECONDS = 0

print("🔴 Loaded PROD settings")
