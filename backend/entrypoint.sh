#!/bin/sh
set -e

echo "🚀 Starting habsify backend..."

# Run migrations ONLY for the web (Gunicorn) container
if echo "$@" | grep -q "gunicorn"; then
    echo "→ Running migrations..."
    uv run python manage.py migrate --noinput
fi

echo "→ Starting: $@"
exec "$@"