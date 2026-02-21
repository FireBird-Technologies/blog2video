"""
Single-scene narration rewrite for the regenerate flow.
When the user's instruction asks to change the spoken text, we rewrite the narration
and then the voiceover is regenerated from the new text.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


class RewriteNarrationFromInstruction(dspy.Signature):
    """
    You are an expert video script editor. The user is editing ONE scene and has given an instruction.
    
    ═══ YOUR TASK ═══
    - If the user's instruction is about changing the SPOKEN NARRATION (tone, length, rephrase,
      add/remove content, make it shorter/longer, more formal/casual, fix a fact, emphasize something):
      → Rewrite the narration according to the instruction. Keep the same general meaning and
        scene purpose unless the user explicitly asks to change it. Output the new text in updated_narration.
    - If the user's instruction is ONLY about VISUAL/LAYOUT (e.g. "use glass image layout",
      "add an image", "remove image", "change to cinematic title", "make it more dramatic visually"):
      → Return the current_narration UNCHANGED in updated_narration (do not modify the spoken text).
    
    ═══ RULES ═══
    - Preserve scene_title context: the narration should still fit the scene.
    - Output only the narration text in updated_narration — no labels, no quotes, no preamble.
    - If unclear whether the user wants narration or visual change, prefer keeping narration unchanged
      unless the instruction clearly mentions words like "narration", "script", "say", "text", "rephrase",
      "shorter", "longer", "tone", "simplify", "add detail", etc.
    """

    scene_title: str = dspy.InputField(desc="Title of this scene (for context)")
    current_narration: str = dspy.InputField(desc="Current spoken narration for this scene")
    user_instruction: str = dspy.InputField(
        desc="The user's edit instruction (e.g. 'make it shorter', 'use glass image', 'rephrase more casually')"
    )

    reasoning: str = dspy.OutputField(
        desc="One sentence: whether the instruction is about narration (rewrite) or only visual/layout (keep unchanged), and what you did."
    )
    updated_narration: str = dspy.OutputField(
        desc="The narration text to use: either your rewritten version or the exact current_narration if no narration change was requested. Plain text only, no markdown or quotes."
    )


async def rewrite_narration_if_requested(
    current_narration: str,
    user_instruction: str,
    scene_title: str,
) -> str:
    """
    If the user's instruction asks to change the narration, return a rewritten version.
    Otherwise return the current narration unchanged.
    On any failure, returns current_narration.
    """
    if not (user_instruction and user_instruction.strip()):
        return current_narration or ""
    if not (current_narration and current_narration.strip()):
        return current_narration or ""

    ensure_dspy_configured()
    predictor = dspy.ChainOfThought(RewriteNarrationFromInstruction)
    predictor_async = dspy.asyncify(predictor)

    try:
        result = await predictor_async(
            scene_title=scene_title,
            current_narration=current_narration,
            user_instruction=user_instruction.strip(),
        )
        out = (result.updated_narration or "").strip()
        if out:
            return out
        return current_narration
    except Exception:
        return current_narration
