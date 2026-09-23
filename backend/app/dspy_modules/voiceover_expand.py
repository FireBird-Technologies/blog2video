import dspy

from app.dspy_modules import ensure_dspy_configured
from app.observability.logging import get_logger

logger = get_logger(__name__)


class ExpandNarrationToVoiceover(dspy.Signature):
    """
    You are an expert video narrator.

    The user provides short display text shown on screen.
    Your task is to lightly rephrase it into a more natural spoken voiceover.

    ═══ YOUR TASK ═══
    - Reword phrases slightly to improve spoken flow
    - Preserve the original meaning exactly
    - Do NOT add new facts or explanations
    - Do NOT expand content significantly

    ═══ STRICT LENGTH RULES (CRITICAL) ═══
    - Voiceover must not be very lengthy compared to text length
    - Maximum allowed size: 1.3× original word count
    - Prefer slightly longer or equal length when possible
    - Follow a specific word limit or range in style_guidance.
    - Brief/short with no number means 10–18 words.
    - Longer/more detailed with no number means 15–30 words.
    - If style_guidance provides no length direction, use 12–25 words.
    - Keep output medium-length and naturally speakable.

    ═══ WRITING STYLE (CRITICAL) ═══
    - Treat style_guidance as the authoritative source for tone, pacing, phrasing,
      transitions, and narration length.
    - Do not infer writing behavior from the video_style identifier.
    - Preserve a natural spoken tone consistent with style_guidance.
    - Clean phrasing.
    - No elaboration beyond what fits the style.

    ═══ LANGUAGE RULE (CRITICAL) ═══
    - content_language is the language of the source content. Output expanded_voiceover EXCLUSIVELY in that language.
    - Do NOT translate to English if the source is in another language.

    ═══ PRONOUNCIATION RULE (CRITICAL) ═══
    - If an abbreviation is popularly pronounced as a word (e.g. SaaS → "sass", NASA → "nasa", NVIDIA → "en-vidia"), write it phonetically so TTS reads it as a word, not letter-by-letter.
    - Decimal numbers must be written with "point" between the parts. For example, 3.5 → "three point five", 9.875 → "nine point eight seven five".

    ═══ EMOTIONAL DELIVERY (ONLY when expressive is true) ═══
    - Write the line to convey energy and excitement, like an enthusiastic narrator.
    - Add light emphasis words where natural (really, so, absolutely, truly).
    - End emphatic sentences with an exclamation mark ("!").
    - Do NOT use capitalization for emphasis. Never write a whole word in all-capitals — the v3
      model reads an all-caps word letter-by-letter like an acronym (F-O-R-E-V-E-R). Use normal
      capitalization; let the emphasis words and "!" carry the energy.
    - Do NOT add new facts and stay within the length rules — emphasis only changes delivery, not content.
    - When expressive is false, keep the current neutral phrasing (no added "!").
    Output ONLY the final narration text.
    No labels. No quotes. No commentary.
    """

    scene_title: str = dspy.InputField(desc="Title of this scene (for context)")
    display_text: str = dspy.InputField(desc="Short display text shown on screen (1-2 sentences)")
    video_style: str = dspy.InputField(
        desc="Stable style identifier for routing and diagnostics"
    )
    style_guidance: str = dspy.InputField(
        desc=(
            "Authoritative saved writing rules for tone, pacing, phrasing, transitions, "
            "and narration length. No length direction means 12-25 words."
        )
    )
    content_language: str = dspy.InputField(
        desc="Language of the source content (e.g. 'English', 'Spanish'). Output expanded_voiceover in this language."
    )
    expressive: bool = dspy.InputField(
        desc="When true, write the narration with emotional energy (emphasis words + exclamation marks; no capitalization for emphasis). When false, keep neutral phrasing."
    )

    expanded_voiceover: str = dspy.OutputField(
        desc="Slightly expanded voiceover narration (only 1-2 sentences longer than display text, or 20-30% more words). Plain text only, no markdown or quotes."
    )


# Module-level singleton predictor (avoid re-creating on every call)
_predictor_async = None


def _get_predictor():
    global _predictor_async
    if _predictor_async is None:
        ensure_dspy_configured()
        _predictor_async = dspy.asyncify(
            dspy.ChainOfThought(ExpandNarrationToVoiceover)
        )
    return _predictor_async


async def expand_narration_to_voiceover(
    display_text: str,
    scene_title: str = "",
    video_style: str = "explainer",
    style_guidance: str = "",
    content_language: str = "English",
    expressive: bool = False,
) -> str:
    """
    Slightly expand a short display text into a natural voiceover narration.
    style_guidance shapes the tone and narration length.
    content_language (e.g. 'English', 'Spanish') ensures output is in the source language.
    expressive=True writes the line with emotional energy (emphasis words, "!", CAPS) — used by
    the paid Advanced/v3 path. Returns the expanded text, or the original text if expansion fails.
    """
    if not (display_text and display_text.strip()):
        return ""

    # If display text is already long, skip expansion — but in expressive mode always run so the
    # emotional rewrite (emphasis / "!" / CAPS) is applied regardless of length.
    word_count = len(display_text.split())
    if word_count > 50 and not expressive:
        return " ".join(display_text.strip().split())

    predictor_async = _get_predictor()

    style = (video_style or "explainer").strip().lower() or "explainer"
    lang = (content_language or "English").strip()
    try:
        result = await predictor_async(
            scene_title=scene_title or "",
            display_text=display_text.strip(),
            video_style=style,
            style_guidance=(style_guidance or "").strip(),
            content_language=lang,
            expressive=expressive,
        )
        out = (result.expanded_voiceover or "").strip()
        if out:
            return " ".join(out.split())
        return " ".join(display_text.strip().split())
    except Exception as e:
        logger.warning(
            "[VOICEOVER_EXPAND] Failed to expand narration: %s",
            e,
        )
        return " ".join(display_text.strip().split())
