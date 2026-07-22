# ── Blog2Video: Python 3.11 + Node.js 20 for HuggingFace Spaces ──
FROM python:3.11-slim

# Install Node.js 20 + shared libs required by Chrome Headless Shell
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  curl gnupg ca-certificates git \
  ffmpeg \
  fonts-liberation fonts-noto-color-emoji fonts-noto-core \
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

# Symlink the versioned Chrome-Headless-Shell binary to a stable path so
# PUPPETEER_EXECUTABLE_PATH can be a fixed value (the cache dir is version-named).
RUN CHROME_BIN="$(find /app/.cache/remotion -type f -name 'chrome-headless-shell' | head -n1)" && \
  if [ -z "$CHROME_BIN" ]; then echo "chrome-headless-shell not found" && exit 1; fi && \
  ln -sf "$CHROME_BIN" /usr/local/bin/chrome-headless-shell

# ── Custom-template snapshot worker (puppeteer-core; reuses the Chrome above) ──
# Standalone Node worker the backend invokes (CAPTURE_WORKER_CMD) to snapshot a
# custom template's real preview after create/regenerate. Only needs puppeteer-core.
COPY backend/capture/ ./capture/
RUN cd capture && npm install --omit=dev

# ── Backend: app, templates (default, nightfall, gridcraft, spotlight) ──
COPY backend/app/ ./backend/app/
COPY backend/templates/ ./backend/templates/
COPY backend/mcp_server/ ./backend/mcp_server/

# ── Runtime config ───────────────────────────────────────────
ENV REMOTION_PROJECT_PATH=/app/remotion-video
ENV MEDIA_DIR=/tmp/media

# Custom-template snapshot worker wiring. The command + Chrome path are safe to
# bake; the SECRETS (CAPTURE_SECRET) and the deployed frontend origin
# (CAPTURE_FRONTEND_URL) must be provided as runtime env/secrets — without them
# request_snapshot() no-ops and falls back to the Remotion still.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chrome-headless-shell
ENV CAPTURE_WORKER_CMD="node /app/capture/snapshot-worker.mjs --ids"
ENV BACKEND_BASE=http://localhost:7860

# HuggingFace Spaces REQUIRES port 7860
ENV PORT=7860
EXPOSE 7860

# Make everything inside /app and /tmp/media writable by uid 1000
RUN mkdir -p /tmp/media && \
  chmod -R 777 /tmp/media && \
  chmod -R 777 /app

WORKDIR /app/backend

CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1