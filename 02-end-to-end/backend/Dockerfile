# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-install-project

# Production stage
FROM python:3.12-slim

WORKDIR /app

# Copy uv and virtual environment from builder
COPY --from=builder /bin/uv /bin/uv
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# Make sure we use the virtualenv
ENV PATH="/app/.venv/bin:$PATH"

# Expose port (default 3001)
EXPOSE ${BACKEND_PORT:-3001}

# Run the application
# Use shell form to allow environment variable substitution
CMD uvicorn main:app --host ${BACKEND_HOST:-0.0.0.0} --port ${BACKEND_PORT:-3001}
