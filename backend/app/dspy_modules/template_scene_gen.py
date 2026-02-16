import json
import asyncio
import dspy
from typing import Dict, List, Set, Optional, Any
from collections import Counter

from app.dspy_modules import ensure_dspy_configured
from app.services.template_service import (
    get_prompt,
    get_meta,
    get_valid_layouts,
    get_hero_layout,
    get_fallback_layout,
    get_image_layout,
)


class TemplateSceneToDescriptor(dspy.Signature):
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
    - Use EXACT prop key names from the layout catalog (e.g., "barChart" not "bar_chart", "metrics" not "metric")
    
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
    
    reasoning: str = dspy.OutputField(
        desc="Your reasoning: (1) Content analysis, (2) Layout choice rationale, (3) Prop extraction details, (4) Variety considerations"
    )
    layout: str = dspy.OutputField(
        desc="Layout ID from catalog (must be exact match, lowercase with underscores)"
    )
    layout_props_json: str = dspy.OutputField(
        desc='Valid JSON object with layout-specific props. Use exact prop keys from catalog. Return {} for layouts with no required props. Do NOT wrap in markdown code blocks.'
    )



class LayoutVarietyTracker:
    """Tracks layout usage to ensure variety across scenes."""
    
    def __init__(self, valid_layouts: List[str], hero_layout: str):
        self.valid_layouts = set(valid_layouts)
        self.hero_layout = hero_layout
        self.usage_count: Counter = Counter()
        self.recent_history: List[str] = []
        self.max_history = 4  # Track last N layouts
    
    def record(self, layout: str):
        """Record a layout usage."""
        self.usage_count[layout] += 1
        self.recent_history.append(layout)
        if len(self.recent_history) > self.max_history:
            self.recent_history.pop(0)
    
    def get_previous_layouts(self) -> str:
        """Get recent layout history for context."""
        return ",".join(self.recent_history[-3:]) if self.recent_history else ""
    
    def get_underused_layouts(self) -> str:
        """Get layouts that haven't been used yet or are underused."""
        avg_usage = sum(self.usage_count.values()) / len(self.valid_layouts) if self.usage_count else 0
        
        underused = []
        for layout in self.valid_layouts:
            if layout == self.hero_layout:
                continue  # Skip hero (only for scene 0)
            if self.usage_count[layout] < avg_usage:
                underused.append(layout)
        
        return ",".join(underused) if underused else ",".join(list(self.valid_layouts)[:5])
    
    def is_repetitive(self, layout: str, threshold: int = 2) -> bool:
        """Check if using this layout would create unwanted repetition."""
        if not self.recent_history:
            return False
        
        # Don't allow same layout twice in a row
        if self.recent_history and self.recent_history[-1] == layout:
            return True
        
        # Don't allow same layout threshold times in last N scenes
        recent_count = self.recent_history[-threshold:].count(layout)
        return recent_count >= threshold



class TemplateSceneGenerator:
    """
    Generates scene layout descriptors with focus on variety and accurate prop extraction.
    """

    def __init__(self, template_id: str, debug: bool = False):
        ensure_dspy_configured()
        self.template_id = template_id
        self.debug = debug
        
        # Load template configuration
        self._prompt = get_prompt(template_id)
        self._valid_layouts = get_valid_layouts(template_id)
        self._hero_layout = get_hero_layout(template_id)
        self._fallback_layout = get_fallback_layout(template_id)
        self._image_layout = get_image_layout(template_id)
        self._meta = get_meta(template_id)
        
        # Initialize DSPy
        self._descriptor = dspy.ChainOfThought(TemplateSceneToDescriptor)
        self.descriptor = dspy.asyncify(self._descriptor)
        
        # Variety tracking
        self.variety_tracker = LayoutVarietyTracker(
            self._valid_layouts, 
            self._hero_layout
        )
    
    def _normalize_layout(self, layout_str: str) -> str:
        """Normalize layout string to match catalog format."""
        return layout_str.strip().lower().replace(" ", "_").replace("-", "_")
    
    def _parse_props_json(self, props_str: str) -> dict:
        """Parse JSON props with robust error handling."""
        try:
            # Remove markdown code blocks if present
            raw = props_str.strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                # Remove first line (```json or ```)
                lines = lines[1:]
                # Remove last line if it's closing ```
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw = "\n".join(lines)
            
            props = json.loads(raw)
            
            if not isinstance(props, dict):
                if self.debug:
                    print(f"⚠️  Props is not a dict: {type(props)}")
                return {}
            
            return props
            
        except (json.JSONDecodeError, TypeError) as e:
            if self.debug:
                print(f"⚠️  JSON parse error: {e}\n   Raw: {props_str[:100]}")
            return {}
    
    def _validate_props(self, layout: str, props: dict) -> dict:
        """
        Validate and clean props against layout schema.
        Returns only valid props with correct types.
        If no schema is defined in meta.json, passes through props as-is.
        """
        layout_meta = self._meta.get("layouts", {}).get(layout, {})
        prop_schema = layout_meta.get("props", {})
        
        # If no schema defined, pass through props as-is (schema validation is optional)
        if not prop_schema:
            return props
        
        validated = {}
        
        for key, value in props.items():
            if key not in prop_schema:
                if self.debug:
                    print(f"⚠️  Unknown prop '{key}' for layout '{layout}'")
                continue
            
            schema = prop_schema[key]
            expected_type = schema.get("type", "string")
            
            # Type validation
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
            else:
                if self.debug:
                    print(f"⚠️  Type mismatch for '{key}': expected {expected_type}, got {type(value).__name__}")
        
        # Check for required props
        for key, schema in prop_schema.items():
            if schema.get("required", False) and key not in validated:
                if self.debug:
                    print(f"⚠️  Missing required prop '{key}' for layout '{layout}'")
        
        return validated
    
    async def generate_scene_descriptor(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
        scene_index: int,
        total_scenes: int = 10,
        max_retries: int = 2,
    ) -> dict:
        """
        Generate a layout descriptor for a single scene with retry logic.
        """
        
        # Scene 0 always gets hero layout
        if scene_index == 0:
            self.variety_tracker.record(self._hero_layout)
            return {
                "layout": self._hero_layout,
                "layoutProps": {},
            }
        
        # Get variety context
        previous_layouts = self.variety_tracker.get_previous_layouts()
        underused_layouts = self.variety_tracker.get_underused_layouts()
        
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
                    previous_layouts=previous_layouts,
                    underused_layouts=underused_layouts,
                )
                
                # Normalize and validate layout
                layout = self._normalize_layout(result.layout)
                
                if layout not in self._valid_layouts:
                    if self.debug:
                        print(f"  Invalid layout '{layout}' (attempt {attempt + 1})")
                    continue
                
                # Parse and validate props
                props = self._parse_props_json(result.layout_props_json)
                validated_props = self._validate_props(layout, props)
                
                # Score this result (for choosing best among retries)
                score = self._score_result(layout, validated_props, props)
                
                if score > best_score:
                    best_score = score
                    best_result = {
                        "layout": layout,
                        "layoutProps": validated_props,
                    }
                
                # If we got a great result, don't retry
                if score >= 0.9:
                    break
                    
            except Exception as e:
                if self.debug:
                    print(f"⚠️  Error in attempt {attempt + 1}: {e}")
                continue
        
        # Use best result or fallback
        if best_result:
            self.variety_tracker.record(best_result["layout"])
            return best_result
        else:
            if self.debug:
                print(f"⚠️  All attempts failed, using fallback layout")
            self.variety_tracker.record(self._fallback_layout)
            return {
                "layout": self._fallback_layout,
                "layoutProps": {},
            }
    
    def _score_result(self, layout: str, validated_props: dict, raw_props: dict) -> float:
        """
        Score a result based on:
        - Layout validity (pass/fail)
        - Prop completeness (% of props that validated)
        - Variety (penalty for repetitive layouts)
        """
        score = 0.5  # Base score for valid layout
        
        # Prop completeness
        if raw_props:
            prop_ratio = len(validated_props) / len(raw_props)
            score += 0.3 * prop_ratio
        else:
            # No props needed/extracted
            score += 0.3
        
        # Variety bonus
        if not self.variety_tracker.is_repetitive(layout):
            score += 0.2
        
        return score
    
    async def generate_all_scenes(
        self,
        scenes_data: list[dict],
        available_images: list[str] | None = None,
        accent_color: str = "#7C3AED",
        bg_color: str = "#FFFFFF",
        text_color: str = "#000000",
        animation_instructions: str = "",
    ) -> list[dict]:
        """
        Generate layout descriptors for all scenes with variety optimization.
        """
        
        total = len(scenes_data)
        num_images = len(available_images) if available_images else 0
        
        # Reset variety tracker for new video
        self.variety_tracker = LayoutVarietyTracker(
            self._valid_layouts,
            self._hero_layout
        )
        
        # Determine which scenes should get image layouts
        image_layout = self._image_layout
        image_scene_indices: set[int] = set()
        
        if image_layout and num_images > 1 and total > 2:
            non_hero = list(range(1, total))
            images_to_assign = min(num_images - 1, len(non_hero) // 2 + 1)
            step = max(1, len(non_hero) // images_to_assign)
            for j in range(0, len(non_hero), step):
                if len(image_scene_indices) >= images_to_assign:
                    break
                image_scene_indices.add(non_hero[j])
        
        # Generate scenes sequentially to maintain variety context
        # (Not parallel to allow variety tracker to work properly)
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
                print(f"Scene {i}: {result['layout']} | Variety: {self.variety_tracker.get_previous_layouts()}")
        
        # Apply image layout overrides
        if image_layout:
            for idx in image_scene_indices:
                if idx < len(results):
                    current = results[idx].get("layout")
                    # Don't override hero or code layouts
                    if current not in (self._hero_layout, "code_block", "glass_code"):
                        results[idx]["layout"] = image_layout
                        results[idx]["layoutProps"] = {}
        
        # Print variety stats
        if self.debug:
            print(f"\n Layout distribution:")
            for layout, count in self.variety_tracker.usage_count.most_common():
                print(f"   {layout}: {count}")
        
        return results

