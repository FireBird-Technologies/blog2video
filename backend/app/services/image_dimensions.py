"""
Layout → image aspect ratio mapping for AI image generation.
Ensures generated images fit the scene layout without being clipped.
"""

# (template_id, layout_id) -> { "landscape": "W:H", "portrait": "W:H" }
# Omitted layouts default to video aspect (16:9 landscape, 9:16 portrait).
LAYOUT_IMAGE_ASPECT: dict[tuple[str, str], dict[str, str]] = {
    # Default template: image_caption has 16/10 and 1/1 placeholder
    ("default", "image_caption"): {"landscape": "3:2", "portrait": "1:1"},
    # default hero_image is full-bleed → use video aspect (no entry)
    # Newspaper: news_headline uses ~380×300 / 540×440
    ("newspaper", "news_headline"): {"landscape": "4:3", "portrait": "3:4"},
    ("newspaper", "news_timeline"): {"landscape": "3:2", "portrait": "2:3"},
    # Card-style (fixed height) layouts: 3:2 / 2:3 fits most
    ("nightfall", "glass_narrative"): {"landscape": "3:2", "portrait": "2:3"},
    ("nightfall", "glow_metric"): {"landscape": "3:2", "portrait": "2:3"},
    ("nightfall", "glass_stack"): {"landscape": "3:2", "portrait": "2:3"},
    ("gridcraft", "bento_compare"): {"landscape": "3:2", "portrait": "2:3"},
    ("gridcraft", "bento_features"): {"landscape": "3:2", "portrait": "2:3"},
    ("gridcraft", "kpi_grid"): {"landscape": "3:2", "portrait": "2:3"},
    ("gridcraft", "bento_steps"): {"landscape": "3:2", "portrait": "2:3"},
    ("gridcraft", "pull_quote"): {"landscape": "3:2", "portrait": "2:3"},
    ("gridcraft", "bento_hero"): {"landscape": "16:9", "portrait": "9:16"},
    ("gridcraft", "bento_highlight"): {"landscape": "3:2", "portrait": "2:3"},
    ("matrix", "terminal_text"): {"landscape": "3:2", "portrait": "2:3"},
    ("matrix", "glitch_punch"): {"landscape": "3:2", "portrait": "2:3"},
    ("matrix", "awakening"): {"landscape": "3:2", "portrait": "2:3"},
    ("matrix", "fork_choice"): {"landscape": "3:2", "portrait": "2:3"},
}

# OpenAI gpt-image-1 supported sizes
OPENAI_SIZE_LANDSCAPE = "1536x1024"
OPENAI_SIZE_PORTRAIT = "1024x1536"
OPENAI_SIZE_SQUARE = "1024x1024"

# Gemini supported aspect ratios (use as-is when possible)
GEMINI_ASPECT_NORMALIZE: dict[str, str] = {
    "16:10": "3:2",
}


def get_image_aspect_for_layout(
    template_id: str,
    layout_id: str,
    project_aspect_ratio: str,
) -> str:
    """
    Return the best-fit image aspect ratio for the given template, layout, and project aspect.
    Returns a string like "16:9", "9:16", "1:1", "3:2", "2:3", "4:3", "3:4".
    """
    if not template_id or not layout_id:
        return _video_aspect(project_aspect_ratio)
    key = (template_id.strip().lower(), layout_id.strip().lower())
    mapping = LAYOUT_IMAGE_ASPECT.get(key)
    if not mapping:
        return _video_aspect(project_aspect_ratio)
    aspect = project_aspect_ratio.strip().lower() if project_aspect_ratio else "landscape"
    if aspect == "portrait":
        return mapping.get("portrait", "9:16")
    return mapping.get("landscape", "16:9")


def _video_aspect(project_aspect_ratio: str) -> str:
    if project_aspect_ratio and project_aspect_ratio.strip().lower() == "portrait":
        return "9:16"
    return "16:9"


def get_openai_size(aspect_ratio: str) -> str:
    """
    Map aspect ratio string to OpenAI gpt-image-1 size parameter.
    Supported: 1024x1024, 1536x1024, 1024x1536.
    """
    if not aspect_ratio:
        return OPENAI_SIZE_LANDSCAPE
    ar = aspect_ratio.strip().lower()
    if ar == "1:1":
        return OPENAI_SIZE_SQUARE
    if ar in ("9:16", "2:3", "3:4", "4:5"):
        return OPENAI_SIZE_PORTRAIT
    return OPENAI_SIZE_LANDSCAPE


def get_gemini_image_config(aspect_ratio: str) -> dict:
    """
    Return config dict for Gemini image generation: aspectRatio (and optional imageSize).
    Normalize 16:10 -> 3:2 for Gemini's supported set.
    """
    if not aspect_ratio:
        aspect_ratio = "16:9"
    ar = aspect_ratio.strip()
    ar = GEMINI_ASPECT_NORMALIZE.get(ar, ar)
    return {
        "aspect_ratio": ar,
        "image_size": "2k",
    }
