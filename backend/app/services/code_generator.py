"""
AI code generator — uses DSPy with Refine for self-correcting Remotion component generation.

Each scene is generated individually via DSPy ChainOfThought, wrapped in dspy.Refine
so failed validations trigger targeted feedback + retry on just the failing scene.
All 5 scenes run in parallel via asyncio.gather.
"""

import asyncio
import json
import logging
import re
import time

import dspy

from app.dspy_modules import ensure_dspy_configured, get_custom_lm, get_theme_lm
from app.models.custom_template import CustomTemplate
from app.services.code_validator import clean_code, validate_component_code

logger = logging.getLogger(__name__)

REFINE_N = 2          # Max 3 attempts per scene (1 initial + 2 retries) — sufficient since most pass on attempt 1-2
NUM_CONTENT_VARIANTS = 5  # 5 specialized content designs — each optimized for a content type family


# ─── DSPy Signatures ─────────────────────────────────────────


class GenerateDesignSystem(dspy.Signature):
    """Given a brand's visual identity, design a concrete visual system for video scenes.

    Your design system must be SPECIFIC — include actual CSS values, not descriptions.
    Every decision should be derived from the brand's unique identity.
    Keep output concise — under 1500 characters. Only concrete CSS values, no prose.

    Output a design system covering ONLY these 3 areas:
    - Background treatment: exact CSS (e.g. "radial-gradient(circle at 20% 50%, rgba(0,235,121,0.08), transparent 60%)")
    - Card/container style: border-radius, box-shadow, border, background CSS values
    - Text treatment: title/body font sizes, text-shadow or glow CSS values, color usage rules

    Do NOT include: spring configs, animation physics, decorative elements, or entrance patterns.
    Those are creative choices each scene makes independently.
    """

    brand_context: str = dspy.InputField(desc="Brand identity: name, colors, fonts, style, patterns, personality")
    design_system: str = dspy.OutputField(desc="Concise design system (under 1500 chars) with CSS values for backgrounds, cards, and text only")


class GenerateSceneCode(dspy.Signature):
    """Generate a single Remotion video scene component for a brand.

    Write a React component assigned to `const SceneComponent` that renders
    an animated video scene using the Remotion framework.

    Rules:
    - Write a component assigned to `const SceneComponent`
    - NO import/export statements — all APIs are pre-injected as globals
    - Component must be deterministic (same frame = same output)
    - NEVER use: eval, fetch, document, window, process, require, import, setTimeout, setInterval
    - Target 200-350 lines. Spend tokens on animation logic (springs, interpolations, stagger), not verbose inline styles.
    - Be CREATIVE and UNIQUE — invent original layouts and animation combinations.
    - Every scene should feel designed by a different artist — NEVER repeat common patterns.
    - Follow the design_system for visual styling (colors, cards, backgrounds, text treatment).
    - Invent your OWN unique spring physics and animation timing — each scene should have distinctly different motion feel.

    Available APIs (pre-injected as globals, do NOT import):
    - React, React.createElement, React.useState, React.useMemo
    - useCurrentFrame(), useVideoConfig() → { fps, width, height, durationInFrames }
    - interpolate(frame, inputRange, outputRange, options?)
    - spring({ frame, fps, config: { damping, stiffness, mass }?, from?, to? })
    - Easing: Easing.bezier(x1,y1,x2,y2), Easing.inOut(Easing.ease)
    - AbsoluteFill, Sequence, Img, random(seed)

    Component Props:
    { displayText, narrationText, imageUrl?, sceneIndex, totalScenes,
      logoUrl?, brandImages?, brandColors: { primary, secondary, accent, background, text },
      aspectRatio: "landscape" | "portrait",
      titleFontSize?: number, descriptionFontSize?: number,
      contentType?: "plain"|"bullets"|"metrics"|"code"|"quote"|"comparison"|"timeline"|"steps",
      bullets?: string[], metrics?: {value,label,suffix?}[], codeLines?: string[],
      codeLanguage?: string, quote?: string, quoteAuthor?: string,
      comparisonLeft?: {label,description}, comparisonRight?: {label,description},
      timelineItems?: {label,description}[], steps?: string[] }

    CRITICAL Data Rules:
    - ALL displayed text MUST come from props — NEVER hardcode sample/placeholder content.
    - Use props.titleFontSize || 48 for headings, props.descriptionFontSize || 24 for body.
    - Fall back to props.displayText when structured fields are absent.

    Image Handling:
    - When props.imageUrl exists: MUST use Img with animated entrance (spring scale + opacity),
      accent boxShadow glow, and minimum 40% viewport coverage. Never just static placement.
    - When props.imageUrl is undefined: fill space with decorative elements, never leave a gap.

    Forbidden Patterns:
    - NEVER render sceneIndex/totalScenes as visible UI (no counters, progress bars).
    - NEVER render contentType as visible text, label, badge, or category indicator.
    - NEVER create local arrays with hardcoded sample content.

    Layout Rules (CRITICAL — scenes must fill the screen):
    - Content MUST span at least 80% of the viewport width. NEVER leave more than 20% empty.
    - Use padding: 40-60px (NOT 80+). Large padding wastes screen space.
    - For text-heavy scenes: use textAlign 'center' or full-width layouts, NOT left-aligned with maxWidth 50-60%.
    - For split layouts: both halves must contain content. Never have an empty right half.
    - Headings should use textAlign 'center' unless the composition specifically requires left-alignment.
    - Cards/grids should stretch to fill available width with flexWrap or CSS grid.

    Animation Quality Rules (CRITICAL — match motion design studio polish):
    - MUST use at least 3 DIFFERENT spring configs (vary damping 8-25, stiffness 60-200, mass 0.6-1.5)
    - MUST include staggered text reveal — split text and animate each piece with offset timing.
      Technique ideas: word-by-word, line-by-line, character-level, phrase chunks. Be inventive.
    - MUST include at least one decorative ambient element (gradient orbs, blurred shapes, floating accents, subtle SVG patterns)
    - When props.imageUrl exists: animate with spring-driven scale + opacity + depth shadow. Be creative with entrance direction and timing.
    - Staggered reveals: elements appear sequentially, not all at once
    - Portrait/landscape awareness: check props.aspectRatio and adjust layout
    - Use brandColors throughout for brand integration
    - Use Easing (bezier or inOut) for polished animation curves
    - AVOID defaulting to simple opacity+translateY for everything — use scale, rotation, blur, clip-path, skew, or custom spring combos

    Your creative_direction specifies content specialization and spatial composition.
    Follow it closely — it determines what content to render and how to lay it out.

    Landscape: 1920x1080, Portrait: 1080x1920, 90-150 frames at 30fps.
    """

    brand_context: str = dspy.InputField(desc="Brand name, colors, fonts, style, category, personality")
    design_system: str = dspy.InputField(desc="Shared visual styling (colors, cards, backgrounds, text) — follow for consistency. Invent your OWN spring physics and animations.")
    scene_type: str = dspy.InputField(desc="'intro', 'content', or 'outro'")
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes being generated")
    creative_direction: str = dspy.InputField(desc="Content specialization, spatial composition, and concrete rendering examples for this scene")

    code: str = dspy.OutputField(desc="Complete SceneComponent code (const SceneComponent = (props) => { ... };)")


# ─── Reward function for dspy.Refine ──────────────────────────

def _scene_reward(args, pred) -> float:
    """Score a generated scene. Used by dspy.Refine for self-correction."""
    raw_code = pred.code or ""

    # Clean AI artifacts (fences, imports) then validate
    code = clean_code(raw_code)

    # Must pass validation (hard requirement)
    valid, err = validate_component_code(code)
    if not valid:
        print(f"[F7-DEBUG] [REFINE] FAILED: {err}")
        return 0.0

    score = 0.3  # Base for passing validation
    line_count = code.count("\n") + 1

    # Animation depth (0.25 max) — reward MULTIPLE layered animations
    anim_count = code.count("interpolate(") + code.count("spring(")
    if anim_count >= 5:
        score += 0.25
    elif anim_count >= 3:
        score += 0.15
    elif anim_count >= 1:
        score += 0.05

    # Visual effects (0.15 max) — reward decorative elements
    has_glow = "blur(" in code or "textShadow" in code
    has_gradient = "linear-gradient" in code or "radial-gradient" in code
    has_decoration = "borderRadius" in code and "position" in code and "absolute" in code
    has_svg = "<svg" in code or "<circle" in code or "<path" in code
    effects = sum([has_glow, has_gradient, has_decoration, has_svg])
    score += min(0.15, effects * 0.05)

    # Brand color depth (0.15 max) — reward using brand colors throughout
    brand_refs = code.count("brandColors")
    if brand_refs >= 4:
        score += 0.15
    elif brand_refs >= 2:
        score += 0.10
    elif brand_refs >= 1:
        score += 0.05

    # Responsive awareness (0.05)
    if "aspectRatio" in code or "portrait" in code:
        score += 0.05

    # Image handling (0.10 bonus / -0.15 penalty) — scenes MUST handle imageUrl
    if "imageUrl" in code and "Img" in code:
        score += 0.05
        # Bonus for animated image entrance (not just static placement)
        if re.search(r'(opacity|transform|scale).*imageUrl|imageUrl.*?(opacity|transform|scale)', code, re.DOTALL):
            score += 0.05
    elif "imageUrl" not in code:
        # Scene completely ignores imageUrl — penalize since images won't render
        score -= 0.15

    # Structured content rendering (0.15) — reward actual conditional rendering, not just keyword presence
    has_content_branch = bool(re.search(r'contentType\s*[=!]==|switch\s*\(\s*(?:props\.)?contentType', code))
    map_keywords = ("bullets?.map", "metrics?.map", "steps?.map", "timelineItems?.map", "codeLines?.map", "comparisonLeft", "comparisonRight")
    has_map_calls = sum(1 for kw in map_keywords if kw in code)
    if has_content_branch and has_map_calls >= 2:
        score += 0.15
        pass  # structured content bonus
    elif has_content_branch and has_map_calls >= 1:
        score += 0.10
    elif has_content_branch:
        score += 0.05

    # Easing usage (0.05) — polished animation curves over linear interpolation
    if "Easing." in code:
        score += 0.05

    # Penalize hardcoded sample data arrays (-0.15)
    hardcoded_array = re.search(
        r'(?:const|let|var)\s+\w+\s*=\s*\[[\s\S]{20,}?(?:text|icon|label|description)\s*:',
        code
    )
    if hardcoded_array and not re.search(r'=\s*props\.', code[hardcoded_array.start():hardcoded_array.start()+100]):
        score -= 0.15
        pass  # hardcoded data penalty

    # Penalize rendering contentType as visible text (-0.10)
    if re.search(r'>\s*\{[^}]*contentType[^}]*\}', code):
        score -= 0.10
        pass  # contentType visible penalty

    # Penalize scene counters / progress indicators (-0.15)
    if re.search(r'sceneIndex.*totalScenes|totalScenes.*sceneIndex', code):
        # Check if it's used for VISIBLE UI (not just logic)
        if re.search(r'sceneIndex\s*\+\s*1.*totalScenes|of.*totalScenes|\$\{.*sceneIndex', code):
            score -= 0.15
            pass  # scene counter penalty

    # Layout compliance bonus (0.10) — reward following the assigned composition
    creative_dir = args.get("creative_direction", "") if isinstance(args, dict) else getattr(args, "creative_direction", "")
    if "FULL-BLEED" in creative_dir:
        # Should NOT have side-by-side split; should use image as background
        has_split = bool(re.search(r'width:\s*["\']?(4[0-9]|5[0-5])%', code))
        if not has_split and ("objectFit" in code or "object-fit" in code) and ("100%" in code or "cover" in code):
            score += 0.10
            pass  # FULL-BLEED bonus
        elif has_split:
            score -= 0.10
            pass  # FULL-BLEED split penalty
    elif "STACKED-VERTICAL" in creative_dir:
        has_column = "column" in code and ("flexDirection" in code or "flex-direction" in code)
        if has_column:
            score += 0.10
            pass  # STACKED-VERTICAL bonus
    elif "MULTI-CARD" in creative_dir:
        has_grid = "grid" in code.lower() or (code.count("borderRadius") >= 3 and code.count("map(") >= 1)
        if has_grid:
            score += 0.10
            pass  # MULTI-CARD bonus
    elif "CENTERED-HERO" in creative_dir:
        has_center = "center" in code and "textAlign" in code
        if has_center:
            score += 0.10
            pass  # CENTERED-HERO bonus

    # Staggered timing (0.10) — different frame offsets = sequential reveals
    frame_offsets = re.findall(r"frame\s*[-+]\s*\d+|frame\s*,\s*\[\s*(\d+)", code)
    if len(set(frame_offsets)) >= 3:
        score += 0.10
    elif len(set(frame_offsets)) >= 2:
        score += 0.05

    # Penalize narrow left-aligned layouts that waste screen space (-0.10)
    narrow_maxwidth = re.search(r'maxWidth:\s*["\']?([3-6]\d)%', code)
    has_centering = "center" in code and ("textAlign" in code or "justifyContent" in code or "margin.*auto" in code)
    excessive_padding = re.search(r'padding:\s*(\d{3,}|[89]\d)', code)
    if narrow_maxwidth and not has_centering:
        score -= 0.10
    if excessive_padding:
        score -= 0.05

    # ── New quality signals ──

    # Diverse spring configs (+0.10) — parse damping/stiffness values, reward ≥3 unique configs
    spring_configs = re.findall(r'damping:\s*(\d+).*?stiffness:\s*(\d+)', code)
    unique_springs = set(spring_configs)
    if len(unique_springs) >= 3:
        score += 0.10
    elif len(unique_springs) >= 2:
        score += 0.05

    # Staggered text animation (+0.10) — .map or .split with spring/interpolate + stagger
    has_staggered_text = bool(
        re.search(r'\.(map|split)\(', code)
        and re.search(r'(spring|interpolate)\(', code)
        and re.search(r'(delay|offset|stagger|\*\s*\d+|i\s*\*)', code)
    )
    if has_staggered_text:
        score += 0.10

    # Img component with animation (+0.10) — Img + spring/interpolate nearby
    if "Img" in code and "imageUrl" in code:
        img_section = code[max(0, code.index("Img") - 200):code.index("Img") + 200]
        if "spring(" in img_section or "interpolate(" in img_section:
            score += 0.10

    # Glow/blur effects (+0.05)
    has_blur_effect = bool(re.search(r'filter.*blur|blur\(', code))
    has_radial_glow = bool(re.search(r'radial-gradient.*transparent', code))
    if has_blur_effect or has_radial_glow:
        score += 0.05

    # Penalize scenes with ONLY opacity+translateY, no other animation types (-0.10)
    has_only_basic = (
        ("opacity" in code or "translateY" in code)
        and not has_staggered_text
        and "scale" not in code
        and "translateX" not in code
        and "rotate" not in code
        and not has_blur_effect
    )
    if has_only_basic:
        score -= 0.10

    # Brevity bonus — reward 200-350 lines, penalize >500
    if 200 <= line_count <= 350:
        score += 0.05
    elif line_count > 500:
        score -= 0.10

    # ── Quality summary for debugging ──
    anim_techniques = []
    if has_staggered_text:
        anim_techniques.append("staggered-text")
    if "Img" in code and "imageUrl" in code:
        anim_techniques.append("img-animated" if ("spring(" in code[max(0, code.find("Img") - 200):code.find("Img") + 200] or "interpolate(" in code[max(0, code.find("Img") - 200):code.find("Img") + 200]) else "img-static")
    if has_blur_effect:
        anim_techniques.append("blur")
    if has_radial_glow:
        anim_techniques.append("radial-glow")
    if "scale" in code:
        anim_techniques.append("scale")
    if "rotate" in code:
        anim_techniques.append("rotate")
    if "translateX" in code:
        anim_techniques.append("translateX")
    if "clip-path" in code or "clipPath" in code:
        anim_techniques.append("clip-path")
    if "Easing." in code:
        anim_techniques.append("easing")
    if has_only_basic:
        anim_techniques.append("BASIC-ONLY")

    spring_details = [f"d{d}s{s}" for d, s in unique_springs]

    print(
        f"[F7-DEBUG] [REFINE] Validation PASSED — score={score:.2f} | "
        f"{line_count}L, {anim_count} anims, {effects} fx | "
        f"springs=[{','.join(spring_details)}] | "
        f"techniques=[{','.join(anim_techniques)}]"
    )
    return min(score, 1.0)


# ─── Creative direction builder ──────────────────────────────


_CONTENT_VARIANT_ROLES = [
    {
        "name": "lists",
        "content_types": ["bullets", "steps"],
        "role": "Render bullet points and step-by-step flows as visually rich card grids or staggered items.",
    },
    {
        "name": "metrics",
        "content_types": ["metrics"],
        "role": "Render statistics and KPIs with animated count-ups, prominent stat cards, and data visualization flair.",
    },
    {
        "name": "code",
        "content_types": ["code"],
        "role": "Render code blocks with line-by-line typewriter reveal, syntax-like coloring, and terminal aesthetics.",
    },
    {
        "name": "editorial",
        "content_types": ["quote", "comparison"],
        "role": "Render quotes with dramatic word-by-word reveals, and comparisons as balanced side-by-side layouts.",
    },
    {
        "name": "general",
        "content_types": ["timeline", "plain"],
        "role": "Render timelines as vertical staggered tracks, and plain text with rich typography and decorative fills.",
    },
]


def _build_creative_direction(
    scene_type: str,
    variant_index: int,
    total_content_variants: int,
    brand_context: str = "",
) -> str:
    """Build creative direction for a scene.

    Intro/outro get brand-aware direction.
    Content scenes get content-type specialization but full creative freedom in layout/animation.
    """
    if scene_type == "intro":
        return (
            "Scene type: INTRO — the opening scene.\n"
            "Establish the brand's visual identity immediately. The title is the hero element.\n"
            "Choose a layout that fits the brand personality from the brand_context — "
            "a sports brand should feel bold and full-bleed, a luxury brand should feel spacious and elegant, "
            "a tech brand should feel modern and geometric.\n"
            "Content MUST fill the screen — use at least 80% of viewport width. "
            "Headings should be large and prominent, centered or intentionally placed.\n"
            "Check props.contentType and render structured content if present, otherwise use props.displayText."
        )
    elif scene_type == "outro":
        return (
            "Scene type: OUTRO — the closing scene.\n"
            "Brand name and/or logo prominent. Call-to-action feel.\n"
            "Match the intro's energy level — if intro was bold, outro should be bold. "
            "If intro was calm, outro should be calm.\n"
            "Content MUST fill the screen — use at least 80% of viewport width. "
            "Center the brand name and CTA prominently.\n"
            "Render props.displayText as the primary content."
        )
    else:
        role = _CONTENT_VARIANT_ROLES[variant_index % len(_CONTENT_VARIANT_ROLES)]
        return (
            f"Scene type: CONTENT — variant '{role['name']}' ({variant_index + 1} of {total_content_variants}).\n"
            f"Content specialization: {', '.join(role['content_types'])}\n"
            f"Your role: {role['role']}\n\n"
            "You have FULL creative freedom in layout, composition, and spatial arrangement.\n"
            "Invent an original layout — do NOT fall back to simple opacity+translateY.\n"
            "Quality bar: match the polish of a hand-crafted motion design studio.\n\n"
            "RULES:\n"
            "- ALL displayed content MUST come from props — NEVER hardcode sample data.\n"
            "- NEVER render contentType as visible text/label/badge.\n"
            "- NEVER render sceneIndex/totalScenes as visible counters.\n"
            f"- When contentType matches [{', '.join(role['content_types'])}], render that structured data beautifully.\n"
            "- FALLBACK: if contentType doesn't match, render props.displayText with rich typography."
        )


# ─── Brand context builder ─────────────────────────────────────


PRESET_SPRINGS = {
    "fade": "spring({ damping: 20, stiffness: 80, mass: 1 }) — smooth, slow opacity fades and gentle scale-ups",
    "slide": "spring({ damping: 18, stiffness: 120, mass: 1 }) — directional slides with natural momentum",
    "bounce": "spring({ damping: 8, stiffness: 150, mass: 0.8 }) — bouncy, playful overshooting entrances",
    "dynamic": "spring({ damping: 12, stiffness: 200, mass: 1 }) — fast, energetic snaps with punch",
    "minimal": "spring({ damping: 25, stiffness: 60, mass: 1.2 }) — barely perceptible, elegant fades",
}


def _build_brand_context(
    theme: dict,
    brand_kit_data: dict | None,
    name: str,
    category: str = "",
    video_style: str = "",
    personality: str = "",
    source_url: str = "",
) -> str:
    """Build rich brand context string for DSPy input."""
    colors = theme.get("colors", {})
    fonts = theme.get("fonts", {})
    style = theme.get("style", "minimal")
    animation = theme.get("animationPreset", "fade")
    patterns = theme.get("patterns", {})

    brand_colors = {
        "primary": colors.get("accent", "#7C3AED"),
        "secondary": colors.get("surface", "#F5F5F5"),
        "accent": colors.get("accent", "#7C3AED"),
        "background": colors.get("bg", "#FFFFFF"),
        "text": colors.get("text", "#1A1A2E"),
    }

    ctx = f"Brand: {name}\n"
    ctx += f"Colors: {json.dumps(brand_colors)}\n"
    ctx += f"Heading font: {fonts.get('heading', 'Inter')}, Body font: {fonts.get('body', 'Inter')}\n"

    ctx += f"\nDesign style: {style}\n"
    ctx += f"Animation preset: {animation}\n"
    spring_hint = PRESET_SPRINGS.get(animation, PRESET_SPRINGS["fade"])
    ctx += f"Animation spring config: {spring_hint}\n"

    # Full pattern details — cards, spacing, images, layout
    if patterns:
        ctx += "\nVisual patterns from website:\n"
        cards = patterns.get("cards", {})
        if cards:
            ctx += f"  Cards: corners={cards.get('corners', 'rounded')}, shadow={cards.get('shadowDepth', 'subtle')}, border={cards.get('borderStyle', 'none')}\n"
        spacing = patterns.get("spacing", {})
        if spacing:
            ctx += f"  Spacing: density={spacing.get('density', 'balanced')}, gridGap={spacing.get('gridGap', 16)}px\n"
        images = patterns.get("images", {})
        if images:
            ctx += f"  Images: treatment={images.get('treatment', 'rounded')}, overlay={images.get('overlay', 'none')}, caption={images.get('captionStyle', 'below')}\n"
        layout = patterns.get("layout", {})
        if layout:
            ctx += f"  Layout: direction={layout.get('direction', 'centered')}\n"
            decorative = layout.get("decorativeElements", [])
            if decorative:
                ctx += f"  Decorative elements: {', '.join(decorative)}\n"

    if brand_kit_data:
        if brand_kit_data.get("logos"):
            ctx += "\nLogo available via props.logoUrl\n"
        dl = brand_kit_data.get("design_language", {})
        if dl:
            for key in ("vibe", "density", "shapes"):
                if dl.get(key):
                    ctx += f"{key.title()}: {dl[key]}\n"

    if source_url:
        ctx += f"\nWebsite: {source_url}\n"
    if category:
        ctx += f"Category: {category}\n"
    if video_style:
        ctx += f"Video style: {video_style}\n"
    if personality:
        ctx += f"\nBrand personality: {personality}\n"
        ctx += "Use this personality to guide your visual choices — color emphasis, animation energy, typography weight, and decorative density should all reflect this brand's character.\n"

    ctx += (
        "\nIMPORTANT: Make scenes feel native to this brand's industry and personality. "
        "Don't use generic layouts — tailor every visual choice (colors, animation spring configs, "
        "decorative elements, typography, spacing) to match this specific brand's website aesthetic."
    )

    return ctx


# ─── Design system generation ────────────────────────────────────


def _generate_design_system(brand_context: str) -> str:
    """Generate a concise visual design system for cross-scene consistency.

    Uses Haiku for speed — this is structured CSS extraction, not creative generation.
    Covers backgrounds, cards, and text only. Springs/animations are per-scene creative choices.
    """
    ensure_dspy_configured()

    module = dspy.ChainOfThought(
        GenerateDesignSystem,
        rationale_field=dspy.OutputField(
            prefix="Analysis:",
            desc="Brief: brand personality → 3 key CSS decisions",
        ),
    )

    t0 = time.time()
    theme_lm = get_theme_lm()
    with dspy.context(lm=theme_lm):
        result = module(brand_context=brand_context)

    design_system = result.design_system or ""
    elapsed = time.time() - t0
    print(f"[F7-DEBUG] [DESIGN-SYSTEM] Generated in {elapsed:.1f}s ({len(design_system)} chars)")
    return design_system


# ─── Per-scene generation with Refine ───────────────────────────

def _generate_single_scene_sync(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    creative_direction: str,
) -> str:
    """Generate a single scene using DSPy ChainOfThought + Refine (sync)."""
    ensure_dspy_configured()

    base_module = dspy.ChainOfThought(
        GenerateSceneCode,
        rationale_field=dspy.OutputField(
            prefix="Plan:",
            desc="3 bullet points: (1) spatial layout approach, (2) animation strategy with spring configs, (3) content rendering approach for the specialized content type",
        ),
    )

    refined = dspy.Refine(
        module=base_module,
        N=REFINE_N,
        reward_fn=_scene_reward,
        threshold=0.7,
    )

    t0 = time.time()

    codegen_lm = get_custom_lm()
    with dspy.context(lm=codegen_lm):
        result = refined(
            brand_context=brand_context,
            design_system=design_system,
            scene_type=scene_type,
            scene_index=scene_index,
            total_scenes=total_scenes,
            creative_direction=creative_direction,
        )

    elapsed = time.time() - t0
    code = clean_code(result.code or "")
    line_count = code.count("\n") + 1

    print(f"[F7-DEBUG] [REFINE] Scene {scene_index} ({scene_type}) done: {line_count} lines in {elapsed:.1f}s")
    return code


from concurrent.futures import ThreadPoolExecutor
_SCENE_EXECUTOR = ThreadPoolExecutor(max_workers=6, thread_name_prefix="scene-gen")


async def _generate_single_scene(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    creative_direction: str,
) -> str:
    """Async wrapper — runs the sync Refine call in a dedicated thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _SCENE_EXECUTOR,
        _generate_single_scene_sync,
        brand_context,
        design_system,
        scene_type,
        scene_index,
        total_scenes,
        creative_direction,
    )


# ─── Main generation entry point ────────────────────────────────

async def generate_component_code(template: CustomTemplate) -> dict[str, str | list[str]]:
    """Generate scene variant code for a custom template using DSPy Refine.

    Generates 5 scenes in parallel (1 intro + 3 content + 1 outro).
    Each scene has its own Refine loop — a failure in one scene
    only retries that scene, not the entire batch.

    Returns dict with keys:
      - intro_code: str (scene 0)
      - outro_code: str (last scene)
      - content_codes: list[str] (all middle scenes)
    Raises RuntimeError if generation fails.
    """
    theme = json.loads(template.theme) if isinstance(template.theme, str) else template.theme

    # Load brand kit data if linked
    brand_kit_data = None
    if template.brand_kit:
        bk = template.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if isinstance(bk.colors, str) else bk.colors,
            "fonts": json.loads(bk.fonts) if isinstance(bk.fonts, str) else bk.fonts,
            "logos": json.loads(bk.logos) if isinstance(bk.logos, str) else bk.logos,
            "design_language": json.loads(bk.design_language) if isinstance(bk.design_language, str) else bk.design_language,
        }

    # Extract brand context for industry-aware generation
    personality = ""
    if brand_kit_data and brand_kit_data.get("design_language"):
        personality = brand_kit_data["design_language"].get("personality", "")

    brand_context = _build_brand_context(
        theme,
        brand_kit_data,
        template.name,
        category=template.category or "",
        video_style=getattr(template, "supported_video_style", "") or "",
        personality=personality,
        source_url=template.source_url or "",
    )

    t_start = time.time()

    # Generate shared design system (single LLM call, ~5-10s)
    # This ensures all scenes follow the same visual rules
    loop = asyncio.get_event_loop()
    design_system = await loop.run_in_executor(None, _generate_design_system, brand_context)

    # Build scene tasks: 1 intro + N content + 1 outro
    num_content = NUM_CONTENT_VARIANTS
    total_scenes = 1 + num_content + 1

    # Build creative directions — minimal, just scene role + variant index.
    # The brand context (already rich with style, patterns, personality) does the heavy lifting.
    scene_directions: list[tuple[str, int, str]] = [
        ("intro", 0, _build_creative_direction("intro", 0, num_content, brand_context)),
        *[("content", i + 1, _build_creative_direction("content", i, num_content, brand_context)) for i in range(num_content)],
        ("outro", total_scenes - 1, _build_creative_direction("outro", 0, num_content, brand_context)),
    ]

    # Run all scenes in parallel
    tasks = [
        _generate_single_scene(
            brand_context=brand_context,
            design_system=design_system,
            scene_type=scene_type,
            scene_index=idx,
            total_scenes=total_scenes,
            creative_direction=direction,
        )
        for scene_type, idx, direction in scene_directions
    ]

    try:
        results = await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        raise RuntimeError(f"Code generation failed: {e}") from e

    # Process results
    scenes: list[str] = []
    for i, result in enumerate(results):
        scene_type, idx, _dir = scene_directions[i]
        if isinstance(result, Exception):
            raise RuntimeError(f"Scene {idx} ({scene_type}) generation failed: {result}")
        scenes.append(result)

    # Final validation pass
    for i, code in enumerate(scenes):
        valid, err = validate_component_code(code)
        if not valid:
            raise RuntimeError(f"Scene {i} failed validation after Refine: {err}")

    intro_code = scenes[0]
    outro_code = scenes[-1]
    content_codes = scenes[1:-1]

    t_total = time.time() - t_start
    t_design = t_total  # approximate — design system was first step

    # One clean summary for the entire codegen phase
    scene_summary = ", ".join(
        f"{st}:{result.count(chr(10)) + 1}L"
        for (st, _idx, _cd), result in zip(scene_directions, scenes)
    )
    print(
        f"[F7-DEBUG] [CODEGEN] '{template.name}' done in {t_total:.1f}s — "
        f"{len(scenes)} scenes ({scene_summary})"
    )

    return {
        "intro_code": intro_code,
        "outro_code": outro_code,
        "content_codes": content_codes,
    }
