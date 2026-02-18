"""
Regenerate visual_description based on user's editing instruction.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


class RegenerateVisualDescription(dspy.Signature):
    """
    You are an expert video visual designer. The user is editing a scene and has provided an instruction
    about how they want the visuals to change.
    
    ═══ YOUR TASK ═══
    - Generate a new visual_description based on the user's instruction
    - The visual_description describes what should be shown visually in the scene
    - Incorporate the user's requested changes while maintaining coherence with the scene title and display text
    
    ═══ RULES ═══
    - Focus on visual elements: layout, images, animations, text placement, colors, etc.
    - Be specific about what should be shown
    - Output only the visual description text — no labels, no quotes, no preamble
    """

    scene_title: str = dspy.InputField(desc="Title of this scene")
    display_text: str = dspy.InputField(desc="Display text shown on screen")
    current_visual_description: str = dspy.InputField(desc="Current visual description")
    user_instruction: str = dspy.InputField(desc="User's instruction for visual changes")
    
    new_visual_description: str = dspy.OutputField(
        desc="New visual description incorporating the user's changes. Plain text only, no markdown or quotes."
    )


async def regenerate_visual_description(
    current_visual_description: str,
    user_instruction: str,
    scene_title: str = "",
    display_text: str = "",
) -> str:
    """
    Regenerate visual_description based on user's instruction.
    Returns the new visual description, or the original if regeneration fails.
    """
    if not (user_instruction and user_instruction.strip()):
        return current_visual_description or ""

    ensure_dspy_configured()
    predictor = dspy.ChainOfThought(RegenerateVisualDescription)
    predictor_async = dspy.asyncify(predictor)

    try:
        result = await predictor_async(
            scene_title=scene_title or "",
            display_text=display_text or "",
            current_visual_description=current_visual_description or "",
            user_instruction=user_instruction.strip(),
        )
        out = (result.new_visual_description or "").strip()
        if out:
            return out
        return current_visual_description or ""
    except Exception as e:
        print(f"[VISUAL_DESC] Failed to regenerate visual description: {e}")
        return current_visual_description or ""
