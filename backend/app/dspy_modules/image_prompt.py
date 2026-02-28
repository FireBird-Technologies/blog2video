"""
Refine scene text (idea) into a strong image generation prompt using DSPy.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured


class RefineImagePrompt(dspy.Signature):
    """
    Refine a simple idea into a strong image generation prompt.
    """
    idea = dspy.InputField(desc="Simple text idea")
    refined_prompt = dspy.OutputField(desc="Refined image prompt")


def refine_image_prompt(idea: str) -> str:
    """
    Refine scene text (title + narration) into an image generation prompt.
    Returns the refined prompt, or the original idea on failure.
    """
    if not (idea and idea.strip()):
        return idea or ""

    ensure_dspy_configured()
    predictor = dspy.Predict(RefineImagePrompt)

    try:
        result = predictor(idea=idea.strip())
        out = (result.refined_prompt or "").strip()
        if out:
            return out
        return idea.strip()
    except Exception as e:
        print(f"[IMAGE_PROMPT] Failed to refine prompt: {e}")
        return idea.strip()
