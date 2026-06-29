#!/bin/sh
set -e

echo "🚀 Starting habsify backend..."

# Use uv if available
if command -v uv >/dev/null 2>&1; then
  RUN="uv run"
else
  RUN="python"
fi

echo "→ Running migrations..."
$RUN python manage.py migrate --noinput

echo "→ Collecting static files..."
$RUN python manage.py collectstatic --noinput --clear

echo "✅ Starting Gunicorn..."
exec "$@"
