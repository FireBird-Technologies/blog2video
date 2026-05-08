# Crafted Template Folder Spec (Built-in Authoring → R2 Package)

This document defines the exact contract for crafted templates when authored
like built-ins locally, then bundled and uploaded to R2 by
[`scripts/bundle_and_upload_crafted_template.py`](../../scripts/bundle_and_upload_crafted_template.py).

The local authoring layout, the bundle layout, and the R2 layout are **the
same shape**. If you can run a built-in template locally, the bundle script
turns it into a publishable crafted template by copying the same folders
into a single package.

---

## 1) Local Authoring Layout (Source of Truth)

Author each crafted template across these three roots — exactly like a
built-in template. The bundle script reads from here:

```text
backend/templates/<template_id>/
  meta.json                       (required)
  prompt.md                       (required)
  layout_prompt.md                (required)

frontend/src/components/remotion/<template_id>/
  <TemplateName>VideoComposition.tsx     (required — frontend preview entry)
  <TemplateName>Preview.tsx              (required — marquee thumbnail; see §4)
  layoutFields.ts                         (recommended — SceneEditModal field defs; see §5)
  layouts/
    index.ts                              (required — exports LAYOUT_REGISTRY)
    <LayoutName>.tsx                      (required, one per valid layout)
  types.ts                                (optional — shared types)
  fontSizeDefaults.json                   (optional — see §5)
  imageBoxConfig.json                     (optional — see §5)
  SocialIcons.tsx                         (optional — only if not using shared)
  components/                             (optional — chart helpers, etc.)

remotion-video/src/templates/<template_id>/
  <TemplateName>Video.tsx                 (required — render entry)
  layouts/
    index.ts                              (required)
    <LayoutName>.tsx                      (required, one per valid layout)
  types.ts                                (optional)
  SocialIcons.tsx                         (optional)
  components/                             (optional)

frontend/public/templates/<template_id>/    (optional — scoped static assets)
remotion-video/public/templates/<template_id>/

OR — top-level (also supported):
frontend/public/<template_id>/             (optional — top-level static assets)
remotion-video/public/<template_id>/
```

> **Static assets** referenced via `staticFile("templates/<id>/foo.png")`
> in your Remotion code must live under one of the public folders above.
> Both layouts (scoped under `templates/<id>/…` and top-level `<id>/…`)
> are bundled. Files outside these template-scoped folders are **not**
> picked up by the bundler — assets that live next to other built-ins
> (e.g. `frontend/public/fonts/something.woff2`) will not ship with the
> crafted package.
>
> **Mirror the asset to both public roots** during local authoring so
> the frontend preview and the remotion-video render both find it. The
> bundler reads from either, the fetch script restores to both, and the
> `--prune-source-after-bundle` flag cleans both up:
>
> ```text
> frontend/public/templates/newspaper_brief/anchor.jpg
> remotion-video/public/templates/newspaper_brief/anchor.jpg
> ```
>
> Reference it from a layout with:
> ```ts
> import { Img, staticFile } from "remotion";
> const ANCHOR_SRC = staticFile("templates/newspaper_brief/anchor.jpg");
> // <Img src={ANCHOR_SRC} … />
> ```

---

## 2) Bundle Layout (What the Script Produces)

`bundle_and_upload_crafted_template.py --template-id <id>` copies the
authoring folders above into a single package directory:

```text
crafted-templates/<template_id>-crafted-template/
  manifest.json                            ← contract (see §3)

  backend/
    meta.json
    prompt.md
    layout_prompt.md

  frontend/
    <TemplateName>VideoComposition.tsx     ← layouts entry
    <TemplateName>Preview.tsx              ← marquee preview (see §4)
    layouts/
      index.ts
      <LayoutName>.tsx
    types.ts
    fontSizeDefaults.json
    imageBoxConfig.json
    SocialIcons.tsx                        ← shared SocialIcons auto-merged

  remotion-video/
    <TemplateName>Video.tsx                ← render entry
    layouts/
      index.ts
      <LayoutName>.tsx
    types.ts
    SocialIcons.tsx                        ← shared SocialIcons auto-merged

  public/
    templates/<template_id>/...            ← scoped public assets
    <template_id>/...                      ← top-level public assets

  assets/
    preview.jpg                            ← optional static thumbnail
```

The bundle layout is mirrored byte-for-byte to the R2 prefix.
**No transformations happen between authoring → bundle → R2.**

---

## 3) `manifest.json` Contract

Every file uploaded to R2 must be listed in `manifest.json`. The backend
enforces this contract before serving the package — entries missing from
`files` are rejected.

```json
{
  "template_id": "crafted_newspaper_brief",
  "template_key": "newspaper_brief",
  "supported_video_style": "explainer",

  "backend": {
    "meta": "backend/meta.json",
    "prompt": "backend/prompt.md",
    "layout_prompt": "backend/layout_prompt.md"
  },

  "frontend": {
    "mount_id": "newspaper_brief",
    "entry": "frontend/NewspaperBriefVideoComposition.tsx",
    "layout_index": "frontend/layouts/index.ts",
    "preview": "frontend/NewspaperBriefPreview.tsx",
    "files": [
      "frontend/NewspaperBriefVideoComposition.tsx",
      "frontend/NewspaperBriefPreview.tsx",
      "frontend/SocialIcons.tsx",
      "frontend/types.ts",
      "frontend/fontSizeDefaults.json",
      "frontend/imageBoxConfig.json",
      "frontend/layouts/index.ts",
      "frontend/layouts/HeadlineStrip.tsx",
      "frontend/layouts/StoryPanel.tsx",
      "frontend/layouts/QuoteBlock.tsx",
      "frontend/layouts/FactsGrid.tsx",
      "frontend/layouts/TimelineCards.tsx",
      "frontend/layouts/EndingSocials.tsx"
    ]
  },

  "remotion": {
    "mount_id": "newspaper_brief",
    "entry": "remotion-video/NewspaperBriefVideo.tsx",
    "layout_index": "remotion-video/layouts/index.ts",
    "files": [
      "remotion-video/NewspaperBriefVideo.tsx",
      "remotion-video/SocialIcons.tsx",
      "remotion-video/types.ts",
      "remotion-video/layouts/index.ts",
      "remotion-video/layouts/HeadlineStrip.tsx",
      "remotion-video/layouts/StoryPanel.tsx",
      "remotion-video/layouts/QuoteBlock.tsx",
      "remotion-video/layouts/FactsGrid.tsx",
      "remotion-video/layouts/TimelineCards.tsx",
      "remotion-video/layouts/EndingSocials.tsx"
    ]
  },

  "preview_image": "assets/preview.jpg",

  "files": {
    "manifest.json":                                { "size": 0,    "sha256": "…" },
    "backend/meta.json":                            { "size": 1234, "sha256": "…" },
    "backend/prompt.md":                            { "size": 2345, "sha256": "…" },
    "backend/layout_prompt.md":                     { "size": 1200, "sha256": "…" },
    "frontend/NewspaperBriefVideoComposition.tsx":  { "size": 4010, "sha256": "…" },
    "frontend/NewspaperBriefPreview.tsx":           { "size": 6500, "sha256": "…" },
    "frontend/layouts/index.ts":                    { "size": 890,  "sha256": "…" },
    "remotion-video/NewspaperBriefVideo.tsx":       { "size": 5321, "sha256": "…" },
    "public/templates/newspaper_brief/cover.jpg":   { "size": 32100,"sha256": "…" },
    "...": "..."
  }
}
```

### Contract rules
- Every path in `frontend.files`, `remotion.files`, `frontend.preview`,
  and `frontend.entry` must exist in the top-level `files` object.
- Every path under `public/...` discovered by the bundler is also added
  to `files` so the backend can mirror it to the render workspace.
- `mount_id` should equal `template_key` (lowercase, underscores only).
- `frontend.preview` is **optional but strongly recommended** — see §4.

---

## 4) Marquee Preview (`<TemplateName>Preview.tsx`)

The preview file is what users see in the BlogUrlForm template grid and
on the "Custom Templates" page when browsing crafted templates. It is
fetched **with the list summary** (not with the full package), so it
must be cheap to fetch and self-contained.

### Where it lives

- Authoring:  `frontend/src/components/remotion/<template_id>/<TemplateName>Preview.tsx`
- Bundle:     `frontend/<TemplateName>Preview.tsx`
- Manifest:   `frontend.preview` points to the bundle path
- Runtime:    fetched as a string via `/api/crafted-templates`, compiled
              with Babel in the browser, cached in `localStorage`.

### Authoring rules

- **Default-export** a single React component.
- Accept a `{ thumbnailMode?: boolean }` prop.
- No external imports beyond `react` (the runtime injects React only).
  Anything you need (animation, state) write inline.
- Self-scaling: render at a fixed internal canvas size (e.g. 480×270)
  and let the host wrap it in a flexible container.
- Keep it small (<10 KB). If you need rich images, use `previewImageUrl`
  on the summary instead — it's a separate static thumbnail.
- 3 to 4 representative slides is the sweet spot.

See [`frontend/src/components/remotion/newspaper_brief/NewspaperBriefPreview.tsx`](../../frontend/src/components/remotion/newspaper_brief/NewspaperBriefPreview.tsx)
for the canonical example.

---

## 4b) Layout-prop Field Defs (`layoutFields.ts`)

The `frontend/layoutFields.ts` file (or `.json`) declares which **scene
editor fields** appear in the `SceneEditModal` for each layout in this
template. Same lazy-fetch story as the marquee preview: bundled once,
fetched with the list summary, cached in `localStorage`, compiled at
runtime via Babel.

### Where it lives

- Authoring: `frontend/src/components/remotion/<template_id>/layoutFields.ts`
- Bundle:    `frontend/layoutFields.ts`
- Manifest:  `frontend.layout_fields` points to the bundle path
- Runtime:   compiled with Babel + module-level cache; falls back to
             the modal's hardcoded `LAYOUT_TEXT_FIELDS` per layout id
             when no bundled overrides exist.

### Authoring rules

- Export `LAYOUT_FIELDS` (named OR default) — a Record keyed by layout id.
- Each value is an array of `FieldDef` objects (shape mirrors
  [`SceneEditModal.tsx FieldDef`](../../frontend/src/components/SceneEditModal.tsx)
  — keep in sync).
- Self-contained: NO external imports. Type annotations are stripped by
  Babel; runtime only sees the data.
- Don't include `titleFontSize` / `descriptionFontSize` / `imageUrl` —
  those belong to the Typography and Scene Image sections (auto-handled).

```ts
// frontend/src/components/remotion/newspaper_brief/layoutFields.ts
export const LAYOUT_FIELDS = {
  headline_strip: [
    { key: "category", label: "Category", type: "string" },
    {
      key: "stats", label: "Byline & date", type: "object_array", maxItems: 2,
      subFields: [
        { key: "value", label: "Value" },
        { key: "label", label: "Label" },
      ],
    },
  ],
  // … one entry per layout in valid_layouts …
};
export default LAYOUT_FIELDS;
```

Supported `type`s: `string`, `text`, `color`, `string_array`,
`object_array`, `select`, `number`, `range`. Plus `chart_table`,
`ohlcv_table`, `pipe_table` for data-viz layouts (rare in crafted templates).

---

## 5) Layout-aware Defaults (`fontSizeDefaults.json`, `imageBoxConfig.json`)

Both files are **optional** but recommended. When present in
`frontend/`, the SceneEditModal and ProjectView typography dropdown will
use these values as the displayed defaults whenever a scene has no
explicit override saved.

`fontSizeDefaults.json`:

```json
{
  "default": { "landscape": { "title": 44, "desc": 24 }, "portrait": { "title": 34, "desc": 20 } },
  "layouts": {
    "headline_strip": { "landscape": { "title": 56, "desc": 24 }, "portrait": { "title": 42, "desc": 20 } },
    "story_panel":    { "landscape": { "title": 42, "desc": 22 }, "portrait": { "title": 34, "desc": 19 } }
  }
}
```

`imageBoxConfig.json`:

```json
{
  "default": { "landscape": "16 / 9", "portrait": "9 / 16" },
  "layouts": {
    "headline_strip": { "landscape": "16 / 9", "portrait": "9 / 16" },
    "story_panel":    { "landscape": "4 / 3",  "portrait": "3 / 4"  }
  }
}
```

You can also embed these defaults directly in `meta.json` under
`layout_prop_schema[<layout>].defaults.titleFontSize` /
`descriptionFontSize`. The frontend resolves in this priority:

1. Per-scene saved override (`layoutProps.titleFontSize` etc.)
2. `frontend/fontSizeDefaults.json` (when bundled)
3. `meta.json` → `layout_prop_schema[layout].defaults.*`
4. Hardcoded fallback in the modal

---

## 6) Runtime Flow (Creation → Preview → Render)

### A) Listing crafted templates
- `GET /api/crafted-templates` returns a lightweight summary per template:
  - `meta` fields (id, name, styles, preview_colors, layout_prop_schema, …)
  - `theme` for color tokens
  - `preview_image_url` (static R2 URL if `assets/preview.jpg` shipped)
  - `preview_file_rel` + `preview_file` source code (when bundled)
- The frontend caches this list (and the preview source) in `localStorage`
  keyed by user ID with a 24-hour TTL.

### B) Project creation
- User selects a `crafted_*` template from the cached list.
- Backend validates the user's entitlement, then loads the **full
  package** from R2 (frontend layouts, remotion files, public asset
  URLs, prompts).
- Scene descriptors are generated in built-in style:
  - `layout`
  - `layoutProps`

### C) Preview / workspace provisioning
- Workspace copies base remotion project files.
- Crafted package remotion files are mounted to:
  - `src/templates/<mount_id>/...`
- Public assets are mounted to:
  - `public/<…>/…` (mirroring the bundle's `public/` tree)
- Runtime generates `src/templates/generated/GeneratedVideo.tsx` shim
  that re-exports your crafted entry and metadata calculator.
- `data.json` is written with built-in-style scene structure.
- Preview uses this workspace; output matches your crafted template files.

### D) Render
- Render uses composition id `GeneratedVideo` for crafted templates.
- That composition points to your crafted entry through the generated shim.
- Final render uses your packaged remotion/layout code + generated `data.json`.

---

## 7) Local Authoring Flow (What You Do)

1. Author the template under the three local roots in §1 (same as a built-in).
2. Add a `<TemplateName>Preview.tsx` to `frontend/src/components/remotion/<id>/`.
3. (Optional) Drop static assets under `frontend/public/templates/<id>/` and
   `remotion-video/public/templates/<id>/`.
4. Run the bundle script:
   ```bash
   python scripts/bundle_and_upload_crafted_template.py \
       --template-id <id> \
       --upload \
       --r2-prefix crafted-templates/<id>-<stamp>
   ```
   Pass `--replace-existing` to keep the same R2 prefix on re-uploads.
5. Publish via admin API (`/api/crafted-templates/admin/publish`).
6. Grant user entitlement via admin API (`/api/crafted-templates/admin/grant`).

### Pruning sources after upload

`--prune-source-after-bundle` removes every local on-disk source for the
template once the bundle is built (and uploaded, if `--upload` was set),
leaving the bundle folder + R2 as the only source of truth:

| Removed                                                  | Why                                          |
| -------------------------------------------------------- | -------------------------------------------- |
| `backend/templates/<id>/`                                | Backend authoring root                       |
| `frontend/src/components/remotion/<id>/`                 | Frontend authoring root                      |
| `remotion-video/src/templates/<id>/`                     | Render authoring root                        |
| `frontend/public/templates/<id>/`, `frontend/public/<id>/`         | Scoped + top-level frontend public assets |
| `remotion-video/public/templates/<id>/`, `remotion-video/public/<id>/` | Scoped + top-level remotion public assets |

### Refetching back into local sources

`scripts/fetch_crafted_template_from_r2.py --template-id <id> --r2-prefix <prefix>`
reverses the prune symmetrically:

- `backend/<rel>` from R2 → `backend/templates/<id>/<rel>`
- `frontend/<rel>` → `frontend/src/components/remotion/<id>/<rel>`
- `remotion-video/<rel>` → `remotion-video/src/templates/<id>/<rel>`
- `public/<inner>` → both `frontend/public/<inner>` AND
  `remotion-video/public/<inner>` (so static assets are usable by both
  the preview and the render workspace).

---

## 8) About Fields Returned by `_build_crafted_template_result`

Some keys are compatibility/runtime helpers and may be empty if not provided:
- `intro_code`, `outro_code`, `content_codes`, `content_archetype_ids`,
  `image_box_aspect_ratios`, `composition_code`

For the built-in-style crafted flow, the critical fields are:
- `meta`, `prompt`, `layout_prompt`
- `remotion_files`, `remotion_entry_rel`, `remotion_mount_id`
- `frontend_files`, `frontend_entry_rel`, `frontend_mount_id`
- `preview_file`, `preview_file_rel`

So you do not need to provide custom-template-style generated scene code
unless you intentionally want that legacy path.

---

## 9) Independence From Built-in and Custom Templates

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
