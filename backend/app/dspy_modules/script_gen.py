import json
import dspy

from app.dspy_modules import ensure_dspy_configured

class BlogToScript(dspy.Signature):
    """
    Given blog content, a list of image URLs from the blog, and a hero image path,
    create a structured video script. The script tone and structure MUST match the
    chosen video_style (explainer / promotional / storytelling). The script should be
    engaging, clear, and organized into scenes suitable for a Remotion-based video.

    ═══ STYLE-SPECIFIC RULES (CRITICAL — STRICTLY follow the given video_style) ═══
    - Treat video_style as a HARD CONSTRAINT.
    - Do NOT mix styles in the same output.
    - If video_style is promotional, every scene must feel like an ad/promo beat.
    - If video_style is explainer, every scene must feel like a documentary-style explanation.
    - If video_style is storytelling, every scene must feel like a story beat in sequence.

    EXPLAINER (DOCUMENTARY MODE):
    - Cover the blog content thoroughly with a documentary narrator tone.
    - Use structured, detailed, factual phrasing with context and insight (not classroom instruction style).
    - Scenes should progress logically: context -> key idea -> evidence/example -> takeaway.
    - Narrations: 1-2 polished documentary-style sentences, target medium length (12-25 words).
    - Avoid ad copy, hype language, and fictional storytelling dramatization.

    PROMOTIONAL:
    - Tone must be strictly promotional/advertisement-like from start to end.
    - Prioritize value proposition, benefits, transformation, and urgency over technical depth.
    - Use persuasive sentence structures: hooks, benefit-led statements, social proof-style claims, and CTA language.
    - Every scene should sound like a promo beat, not a neutral explanation.
    - Narrations should be medium length (10-18 words), punchy but complete.
    - Structure: hook -> problem -> solution/value -> key benefits/features -> CTA/closing push.

    STORYTELLING:
    - Narrative arc is mandatory: setup -> inciting moment -> progression -> tension/challenge -> resolution/payoff.
    - Scenes must build on each other step by step (clear continuity from previous scene).
    - Use narrative connectors and progression cues naturally (then, next, after that, finally) in the target language.
    - Narrations should be medium length (15-30 words), sounding like a human narrator telling a story.
    - Avoid lecture tone and ad-slogan tone unless explicitly required by the source story context.

    GENERAL (all styles):
    - Scene count is controlled by `video_length`, not by `video_style`.
    - Ensure title, scene titles, narrations, and visual_description all reflect the chosen style consistently.

    ═══ VIDEO LENGTH RULES (CRITICAL) ═══
    - video_length values: auto | short | medium | detailed
    - short: best-effort 7–10 scenes (cap at 10).
    - medium: best-effort 12–15 scenes (cap at 15).
    - detailed: best-effort 15–20 scenes (cap at 20).
    - auto: choose a natural scene count based on scraped blog_content length and structure,
      but NEVER exceed 20 scenes.

    FIRST SCENE RULE:
    - The FIRST scene displays the hero/banner image with the blog title overlaid
      and a SHORT narration (1 sentence, ~10-15 words maximum).
    - The title of this scene MUST be the actual blog/video title (e.g. "Building a Reliable Text-to-SQL Pipeline").
      Do NOT use generic titles like "Hero Opening" or "Introduction" for scene 1.
    - The narration should be a brief, compelling hook, e.g. "Let's explore how X works." Keep it concise.
    - Set its duration to 5-7 seconds. This scene WILL have a voiceover.
    - The second scene continues with the main introduction/content.
    - If NO hero image is available (hero_image says "no hero image"), the first scene
      should use a BOLD TEXT BANNER with the title as large centered text on a colored
      background. Set visual_description to: "Title text banner: [THE TITLE] displayed
      as large bold centered text on gradient background, no image needed."
      Leave suggested_images as an empty list [].

    PORTRAIT MODE RULE:
    - If aspect_ratio is "portrait", the video will be rendered in 9:16 (1080x1920) vertical format.
    - For portrait hero scenes: prefer CENTERED title text with shorter lines. Use fewer
      words per line — keep the title concise (max ~6 words per line).
    - For portrait image scenes: images should be described as FULL-WIDTH with text below,
      NOT side-by-side layouts. Avoid "split-screen" or "side-by-side" descriptions.
    - For portrait flow diagrams: use VERTICAL flows (top to bottom), not horizontal.
    - For portrait comparisons: use STACKED layout (top vs bottom), not side-by-side.
    - Keep narrations punchy but still ensure minimum voiceover viability.
    - Narrations: explainer 12-25 words max; promotional 10-18 words max; storytelling about 15-30 words per scene. Display texts shown on screen.

    Duration calculation: Each scene's duration_seconds should be based on narration
    word count: roughly 1 second per 2.5 words, minimum 5 seconds per scene.
    Note: Narrations are display texts (short), voiceover will be generated separately and will be longer.

    ═══ VISUAL DESCRIPTION RULES (CRITICAL) ═══
    The visual_description field drives which visual components get used. Be SPECIFIC:
    - If the blog has CODE → write "Show code block with: [paste actual code]"
    - If listing features/steps → write "Animated bullet list: 1) item, 2) item, ..."
    - If describing a flow/pipeline/architecture → write "Flow diagram: Step1 → Step2 → Step3 → Output"
    - If comparing two things → write "Comparison split-screen: X vs Y"
    - If showing statistics → write "Big metric: 97% with animated counter"
    - If a key quote/definition → write "Quote callout: [the quote]"
    - If an image is relevant → write "Show image with caption: [description]"
    - If describing phases or history → write "Timeline: Phase1, Phase2, Phase3"
    - NEVER write vague descriptions like "display information" or "show content"
    - ALWAYS include the ACTUAL content to be visualized (real items, real code, real numbers)

    ═══ MAXIMIZE VISUAL VARIETY ═══
    Your video should feel polished and cinematic with strong visual variety. To achieve this:
    - EVERY scene should have a SPECIFIC visual layout hint in visual_description
    - Strongly prefer flow diagrams, bullet lists, metrics, comparisons, and timelines
    - Use plain text narration as an ABSOLUTE LAST RESORT — only if nothing else fits
    - Think about what a designer would PUT ON SCREEN: charts, diagrams, lists, numbers
    - If the narration describes any process or workflow, always suggest a flow diagram
    - If there are any numbers, stats, or metrics, always suggest animated metric counters
    - If comparing approaches, technologies, or ideas, always suggest a comparison layout
    - Aim for at least 70% of scenes to use structured visuals (not plain text)

    Output the scenes as a JSON array.

    ═══ LANGUAGE RULE (CRITICAL) ═══
    - content_language specifies the language of the scraped blog content.
    - Generate ALL output (title, scene titles, narrations, visual_description) EXCLUSIVELY in that language.
    - Do NOT translate to English if the content is in another language. Match the source language exactly.

    ═══ LAYOUT SUGGESTION (OPTIONAL, TEMPLATE-AWARE) ═══
    - When layout_catalog is provided, use it to suggest a layout ID for each scene.
    - Think about the **entire video** as a sequence — layout choices should feel like a deliberate visual journey, not random picks.

    ═══ DIVERSITY TARGETS BY VIDEO LENGTH ═══
    - short (7–10 scenes): use at least 7 distinct layouts. Max 2 scenes may share the same layout.
    - medium (12–15 scenes): use at least 9 distinct layouts. Max 2 scenes may share the same layout.
    - detailed (15–20 scenes): use at least 10 distinct layouts. Max 4 scenes may share the same layout.
    - For any other length: use at least ceil(total_scenes * 0.7) distinct layouts.
    - These are MINIMUM targets — more variety is always better if the content supports it.

    ═══ DISTRIBUTION RULES ═══
    - NEVER place the same layout in consecutive scenes (scene N and scene N+1 must differ).
    - When a layout must repeat, space it out: at least 3 scenes apart (e.g. scene 2 and scene 5, not scene 2 and scene 3).
    - Spread visually heavy layouts (grids, charts, timelines) across the video — do not cluster them together.
    - Spread visually light layouts (full-center, quote, body-text) across the video similarly.
    - Think of the video in thirds: opening (scenes 0-2), middle (scenes 3-6), closing (scenes 7+). Each third should have its own visual identity.

    ═══ PLANNING STEP (REQUIRED) ═══
    - Before assigning layouts, write out a short plan:
    1. List all available layouts from layout_catalog.
    2. Group them by visual weight: heavy (data-rich) vs light (text/hero).
    3. Sketch a layout sequence for all scenes that satisfies the diversity target and distribution rules.
    4. Only then assign preferred_layout per scene.
    - This planning happens in your reasoning — the final output is still just preferred_layout per scene.

    ═══ TEMPLATE-SPECIFIC RULES ═══
    - For BUILT-IN templates (default, nightfall, gridcraft, spotlight, whiteboard, newspaper, matrix):
    - Choose layout IDs EXACTLY from layout_catalog (e.g. hero_image, article_lead, data_snapshot).
    - Follow the "Best for" / "When to Use" hints when deciding per scene.
    - Hero/opening scenes should use the template's hero layout (e.g. hero_image, news_headline).
    - For CUSTOM templates (universal layout engine):
    - layout_catalog describes ARRANGEMENTS (e.g. full-center, split-left, grid-2x2).
    - Suggest one arrangement name per scene.
    - For each scene object in scenes_json, include a "preferred_layout" field (string):
    - BUILT-IN: layout ID from the template's layout catalog.
    - CUSTOM: arrangement name from the layout_catalog list.
    - If unsure, leave preferred_layout as empty string "" for that scene.
    """

    blog_content: str = dspy.InputField(
        desc="The full text content extracted from the blog post. "
        "May contain '═══ CODE BLOCKS FROM THIS BLOG ═══' section with actual code snippets. "
        "Use these code blocks in visual_description when relevant."
    )
    blog_images: str = dspy.InputField(desc="JSON array of image URLs/paths available from the blog")
    hero_image: str = dspy.InputField(desc="Path to the main hero/header image of the blog. Use this in the first (hero opening) scene.")
    aspect_ratio: str = dspy.InputField(desc="Video aspect ratio: 'landscape' (16:9, 1920x1080) or 'portrait' (9:16, 1080x1920). Adjust layouts accordingly.")
    video_style: str = dspy.InputField(
        desc="Video style that defines tone and structure: 'explainer' = educational, clear, step-by-step; "
        "'promotional' = persuasive, benefit-focused, call-to-action, product/solution sell; "
        "'storytelling' = narrative arc, emotional hooks, character/journey, story-driven. "
        "Write title, scene titles, narrations, and visual_description to match this style exactly."
    )
    video_length: str = dspy.InputField(
        desc="Video length category controlling scene count: auto | short | medium | detailed."
    )
    layout_catalog: str = dspy.InputField(
        desc=(
            "Optional: template-specific layout catalog text. Either layout IDs and short descriptions for "
            "BUILT-IN templates (default, nightfall, gridcraft, spotlight, whiteboard, newspaper, matrix), "
            "or arrangement names and descriptions for CUSTOM templates. Use this ONLY to pick a suitable "
            "preferred_layout per scene; do NOT copy it verbatim into narrations."
        )
    )
    content_language: str = dspy.InputField(
        desc="Language of the scraped content (e.g. 'English', 'Spanish', 'French'). Generate ALL output in this language."
    )

    title: str = dspy.OutputField(desc="A compelling title for the video (tone must match video_style)")
    scenes_json: str = dspy.OutputField(
        desc=(
            'JSON array of scene objects. Each object has keys: "title" (str), '
            '"narration" (str — length by video_style: explainer 12-25 words; promotional 10-18 words; storytelling about 15-30 words; so voiceover remains concise, and must strictly match selected style), '
            '"visual_description" (str), "suggested_images" (list of str), '
            '"duration_seconds" (int), and OPTIONAL "preferred_layout" (str). '
            'FIRST scene title must be the actual blog title (never "Hero Opening"), '
            'with a concise narration hook (12-15 words max, 1 sentence) and duration_seconds=6. '
            'Narrations: storytelling (15-30) words per scene; explainer (12-25) words per scene; promotional (10-18) words max. '
            'If a hero image exists: visual_description="Hero banner image with title overlay and fade-in", suggested_images=["hero.jpg"]. '
            'If NO hero image: visual_description="Title text banner: [TITLE] displayed as large bold centered text on gradient background", suggested_images=[]. '
            'Example with image: [{"title": "How AI is Changing Everything", '
            '"narration": "Let\'s explore how AI transforms software development.", '
            '"visual_description": "Hero banner image with title overlay and fade-in", '
            '"suggested_images": ["hero.jpg"], "duration_seconds": 6, "preferred_layout": "hero_image"}]. '
            'Example without image: [{"title": "How AI is Changing Everything", '
            '"narration": "Let\'s explore how AI transforms software development.", '
            '"visual_description": "Title text banner: How AI is Changing Everything displayed as large bold centered text on gradient background", '
            '"suggested_images": [], "duration_seconds": 6, "preferred_layout": "text_narration"}]'
        )
    )


class ScriptGenerator:
    """Service that uses DSPy to generate video scripts from blog content."""

    def __init__(self):
        ensure_dspy_configured()
        self._generator = dspy.ChainOfThought(BlogToScript)
        self.generator = dspy.asyncify(self._generator)

    async def generate(
        self,
        blog_content: str,
        blog_images: list[str],
        hero_image: str = "",
        aspect_ratio: str = "landscape",
        video_style: str = "explainer",
        video_length: str = "auto",
        layout_catalog: str = "",
        content_language: str = "English",
    ) -> dict:
        """
        Generate a video script from blog content (async).
        Scene count is controlled by `video_length` (auto/short/medium/detailed).
        video_style (explainer | promotional | storytelling) drives tone and structure.

        Returns:
            dict with 'title' and 'scenes' (list of scene dicts)
        """
        result = await self.generator(
            blog_content=blog_content,
            blog_images=json.dumps(blog_images),
            hero_image=hero_image or "(no hero image available)",
            aspect_ratio=aspect_ratio or "landscape",
            video_style=(video_style or "explainer").strip().lower() or "explainer",
            video_length=(video_length or "auto").strip().lower() or "auto",
            layout_catalog=layout_catalog or "",
            content_language=(content_language or "English").strip(),
        )

        # Parse the scenes JSON and apply limits
        style = (video_style or "explainer").strip().lower() or "explainer"
        scenes = self._parse_scenes(
            result.scenes_json,
            video_style=style,
            video_length=(video_length or "auto").strip().lower() or "auto",
        )

        return {
            "title": result.title,
            "scenes": scenes,
        }

    def _max_scenes_for_video_length(self, video_length: str) -> int:
        """Maximum number of scenes allowed for the given video length category."""
        vl = (video_length or "auto").strip().lower()
        if vl == "short":
            return 10
        if vl == "medium":
            return 15
        if vl == "detailed":
            return 20
        # auto: best-effort natural scene count, but never exceed 20 scenes
        return 20

    def _parse_scenes(
        self,
        scenes_json: str,
        video_style: str = "explainer",
        video_length: str = "auto",
    ) -> list[dict]:
        """Parse and validate scenes JSON.

        - Scene cap is driven by `video_length` (not by `video_style`).
        - Narration text is normalized for whitespace only.
        """
        try:
            # Try to extract JSON from the response (it might have markdown code fences)
            cleaned = scenes_json.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])

            scenes = json.loads(cleaned)

            if not isinstance(scenes, list):
                scenes = [scenes]

            max_scenes = self._max_scenes_for_video_length(video_length)
            validated = []
            for i, scene in enumerate(scenes[:max_scenes]):
                narration = scene.get("narration", "").strip()
                narration = " ".join(narration.split())
                validated.append({
                    "title": scene.get("title", f"Scene {i + 1}"),
                    "narration": narration,
                    "visual_description": scene.get("visual_description", ""),
                    "suggested_images": scene.get("suggested_images", []),
                    "duration_seconds": scene.get("duration_seconds", 10),
                    # May be a layout ID (built-in templates) or an arrangement name (custom templates)
                    "preferred_layout": (scene.get("preferred_layout") or "").strip() or None,
                })

            return validated

        except json.JSONDecodeError:
            # Fallback: create a single scene from the raw text
            return [
                {
                    "title": "Main Content",
                    "narration": " ".join((scenes_json[:500] or "").split()),
                    "visual_description": "Display blog content with images",
                    "suggested_images": [],
                    "duration_seconds": 30,
                }
            ]
