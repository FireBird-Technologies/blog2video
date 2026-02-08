import json
import asyncio
import dspy

from app.dspy_modules import ensure_dspy_configured


# ─── Available layout types and their props ───────────────────

LAYOUT_DESCRIPTIONS = """Available layouts and their specific props:

1. text_narration — General text with geometric shapes.
   Best for: introductions, conclusions, general explanations.
   Props: (none — uses title + narration directly)

2. code_block — Code snippet with terminal-style display and line-by-line reveal.
   Best for: code snippets, terminal commands, API calls, config files.
   Props: codeLines (string[]), codeLanguage (string, e.g. "python", "javascript")

3. bullet_list — Animated list of key points.
   Best for: features, benefits, steps, takeaways.
   Props: bullets (string[]) — max 6 items

4. flow_diagram — Step-by-step process flow with arrows.
   Best for: pipelines, workflows, processes, data flows.
   Props: steps (string[]) — max 5 steps

5. comparison — Side-by-side before/after or A vs B.
   Best for: pros/cons, old/new, before/after comparisons.
   Props: leftLabel (string), rightLabel (string), leftDescription (string), rightDescription (string)

6. metric — Big animated number/statistic with progress bar.
   Best for: statistics, percentages, KPIs, performance numbers.
   Props: metrics (array of {value: string, label: string, suffix?: string}) — max 3 metrics

7. quote_callout — Highlighted quote with accent bar.
   Best for: key quotes, definitions, insights, important callouts.
   Props: quote (string), quoteAuthor (string)

8. image_caption — Blog image with explanatory text side-by-side.
   Best for: explaining a screenshot, diagram, or blog image.
   Props: (none — uses title + narration + imageUrl from runtime)

9. timeline — Vertical timeline with chronological items.
   Best for: phases, version history, ordered milestones, chronological steps.
   Props: timelineItems (array of {label: string, description: string}) — max 4 items
"""


# ─── Scene Descriptor Signature ──────────────────────────────

class SceneToDescriptor(dspy.Signature):
    """
    You are a professional video scene designer for an educational explainer video.
    Your job is to analyze the narration and create a visually engaging layout descriptor.

    ═══ YOUR GOAL ═══
    Create a DIVERSE, VISUALLY RICH video. You must:
    1. Pick the BEST layout type that makes the content visually compelling
    2. Extract REAL, structured data from the narration into the layout's specific props
    3. Ensure the video feels like a polished documentary — NOT a text slideshow

    ═══ VARIETY IS CRITICAL ═══
    A good explainer video uses a MIX of visual styles across its scenes.
    - NEVER use the same layout for more than 2 consecutive scenes
    - text_narration is the LEAST engaging layout — use it as an ABSOLUTE LAST RESORT
    - You should use text_narration for AT MOST 1 scene in the entire video (ideally zero)
    - A 7-scene video should ideally use 5-7 DIFFERENT layout types
    - Think like a filmmaker: alternate between data-heavy scenes (metric, code_block),
      visual scenes (image_caption, flow_diagram), and impact scenes (quote_callout, comparison)
    - The viewer should feel visual momentum — each scene should LOOK different from the last

    ═══ PREFER VISUAL LAYOUTS ═══
    Always try to express content as a VISUAL element rather than plain text:
    - Any process, workflow, or "how it works" → flow_diagram (even if not explicitly stated)
    - Any list of items, features, benefits → bullet_list (animated, numbered points)
    - Any before/after, pros/cons, two options → comparison (split-screen)
    - Any number, percentage, stat, or performance claim → metric (animated counter)
    - Any quote, definition, or key insight → quote_callout (accent bar + glow)
    - Any phases, timeline, or ordered events → timeline (vertical dots)
    - If the narration describes a system architecture, data pipeline, or multi-step process,
      ALWAYS use flow_diagram — decompose it into 3-5 short step labels
    - If the narration mentions benefits, features, or takeaways, ALWAYS use bullet_list
    - If there are numbers anywhere in the narration, STRONGLY prefer metric layout
    - When in doubt between text_narration and ANY other layout, ALWAYS choose the other layout

    ═══ CONTENT EXTRACTION ═══
    - Extract REAL content from the narration — NEVER fabricate data
    - For code_block: extract ACTUAL code, commands, or API calls mentioned — use real syntax,
      real variable names, real function signatures. If the narration says "use fetch()", write
      the actual fetch code. Include 3-8 lines that tell a story.
    - For bullet_list: pull out the ACTUAL items, features, or steps. Each bullet should be
      a concise phrase (5-10 words), not a full sentence. Max 6 bullets.
    - For flow_diagram: extract the ACTUAL process steps. Use short 2-4 word labels per step.
      Max 5 steps. Think: Input → Process → Validate → Transform → Output.
    - For metric: extract REAL numbers/percentages from the narration. If the narration says
      "reduces errors by 40%", use value="40", label="Error reduction", suffix="%".
    - For comparison: extract the ACTUAL two sides being compared. Use clear, contrasting labels.
    - For quote_callout: extract the KEY insight, definition, or quotable statement.
      Keep it to 1-2 impactful sentences. The quote should feel like a "pull quote" in a magazine.
    - For timeline: extract 3-4 chronological phases with short labels and 1-line descriptions.
    - For image_caption: use when the visual_description specifically mentions a diagram, 
      screenshot, or blog image. No extra props needed — the image is provided at runtime.

    ═══ LAYOUT SELECTION GUIDE ═══
    - Code, commands, config, API calls → "code_block" (shows a terminal with animated typing)
    - Lists of features, benefits, steps, takeaways → "bullet_list" (numbered animated points)
    - Processes, pipelines, architectures, data flows → "flow_diagram" (connected boxes with arrows)
    - Numbers, stats, percentages, KPIs, benchmarks → "metric" (giant animated counter)
    - Before/after, pros/cons, old/new, A vs B → "comparison" (split screen)
    - Key insight, definition, famous quote, important callout → "quote_callout" (accent bar + glow)
    - Explaining a screenshot, diagram, or visual from the blog → "image_caption" (image + text)
    - Chronological phases, version history, roadmap → "timeline" (vertical dots + staggered items)
    - General narrative that truly doesn't fit above → "text_narration" (geometric shapes + text)

    ═══ SMOOTHNESS ═══
    - Every layout has built-in animated transitions (fade-in, slide, scale, stagger)
    - Your job is to provide CLEAN, WELL-STRUCTURED data so the animations shine
    - Short, punchy text works better than long paragraphs
    - For bullets: each bullet = one clear idea, not a run-on sentence
    - For code: properly indented, syntactically correct, tells a mini-story in 3-8 lines
    - For metrics: round numbers with clear labels ("3x Faster", "97% Accuracy", "50ms Latency")
    """

    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Narration text to analyze and extract structured data from")
    visual_description: str = dspy.InputField(desc="Visual description hints from the script")
    scene_index: int = dspy.InputField(desc="0-based scene index (scene 0 is always hero_image)")
    total_scenes: int = dspy.InputField(desc="Total number of scenes in the video — use this to plan variety")
    layout_descriptions: str = dspy.InputField(desc="Available layout types and their props")

    layout: str = dspy.OutputField(
        desc="One of: text_narration, code_block, bullet_list, flow_diagram, comparison, "
        "metric, quote_callout, image_caption, timeline. "
        "Pick the most VISUALLY ENGAGING option that fits the content. "
        "Avoid repeating the same layout for consecutive scenes — variety makes a better video."
    )
    layout_props_json: str = dspy.OutputField(
        desc='JSON object with layout-specific props extracted from the narration. '
        'Use the exact prop names from the layout descriptions. '
        'Return {} for text_narration or image_caption. '
        'IMPORTANT: Extract REAL data — actual code, actual bullet text, actual numbers. '
        'Keep text concise and punchy for visual impact. '
        'Examples: {"codeLines": ["const app = express();", "app.use(cors());", "app.listen(3000);"], "codeLanguage": "javascript"} '
        'or {"bullets": ["3x faster builds", "Zero-config setup", "Built-in TypeScript"]} '
        'or {"metrics": [{"value": "97", "label": "Test coverage", "suffix": "%"}]} '
        'or {"steps": ["Scrape", "Parse", "Transform", "Render"]} '
        'or {"leftLabel": "Manual", "rightLabel": "Automated", "leftDescription": "Slow, error-prone deploys", "rightDescription": "Fast, reliable CI/CD"}'
    )


# ─── Service class ────────────────────────────────────────────

VALID_LAYOUTS = {
    "text_narration",
    "code_block",
    "bullet_list",
    "flow_diagram",
    "comparison",
    "metric",
    "quote_callout",
    "image_caption",
    "timeline",
}


class SceneCodeGenerator:
    """
    Generates scene layout descriptors (JSON) instead of raw TSX code.
    One LLM call per scene picks the layout type and extracts structured props.
    """

    def __init__(self):
        ensure_dspy_configured()
        self._descriptor = dspy.ChainOfThought(SceneToDescriptor)
        self.descriptor = dspy.asyncify(self._descriptor)

    async def generate_scene_descriptor(
        self,
        scene_title: str,
        narration: str,
        visual_description: str,
        scene_index: int,
        total_scenes: int = 10,
    ) -> dict:
        """Generate a layout descriptor for a single scene."""

        # Scene 0 is always hero_image
        if scene_index == 0:
            return {"layout": "hero_image", "layoutProps": {}}

        result = await self.descriptor(
            scene_title=scene_title,
            narration=narration,
            visual_description=visual_description,
            scene_index=scene_index,
            total_scenes=total_scenes,
            layout_descriptions=LAYOUT_DESCRIPTIONS,
        )

        # Validate layout
        layout = result.layout.strip().lower().replace(" ", "_").replace("-", "_")
        if layout not in VALID_LAYOUTS:
            layout = "text_narration"

        # Parse props JSON
        try:
            raw = result.layout_props_json.strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                if lines[-1].strip() == "```":
                    lines = lines[1:-1]
                else:
                    lines = lines[1:]
                raw = "\n".join(lines)
            props = json.loads(raw)
            if not isinstance(props, dict):
                props = {}
        except (json.JSONDecodeError, TypeError):
            props = {}

        return {"layout": layout, "layoutProps": props}

    async def generate_all_scenes(
        self,
        scenes_data: list[dict],
        available_images: list[str] | None = None,
        accent_color: str = "#7C3AED",
        bg_color: str = "#FFFFFF",
        text_color: str = "#000000",
        animation_instructions: str = "",
    ) -> list[dict]:
        """Generate layout descriptors for all scenes concurrently."""
        total = len(scenes_data)
        tasks = [
            self.generate_scene_descriptor(
                scene_title=s["title"],
                narration=s["narration"],
                visual_description=s["visual_description"],
                scene_index=i,
                total_scenes=total,
            )
            for i, s in enumerate(scenes_data)
        ]
        return await asyncio.gather(*tasks)
