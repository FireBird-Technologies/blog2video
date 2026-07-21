"""
Single-scene title rewrite for the regenerate flow.
When the user's instruction changes what the scene is about, we rewrite the scene
title to match the (already rewritten) narration and the user's instruction.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


class RewriteTitleFromInstruction(dspy.Signature):
    """
    You are an expert video scene editor. The user is editing ONE scene and has given
    an instruction. The scene's narration has already been updated to reflect it.

    ═══ YOUR TASK ═══
    - Produce a short, punchy scene title that fits the updated narration and the
      user's instruction.
    - Keep it concise (a few words, headline-style) — it labels a single scene, it is
      not a sentence.

    ═══ RULES ═══
    - Base the title on the updated narration and the user's intent.
    - Output only the title text in updated_title — no labels, no quotes, no preamble.
    - If nothing about the scene's subject changed, you may return the current_title.
    """

    current_title: str = dspy.InputField(desc="Current title of this scene")
    narration: str = dspy.InputField(desc="Updated spoken narration for this scene")
    user_instruction: str = dspy.InputField(
        desc="The user's edit instruction (e.g. 'make it about the café count, more upbeat')"
    )

    updated_title: str = dspy.OutputField(
        desc="The new short scene title. Plain text only, no markdown or quotes."
    )


async def rewrite_title_if_requested(
    current_title: str,
    narration: str,
    user_instruction: str,
) -> str:
    """
    Rewrite the scene title to match the updated narration and the user's instruction.
    On empty output or any failure, returns current_title unchanged.
    """
    if not (user_instruction and user_instruction.strip()):
        return current_title or ""

    ensure_dspy_configured()
    predictor = dspy.ChainOfThought(RewriteTitleFromInstruction)
    predictor_async = dspy.asyncify(predictor)

    try:
        result = await predictor_async(
            current_title=current_title or "",
            narration=narration or "",
            user_instruction=user_instruction.strip(),
        )
        out = (result.updated_title or "").strip()
        if out:
            return out
        return current_title or ""
    except Exception:
        return current_title or ""
