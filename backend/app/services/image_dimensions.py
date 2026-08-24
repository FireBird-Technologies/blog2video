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
    # newscast anchor_narrative: image PANEL beside the text (510×626 landscape,
    # ≈4:5) and a full-width band above it in portrait (662×505, ≈4:3). Previously
    # unmapped, so it was fed 16:9 for a slot that is not wide in either case.
    ("newscast", "anchor_narrative"): {"landscape": "4:5", "portrait": "4:3"},
    # Variant image slots that differ in SHAPE from their base need an explicit
    # entry — the exact key wins over the base fallback below.
    # newscast opening__v2 "Split Feed": the image is a 46%-wide full-height feed
    # panel (base `opening` is full-bleed), so it wants a tall source.
    ("newscast", "opening__v2"): {"landscape": "9:16", "portrait": "16:9"},
    # newscast anchor_narrative__v2 "Studio Desk": the plate is full-bleed, but the
    # copy band + chrome hide the bottom ~60%, leaving a WIDE visible strip above
    # the band (1280×282 landscape ≈ 4.5:1, 720×549 portrait ≈ 1.3:1). Generate for
    # the strip, not the canvas, or the subject lands behind the band.
    ("newscast", "anchor_narrative__v2"): {"landscape": "16:9", "portrait": "1:1"},
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
    # ── spotlight variant slots that differ in SHAPE from their base ──
    # spotlight impact_title__v2 "Marquee" and statement__v2 "Pull Quote" both put
    # the image in a TALL 3:4 plate beside the copy (the bases use wide cards).
    ("spotlight", "impact_title__v2"): {"landscape": "3:4", "portrait": "16:9"},
    ("spotlight", "statement__v2"): {"landscape": "3:4", "portrait": "16:9"},
    # Mosaic: mosaic_text uses 46% width for image panel (vertical orientation)
    ("mosaic", "mosaic_text"): {"landscape": "9:16", "portrait": "9:16"},
    # Chronicle: page-shaped and banner image slots
    ("chronicle", "parchment_scroll"): {"landscape": "3:4", "portrait": "3:2"},
    ("chronicle", "illuminated_quote"): {"landscape": "3:4", "portrait": "3:2"},
    ("chronicle", "versus_folio"): {"landscape": "3:4", "portrait": "16:9"},
    ("chronicle", "ledger_stats"): {"landscape": "3:2", "portrait": "3:2"},
    # chronicle map_reveal is near full-bleed → use video aspect (no entry)

    # LaDuc: image panels are tall vertical strips on deep_dive and thesis_statement.
    # deep_dive landscape panel: 17/44 ≈ 0.39 → 9:16 (closest supported tall ratio).
    # thesis_statement landscape panel: 17/36 ≈ 0.47 → 9:16.
    # All other laduc layouts with images are full-bleed → video aspect (no entry needed).
    # Key uses "laduc" as a prefix sentinel — matched via startswith() in get_image_aspect_for_layout.
    ("laduc", "deep_dive"):        {"landscape": "9:16", "portrait": "9:16"},
    ("laduc", "thesis_statement"): {"landscape": "9:16", "portrait": "9:16"},
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
    tid = template_id.strip().lower()
    lid = layout_id.strip().lower()
    mapping = LAYOUT_IMAGE_ASPECT.get((tid, lid))
    # Visual variants (`news_headline__v2`) inherit their base layout's image box
    # unless they declare their own entry above — exact key wins, so a variant that
    # genuinely reshapes its image slot can override just by adding one.
    if not mapping:
        from app.services.template_service import resolve_base_layout

        base_lid = resolve_base_layout(tid, lid)
        if base_lid != lid:
            mapping = LAYOUT_IMAGE_ASPECT.get((tid, base_lid))
    # Substring fallback: any template_id containing "laduc" (e.g. "laduc_custom_7", "crafted_laduc_3") uses the ("laduc", layout) sentinel
    if not mapping and "laduc" in tid:
        mapping = LAYOUT_IMAGE_ASPECT.get(("laduc", lid))
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


# GLM-Image sizes: each side 512-2048 and divisible by 32.
GLM_SIZE_BY_ASPECT: dict[str, str] = {
    "16:9": "1344x768",
    "9:16": "768x1344",
    "1:1": "1024x1024",
    "3:2": "1248x832",
    "2:3": "832x1248",
    "4:3": "1152x896",
    "3:4": "896x1152",
}
GLM_SIZE_LANDSCAPE = "1344x768"


def get_glm_size(aspect_ratio: str) -> str:
    """
    Map aspect ratio string to a GLM-Image size (WxH), each side 512-2048 and
    divisible by 32. Falls back to landscape 16:9 for unknown ratios.
    """
    if not aspect_ratio:
        return GLM_SIZE_LANDSCAPE
    ar = aspect_ratio.strip().lower()
    ar = GEMINI_ASPECT_NORMALIZE.get(ar, ar)
    return GLM_SIZE_BY_ASPECT.get(ar, GLM_SIZE_LANDSCAPE)


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
