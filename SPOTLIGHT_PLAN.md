# Spotlight Template — Data-Viz Scenes + Kinetic Transitions (Implementation Plan)

Port the **same two improvements** we made to the Matrix template onto **Spotlight**:
1. **Two data-visualization scenes** (an animated chart + a data table) driven by
   scraped article tables, via the shared `_shared/chartData.ts` pipeline + backend
   binding.
2. **A real scene-transition system** (`@remotion/transitions` `TransitionSeries`
   with a pool of **custom, kinetic, Spotlight-branded** presentations — Economist-style),
   replacing the current abrupt single 8-frame `SpotlightTransition`.

> **Decisions locked with the user:** scope = transitions **+** data-viz scenes;
> transition style = **custom kinetic** (Economist-style bespoke presentations),
> matched to Spotlight's aesthetic (bold kinetic typography, dark stage,
> accent red `#EF4444`, spring-slam).

---

## Context: Spotlight today

- **Aesthetic:** "Bold kinetic typography on a dark stage. Words fill the frame,
  slam in, and cascade. Glass panels for data moments. High contrast, fast-paced,
  social-first. Spring-slam animations with accent red highlights." Colors:
  accent `#EF4444`, bg `#000000`, text `#FFFFFF`. Display font `Archivo Black`.
- **Layouts (10):** `impact_title` (hero), `statement` (fallback), `word_punch`,
  `cascade_list`, `stat_stage`, `versus`, `spotlight_image`, `rapid_points`,
  `closer`, `ending_socials`.
- **Current transition:** `SpotlightTransition` in `SpotlightVideo.tsx` — a single
  8-frame scale-punch overlay rendered via `<Sequence from={dur-8}>`. Abrupt, same
  on every cut. **This is exactly the Matrix "before" state.**
- **Three render paths (must all be updated + kept in sync):**
  1. Canonical: `remotion-video/src/templates/spotlight/SpotlightVideo.tsx`
  2. Preview adapter: `frontend/src/components/remotion/remotionAdapters.tsx`
     (`RemotionSpotlightVideoComposition`, ~line 600) — drives Template Studio live preview
  3. CI standalone: `frontend/src/components/remotion/spotlight/SpotlightVideoComposition.tsx`
- **CRITICAL — two Remotion trees:** `remotion-video/src/templates/` (canonical,
  used for renders) and `frontend/src/components/remotion/` (the CI/production
  preview copy). In **local dev** the Vite alias `@remotion-video/templates` →
  `../remotion-video/src/templates`; in **CI** (`CF_PAGES`/`VERCEL`) → `./src/components/remotion`.
  **Every new/changed file must be mirrored into BOTH trees**, or production preview
  breaks. (This is what bit us on Matrix.)

---

## Part A — Two data-viz scenes (`spotlight_data` + `spotlight_table`)

The backend chart pipeline is **template-agnostic** (`chart_planner.py`,
`generate_chart_props_from_table_hints`, `_extract_tables_from_visual_hint`,
`classify_chart_tables_for_template`). Mirror Matrix at each layer.

### A1. Shared data layer (already exists — reuse, don't recreate)
`remotion-video/src/templates/_shared/chartData.ts` holds all pure parsing /
type-inference / animation helpers (`resolveChartInputs`, `selectChartType`,
`orientChartInputsForType`, `buildXAxisProps({axisTextColor, fontFamily})`,
`buildAutoChartSummary`, `easeInOutCubic`, `clampProgressAt`, …). It's STYLE-FREE —
each renderer injects its own theme. **Confirm it exists on this branch**; if the
`feat/econ-temp` branch predates it, port it from the matrix work (and mirror into
the CI tree's `frontend/src/components/remotion/_shared/`).

### A2. Frontend renderers (Spotlight-styled)
Create under `remotion-video/src/templates/spotlight/layouts/`:
- **`SpotlightDataChart.tsx`** (= Matrix's `MatrixDataChart`, reskinned). Reuse all
  `_shared/chartData` helpers; render line/bar/histogram with Recharts. **Spotlight
  styling:** dark stage bg, white text, **red `#EF4444` series/accent**, `Archivo
  Black` for the title/labels, glass-panel chart card (Spotlight already uses
  "glass panels for data moments"), spring-slam entrance on the title. A thin
  `buildXAxisProps` wrapper injects `axisTextColor` (white/light-grey) + Spotlight font.
- **`SpotlightTable.tsx`** (= Matrix's `MatrixTicker`, reskinned). Headers + rows,
  optional `tickerHighlightCol` for +/- red/green coloring, on a glass panel.

Both consume the **same prop names** as Matrix/LaDuc so the backend merge transfers
unchanged: `chartTable`, `chartType`, `chartSummary`, `chartYAxisTicks`, `subtitle`,
`yAxisLabel`, `barPrimaryColor`, `barSecondaryColor`, `tickerTable`, `tickerTitle`,
`tickerFootnote`, `tickerHighlightCol`.

### A3. Types + registry
- `spotlight/types.ts`: add `"spotlight_data"` + `"spotlight_table"` to
  `SpotlightLayoutType`, and add the chart/table prop fields (copy from
  `matrix/types.ts`).
- `spotlight/layouts/index.ts`: register both in `SPOTLIGHT_LAYOUT_REGISTRY`.

### A4. Backend wiring (mirror Matrix exactly)
- **meta.json** (`backend/templates/spotlight/meta.json`): add both to
  `valid_layouts` + add `layout_prop_schema` entries (model on Matrix's
  `matrix_data`/`matrix_ticker` schema blocks: `chart_table`/`ticker_table` field
  types, `chartType` select, defaults with a sample table).
- **Pipeline gate** (`backend/app/routers/pipeline.py`): add one line to the
  registry **`CHART_TICKER_TEMPLATE_LAYOUTS`**:
  ```python
  CHART_TICKER_TEMPLATE_LAYOUTS = {
      "matrix": ("matrix_data", "matrix_ticker"),
      "spotlight": ("spotlight_data", "spotlight_table"),   # ← add this
  }
  ```
  The shared `classify_chart_tables_for_template(...)` helper + the
  `elif template_id in CHART_TICKER_TEMPLATE_LAYOUTS:` branch already handle the
  rest — **no new branch needed**.
- **Merge dispatch** (`backend/app/dspy_modules/template_scene_gen.py`):
  - In the binding block (the one gated on `template_id in (... "matrix")`), add
    `"spotlight"` and accept `spotlight_data`/`spotlight_table` in the
    `preferred_layout` check that populates `_newscast_data_viz_table_by_scene`.
  - Generalize `_merge_laduc_chart_props`'s `is_chart_layout` / `is_ticker_layout`
    guards to also match `spotlight_data` / `spotlight_table`.
  - Generalize the empty-table fallback guard (`layout in ("market_annotation",
    "matrix_data")`) to include `"spotlight_data"`.
- **Prompts** (`backend/templates/spotlight/prompt.md` + `layout_prompt.md`): add
  `spotlight_data` ("real chart from a bound table") + `spotlight_table` ("data
  table from a bound table"); note they're reserved for scenes the pipeline binds
  to a table (have a `data_table_index`).

### A5. Verify (Part A)
Render Spotlight in the studio with a fixture containing a `spotlight_data` scene
(sample `chartTable`) + a `spotlight_table` scene; confirm the chart animates, axes
read, red accent reads, and the table color-codes the change column. Confirm the
backend gate emits `spotlight_data`/`spotlight_table` for an article with ≥2 tables.

---

## Part B — Kinetic transitions (custom, Economist-style)

Replace `SpotlightTransition` with a `transitions/` module modeled on
**`economist/transitions/`** (see `ECONOMIST_TRANSITIONS.md`), but with
Spotlight-flavored **kinetic / slam** moves.

### B1. Custom presentations (`spotlight/transitions/presentations.tsx`)
Each a pure `TransitionPresentation` (function of `presentationProgress` +
`presentationDirection`). Suggested Spotlight roster (bold, high-contrast, spring-slam):
- **slamZoom** — incoming scene slams in from a 1.2 over-scale to 1.0 with a quick
  settle (spring), outgoing dips back + dims. The signature Spotlight move.
- **accentBarWipe** `{direction}` — a solid **red `#EF4444`** bar sweeps the cut,
  incoming revealed by its trailing edge via `clip-path` (Economist `inkBar`
  geometry, Spotlight color). Branded hard wipe.
- **kineticPush** `{direction}` — fast parallax push (Economist `pagePush` math)
  but snappier easing, for "next point" momentum.
- **wordSlam** — a brief black-out + scale-punch where the incoming title word
  slams to fill the frame (plays to Spotlight's "words fill the frame, slam in").
- **barSplit** — two red bars wipe in from top+bottom meeting at center, then part
  to reveal the new scene (high-contrast stage reveal).
- (optional) **whipBlur** `{direction}` — reuse the Economist whip for punchy cuts.

Use `springTiming({ config: { damping: 200 } })` for slams (no overshoot wobble),
`linearTiming` for wipes. Easing helper: `easeInOutCubic` (copy from Economist).

### B2. Pool + hero handling (`spotlight/transitions/index.ts`)
`pickSpotlightTransition(idx, fromLayout, toLayout, w, h)` → `{ presentation, frames }`.
- **Hero specials:** leaving `impact_title` → a big `slamZoom` or `barSplit`;
  arriving at `ending_socials` → an `accentBarWipe` stamp.
- **Mid-roll POOL** cycled by `idx % N`, alternating calm (kineticPush) and punchy
  (slamZoom / accentBarWipe / wordSlam / barSplit) so the rhythm has lift.
- Key off the **outgoing scene index** → deterministic (metadata frame-count and
  render agree on overlap). Parameterize push distance by canvas `w` for 16:9 + 9:16.

### B3. Wire into all 3 render paths (TransitionSeries + overlap math)
For **each** of `SpotlightVideo.tsx` (canonical), `RemotionSpotlightVideoComposition`
(adapter), and CI `SpotlightVideoComposition.tsx`:
- Replace the `.map → <Sequence> + <SpotlightTransition>` with `<TransitionSeries>` /
  `<TransitionSeries.Sequence>` / `<TransitionSeries.Transition presentation timing>`.
- **Overlap-aware duration:** in `calculateSpotlightMetadata`, subtract every
  `pickSpotlightTransition(i,...).frames` from the total.
- **Audio sync:** compute `sceneStartFrames` by walking forward and subtracting each
  transition's frames; render voiceover `<Sequence from={sceneStartFrames[i]}>`
  outside the `TransitionSeries` (exactly as Economist/Matrix do).
- **Retire** the old `SpotlightTransition` component (delete it; no leftover refs).
- Adapter/CI imports use `@remotion-video/templates/spotlight/transitions`; add a TS
  declaration in `frontend/src/types/remotion-video.d.ts` for that module
  (exports `pickSpotlightTransition` + the `SpotlightTransitionChoice` type).

### B4. Verify (Part B)
Render a 4–6 scene Spotlight video; scrub each boundary: confirm consecutive cuts
use **different** moves, all flow smoothly (no stuck frames), last scene has **no**
trailing transition, and audio stays in sync. Compare against Economist for feel.

---

## Sync & verification checklist (do NOT skip — this is what bit Matrix)

1. **Mirror every new/changed file into BOTH trees** (`remotion-video/...` **and**
   `frontend/src/components/remotion/...`): `_shared/chartData.ts` (if needed),
   `spotlight/layouts/SpotlightDataChart.tsx`, `SpotlightTable.tsx`,
   `spotlight/transitions/` (presentations + index), updated `types.ts`,
   `layouts/index.ts`, `SpotlightVideo.tsx` ↔ `SpotlightVideoComposition.tsx`.
   Verify with `diff -q` that shared files are byte-identical.
2. **TS declarations:** update `frontend/src/types/remotion-video.d.ts` for the new
   spotlight layouts module export + the transitions module.
3. **Typecheck both trees:** `(cd remotion-video && npx tsc --noEmit)` and
   `(cd frontend && npx tsc --noEmit)` → 0 errors.
4. **Production build:** `(cd frontend && CF_PAGES=1 npx vite build)` → succeeds
   (proves the CI path compiles with recharts + the new transitions).
5. **Render stills** for each new layout + each transition midpoint to confirm
   visuals (use `npx remotion still SpotlightVideo out.png --frame=N --props='{"dataUrl":"/fixture.json"}'`).
6. **Restart the dev server** after — Vite must re-optimize deps (recharts) to pick
   up new files.

## Reference files (read these first when implementing)
- `ECONOMIST_TRANSITIONS.md` (this repo root) — the transition pattern to copy.
- `remotion-video/src/templates/economist/transitions/{presentations.tsx,index.ts}`
- `remotion-video/src/templates/economist/EconomistVideo.tsx` — TransitionSeries + overlap math
- Matrix equivalents (on the matrix branch) for the data-viz half:
  `matrix/layouts/MatrixDataChart.tsx`, `MatrixTicker.tsx`, `_shared/chartData.ts`,
  and the backend `classify_chart_tables_for_template` + `CHART_TICKER_TEMPLATE_LAYOUTS`.
- `remotion-video/src/templates/spotlight/` — the target template.
