import json
import re
import dspy
from collections import Counter

from app.dspy_modules import ensure_dspy_configured
from app.services.chart_planner import (
    get_chartable_tables_from_visual_hint,
    generate_chart_props_from_table_hints,
    generate_terminal_chart_candlestick_items,
    generate_terminal_table_items,
    generate_terminal_ticker_items,
    is_candlestick_table,
    has_candlestick_table_in_visual_hint,
    _extract_tables_from_visual_hint,
    _score_table_for_scene,
    is_laduc_ticker_table,
)
from app.services.template_service import (
    get_prompt,
    get_meta,
    get_valid_layouts,
    get_hero_layout,
    get_fallback_layout,
)
from app.observability.logging import get_logger

logger = get_logger(__name__)

# Valid arrangements for the universal layout engine (custom templates)
VALID_ARRANGEMENTS = {
    "full-center", "split-left", "split-right", "top-bottom",
    "grid-2x2", "grid-3", "asymmetric-left", "asymmetric-right", "stacked",
}

VALID_ELEMENT_TYPES = {
    "heading", "body-text", "card-grid", "code-block", "metric-row",
    "image", "quote", "timeline", "steps", "icon-text", "comparison",
}

_VISUAL_LAYOUT_KEYWORDS: dict[str, list[str]] = {
    "story_stack": ["stack list", "story stack", "stacked list", "key provisions", "key features"],
    "side_by_side_brief": ["side by side", "side-by-side", "compare", "contrast", "versus", "before after", "before/after"],
    "live_metrics_board": ["metrics board", "key numbers", "key statistics", "metric cards"],
    "headline_insight": ["pull quote", "powerful sentence", "defining moment", "headline insight"],
    "segment_break": ["chapter break", "segment break", "section transition"],
    "briefing_code_panel": ["code panel", "code snippet", "terminal"],
}


def _visual_hints_at_layout(visual_description: str) -> str | None:
    """If the visual description strongly implies a specific non-data layout, return its ID."""
    lower = (visual_description or "").lower()
    for layout_id, keywords in _VISUAL_LAYOUT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return layout_id
    return None


# ─── Built-in templates: layout catalog + layout_props_json ───────────────────


class BuiltInTemplateSceneToDescriptor(dspy.Signature):
    """
    You are an expert video scene designer creating engaging, varied layouts.

    ═══ CRITICAL RULES ═══
    1. Extract ONLY factual content from narration — NEVER invent or fabricate
    2. Use exact prop keys from the layout catalog (case-sensitive)
    3. Choose layouts that match content richness (complex content → complex layout)
    4. Prioritize VARIETY — avoid repeating recent layouts unless content demands it
    5. If narration lacks data for a layout's required props, choose a simpler layout

    ═══ VARIETY STRATEGY ═══
    - Check previous_layouts and underused_layouts to maximize diversity
    - Avoid consecutive identical layouts unless absolutely necessary
    - Balance between: content fit (70%), variety (20%), visual flow (10%)
    - Use full layout catalog — don't default to 2-3 "safe" choices

    ═══ PROP EXTRACTION ═══
    - Quote directly from narration when possible
    - For arrays: extract ALL mentioned items, not just 1-2 examples
    - For numbers: extract exact values if stated
    - For charts: extract ALL data points mentioned (categories, values, time points)
    - If a prop is optional and not in narration, omit it (don't guess)
    - Use EXACT prop key names from the layout catalog (e.g., "barChartRows" not "bar_chart", "metrics" not "metric")

    ═══ CHART DATA INTEGRITY — BLOOMBERG TERMINAL/DATAVIZ LAYOUTS ═══
    - NEVER invent, fabricate, or guess year/date labels for chart data points.
    - Chart data MUST come from the scraped table embedded in visual_description (the
      ═══ TABLE_DATA_HINT_JSON ═══ block). Do NOT synthesize chart data from prose claims.
    - Use ONLY the exact labels present in the embedded table headers/rows.
    - If no time labels exist in the source table, use the row index (1, 2, 3...) or omit labels entirely.
    - The chartTable prop is always overridden deterministically from the raw table data — do not set it yourself.

    ═══ OUTPUT FORMAT ═══
    - layout: exact layout ID from catalog (lowercase, underscores)
    - layout_props_json: valid JSON with exact prop keys from catalog
    - reasoning: your step-by-step thought process
    """

    template_prompt: str = dspy.InputField(
        desc="Full template prompt: design philosophy, layout catalog with prop schemas, content extraction rules"
    )
    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text — source of truth for prop extraction")
    visual_description: str = dspy.InputField(desc="Visual hints and styling context")
    scene_index: int = dspy.InputField(desc="Scene number (0-based)")
    total_scenes: int = dspy.InputField(desc="Total scene count")
    previous_layouts: str = dspy.InputField(
        desc="Comma-separated list of last 3 layouts used (for variety)"
    )
    underused_layouts: str = dspy.InputField(
        desc="Comma-separated list of layouts not yet used (prioritize these for variety)"
    )
    preferred_layout: str = dspy.InputField(
        desc="Optional: User's preferred layout type. If provided, use this layout and extract props accordingly. Must be one of the valid layouts from the catalog. Empty string means no preference."
    )
    content_language: str = dspy.InputField(
        desc="Target language for all generated textual content in layout_props_json. Must match this language only."
    )

    reasoning: str = dspy.OutputField(
        desc="Your reasoning: (1) Content analysis, (2) Layout choice rationale, (3) Prop extraction details, (4) Variety considerations"
    )
    layout: str = dspy.OutputField(
        desc="Layout ID from catalog (must be exact match, lowercase with underscores). If preferred_layout is provided and valid, use that layout. Otherwise, pick the most VISUALLY ENGAGING option that fits the content."
    )
    layout_props_json: str = dspy.OutputField(
        desc='Valid JSON object with layout-specific props. Use exact prop keys from catalog. Return {} for layouts with no required props. Do NOT wrap in markdown code blocks.'
    )


class BuiltInRegenerateSceneToDescriptor(dspy.Signature):
    """
    You are an expert video scene designer. The USER is editing a single scene.

    ═══ REGENERATION CONTEXT ═══
    - This is a single-scene edit: the user has requested changes (description) and/or chosen a layout.
    - If preferred_layout is provided, YOU MUST use that layout and only extract props from the content.
    - If preferred_layout is empty, choose the best layout that fits the content and avoids repeating
      layouts already used in other_scenes_layouts (so the full video stays varied).
    - Respect the user's intent: if visual_description says "no image" or "visualization only", adapt.

    ═══ PROP EXTRACTION ═══
    - Extract ONLY factual content from narration and visual_description — NEVER invent.
    - Use exact prop keys from the layout catalog (case-sensitive).
    - For arrays: extract ALL mentioned items. For charts: extract ALL data points.
    - If a prop is optional and not in the content, omit it (don't guess).
    - Use EXACT prop key names from the catalog (e.g., "barChartRows", "metrics").

    ═══ OUTPUT FORMAT ═══
    - layout: exact layout ID from catalog (lowercase, underscores). If preferred_layout is given, return that.
    - layout_props_json: valid JSON with exact prop keys from catalog. Return {} when no props needed. Do NOT wrap in markdown code blocks.
    - reasoning: brief step-by-step reasoning (content, layout choice or use of preferred, prop extraction).
    """

    template_prompt: str = dspy.InputField(
        desc="Full template prompt: layout catalog with prop schemas, content extraction rules"
    )
    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text — source of truth for prop extraction")
    visual_description: str = dspy.InputField(
        desc="User's edit description or visual hints (e.g. 'make it more dramatic', 'show a chart'). Drive layout and props from this when relevant."
    )
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes in the video")
    other_scenes_layouts: str = dspy.InputField(
        desc="Layouts used in OTHER scenes (e.g. 'scene 0: cinematic_title, scene 2: glass_narrative'). Avoid repeating these when choosing a layout if no preferred_layout is given."
    )
    preferred_layout: str = dspy.InputField(
        desc="User's chosen layout ID. If non-empty and valid, USE THIS LAYOUT and only extract props. If empty, choose the best layout that fits content and varies from other_scenes_layouts."
    )
    current_descriptor: str = dspy.InputField(
        desc="Optional: current scene descriptor as JSON (layout + layoutProps). Use to preserve or adapt existing props when the user is refining rather than replacing. Empty string if no existing descriptor."
    )
    content_language: str = dspy.InputField(
        desc="Target language for all generated textual content in layout_props_json. Must match this language only."
    )

    reasoning: str = dspy.OutputField(
        desc="Brief reasoning: (1) Content / user intent, (2) Layout choice (or use of preferred_layout), (3) Prop extraction"
    )
    layout: str = dspy.OutputField(
        desc="Layout ID from catalog (exact match, lowercase with underscores). Must equal preferred_layout when preferred_layout is non-empty."
    )
    layout_props_json: str = dspy.OutputField(
        desc='Valid JSON object with layout-specific props. Exact prop keys from catalog. {} when none. Do NOT wrap in markdown code blocks.'
    )


# ─── LaDuc chart caption: prose beside `market_annotation` charts ──────────────


class LaDucChartSummary(dspy.Signature):
    """
    Write a 2–3 sentence analytical caption for a chart, grounded strictly in the bound table.

    Rules:
    - Use ONLY values that appear verbatim in chart_table_json.rows. Never invent figures.
    - Name at least two specific entities (row labels) and cite at least two numeric values.
    - Be analytical: identify the leader, the gap between top and bottom, a notable outlier or
      concentration, and if the data allows, a directional trend or ratio.
    - Do NOT restate the title or narration. Complement them — add a different angle.
    - Plain English. No finance jargon unless the narration uses it.
    - Wrap key emphasis phrases (a standout figure, a striking ratio, the dominant entity) in
      __double underscores__ — e.g. __ICBC at $7.3T__. Use 1–3 emphasis spans per output.
      Do NOT wrap entire sentences, only the 2–5 word key fact within a sentence.
    - Target ~45–60 words total across the 2–3 sentences.
    """

    chart_table_json: str = dspy.InputField(
        desc='JSON: {"headers": [...], "rows": [[...], ...]}. The exact table being charted on screen.'
    )
    chart_type: str = dspy.InputField(desc="bar | line | histogram")
    scene_title: str = dspy.InputField(desc="The scene's title — for tonal continuity only.")
    narration: str = dspy.InputField(desc="The scene's voiceover — the caption must complement, not repeat it.")

    summary: str = dspy.OutputField(
        desc=(
            "2–3 sentence analytical caption rendered beside the chart. "
            "Cites at least two row labels and two numeric values from chart_table_json.rows. "
            "Key emphasis phrases (standout figures, dominant entities, striking ratios) are wrapped "
            "in __double underscores__ — e.g. '__ICBC at $7.3T__'. 1–3 emphasis spans total."
        )
    )


# ─── Custom templates: universal layout engine (layout_config_json) ─────────────


class TemplateSceneToDescriptor(dspy.Signature):
    """
    You are an expert video scene designer creating engaging, varied layouts
    using a universal layout engine.

    ═══ CRITICAL RULES ═══
    1. Extract ONLY factual content from narration — NEVER invent or fabricate
    2. Output a VALID JSON layout config with arrangement, elements, and decorations
    3. Choose arrangements that match the template's preferred direction
    4. Prioritize VARIETY — avoid repeating recent arrangements
    5. If narration lacks data for complex elements, use simpler element types

    ═══ VARIETY STRATEGY ═══
    - Check previous_arrangements and underused_arrangements to maximize diversity
    - Avoid consecutive identical arrangements unless absolutely necessary
    - Balance between: content fit (70%), variety (20%), visual flow (10%)
    - Use the full range of 9 arrangements — don't default to 2-3 "safe" choices

    ═══ ELEMENT EXTRACTION ═══
    - Quote directly from narration when possible
    - For items arrays: extract ALL mentioned items, not just 1-2 examples
    - For numbers/metrics: extract exact values if stated
    - If a content field is optional and not in narration, omit it (don't guess)

    ═══ OUTPUT FORMAT ═══
    - layout_config_json: VALID JSON matching the SceneLayoutConfig schema
    - reasoning: your step-by-step thought process
    """

    template_prompt: str = dspy.InputField(
        desc="Full template prompt: design philosophy, layout config schema, element types, content extraction rules"
    )
    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text — source of truth for content extraction")
    visual_description: str = dspy.InputField(desc="Visual hints and styling context")
    scene_index: int = dspy.InputField(desc="Scene number (0-based)")
    total_scenes: int = dspy.InputField(desc="Total scene count")
    previous_arrangements: str = dspy.InputField(
        desc="Comma-separated list of last 3 arrangements used (for variety)"
    )
    underused_arrangements: str = dspy.InputField(
        desc="Comma-separated list of arrangements not yet used (prioritize these for variety)"
    )
    preferred_arrangement: str = dspy.InputField(
        desc="Optional: User's preferred arrangement. If provided, use this arrangement. Empty string means no preference."
    )
    content_language: str = dspy.InputField(
        desc="Target language for all generated textual content in layout_config_json. Must match this language only."
    )

    reasoning: str = dspy.OutputField(
        desc="Your reasoning: (1) Content analysis, (2) Arrangement choice, (3) Element selection, (4) Decoration choices, (5) Variety considerations"
    )
    layout_config_json: str = dspy.OutputField(
        desc='Valid JSON object matching SceneLayoutConfig schema: {"arrangement":"...","elements":[{"type":"...","content":{...},"emphasis":"..."}],"decorations":["..."],"background":{...}}. Do NOT wrap in markdown code blocks.'
    )


class RegenerateSceneToDescriptor(dspy.Signature):
    """
    You are an expert video scene designer. The USER is editing a single scene.

    ═══ REGENERATION CONTEXT ═══
    - This is a single-scene edit: the user has requested changes and/or chosen an arrangement.
    - If preferred_arrangement is provided, YOU MUST use that arrangement.
    - If preferred_arrangement is empty, choose the best arrangement that fits content and
      avoids repeating arrangements from other_scenes_arrangements.
    - Respect the user's intent: if visual_description says "no image" or "visualization only", adapt.

    ═══ ELEMENT EXTRACTION ═══
    - Extract ONLY factual content from narration and visual_description — NEVER invent.
    - For items arrays: extract ALL mentioned items.
    - If a content field is optional and not in the content, omit it (don't guess).

    ═══ OUTPUT FORMAT ═══
    - layout_config_json: valid JSON matching SceneLayoutConfig schema. Do NOT wrap in markdown code blocks.
    - reasoning: brief step-by-step reasoning.
    """

    template_prompt: str = dspy.InputField(
        desc="Full template prompt: layout config schema, element types, content extraction rules"
    )
    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text — source of truth for content extraction")
    visual_description: str = dspy.InputField(
        desc="User's edit description or visual hints"
    )
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes in the video")
    other_scenes_arrangements: str = dspy.InputField(
        desc="Arrangements used in OTHER scenes (e.g. 'scene 0: full-center, scene 2: split-left'). Avoid repeating these."
    )
    preferred_arrangement: str = dspy.InputField(
        desc="User's chosen arrangement ID. If non-empty, USE THIS. If empty, choose the best fit."
    )
    current_descriptor: str = dspy.InputField(
        desc="Optional: current scene config as JSON. Use to preserve or adapt existing content. Empty string if none."
    )
    content_language: str = dspy.InputField(
        desc="Target language for all generated textual content in layout_config_json. Must match this language only."
    )

    reasoning: str = dspy.OutputField(
        desc="Brief reasoning: (1) Content / user intent, (2) Arrangement choice, (3) Element extraction"
    )
    layout_config_json: str = dspy.OutputField(
        desc='Valid JSON object matching SceneLayoutConfig schema. Do NOT wrap in markdown code blocks.'
    )


class ArrangementVarietyTracker:
    """Tracks arrangement usage to ensure variety across scenes."""

    def __init__(self, valid_arrangements: list | None = None, hero_arrangement: str = "full-center"):
        self.valid_arrangements = set(valid_arrangements or VALID_ARRANGEMENTS)
        self.hero_arrangement = hero_arrangement
        self.usage_count: Counter = Counter()
        self.recent_history: list[str] = []
        self.max_history = 4

    def record(self, arrangement: str):
        self.usage_count[arrangement] += 1
        self.recent_history.append(arrangement)
        if len(self.recent_history) > self.max_history:
            self.recent_history.pop(0)

    def get_previous_arrangements(self) -> str:
        return ",".join(self.recent_history[-3:]) if self.recent_history else ""

    def get_underused_arrangements(self) -> str:
        if not self.valid_arrangements:
            return ""
        avg_usage = sum(self.usage_count.values()) / len(self.valid_arrangements) if self.usage_count else 0
        underused = []
        for arr in self.valid_arrangements:
            if arr == self.hero_arrangement:
                continue
            if self.usage_count[arr] < avg_usage:
                underused.append(arr)
        return ",".join(underused) if underused else ",".join(list(self.valid_arrangements)[:5])

    def is_repetitive(self, arrangement: str, threshold: int = 2) -> bool:
        if not self.recent_history:
            return False
        if self.recent_history[-1] == arrangement:
            return True
        recent_count = self.recent_history[-threshold:].count(arrangement)
        return recent_count >= threshold


_SCRAPED_TICKER_RE = re.compile(
    r"═══ SCRAPED_TICKER_ROWS ═══\n(.*?)\n═══ END_SCRAPED_TICKER_ROWS ═══",
    re.DOTALL,
)


def _extract_scraped_ticker_rows(visual_description: str) -> list[str]:
    """Parse the ticker rows block injected by the pipeline into visual_description."""
    m = _SCRAPED_TICKER_RE.search(visual_description)
    if not m:
        return []
    return [line for line in m.group(1).splitlines() if line.strip()]


class TemplateSceneGenerator:
    """Generates scene layout configs with focus on variety and accurate content extraction."""

    def __init__(self, template_id: str, debug: bool = False):
        ensure_dspy_configured()
        self.template_id = template_id
        self.debug = debug

        self._prompt = get_prompt(template_id)
        self._meta = get_meta(template_id)
        self._is_custom = template_id.startswith("custom")

        logger.info(
            "[SCENE_GEN] Init template=%s, is_custom=%s, debug=%s",
            template_id,
            self._is_custom,
            debug,
        )

        if self._is_custom:
            self._valid_arrangements = self._meta.get("valid_arrangements", list(VALID_ARRANGEMENTS))
            self._hero_arrangement = self._meta.get("hero_arrangement", "full-center")
            self._fallback_arrangement = self._meta.get("fallback_arrangement", "top-bottom")
            logger.info(
                "[SCENE_GEN] Custom: arrangements=%s, hero=%s, fallback=%s",
                self._valid_arrangements,
                self._hero_arrangement,
                self._fallback_arrangement,
            )
            logger.debug(
                "[SCENE_GEN] Custom meta keys: %s",
                list(self._meta.keys()),
            )
        else:
            self._valid_layouts = get_valid_layouts(template_id)
            self._hero_layout = get_hero_layout(template_id)
            self._fallback_layout = get_fallback_layout(template_id)

        if self._is_custom:
            self._descriptor = dspy.Predict(TemplateSceneToDescriptor)
            self.descriptor = dspy.asyncify(self._descriptor)
            self._regenerate_descriptor = dspy.Predict(RegenerateSceneToDescriptor)
            self.regenerate_descriptor = dspy.asyncify(self._regenerate_descriptor)
            self.builtin_descriptor = None
            self.builtin_regenerate_descriptor = None
        else:
            self._builtin_descriptor = dspy.Predict(BuiltInTemplateSceneToDescriptor)
            self.builtin_descriptor = dspy.asyncify(self._builtin_descriptor)
            self._builtin_regenerate_descriptor = dspy.Predict(BuiltInRegenerateSceneToDescriptor)
            self.builtin_regenerate_descriptor = dspy.asyncify(self._builtin_regenerate_descriptor)
            self._descriptor = self.descriptor = None
            self._regenerate_descriptor = self.regenerate_descriptor = None

        # LaDuc chart caption predictor — used by _merge_laduc_chart_props to fill chartSummary.
        self._chart_summary = dspy.Predict(LaDucChartSummary)
        self.chart_summary = dspy.asyncify(self._chart_summary)

        if self._is_custom:
            self.variety_tracker = ArrangementVarietyTracker(
                self._valid_arrangements, self._hero_arrangement,
            )
        else:
            self.variety_tracker = ArrangementVarietyTracker(
                get_valid_layouts(template_id), get_hero_layout(template_id),
            )
        # Newscast-only hinting: when multiple tables are available, we can target
        # multiple scenes for data visualization and rotate table sources.
        self._newscast_forced_data_viz_scenes: set[int] = set()
        self._newscast_data_viz_table_by_scene: dict[int, int] = {}

    def _parse_props_json(self, props_str: str) -> dict:
        """Parse layout_props_json for built-in templates."""
        try:
            raw = (props_str or "").strip()
            if raw.startswith("```"):
                lines = raw.split("\n")[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw = "\n".join(lines)
            props = json.loads(raw)
            return props if isinstance(props, dict) else {}
        except (json.JSONDecodeError, TypeError) as e:
            if self.debug:
                logger.warning(
                    "[SCENE_GEN] Props JSON parse error: %s | Raw: %s",
                    e,
                    (props_str or "")[:100],
                )
            return {}

    def _merge_chart_planner_props(
        self,
        layout: str,
        props: dict,
        visual_description: str,
        scene_title: str,
        narration: str,
        scene_index: int | None = None,
    ) -> dict:
        if layout != "data_visualization":
            return props

        out = dict(props or {})

        # Enforce chartTable-only data payloads for data_visualization even if
        # planner cannot derive table props for this scene.
        for key in ("lineChartLabels", "lineChartDatasets", "barChartRows", "histogramRows"):
            out.pop(key, None)

        preferred_table_index = None
        if isinstance(scene_index, int):
            preferred_table_index = self._newscast_data_viz_table_by_scene.get(scene_index)

        planned = generate_chart_props_from_table_hints(
            visual_description=visual_description,
            scene_title=scene_title,
            narration=narration,
            preferred_table_index=preferred_table_index,
        )
        if not planned:
            return out

        chart_keys = {
            "chartType",
            "chartTable",
            "marketSymbol",
            "marketValue",
            "marketDelta",
            "marketPercent",
            "marketTrend",
        }

        # Planner output is deterministic from extracted table hints, while model
        # output may include noisy numeric hallucinations from mixed text cells.
        # Prefer planner chart payload when available.
        for k, v in planned.items():
            if k in chart_keys:
                if k == "chartType" and out.get("chartType"):
                    continue
                out[k] = v

        return out

    async def _merge_laduc_chart_props(
        self,
        layout: str,
        props: dict,
        visual_description: str,
        scene_title: str,
        narration: str,
        scene_index: int | None = None,
    ) -> dict:
        """Inject real scraped chartTable into market_annotation props.

        Mirrors _merge_chart_planner_props for newscast's data_visualization.
        Uses the pre-bound table index from _newscast_data_viz_table_by_scene
        (populated upfront from data_table_index set by ScriptGenerator) so the
        correct table is always selected without re-scoring all tables per call.
        """
        if not (layout.startswith("market_annotation") or layout == "ticker"):
            return props
        out = dict(props or {})
        preferred_table_index = (
            self._newscast_data_viz_table_by_scene.get(scene_index)
            if isinstance(scene_index, int)
            else None
        )

        # Ticker layout: bypass chart planner entirely — write raw { headers, rows }
        # directly to tickerTable. _build_chart_props_from_table fails on ticker-style
        # tables that have empty "" separator columns (e.g. Name|""|Price|""|%).
        if layout == "ticker":
            tables = _extract_tables_from_visual_hint(visual_description)
            if not tables:
                return out
            best: dict | None = None
            if preferred_table_index is not None and 0 <= preferred_table_index < len(tables):
                best = tables[preferred_table_index]
            else:
                # Prefer tables that look like a market snapshot (Name/Price/% cols)
                ticker_candidates = [t for t in tables if isinstance(t, dict) and is_laduc_ticker_table(t)]
                if ticker_candidates:
                    best = ticker_candidates[0]
                else:
                    scene_text = f"{scene_title}\n{narration}".strip()
                    scored = [(t, _score_table_for_scene(t, scene_text)) for t in tables if isinstance(t, dict)]
                    best = max(scored, key=lambda x: x[1], default=(None, None))[0]
            if best:
                out["tickerTable"] = {"headers": best.get("headers", []), "rows": best.get("rows", [])}
            return out

        planned = generate_chart_props_from_table_hints(
            visual_description=visual_description,
            scene_title=scene_title,
            narration=narration,
            preferred_table_index=preferred_table_index,
        )
        if not planned:
            return out
        # market_annotation: always override chartTable with real scraped data
        # — never keep LLM's fabricated rows. Keep AI's chartType only if it's
        # a valid explicit choice (not empty/auto).
        if "chartTable" in planned and planned["chartTable"].get("rows"):
            out["chartTable"] = planned["chartTable"]
        if "chartType" in planned:
            ai_chart_type = out.get("chartType", "")
            if not ai_chart_type or ai_chart_type == "auto":
                out["chartType"] = planned["chartType"]

        # Populate chartSummary with an LLM-written analytical caption when the
        # scene has real bound chart data and nobody (manual edit / upstream
        # generator) has already set one. A failure here is non-fatal — the
        # frontend renderer falls back to buildAutoChartSummary.
        if not out.get("chartSummary"):
            chart_tbl = out.get("chartTable")
            if isinstance(chart_tbl, dict) and (chart_tbl.get("rows") or []):
                try:
                    summary_res = await self.chart_summary(
                        chart_table_json=json.dumps(chart_tbl, ensure_ascii=False),
                        chart_type=str(out.get("chartType") or "bar"),
                        scene_title=scene_title,
                        narration=narration,
                    )
                    summary_text = (getattr(summary_res, "summary", "") or "").strip()
                    if summary_text:
                        out["chartSummary"] = summary_text
                except Exception:
                    logger.warning(
                        "[SCENE_GEN] LaDucChartSummary failed for scene_index=%s; "
                        "falling back to frontend auto-summary",
                        scene_index,
                    )
        return out

    def _merge_bloomberg_table_props(
        self,
        layout: str,
        props: dict,
        visual_description: str,
    ) -> dict:
        """Generate deterministic items[] props for bloomberg table layouts.

        - terminal_chart: extract time-series values → "{label}: {value}" items
        - terminal_table: format table rows as pipe-delimited items strings
        - terminal_dataviz: extract chartTable + chartType from non-candlestick tables
        Only runs for bloomberg; returns props unchanged for all other layouts.
        """
        if layout not in {"terminal_chart", "terminal_table", "terminal_dataviz", "terminal_ticker"}:
            return props

        # terminal_ticker: override LLM items with real data (prose-scraped first, table fallback second)
        if layout == "terminal_ticker":
            out = dict(props or {})
            ticker_rows = _extract_scraped_ticker_rows(visual_description)
            if not ticker_rows:
                # Fallback: derive ticker items from TABLE_DATA_HINT_JSON if present
                tables = [t for t in _extract_tables_from_visual_hint(visual_description) if isinstance(t, dict)]
                for t in tables:
                    items = generate_terminal_ticker_items(t, max_items=10)
                    if items:
                        ticker_rows = items
                        break
            out["items"] = ticker_rows
            return out

        tables = [t for t in _extract_tables_from_visual_hint(visual_description) if isinstance(t, dict)]
        if not tables:
            # No scraped table data available — bloomberg data layouts must NEVER fabricate data
            # from prose. Mark as invalid so the caller's guard falls back to a non-data layout.
            if layout in {"terminal_chart", "terminal_dataviz", "terminal_table"}:
                return {**(props or {}), "_invalid_layout": True}
            return props

        out = dict(props or {})

        if layout == "terminal_chart":
            # Search all tables for one with OHLCV columns, not just tables[0]
            candlestick_table = next((t for t in tables if is_candlestick_table(t)), None)
            if candlestick_table is None:
                # No OHLCV data — but there may be a non-candlestick line-chartable table.
                # Route to terminal_dataviz (line chart) instead of making up fake OHLCV values.
                non_cs = next((t for t in tables if not is_candlestick_table(t)), None)
                if non_cs:
                    out["_reroute_to_dataviz"] = True
                    out["_dataviz_table"] = non_cs
                else:
                    out["_invalid_layout"] = True
                return out
            items = generate_terminal_chart_candlestick_items(candlestick_table, max_items=60)
            if items:
                out["items"] = items
            # Also store the raw table so the component + modal can use/edit it directly
            out["ohlcvTable"] = {
                "headers": candlestick_table.get("headers", []),
                "rows": candlestick_table.get("rows", []),
            }
            # Derive ticker tag from table source or first non-date/numeric header token
            if not out.get("ticker"):
                source = str(candlestick_table.get("source") or "").strip()
                headers = [str(h) for h in candlestick_table.get("headers", []) if h]
                # Prefer source (e.g. "AAPL price data" → "AAPL"), then first header that looks like a symbol
                symbol = ""
                if source:
                    first_token = source.split()[0].upper().rstrip(".,;:")
                    if 1 <= len(first_token) <= 8 and first_token.isalpha():
                        symbol = first_token
                if not symbol and headers:
                    for h in headers:
                        tok = h.strip().upper().rstrip(".,;:")
                        if 1 <= len(tok) <= 8 and tok.isalpha() and tok not in {"DATE", "TIME", "OPEN", "HIGH", "LOW", "CLOSE", "VOL", "VOLUME", "ADJ"}:
                            symbol = tok
                            break
                if symbol:
                    out["ticker"] = symbol
        elif layout == "terminal_table":
            # If the embedded table is actually a time-series / line-chartable dataset,
            # reroute to terminal_dataviz instead of wasting it as a static table.
            _line_props = generate_chart_props_from_table_hints(
                visual_description=visual_description,
                scene_title="",
                narration="",
            )
            if _line_props.get("chartType") == "line":
                non_cs = next((t for t in tables if not is_candlestick_table(t)), None)
                if non_cs:
                    out["_reroute_to_dataviz"] = True
                    out["_dataviz_table"] = non_cs
                    return out
            items = generate_terminal_table_items(tables[0], max_items=12)
            if items:
                out["items"] = items
        else:  # terminal_dataviz
            # Use generate_chart_props_from_table_hints to get chartTable + chartType
            # from non-candlestick tables (candlestick ones belong to terminal_chart)
            planned = generate_chart_props_from_table_hints(
                visual_description=visual_description,
                scene_title="",
                narration="",
            )
            if planned and planned.get("chartTable"):
                out["chartTable"] = planned["chartTable"]
                if not out.get("chartType") and planned.get("chartType"):
                    out["chartType"] = planned["chartType"]
            elif tables:
                # Fallback: build chartTable directly from first non-candlestick table
                non_cs = next((t for t in tables if not is_candlestick_table(t)), None)
                if non_cs:
                    out["chartTable"] = {
                        "headers": non_cs.get("headers", []),
                        "rows": non_cs.get("rows", []),
                    }

        return out

    # Economist data layouts and the chart shape each one expects.
    _ECONOMIST_DATA_LAYOUTS = {"chart_line", "chart_bar", "data_table"}

    @staticmethod
    def _economist_current_dateline() -> str:
        """Today's date as an Economist-style weekly issue range, uppercase.

        e.g. on 2026-06-09 → "JUNE 7TH–13TH 2026" (the Sun–Sat week). Computed at
        generation time so the deterministic render shows a real, current date.
        """
        from datetime import date, timedelta

        def _ord(n: int) -> str:
            if 10 <= n % 100 <= 20:
                suf = "TH"
            else:
                suf = {1: "ST", 2: "ND", 3: "RD"}.get(n % 10, "TH")
            return f"{n}{suf}"

        today = date.today()
        # Week runs Sunday→Saturday (Economist cover convention).
        start = today - timedelta(days=(today.weekday() + 1) % 7)
        end = start + timedelta(days=6)
        if start.month == end.month:
            return f"{start.strftime('%B').upper()} {_ord(start.day)}–{_ord(end.day)} {end.year}"
        return (
            f"{start.strftime('%B').upper()} {_ord(start.day)} – "
            f"{end.strftime('%B').upper()} {_ord(end.day)} {end.year}"
        )

    def _merge_economist_chart_props(
        self,
        layout: str,
        props: dict,
        visual_description: str,
        scene_title: str,
        narration: str,
        scene_index: int | None = None,
    ) -> tuple[str, dict]:
        """Force the Economist chart/table layouts onto real scraped table data.

        The Economist data layouts (`chart_line`, `chart_bar`, `data_table`) all
        consume the same `chartTable={headers, rows}` contract. Like newscast's
        `data_visualization` and bloomberg's `terminal_*`, the table payload is
        bound DETERMINISTICALLY from the scraped tables here — never from the
        LLM's transcription, which can round or hallucinate figures.

        Returns the (possibly rerouted) layout and the merged props. When the
        scene was assigned a data layout but no real table is available, it falls
        back to the template's prose fallback rather than inventing numbers.
        """
        if self.template_id != "economist":
            return layout, props

        # Dateline: stamp the real current date (the LLM otherwise emits a stale
        # sample range like "MAY 23RD–29TH 2026"). The render is deterministic, so
        # the date must be fixed here at generation time, not via new Date() in the
        # component. Covers the layouts that show a dateline.
        if layout in ("cover_reveal", "section_divider"):
            out = dict(props or {})
            out["dateline"] = self._economist_current_dateline()
            props = out

        # key_indicators with no real figures (all placeholders stripped by
        # _strip_example_stats) would render an empty KPI grid — fall back to prose.
        if layout == "key_indicators":
            indicators = (props or {}).get("indicators")
            if not (isinstance(indicators, list) and len(indicators) > 0):
                logger.info(
                    "[SCENE_GEN] Scene %s: economist key_indicators has no real indicators, falling back to '%s'",
                    scene_index,
                    self._fallback_layout,
                )
                return self._fallback_layout, {}
            return layout, props

        if layout not in self._ECONOMIST_DATA_LAYOUTS:
            return layout, props

        out = dict(props or {})
        preferred_table_index = None
        if isinstance(scene_index, int):
            preferred_table_index = self._newscast_data_viz_table_by_scene.get(scene_index)

        planned = generate_chart_props_from_table_hints(
            visual_description=visual_description,
            scene_title=scene_title,
            narration=narration,
            preferred_table_index=preferred_table_index,
        )

        planned_table = planned.get("chartTable") if isinstance(planned, dict) else None
        if not (isinstance(planned_table, dict) and (planned_table.get("rows") or [])):
            # No real table for this scene — a data layout would have to fabricate
            # figures, which the Economist prompt forbids. Fall back to prose.
            logger.info(
                "[SCENE_GEN] Scene %s: economist '%s' has no scraped table, falling back to '%s'",
                scene_index,
                layout,
                self._fallback_layout,
            )
            return self._fallback_layout, {}

        # Bind the real data deterministically.
        out["chartTable"] = planned_table

        # Reroute the layout to match the data's natural shape: a time-like series
        # belongs on chart_line; a categorical ranking on chart_bar / data_table.
        planned_type = str(planned.get("chartType") or "").strip().lower()
        if planned_type == "line" and layout != "chart_line":
            layout = "chart_line"
        elif planned_type in {"bar", "histogram"} and layout == "chart_line":
            # The LLM wanted a line but the data is categorical — use a bar.
            layout = "chart_bar"

        # chart_bar carries an explicit chartType (vertical "bar" vs ranked "hbar");
        # keep the LLM's explicit pick, else default to vertical bars.
        if layout == "chart_bar" and not out.get("chartType"):
            out["chartType"] = "bar"

        return layout, out

    def _plan_newscast_data_visualization_targets(self, scenes_data: list[dict]) -> None:
        self._newscast_forced_data_viz_scenes = set()
        self._newscast_data_viz_table_by_scene = {}
        if self.template_id != "newscast" or not scenes_data:
            return

        # If the script generator already bound data_visualization scenes upstream (the preferred
        # path), trust those bindings and skip the post-hoc positional override entirely.
        upstream_bound = any(
            str(s.get("preferred_layout") or "").strip().lower() == "data_visualization"
            for s in scenes_data
        )
        if upstream_bound:
            return

        first_visual = str((scenes_data[0] or {}).get("visual_description") or "")

        # Fix 1: only count tables that actually produce chart props.
        chartable_tables = get_chartable_tables_from_visual_hint(first_visual)
        if len(chartable_tables) < 2:
            return

        target_count = min(3, len(chartable_tables))

        eligible: list[int] = []
        total = len(scenes_data)
        for i, scene in enumerate(scenes_data):
            if i == 0:
                continue
            preferred = str(scene.get("preferred_layout") or "").strip().lower()
            if preferred == "ending_socials":
                continue
            if total <= 4 and i == total - 1:
                continue
            # Fix 3: skip scenes whose visual description already signals a
            # specific non-data layout (e.g. "story stack list …").
            vis = str(scene.get("visual_description") or "")
            if _visual_hints_at_layout(vis):
                continue
            eligible.append(i)

        if not eligible:
            return

        # Spread targets across the timeline (middle-to-late content scenes).
        chosen: list[int] = []
        for slot in range(target_count):
            pos = round((slot + 1) * (len(eligible) + 1) / (target_count + 1)) - 1
            pos = max(0, min(len(eligible) - 1, pos))
            candidate = eligible[pos]
            if candidate not in chosen:
                chosen.append(candidate)

        for idx in eligible:
            if len(chosen) >= target_count:
                break
            if idx not in chosen:
                chosen.append(idx)

        chosen = sorted(chosen)[:target_count]
        for n, scene_idx in enumerate(chosen):
            self._newscast_forced_data_viz_scenes.add(scene_idx)
            orig_idx = chartable_tables[n % len(chartable_tables)][0]
            self._newscast_data_viz_table_by_scene[scene_idx] = orig_idx
            scenes_data[scene_idx]["preferred_layout"] = "data_visualization"

    def _plan_bloomberg_dataviz_targets(self, scenes_data: list[dict]) -> None:
        """Mirror of _plan_newscast_data_visualization_targets for bloomberg.

        If the LLM already chose terminal_dataviz for any scene, trust it and exit.
        Otherwise, find non-candlestick chartable tables and proactively assign
        terminal_dataviz to eligible mid-video scenes (up to 2).
        """
        if self.template_id != "bloomberg" or not scenes_data:
            return

        upstream_bound = any(
            str(s.get("preferred_layout") or "").strip().lower() == "terminal_dataviz"
            for s in scenes_data
        )
        if upstream_bound:
            return

        first_visual = str((scenes_data[0] or {}).get("visual_description") or "")
        all_tables = [t for t in _extract_tables_from_visual_hint(first_visual) if isinstance(t, dict)]
        non_cs_tables = [t for t in all_tables if not is_candlestick_table(t)]
        if not non_cs_tables:
            return

        target_count = min(2, len(non_cs_tables))

        eligible: list[int] = []
        total = len(scenes_data)
        for i, scene in enumerate(scenes_data):
            if i == 0:
                continue
            preferred = str(scene.get("preferred_layout") or "").strip().lower()
            if preferred in {"ending_socials", "terminal_boot", "terminal_chart"}:
                continue
            if total <= 4 and i == total - 1:
                continue
            eligible.append(i)

        if not eligible:
            return

        chosen: list[int] = []
        for slot in range(target_count):
            pos = round((slot + 1) * (len(eligible) + 1) / (target_count + 1)) - 1
            pos = max(0, min(len(eligible) - 1, pos))
            candidate = eligible[pos]
            if candidate not in chosen:
                chosen.append(candidate)

        chosen = sorted(chosen)[:target_count]
        for scene_idx in chosen:
            scenes_data[scene_idx]["preferred_layout"] = "terminal_dataviz"

    def _validate_props(self, layout: str, props: dict) -> dict:
        """Validate props against layout schema in meta. If no schema, pass through."""
        layout_meta = (self._meta or {}).get("layout_prop_schema", {}).get(layout, {})
        fields = layout_meta.get("fields", [])
        if not fields:
            return props
        # Build a quick type-lookup from the fields list
        field_types = {f["key"]: f.get("type", "string") for f in fields if isinstance(f, dict) and "key" in f}
        validated = {}
        for key, value in props.items():
            if key not in field_types:
                # Pass through unknown keys (color, imageUrl, etc. not in fields)
                validated[key] = value
                continue
            expected_type = field_types[key]
            if expected_type in ("string", "text") and isinstance(value, str):
                validated[key] = value
            elif expected_type == "number" and isinstance(value, (int, float)):
                validated[key] = value
            elif expected_type == "boolean" and isinstance(value, bool):
                validated[key] = value
            elif expected_type in ("array", "string_array") and isinstance(value, list):
                validated[key] = value
            elif expected_type == "object" and isinstance(value, dict):
                validated[key] = value
            elif expected_type == "object_array" and isinstance(value, list):
                validated[key] = value
            else:
                # Type mismatch — pass through anyway rather than silently drop
                validated[key] = value
        return validated

    # Values that indicate the LLM copied example data instead of extracting from the article.
    _LADUC_EXAMPLE_STAT_VALUES = frozenset({
        "$251b", "$112b", "$48b", "$36b",
        "total flows", "401(k) flows", "vol-control", "cta trend",
        "401(k) inflows running 12th strongest month on record",
        "vol-control funds near full re-allocation after april reset",
        "cta trend signal still long — reversal requires -3.2% weekly close",
        "flows", "positioning", "cta",
    })

    # Economist key_indicators sample labels (from templates/economist/meta.json).
    # When a generated scene carries these, the LLM kept the placeholders instead
    # of extracting real figures from the source.
    _ECONOMIST_KPI_EXAMPLE_LABELS = frozenset({
        "core inflation", "unemployment", "budget deficit", "gdp growth",
    })

    def _strip_example_stats(self, layout: str, props: dict) -> dict:
        """Remove stats that are clearly copied from prompt examples rather than from the article."""
        if layout == "key_indicators" and self.template_id == "economist":
            indicators = props.get("indicators")
            if isinstance(indicators, list) and indicators:
                clean = [
                    it for it in indicators
                    if isinstance(it, dict)
                    and str(it.get("label", "")).strip().lower() not in self._ECONOMIST_KPI_EXAMPLE_LABELS
                ]
                if len(clean) != len(indicators):
                    logger.info(
                        "[SCENE_GEN] Stripped %d placeholder economist indicators",
                        len(indicators) - len(clean),
                    )
                if not clean:
                    out = dict(props)
                    out.pop("indicators", None)
                    return out
                return {**props, "indicators": clean}
            return props
        if layout not in ("data_impact", "deep_dive"):
            return props
        stats = props.get("stats")
        if not isinstance(stats, list) or not stats:
            return props
        clean = [
            s for s in stats
            if isinstance(s, dict)
            and str(s.get("value", "")).strip().lower() not in self._LADUC_EXAMPLE_STAT_VALUES
            and str(s.get("label", "")).strip().lower() not in self._LADUC_EXAMPLE_STAT_VALUES
            and str(s.get("value", "")).strip() not in ("[HERO NUMBER FROM ARTICLE]", "[SUPPORTING NUMBER]", "")
        ]
        if len(clean) != len(stats):
            logger.info("[SCENE_GEN] Stripped %d example stats from %s layoutProps", len(stats) - len(clean), layout)
        if not clean:
            out = dict(props)
            del out["stats"]
            return out
        return {**props, "stats": clean}

    def _parse_config_json(self, config_str: str) -> dict:
        try:
            raw = config_str.strip()
            if raw.startswith("```"):
                lines = raw.split("\n")[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw = "\n".join(lines)
            config = json.loads(raw)
            return config if isinstance(config, dict) else {}
        except (json.JSONDecodeError, TypeError) as e:
            if self.debug:
                logger.warning(
                    "[SCENE_GEN] JSON parse error: %s | Raw: %s",
                    e,
                    config_str[:200],
                )
            return {}

    @staticmethod
    def _extract_structured_content(layout_config: dict) -> dict:
        """Extract structured content from layout_config elements for scene props.

        Maps element types (card-grid, metric-row, quote, etc.) to flat structured
        fields that AI-generated scene components can render.
        """
        elements = layout_config.get("elements", [])
        if not isinstance(elements, list):
            return {"contentType": "plain"}

        el_types = {el.get("type") for el in elements if isinstance(el, dict)}

        # Priority order: most specific content type wins
        for el in elements:
            if not isinstance(el, dict):
                continue
            el_type = el.get("type", "")
            content = el.get("content", {}) if isinstance(el.get("content"), dict) else {}

            if el_type == "metric-row":
                items = content.get("items", [])
                if isinstance(items, list) and items:
                    metrics = []
                    for item in items:
                        if isinstance(item, dict):
                            metrics.append({
                                "value": str(item.get("value", "")),
                                "label": str(item.get("label", "")),
                                "suffix": str(item.get("suffix", "")) if item.get("suffix") else None,
                            })
                    if metrics:
                        return {"contentType": "metrics", "metrics": metrics}

            if el_type == "code-block":
                lines = content.get("codeLines", []) or content.get("lines", [])
                if isinstance(lines, list) and lines:
                    return {
                        "contentType": "code",
                        "codeLines": [str(line) for line in lines],
                        "codeLanguage": str(content.get("codeLanguage", "") or content.get("language", "")) or None,
                    }

            if el_type == "comparison":
                items = content.get("items", [])
                if isinstance(items, list) and len(items) >= 2:
                    return {
                        "contentType": "comparison",
                        "comparisonLeft": {
                            "label": str(items[0].get("label", "")),
                            "description": str(items[0].get("description", "")),
                        },
                        "comparisonRight": {
                            "label": str(items[1].get("label", "")),
                            "description": str(items[1].get("description", "")),
                        },
                    }

            if el_type == "quote":
                text = content.get("quote", "") or content.get("text", "")
                if text:
                    return {
                        "contentType": "quote",
                        "quote": str(text),
                        "quoteAuthor": str(content.get("author", "")) or None,
                    }

            if el_type == "timeline":
                items = content.get("items", [])
                if isinstance(items, list) and items:
                    timeline_items = []
                    for item in items:
                        if isinstance(item, dict):
                            timeline_items.append({
                                "label": str(item.get("label", "")),
                                "description": str(item.get("description", "")),
                            })
                    if timeline_items:
                        return {"contentType": "timeline", "timelineItems": timeline_items}

            if el_type == "steps":
                items = content.get("items", [])
                if isinstance(items, list) and items:
                    step_texts = []
                    for s in items:
                        if isinstance(s, dict):
                            text = s.get("text") or s.get("label") or s.get("title", "")
                            desc = s.get("description", "")
                            # Combine text + description so the component has full context
                            step_texts.append(f"{text}: {desc}" if desc else str(text))
                        elif isinstance(s, str):
                            step_texts.append(s)
                    if step_texts:
                        return {"contentType": "steps", "steps": step_texts}

            if el_type in ("card-grid", "icon-text"):
                items = content.get("items", [])
                if isinstance(items, list) and items:
                    bullets = []
                    for item in items:
                        if isinstance(item, dict):
                            text = item.get("text") or item.get("label") or item.get("title", "")
                            if text:
                                bullets.append(str(text))
                        elif isinstance(item, str):
                            bullets.append(item)
                    if bullets:
                        return {"contentType": "bullets", "bullets": bullets}

        return {"contentType": "plain"}

    def _validate_config(self, config: dict) -> dict:
        fallback_arr = getattr(self, "_fallback_arrangement", "top-bottom")
        arrangement = config.get("arrangement", fallback_arr)
        if arrangement not in VALID_ARRANGEMENTS:
            arrangement = fallback_arr

        elements = config.get("elements", [])
        if not isinstance(elements, list):
            elements = []

        valid_elements = [el for el in elements if isinstance(el, dict) and el.get("type") in VALID_ELEMENT_TYPES]
        if not valid_elements:
            valid_elements = [{"type": "heading", "content": {}, "emphasis": "primary"}]

        decorations = config.get("decorations", ["accent-bar-bottom"])
        if not isinstance(decorations, list):
            decorations = ["accent-bar-bottom"]

        background = config.get("background")
        if background and not isinstance(background, dict):
            background = None

        return {
            "arrangement": arrangement,
            "elements": valid_elements,
            "decorations": decorations,
            **({"background": background} if background else {}),
        }

    async def generate_scene_descriptor(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
        scene_index: int,
        total_scenes: int = 10,
        max_retries: int = 2,
        preferred_layout: str | None = None,
        content_language: str = "English",
    ) -> dict:
        if not self._is_custom:
            return await self._generate_old_descriptor(
                scene_title, narration, visual_description,
                scene_index, total_scenes, max_retries, preferred_layout, content_language,
            )

        logger.info(
            "[SCENE_GEN] generate_scene_descriptor: scene=%s/%s, title='%s', preferred_layout=%s",
            scene_index,
            total_scenes,
            scene_title[:50],
            preferred_layout,
        )

        # Scene 0 still prefers full-center but the AI chooses elements, decorations, and background
        if scene_index == 0 and not preferred_layout:
            preferred_layout = "full-center"  # hint, not forced

        preferred_arr = None
        if preferred_layout:
            n = preferred_layout.strip().lower()
            if n in VALID_ARRANGEMENTS:
                preferred_arr = n

        previous = self.variety_tracker.get_previous_arrangements()
        underused = self.variety_tracker.get_underused_arrangements()
        logger.debug(
            "[SCENE_GEN] previous=%s, underused=%s, preferred_arr=%s",
            previous,
            underused,
            preferred_arr,
        )

        best_result = None
        best_score = -1

        for attempt in range(max_retries + 1):
            try:
                result = await self.descriptor(
                    template_prompt=self._prompt,
                    scene_title=scene_title,
                    narration=narration,
                    visual_description=visual_description,
                    scene_index=scene_index,
                    total_scenes=total_scenes,
                    previous_arrangements=previous,
                    underused_arrangements=underused,
                    preferred_arrangement=preferred_arr or "",
                    content_language=(content_language or "English").strip(),
                )

                config = self._parse_config_json(result.layout_config_json)
                if not config:
                    logger.warning(
                        "[SCENE_GEN] Attempt %s: JSON parse returned empty config",
                        attempt + 1,
                    )
                    continue

                if preferred_arr:
                    config["arrangement"] = preferred_arr

                validated = self._validate_config(config)
                el_types = [e.get("type") for e in validated.get("elements", [])]
                logger.info(
                    "[SCENE_GEN] Attempt %s: arrangement=%s, elements=%s, decorations=%s",
                    attempt + 1,
                    validated["arrangement"],
                    el_types,
                    validated.get("decorations"),
                )

                score = 0.5
                if len(validated.get("elements", [])) > 1:
                    score += 0.3
                if not self.variety_tracker.is_repetitive(validated["arrangement"]):
                    score += 0.2

                if score > best_score:
                    best_score = score
                    best_result = validated

                if score >= 0.9:
                    break

            except Exception as e:
                if self.debug:
                    logger.warning(
                        "[SCENE_GEN] Error in attempt %s: %s",
                        attempt + 1,
                        e,
                    )
                continue

        if best_result:
            self.variety_tracker.record(best_result["arrangement"])
            logger.info(
                "[SCENE_GEN] Scene %s FINAL: arrangement=%s, score=%.1f, elements=%s",
                scene_index,
                best_result["arrangement"],
                best_score,
                len(best_result.get("elements", [])),
            )
            structured = self._extract_structured_content(best_result)
            return {"layoutConfig": best_result, "structuredContent": structured}

        logger.warning(
            "[SCENE_GEN] Scene %s FALLBACK: all attempts failed, using %s",
            scene_index,
            self._fallback_arrangement,
        )
        fallback = {
            "arrangement": self._fallback_arrangement,
            "elements": [
                {"type": "heading", "content": {"text": scene_title}, "emphasis": "primary"},
                {"type": "body-text", "content": {"text": narration[:200] if narration else ""}, "emphasis": "secondary"},
            ],
            "decorations": ["accent-bar-bottom"],
        }
        self.variety_tracker.record(self._fallback_arrangement)
        return {"layoutConfig": fallback, "structuredContent": {"contentType": "plain"}}

    async def generate_regenerate_descriptor(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
        scene_index: int,
        total_scenes: int,
        other_scenes_layouts: str,
        preferred_layout: str | None = None,
        current_descriptor: dict | None = None,
        content_language: str = "English",
    ) -> dict:
        logger.info(
            "[SCENE_GEN] regenerate: scene=%s, preferred_layout=%s, has_current=%s",
            scene_index,
            preferred_layout,
            current_descriptor is not None,
        )

        if not self._is_custom:
            return await self._regenerate_old_descriptor(
                scene_title, narration, visual_description,
                scene_index, total_scenes, other_scenes_layouts,
                preferred_layout, current_descriptor, content_language,
            )

        # Scene 0 still prefers full-center but the AI chooses elements, decorations, and background
        if scene_index == 0 and not preferred_layout:
            preferred_layout = "full-center"  # hint, not forced

        preferred_arr = None
        if preferred_layout:
            n = preferred_layout.strip().lower()
            if n in VALID_ARRANGEMENTS:
                preferred_arr = n

        current_str = json.dumps(current_descriptor) if current_descriptor else ""

        try:
            result = await self.regenerate_descriptor(
                template_prompt=self._prompt,
                scene_title=scene_title,
                narration=narration,
                visual_description=visual_description,
                scene_index=scene_index,
                total_scenes=total_scenes,
                other_scenes_arrangements=other_scenes_layouts or "(none yet)",
                preferred_arrangement=preferred_arr or "",
                current_descriptor=current_str,
                content_language=(content_language or "English").strip(),
            )
        except Exception as e:
            if self.debug:
                logger.warning("[SCENE_GEN] [Regenerate] DSPy error: %s", e)
            err_config = {
                "arrangement": preferred_arr or self._fallback_arrangement,
                "elements": [
                    {"type": "heading", "content": {"text": scene_title}},
                    {"type": "body-text", "content": {"text": narration[:200] if narration else ""}},
                ],
                "decorations": ["accent-bar-bottom"],
            }
            return {"layoutConfig": err_config, "structuredContent": {"contentType": "plain"}}

        config = self._parse_config_json(result.layout_config_json)
        if preferred_arr:
            config["arrangement"] = preferred_arr
        validated = self._validate_config(config)
        el_types = [e.get("type") for e in validated.get("elements", [])]
        logger.info(
            "[SCENE_GEN] Regenerate result: arrangement=%s, elements=%s",
            validated["arrangement"],
            el_types,
        )
        structured = self._extract_structured_content(validated)
        return {"layoutConfig": validated, "structuredContent": structured}

    async def generate_all_scenes(
        self,
        scenes_data: list[dict],
        available_images: list[str] | None = None,
        accent_color: str = "#7C3AED",
        bg_color: str = "#FFFFFF",
        text_color: str = "#000000",
        animation_instructions: str = "",
        content_language: str = "English",
    ) -> list[dict]:
        """Generate scene descriptors in batches of BATCH_SIZE for concurrency.

        Within each batch scenes share the same variety tracker state and run
        concurrently via asyncio.gather.  Between batches the tracker updates
        so subsequent batches get accurate variety hints.
        """
        import asyncio as _aio

        BATCH_SIZE = 4
        total = len(scenes_data)

        if self._is_custom:
            self.variety_tracker = ArrangementVarietyTracker(
                self._valid_arrangements, self._hero_arrangement,
            )

        # Built-in templates: run template-specific table targeting as a fallback.
        # For newscast this may force data_visualization scenes; for bloomberg the
        # upstream binding (pipeline._generate_script) is preferred — these methods
        # guard against the LLM ignoring chartable_tables_json entirely.
        if not self._is_custom:
            self._plan_newscast_data_visualization_targets(scenes_data)
            self._plan_bloomberg_dataviz_targets(scenes_data)

        # Laduc / FJ Market Brief / fj_research: populate
        # _newscast_data_viz_table_by_scene from data_table_index set by
        # ScriptGenerator (via chartable_tables_json upfront binding). This lets
        # _merge_laduc_chart_props use the correct pre-bound table index instead of
        # re-scoring all tables on every market_annotation scene call.
        if (
            "laduc" in self.template_id
            or "fj_research" in self.template_id
            or self.template_id in {"fj_market_brief", "crafted_fj_market_brief_bundle"}
        ):
            for i, scene in enumerate(scenes_data):
                pl = str(scene.get("preferred_layout") or "").strip().lower()
                if (
                    (pl.startswith("market_annotation") or pl == "ticker")
                    and isinstance(scene.get("data_table_index"), int)
                ):
                    self._newscast_data_viz_table_by_scene[i] = scene["data_table_index"]

        results: list[dict] = [{}] * total

        for batch_start in range(0, total, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, total)
            batch_indices = list(range(batch_start, batch_end))

            tasks = [
                self.generate_scene_descriptor(
                    scene_title=scenes_data[i]["title"],
                    narration=scenes_data[i]["narration"],
                    visual_description=scenes_data[i]["visual_description"],
                    scene_index=i,
                    total_scenes=total,
                    preferred_layout=scenes_data[i].get("preferred_layout"),
                    content_language=content_language,
                )
                for i in batch_indices
            ]

            batch_results = await _aio.gather(*tasks, return_exceptions=True)

            for idx, (i, res) in enumerate(zip(batch_indices, batch_results)):
                if isinstance(res, Exception):
                    logger.warning("[SCENE_GEN] Scene %s failed: %s, using fallback", i, res)
                    res = {"layoutConfig": {
                        "arrangement": "top-bottom",
                        "elements": [
                            {"type": "heading", "content": {"text": scenes_data[i]["title"]}, "emphasis": "primary"},
                        ],
                        "decorations": ["accent-bar-bottom"],
                    }, "structuredContent": {"contentType": "plain"}}
                results[i] = res

                if self.debug:
                    lc = res.get("layoutConfig", {})
                    arr = lc.get("arrangement", res.get("layout", "?"))
                    logger.debug(
                        "[SCENE_GEN] Scene %s: %s | History: %s",
                        i,
                        arr,
                        self.variety_tracker.get_previous_arrangements(),
                    )

        if self.debug:
            logger.debug("[SCENE_GEN] Distribution:")
            for arr, count in self.variety_tracker.usage_count.most_common():
                logger.debug("   %s: %s", arr, count)

        return results

    # ─── Legacy support for built-in templates ───

    async def _generate_old_descriptor(self, scene_title, narration, visual_description, scene_index, total_scenes, max_retries, preferred_layout, content_language):
        """Old-style descriptor for built-in templates (layout + layoutProps from catalog)."""
        if scene_index == 0 and not preferred_layout:
            self.variety_tracker.record(self._hero_layout)
            return {"layout": self._hero_layout, "layoutProps": {}}

        previous_layouts = self.variety_tracker.get_previous_arrangements()
        underused_layouts = self.variety_tracker.get_underused_arrangements()

        normalized_preferred = None
        if preferred_layout:
            normalized_preferred = preferred_layout.strip().lower().replace(" ", "_").replace("-", "_")
            if normalized_preferred not in self._valid_layouts:
                normalized_preferred = None
        if (
            not normalized_preferred
            and scene_index in self._newscast_forced_data_viz_scenes
            and "data_visualization" in self._valid_layouts
        ):
            normalized_preferred = "data_visualization"

        for attempt in range(max_retries + 1):
            try:
                result = await self.builtin_descriptor(
                    template_prompt=self._prompt,
                    scene_title=scene_title,
                    narration=narration,
                    visual_description=visual_description,
                    scene_index=scene_index,
                    total_scenes=total_scenes,
                    previous_layouts=previous_layouts,
                    underused_layouts=underused_layouts,
                    preferred_layout=normalized_preferred or "",
                    content_language=(content_language or "English").strip(),
                )

                layout = result.layout.strip().lower().replace(" ", "_").replace("-", "_")
                # Enforce script-stage layout plan when provided and valid.
                if normalized_preferred:
                    layout = normalized_preferred
                if layout not in self._valid_layouts:
                    if normalized_preferred:
                        layout = normalized_preferred
                    else:
                        if self.debug:
                            logger.debug(
                                "[SCENE_GEN] Invalid layout '%s' (attempt %s)",
                                layout,
                                attempt + 1,
                            )
                        continue

                props = self._parse_props_json(result.layout_props_json)
                validated_props = self._validate_props(layout, props)
                validated_props = self._strip_example_stats(layout, validated_props)
                validated_props = self._merge_chart_planner_props(
                    layout=layout,
                    props=validated_props,
                    visual_description=visual_description,
                    scene_title=scene_title,
                    narration=narration,
                    scene_index=scene_index,
                )
                validated_props = self._merge_bloomberg_table_props(
                    layout=layout,
                    props=validated_props,
                    visual_description=visual_description,
                )
                validated_props = await self._merge_laduc_chart_props(
                    layout=layout,
                    props=validated_props,
                    visual_description=visual_description,
                    scene_title=scene_title,
                    narration=narration,
                    scene_index=scene_index,
                )
                layout, validated_props = self._merge_economist_chart_props(
                    layout=layout,
                    props=validated_props,
                    visual_description=visual_description,
                    scene_title=scene_title,
                    narration=narration,
                    scene_index=scene_index,
                )

                # Guard: reroute to terminal_dataviz when the table is line-chartable
                # (set by terminal_chart with no OHLCV, or terminal_table with time-series data).
                if validated_props.pop("_reroute_to_dataviz", False):
                    non_cs = validated_props.pop("_dataviz_table", None)
                    if "terminal_dataviz" in self._valid_layouts and non_cs:
                        prev_layout = layout
                        layout = "terminal_dataviz"
                        validated_props = {
                            "chartTable": {
                                "headers": non_cs.get("headers", []),
                                "rows": non_cs.get("rows", []),
                            },
                            "chartType": "line",
                        }
                        logger.info(
                            "[SCENE_GEN] Scene %s: '%s' rerouted to terminal_dataviz (line chart)",
                            scene_index,
                            prev_layout,
                        )
                    else:
                        layout = self._fallback_layout
                        validated_props = {}
                        logger.info(
                            "[SCENE_GEN] Scene %s: reroute to terminal_dataviz failed (no valid_layouts match), falling back to '%s'",
                            scene_index,
                            layout,
                        )
                elif validated_props.pop("_invalid_layout", False):
                    # No table data at all — fall back to generic layout
                    layout = self._fallback_layout
                    validated_props = {}
                    logger.info(
                        "[SCENE_GEN] Scene %s: terminal_chart rejected (no data), falling back to '%s'",
                        scene_index,
                        layout,
                    )

                chart_table = validated_props.get("chartTable") if isinstance(validated_props, dict) else None
                chart_rows = chart_table.get("rows") if isinstance(chart_table, dict) else None
                has_chart_table = (
                    isinstance(chart_rows, list)
                    and any(isinstance(r, list) and any(str(c or "").strip() for c in r) for r in chart_rows)
                )

                # Fix 4: if a forced data_visualization scene ended up with no
                # chart table data, fall back to the LLM's original pick or the
                # template fallback so we don't render an empty chart.
                if (
                    layout == "data_visualization"
                    and scene_index in self._newscast_forced_data_viz_scenes
                    and not has_chart_table
                ):
                    llm_layout = result.layout.strip().lower().replace(" ", "_").replace("-", "_")
                    if llm_layout in self._valid_layouts and llm_layout != "data_visualization":
                        layout = llm_layout
                    else:
                        layout = self._fallback_layout
                    logger.info(
                        "[SCENE_GEN] Scene %s: data_visualization had no chart data, falling back to '%s'",
                        scene_index,
                        layout,
                    )

                # terminal_dataviz guard: if we ended up here with no chartTable,
                # fall back to the template fallback to avoid rendering an empty chart.
                if layout == "terminal_dataviz" and not has_chart_table:
                    layout = self._fallback_layout
                    validated_props = {}
                    logger.info(
                        "[SCENE_GEN] Scene %s: terminal_dataviz had no chartTable, falling back to '%s'",
                        scene_index,
                        layout,
                    )

                # market_annotation guard: AI picked chart layout but no real table data
                # was extractable — fall back rather than render an empty chart area.
                if layout == "market_annotation" and not has_chart_table:
                    llm_layout = result.layout.strip().lower().replace(" ", "_").replace("-", "_")
                    layout = (
                        llm_layout
                        if llm_layout in self._valid_layouts and llm_layout != "market_annotation"
                        else self._fallback_layout
                    )
                    validated_props = {}
                    logger.info(
                        "[SCENE_GEN] Scene %s: market_annotation had no chart data, falling back to '%s'",
                        scene_index,
                        layout,
                    )

                self.variety_tracker.record(layout)
                return {"layout": layout, "layoutProps": validated_props}
            except Exception as e:
                if self.debug:
                    logger.warning("[SCENE_GEN] Error in built-in descriptor: %s", e)
                continue

        self.variety_tracker.record(self._fallback_layout)
        return {"layout": self._fallback_layout, "layoutProps": {}}

    async def _regenerate_old_descriptor(self, scene_title, narration, visual_description, scene_index, total_scenes, other_scenes_layouts, preferred_layout, current_descriptor, content_language):
        """Old-style regeneration for built-in templates (layout + layoutProps from catalog)."""
        if scene_index == 0 and not preferred_layout:
            return {"layout": self._hero_layout, "layoutProps": {}}

        normalized = None
        if preferred_layout:
            normalized = preferred_layout.strip().lower().replace(" ", "_").replace("-", "_")
            if normalized not in self._valid_layouts:
                normalized = None

        current_str = json.dumps(current_descriptor) if current_descriptor else ""

        try:
            result = await self.builtin_regenerate_descriptor(
                template_prompt=self._prompt,
                scene_title=scene_title,
                narration=narration,
                visual_description=visual_description,
                scene_index=scene_index,
                total_scenes=total_scenes,
                other_scenes_layouts=other_scenes_layouts or "(none yet)",
                preferred_layout=normalized or "",
                current_descriptor=current_str,
                content_language=(content_language or "English").strip(),
            )
        except Exception as e:
            if self.debug:
                logger.warning("[SCENE_GEN] [Regenerate old] DSPy error: %s", e)
            return {"layout": normalized or self._fallback_layout, "layoutProps": {}}

        layout = result.layout.strip().lower().replace(" ", "_").replace("-", "_")
        if normalized:
            layout = normalized
        if layout not in self._valid_layouts:
            layout = normalized or self._fallback_layout

        props = self._parse_props_json(result.layout_props_json)
        validated_props = self._validate_props(layout, props)
        validated_props = self._strip_example_stats(layout, validated_props)
        validated_props = self._merge_chart_planner_props(
            layout=layout,
            props=validated_props,
            visual_description=visual_description,
            scene_title=scene_title,
            narration=narration,
            scene_index=scene_index,
        )
        validated_props = self._merge_bloomberg_table_props(
            layout=layout,
            props=validated_props,
            visual_description=visual_description,
        )
        layout, validated_props = self._merge_economist_chart_props(
            layout=layout,
            props=validated_props,
            visual_description=visual_description,
            scene_title=scene_title,
            narration=narration,
            scene_index=scene_index,
        )

        # Guard: reroute to terminal_dataviz when the table is line-chartable.
        if validated_props.pop("_reroute_to_dataviz", False):
            non_cs = validated_props.pop("_dataviz_table", None)
            if "terminal_dataviz" in self._valid_layouts and non_cs:
                layout = "terminal_dataviz"
                validated_props = {
                    "chartTable": {
                        "headers": non_cs.get("headers", []),
                        "rows": non_cs.get("rows", []),
                    },
                    "chartType": "line",
                }
                logger.info(
                    "[SCENE_GEN] Regenerate: terminal_chart has no OHLCV, rerouted to terminal_dataviz (line chart)",
                )
            else:
                layout = normalized or self._fallback_layout
                validated_props = {}
                logger.info(
                    "[SCENE_GEN] Regenerate: terminal_chart rejected (no OHLCV, no dataviz), falling back to '%s'",
                    layout,
                )
        elif validated_props.pop("_invalid_layout", False):
            layout = normalized or self._fallback_layout
            validated_props = {}
            logger.info(
                "[SCENE_GEN] Regenerate: terminal_chart rejected (no data), falling back to '%s'",
                layout,
            )

        chart_table = validated_props.get("chartTable") if isinstance(validated_props, dict) else None
        chart_rows = chart_table.get("rows") if isinstance(chart_table, dict) else None
        has_chart_table = (
            isinstance(chart_rows, list)
            and any(isinstance(r, list) and any(str(c or "").strip() for c in r) for r in chart_rows)
        )

        # Fix 4: empty chart safety net (same as _generate_old_descriptor).
        if layout == "data_visualization" and not has_chart_table:
            llm_layout = result.layout.strip().lower().replace(" ", "_").replace("-", "_")
            if llm_layout in self._valid_layouts and llm_layout != "data_visualization":
                layout = llm_layout
            else:
                layout = self._fallback_layout
            logger.info(
                "[SCENE_GEN] Regenerate scene %s: data_visualization had no chart data, falling back to '%s'",
                scene_index,
                layout,
            )

        # terminal_dataviz guard: same as above for bloomberg.
        if layout == "terminal_dataviz" and not has_chart_table:
            layout = self._fallback_layout
            validated_props = {}
            logger.info(
                "[SCENE_GEN] Regenerate scene %s: terminal_dataviz had no chartTable, falling back to '%s'",
                scene_index,
                layout,
            )

        return {"layout": layout, "layoutProps": validated_props}
