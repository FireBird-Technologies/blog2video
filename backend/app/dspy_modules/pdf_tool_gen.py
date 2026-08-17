"""
DSPy generators powering the login-gated PDF tools on pdf2vid.com:

  - DocumentSummarizer      → abstractive summary + key points from a document
  - DocumentToVideoScript   → scene-by-scene narration script from a document
  - DocumentToStoryboard    → slide-by-slide storyboard (on-screen vs spoken)

These differ from free_tool_gen.py's generators in their input: those take a
topic and invent content around it, these take an *existing document* and must
not add anything that is not in it. Every signature below says so explicitly,
because the failure mode that matters here is not a weak script — it is a
confident sentence the source document never supported.

Stateless single-shot calls (no Project row), reusing the shared DSPy LM from
app.dspy_modules.__init__ via ensure_dspy_configured().
"""
import dspy

from app.dspy_modules import ensure_dspy_configured

# Documents can be far longer than a useful prompt. Truncating at a character
# budget keeps latency and cost bounded; the routers tell the user when this
# kicked in rather than silently summarising the first third of their report.
MAX_DOC_CHARS = 60_000


def clamp_document(text: str) -> tuple[str, bool]:
    """Return ``(text, was_truncated)`` clipped to the prompt budget."""
    cleaned = (text or "").strip()
    if len(cleaned) <= MAX_DOC_CHARS:
        return cleaned, False
    return cleaned[:MAX_DOC_CHARS].rsplit(" ", 1)[0], True


# ─── Fidelity rules shared by all three signatures ───────────────────────────

_FIDELITY = """
    ═══ FIDELITY (NON-NEGOTIABLE) ═══
    - Use ONLY information present in the document. Add nothing.
    - Never invent statistics, dates, names, citations, or outcomes.
    - Preserve hedging exactly. "associated with" must not become "causes";
      "suggests" must not become "shows"; "in this sample" must not become a
      general claim. Removing a qualifier changes the meaning and is a failure.
    - Copy every number exactly as written, including units and precision.
    - If the document does not state something, say nothing about it rather
      than filling the gap plausibly.
"""


# ─── Summarizer ──────────────────────────────────────────────────────────────


class DocumentToSummary(dspy.Signature):
    """
    Summarize a document into plain-language prose plus discrete key points.
    """

    __doc__ += _FIDELITY + """
    ═══ OUTPUT ═══
    - `summary`: flowing prose, no bullets, no headings. Lead with the single
      most important finding or claim rather than with background. Written for
      an intelligent reader who has not read the document.
    - `key_points`: the discrete takeaways, each a complete standalone
      sentence. No leading bullet characters or numbering.
    - `key_terms`: the handful of terms/entities a reader needs to follow the
      summary. Lowercase unless a proper noun.

    ═══ LENGTH ═══
    - "brief": ~80 words of summary, 3 key points.
    - "standard": ~180 words, 5 key points.
    - "detailed": ~350 words, 8 key points.
    """

    document: str = dspy.InputField(desc="The full text extracted from the user's document.")
    length: str = dspy.InputField(desc="Requested depth: brief, standard, or detailed.")

    summary: str = dspy.OutputField(desc="Plain-language prose summary, finding first.")
    key_points: list[str] = dspy.OutputField(desc="Discrete takeaways as standalone sentences.")
    key_terms: list[str] = dspy.OutputField(desc="Terms a reader needs to follow the summary.")


class DocumentSummarizer:
    """Abstractive document summarizer for the /tools/pdf-summarizer widget."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.Predict(DocumentToSummary)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate(self, document: str, length: str = "standard") -> dict:
        text, truncated = clamp_document(document)
        res = await self.predictor(
            document=text,
            length=(length or "standard").strip().lower(),
        )
        return {
            "summary": (getattr(res, "summary", "") or "").strip(),
            "key_points": [p.strip() for p in (getattr(res, "key_points", None) or []) if p.strip()],
            "key_terms": [t.strip() for t in (getattr(res, "key_terms", None) or []) if t.strip()],
            "truncated": truncated,
        }


# ─── Document → video script ─────────────────────────────────────────────────


class DocumentToScript(dspy.Signature):
    """
    Turn a document into a scene-by-scene narration script for a video.
    """

    __doc__ += _FIDELITY + """
    ═══ THE CUT (THIS IS THE JOB) ═══
    - A document narrated end to end is far too long to watch. Select.
    - Keep: the finding/argument, the evidence that supports it, and what it
      means for the viewer.
    - Drop: related work, detailed methodology, appendices, acknowledgements,
      and anything the document itself treats as supporting material. It is
      correct to leave most of the document out.
    - Reorder so the most important point is in scene 1. Documents build to
      their conclusion; video loses the viewer before it arrives.

    ═══ WRITING FOR THE EAR ═══
    - Narration is spoken, not read. Split subordinate clauses into separate
      sentences. Prefer active voice.
    - Replace document navigation ("as noted above", "see Section 4", "the
      following table") with a restatement of the actual content.
    - Expand acronyms on first use.
    - Round spoken figures for listenability ONLY when the exact value is also
      shown on screen; otherwise say the figure exactly as written.
    - Add spoken signposts ("there are three reasons — here is the first").

    ═══ OUTPUT ═══
    - `scenes`: each scene is a dict with exactly these string keys:
        "title"     — short on-screen scene label, under 8 words
        "narration" — the words to be read aloud for this scene
      Target the requested scene length; never exceed it by much.
    - `video_title`: a title stating the specific finding, not the document's
      formal name.

    ═══ LENGTH ═══
    - "short": 5-7 scenes. "standard": 8-12 scenes. "long": 14-20 scenes.
    """

    document: str = dspy.InputField(desc="The full text extracted from the user's document.")
    length: str = dspy.InputField(desc="Target script length: short, standard, or long.")
    max_words_per_scene: int = dspy.InputField(desc="Hard ceiling on narration words per scene.")

    video_title: str = dspy.OutputField(desc="Title stating the specific finding.")
    scenes: list[dict[str, str]] = dspy.OutputField(
        desc='Scenes, each {"title": ..., "narration": ...}.'
    )


class DocumentToVideoScript:
    """Document → narration script for the /tools/pdf-to-video-script-generator widget."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.Predict(DocumentToScript)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate(
        self, document: str, length: str = "standard", max_words_per_scene: int = 90
    ) -> dict:
        text, truncated = clamp_document(document)
        res = await self.predictor(
            document=text,
            length=(length or "standard").strip().lower(),
            max_words_per_scene=int(max_words_per_scene or 90),
        )
        return {
            "video_title": (getattr(res, "video_title", "") or "").strip(),
            "scenes": _clean_scenes(getattr(res, "scenes", None), ("title", "narration")),
            "truncated": truncated,
        }


# ─── Document → storyboard ───────────────────────────────────────────────────


class DocumentToSlides(dspy.Signature):
    """
    Turn a document into a slide-by-slide storyboard for a narrated slideshow.
    """

    __doc__ += _FIDELITY + """
    ═══ THE CENTRAL RULE ═══
    - On-screen text and narration are DIFFERENT text. Never put the same
      sentence in both. A viewer reads faster than a narrator speaks, so
      duplicating the text leaves them idle and they disengage.
    - On screen: the claim. Short, declarative, scannable.
    - Narration: the reasoning, evidence, and qualification behind that claim.
    - Numbers are the one deliberate exception: a figure said aloud should also
      appear on screen, because spoken figures are not retained.

    ═══ OUTPUT ═══
    - `slides`: each slide is a dict with exactly these string keys:
        "headline"  — under 8 words, the claim for this slide
        "on_screen" — 2 or 3 short lines separated by " | ", each under 15
                      words. These are what the viewer reads.
        "narration" — what is spoken over this slide. Different words.
    - Aim for one slide per distinct point in the document, cut to the
      requested count.
    """

    document: str = dspy.InputField(desc="The full text extracted from the user's document.")
    slide_count: str = dspy.InputField(desc="Approximate number of slides to produce.")

    deck_title: str = dspy.OutputField(desc="Title for the finished slideshow.")
    slides: list[dict[str, str]] = dspy.OutputField(
        desc='Slides, each {"headline": ..., "on_screen": ..., "narration": ...}.'
    )


class DocumentToStoryboard:
    """Document → storyboard for the /tools/pdf-to-slideshow widget."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.Predict(DocumentToSlides)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate(self, document: str, slide_count: int = 10) -> dict:
        text, truncated = clamp_document(document)
        res = await self.predictor(document=text, slide_count=str(int(slide_count or 10)))
        return {
            "deck_title": (getattr(res, "deck_title", "") or "").strip(),
            "slides": _clean_scenes(
                getattr(res, "slides", None), ("headline", "on_screen", "narration")
            ),
            "truncated": truncated,
        }


def _clean_scenes(raw, keys: tuple[str, ...]) -> list[dict[str, str]]:
    """Coerce the model's list-of-dicts into exactly the keys we promised.

    DSPy gives back whatever the model produced, which is usually right and
    occasionally has a stray key, a missing field, or a non-string value. The
    API contract is fixed, so normalise here rather than letting a response
    model validation error surface as a 500.
    """
    out: list[dict[str, str]] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        row = {k: str(item.get(k, "") or "").strip() for k in keys}
        # A row with no content in the last key (narration) is not a scene.
        if any(row[k] for k in keys):
            out.append(row)
    return out
