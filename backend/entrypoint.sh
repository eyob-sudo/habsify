#!/bin/sh
set -e

echo "🚀 Starting habsify backend..."

# ======================
# Wait for Database
# ======================
echo "→ Waiting for database..."
while ! uv run python -c "
import os, time
from django.db import connection
from django.db.utils import OperationalError
try:
    connection.ensure_connection()
    print('✅ Database is ready!')
except OperationalError:
    print('⏳ Database not ready yet...')
    exit(1)
" 2>/dev/null; do
  echo "Waiting for database... (5s)"
  sleep 5
done

# ======================
# Run Migrations
# ======================
echo "→ Running migrations..."
uv run python manage.py migrate --noinput

# ======================
# Collect Static Files
# ======================
echo "→ Collecting static files..."
uv run python manage.py collectstatic --noinput

# ======================
# Create Superuser (optional)
# ======================
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "→ Creating superuser (if not exists)..."
  uv run python manage.py createsuperuser --noinput 2>/dev/null || true
fi

# ======================
# Start Application
# ======================
echo "→ Starting: $*"
exec "$@"