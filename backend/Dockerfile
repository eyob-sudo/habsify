FROM python:3.12-slim-trixie

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first (caching)
COPY pyproject.toml uv.lock ./

# Create venv and install
RUN uv venv --python /usr/local/bin/python3.12 .venv \
    && . .venv/bin/activate \
    && uv sync --frozen

# Copy the rest of the code
COPY . .

# Collect static files during build (with dummy env vars so it doesn't crash)
RUN SECRET_KEY=dummy-build-secret \
    DEBUG=True \
    EMAIL_HOST=dummy \
    EMAIL_HOST_USER=dummy \
    EMAIL_HOST_PASSWORD=dummy \
    TWILIO_ACCOUNT_SID=dummy \
    TWILIO_AUTH_TOKEN=dummy \
    TWILIO_PHONE_NUMBER=dummy \
    uv run python manage.py collectstatic --noinput --clear

RUN chmod +x entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uv", "run", "gunicorn", "habsify.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--log-level", "info"]

EXPOSE 8000