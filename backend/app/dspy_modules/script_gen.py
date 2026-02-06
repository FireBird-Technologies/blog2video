import json
import dspy
from typing import Optional

from app.config import settings


class BlogToScript(dspy.Signature):
    """
    Given blog content and a list of image URLs from the blog, create a structured
    video script for an explainer video. The script should be engaging, clear, and
    organized into scenes suitable for a Remotion-based video.

    Each scene should have:
    - A descriptive title
    - Narration text (what the voiceover will say)
    - Visual direction (what should appear on screen)
    - Suggested images from the blog to use
    - Approximate duration in seconds

    Output the scenes as a JSON array.
    """

    blog_content: str = dspy.InputField(desc="The full text content extracted from the blog post")
    blog_images: str = dspy.InputField(desc="JSON array of image URLs/paths available from the blog")
    target_duration_minutes: int = dspy.InputField(desc="Target total video duration in minutes")

    title: str = dspy.OutputField(desc="A compelling title for the explainer video")
    scenes_json: str = dspy.OutputField(
        desc='JSON array of scene objects. Each object has keys: "title" (str), '
        '"narration" (str), "visual_description" (str), "suggested_images" (list of str), '
        '"duration_seconds" (int). Example: [{"title": "Introduction", "narration": "Welcome...", '
        '"visual_description": "Show title card with blog header image", '
        '"suggested_images": ["img1.jpg"], "duration_seconds": 15}]'
    )


class ScriptGenerator:
    """Service that uses DSPy to generate video scripts from blog content."""

    def __init__(self):
        self._configure_dspy()
        self.generator = dspy.ChainOfThought(BlogToScript)

    def _configure_dspy(self):
        lm = dspy.LM(
            "anthropic/claude-sonnet-4-20250514",
            api_key=settings.ANTHROPIC_API_KEY,
        )
        dspy.configure(lm=lm)

    def generate(
        self,
        blog_content: str,
        blog_images: list[str],
        target_duration_minutes: int = 3,
    ) -> dict:
        """
        Generate a video script from blog content.

        Returns:
            dict with 'title' and 'scenes' (list of scene dicts)
        """
        result = self.generator(
            blog_content=blog_content,
            blog_images=json.dumps(blog_images),
            target_duration_minutes=target_duration_minutes,
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

            # Validate each scene has required fields
            validated = []
            for i, scene in enumerate(scenes):
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
