# Crafted templates: bundle, upload, fetch, and API

Run Python scripts from the **repository root**. They prepend `backend/` to `PYTHONPATH` and use R2 settings from backend config (e.g. `backend/.env`).

See also:

- [`../Crafted_template_guide.md`](../Crafted_template_guide.md) — end-to-end workflow
- [`../backend/templates/CRAFTED_TEMPLATE_FOLDER_SPEC.md`](../backend/templates/CRAFTED_TEMPLATE_FOLDER_SPEC.md) — folder layout and runtime behavior

---

## 1. Bundle and upload: `bundle_and_upload_crafted_template.py`

**What it does:** Copies a local template from `backend/templates/<id>`, `frontend/src/components/remotion/<id>`, `remotion-video/src/templates/<id>`, and scoped `public/` assets into **`crafted-templates/<template-id>-crafted-template/`**, writes **`manifest.json`**, and optionally uploads all files under that folder to **R2**.

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--template-id` | Yes | Built-in folder id (e.g. `nightfall`, `default`). |
| `--template-key` | No | Internal bundle key. Default: `<template-id>_bundle`. |
| `--public-template-id` | No | Id used by the app. Default: `crafted_<template-id>_bundle`. |
| `--supported-video-style` | No | `explainer` \| `promotional` \| `storytelling`. Default: `explainer`. |
| `--upload` | No | Upload bundle to R2. If omitted, only creates the local bundle. |
| `--r2-prefix` | No* | R2 key prefix. With `--upload` and no prefix, default is `crafted-templates/<template-id>-crafted-template-<UTC-stamp>`. If `CRAFTED_TEMPLATE_R2_PREFIX` is set in settings, it is prepended when the prefix does not already include it. |
| `--replace-existing` | No | With `--upload` and `--r2-prefix`: delete objects under that prefix, then re-upload (stable URLs/manifest). |
| `--prune-source-after-bundle` | No | After bundle (and upload if enabled), remove local source folders for this template from the repo. Not valid with `--upload-existing-bundle`. |
| `--upload-existing-bundle` | No | Skip re-bundling; upload files from an existing bundle folder (`manifest.json` required at bundle root). |
| `--bundle-dir` | No | Path to that bundle folder for `--upload-existing-bundle`. Default: `crafted-templates/<template-id>-crafted-template`. |
| `--public-assets-root` | No | Under `frontend/public` and `remotion-video/public`, scoped assets live at `<root>/<template-id>/`. Default: `templates`. |

\* `--r2-prefix` is required when using `--replace-existing`.

### Examples

```bash
# Local bundle only
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID>

# Bundle, then delete local sources
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID> --prune-source-after-bundle

# Bundle and upload with auto-generated prefix
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID> --upload

# Bundle and upload with explicit ids and prefix
python scripts/bundle_and_upload_crafted_template.py \
  --template-id <TEMPLATE_ID> \
  --template-key <TEMPLATE_KEY> \
  --public-template-id <PUBLIC_TEMPLATE_ID> \
  --r2-prefix <R2_PREFIX> \
  --upload

# Replace objects in place at an existing prefix
python scripts/bundle_and_upload_crafted_template.py \
  --template-id <TEMPLATE_ID> \
  --r2-prefix <R2_PREFIX> \
  --upload \
  --replace-existing

# Upload an already-built bundle directory
python scripts/bundle_and_upload_crafted_template.py \
  --template-id <TEMPLATE_ID> \
  --upload-existing-bundle \
  --bundle-dir /path/to/bundle
```

### Example: `newspaper_brief` → `staging/crafted-templates/newspaper-brief/`

Use **`python3`** on macOS if `python` is not on your `PATH`.

**1) Build the local bundle** (outputs `crafted-templates/newspaper_brief-crafted-template/`):

```bash
python3 scripts/bundle_and_upload_crafted_template.py --template-id newspaper_brief
```

**2) Upload and replace the bucket folder** that matches your R2 console prefix (stable path, same manifest URL for `POST .../admin/publish`):

```bash
python3 scripts/bundle_and_upload_crafted_template.py \
  --template-id newspaper_brief \
  --supported-video-style storytelling \
  --r2-prefix staging/crafted-templates/newspaper-brief \
  --upload \
  --replace-existing
```

Omit `--replace-existing` on a **first** upload to that prefix, or if you are fine with the script creating a new timestamped prefix via `--upload` alone.

If `CRAFTED_TEMPLATE_R2_PREFIX=staging` is set in `backend/.env`, you can use `--r2-prefix crafted-templates/newspaper-brief` instead; the uploader prepends `staging/` the same way as on download.

---

## 2. Fetch from R2: `fetch_crafted_template_from_r2.py`

**What it does:** Downloads `manifest.json` and all referenced objects from **R2** and restores:

- `backend/templates/<template-id>/`
- `frontend/src/components/remotion/<template-id>/`
- `remotion-video/src/templates/<template-id>/`
- `public/` files into both `frontend/public` and `remotion-video/public`

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--template-id` | Yes | Local template id to restore into. |
| `--r2-prefix` | Yes | R2 prefix used at upload time (e.g. `crafted-templates/foo-20260506-123000`). |
| `--manifest-path` | No | Full R2 object key for the manifest. Default: `<r2-prefix>/manifest.json`. |
| `--overwrite` | No | Allow overwriting existing local files. |

### Examples

```bash
python scripts/fetch_crafted_template_from_r2.py --template-id <TEMPLATE_ID> --r2-prefix <R2_PREFIX>

python scripts/fetch_crafted_template_from_r2.py --template-id <TEMPLATE_ID> --r2-prefix <R2_PREFIX> --overwrite

python scripts/fetch_crafted_template_from_r2.py \
  --template-id <TEMPLATE_ID> \
  --r2-prefix <R2_PREFIX> \
  --manifest-path <R2_PREFIX>/manifest.json
```

### Troubleshooting fetch

- **`zsh: command not found: python`** — On macOS use `python3`, or activate a venv that provides `python`. Run from repo root so `backend/` is importable.
- **Wrong `--template-id`** — Must be the **local template folder name** (e.g. `newspaper_brief`), i.e. what lives under `backend/templates/<id>/`. Do **not** use the public id `crafted_newspaper_brief_bundle` here unless your folders are literally named that (they usually are not).
- **Wrong `--r2-prefix`** — This must be the **full path segment in the bucket to the bundle folder**, the same value printed at upload (`r2_prefix=...`), or stored in DB as `crafted_templates.r2_prefix`. It is **not** only the namespace `staging`; that resolves to object `staging/manifest.json`, which does not exist. Typical shape: `crafted-templates/newspaper_brief-crafted-template-YYYYMMDD-HHMMSS`, or with env `CRAFTED_TEMPLATE_R2_PREFIX=staging`, objects live under `staging/crafted-templates/...`. The fetch script prepends `CRAFTED_TEMPLATE_R2_PREFIX` from `backend/.env` when missing, matching the bundle uploader—pass the suffix after staging (e.g. `crafted-templates/...`) unless you already include `staging/` in `--r2-prefix`.

---

## 3. HTTP API (list / detail / admin)

Base path: `/api/crafted-templates` (authenticated; see FastAPI router `backend/app/routers/crafted_templates.py`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/crafted-templates` | List crafted template summaries for the **current user** (empty if feature disabled or no entitlements). |
| `GET` | `/api/crafted-templates/{template_id}` | Full detail and package-backed fields when the user has access. |
| `GET` | `/api/crafted-templates/cache-stats` | Cache stats for rollout/debugging. |
| `POST` | `/api/crafted-templates/admin/publish` | Register a template after R2 upload; validates the package. |
| `POST` | `/api/crafted-templates/admin/grant` | Grant a user entitlement to a `public_template_id`. |

### Publish body example

```json
{
  "template_key": "<TEMPLATE_KEY>",
  "public_template_id": "<PUBLIC_TEMPLATE_ID>",
  "name": "<DISPLAY_NAME>",
  "category": "blog",
  "supported_video_style": "<VIDEO_STYLE>",
  "r2_prefix": "<R2_PREFIX>",
  "manifest_path": "<R2_PREFIX>/manifest.json",
  "checksum": null
}
```

### Grant body example

```json
{
  "user_id": <USER_ID>,
  "public_template_id": "<PUBLIC_TEMPLATE_ID>"
}
```
