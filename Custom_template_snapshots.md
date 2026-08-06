# Custom Template Snapshots — Setup & Runbook

Static preview images for **custom** templates (and the fallback behavior for **crafted**
templates), so template previews on mobile render as images/placeholders instead of live
Remotion `<Player>`s. Live Players exhaust iOS Safari's per-tab memory and reload the tab.

- **Custom templates** → snapshot the real React preview (puppeteer) → upload to R2 → store the
  URL in `preview_image_url`.
- **Crafted templates** → use the bundle's `assets/preview.jpg` when present, else a themed
  name-on-background placeholder (broken/missing images fall back automatically).

---

## How it works

1. A user creates/regenerates a custom template → backend background task
   `_render_and_store_thumbnail` → `custom_template_snapshot.request_snapshot(id)`.
2. If `CAPTURE_WORKER_CMD` is set, it runs the worker:
   `node /app/capture/snapshot-worker.mjs --ids <id>`.
3. The worker opens the deployed frontend's hidden route
   `<CAPTURE_FRONTEND_URL>/_capture?custom=<id>&secret=<CAPTURE_SECRET>` in headless Chrome,
   screenshots `#capture-root`, and POSTs the image to
   `POST /api/custom-templates/internal/preview-image/<id>`.
4. That backend endpoint uploads to R2 and sets `preview_image_url`.
5. If the worker is unconfigured or fails, it falls back to the legacy Remotion-still renderer —
   template creation is never blocked.

The internal endpoints are guarded by the shared secret `CAPTURE_SECRET` (header
`X-Capture-Secret`), not per-user auth, so a backfill can run across all users' templates.

---

## Environment variables

| Var | Local (`backend/.env`) | Production | Notes |
|-----|------------------------|------------|-------|
| `CAPTURE_SECRET` | set (any random string) | **set (secret)** | Shared secret. Use a fresh value in prod. |
| `CAPTURE_FRONTEND_URL` | `http://localhost:5173` | **set** = your Vercel origin | Frontend serving `/_capture`. |
| `CAPTURE_WORKER_CMD` | set (see below) | baked in Docker image | Command the backend runs per id. |
| `BACKEND_BASE` | `http://localhost:8000` | baked (`http://localhost:7860`) | Worker calls the backend on localhost **inside** the container. Override if the container's port differs. |
| `PUPPETEER_EXECUTABLE_PATH` | *(unset — uses system Chrome)* | baked (`/usr/local/bin/chrome-headless-shell`) | Chrome binary. |

Local `CAPTURE_WORKER_CMD` (absolute path):

```
CAPTURE_WORKER_CMD=node /Users/MuhammadMehdi/Desktop/Firebirds/blog2video/backend/capture/snapshot-worker.mjs --ids
```

> ⚠️ Keep `backend/.env` in **LF** line endings. CRLF appends a stray `\r` to values, which breaks
> exact-match comparisons like `CAPTURE_SECRET` (401) and paths.

---

## Generate a secret

```bash
openssl rand -hex 32
```

---

## Local setup & testing

### 1. Configure `backend/.env`

```
CAPTURE_SECRET=<your local secret>
CAPTURE_FRONTEND_URL=http://localhost:5173
BACKEND_BASE=http://localhost:8000
CAPTURE_WORKER_CMD=node /Users/MuhammadMehdi/Desktop/Firebirds/blog2video/backend/capture/snapshot-worker.mjs --ids
```

Restart the backend after editing `.env` (it only loads at startup):

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 2. Install the worker's dependency (once)

```bash
cd backend/capture
npm install --omit=dev
```

### 3. Verify the internal endpoint (secret works)

```bash
curl -s -H "X-Capture-Secret: <your local secret>" \
  "http://localhost:8000/api/custom-templates/internal/ids?only_missing=true"
```

- `200` + JSON list → working. `401` → secret mismatch. `404 "disabled"` → `CAPTURE_SECRET` not loaded.

### 4a. Test the worker binary directly

Requires the backend (`:8000`) **and** frontend (`npm run dev`, `:5173`) running.

```bash
cd /Users/MuhammadMehdi/Desktop/Firebirds/blog2video/backend/capture
BACKEND_BASE=http://localhost:8000 \
CAPTURE_FRONTEND_URL=http://localhost:5173 \
CAPTURE_SECRET=<your local secret> \
node snapshot-worker.mjs --ids 30
```

Expected: `✓ 30`.

### 4b. Test the auto-trigger (create/regenerate)

With the `.env` vars set and the backend restarted, regenerate/create a custom template in the
app. Watch the backend log for:

```
Snapshot worker completed for template <id>
```

### 5. Backfill locally (all templates)

The main script boots its own Vite server, so the frontend does **not** need to be running
separately for this one.

```bash
cd frontend

# Only templates missing an image:
BACKEND_BASE=http://localhost:8000 \
CAPTURE_SECRET=<your local secret> \
npm run thumbs:custom -- --all

# Regenerate EVERY template (overwrite existing images):
BACKEND_BASE=http://localhost:8000 \
CAPTURE_SECRET=<your local secret> \
npm run thumbs:custom -- --all --force

# Specific ids:
BACKEND_BASE=http://localhost:8000 \
CAPTURE_SECRET=<your local secret> \
npm run thumbs:custom -- --ids 30 107 109
```

---

## Production setup (Droplet + Vercel)

Backend deploys to the Droplet via `.github/workflows/deploy.yml` on push to `main`
(`docker compose build --no-cache && up -d`). Frontend deploys to Vercel.

### 1. Set secrets on the droplet

SSH in and edit the `.env` that docker-compose reads:

```
CAPTURE_SECRET=<fresh prod secret>
CAPTURE_FRONTEND_URL=https://<your-vercel-domain>
```

Check the container's internal port:

```bash
grep -iE "PORT|ports:" docker-compose.yml
```

If `PORT` is **not** 7860, also add (matching the container's uvicorn port):

```
BACKEND_BASE=http://localhost:<container-port>
```

> `CAPTURE_WORKER_CMD`, `PUPPETEER_EXECUTABLE_PATH`, and the default `BACKEND_BASE` are baked into
> the image — don't set them unless overriding the port.

### 2. Deploy

Merge `feat/ios` → `main`. This rebuilds the droplet image (worker + endpoints + Chrome symlink)
and redeploys the Vercel frontend (`CapturePage` + mobile static previews).

### 3. Verify the build + secret

```bash
# On the droplet — confirm the Chrome symlink built:
docker compose exec <backend-service> ls -l /usr/local/bin/chrome-headless-shell

# From anywhere — confirm the secret works:
curl -s -H "X-Capture-Secret: <prod secret>" \
  "https://<prod-api>/api/custom-templates/internal/ids?only_missing=false"
```

### 4. Backfill production (run from local, against the prod API)

Do **not** connect your laptop to the prod DB/R2. Point the script at the prod backend over HTTP —
the prod backend does the DB write + R2 upload with its own (correct) credentials and prefix. Your
local Chrome drives the deployed Vercel `/_capture`.

```bash
cd frontend
BACKEND_BASE=https://<prod-api-domain> \
CAPTURE_FRONTEND_URL=https://<your-vercel-domain> \
CAPTURE_SECRET=<prod secret> \
npm run thumbs:custom -- --all --force
```

### 5. Verify

```bash
# Should shrink toward [] as templates get images:
curl -s -H "X-Capture-Secret: <prod secret>" \
  "https://<prod-api>/api/custom-templates/internal/ids?only_missing=true"
```

Then open the prod app on a phone → custom/crafted previews are static, no reload.

---

## Crafted-template images (no backend change)

Crafted bundles already resolve `preview_image_url` from the bundle's `assets/preview.jpg`
(manifest `preview_image`). Drop that file into a bundle → the image shows automatically. Bundles
without it fall back to the themed placeholder. (The backend currently emits a
`preview_image_url` even when the file is absent, so the URL can 404 — the frontend
`StaticPreviewImage` component handles this by falling back to the placeholder on image load
error.)

---

## Capture frame

The snapshot freezes the first (intro) scene at **frame 135** (~4.5s at 30fps; each preview scene
is 150 frames). Change it in `frontend/src/pages/CapturePage.tsx` (`thumbnailFrame: 135`) and
re-run the backfill to regenerate.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `401 Invalid capture secret` | Header value ≠ `CAPTURE_SECRET`. Check for trailing `\r` (CRLF `.env`), spaces, or that the `X-Capture-Secret` header is enabled. |
| `404 Capture endpoints are disabled` | `CAPTURE_SECRET` empty / backend not restarted after editing `.env`. |
| Worker log: `Missing required env BACKEND_BASE` | The backend process env lacks `BACKEND_BASE` (local: add to `.env`; prod: baked or override for port). Snapshot falls back to Remotion still. |
| Crafted template shows "<Name> preview" text on a blank card | Broken/404 `preview_image_url`. Fixed by `StaticPreviewImage` `onError` → themed placeholder; ensure the frontend is deployed. |
| Build fails at `chrome-headless-shell not found` | The Remotion Chrome binary name differs; adjust the `find` glob in the Dockerfile. |
| Snapshot never fires on create | `CAPTURE_WORKER_CMD` unset, or wrong `BACKEND_BASE` port inside the container. |
