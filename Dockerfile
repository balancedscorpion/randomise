# Multi-stage build for smaller final image
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install poetry
RUN pip install --no-cache-dir poetry

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies to a virtual environment (skip installing the project itself)
RUN poetry config virtualenvs.in-project true \
    && poetry install --only main --no-root --no-interaction --no-ansi


# Final stage - smaller runtime image
FROM python:3.11-slim

WORKDIR /app

# Copy only the virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY app ./app

# Add venv to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Expose port (Railway and similar platforms may override this with $PORT)
EXPOSE 8000

# Set default port (can be overridden by Railway's $PORT env var)
ENV PORT=8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.getenv(\"PORT\", \"8000\")}/health')"

# Run the application (Railway will set $PORT automatically)
# Use shell form to properly expand $PORT variable
CMD sh -c "uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info"

