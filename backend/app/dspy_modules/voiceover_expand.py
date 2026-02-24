import dspy

from app.dspy_modules import ensure_dspy_configured


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

    ═══ STYLE RULES ═══
    - Match the video_style tone: explainer = clear and educational; promotional = persuasive, benefit-focused; storytelling = narrative, engaging.
    - Natural spoken tone for that style
    - Clean phrasing
    - No elaboration beyond what fits the style

    Output ONLY the final narration text.
    No labels. No quotes. No commentary.
    """

    scene_title: str = dspy.InputField(desc="Title of this scene (for context)")
    display_text: str = dspy.InputField(desc="Short display text shown on screen (1-2 sentences)")
    video_style: str = dspy.InputField(
        desc="Video style: explainer (educational), promotional (persuasive, benefit-focused), storytelling (narrative). Match tone in the voiceover."
    )

    expanded_voiceover: str = dspy.OutputField(
        desc="Slightly expanded voiceover narration (only 1-2 sentences longer than display text, or 20-30% more words). Plain text only, no markdown or quotes."
    )


async def expand_narration_to_voiceover(
    display_text: str,
    scene_title: str = "",
    video_style: str = "explainer",
) -> str:
    """
    Slightly expand a short display text into a natural voiceover narration.
    video_style (explainer | promotional | storytelling) shapes the tone.
    Returns the expanded text, or the original text if expansion fails.
    """
    if not (display_text and display_text.strip()):
        return ""
    
    # If display text is already long (more than 50 words), assume it's already expanded enough
    word_count = len(display_text.split())
    if word_count > 50:
        return display_text.strip()

    ensure_dspy_configured()
    predictor = dspy.ChainOfThought(ExpandNarrationToVoiceover)
    predictor_async = dspy.asyncify(predictor)

    style = (video_style or "explainer").strip().lower() or "explainer"
    try:
        result = await predictor_async(
            scene_title=scene_title or "",
            display_text=display_text.strip(),
            video_style=style,
        )
        out = (result.expanded_voiceover or "").strip()
        if out:
            return out
        return display_text.strip()
    except Exception as e:
        print(f"[VOICEOVER_EXPAND] Failed to expand narration: {e}")
        return display_text.strip()
