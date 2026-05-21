"""
Refine a user image description (+ optional scene context) into a strong image
generation prompt using DSPy.
"""
import dspy

from app.dspy_modules import ensure_dspy_configured
from app.observability.logging import get_logger

logger = get_logger(__name__)


class RefineImagePrompt(dspy.Signature):
    """
    Turn the user's image description into a strong image-generation prompt.
    Scene context is optional supporting material only.
    """

    image_description: str = dspy.InputField(
        desc="What the user wants the image to show — primary subject of the final prompt",
    )
    scene_context: str = dspy.InputField(
        desc="Read-only scene metadata (title, narration, layout, props). Use only when relevant.",
    )
    refined_prompt: str = dspy.OutputField(
        desc="Single detailed image prompt for an image model; no markdown",
    )


def refine_image_prompt(image_description: str, scene_context: str = "") -> str:
    """
    Refine the user's image description into an image generation prompt.
    Prefers image_description; scene_context is incorporated only when it
    clearly supports the description. On failure, returns image_description.
    """
    primary = (image_description or "").strip()
    if not primary:
        return ""

    context = (scene_context or "").strip() or "(No scene metadata.)"

    ensure_dspy_configured()
    predictor = dspy.Predict(RefineImagePrompt)

    try:
        result = predictor(
            image_description=primary,
            scene_context=context,
        )
        out = (result.refined_prompt or "").strip()
        if out:
            return out
        return primary
    except Exception as e:
        logger.warning(
            "[IMAGE_PROMPT] Failed to refine prompt: %s",
            e,
        )
        return primary
