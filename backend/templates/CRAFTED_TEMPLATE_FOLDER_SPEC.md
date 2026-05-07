# Crafted Template Folder Spec (Built-in Authoring -> R2 Package)

This document defines the exact contract for crafted templates when authored like built-ins locally, then uploaded as a folder package to R2.

## 1) What You Must Put In R2 (Exact)

### Required files

```text
<r2-prefix>/
  manifest.json
  backend/meta.json
  backend/prompt.md
  backend/layout_prompt.md
  frontend/<YourVideoCompositionFile>.tsx
  frontend/layouts/index.ts
  frontend/layouts/<all layout component files used by frontend index/entry>.tsx
  remotion-video/<YourVideoFile>.tsx
  remotion-video/layouts/index.ts
  remotion-video/layouts/<all layout component files used by remotion index/entry>.tsx
  remotion-video/<all additional ts/tsx dependencies used by entry/layouts>.ts|.tsx
```

### Optional files

```text
<r2-prefix>/
  assets/preview.jpg
```

`assets/preview.jpg` is optional; if used, set `preview_image` in `manifest.json`.

---

## 2) What Each File Holds

### `backend/meta.json` (required)
- Same shape as built-in template `meta.json`.
- Must include at least:
  - `id`, `name`, `styles`, `preview_colors`
  - `hero_layout`, `fallback_layout`, `valid_layouts`
  - `composition_id` (kept for metadata compatibility; runtime render uses crafted shim composition)
- `valid_layouts` must match keys exported by `remotion-video/layouts/index.ts`.

### `backend/prompt.md` (required)
- Template-specific scene generation guidance (same concept as built-ins).
- Used by DSPy/scene generation.

### `backend/layout_prompt.md` (required)
- Layout planning prompt guidance (same concept as built-ins).

### `frontend/layouts/index.ts` (required)
- Frontend preview layout registry for crafted preview flow.
- Must export `LAYOUT_REGISTRY` keyed by layout IDs used in `meta.json`.

### `remotion-video/layouts/index.ts` (required)
- Built-in-style layout registry.
- Must export `LAYOUT_REGISTRY` keyed by layout IDs used in `meta.json`.

### `remotion-video/<YourVideoFile>.tsx` (required)
- Main remotion composition for this crafted template.
- Must export:
  - default component
  - `calculateGeneratedMetadata`

### `manifest.json` (required)
- Contract file that tells backend where metadata and remotion files are.
- Must list all required files in `files`.

---

## 3) Required Manifest Shape

```json
{
  "template_id": "crafted_finance_pro",
  "template_key": "finance_pro",
  "supported_video_style": "explainer",

  "backend": {
    "meta": "backend/meta.json",
    "prompt": "backend/prompt.md",
    "layout_prompt": "backend/layout_prompt.md"
  },
  "preview_image": "assets/preview.jpg",

  "frontend": {
    "mount_id": "finance_pro",
    "entry": "frontend/FinanceVideoComposition.tsx",
    "layout_index": "frontend/layouts/index.ts",
    "files": [
      "frontend/FinanceVideoComposition.tsx",
      "frontend/layouts/index.ts",
      "frontend/layouts/HeroImage.tsx",
      "frontend/layouts/TextNarration.tsx"
    ]
  },

  "remotion": {
    "mount_id": "finance_pro",
    "entry": "remotion-video/FinanceVideo.tsx",
    "layout_index": "remotion-video/layouts/index.ts",
    "files": [
      "remotion-video/FinanceVideo.tsx",
      "remotion-video/layouts/index.ts",
      "remotion-video/layouts/HeroImage.tsx",
      "remotion-video/layouts/TextNarration.tsx",
      "remotion-video/layouts/Metric.tsx",
      "remotion-video/types.ts"
    ]
  },

  "files": {
    "backend/meta.json": { "size": 1234, "sha256": "..." },
    "backend/prompt.md": { "size": 2345, "sha256": "..." },
    "backend/layout_prompt.md": { "size": 1200, "sha256": "..." },
    "frontend/FinanceVideoComposition.tsx": { "size": 4010, "sha256": "..." },
    "frontend/layouts/index.ts": { "size": 890, "sha256": "..." },
    "remotion-video/FinanceVideo.tsx": { "size": 5321, "sha256": "..." },
    "remotion-video/layouts/index.ts": { "size": 890, "sha256": "..." },
    "remotion-video/layouts/HeroImage.tsx": { "size": 3120, "sha256": "..." },
    "remotion-video/layouts/TextNarration.tsx": { "size": 2980, "sha256": "..." },
    "remotion-video/layouts/Metric.tsx": { "size": 2870, "sha256": "..." },
    "remotion-video/types.ts": { "size": 760, "sha256": "..." }
  }
}
```

### Notes
- Every path in `frontend.files` and `remotion.files` must exist and also be present in `files`.
- `mount_id` should be lowercase/underscore-safe.
- Keep package/file sizes within configured limits.

---

## 4) Local Authoring Flow (What You Do)

1. Create template locally like built-ins:
   - Backend files (`meta.json`, `prompt.md`, `layout_prompt.md`)
   - Remotion files (`Video.tsx`, `layouts/index.ts`, layout components)
2. Move/copy these into one package folder structure above.
3. Generate `manifest.json` + `files` checksums/sizes.
4. Upload package folder to R2 prefix.
5. Publish crafted template via admin API.
6. Grant user entitlement via admin API.

---

## 5) Runtime Flow (Creation -> Preview -> Render)

### A) Project creation
- User selects `crafted_*` template.
- Access entitlement is checked.
- Template metadata/prompt are loaded from crafted package.
- Scene descriptors are generated in built-in style:
  - `layout`
  - `layoutProps`

### B) Preview / workspace provisioning
- Workspace copies base remotion project files.
- Crafted package remotion files are mounted to:
  - `src/templates/<mount_id>/...`
- Runtime generates:
  - `src/templates/generated/GeneratedVideo.tsx` shim
  which re-exports your crafted entry and metadata calculator.
- `data.json` is written with built-in-style scene structure.
- Preview uses this workspace; output matches your crafted template files.

### C) Render
- Render uses composition id `GeneratedVideo` for crafted templates.
- That composition points to your crafted entry through the generated shim.
- Final render uses your packaged remotion/layout code + generated `data.json`.

---

## 6) About Fields Returned by `_build_crafted_template_result`

Some keys are compatibility/runtime helpers and may be empty if not provided:
- `intro_code`, `outro_code`, `content_codes`, `content_archetype_ids`, `image_box_aspect_ratios`, `composition_code`

For the built-in-style crafted flow, the critical fields are:
- `meta`, `prompt`, `layout_prompt`
- `remotion_files`, `remotion_entry_rel`, `remotion_mount_id`
- `frontend_files`, `frontend_entry_rel`, `frontend_mount_id`

So you do not need to provide custom-template-style generated scene code unless you intentionally want that legacy path.

---

## 7) Independence From Built-in and Custom Templates

### Data / storage / access
- Independent:
  - Separate DB models for crafted templates + entitlements
  - Separate publish/grant/list APIs
  - Separate R2 package source of truth

### Runtime plumbing
- Shared infrastructure (intentionally):
  - Uses common pipeline/remotion services
  - Uses shared render workspace and remotion runtime

### Practical effect
- Crafted templates do not require modifying built-in template folders.
- Crafted templates do not depend on custom-template DB scene-code blobs.
- Behavior is built-in-like while remaining operationally separate.
