import json
import dspy

from app.dspy_modules import ensure_dspy_configured


class BlogToScript(dspy.Signature):
    """
    Given blog content, a list of image URLs from the blog, and a hero image path,
    create a structured video script for an explainer video. The script should be
    engaging, clear, and organized into scenes suitable for a Remotion-based video.

    IMPORTANT RULES:
    - The video should be AS LONG AS NEEDED to cover the blog content thoroughly.
    - Do NOT artificially shorten content. Each major point deserves its own scene.
    - Output at most 10 scenes. If the blog is short, fewer scenes are fine.
    - Combine only truly related minor points; give major topics their own scene.

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
    - Keep narrations slightly shorter for portrait — mobile viewers prefer punchy content.
    - ALL scenes should have SHORT narrations (1 sentence, 10-20 words max) as these are display texts shown on screen.

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
    Your video should feel like a polished DOCUMENTARY, not a lecture. To achieve this:
    - EVERY scene should have a SPECIFIC visual layout hint in visual_description
    - Strongly prefer flow diagrams, bullet lists, metrics, comparisons, and timelines
    - Use plain text narration as an ABSOLUTE LAST RESORT — only if nothing else fits
    - Think about what a designer would PUT ON SCREEN: charts, diagrams, lists, numbers
    - If the narration describes any process or workflow, always suggest a flow diagram
    - If there are any numbers, stats, or metrics, always suggest animated metric counters
    - If comparing approaches, technologies, or ideas, always suggest a comparison layout
    - Aim for at least 70% of scenes to use structured visuals (not plain text)

    Output the scenes as a JSON array.
    """

    blog_content: str = dspy.InputField(
        desc="The full text content extracted from the blog post. "
        "May contain '═══ CODE BLOCKS FROM THIS BLOG ═══' section with actual code snippets. "
        "Use these code blocks in visual_description when relevant."
    )
    blog_images: str = dspy.InputField(desc="JSON array of image URLs/paths available from the blog")
    hero_image: str = dspy.InputField(desc="Path to the main hero/header image of the blog. Use this in the first (hero opening) scene.")
    aspect_ratio: str = dspy.InputField(desc="Video aspect ratio: 'landscape' (16:9, 1920x1080) or 'portrait' (9:16, 1080x1920). Adjust layouts accordingly.")

    title: str = dspy.OutputField(desc="A compelling title for the explainer video")
    scenes_json: str = dspy.OutputField(
        desc='JSON array of scene objects. Each object has keys: "title" (str), '
        '"narration" (str -- concise display text, 1 sentence, 10-15 words max), '
        '"visual_description" (str), "suggested_images" (list of str), '
        '"duration_seconds" (int). '
        'FIRST scene title must be the actual blog title (never "Hero Opening"), '
        'with a concise narration hook (10-15 words max, 1 sentence) and duration_seconds=6. '
        'ALL scenes should have SHORT narrations (1 sentence, 10-20 words max) - these are display texts shown on screen. '
        'If a hero image exists: visual_description="Hero banner image with title overlay and fade-in", suggested_images=["hero.jpg"]. '
        'If NO hero image: visual_description="Title text banner: [TITLE] displayed as large bold centered text on gradient background", suggested_images=[]. '
        'Example with image: [{"title": "How AI is Changing Everything", '
        '"narration": "Let\'s explore how AI transforms software development.", '
        '"visual_description": "Hero banner image with title overlay and fade-in", '
        '"suggested_images": ["hero.jpg"], "duration_seconds": 6}]. '
        'Example without image: [{"title": "How AI is Changing Everything", '
        '"narration": "Let\'s explore how AI transforms software development.", '
        '"visual_description": "Title text banner: How AI is Changing Everything displayed as large bold centered text on gradient background", '
        '"suggested_images": [], "duration_seconds": 6}]'
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
    ) -> dict:
        """
        Generate a video script from blog content (async).
        The video duration is determined by the content length -- no artificial limit.

        Returns:
            dict with 'title' and 'scenes' (list of scene dicts)
        """
        result = await self.generator(
            blog_content=blog_content,
            blog_images=json.dumps(blog_images),
            hero_image=hero_image or "(no hero image available)",
            aspect_ratio=aspect_ratio or "landscape",
        )

        # Parse the scenes JSON
        scenes = self._parse_scenes(result.scenes_json)

        return {
            "title": result.title,
            "scenes": scenes,
        }

    def _parse_scenes(self, scenes_json: str) -> list[dict]:
        """Parse and validate the scenes JSON output."""
        try:
            # Try to extract JSON from the response (it might have markdown code fences)
            cleaned = scenes_json.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])

            scenes = json.loads(cleaned)

            if not isinstance(scenes, list):
                scenes = [scenes]

            # Validate each scene has required fields, cap at 10
            validated = []
            for i, scene in enumerate(scenes[:10]):
                validated.append({
                    "title": scene.get("title", f"Scene {i + 1}"),
                    "narration": scene.get("narration", ""),
                    "visual_description": scene.get("visual_description", ""),
                    "suggested_images": scene.get("suggested_images", []),
                    "duration_seconds": scene.get("duration_seconds", 10),
                })

            return validated

        except json.JSONDecodeError:
            # Fallback: create a single scene from the raw text
            return [
                {
                    "title": "Main Content",
                    "narration": scenes_json[:500],
                    "visual_description": "Display blog content with images",
                    "suggested_images": [],
                    "duration_seconds": 30,
                }
            ]
