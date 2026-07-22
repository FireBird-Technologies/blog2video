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

    The image_description is ALWAYS the subject of the final prompt. Scene context
    is read-only supporting material used only to fill in style/setting details that
    are consistent with the description. Never make the scene context (or anything
    resembling an existing image, URL, or asset reference) the subject of the image.
    If the description is short or vague, expand it into a concrete, photographable
    scene — do not substitute the scene metadata as the subject.
    """

    image_description: str = dspy.InputField(
        desc="What the user wants the image to show — the ONLY subject of the final prompt",
    )
    scene_context: str = dspy.InputField(
        desc="Read-only scene metadata (title, narration, layout, props). Supporting style/setting only; never the subject.",
    )
    refined_prompt: str = dspy.OutputField(
        desc="Single detailed image prompt for an image model; no markdown",
    )


# Below this many "meaningful" words the description carries too little signal to
# anchor the image, and the refiner tends to grab the scene context as the subject
# instead. For such vague inputs we withhold the scene context entirely.
_VAGUE_WORD_THRESHOLD = 3
# Filler that adds no visual subject ("give me an image", "create an image").
_VAGUE_STOPWORDS = frozenset({
    "a", "an", "the", "give", "gimme", "get", "make", "create", "generate",
    "please", "some", "me", "us", "image", "images", "picture", "pictures",
    "photo", "photos", "pic", "pics", "of", "for", "to", "want", "need", "show",
})


def _is_vague_description(text: str) -> bool:
    """True when the description has too few meaningful (non-filler) words to
    serve as a reliable image subject."""
    words = [w for w in text.lower().split() if w.strip(".,!?;:").isalpha()]
    meaningful = [w for w in words if w.strip(".,!?;:") not in _VAGUE_STOPWORDS]
    return len(meaningful) < _VAGUE_WORD_THRESHOLD


def refine_image_prompt(image_description: str, scene_context: str = "") -> str:
    """
    Refine the user's image description into an image generation prompt.
    Prefers image_description; scene_context is incorporated only when it
    clearly supports the description. On failure, returns image_description.

    When the description is too vague to be a reliable subject, the scene
    context is withheld so the refiner expands the description itself rather
    than reproducing the scene's existing/placeholder image.
    """
    primary = (image_description or "").strip()
    if not primary:
        return ""

    if _is_vague_description(primary):
        logger.info(
            "[IMAGE_PROMPT] Vague description %r — withholding scene context.",
            primary,
        )
        context = "(No scene metadata.)"
    else:
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
            logger.info("[IMAGE_PROMPT] Refined %r -> %r", primary, out[:500])
            return out
        return primary
    except Exception as e:
        logger.warning(
            "[IMAGE_PROMPT] Failed to refine prompt: %s",
            e,
        )
        return primary
