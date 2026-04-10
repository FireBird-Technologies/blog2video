import json
import dspy
from collections import Counter

from app.dspy_modules import ensure_dspy_configured
from app.services.chart_planner import (
    get_chartable_tables_from_visual_hint,
    generate_chart_props_from_table_hints,
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
            self._descriptor = dspy.ChainOfThought(TemplateSceneToDescriptor)
            self.descriptor = dspy.asyncify(self._descriptor)
            self._regenerate_descriptor = dspy.ChainOfThought(RegenerateSceneToDescriptor)
            self.regenerate_descriptor = dspy.asyncify(self._regenerate_descriptor)
            self.builtin_descriptor = None
            self.builtin_regenerate_descriptor = None
        else:
            self._builtin_descriptor = dspy.ChainOfThought(BuiltInTemplateSceneToDescriptor)
            self.builtin_descriptor = dspy.asyncify(self._builtin_descriptor)
            self._builtin_regenerate_descriptor = dspy.ChainOfThought(BuiltInRegenerateSceneToDescriptor)
            self.builtin_regenerate_descriptor = dspy.asyncify(self._builtin_regenerate_descriptor)
            self._descriptor = self.descriptor = None
            self._regenerate_descriptor = self.regenerate_descriptor = None

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
            return props

        out = dict(props or {})
        chart_keys = {
            "chartType",
            "chartTable",
            "lineChartLabels",
            "lineChartDatasets",
            "barChartRows",
            "histogramRows",
            "marketSymbol",
            "marketValue",
            "marketDelta",
            "marketPercent",
            "marketTrend",
        }

        # If LLM did not produce usable chart payload, adopt planner output fully.
        has_existing_series = bool(
            out.get("lineChartDatasets") or out.get("barChartRows") or out.get("histogramRows")
        )
        if not has_existing_series:
            for k, v in planned.items():
                out[k] = v
            return out

        # Planner output is deterministic from extracted table hints, while model
        # output may include noisy numeric hallucinations from mixed text cells.
        # Prefer planner chart payload when available.
        for k, v in planned.items():
            if k in chart_keys:
                out[k] = v

        return out

    def _plan_newscast_data_visualization_targets(self, scenes_data: list[dict]) -> None:
        self._newscast_forced_data_viz_scenes = set()
        self._newscast_data_viz_table_by_scene = {}
        if self.template_id != "newscast" or not scenes_data:
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

    def _validate_props(self, layout: str, props: dict) -> dict:
        """Validate props against layout schema in meta. If no schema, pass through."""
        layout_meta = (self._meta or {}).get("layouts", {}).get(layout, {})
        prop_schema = layout_meta.get("props", {})
        if not prop_schema:
            return props
        validated = {}
        for key, value in props.items():
            if key not in prop_schema:
                continue
            schema = prop_schema[key]
            expected_type = schema.get("type", "string")
            if expected_type == "string" and isinstance(value, str):
                validated[key] = value
            elif expected_type == "number" and isinstance(value, (int, float)):
                validated[key] = value
            elif expected_type == "boolean" and isinstance(value, bool):
                validated[key] = value
            elif expected_type == "array" and isinstance(value, list):
                validated[key] = value
            elif expected_type == "object" and isinstance(value, dict):
                validated[key] = value
        return validated

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

        # Built-in newscast only: when multiple tables are present in hints, force
        # 2-3 scenes toward data_visualization and rotate table sources.
        if not self._is_custom:
            self._plan_newscast_data_visualization_targets(scenes_data)

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
                validated_props = self._merge_chart_planner_props(
                    layout=layout,
                    props=validated_props,
                    visual_description=visual_description,
                    scene_title=scene_title,
                    narration=narration,
                    scene_index=scene_index,
                )

                # Fix 4: if a forced data_visualization scene ended up with no
                # chart series, fall back to the LLM's original pick or the
                # template fallback so we don't render an empty chart.
                if (
                    layout == "data_visualization"
                    and scene_index in self._newscast_forced_data_viz_scenes
                    and not validated_props.get("lineChartDatasets")
                    and not validated_props.get("barChartRows")
                    and not validated_props.get("histogramRows")
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
        validated_props = self._merge_chart_planner_props(
            layout=layout,
            props=validated_props,
            visual_description=visual_description,
            scene_title=scene_title,
            narration=narration,
            scene_index=scene_index,
        )

        # Fix 4: empty chart safety net (same as _generate_old_descriptor).
        if (
            layout == "data_visualization"
            and not validated_props.get("lineChartDatasets")
            and not validated_props.get("barChartRows")
            and not validated_props.get("histogramRows")
        ):
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

        return {"layout": layout, "layoutProps": validated_props}
