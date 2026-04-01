"""
Batch content classifier — replaces the 16 per-scene DSPy calls for custom templates.

For each scene's narration, extracts:
  - contentType: "bullets" | "metrics" | "code" | "quote" | "comparison" | "timeline" | "steps" | "plain"
  - structured fields: bullets[], metrics[], codeLines[], quote, quoteAuthor, etc.

Uses ONE cheap Haiku call for ALL scenes instead of 16 expensive Sonnet calls.
"""

import json
import logging
import re
from collections import Counter

import dspy

from app.dspy_modules import ensure_dspy_configured, get_theme_lm  # Haiku — cheap and fast

logger = logging.getLogger(__name__)


class BatchContentExtractor(dspy.Signature):
    """Extract structured content from multiple scene narrations in one pass.

    For EACH scene, analyze the narration and determine:
    1. contentType — what kind of content this is
    2. structured fields — parsed data the component needs to render

    Content types:
    - "bullets" — narration lists multiple items/features/benefits/services/products
    - "steps" — narration describes a sequential process or ordered instructions
    - "metrics" — narration contains specific numbers/statistics/KPIs
    - "code" — narration contains code snippets or technical syntax
    - "quote" — narration contains a direct quote or testimonial
    - "comparison" — narration compares two things (vs, before/after, old/new)
    - "timeline" — narration describes events in chronological order
    - "plain" — general narrative text where NO distinct items can be extracted

    Extraction rules:
    - Extract ONLY content present in the narration — NEVER invent data
    - For bullets: extract when narration mentions 2+ distinct named items, services, products,
      features, or benefits — even in prose form (e.g. "offers three services: Go for rides,
      Eat for food, and Get for groceries" → bullets: ["Go for rides", "Eat for food", "Get for groceries"])
    - For bullets/steps: extract ALL mentioned items as string arrays, preserving their names
    - STRONGLY prefer "bullets" over "plain" when 2 or more distinct items/things can be named
    - STRONGLY prefer "steps" over "plain" when a process or sequence is described
    - For metrics: extract value + label pairs (e.g., {"value": "3x", "label": "Growth"})
    - For quotes: extract the quoted text and author if mentioned
    - For code: extract code lines as string array
    - For comparison: extract left and right sides with label + description
    - For timeline: extract items with label + description
    - For plain: ONLY use when narration is pure prose with no extractable items, steps, or data

    Output MUST be a valid JSON array with one object per scene.
    """

    scenes_json: str = dspy.InputField(
        desc="JSON array of scenes: [{title, narration, visual_description, scene_index}]. Use BOTH narration AND visual_description to determine content type and extract items — visual_description often explicitly names the items that should appear on screen."
    )
    content_language: str = dspy.InputField(
        desc="Target language for extracted content"
    )

    extracted_json: str = dspy.OutputField(
        desc='JSON array of extracted content, one per scene: [{"contentType": "...", "bullets": [...], ...}]. Must be valid JSON, no markdown wrapping.'
    )


async def extract_structured_content_batch(
    scenes_data: list[dict],
    content_language: str = "English",
) -> list[dict]:
    """Extract structured content for ALL scenes in one LLM call.

    Replaces the old per-scene DSPy TemplateSceneToDescriptor which made
    ~16 expensive calls generating both layoutConfig (wasted) and structuredContent.
    This makes ONE cheap Haiku call for just the structuredContent.

    Returns list of dicts, each with at minimum {"contentType": "..."}.
    """
    ensure_dspy_configured()

    # Build minimal scene data for the LLM
    scenes_input = [
        {
            "scene_index": i,
            "title": s.get("title", ""),
            "narration": s.get("narration", ""),
            "visual_description": s.get("visual_description", ""),
        }
        for i, s in enumerate(scenes_data)
    ]

    print(f"[F7-DEBUG] [CONTENT-EXTRACT] Extracting structured content for {len(scenes_input)} scenes in ONE call")

    module = dspy.ChainOfThought(BatchContentExtractor)

    # Use Haiku — this is structured extraction, not creative work
    haiku_lm = get_theme_lm()
    with dspy.context(lm=haiku_lm):
        result = module(
            scenes_json=json.dumps(scenes_input),
            content_language=content_language or "English",
        )

    # Parse the result
    raw = (result.extracted_json or "").strip()
    if raw.startswith("```"):
        lines = raw.split("\n")[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[F7-DEBUG] [CONTENT-EXTRACT] JSON parse failed: {e}, raw={raw[:200]}")
        # Fallback: all scenes get "plain"
        extracted = [{"contentType": "plain"} for _ in scenes_data]

    # Ensure we have one result per scene
    if not isinstance(extracted, list):
        extracted = [{"contentType": "plain"} for _ in scenes_data]
    while len(extracted) < len(scenes_data):
        extracted.append({"contentType": "plain"})

    # Validate array fields — LLM sometimes returns strings instead of arrays
    ARRAY_FIELDS = ("bullets", "steps", "codeLines")
    OBJECT_ARRAY_FIELDS = ("metrics", "timelineItems")
    for sc in extracted:
        for field in ARRAY_FIELDS:
            val = sc.get(field)
            if isinstance(val, str) and val.strip():
                # LLM returned a string instead of array — split on newlines
                items = [line.strip() for line in val.strip().splitlines() if line.strip()]
                # Strip leading numbering like "1. ", "1) ", "- ", "* "
                items = [re.sub(r'^(\d+[\.\)]\s*|[-*]\s+)', '', item) for item in items]
                sc[field] = items if items else [val.strip()]
                print(f"[F7-DEBUG] [CONTENT-EXTRACT] Fixed {field}: string → {len(sc[field])} items")
            elif val is not None and not isinstance(val, list):
                sc[field] = []
        for field in OBJECT_ARRAY_FIELDS:
            val = sc.get(field)
            if val is not None and not isinstance(val, list):
                sc[field] = []

    # Debug: log what was extracted
    for i, sc in enumerate(extracted[:len(scenes_data)]):
        ct = sc.get("contentType", "plain")
        fields = [k for k in sc.keys() if k != "contentType" and sc[k]]
        print(f"[F7-DEBUG] [CONTENT-EXTRACT] Scene {i}: contentType={ct}, fields={fields}")

    return extracted[:len(scenes_data)]


def match_scenes_to_archetypes(
    structured_contents: list[dict],
    archetypes: list[dict | str],
) -> list[int]:
    """Match each scene to the best content archetype based on its contentType.

    Returns a list of archetype indices (into the content_codes array).
    Ensures adjacent scenes don't use the same archetype for visual diversity.

    `archetypes` can be either:
    - New format: [{"id": "menu_showcase", "best_for": ["bullets"]}, ...]
    - Old format: ["hero_intro", "bullets_list", ...] (backward compat — no best_for, uses round-robin)
    """
    # Normalize to new format
    normalized: list[dict] = []
    for a in archetypes:
        if isinstance(a, str):
            normalized.append({"id": a, "best_for": []})
        elif isinstance(a, dict):
            normalized.append({"id": a.get("id", "unknown"), "best_for": a.get("best_for", [])})
        else:
            normalized.append({"id": "unknown", "best_for": []})

    # Build lookup: contentType → best archetype index
    type_to_archetype: dict[str, int] = {}
    for i, arch in enumerate(normalized):
        for content_type in arch.get("best_for", []):
            if content_type not in type_to_archetype:
                type_to_archetype[content_type] = i

    print(f"[F7-DEBUG] [MATCH] Type→archetype mapping: {type_to_archetype}")

    num_archetypes = len(normalized)
    archetype_id_list = [a["id"] for a in normalized]
    assignments: list[int] = []
    last_assigned = -1  # Track last assignment to avoid adjacent repeats

    for scene_idx, sc in enumerate(structured_contents):
        content_type = sc.get("contentType", "plain")

        # Try to match by content type
        best = type_to_archetype.get(content_type)

        # If best match is same as last scene, try alternatives for diversity
        if best is not None and best == last_assigned and num_archetypes > 1:
            alternatives = [i for i in range(num_archetypes) if i != last_assigned]
            best = alternatives[scene_idx % len(alternatives)]
            print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type}, avoided repeat, using archetype {best} ({archetype_id_list[best]})")
        elif best is not None:
            print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type} → archetype {best} ({archetype_id_list[best]})")
        else:
            # No specific archetype for this type — round-robin
            best = scene_idx % num_archetypes
            print(f"[F7-DEBUG] [MATCH] Scene {scene_idx}: content={content_type}, no specific match → fallback archetype {best} ({archetype_id_list[best]})")

        assignments.append(best)
        last_assigned = best

    # Summary
    dist = Counter(archetype_id_list[a] for a in assignments)
    print(f"[F7-DEBUG] [MATCH] Final distribution: {dict(dist)}")

    return assignments
