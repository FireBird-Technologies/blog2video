# ── Blog2Video: Python 3.11 + Node.js 20 for HuggingFace Spaces ──
FROM python:3.11-slim

# Install Node.js 20 + shared libs required by Chrome Headless Shell
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl gnupg ca-certificates \
      fonts-liberation fonts-noto-color-emoji \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
      libdrm2 libxkbcommon0 libx11-xcb1 libxfixes3 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# HF Spaces runs as uid 1000 — set HOME to /app so ALL caches
# (Remotion browser, npm, etc.) are inside the writable workspace
ENV HOME=/app
WORKDIR /app

# ── Python dependencies ──────────────────────────────────────
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ── Remotion template + npm install ──────────────────────────
COPY remotion-video/ ./remotion-video/
RUN cd remotion-video && npm ci --omit=dev

# Download Chrome Headless Shell into /app/.cache/remotion (accessible by uid 1000)
RUN cd remotion-video && npx remotion browser ensure

# ── Backend: app, templates (default, nightfall, gridcraft, spotlight) ──
COPY backend/app/ ./backend/app/
COPY backend/templates/ ./backend/templates/

# ── Runtime config ───────────────────────────────────────────
ENV REMOTION_PROJECT_PATH=/app/remotion-video
ENV MEDIA_DIR=/tmp/media

# HuggingFace Spaces REQUIRES port 7860
ENV PORT=7860
EXPOSE 7860

# Make everything inside /app and /tmp/media writable by uid 1000
RUN mkdir -p /tmp/media && \
    chmod -R 777 /tmp/media && \
    chmod -R 777 /app

WORKDIR /app/backend

CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
