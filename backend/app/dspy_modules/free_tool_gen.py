"""
DSPy generators powering the free public SEO tools (login-gated):

  - VideoScriptGenerator      → scene-by-scene video script from a topic/URL/notes
  - ThumbnailTextGenerator    → high-CTR thumbnail text overlay options
  - YouTubeDescriptionGenerator → SEO video description + tags

These are lightweight, stateless single-shot generators (no Project row). They
reuse the shared DSPy LM configured in app.dspy_modules.__init__ via
ensure_dspy_configured(), same as every other generator module in this package.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


# ─── Video Script Generator ──────────────────────────────────────────────────


class TopicToVideoScript(dspy.Signature):
    """
    Write a structured, scene-by-scene short video script from a topic, blog
    URL, or rough notes.

    ═══ OUTPUT STRUCTURE (STRICT) ═══
    - Produce a script organized into clearly numbered scenes.
    - Scene 1 is always a HOOK: a punchy opening line that earns the next 3
      seconds of attention. No throat-clearing, no "in this video".
    - Middle scenes deliver the key beats/ideas in a logical progression.
    - The final scene is a CALL TO ACTION appropriate to the platform.
    - Each scene has: a short on-screen title/label and 1-2 sentences of
      narration/voiceover the creator will actually read aloud.

    ═══ TONE ═══
    - Match the requested tone (explainer / promotional / storytelling / casual).
    - Write for the ear, not the page: short, spoken-word sentences.
    - Do NOT invent specific statistics, names, or claims that are not implied
      by the topic. Keep factual specifics generic when unknown.

    ═══ LENGTH ═══
    - length "short": 4-5 scenes. "medium": 7-9 scenes. "long": 12-15 scenes.

    ═══ FORMATTING ═══
    - Output `script_markdown` as clean Markdown. Use a "## Scene N — <title>"
      heading per scene, then a "**On screen:** ..." line and a
      "**Voiceover:** ..." line. No code fences.
    """

    topic: str = dspy.InputField(
        desc="The video topic, blog URL, or rough notes the script should be based on."
    )
    tone: str = dspy.InputField(
        desc="Desired tone: explainer, promotional, storytelling, or casual."
    )
    length: str = dspy.InputField(desc="Target length: short, medium, or long.")

    video_title: str = dspy.OutputField(
        desc="A compelling suggested title for the finished video."
    )
    script_markdown: str = dspy.OutputField(
        desc="The full scene-by-scene script as clean Markdown, following the formatting rules."
    )


class VideoScriptGenerator:
    """Single-shot script generator for the free Video Script Generator tool."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.Predict(TopicToVideoScript)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate(self, topic: str, tone: str = "explainer", length: str = "medium") -> dict:
        res = await self.predictor(
            topic=(topic or "").strip(),
            tone=(tone or "explainer").strip().lower(),
            length=(length or "medium").strip().lower(),
        )
        return {
            "video_title": (getattr(res, "video_title", "") or "").strip(),
            "script_markdown": (getattr(res, "script_markdown", "") or "").strip(),
        }


# ─── Thumbnail Text Generator ────────────────────────────────────────────────


class TopicToThumbnailText(dspy.Signature):
    """
    Generate high-CTR thumbnail text overlay options for a video.

    ═══ RULES ═══
    - Thumbnail text is NOT the title. It's the 2-5 word punch that overlays the
      image and creates curiosity, tension, or a bold claim.
    - Keep every option to 5 words or fewer. Shorter is better.
    - Use ALL CAPS-friendly phrasing (the creator may uppercase them).
    - Favor curiosity gaps, contrast, numbers, and strong verbs.
    - No ending punctuation. No quotes. No emoji.
    - Provide a range of angles (question, bold claim, number, warning, benefit).
    """

    topic: str = dspy.InputField(
        desc="The video topic or title the thumbnail text should promote."
    )

    options: list[str] = dspy.OutputField(
        desc="8 distinct thumbnail text overlay options, each 5 words or fewer, no punctuation."
    )


class ThumbnailTextGenerator:
    """Single-shot thumbnail-text generator for the free tool."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.Predict(TopicToThumbnailText)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate(self, topic: str) -> dict:
        res = await self.predictor(topic=(topic or "").strip())
        options = getattr(res, "options", None) or []
        cleaned = [str(o).strip().strip('"').strip() for o in options if str(o).strip()]
        return {"options": cleaned[:8]}


# ─── YouTube Description Generator ───────────────────────────────────────────


class TopicToYouTubeDescription(dspy.Signature):
    """
    Generate an SEO-optimized YouTube video description and tags.

    ═══ DESCRIPTION RULES ═══
    - The FIRST 1-2 sentences must front-load the primary keyword and clearly
      state what the viewer will get. This is what shows above the fold.
    - Follow with 2-4 short paragraphs expanding on the value.
    - Optionally include a plain "Chapters:" style outline ONLY if a transcript
      or detailed notes are provided; otherwise omit it.
    - End with a short call to action (subscribe / link).
    - Natural, human phrasing. No keyword stuffing. No markdown headers, no code
      fences — YouTube descriptions are plain text.

    ═══ TAGS RULES ═══
    - 12-15 relevant tags: a mix of broad and specific/long-tail terms.
    - Lowercase, no "#" prefix (these are YouTube tags, not hashtags).
    """

    topic: str = dspy.InputField(
        desc="The video topic, title, or pasted transcript/notes to base the description on."
    )

    description: str = dspy.OutputField(
        desc="The full SEO video description as plain text following the rules."
    )
    tags: list[str] = dspy.OutputField(
        desc="12-15 relevant YouTube tags, lowercase, no # prefix."
    )


class YouTubeDescriptionGenerator:
    """Single-shot YouTube description + tags generator for the free tool."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.Predict(TopicToYouTubeDescription)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate(self, topic: str) -> dict:
        res = await self.predictor(topic=(topic or "").strip())
        tags = getattr(res, "tags", None) or []
        cleaned_tags = [str(t).strip().lstrip("#").strip() for t in tags if str(t).strip()]
        return {
            "description": (getattr(res, "description", "") or "").strip(),
            "tags": cleaned_tags[:15],
        }
