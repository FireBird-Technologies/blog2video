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
    - Length MUST follow style-specific word ranges:
      - explainer: 15–25 words
      - promotional: 15–20 words
      - storytelling: 15–30 words
    - Keep output medium-length and naturally speakable.

    ═══ STYLE-SPECIFIC RULES (CRITICAL — STRICTLY follow video_style) ═══
    - Treat video_style as a HARD CONSTRAINT.
    - Do NOT mix tones across styles.

    EXPLAINER (DOCUMENTARY MODE):
    - Voice must sound like a polished documentary narrator: factual, composed, insightful.
    - Use clear transitions and context-setting phrasing.
    - Avoid classroom/lecture commands and avoid ad-like hype.

    PROMOTIONAL:
    - Voice must sound like a persuasive advertisement/promo.
    - Keep a benefit-first, action-oriented cadence.
    - Use confident, high-conviction phrasing with momentum.

    STORYTELLING:
    - Voice must sound like a human storyteller narrating events in sequence.
    - Keep continuity and progression cues naturally (then, next, after that, finally).
    - Maintain emotional flow without becoming promotional or instructional.

    GENERAL STYLE GUARDRAILS:
    - Natural spoken tone for the selected style.
    - Clean phrasing.
    - No elaboration beyond what fits the style.

    ═══ LANGUAGE RULE (CRITICAL) ═══
    - content_language is the language of the source content. Output expanded_voiceover EXCLUSIVELY in that language.
    - Do NOT translate to English if the source is in another language.

    Output ONLY the final narration text.
    No labels. No quotes. No commentary.
    """

    scene_title: str = dspy.InputField(desc="Title of this scene (for context)")
    display_text: str = dspy.InputField(desc="Short display text shown on screen (1-2 sentences)")
    video_style: str = dspy.InputField(
        desc="Video style: explainer (documentary/informative), promotional (persuasive, benefit-focused), storytelling (narrative). Match tone in the voiceover."
    )
    content_language: str = dspy.InputField(
        desc="Language of the source content (e.g. 'English', 'Spanish'). Output expanded_voiceover in this language."
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
    content_language: str = "English",
) -> str:
    """
    Slightly expand a short display text into a natural voiceover narration.
    video_style (explainer | promotional | storytelling) shapes the tone.
    content_language (e.g. 'English', 'Spanish') ensures output is in the source language.
    Returns the expanded text, or the original text if expansion fails.
    """
    if not (display_text and display_text.strip()):
        return ""

    # If display text is already long, skip expansion.
    word_count = len(display_text.split())
    if word_count > 50:
        return " ".join(display_text.strip().split())

    predictor_async = _get_predictor()

    style = (video_style or "explainer").strip().lower() or "explainer"
    lang = (content_language or "English").strip()
    try:
        result = await predictor_async(
            scene_title=scene_title or "",
            display_text=display_text.strip(),
            video_style=style,
            content_language=lang,
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
