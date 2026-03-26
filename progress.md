# AI Custom Templates — Progress Tracker

## Master Plan

Replace the fixed `UniversalScene.tsx` renderer (9 layouts, 10 element types) with AI-generated unique React components per brand. Each template becomes a code string stored in DB, compiled at runtime for preview, written to temp files for rendering.

**No fallback to old system.** `UniversalScene.tsx`, `styleEngine.ts`, and the old custom template types will be **deleted** as a final cleanup step after all phases are implemented, tested, and stable. No dual-path code long-term — the new system must stand on its own so bugs are visible, not hidden behind a fallback.

**Full plan:** `/Users/faisalnazir/Desktop/Blog2Video - AI Generated Custom Templates Plan.md`

## Phases Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | DB Models + Enhanced Scraping | DONE |
| 2 | AI Code Generation + Preview | DONE |
| 3 | Chat-Based Editing | DEFERRED — removed from codebase, will revisit in a future phase |
| 4 | Render Pipeline Update | DONE |
| 5 | Polish & Preview System | DONE |
| 6 | Cleanup — Remove old UniversalScene/styleEngine/fallback code | DONE |
| H1 | Rate Limiting on Claude API Endpoints | DONE |
| H2 | Code Validator Hardening | DONE |
| H3 | Template Cache TTL | DONE |
| H4 | Render Workspace Locking | DONE |
| H5 | Frontend Code Sandbox (CSP + Error Boundary) | DONE |
| H6 | Self-healing current_version_id | DONE |
| F1 | BrandKit Population During Theme Extraction | DONE |
| F2 | Brand Asset Uploads (Logo) | DONE |
| F5 | Version Snapshots on Chat Edits | DEFERRED — depends on Phase 3 |
| F6 | custom_prompt_builder.py Cleanup | DONE |
| F3 | Enhanced Scraping with Firecrawl Branding Format | DONE |
| F4 | Preview Thumbnails for Template Gallery | DONE |
| F7 | Multiple Unique Content Scene Variants | DONE |
| OPT | Performance & Quality Optimization (5 fixes) | DONE |
| V2 | Content-Aware Architecture (feat/customv2) | DONE |

---

## Phase 1: DB Models + Enhanced Scraping — DONE

### What Was Done

**New file created:**
- `backend/app/models/brand_kit.py` — BrandKit model (brand_kits table)
  - Fields: id, user_id, source_url, brand_name, colors (JSON), fonts (JSON), design_language (JSON), logos (JSON), images (JSON), timestamps
  - Relationships: user, custom_templates

**Files modified:**
- `backend/app/models/custom_template.py` — Added:
  - `component_code` (Text, nullable) — will hold AI-generated React code
  - `intro_code` (Text, nullable) — intro scene variant
  - `outro_code` (Text, nullable) — outro scene variant
  - `brand_kit_id` (Integer FK → brand_kits.id, nullable, indexed)
  - `brand_kit` relationship

- `backend/app/models/scene.py` — Added:
  - `scene_type` (String(20), nullable) — "intro"/"content"/"outro"; NULL = "content"

- `backend/app/models/user.py` — Added:
  - `brand_kits` relationship (cascade delete)

- `backend/app/models/__init__.py` — Added BrandKit import and export

- `backend/app/database.py` — Updated:
  - `_migrate_sqlite()`: added component_code, intro_code, outro_code, brand_kit_id to ct_migrations; added scene_type to scene_migrations
  - `init_db()`: added BrandKit to model imports

- `backend/alembic/env.py` — Added BrandKit import

- `backend/alembic/versions/phase1_brand_kit_and_schema_fields.py` — New Alembic migration:
  - Creates brand_kits table
  - Adds 4 columns to custom_templates
  - Adds scene_type to scenes
  - Down revision: 7ed594338d45

- `backend/app/services/theme_scraper.py` — Enhanced:
  - `ScrapedThemeData` now has `logo_urls`, `og_image`, `screenshot_url` fields
  - New `_extract_logo_urls()` helper extracts logos from HTML (favicon links + img tags with "logo" in attributes)
  - Tries Firecrawl screenshot format with graceful fallback
  - Extracts OG image from metadata

### Backward Compatibility
- All new columns nullable — existing data unaffected
- No API endpoint changes — responses identical
- No frontend changes
- ScrapedThemeData new fields are additive — ThemeExtractor ignores them

### Verification Steps
1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Confirm no startup errors
3. Check brand_kits table exists in SQLite
4. Check new columns on custom_templates and scenes
5. Test existing custom template flow (paste URL → extract → save)

---

## Phase 2: AI Code Generation + Preview — DONE

### What Was Done

**New files created:**
- `backend/app/services/code_validator.py` — Validates generated code (blocklist for dangerous APIs, SceneComponent declaration check)
- `backend/app/services/code_generator.py` — Claude API-based code generation (claude-sonnet-4-5-20250929). Generates 3 variants (intro/content/outro) in one call using XML delimiters. Retry logic on validation failure.
- `frontend/src/utils/compileComponent.ts` — @babel/standalone JIT compiler. Lazy-loads Babel (~3MB), transpiles JSX, creates component via Function() factory with injected Remotion APIs.
- `frontend/src/components/RemotionPreviewPlayer.tsx` — Remotion Player wrapper. Compiles code string, renders live preview with sample props. Error state with retry button.

**Files modified:**
- `backend/app/routers/custom_templates.py` — Added:
  - `POST /{template_id}/generate-code` endpoint (calls code_generator, validates, stores in DB)
  - `GET /{template_id}/code` endpoint (lightweight code-only response)
  - `_serialize_template()` now includes `component_code`, `intro_code`, `outro_code`
  - `CustomTemplateOut` schema updated with code fields

- `frontend/src/components/templatePreviews/CustomPreview.tsx` — Added:
  - Optional `componentCode` prop
  - When `componentCode` exists, renders `RemotionPreviewPlayer` (lazy-loaded) instead of carousel
  - Existing carousel unchanged as fallback for templates without generated code

- `frontend/src/api/client.ts` — Added:
  - `component_code`, `intro_code`, `outro_code` fields to `CustomTemplateItem`
  - `generateTemplateCode(templateId)` API method
  - `getTemplateCode(templateId)` API method

- `frontend/src/components/CustomTemplateCreator.tsx` — Added:
  - Step 3: "Generating Template" — shows spinner during code generation, then live Remotion preview
  - After saving template (Step 2), automatically triggers code generation
  - Error handling with retry button
  - "Done" button to close modal

- `frontend/src/pages/CustomTemplates.tsx` — Updated:
  - Template grid passes `componentCode` to CustomPreview for live Remotion previews

- `frontend/package.json` — Added:
  - `@babel/standalone` dependency
  - `@types/babel__standalone` dev dependency

### Architecture Decisions
- **Claude API for code gen** (not DSPy) — raw code output doesn't fit DSPy's structured fields
- **Separate endpoint** — code gen is slow (10-30s), doesn't block template creation
- **One LLM call for 3 variants** — intro/content/outro in one call for visual coherence
- **Lazy-loaded Babel** — ~3MB chunk only loaded when viewing templates with generated code
- **No fallback** — compilation errors surface inline with retry option

### Verification Steps
1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
2. Create a custom template via existing flow (paste URL → extract → save)
3. Step 3 should auto-trigger code generation with spinner
4. After generation, live Remotion preview should play in the modal
5. On Custom Templates page, templates with generated code show live previews
6. `npm run build` passes ✓

---

## Phase 3: Chat-Based Editing — DONE

### What Was Done

**New files created:**
- `backend/app/models/code_edit_history.py` — CodeEditHistory model (code_edit_history table)
  - Fields: id, template_id (FK, CASCADE), code_type ("component"/"intro"/"outro"), previous_code, instruction, summary, created_at
  - Composite index on (template_id, code_type)
  - Relationship: template (back to CustomTemplate)

- `backend/alembic/versions/phase3_code_edit_history.py` — Alembic migration
  - Creates code_edit_history table
  - Down revision: phase1_brand_kit

- `frontend/src/components/TemplateCodeEditor.tsx` — Full-screen code editor overlay
  - Two-panel layout: Remotion preview (left) + chat panel (right)
  - Variant tabs (Intro/Content/Outro) to switch which code is previewed/edited
  - Chat messages reconstructed from edit history on mount
  - Typing indicator dots during Claude processing
  - Undo button per variant (reverts to previous code version)
  - Suggestion chips for common edit requests
  - Error display for failed edits

**Files modified:**
- `backend/app/services/code_generator.py` — Added:
  - `EDIT_SYSTEM_PROMPT` — system prompt for code editing (modify existing code, keep everything else intact)
  - `_parse_edit_response()` — parses `<CODE>` and `<SUMMARY>` XML tags from response
  - `edit_component_code(existing_code, instruction)` — calls Claude to edit code, validates, retries on failure. Returns `{ code, summary }`

- `backend/app/routers/custom_templates.py` — Added:
  - `EditCodeRequest` / `UndoEditRequest` Pydantic schemas
  - `VARIANT_FIELD_MAP` helper dict
  - `POST /{template_id}/edit-code` — sends existing code + instruction to Claude, saves edit history, updates template code
  - `POST /{template_id}/undo-edit` — reverts to previous code version from history, deletes history row
  - `GET /{template_id}/edit-history` — returns list of edits (instruction + summary, no code) for chat reconstruction

- `backend/app/models/custom_template.py` — Added:
  - `edit_history` relationship (cascade delete-orphan)

- `backend/app/models/__init__.py` — Added CodeEditHistory import and export

- `backend/app/database.py` — Added CodeEditHistory to init_db imports (SQLite auto-creates via create_all)

- `backend/alembic/env.py` — Added CodeEditHistory import

- `frontend/src/api/client.ts` — Added:
  - `CodeVariant` type ("component" | "intro" | "outro")
  - `CodeEditHistoryItem` interface
  - `editTemplateCode(templateId, instruction, variant)` API method
  - `undoTemplateEdit(templateId, variant)` API method
  - `getTemplateEditHistory(templateId)` API method

- `frontend/src/pages/CustomTemplates.tsx` — Added:
  - `codeEditTarget` state for full-screen code editor
  - "Customize" button on template cards (only shown when component_code exists, purple filled)
  - `TemplateCodeEditor` rendering when codeEditTarget is set
  - `preloadBabel()` call on page mount
  - `handleCodeEditorClose()` to update template in grid after editing

### Architecture Decisions
- **Separate edit function** — `edit_component_code()` uses a different system prompt than generation (focused on modifying existing code, not creating from scratch)
- **Per-variant editing** — user selects which variant (Intro/Content/Outro) to edit; edits apply to one variant at a time (saves cost, more predictable)
- **Edit history table** — follows SceneEditHistory pattern; stores previous_code for multi-level undo
- **Chat reconstruction** — edit history reconstructed into chat messages on mount (no separate chat persistence)
- **No new npm dependencies** — reuses existing @babel/standalone, @remotion/player, RemotionPreviewPlayer
- **Separate from CustomTemplateEditor** — existing editor kept for name/style changes; new TemplateCodeEditor is full-screen for code editing

### Verification Steps
1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000` — no errors, code_edit_history table created
2. Create a template with generated code (Phase 2 flow)
3. On Custom Templates page, "Customize" button appears on templates with code
4. Click "Customize" → full-screen editor opens with preview + chat
5. Type "make the title bigger" → Claude edits code → preview updates live
6. Click "Undo" → code reverts to previous version → preview updates
7. Close editor → template card on grid shows updated preview
8. `npm run build` passes ✓

---

## Phase 4: Render Pipeline Update — DONE

### What Was Done

**New files created:**
- `remotion-video/src/templates/generated/types.ts` — TypeScript types for generated video data (GeneratedSceneProps, GeneratedVideoData, GeneratedSceneData)
- `remotion-video/src/templates/generated/SceneIntro.tsx` — Placeholder intro scene component (overwritten with AI code at render time)
- `remotion-video/src/templates/generated/SceneContent.tsx` — Placeholder content scene component (overwritten with AI code at render time)
- `remotion-video/src/templates/generated/SceneOutro.tsx` — Placeholder outro scene component (overwritten with AI code at render time)
- `remotion-video/src/templates/generated/GeneratedVideo.tsx` — New Remotion composition:
  - Reads data.json (including brandColors and sceneType per scene)
  - Statically imports SceneIntro, SceneContent, SceneOutro components
  - Maps each scene to the right component based on sceneType (explicit from DB, or inferred: first=intro, last=outro, middle=content)
  - Handles font loading via delayRender/continueRender
  - Sequences scenes with Audio and LogoOverlay (same pattern as CustomVideo)
  - calculateGeneratedMetadata for dynamic duration/dimensions

**Files modified:**
- `remotion-video/src/Root.tsx` — Added:
  - Import of GeneratedVideo + calculateGeneratedMetadata
  - New `<Composition id="GeneratedVideo" .../>` registration

- `backend/app/services/template_service.py` — Updated:
  - `_load_custom_template_data()` now includes `has_generated_code`, `component_code`, `intro_code`, `outro_code` in cached result
  - `_get_custom_meta()` passes `has_generated_code` to `build_custom_meta`

- `backend/app/services/custom_prompt_builder.py` — Updated:
  - `build_custom_meta()` accepts `has_generated_code` parameter
  - Returns `composition_id: "GeneratedVideo"` when template has AI code, `"CustomVideo"` otherwise

- `backend/app/services/remotion.py` — Updated:
  - `provision_workspace()` calls `_write_generated_scene_files()` for custom templates with AI code
  - `_write_generated_scene_files()` (NEW) — loads component code from DB, wraps in proper .tsx module with imports, writes to workspace `src/templates/generated/` directory
  - `_wrap_generated_code()` (NEW) — wraps raw AI-generated code (`const SceneComponent = ...`) in a proper ESM module with Remotion imports + default export
  - `write_remotion_data()` — adds `brandColors` and `sceneType` per scene to data.json when template has generated code

### Architecture Decisions
- **Static file overwrite** — generated code is written as actual .tsx files in the workspace, overwriting placeholders. Vite bundles them normally — no runtime compilation, no @babel/standalone needed server-side.
- **Placeholder pattern** — the repo contains stub scene components so Root.tsx always compiles. At render time, these stubs are replaced with the real AI-generated code.
- **composition_id routing** — `GeneratedVideo` vs `CustomVideo` is selected via `build_custom_meta` based on whether the template has `component_code`. Old templates without generated code continue to use UniversalScene.
- **brandColors in data.json** — derived from theme colors, passed to GeneratedSceneProps. Generated components use `props.brandColors` directly.
- **sceneType tagging** — each scene gets `sceneType` ("intro"/"content"/"outro") from the DB `scene_type` field, falling back to positional inference (first=intro, last=outro).
- **Code wrapping** — raw AI code (`const SceneComponent = (props) => { ... }`) is wrapped with Remotion imports and `export default SceneComponent`. This makes the generated files proper ES modules that Vite can bundle.

### Verification Steps
1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000` — no errors
2. Create a template with generated code (Phase 2 flow)
3. Trigger a video render for a project using the generated template
4. Check logs: should see `[REMOTION] GeneratedVideo: brandColors and sceneTypes set for N scenes`
5. Check workspace: `src/templates/generated/SceneIntro.tsx` etc. should contain the AI-generated code wrapped in proper imports
6. Render should produce an MP4 using the AI-generated components
7. Templates without generated code should still render via CustomVideo + UniversalScene
8. TypeScript check passes: `cd remotion-video && npx tsc --noEmit` ✓

---

## Phase 5: Polish & Preview System — DONE

### What Was Done

**New file created:**
- `backend/app/models/template_version.py` — TemplateVersion model (template_versions table)
  - Fields: id, template_id (FK, CASCADE), component_code, intro_code, outro_code, label, created_at
  - Relationship: template (back to CustomTemplate)

- `backend/alembic/versions/phase5_template_versions.py` — Alembic migration
  - Creates template_versions table
  - Adds current_version_id column to custom_templates
  - Down revision: phase3_code_edit_history

**Files modified:**

- `backend/app/models/custom_template.py` — Added:
  - `current_version_id` (Integer, nullable) — pointer to active version
  - `versions` relationship (cascade delete-orphan, ordered by created_at desc)

- `backend/app/models/__init__.py` — Added TemplateVersion import and export

- `backend/app/database.py` — Added:
  - TemplateVersion to init_db imports
  - `current_version_id` to SQLite migrations for custom_templates

- `backend/alembic/env.py` — Added TemplateVersion import

- `backend/app/routers/custom_templates.py` — Added:
  - `_save_version()` helper — snapshots code fields into a new TemplateVersion row
  - Updated `generate_code()` — saves "Initial generation" version after first code gen
  - `POST /{template_id}/regenerate-code` — regenerates all code variants from scratch; snapshots current code before overwriting, saves new "Regenerated" version
  - `GET /{template_id}/versions` — lists all saved versions (newest first) with current_version_id
  - `POST /{template_id}/versions/{version_id}/rollback` — restores code from a previous version; snapshots current state as "Before rollback" first
  - `CustomTemplateOut` and `_serialize_template()` now include `current_version_id`

- `frontend/src/api/client.ts` — Added:
  - `current_version_id` to `CustomTemplateItem` interface
  - `TemplateVersionItem` and `TemplateVersionsResponse` interfaces
  - `regenerateTemplateCode(templateId)` API method
  - `getTemplateVersions(templateId)` API method
  - `rollbackTemplateVersion(templateId, versionId)` API method

- `frontend/src/pages/CustomTemplates.tsx` — Added:
  - `regeneratingId` state for tracking which template is regenerating
  - `handleRegenerate()` function — calls regenerate API, updates template in grid
  - Regenerate icon button on each template card (next to Customize), with spinning SVG animation during regeneration

- `frontend/src/components/TemplateCodeEditor.tsx` — Added:
  - Version history state: `versions`, `currentVersionId`, `showVersions`, `isRegenerating`, `isRollingBack`
  - `loadVersions()` — fetches version list from API on mount
  - `handleRegenerate()` — regenerates code from within editor, clears chat, reloads versions
  - `handleRollback(versionId)` — restores a previous version, reloads version list
  - Regenerate button in preview panel header (purple outline, with spinner)
  - "Versions (N)" toggle button in chat header — opens collapsible version history panel
  - Version history panel: lists all versions with labels, timestamps, "(current)" badge, and "Restore" button per version

### Architecture Decisions
- **Version snapshots** — each version stores a full copy of all 3 code variants (intro/component/outro). Not incremental diffs — simpler, no reconstruction needed.
- **Automatic versioning** — versions are created automatically on generate, regenerate, and rollback. No manual "save version" step needed.
- **Pre-rollback snapshots** — before a rollback overwrites code, the current state is saved as a "Before rollback" version, so users can always undo a rollback.
- **current_version_id** — pointer on the template to its active version. Used by frontend to highlight "(current)" in the version list. Not a FK constraint (flexible).
- **No preview thumbnails yet** — this phase focused on regeneration + versioning. Server-side mini-renders for gallery thumbnails can be added later as an optimization.

### Verification Steps
1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000` — no errors, template_versions table created
2. Create a template with generated code (Phase 2 flow) — a version is saved automatically
3. On Custom Templates page, hover a template card → Regenerate button (refresh icon) appears next to Customize
4. Click Regenerate → spinner shows → new code generated → preview updates → old version preserved
5. Click Customize → full-screen editor opens → "Versions (N)" button in chat header
6. Click "Versions (N)" → version history panel opens with all versions listed
7. Click "Restore" on an older version → code rolls back → preview updates
8. TypeScript check passes (no new errors) ✓

---

## Phase 6: Cleanup — Remove Old UniversalScene/StyleEngine/Fallback Code — DONE

### What Was Done

**Files deleted:**
- `remotion-video/src/templates/custom/` — entire directory removed:
  - `UniversalScene.tsx` (36KB) — old fixed layout engine (9 arrangements, 10 element types)
  - `CustomVideo.tsx` (10KB) — old Remotion composition using UniversalScene
  - `types.ts` (3KB) — old CustomTheme, SceneLayoutConfig types
  - `utils/styleEngine.ts` (11KB) — theme style → CSS decoration mapper
  - `utils/normalize.ts` (7KB) — layout config normalization helpers

- `frontend/src/components/remotion/custom/` — entire directory removed:
  - `UniversalScene.tsx` — frontend copy of server UniversalScene
  - `CustomVideoComposition.tsx` — frontend copy of CustomVideo
  - `types.ts` — frontend copy of custom types
  - `utils/` — frontend copy of utils

**Files modified:**

- `remotion-video/src/Root.tsx` — Removed:
  - `CustomVideo` + `calculateCustomMetadata` import
  - `<Composition id="CustomVideo" .../>` registration
  - Only `GeneratedVideo` composition remains for custom templates

- `backend/app/services/remotion.py` — Updated:
  - Removed `has_generated_code` conditional in `write_remotion_data()` — brandColors and sceneType are now always set for custom templates
  - Replaced `print()` calls with `logger.info()`/`logger.warning()`

- `backend/app/services/custom_prompt_builder.py` — Updated:
  - Removed `has_generated_code` parameter from `build_custom_meta()`
  - `composition_id` is now always `"GeneratedVideo"` — no fallback to `"CustomVideo"`

- `backend/app/services/template_service.py` — Updated:
  - Removed `has_generated_code` kwarg from `build_custom_meta()` call

- `frontend/src/components/remotion/remotionAdapters.tsx` — Removed:
  - `UniversalScene` import from `@remotion-video/templates/custom/UniversalScene`
  - `CustomTheme`, `SceneLayoutConfig` type imports from `@remotion-video/templates/custom/types`
  - `RemotionCustomSceneInput` interface
  - `RemotionCustomVideoCompositionProps` interface
  - `RemotionCustomVideoComposition` component (entire ~100 line composition)

- `frontend/src/components/remotion/templateConfig.tsx` — Removed:
  - `CustomVideoComposition` import
  - `CUSTOM_ARRANGEMENTS` set
  - `custom` entry from `TEMPLATE_REGISTRY`
  - `custom_` routing in `getTemplateConfig()` (no longer routes to old system)
  - `RemotionCustomVideoComposition` from the remotion source override chain

- `frontend/src/types/remotion-video.d.ts` — Removed:
  - `@remotion-video/templates/custom/UniversalScene` module declaration
  - `@remotion-video/templates/custom/types` module declaration

- `frontend/src/components/templatePreviews/CustomPreview.tsx` — Rewritten:
  - Removed 3-slide carousel fallback (SlideHero, SlideContent, SlideTypo, SlideDots, ScaledCanvas)
  - Removed all old style helpers (getStyleBg, getCardStyle, getDecorations)
  - Now only renders `RemotionPreviewPlayer` when `componentCode` exists
  - Shows simple placeholder when `componentCode` is missing

- `frontend/src/components/SceneEditModal.tsx` — Updated:
  - Changed comment from "UniversalScene handles sizing" to "Custom template arrangements"

### Architecture Changes
- **Single rendering path** — All custom templates now use `GeneratedVideo` composition exclusively. No fallback to `CustomVideo` + `UniversalScene`.
- **~107KB of dead code removed** — UniversalScene (36KB), styleEngine (11KB), normalize (7KB), CustomVideo (10KB × 2 copies), types (3KB × 2 copies), carousel preview (~400 lines).
- **No dual-path conditionals** — `build_custom_meta()` always returns `composition_id: "GeneratedVideo"`. `write_remotion_data()` always writes brandColors + sceneType for custom templates.

### Verification Steps
1. `cd remotion-video && npx tsc --noEmit` — passes ✓
2. `cd frontend && npx tsc --noEmit` — passes (only pre-existing @babel/standalone type issue from missing npm install) ✓
3. Backend imports: `python -c "from app.services.remotion import provision_workspace; ..."` — passes ✓
4. Custom templates page shows live Remotion previews (no carousel fallback)
5. Video rendering for custom templates uses GeneratedVideo composition exclusively

---

## Phase H1: Rate Limiting on Claude API Endpoints — DONE

### What Was Done

**File modified:**
- `backend/app/routers/custom_templates.py` — Added:
  - `_ai_call_counts` in-memory dict: `user_id → (date_string, count)`
  - `AI_DAILY_LIMIT = 5` constant
  - `_check_ai_rate_limit(user_id)` helper — checks daily count, resets on new day, raises HTTP 429 if exceeded
  - Rate limit check added at top of `generate_code()`, `regenerate_code()`, and `edit_code()` endpoints

### Design Decisions
- **In-memory counter** — matches existing `_render_progress` pattern. Single Cloud Run instance, so in-memory is fine.
- **Combined limit** — 5 calls/day total across generate + regenerate + edit (not 5 per endpoint).
- **Daily reset** — counter resets on date change, no cron needed.
- **Future extensibility** — `AI_DAILY_LIMIT` can be made per-plan (Free: 5, Standard: 20, Pro: 50).

---

## Phase H2: Code Validator Hardening — DONE

### What Was Done

**File modified:**
- `backend/app/services/code_validator.py` — Enhanced:
  - Added `DANGEROUS_REGEX` list — 18 compiled regex patterns with word-boundary matching for `eval`, `Function`, `fetch`, `document`, `window`, `process`, `globalThis`, `require`, `import`, `__proto__`, `constructor[]`, `Proxy`, `Reflect`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `cookie`
  - Added `MAX_CODE_LENGTH = 15,000` — rejects code exceeding this limit
  - Added `MAX_NESTING_DEPTH = 20` — rejects excessively nested brace structures
  - Added balanced braces check — ensures `{` and `}` counts match
  - Two-pass validation: fast substring check first, then thorough regex pass

### Design Decisions
- **Regex word boundaries** — `\beval\b` catches `eval` but not `evaluation`, and is harder to bypass with string concatenation tricks
- **New blocked APIs** — `Proxy`, `Reflect` (metaprogramming), `WebSocket` (network), `localStorage`/`sessionStorage`/`cookie` (storage)
- **Structural checks** — max length prevents abuse via massive code payloads; nesting depth catches obfuscated code; balanced braces catch malformed output

---

## Phase H3: Template Cache TTL — DONE

### What Was Done

**Files modified:**
- `backend/app/services/template_service.py` — Updated:
  - Cache type changed from `dict[str, data]` to `dict[str, (data, timestamp)]`
  - Added `_CACHE_TTL = 30.0` seconds constant
  - `_load_custom_template_data()` now checks `time.monotonic()` age on cache hit — refetches from DB if expired
  - Explicit invalidation (`invalidate_custom_template_cache()`) still works for same-process freshness

- `backend/app/services/remotion.py` — Updated:
  - `provision_workspace()` calls `invalidate_custom_template_cache(template_id)` before writing scene files, ensuring fresh DB data

### Design Decisions
- **30s TTL** — short enough for multi-worker consistency, long enough to avoid hammering DB during a single request lifecycle
- **`time.monotonic()`** — immune to system clock changes
- **Explicit invalidation preserved** — same-process updates still get instant cache busting

---

## Phase H4: Render Workspace Locking — DONE

### What Was Done

**File modified:**
- `backend/app/services/remotion.py` — Added:
  - `_workspace_locks: dict[int, threading.Lock]` — per-project lock registry
  - `_get_workspace_lock(project_id)` — returns or creates a lock for a project
  - `provision_workspace()` body wrapped in `with _get_workspace_lock(project_id):`

### Design Decisions
- **Per-project locks** — different projects can provision concurrently; only same-project requests serialize
- **Same pattern as `_render_progress`** — uses module-level dict for lock storage
- **`threading.Lock`** — sufficient for single-process multi-thread scenarios (uvicorn workers)

---

## Phase H5: Frontend Code Sandbox — DONE

### What Was Done

**Files modified:**
- `frontend/index.html` — Added:
  - CSP meta tag: `script-src 'self' 'unsafe-eval'` (needed for Babel), `connect-src 'self' https://*.blog2video.app` (blocks generated code from fetching external URLs), restricted `style-src`, `img-src`, `media-src`, `font-src`

- `frontend/src/components/RemotionPreviewPlayer.tsx` — Added:
  - `PlayerErrorBoundary` class component — catches React render errors from AI-generated components
  - Shows friendly error message with "Retry" button instead of crashing the app
  - Player JSX wrapped in `<PlayerErrorBoundary>`

### Design Decisions
- **CSP as first line of defense** — even if generated code contains `fetch()`, the browser blocks it from reaching external URLs
- **`unsafe-eval` required** — @babel/standalone needs `eval` for JIT compilation; CSP restricts everything else
- **Error boundary on Player** — catches runtime errors from compiled AI components; shows error UI instead of white screen

---

## Phase H6: Self-healing current_version_id — DONE

### What Was Done

**File modified:**
- `backend/app/routers/custom_templates.py` — Updated:
  - `list_versions()` now checks if `tpl.current_version_id` exists in the fetched versions set
  - If not found (dangling pointer), auto-sets to the newest version's ID and commits

### Design Decisions
- **Lazy self-healing** — only checks when versions are listed (read path), not on every template access
- **Newest version wins** — if pointer is dangling, the most recent version is the safest default

---

## Phase F1: BrandKit Population During Theme Extraction — DONE

### What Was Done

**Files modified:**
- `backend/app/routers/custom_templates.py` — Updated:
  - `ExtractThemeResponse` now includes `logo_urls`, `og_image`, `screenshot_url` from ScrapedThemeData
  - `CreateCustomTemplateRequest` now accepts optional `logo_urls`, `og_image`, `screenshot_url`
  - `extract_theme()` passes scraped logo/image data through to the response
  - `create_custom_template()` now creates a `BrandKit` row from theme data (colors, fonts, design_language, logos, images) and links it via `brand_kit_id`

- `frontend/src/api/client.ts` — Updated:
  - `ExtractThemeResponse` interface includes `logo_urls`, `og_image`, `screenshot_url`
  - `createCustomTemplate()` accepts optional `logo_urls`, `og_image`, `screenshot_url`

- `frontend/src/components/CustomTemplateCreator.tsx` — Updated:
  - Stores scraped `logo_urls`, `og_image`, `screenshot_url` from extract response in state
  - Passes them to `createCustomTemplate()` call so BrandKit is populated

### Design Decisions
- **BrandKit auto-created on template creation** — every new template gets a linked BrandKit, populating data that `code_generator.py` already reads (lines 199-207)
- **Logo URLs stored as JSON list** — scraped logo URLs are raw strings; F2 adds structured upload with primary/secondary types
- **OG image stored in BrandKit.images** — serves as the initial brand image until user uploads custom ones

---

## Phase F2: Brand Asset Uploads (Logo) — DONE

### What Was Done

**Files modified:**
- `backend/app/services/r2_storage.py` — Added:
  - `brand_asset_key(user_id, brand_kit_id, filename)` helper for R2 key generation

- `backend/app/routers/custom_templates.py` — Added:
  - `POST /{template_id}/upload-logo` endpoint — validates file type (PNG/JPEG/WebP/SVG) and size (2MB), auto-creates BrandKit if missing, uploads to R2, updates `bk.logos` JSON with primary logo entry
  - FastAPI `UploadFile`, `File` imports

- `backend/app/services/template_service.py` — Updated:
  - `_load_custom_template_data()` now includes `brand_kit` dict (colors, fonts, logos, design_language, images) in cached result

- `backend/app/services/remotion.py` — Updated:
  - `write_remotion_data()` reads brand_kit logos from custom_data, downloads primary logo to workspace public/ folder, sets `data["brandLogo"]` for GeneratedVideo access via `staticFile()`

- `frontend/src/api/client.ts` — Added:
  - `uploadTemplateLogo(templateId, file)` API method

- `frontend/src/components/TemplateCodeEditor.tsx` — Added:
  - Hidden file input + "Logo" button in preview panel header
  - `handleLogoUpload()` — uploads file, updates template state, shows success/error message in chat

### Design Decisions
- **Auto-create BrandKit on upload** — if template was created before F1, uploading a logo still works by auto-creating a minimal BrandKit
- **Logo format migration** — handles old BrandKit.logos format (list of URL strings) and new format (list of dicts with type/url)
- **Primary logo replacement** — uploading a new logo replaces the previous primary, preserving scraped logos as type "scraped"
- **Brand logo in data.json** — downloaded to workspace `public/brand-logo.png` for `staticFile()` access in GeneratedVideo

---

## Phase F5: Version Snapshots on Chat Edits — DONE

### What Was Done

**File modified:**
- `backend/app/routers/custom_templates.py` — Updated:
  - `edit_code()` now counts total edits for the template after each edit
  - Every 3rd edit, auto-saves a version snapshot via `_save_version(tpl, f"After {count} edits", db)`

### Design Decisions
- **Every 3rd edit** — balances version granularity vs. list clutter; users get checkpoints at edits 3, 6, 9, etc.
- **Combined with existing versioning** — these auto-versions appear alongside generate/regenerate/rollback versions in the version panel
- **Non-blocking** — version save happens in the same DB transaction as the edit, no extra overhead

---

## Phase F6: custom_prompt_builder.py Cleanup — DONE

### What Was Done

**File modified:**
- `backend/app/services/custom_prompt_builder.py` — Updated:
  - `build_custom_meta()` simplified: removed `valid_arrangements`, `preferred_arrangements`, `arrangements_without_image`, `hero_arrangement`, `fallback_arrangement`
  - Kept `valid_layouts`, `layouts_without_image` (used by SceneEditModal), `hero_layout`, `fallback_layout` (used by scene generation)
  - Added docstring explaining dual purpose: `build_custom_prompt()` is for DSPy AI script generation, `build_custom_meta()` is for pipeline routing

### Design Decisions
- **Prompt preserved** — `build_custom_prompt()` still generates the full 300-line prompt for DSPy scene generation (narration, visual hints) even though GeneratedVideo doesn't use arrangement/element layout data
- **Meta simplified** — removed arrangement-specific fields that GeneratedVideo ignores; kept layout fields that the API pipeline (SceneEditModal dropdown) still uses

---

## Phase F3: Enhanced Scraping with Firecrawl Branding Format — DONE

### What Was Done

**Files modified:**
- `backend/app/services/theme_scraper.py` — Updated:
  - `ScrapedThemeData` has new `branding: dict | None` field
  - `scrape_for_theme()` tries `formats=["branding", "html", "markdown", "screenshot"]` first
  - Falls back to standard formats if branding not available on the Firecrawl plan
  - Normalizes branding_data to dict (handles SDK object or raw dict)

- `backend/app/dspy_modules/theme_extractor.py` — Added:
  - `_apply_branding_overrides()` static method on `ThemeExtractor`
  - After DSPy theme extraction, merges Firecrawl branding data as high-confidence overrides
  - Overrides: `colors.primary→accent`, `colors.background→bg`, `colors.text→text`, `colors.secondary→surface`
  - Overrides: `typography.headingFont→fonts.heading`, `typography.bodyFont→fonts.body`
  - Called in `extract_theme()` only when `scraped.branding` is present and is a dict

### Design Decisions
- **Graceful fallback** — branding format may not be available on all Firecrawl plans; try/except ensures zero regression
- **Override, not replace** — Firecrawl branding values are merged on top of DSPy-extracted theme; DSPy still provides style, animation, patterns, category
- **Only override when present** — each branding field is checked individually; missing fields are left as DSPy extracted them

---

## Phase F4: Preview Thumbnails for Template Gallery — DONE

### What Was Done

**New file created:**
- `backend/app/services/thumbnail_renderer.py` — Renders single-frame PNG thumbnail:
  - `render_template_thumbnail(template_id, user_id)` — provisions temporary workspace, writes mock data.json with 1 intro scene, runs `npx remotion still GeneratedVideo` at 480p, uploads PNG to R2
  - Uses negative project IDs for temp workspace to avoid collision
  - Cleanup: removes temp workspace in finally block

**Files modified:**
- `backend/app/routers/custom_templates.py` — Updated:
  - `_render_and_store_thumbnail()` background task helper — calls renderer, stores URL in `tpl.preview_image_url`
  - `generate_code()` and `regenerate_code()` now accept `BackgroundTasks` and kick off thumbnail render after code gen
  - `_serialize_template()` now includes `preview_image_url`

- `frontend/src/api/client.ts` — Updated:
  - `CustomTemplateItem` includes `preview_image_url: string | null`

- `frontend/src/components/templatePreviews/CustomPreview.tsx` — Rewritten:
  - If `previewImageUrl` exists and user hasn't hovered, shows static image with play icon overlay (instant load)
  - On hover, lazy-loads the full `RemotionPreviewPlayer` (Babel JIT compilation)
  - Suspense fallback uses thumbnail image if available

- `frontend/src/pages/CustomTemplates.tsx` — Updated:
  - Passes `previewImageUrl={tpl.preview_image_url}` to CustomPreview in template grid

### Design Decisions
- **Background task** — thumbnail rendering is non-critical; failure doesn't affect code generation response
- **`remotion still`** — uses Remotion's built-in still image command (frame 0) instead of full video render; much faster
- **480p resolution** — sufficient for gallery thumbnails, keeps file size small
- **Hover-to-play** — template grid loads instantly with static images; @babel/standalone (~3MB) only loaded when user interacts
- **Thumbnail as Suspense fallback** — when Player is loading, the thumbnail serves as a smooth placeholder instead of a blank rectangle

---

## Phase F7: Multiple Unique Content Scene Variants — DONE

### What Was Done

Previously, Claude generated only 3 variants (1 intro, 1 content, 1 outro). All content scenes reused the same component — different text/image props but identical layout. This was the same fundamental limitation as the old UniversalScene system.

Now, Claude decides how many unique scene variants to create (typically 5-8 total). Each content scene gets a visually distinct layout, and scenes cycle through variants at render time.

**Before:** Intro → Content (same layout × N) → Outro
**After:** Intro → Scene1 → Scene2 → Scene3 → Scene4 → Scene5 → Outro (all unique layouts)

**Files modified:**

- `backend/app/models/custom_template.py` — Added `content_codes` (Text, nullable) — JSON array of content variant code strings
- `backend/app/models/template_version.py` — Added `content_codes` (Text, nullable) — version snapshots include all content variants
- `backend/app/database.py` — Added `content_codes` to SQLite migrations for both custom_templates and template_versions
- `backend/app/services/code_generator.py` — Major rewrite:
  - New SYSTEM_PROMPT: asks Claude to generate 5-8 scene variants using `<SCENE_0>`, `<SCENE_1>`, ..., `<SCENE_N>` XML tags
  - Claude decides how many unique layouts the brand needs
  - Scene 0 = intro, last scene = outro, all middle scenes = unique content variants
  - `_parse_scene_variants()` replaces `_parse_variants()` — parses dynamic numbered XML tags
  - Returns `content_codes: list[str]` instead of single `component_code`
  - `max_tokens` increased from 8000 to 16000 for multiple variants
- `backend/app/routers/custom_templates.py` — Updated:
  - `EditCodeRequest.variant` now accepts `content_N` format (e.g., `content_0`, `content_3`)
  - `_parse_variant()` helper parses variant strings into (type, index) tuples
  - `_get_variant_code()` / `_set_variant_code()` handle reading/writing content codes by index
  - `generate_code()` and `regenerate_code()` store `content_codes` as JSON
  - `_save_version()` snapshots `content_codes`
  - Rollback restores `content_codes`
  - `_serialize_template()` includes `content_codes` (parsed from JSON)
- `backend/app/services/template_service.py` — Updated:
  - `_load_custom_template_data()` parses and caches `content_codes`
  - `has_generated_code` checks both `component_code` and `content_codes`
- `backend/app/services/remotion.py` — Updated:
  - `_write_generated_scene_files()` now writes SceneContent0.tsx, SceneContent1.tsx, ..., SceneContentN.tsx
  - Generates `contentRegistry.ts` — exports `CONTENT_VARIANTS` array with all content components
  - Generates SceneContent.tsx (re-exports Content0 for backward compat)
  - `write_remotion_data()` adds `contentVariantIndex` and `contentVariantCount` to data.json
  - Content scenes are assigned variant indices cyclically (scene[i] uses variant[i % numVariants])

**New files created:**
- `remotion-video/src/templates/generated/contentRegistry.ts` — Placeholder; at render time, overwritten with imports of all content variant components
- `remotion-video/src/templates/generated/SceneContent0.tsx` — Placeholder; re-exports SceneContent

**Files rewritten:**
- `remotion-video/src/templates/generated/GeneratedVideo.tsx` — Now imports from `contentRegistry.ts` instead of single ContentScene. `getSceneComponent()` picks variant by `contentVariantIndex` from data.json.
- `remotion-video/src/templates/generated/types.ts` — Added `contentVariantIndex` and `contentVariantCount` fields
- `frontend/src/components/TemplateCodeEditor.tsx` — Dynamic variant tabs built from `template.content_codes`. Shows "Intro | Scene 1 | Scene 2 | ... | Scene N | Outro" tabs. Each tab can be independently edited via chat.
- `frontend/src/api/client.ts` — `CodeVariant` type changed from `"component" | "intro" | "outro"` to `"intro" | "outro" | \`content_${number}\``. `CustomTemplateItem` includes `content_codes: string[] | null`.

### Architecture Decisions
- **Claude decides count** — The prompt asks for "at least 5 variants" but lets Claude decide the right number (5-8) based on the brand personality. Complex brands might get more variety.
- **Cyclic assignment** — If there are 5 content variants and 8 content scenes, scenes cycle: 0,1,2,3,4,0,1,2. Simple, predictable, no AI needed at render time.
- **Backward compatibility** — `component_code` is always set to the first content variant. Old code that reads `component_code` still works (preview, gallery, etc).
- **Per-variant editing** — User selects a specific scene tab (e.g., "Scene 3") and edits just that variant. Edits are scoped and precise.
- **contentRegistry.ts pattern** — Instead of dynamic imports (which Vite can't bundle), we generate a registry file at render time that statically imports all content components. Vite bundles them normally.
- **max_tokens increase** — 8000 → 16000 to accommodate 5-8 full React components in one API call.

### Verification Steps
1. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000` — no errors, content_codes column auto-created
2. Create a template and generate code — should see "Generated N scene variants (1 intro + X content + 1 outro)" in backend logs
3. On Custom Templates page, click "Customize" — editor should show tabs: "Intro | Scene 1 | Scene 2 | ... | Outro"
4. Click each tab — different preview for each scene variant
5. Edit a specific variant via chat — only that variant changes
6. Trigger a video render — check workspace: should have SceneContent0.tsx through SceneContentN.tsx
7. Rendered video should have visually different layouts for each content scene
8. TypeScript check passes: `cd remotion-video && npx tsc --noEmit` ✓

---

## Phase OPT: Custom Template Performance & Quality Optimization — DONE

### Overview

5 fixes targeting custom template speed (246s → ~140s), animation quality, and UX. Previously code generation was blocking, scenes were 500-800 lines with repetitive animations, and CSS/logo scraping was broken.

### Fix 1: CSS & Logo Scraping Improvements — DONE

**Files modified:**
- `backend/app/services/theme_scraper.py`
  - `_extract_css_content()` now fetches external `<link rel="stylesheet">` CSS files (first 2-3, up to `_MAX_CSS_CHARS`) in addition to inline `<style>` blocks
  - Logo fallbacks improved: og:image added to logos list, SVG logo detection via logo-like class names, favicon.ico fallback
  - Note: SPA sites (e.g. noon.com) use CSS-in-JS, so CSS=0 is expected for them — the AI reads inline styles from the rendered HTML instead

### Fix 2: Theme Extraction Speed — DONE

**Files modified:**
- `backend/app/services/theme_scraper.py`
  - `_MAX_HTML_CHARS` reduced: 40,000 → 15,000 (AI only needs enough HTML for colors/fonts/layout patterns)
  - `_MAX_MARKDOWN_CHARS` reduced: 5,000 → 2,000
- `backend/app/dspy_modules/__init__.py`
  - `get_theme_lm()` model changed: `anthropic/claude-sonnet-4-6` → `anthropic/claude-haiku-4-5-20251001` (structured JSON extraction doesn't need Sonnet)

**Impact:** Theme extraction ~25s → ~13.8s (tested on noon.com)

### Fix 3: Code Generation Speed — DONE

**Files modified:**
- `backend/app/services/code_generator.py`
  - Line target in prompt: "There is NO line limit" → "Target 200-350 lines. Spend tokens on animation logic, not verbose inline styles."
  - Brevity reward in `_scene_reward()`: +0.05 for 200-350 lines, -0.10 for >500 lines
- `backend/app/dspy_modules/__init__.py`
  - `get_custom_lm()` max_tokens: 8192 → 5120 (~300-400 lines of JSX, matching built-in template complexity)
  - All 5 content variants kept (NUM_CONTENT_VARIANTS=5)

**Impact:** Scene sizes reduced from 500-800 lines → 242-354 lines. Fewer truncation retries.

### Fix 4: Background Code Generation — DONE

**Files modified:**
- `backend/app/routers/custom_templates.py`
  - `POST /{template_id}/generate-code` now returns 202 immediately, runs generation in background thread via `asyncio.get_event_loop().run_in_executor()`
  - In-memory progress dict: `_codegen_progress[template_id]` with status/step/running/error (same pattern as `_pipeline_progress` in pipeline.py)
  - New `GET /{template_id}/generation-status` endpoint for polling
- `frontend/src/components/CustomTemplateCreator.tsx`
  - After 202 response, polls `generation-status` every 2s
  - Shows progress steps, allows closing modal during generation
- `frontend/src/api/client.ts`
  - Added `getCodeGenerationStatus(templateId)` API function

**Impact:** Frontend no longer blocks during code generation. User can navigate away.

### Fix 5: Animation Quality & Creative Freedom — DONE

**Files modified:**
- `backend/app/services/code_generator.py`
  - **Deleted** `_VARIANT_SPECIALIZATIONS` dict (~150 lines of hardcoded JSX recipes that killed creativity)
  - **Added** `_CONTENT_VARIANT_ROLES` — lightweight content-type assignments (name, content_types, role description) giving Claude full creative freedom
  - **Rewrote** `_build_creative_direction()` — assigns content specialization but lets Claude design layout/animation freely
  - **Enhanced** `GenerateSceneCode` signature:
    - Animation technique reference section (word-by-word spring, image glow entrance, decorative orb) — examples not recipes
    - Quality rules: ≥3 different spring configs, staggered text reveal, decorative background element, proper Img handling
    - Forbidden: defaulting to simple opacity+translateY for everything
  - **Strengthened** `_scene_reward()`:
    - +0.10 for diverse springs (≥3 unique damping/stiffness configs)
    - +0.10 for staggered text animation (.map + spring + stagger timing)
    - +0.10 for Img + animation (spring/interpolate near Img usage)
    - +0.05 for glow/blur effects
    - -0.10 for opacity+translateY only (no other animation types)
    - -0.15 for scenes that completely ignore `imageUrl` (images won't render)
  - **Quality debug logging**: each scene logs techniques used (staggered-text, blur, radial-glow, scale, rotate, translateX, clip-path, easing) and spring configs

**Impact:** Generated scenes now have diverse animations (staggered-text, blur, radial-glow, scale, rotate, easing), 4 unique spring configs per scene, and scores of 1.00-1.30.

### Design System Optimization — DONE

**Problem:** Design system generation took 43.6s (Sonnet) producing 6323 chars including spring configs. All 7 scenes copied the same springs, producing identical motion feel.

**Files modified:**
- `backend/app/services/code_generator.py`
  - `GenerateDesignSystem` signature slimmed: 7 categories → 3 (background treatment, card/container CSS, text treatment)
  - Explicitly excludes: "Do NOT include spring configs, animation physics, decorative elements, or entrance patterns. Those are creative choices each scene makes independently."
  - Output constrained to ~1500 chars
  - Uses `get_theme_lm()` (Haiku) instead of `get_custom_lm()` (Sonnet) — structured CSS extraction doesn't need creative reasoning
  - `GenerateSceneCode` prompt updated: "Follow the design_system for visual styling (colors, cards, backgrounds, text treatment). Invent your OWN unique spring physics and animation timing — each scene should have distinctly different motion feel."

**Impact:** Design system ~43.6s → ~8-12s (Haiku + shorter output). Springs now vary per scene instead of being identical across all 7 scenes.

### Content Variant Diversity — DONE

**Problem:** When all blog content is the same type (e.g. noon.com: all bullets), every scene got routed to the same variant (variant 0, lists specialist). All scenes looked identical.

**Files modified:**
- `backend/app/services/remotion.py`
  - Variant routing updated: specialist variant used for the **first** occurrence of each content type only
  - Subsequent scenes with the same content type cycle through other variants for visual diversity
  - Example: 5 bullet scenes → variant 0 (specialist), 1 (cycling), 2, 3, 4 — all different layouts

**Impact:** Even when all content is the same type, every scene gets a different visual treatment.

### Test Results (noon.com)

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| CSS chars | 0 | 0 (expected for SPA) | > 0 for traditional sites |
| Logos | 0 | 1 | > 0 |
| Theme AI time | 25s | 13.8s | < 12s |
| Codegen total | 246s | 177.7s (pending design system fix) | < 140s |
| Scene lines | 500-800 | 242-354 | 200-350 |
| Spring configs | 1 identical | 4 unique per scene | ≥ 3 |
| Animation techniques | opacity+translateY | staggered-text, blur, radial-glow, scale, rotate, translateX, easing | diverse |
| Frontend blocking | yes (60-250s) | 202 + polling | non-blocking |

---

## Phase V2: Content-Aware Architecture (feat/customv2) — DONE

### Problem

Custom templates produced repetitive, content-blind videos. Built-in templates look great because each scene gets a layout matched to its content. Custom templates were generic because:
- 5 hardcoded layout families — every brand got the same structural layouts
- Blind cycling — scenes rotated through variants regardless of content (metrics scene might get kinetic_typography)
- 16 wasted DSPy calls per video generating layoutConfig that the renderer ignored
- Images broken — only one layout family rendered `<Img>`, others silently ignored images
- Preview broken — `contentVariantIndex` written to data.json but not DB

### What Was Done

#### 1. AI-Decided Brand Scene Types (DecideBrandSceneTypes DSPy Signature)

**Removed:** `CONTENT_ARCHETYPES` (10 hardcoded archetypes), `_LAYOUT_FAMILIES`, `NUM_CONTENT_VARIANTS=5`, `_build_creative_direction()`, `_VARIANT_SPECIALIZATIONS`, `_CONTENT_VARIANT_ROLES`

**Added:** `DecideBrandSceneTypes` DSPy signature — one call per brand that outputs 6-8 scene types tailored to the brand.
- Example: Metal (fundraising SaaS) → `brand_hook_intro, feature_spotlight, how_it_works, metrics_proof, vs_traditional, fundraising_timeline, founder_voice, cta_outro`
- Example: Al Jazeera (news) → completely different set of scene types
- Each scene type has `best_for` tags mapping to content types (bullets, metrics, quote, etc.)

**Files:** `backend/app/services/code_generator.py` — complete rewrite of generation flow

#### 2. Content Extraction & Archetype Matching

**New file:** `backend/app/services/content_classifier.py`
- `extract_structured_content_batch()` — ONE cheap Haiku call classifies ALL scene narrations into contentType (metrics/bullets/quote/comparison/timeline/steps/code/plain) and extracts structured data
- `match_scenes_to_archetypes()` — deterministic matching: contentType → best archetype based on `best_for` tags, with anti-repeat logic so consecutive scenes never get the same archetype

**Files modified:**
- `backend/app/routers/pipeline.py` — custom template branch now uses batch extraction instead of 16 per-scene DSPy calls
- `backend/app/services/remotion.py` — content-aware matching replaces blind cycling, persists `contentVariantIndex` to DB
- `frontend/src/components/VideoPreview.tsx` — reads `contentVariantIndex` from DB instead of `CONTENT_TYPE_TO_VARIANT`

#### 3. Alembic Migration for content_archetype_ids

**New file:** `backend/alembic/versions/phase8_content_archetype_ids.py`
- Adds `content_archetype_ids TEXT` column to `custom_templates` table
- Merges 3 divergent alembic heads into one

#### 4. Preview System Enrichment

**File:** `frontend/src/components/templatePreviews/CustomPreview.tsx` — complete rewrite
- Replaced simple `buildSampleData()` with archetype-aware `buildArchetypeSampleData()` returning rich structured data per content type (metrics with values, bullets, quotes, comparison, timeline, steps, code)
- Scene crossfade transitions with dot navigation
- Pre-compiles ALL scene codes on mount (eliminates per-scene "Compiling preview..." flash)

**File:** `frontend/src/components/templatePreviews/CustomPreviewLandscape.tsx`
- Delegates to `CustomPreview` when generated scene code exists
- Falls back to `FallbackSlides` component when no code

**File:** `frontend/src/components/BlogUrlForm.tsx`
- Template picker passes full template data (introCode, outroCode, contentCodes, contentArchetypeIds, logoUrls, ogImage)
- Selected template preview shows real generated scenes instead of hardcoded slides

#### 5. Image & Logo Rendering (MANDATORY in AI-generated scenes)

**Problem:** AI-generated components ignored `props.imageUrl` and `props.logoUrl` — pipeline delivered images correctly but components didn't render them.

**Root cause:** Not the pipeline — `GeneratedVideo.tsx` correctly maps `scene.images[0]` → `imageUrl`, and `VideoPreview.tsx` correctly passes `imageUrl` from `sceneImageMap`. The issue was that AI-generated React code never referenced these props.

**Fix — Prompt (code_generator.py `GenerateSceneCode`):**
- Images & Logo section marked MANDATORY with explicit JSX patterns
- Image techniques from built-in templates: Ken Burns zoom, radial vignette reveal, clipPath slit reveal, gradient overlays (3-layer: vignette + bottom gradient + accent wash)
- Adaptive layout: `const hasImage = !!props.imageUrl` — with image: split layout or full-bleed overlay; without image: text expands, larger fonts, particles/gradient as visual interest
- Both modes must look intentionally designed

**Fix — Text animations:**
- Word-by-word / line-by-line reveals with staggered springs
- Typewriter effect with blinking cursor
- Scale-punch for key words (bouncy overshoot spring)
- Bullet stagger (slide from right, delay=20+i*10)
- Exit animations 20-30 frames before durationInFrames

**Fix — Scene motion:**
- Multiple spring configs with different damping/stiffness/mass
- Metric count-ups, card fly-ins, decorative corner shapes, accent line grows
- Parallax depth, ambient gradient shifts, pulsing accent glows
- Reference configs: fast={damping:22,stiffness:140,mass:1.2}, bouncy={damping:14,stiffness:220,mass:1.1}, smooth={damping:20,stiffness:70}

**Fix — Reward function penalties:**
- `-0.2` if code doesn't reference `logoUrl`
- `-0.2` if code doesn't reference `imageUrl`
- `-0.3` for non-monotonic `interpolate()` inputRange (catches runtime crashes like `[0,60,120,90]`)
- Combined with existing checks (overflow:hidden, hardcoded data, visible contentType/sceneIndex)

#### 6. Code Generator Architecture (current state)

```
generate_component_code(template)
  │
  ├─ _build_brand_context() — raw data only (colors, fonts, patterns, brand kit)
  │
  ├─ _decide_brand_scene_types() — ONE DSPy call → 6-8 brand-specific scene types
  │
  ├─ _generate_design_system() — ONE Haiku call → concise CSS design system (<2000 chars)
  │
  └─ asyncio.gather(*tasks) — ALL scenes in PARALLEL via ThreadPoolExecutor(max_workers=8)
       └─ _generate_single_scene() → dspy.Refine(ChainOfThought(GenerateSceneCode), reward_fn=_scene_reward)
            └─ Up to 3 attempts per scene (1 initial + 2 retries if score < 0.75)
```

**Output:** `{ intro_code, outro_code, content_codes: list[str], archetype_ids: list[dict] }`

### Files Changed Summary

| File | Change |
|------|--------|
| `backend/app/services/code_generator.py` | Complete rewrite: DecideBrandSceneTypes, stripped prescriptive code, enriched animation/image prompt, reward penalties for missing image/logo |
| `backend/app/services/content_classifier.py` | NEW: batch content extraction (Haiku) + deterministic archetype matching |
| `backend/app/routers/pipeline.py` | Custom template branch uses batch extraction |
| `backend/app/services/remotion.py` | Content-aware matching, passes structuredContent to scenes |
| `backend/app/routers/custom_templates.py` | content_archetype_ids serialization, regeneration endpoint |
| `backend/app/routers/projects.py` | Scene regeneration for custom templates |
| `backend/app/models/custom_template.py` | content_archetype_ids column |
| `backend/app/database.py` | SQLite migration for content_archetype_ids |
| `backend/app/services/template_service.py` | Loads and caches archetype metadata |
| `backend/alembic/versions/phase8_content_archetype_ids.py` | PostgreSQL migration |
| `frontend/src/components/templatePreviews/CustomPreview.tsx` | Archetype-aware previews with crossfade |
| `frontend/src/components/templatePreviews/CustomPreviewLandscape.tsx` | Delegates to CustomPreview for generated code |
| `frontend/src/components/BlogUrlForm.tsx` | Template picker passes full template data |
| `frontend/src/components/VideoPreview.tsx` | Reads contentVariantIndex from DB |
| `frontend/src/components/CustomTemplateCreator.tsx` | Centered step indicator |
| `frontend/src/pages/CustomTemplates.tsx` | Passes archetype data to previews |
| `frontend/src/pages/ProjectView.tsx` | Layout label from archetype name |
| `frontend/src/api/client.ts` | content_archetype_ids types |

### Test Results

Three brands tested end-to-end (template creation → scene generation → video creation):

| Brand | Scene Types Decided | Content Extraction | Archetype Matching | Generation Time |
|-------|--------------------|--------------------|-------------------|-----------------|
| Metal (fundraising SaaS) | 8 types: brand_hook_intro, feature_spotlight, how_it_works, metrics_proof, vs_traditional, fundraising_timeline, founder_voice, cta_outro | All scenes classified correctly | Anti-repeat working | ~137s |
| Al Jazeera (news) | Unique news-focused types | Classified correctly | Working | ~130s |
| Nestlé Pakistan (FMCG) | Unique consumer brand types | Classified correctly | Working | ~135s |

All regenerated scenes score 1.00 (image/logo handling verified by reward function).

---

## Next Improvements (TODO)

| # | Improvement | Priority | Description |
|---|------------|----------|-------------|
| N2 | brandImages Pass-through in frontend preview | Low | VideoPreview.tsx doesn't pass `brandImages` to scene props (Remotion pipeline does). Add it for preview parity. |
| N7 | Per-Plan AI Limits | Low | AI_DAILY_LIMIT per-plan: Free: 5, Standard: 20, Pro: 50. |
