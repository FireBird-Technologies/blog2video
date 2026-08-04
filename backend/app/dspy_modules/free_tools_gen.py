"""
DSPy signatures and generators backing the free (login-gated) marketing tools:
video script generator, thumbnail text generator, and YouTube description generator.

These are stateless, single-shot generations with no Project/DB dependency —
unlike the main pipeline's script_gen.py, which drives the full video build.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


class GenerateVideoScript(dspy.Signature):
    """
    Generate a short-form narrated video script from a topic or a block of source text
    (e.g. a blog paragraph, a product description, a rough idea).

    Produce a hook, 3-6 scene beats that build the narration in order, and a closing CTA line.
    Keep every line spoken-language natural — this will be read aloud by a voiceover, not displayed
    as an article. No markdown, no numbering inside the text fields themselves.
    """

    topic_or_text: str = dspy.InputField(
        desc="The topic, idea, or source text (e.g. a blog excerpt) to turn into a video script"
    )
    tone: str = dspy.InputField(
        desc="Desired tone: explainer, promotional, or storytelling"
    )

    hook: str = dspy.OutputField(
        desc="One punchy opening line (under 20 words) designed to stop the scroll in the first 3 seconds"
    )
    scenes: list[str] = dspy.OutputField(
        desc="3-6 scene narration lines in spoken order, each a complete natural-sounding sentence or two "
        "(15-30 words each) that a voiceover would read aloud"
    )
    cta: str = dspy.OutputField(
        desc="One closing call-to-action line (under 20 words)"
    )


class GenerateThumbnailText(dspy.Signature):
    """
    Generate short, high-CTR text overlay options for a video thumbnail, given the video's topic/title.

    Thumbnail text must be extremely short (2-5 words), high contrast in meaning (curiosity, stakes,
    numbers, or a bold claim), and legible at small sizes. Avoid full sentences.
    """

    topic: str = dspy.InputField(desc="The video's topic or working title")

    options: list[str] = dspy.OutputField(
        desc="5 distinct thumbnail text overlay options, each 2-5 words, no punctuation-heavy phrasing, "
        "ordered from boldest/most clickable to safest"
    )


class GenerateYoutubeDescription(dspy.Signature):
    """
    Generate an SEO-optimized YouTube video description and tag list from a topic and optional keywords.

    The description should open with a strong 1-2 sentence hook containing the primary keyword naturally,
    followed by a short expanded summary, and should read naturally (not keyword-stuffed).
    """

    topic: str = dspy.InputField(desc="The video's topic or working title")
    keywords: str = dspy.InputField(
        desc="Comma-separated target keywords to weave in naturally, may be empty"
    )

    description: str = dspy.OutputField(
        desc="A 3-5 sentence YouTube description: hook sentence first, then supporting context. "
        "Plain text, no markdown, no hashtags inline."
    )
    tags: list[str] = dspy.OutputField(
        desc="8-12 relevant YouTube tags/keywords, short phrases, no leading # symbol"
    )


class FreeToolsGenerator:
    """Thin wrapper exposing async, exception-safe calls for each free-tool generator."""

    def __init__(self):
        ensure_dspy_configured()
        self._script_predictor = dspy.asyncify(dspy.ChainOfThought(GenerateVideoScript))
        self._thumbnail_predictor = dspy.asyncify(dspy.ChainOfThought(GenerateThumbnailText))
        self._description_predictor = dspy.asyncify(dspy.ChainOfThought(GenerateYoutubeDescription))

    async def generate_video_script(self, topic_or_text: str, tone: str) -> dict:
        result = await self._script_predictor(topic_or_text=topic_or_text, tone=tone)
        return {
            "hook": (result.hook or "").strip(),
            "scenes": [s.strip() for s in (result.scenes or []) if s and s.strip()],
            "cta": (result.cta or "").strip(),
        }

    async def generate_thumbnail_text(self, topic: str) -> dict:
        result = await self._thumbnail_predictor(topic=topic)
        return {"options": [o.strip() for o in (result.options or []) if o and o.strip()]}

    async def generate_youtube_description(self, topic: str, keywords: str) -> dict:
        result = await self._description_predictor(topic=topic, keywords=keywords or "")
        return {
            "description": (result.description or "").strip(),
            "tags": [t.strip() for t in (result.tags or []) if t and t.strip()],
        }
