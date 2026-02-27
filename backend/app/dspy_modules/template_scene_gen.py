import json
import dspy
from collections import Counter

from app.dspy_modules import ensure_dspy_configured
from app.services.template_service import (
    get_prompt,
    get_meta,
    get_valid_layouts,
    get_hero_layout,
    get_fallback_layout,
)

# Valid arrangements for the universal layout engine
VALID_ARRANGEMENTS = {
    "full-center", "split-left", "split-right", "top-bottom",
    "grid-2x2", "grid-3", "asymmetric-left", "asymmetric-right", "stacked",
}

VALID_ELEMENT_TYPES = {
    "heading", "body-text", "card-grid", "code-block", "metric-row",
    "image", "quote", "timeline", "steps", "icon-text",
}


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

        print(f"[SCENE_GEN] Init template={template_id}, is_custom={self._is_custom}, debug={debug}")

        if self._is_custom:
            self._valid_arrangements = self._meta.get("valid_arrangements", list(VALID_ARRANGEMENTS))
            self._hero_arrangement = self._meta.get("hero_arrangement", "full-center")
            self._fallback_arrangement = self._meta.get("fallback_arrangement", "top-bottom")
            print(f"[SCENE_GEN] Custom: arrangements={self._valid_arrangements}, hero={self._hero_arrangement}, fallback={self._fallback_arrangement}")
            print(f"[SCENE_GEN] Custom meta keys: {list(self._meta.keys())}")
        else:
            self._valid_layouts = get_valid_layouts(template_id)
            self._hero_layout = get_hero_layout(template_id)
            self._fallback_layout = get_fallback_layout(template_id)

        self._descriptor = dspy.ChainOfThought(TemplateSceneToDescriptor)
        self.descriptor = dspy.asyncify(self._descriptor)
        self._regenerate_descriptor = dspy.ChainOfThought(RegenerateSceneToDescriptor)
        self.regenerate_descriptor = dspy.asyncify(self._regenerate_descriptor)

        if self._is_custom:
            self.variety_tracker = ArrangementVarietyTracker(
                self._valid_arrangements, self._hero_arrangement,
            )
        else:
            self.variety_tracker = ArrangementVarietyTracker(
                get_valid_layouts(template_id), get_hero_layout(template_id),
            )

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
                print(f"⚠️  JSON parse error: {e}\n   Raw: {config_str[:200]}")
            return {}

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
    ) -> dict:
        if not self._is_custom:
            return await self._generate_old_descriptor(
                scene_title, narration, visual_description,
                scene_index, total_scenes, max_retries, preferred_layout,
            )

        print(f"[SCENE_GEN] generate_scene_descriptor: scene={scene_index}/{total_scenes}, title='{scene_title[:50]}', preferred_layout={preferred_layout}")

        # Scene 0 hero
        if scene_index == 0 and not preferred_layout:
            hero_config = {
                "arrangement": "full-center",
                "elements": [
                    {"type": "heading", "content": {"text": scene_title}, "emphasis": "primary"},
                    {"type": "body-text", "content": {"text": narration[:200] if narration else ""}, "emphasis": "subtle"},
                ],
                "background": {"type": "gradient", "gradientAngle": 135},
                "decorations": ["gradient-orb", "accent-bar-bottom"],
            }
            self.variety_tracker.record("full-center")
            print(f"[SCENE_GEN] Scene 0 → hero (full-center)")
            return {"layoutConfig": hero_config}

        preferred_arr = None
        if preferred_layout:
            n = preferred_layout.strip().lower()
            if n in VALID_ARRANGEMENTS:
                preferred_arr = n

        previous = self.variety_tracker.get_previous_arrangements()
        underused = self.variety_tracker.get_underused_arrangements()
        print(f"[SCENE_GEN] previous={previous}, underused={underused}, preferred_arr={preferred_arr}")

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
                )

                config = self._parse_config_json(result.layout_config_json)
                if not config:
                    print(f"[SCENE_GEN] Attempt {attempt+1}: JSON parse returned empty config")
                    continue

                if preferred_arr:
                    config["arrangement"] = preferred_arr

                validated = self._validate_config(config)
                el_types = [e.get("type") for e in validated.get("elements", [])]
                print(f"[SCENE_GEN] Attempt {attempt+1}: arrangement={validated['arrangement']}, elements={el_types}, decorations={validated.get('decorations')}")

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
                    print(f"⚠️  Error in attempt {attempt + 1}: {e}")
                continue

        if best_result:
            self.variety_tracker.record(best_result["arrangement"])
            print(f"[SCENE_GEN] Scene {scene_index} FINAL: arrangement={best_result['arrangement']}, score={best_score:.1f}, elements={len(best_result.get('elements', []))}")
            return {"layoutConfig": best_result}

        print(f"[SCENE_GEN] Scene {scene_index} FALLBACK: all attempts failed, using {self._fallback_arrangement}")
        fallback = {
            "arrangement": self._fallback_arrangement,
            "elements": [
                {"type": "heading", "content": {"text": scene_title}, "emphasis": "primary"},
                {"type": "body-text", "content": {"text": narration[:200] if narration else ""}, "emphasis": "secondary"},
            ],
            "decorations": ["accent-bar-bottom"],
        }
        self.variety_tracker.record(self._fallback_arrangement)
        return {"layoutConfig": fallback}

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
    ) -> dict:
        print(f"[SCENE_GEN] regenerate: scene={scene_index}, preferred_layout={preferred_layout}, has_current={current_descriptor is not None}")

        if not self._is_custom:
            return await self._regenerate_old_descriptor(
                scene_title, narration, visual_description,
                scene_index, total_scenes, other_scenes_layouts,
                preferred_layout, current_descriptor,
            )

        if scene_index == 0 and not preferred_layout:
            return {"layoutConfig": {
                "arrangement": "full-center",
                "elements": [
                    {"type": "heading", "content": {"text": scene_title}, "emphasis": "primary"},
                    {"type": "body-text", "content": {"text": narration[:200] if narration else ""}, "emphasis": "subtle"},
                ],
                "background": {"type": "gradient", "gradientAngle": 135},
                "decorations": ["gradient-orb", "accent-bar-bottom"],
            }}

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
            )
        except Exception as e:
            if self.debug:
                print(f"⚠️  [Regenerate] DSPy error: {e}")
            return {"layoutConfig": {
                "arrangement": preferred_arr or self._fallback_arrangement,
                "elements": [
                    {"type": "heading", "content": {"text": scene_title}},
                    {"type": "body-text", "content": {"text": narration[:200] if narration else ""}},
                ],
                "decorations": ["accent-bar-bottom"],
            }}

        config = self._parse_config_json(result.layout_config_json)
        if preferred_arr:
            config["arrangement"] = preferred_arr
        validated = self._validate_config(config)
        el_types = [e.get("type") for e in validated.get("elements", [])]
        print(f"[SCENE_GEN] Regenerate result: arrangement={validated['arrangement']}, elements={el_types}")
        return {"layoutConfig": validated}

    async def generate_all_scenes(
        self,
        scenes_data: list[dict],
        available_images: list[str] | None = None,
        accent_color: str = "#7C3AED",
        bg_color: str = "#FFFFFF",
        text_color: str = "#000000",
        animation_instructions: str = "",
    ) -> list[dict]:
        total = len(scenes_data)

        if self._is_custom:
            self.variety_tracker = ArrangementVarietyTracker(
                self._valid_arrangements, self._hero_arrangement,
            )

        results = []
        for i, s in enumerate(scenes_data):
            result = await self.generate_scene_descriptor(
                scene_title=s["title"],
                narration=s["narration"],
                visual_description=s["visual_description"],
                scene_index=i,
                total_scenes=total,
            )
            results.append(result)

            if self.debug:
                lc = result.get("layoutConfig", {})
                arr = lc.get("arrangement", result.get("layout", "?"))
                print(f"Scene {i}: {arr} | History: {self.variety_tracker.get_previous_arrangements()}")

        if self.debug:
            print(f"\n Distribution:")
            for arr, count in self.variety_tracker.usage_count.most_common():
                print(f"   {arr}: {count}")

        return results

    # ─── Legacy support for built-in templates ───

    async def _generate_old_descriptor(self, scene_title, narration, visual_description, scene_index, total_scenes, max_retries, preferred_layout):
        """Old-style descriptor for built-in templates."""
        if scene_index == 0 and not preferred_layout:
            self.variety_tracker.record(self._hero_layout)
            return {"layout": self._hero_layout, "layoutProps": {}}

        previous = self.variety_tracker.get_previous_arrangements()
        underused = self.variety_tracker.get_underused_arrangements()

        normalized_preferred = None
        if preferred_layout:
            normalized_preferred = preferred_layout.strip().lower().replace(" ", "_").replace("-", "_")
            if normalized_preferred not in self._valid_layouts:
                normalized_preferred = None

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
                    preferred_arrangement=normalized_preferred or "",
                )

                config = self._parse_config_json(result.layout_config_json)
                layout = config.get("layout", config.get("arrangement", self._fallback_layout))
                layout = layout.strip().lower().replace(" ", "_").replace("-", "_")
                if layout not in self._valid_layouts:
                    layout = self._fallback_layout

                props = config.get("layoutProps", {})
                if isinstance(props, list):
                    props = {}

                self.variety_tracker.record(layout)
                return {"layout": layout, "layoutProps": props}
            except Exception as e:
                if self.debug:
                    print(f"⚠️  Error: {e}")
                continue

        self.variety_tracker.record(self._fallback_layout)
        return {"layout": self._fallback_layout, "layoutProps": {}}

    async def _regenerate_old_descriptor(self, scene_title, narration, visual_description, scene_index, total_scenes, other_scenes_layouts, preferred_layout, current_descriptor):
        """Old-style regeneration for built-in templates."""
        if scene_index == 0 and not preferred_layout:
            return {"layout": self._hero_layout, "layoutProps": {}}

        normalized = None
        if preferred_layout:
            normalized = preferred_layout.strip().lower().replace(" ", "_").replace("-", "_")
            if normalized not in self._valid_layouts:
                normalized = None

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
                preferred_arrangement=normalized or "",
                current_descriptor=current_str,
            )
        except Exception:
            return {"layout": normalized or self._fallback_layout, "layoutProps": {}}

        config = self._parse_config_json(result.layout_config_json)
        layout = config.get("layout", config.get("arrangement", normalized or self._fallback_layout))
        layout = layout.strip().lower().replace(" ", "_").replace("-", "_")
        if layout not in self._valid_layouts:
            layout = normalized or self._fallback_layout

        props = config.get("layoutProps", {})
        if isinstance(props, list):
            props = {}

        return {"layout": layout, "layoutProps": props}
