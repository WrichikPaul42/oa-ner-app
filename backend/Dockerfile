# ==============================================================================
# Kneeva Multi-Stage Production Dockerfile
# Supports Bypassable PyArmor Code Obfuscation via Build Argument:
#   docker build --build-arg OBFUSCATE=true -t kneeva-api .
# Default: OBFUSCATE=false (copies plaintext code, preserves fast CI/local builds)
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Builder & Security Obfuscation Stage
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# Install core build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications
COPY requirements.txt .

# Install dependencies into a portable wheel / virtual environment
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt \
    prometheus-fastapi-instrumentator \
    sentry-sdk

# Copy backend source code for obfuscation evaluation
COPY . /build/app

# Obfuscation Build Argument (default: false)
ARG OBFUSCATE=false

# Conditional Obfuscation Pipeline:
# If OBFUSCATE=true, pyarmor compiles proprietary CatBoost & SHAP logic into bytecode.
# If OBFUSCATE=false, raw python files are transferred directly.
RUN if [ "$OBFUSCATE" = "true" ]; then \
        echo "🔒 [SECURITY] Executing PyArmor binary obfuscation on proprietary ML modules..."; \
        pip install --no-cache-dir pyarmor; \
        mkdir -p /build/packaged; \
        pyarmor gen --output /build/packaged /build/app/src; \
    else \
        echo "⚡ [DEV/CI] Skipping obfuscation. Copying raw python source files..."; \
        mkdir -p /build/packaged; \
        cp -r /build/app/* /build/packaged/; \
    fi

# ------------------------------------------------------------------------------
# STAGE 2: Secure Production Minimal Runtime Stage
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

WORKDIR /app

# Set production Python environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    ENVIRONMENT=production

# Install curl for container health checks and create unprivileged application user
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application files (obfuscated or plaintext depending on OBFUSCATE build arg)
COPY --from=builder --chown=appuser:appgroup /build/packaged /app

# Switch to unprivileged user for security compliance
USER appuser

# Expose HTTP port (Render / Cloud Run dynamic port matching)
EXPOSE 8000

# Container liveness & readiness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Launch production ASGI server
CMD ["sh", "-c", "uvicorn src.server:app --host 0.0.0.0 --port ${PORT}"]
