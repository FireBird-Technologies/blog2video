# ── Blog2Video Backend + Remotion Render ─────────────────────
# Python 3.11 + Node.js 20 in a single image

FROM python:3.11-slim AS base

# Install Node.js 20, chromium deps (needed by Remotion render)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl gnupg ca-certificates \
      # Chromium/Puppeteer deps used by Remotion
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 libxshmfence1 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ──────────────────────────────────────
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Remotion template + npm install ──────────────────────────
COPY remotion-video/ ./remotion-video/
RUN cd remotion-video && npm ci --omit=dev

# ── Backend source code ──────────────────────────────────────
COPY backend/app/ ./backend/app/

# ── Ensure data directories exist ────────────────────────────
RUN mkdir -p /data/media

# ── Runtime config ───────────────────────────────────────────
ENV REMOTION_PROJECT_PATH=/app/remotion-video
ENV MEDIA_DIR=/data/media
# DATABASE_URL set via fly secrets (Neon PostgreSQL)

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
