# Blog2Video — Template System Design Document

> **Audience:** Engineer implementing the template system.
> **Status:** Specification — no code has been written yet.
> **Estimated effort:** 11–12 engineer-days (6 days if parallelized across 2–3 people).

---

## 1. Goal

Add a pluggable template system so users can choose a visual style for their video (or let AI pick one). Each template is a self-contained package of Remotion layout components, DSPy prompt files, and metadata. Adding a new template requires **zero changes** to core pipeline code.

---

## 2. Architecture

```
User picks template (or "Auto")
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  backend/templates/{template_id}/                                │
│  ├── meta.json        ← colors, composition_id, layout IDs      │
│  └── prompt.md        ← DSPy-readable design rules + layouts    │
└──────────────┬──────────────────────────────────────────────────┘
               │ read by
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  TemplateService  (backend/app/services/template_service.py)     │
│                                                                  │
│  • list_templates()          → list of all templates             │
│  • get_meta(id)              → one template's meta.json          │
│  • get_prompt(id)            → one template's prompt.md content  │
│  • get_valid_layouts(id)     → set of valid layout IDs           │
│  • validate_template_id(id)  → returns id or "default"           │
└──────────────┬──────────────────────────────────────────────────┘
               │ used by
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  TemplateSceneGenerator  (ONE class for ALL templates)           │
│  (backend/app/dspy_modules/template_scene_gen.py)                │
│                                                                  │
│  __init__(template_id)                                           │
│    → loads prompt.md as a DSPy input field                       │
│    → loads valid_layouts, hero_layout, fallback_layout from meta │
│                                                                  │
│  generate_scene_descriptor(...)                                  │
│    → scene 0 always forced to hero_layout                        │
│    → other scenes: calls DSPy with prompt.md content             │
│    → validates output layout against valid_layouts                │
│    → invalid layout → uses fallback_layout                       │
│    → returns {layout, layoutProps}                                │
└──────────────┬──────────────────────────────────────────────────┘
               │ output consumed by
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  remotion.py                                                     │
│  • write_remotion_data() → uses hero_layout and fallback_layout  │
│  • provision_workspace() → copies template's .tsx files          │
│  • render_video()        → uses composition_id from meta.json    │
└──────────────┬──────────────────────────────────────────────────┘
               │ renders
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  remotion-video/src/templates/{template_id}/                     │
│  ├── {Name}Video.tsx          ← Remotion composition             │
│  └── layouts/                                                    │
│      ├── index.ts             ← LAYOUT_REGISTRY                  │
│      ├── types.ts             ← TypeScript interfaces            │
│      └── *.tsx                ← UI components                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
blog2video/
├── backend/
│   ├── templates/
│   │   ├── registry.json                   ← ["default","nightfall","gridcraft","spotlight"]
│   │   ├── HOW_TO_ADD_TEMPLATE.md          ← instructions for adding a 5th template
│   │   ├── default/
│   │   │   ├── meta.json
│   │   │   └── prompt.md
│   │   ├── nightfall/
│   │   │   ├── meta.json
│   │   │   └── prompt.md
│   │   ├── gridcraft/
│   │   │   ├── meta.json
│   │   │   └── prompt.md
│   │   └── spotlight/
│   │       ├── meta.json
│   │       └── prompt.md
│   └── app/
│       ├── services/
│       │   └── template_service.py         ← NEW
│       ├── dspy_modules/
│       │   ├── template_scene_gen.py       ← NEW (unified generator)
│       │   ├── template_suggest.py         ← NEW (AI auto-select)
│       │   ├── scene_gen.py                ← KEEP as fallback
│       │   └── script_gen.py               ← UNCHANGED
│       ├── models/project.py               ← EDIT: add template column
│       ├── schemas/schemas.py              ← EDIT: add template field
│       ├── routers/pipeline.py             ← EDIT: use TemplateSceneGenerator
│       ├── routers/projects.py             ← EDIT: validate template + colors
│       ├── database.py                     ← EDIT: add migration
│       └── main.py                         ← EDIT: add GET /api/templates
│
├── remotion-video/src/
│   ├── components/                         ← SHARED across all templates
│   │   ├── LogoOverlay.tsx
│   │   └── Transitions.tsx
│   ├── templates/
│   │   ├── default/
│   │   │   ├── DefaultVideo.tsx            ← renamed from ExplainerVideo.tsx
│   │   │   └── layouts/
│   │   │       ├── index.ts
│   │   │       ├── types.ts
│   │   │       └── (10 existing layout files — moved here)
│   │   ├── nightfall/
│   │   │   ├── NightfallVideo.tsx
│   │   │   └── layouts/
│   │   │       ├── index.ts, types.ts
│   │   │       └── (9 layout files)
│   │   ├── gridcraft/
│   │   │   ├── GridcraftVideo.tsx
│   │   │   └── layouts/
│   │   │       ├── index.ts, types.ts
│   │   │       └── (9 layout files)
│   │   └── spotlight/
│   │       ├── SpotlightVideo.tsx
│   │       └── layouts/
│   │           ├── index.ts, types.ts
│   │           └── (9 layout files)
│   ├── Root.tsx                            ← EDIT: register all 4 compositions
│   └── index.ts
│
└── frontend/src/
    ├── api/client.ts                       ← EDIT: template types + API calls
    ├── components/
    │   ├── TemplatePicker.tsx               ← NEW
    │   ├── BlogUrlForm.tsx                 ← EDIT: integrate TemplatePicker
    │   ├── VideoPreview.tsx                ← EDIT: composition routing map
    │   └── remotion/templates/             ← NEW: preview mirrors
    │       ├── default/   (same layout structure)
    │       ├── nightfall/ (same layout structure)
    │       ├── gridcraft/ (same layout structure)
    │       └── spotlight/ (same layout structure)
    └── pages/
        ├── Dashboard.tsx                   ← EDIT: pass template param
        └── ProjectView.tsx                 ← EDIT: show template badge
```

---

## 4. What Changes Per Template vs What Stays the Same

### NEVER modify for a new template (template-agnostic core):

| File | Why |
|------|-----|
| `template_scene_gen.py` | Reads prompt.md — no template logic |
| `template_service.py` | Reads registry.json — auto-discovers |
| `script_gen.py` | Script generation has no template dependency |
| `pipeline.py` | Just reads `project.template` and passes it |
| `remotion.py` | Reads meta.json for composition_id, hero/fallback |
| `TemplatePicker.tsx` | Fetches from API — auto-discovers |
| `BlogUrlForm.tsx` | Receives template from picker — template-agnostic |
| `Dashboard.tsx` | Passes template through — template-agnostic |
| `client.ts` | Generic API calls — template-agnostic |

### Files created PER template:

| File | Purpose |
|------|---------|
| `backend/templates/{id}/meta.json` | Identity, colors, layout IDs, composition ID |
| `backend/templates/{id}/prompt.md` | Full DSPy prompt with design rules + layout catalog |
| `remotion-video/src/templates/{id}/{Name}Video.tsx` | Main Remotion composition |
| `remotion-video/src/templates/{id}/layouts/*.tsx` | Layout UI components |
| `remotion-video/src/templates/{id}/layouts/index.ts` | Layout registry map |
| `remotion-video/src/templates/{id}/layouts/types.ts` | TypeScript interfaces |
| `frontend/src/components/remotion/templates/{id}/` | Preview mirror of all above |

### Files edited ONCE (not per template):

| File | What to add |
|------|-------------|
| `backend/templates/registry.json` | Template ID to the array |
| `remotion-video/src/Root.tsx` | New `<Composition>` entry |
| `frontend/src/components/VideoPreview.tsx` | Entry in COMPOSITIONS map |

---

## 5. The `meta.json` Schema

Every template must have a `meta.json` with exactly these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Template ID (lowercase, no spaces/hyphens, matches directory name) |
| `name` | string | Display name for the UI (e.g. "Nightfall") |
| `description` | string | 1–2 sentence description for the template picker card |
| `preview_colors` | object | `{ accent, bg, text }` — hex color strings, applied as defaults |
| `composition_id` | string | PascalCase Remotion composition ID (e.g. `"NightfallVideo"`) — must match Root.tsx |
| `hero_layout` | string | Layout ID forced for scene 0 — must be in valid_layouts |
| `fallback_layout` | string | Layout ID used when DSPy output is invalid — must be in valid_layouts |
| `valid_layouts` | string[] | Complete list of every layout ID in this template |

---

## 6. The `prompt.md` Structure

Every `prompt.md` must have these five sections. DSPy reads the entire file as one input field, so it must be self-contained.

### Section 1: Design Philosophy
3–5 sentences describing the visual language. Tell the LLM what this template LOOKS LIKE — the UI components, the mood, the color treatment, the spatial approach. Be specific and visual.

### Section 2: Layout Catalog
For every layout, include:
- **Layout ID** (must match meta.json and the Remotion component registry)
- **Visual description** — what the viewer literally sees on screen. Describe the UI elements, sizes, colors, spatial arrangement. DSPy needs to understand what it is choosing between.
- **Best for** — what types of content suit this layout
- **Props** — exact prop names and types that the Remotion component expects. If no extra props, say "(none)". If the layout takes structured data, show the exact shape (array of objects with named fields). The prop names here must EXACTLY match the TypeScript interface in the component.

### Section 3: Scene Flow Rules
Which layout for scene 0, recommended ordering/patterns, maximum frequency for special layouts, what to use for opening/middle/closing.

### Section 4: Content Extraction Rules
For each layout that takes structured props: how to pull REAL data from the narration. Never fabricate. Give examples.

### Section 5: Variety Rules
Never repeat same layout more than 2 consecutive scenes. Minimum distinct layouts per video. Which layout is the baseline/fallback and its maximum frequency.

---

## 7. The DSPy Signature Design

There is ONE signature used for ALL templates. It has these fields:

**Inputs:**
- `template_prompt` — the full content of prompt.md (this is what changes between templates)
- `scene_title` — title of this scene
- `narration` — narration text to analyze and extract data from
- `visual_description` — visual hints from the script generator
- `scene_index` — 0-based index (scene 0 always gets the hero layout)
- `total_scenes` — used by the LLM to plan variety across the video

**Outputs:**
- `layout` — a layout ID from the template's catalog
- `layout_props_json` — JSON object with layout-specific props

The signature's docstring should be SHORT and GENERIC. It should say: "Read the template_prompt carefully and follow its design rules, layout catalog, and content extraction rules precisely." All the real design direction comes from prompt.md, not the Python code.

The generator class constructor takes `template_id`, loads prompt.md and meta.json via TemplateService, and stores hero_layout, fallback_layout, and valid_layouts. The generate method forces scene 0 to hero_layout, calls DSPy for other scenes, validates the output layout against the valid set, and falls back if invalid.

---

## 8. How `remotion.py` Adapts

Three functions read from TemplateService (no hardcoded template logic):

1. **`write_remotion_data()`** — Reads `hero_layout` and `fallback_layout` from meta.json instead of hardcoding `"hero_image"` and `"text_narration"`

2. **`provision_workspace()`** — Instead of a hardcoded file list, scans `remotion-video/src/templates/{template_id}/` and copies all `.tsx`/`.ts` files into the workspace. Always also copies shared components from `remotion-video/src/components/`

3. **Render command** — Reads `composition_id` from meta.json and passes it to the Remotion render CLI instead of hardcoding `"ExplainerVideo"`

---

## 9. 1:1 Alignment Rule

There is a strict 1:1:1 mapping that must stay in sync:

```
Layout ID in prompt.md   ←→   Layout ID in meta.json valid_layouts
         ↕                              ↕
Key in Remotion LAYOUT_REGISTRY   ←→   Key in data.json scene output
         ↕
Component .tsx file
```

If any of these are misaligned, the system breaks silently (props don't reach the component, or invalid layouts fall back every time). When creating a template, write the layout IDs in meta.json FIRST, then use those exact strings everywhere else.

Props alignment: the prop names in `prompt.md`'s layout catalog must exactly match the TypeScript interface in the corresponding `.tsx` component. If prompt.md says `metrics` (array of `{value, label, suffix}`), the component must destructure `metrics` with that exact shape.

---

## 10. Implementation Steps (in dependency order)

### Step 1: Create Template Registry Files
Create `backend/templates/` with `registry.json` and all four template subdirectories, each containing `meta.json` and `prompt.md`. For default, extract existing content from `scene_gen.py`. For the other three, write fresh prompt.md files following the TEMPLATES.md spec.

**Acceptance:** Every meta.json passes schema validation. Every prompt.md has all five sections. Every layout ID in prompt.md exists in meta.json's valid_layouts.

### Step 2: Create TemplateService
Create `backend/app/services/template_service.py`. Reads registry on init, loads meta.json into memory, reads prompt.md fresh on each call. Module-level singleton. Unknown IDs fall back to "default".

**Acceptance:** Import the service, list_templates returns 4, get_prompt returns non-empty strings, validate_template_id("bogus") returns "default".

### Step 3: Add Templates API Endpoint
Add `GET /api/templates` in main.py. Calls TemplateService.list_templates(). No auth required.

**Acceptance:** API returns all 4 templates. Adding a 5th directory + registry entry makes it appear on restart.

### Step 4: Create Unified TemplateSceneGenerator
Create `backend/app/dspy_modules/template_scene_gen.py`. One class, one DSPy signature. Constructor takes template_id, loads prompt and meta. Scene 0 forced to hero_layout. Invalid outputs use fallback_layout. Keep existing scene_gen.py as fallback.

**Acceptance:** Generator("default") matches current quality. Generator("nightfall") produces nightfall layout IDs. Scene 0 is always the hero layout.

### Step 5: Create TemplateSuggester (AI Auto-Select)
Create `backend/app/dspy_modules/template_suggest.py`. DSPy signature takes blog summary + available templates list, outputs template_id + reasoning. Add `POST /api/suggest-template` endpoint.

**Acceptance:** Technical blog → default. Design/opinion piece → nightfall. Business/product content → gridcraft. Marketing/listicle → spotlight. At least 3/4 correct.

### Step 6: Database & Project Creation Updates
Add `template` column to Project model (string, default "default"). Add to schemas. Add migration. Validate template in create_project, apply template's default colors when user doesn't override.

**Acceptance:** Create project with template "nightfall" → stored. Template "bogus" → stores "default". Template "gridcraft" without colors → gets orange/neutral.

### Step 7: Wire Template into Pipeline & Rendering
Replace SceneCodeGenerator with TemplateSceneGenerator(project.template) in pipeline.py. If template is "auto", call TemplateSuggester first. Update remotion.py to read composition_id, hero_layout, fallback_layout from TemplateService. Dynamic file copying in provision_workspace.

**Acceptance:** Each template produces correct layouts and renders with correct composition ID.

### Step 8: Build Remotion Components
**Do the default restructure first** — move existing files from `src/components/layouts/` into `src/templates/default/layouts/`, rename ExplainerVideo to DefaultVideo, verify everything still works. Then build three new templates (nightfall, gridcraft, spotlight) following the TEMPLATES.md spec. Mirror all components in the frontend for preview. Register compositions in Root.tsx. Add to COMPOSITIONS map in VideoPreview.tsx.

**Acceptance:** For each template — preview Player renders correctly, final video renders correctly, all layouts display with the template's visual style.

### Step 9: Frontend Template Picker
Create TemplatePicker component. Shows "Auto (AI picks)" as default + 4 template cards with color dots, name, description, checkmark. Selecting a template applies its colors. Wire through BlogUrlForm → Dashboard → createProject. Show template badge on ProjectView.

**Acceptance:** All templates appear. Selecting one changes colors. "Auto" triggers AI selection. Badge shows result.

### Step 10: Write HOW_TO_ADD_TEMPLATE.md
Step-by-step checklist for adding a 5th template. List files to create, files to edit (registry.json, Root.tsx, VideoPreview.tsx), files that DON'T change. Include testing checklist.

**Acceptance:** A new engineer can follow the doc and add a template without asking questions.

---

## 11. Parallelization Strategy

```
Engineer A:  Steps 1, 2, 3, 4, 5, 6, 7, 10    (backend + DSPy + wiring)
Engineer B:  Step 8 — nightfall components       (9 layouts × 2)
Engineer C:  Step 8 — gridcraft components        (9 layouts × 2)
Engineer D:  Step 8 — spotlight components        (9 layouts × 2)
Engineer A:  Step 9 (frontend picker, after 1–7 done)
```

Engineer A must complete Step 1 (registry files) before B/C/D can start, and must complete "restructure default" in Step 8 before new templates are built.

Wall-clock time with 2–3 engineers: ~6 days.

---

## 12. Common Mistakes to Avoid

| Mistake | Impact | Prevention |
|---------|--------|-----------|
| Layout ID mismatch between prompt.md, meta.json, and index.ts | DSPy outputs get rejected as invalid, falls back every time | Write IDs in meta.json first, copy-paste everywhere else |
| Prop names in prompt.md don't match .tsx interface | DSPy extracts data that the component ignores | Copy-paste prop names from TypeScript interface into prompt.md |
| composition_id in meta.json doesn't match Root.tsx | Render command targets nonexistent composition, exits with error | String-compare before testing |
| Forgot to add template to registry.json | TemplateService doesn't know it exists | Always update registry first |
| hero_layout not included in valid_layouts | Scene 0 uses a layout that isn't in the Remotion registry | Include hero_layout in valid_layouts array |
| Hardcoding template-specific logic in pipeline.py or remotion.py | Defeats the pluggable architecture — every new template needs code changes | All template differences must live in meta.json and prompt.md |
| Writing vague prompt.md layout descriptions ("show content nicely") | DSPy makes poor layout choices because it doesn't know what layouts look like | Describe what the viewer literally sees: sizes, positions, colors, animations |
