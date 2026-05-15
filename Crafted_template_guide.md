# Crafted Templates Guide (Step-by-Step)

Use this for any crafted template you build locally and host on R2.

## Step 0: Fill these placeholders first

- `TEMPLATE_ID` (local folder id): example `newspaper_brief`
- `TEMPLATE_KEY` (internal key): example `newspaper_brief_bundle`
- `PUBLIC_TEMPLATE_ID` (what frontend/pipeline uses): example `crafted_newspaper_brief_bundle`
- `DISPLAY_NAME` (UI label): example `Newspaper Brief Crafted`
- `VIDEO_STYLE` (`explainer` | `promotional` | `storytelling`)
- `R2_PREFIX`: example `crafted-templates/newspaper_brief-crafted-template-20260506-105827`

---

## Step 1: Prepare local source folders

Create and maintain these three folders:

- `backend/templates/<TEMPLATE_ID>/`
- `frontend/src/components/remotion/<TEMPLATE_ID>/`
- `remotion-video/src/templates/<TEMPLATE_ID>/`

Required backend files:

- `backend/templates/<TEMPLATE_ID>/meta.json`
- `backend/templates/<TEMPLATE_ID>/prompt.md`
- `backend/templates/<TEMPLATE_ID>/layout_prompt.md`

Recommended frontend config files:

- `frontend/src/components/remotion/<TEMPLATE_ID>/imageBoxConfig.json`
- `frontend/src/components/remotion/<TEMPLATE_ID>/fontSizeDefaults.json`

These JSON files are bundled and read by the editor for aspect ratio and font defaults.

---

## Step 2: Bundle locally (no upload yet)

From repo root:

```powershell
python scripts/bundle_and_upload_crafted_template_template.py --template-id <TEMPLATE_ID>
```

Output bundle folder:

- `crafted-templates/<TEMPLATE_ID>-crafted-template/`

Optional: auto-remove local source folders after bundle:

```powershell
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID> --prune-source-after-bundle
```

---

## Step 3: Upload bundle to R2

### 3A) Quick upload

```powershell
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID> --upload
```

### 3B) Explicit metadata upload (recommended)

```powershell
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID> --template-key <TEMPLATE_KEY> --public-template-id <PUBLIC_TEMPLATE_ID> --r2-prefix <R2_PREFIX> --upload
```

### 3C) Replace an existing R2 crafted bundle in-place

Use this to keep the same URLs and manifest path:

```powershell
python scripts/bundle_and_upload_crafted_template.py --template-id <TEMPLATE_ID> --r2-prefix <R2_PREFIX> --upload --replace-existing
```

Optional together with replace:

- `--prune-source-after-bundle` to remove local source folders after successful bundle/upload.

After upload, keep these values:

- `template_key`
- `public_template_id`
- `r2_prefix`
- `manifest_path` = `<r2_prefix>/manifest.json`

---

## Step 4: Publish crafted template in backend

Endpoint:

- `POST /api/crafted-templates/admin/publish`

Body:

```json
{
  "template_key": "<TEMPLATE_KEY>",
  "public_template_id": "<PUBLIC_TEMPLATE_ID>",
  "name": "<DISPLAY_NAME>",
  "category": "blog",
  "supported_video_style": "<VIDEO_STYLE>",
  "r2_prefix": "<R2_PREFIX>",
  "manifest_path": "<R2_PREFIX>/manifest.json"
}
```

---

## Step 5: Grant user entitlement

Endpoint:

- `POST /api/crafted-templates/admin/grant`

Body:

```json
{
  "user_id": <USER_ID>,
  "public_template_id": "<PUBLIC_TEMPLATE_ID>"
}
```

---

## Step 6: Verify end-to-end

1. Call `GET /api/crafted-templates` as that user and confirm `<PUBLIC_TEMPLATE_ID>` is present.
2. In template picker, crafted template appears only in matching style tab.
3. Crafted preview shows loader first, then compiles/renders.
4. In picker thumbnails, crafted preview uses first scene.
5. Generate a project with `<PUBLIC_TEMPLATE_ID>`.
6. Confirm scene layouts are valid and persisted correctly.
7. Run final Remotion render and confirm output + CTA/social icons.

---

## Step 7: Fetch template back from R2 to local folders

Restore from R2 into:

- `backend/templates/<TEMPLATE_ID>/`
- `frontend/src/components/remotion/<TEMPLATE_ID>/`
- `remotion-video/src/templates/<TEMPLATE_ID>/`

Command:

```powershell
python scripts/fetch_crafted_template_from_r2.py --template-id <TEMPLATE_ID> --r2-prefix <R2_PREFIX>
```

Overwrite existing local files:

```powershell
python scripts/fetch_crafted_template_from_r2.py --template-id <TEMPLATE_ID> --r2-prefix <R2_PREFIX> --overwrite
```

With explicit manifest key:

```powershell
python scripts/fetch_crafted_template_from_r2.py --template-id <TEMPLATE_ID> --r2-prefix <R2_PREFIX> --manifest-path <R2_PREFIX>/manifest.json
```

---

## Optional SQL alternative

```sql
INSERT INTO crafted_templates
  (template_key, public_template_id, name, category, supported_video_style, r2_prefix, manifest_path, status)
VALUES
  ('<TEMPLATE_KEY>', '<PUBLIC_TEMPLATE_ID>', '<DISPLAY_NAME>', 'blog', '<VIDEO_STYLE>', '<R2_PREFIX>', '<R2_PREFIX>/manifest.json', 'active')
ON CONFLICT (public_template_id) DO UPDATE SET
  template_key = EXCLUDED.template_key,
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  supported_video_style = EXCLUDED.supported_video_style,
  r2_prefix = EXCLUDED.r2_prefix,
  manifest_path = EXCLUDED.manifest_path,
  status = 'active';
```

```sql
INSERT INTO crafted_template_entitlements
  (user_id, crafted_template_id, status)
SELECT
  <USER_ID>, id, 'active'
FROM crafted_templates
WHERE public_template_id = '<PUBLIC_TEMPLATE_ID>'
ON CONFLICT (user_id, crafted_template_id) DO UPDATE SET
  status = 'active';
```

---

## Frontend JSON examples

`fontSizeDefaults.json`

```json
{
  "default": {
    "landscape": { "title": 44, "desc": 24 },
    "portrait": { "title": 34, "desc": 20 }
  },
  "layouts": {
    "headline_strip": {
      "landscape": { "title": 56, "desc": 24 },
      "portrait": { "title": 42, "desc": 20 }
    }
  }
}
```

`imageBoxConfig.json`

```json
{
  "default": { "landscape": "16 / 9", "portrait": "9 / 16" },
  "layouts": {
    "headline_strip": { "landscape": "16 / 9", "portrait": "9 / 16" },
    "story_panel": { "landscape": "4 / 3", "portrait": "3 / 4" }
  }
}
```
