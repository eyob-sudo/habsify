#!/bin/sh
set -e

echo "🚀 Starting habsify backend..."

# Run migrations for web OR worker
if echo "$@" | grep -q -E "gunicorn|celery"; then
    echo "→ Running migrations..."
    uv run python manage.py migrate --noinput
fi

echo "→ Starting: $@"
exec "$@"