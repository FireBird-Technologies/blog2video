# Bulk upload links and dashboard generation

## Overview

Bulk flow: user provides multiple links (and optional names), configures each project (template, voice, **video format**, **logo**), submits once; backend creates N projects; dashboard starts generation for each and polls until all are done.

## Design note: per-link settings

**Take video format and logo individually for all the links provided, as each link is treated as a separate project.**

- **Video format (aspect ratio)** — configurable per link (per project), not shared across the bulk batch.
- **Logo** — configurable per link (per project), not shared across the bulk batch.

So in the bulk UI, each row has its own:
- URL + optional name
- Template
- Voice (gender, accent, custom voice ID)
- **Video format (landscape / portrait)**
- **Logo (file + position + opacity)**

Backend and API support per-project `aspect_ratio`, `logo` (file), `logo_position`, `logo_opacity` in each bulk item; no single “shared” logo or format for the whole request.

---

## Flow

1. **Step 1** — User picks “Bulk” and enters multiple links (and optional names), max link count from frontend (e.g. `MAX_BULK_LINKS`).
2. **Step 2** — Per-video template (each row has its own template).
3. **Step 3** — Per-video voice and **per-video format and logo** (each row has its own voice, format, and logo).
4. **Submit** — One backend call with an array of project configs (each item includes its own `aspect_ratio`, logo file or reference, `logo_position`, `logo_opacity`). Backend creates N projects and applies each project’s logo to that project only.
5. **After create** — Redirect to Dashboard (no query). Store created project IDs in **localStorage** (key `b2v_bulk_pending_ids`, JSON array). Dashboard on load reads bulk IDs from localStorage (with URL `?bulk=...` fallback for backward compatibility); starts **generate** for each ID; polls status (same rules as ProjectView); shows a “Bulk progress” list until all are done. On **Dismiss**, remove the key from localStorage and clear bulk state.

Single-link flow is unchanged: create → redirect to ProjectView → auto startGeneration + polling there.

---

## Backend

- **Config:** `MAX_BULK_LINKS` (e.g. 10).
- **POST /api/projects/bulk** — Request: multipart with `projects` (JSON array of project configs). Each item includes: `blog_url`, `name?`, `template`, `voice_gender`, `voice_accent`, `aspect_ratio`, `logo_position`, `logo_opacity`, `custom_voice_id?`, colors, and either inline logo data or a per-item logo file reference as agreed (e.g. base64 or separate file per index). Backend creates N projects, applies each project’s logo to that project only, returns `{ project_ids: number[] }`. Enforce `MAX_BULK_LINKS` and user video limit.

## Frontend

- **BlogUrlForm (bulk mode):** Step 1 = N rows (url, name), capped by `MAX_BULK_LINKS`. Step 2 = per-row template. Step 3 = per-row voice, **per-row video format**, and **per-row logo** (file, position, opacity). On submit, call `onSubmitBulk(items)` where each item carries its own format and logo; parent sends one bulk request.
- **Dashboard:** `handleCreateBulk` calls `createProjectsBulk` once, writes project IDs to localStorage (`b2v_bulk_pending_ids`), sets `bulkPendingIds` state, then navigates to `/dashboard` (no query). On load, hydrate `bulkPendingIds` from localStorage; if empty, fall back to parsing `?bulk=...` from URL (and write to localStorage for next time). For each id call `startGeneration(id)`; run one polling interval calling `getPipelineStatus(id)` per id; use same “done” rules as ProjectView; show “Bulk progress” list. On **Dismiss**, remove `b2v_bulk_pending_ids` from localStorage and clear `bulkPendingIds`.
