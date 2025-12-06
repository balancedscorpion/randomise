# Multi-stage build for smaller final image

# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build


# Stage 2: Build Python dependencies
FROM python:3.11-slim AS python-builder

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


# Stage 3: Final runtime image
FROM python:3.11-slim

WORKDIR /app

# Copy only the virtual environment from builder
COPY --from=python-builder /app/.venv /app/.venv

# Copy application code
COPY app ./app

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x start.sh

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
CMD ["./start.sh"]

