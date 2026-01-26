FROM python:3.12-slim-trixie
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Prevent pyc files + unbuffered output for Docker logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy lock files first for layer caching
COPY pyproject.toml uv.lock ./

# Install deps into .venv (runtime only, no editable project, no dev)
RUN uv sync

# Copy the rest of the code
COPY . .

EXPOSE 8000

# Fallback CMD (for if you run the image directly; overridden by compose in practice)
CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8000"]