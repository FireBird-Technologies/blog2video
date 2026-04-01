"""
AI code generator — uses DSPy with Refine for self-correcting Remotion component generation.

Each scene is generated individually via DSPy ChainOfThought, wrapped in dspy.Refine
so failed validations trigger targeted feedback + retry on just the failing scene.
All scenes run in PARALLEL via asyncio.gather.
"""

import asyncio
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor

import dspy

from app.dspy_modules import ensure_dspy_configured, get_custom_lm
from app.models.custom_template import CustomTemplate
from app.services.code_validator import clean_code, validate_component_code

logger = logging.getLogger(__name__)

REFINE_N = 2          # Max 3 attempts per scene (1 initial + 2 retries)


# ─── DSPy Signatures ─────────────────────────────────────────


class DecideBrandSceneTypes(dspy.Signature):
    """Given a brand's identity, decide what scene types its videos should have.

    Output a JSON array of objects, each with:
    - "id": short snake_case identifier
    - "scene_type": "intro", "content", or "outro"
    - "best_for": array of content types this scene handles best.
      Must use values from: "bullets", "steps", "metrics", "code",
      "quote", "comparison", "timeline", "plain"
      (These are the content types the classification system outputs — other values won't match.)
    - "description": one-line purpose

    Structural requirements:
    - Exactly 1 scene with scene_type="intro" and exactly 1 with scene_type="outro"
    - The rest are scene_type="content"
    """

    brand_context: str = dspy.InputField(desc="Brand name, category, personality, visual patterns")
    scene_types_json: str = dspy.OutputField(
        desc='JSON array of scene type objects: [{"id": "...", "scene_type": "...", "best_for": [...], "description": "..."}]'
    )


class GenerateDesignSystem(dspy.Signature):
    """Given a brand's visual identity, create a concrete CSS design system for video scenes.

    Output ONLY concrete CSS values (under 2000 chars) covering:
    - Background treatment: exact CSS (gradients, solid colors, or patterns)
    - Card/container style: border-radius, box-shadow, border, background
    - Text treatment: font sizes, text-shadow or glow, color usage

    Do NOT include: spring configs, animation physics, decorative elements, or entrance patterns.
    Those are creative choices each scene makes independently.
    """

    brand_context: str = dspy.InputField(desc="Brand identity: name, colors, fonts, style, patterns, personality")
    design_system: str = dspy.OutputField(desc="Concise design system (under 2000 chars) with CSS values for backgrounds, cards, and text only")


class GenerateSceneCode(dspy.Signature):
    """Generate a single Remotion video scene as a React component.

    Write a component assigned to `const SceneComponent`.

    Technical constraints:
    - NO import/export statements — all APIs are pre-injected as globals
    - Component must be deterministic (same frame = same output)
    - NEVER use: eval, fetch, document, window, process, require, import, setTimeout, setInterval
    - ALWAYS add overflow: "hidden" on the outermost container
    - ALL displayed text MUST come from props — NEVER hardcode sample/placeholder content
    - NEVER hardcode specific names, product names, service names, item labels, or example data
    - NEVER use fallback arrays with hardcoded data: do NOT write `props.bullets || [{name:'...'}]`
      or `bullets && bullets.length ? bullets : [{title:'Feature 1'}]` or any similar pattern
    - If props.bullets / props.steps / props.metrics is empty or undefined:
      fall back to splitting props.displayText into sentences, or render props.displayText as a
      single item — NEVER invent example items
    - NEVER render sceneIndex/totalScenes as visible UI
    - NEVER render contentType as visible text/label/badge

    Images & Logo (MANDATORY — every scene MUST handle these):
    - ALWAYS check props.logoUrl safely and render it when present:
      {props.logoUrl && typeof props.logoUrl === 'string' && (
        <Img src={props.logoUrl} style={{width: 80, height: 80, objectFit: "contain", ...}} />
      )}
      ALWAYS set explicit width + height on logo Img so layout never collapses if image fails to load.
      Use it as a brand watermark (corner), header element, or animated accent — but ALWAYS render it.
    - ALWAYS check props.imageUrl safely and render it prominently when present — NOT just a dim background.
      Use: const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
      Techniques: Ken Burns zoom (scale 1→1.08 over duration with slight pan), radial vignette reveal,
      slit/clipPath reveal, or hero card with perspective rotation. Always use objectFit:"cover".
      Layer gradient overlays for text readability: linear-gradient(to top, rgba(bg,0.95) 0%, transparent 70%)
      plus radial-gradient vignette plus accent color wash with mixBlendMode:"overlay".
      ALWAYS set explicit width + height on image Img elements.
    - ADAPT LAYOUT based on image presence — use `const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');`
      WITH image: split layout (image on one side, text on other). Example: width: hasImage ? "50%" : "100%"
      WITHOUT image: text container MUST expand to width: "100%" to fill the full scene. Never leave an empty 50% gap.
      Both modes must look intentionally designed — not like something is missing.
    - When props.imageUrl is ABSENT (hasImage is false): use floating particle dots or geometric decorative shapes
      as visual interest — ALWAYS respect the brand_context background instruction (solid vs gradient).
      If brand_context says "solid backgrounds only", use the solid bg color. If it says "gradient", use the gradient.
      Never leave the scene empty or with an empty 50% hole.
    - If props.brandImages exists (Array.isArray(props.brandImages)), render gallery/carousel elements from it
    - Missing image handling is a BUG — the reward function penalizes scenes that ignore these props

    Typography (MANDATORY for readability at 1920×1080):
    - NEVER hardcode fontFamily strings like "Inter" or "Roboto" — fonts are passed as props.
      For headings/titles use: fontFamily: props.headingFont || "inherit"
      For body/description text use: fontFamily: props.bodyFont || "inherit"
      This lets users change fonts from Settings without regenerating templates.
    - Main title / displayText: use fontSize: (props.titleFontSize ?? 75) (or scale proportionally in nested layouts, never below 48 for the primary headline).
    - Subtitle / narration / body under the title: use fontSize: (props.descriptionFontSize ?? 37); supporting lines at least 28px.
    - Bullet lists, card body text, quote body, metric labels: at least 30–36px so previews stay legible when scaled down in the UI.
    - Do NOT hardcode tiny font sizes (e.g. 12–18px) for primary readable content.

    Text animations — bring words to life:
    - Word-by-word or line-by-line reveals: split text, stagger each word/line with spring(frame - i*8)
    - Typewriter effect: show chars up to Math.floor(frame * 1.5) with a blinking cursor
    - Scale-punch for key words: spring with damping:14, stiffness:220 for overshoot bounce
    - Title entrance: translateY + scale + opacity with spring delay (don't just fade in)
    - Bullet points: stagger each bullet with delay = 20 + i*10, slide from right (translateX: 40→0)
    - Exit animations: start 20-30 frames before durationInFrames — fade out, scale down, or slide away

    Scene motion — every scene should feel alive:
    - Use multiple spring() calls with DIFFERENT configs for varied motion feel
    - Stagger element entrances by 8-14 frames — never animate everything at once
    - Combine transforms: scale(0.95→1) + translateY(30→0) + opacity(0→1) for depth
    - Add ambient motion: subtle gradient shifts, floating particles, pulsing accent glows
    - Metric count-ups: interpolate(frame, [start, end], [0, targetValue]) for animated numbers
    - Card fly-ins: spring with mass:0.8 for snappy card reveals
    - Decorative shapes: corner accents that scale in, accent lines that grow (width: 0→100%)
    - Parallax: different layers move at different speeds for depth
    - Spring configs: fast={damping:22,stiffness:140,mass:1.2}, bouncy={damping:14,stiffness:220,mass:1.1}, smooth={damping:20,stiffness:70}

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
      headingFont?: string, bodyFont?: string,
      contentType?: "plain"|"bullets"|"metrics"|"code"|"quote"|"comparison"|"timeline"|"steps",
      bullets?: string[], metrics?: {value,label,suffix?}[], codeLines?: string[],
      codeLanguage?: string, quote?: string, quoteAuthor?: string,
      comparisonLeft?: {label,description}, comparisonRight?: {label,description},
      timelineItems?: {label,description}[], steps?: string[] }

    Resolution: 1920x1080 (landscape) / 1080x1920 (portrait), 30fps, 90-150 frames.
    """

    brand_context: str = dspy.InputField(desc="Brand name, colors, fonts, style, category, personality")
    design_system: str = dspy.InputField(desc="Shared visual styling — follow for consistency")
    scene_type: str = dspy.InputField(desc="'intro', 'content', or 'outro'")
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes being generated")
    scene_purpose: str = dspy.InputField(
        desc="What this scene is for — e.g., 'intro scene: establish brand identity' or 'content scene optimized for metrics/statistics'"
    )

    code: str = dspy.OutputField(desc="Complete SceneComponent code (const SceneComponent = (props) => { ... };)")


# ─── Reward function for dspy.Refine ──────────────────────────


def _scene_reward(args, pred) -> float:
    """Score a generated scene. Only checks for real bugs — no aesthetic scoring."""
    raw_code = pred.code or ""
    code = clean_code(raw_code)

    # Must pass validation (hard requirement)
    scene_type = getattr(args, "scene_type", "content")
    valid, err = validate_component_code(code, scene_type=scene_type)
    if not valid:
        print(f"[F7-DEBUG] [REFINE] FAILED: {err}")
        return 0.0

    # logoUrl, imageUrl, overflow:hidden, and interpolate monotonicity are now
    # hard requirements in validate_component_code() — they return 0.0 above.
    # Remaining soft checks are for quality issues that don't cause crashes.

    score = 1.0

    # Bug: hardcoded sample data arrays (fake content in components)
    hardcoded_array = re.search(
        r'(?:const|let|var)\s+\w+\s*=\s*\[[\s\S]{20,}?(?:text|icon|label|description|name|desc|title|heading)\s*:',
        code,
    )
    if hardcoded_array and not re.search(
        r'=\s*props\.', code[hardcoded_array.start() : hardcoded_array.start() + 100]
    ):
        score -= 0.3
        print(f"[F7-DEBUG] [REFINE] -0.3: hardcoded sample data")

    # Bug: fallback hardcoded arrays — props.x || [{...}] or props.x ?? [{...}]
    if re.search(r'props\.\w+\s*(?:\|\||\?\?)\s*\[', code):
        score -= 0.3
        print(f"[F7-DEBUG] [REFINE] -0.3: hardcoded fallback array (props.x || [...])")

    # Bug: contentType rendered as visible text
    if re.search(r'>\s*\{[^}]*contentType[^}]*\}', code):
        score -= 0.2
        print(f"[F7-DEBUG] [REFINE] -0.2: contentType visible as text")

    # Bug: sceneIndex/totalScenes shown as visible counters
    if re.search(r'sceneIndex\s*\+\s*1.*totalScenes|of.*totalScenes|\$\{.*sceneIndex', code):
        score -= 0.2
        print(f"[F7-DEBUG] [REFINE] -0.2: scene counter visible")

    line_count = code.count("\n") + 1
    print(f"[F7-DEBUG] [REFINE] Validation PASSED — score={score:.2f} | {line_count}L")
    return max(score, 0.0)


# ─── Brand context builder ─────────────────────────────────────


def _build_brand_context(
    theme: dict,
    brand_kit_data: dict | None,
    name: str,
    category: str = "",
    video_style: str = "",
    personality: str = "",
    source_url: str = "",
) -> str:
    """Build brand context string — raw data only, no instructions."""
    colors = theme.get("colors", {})
    fonts = theme.get("fonts", {})
    style = theme.get("style")
    animation = theme.get("animationPreset")
    patterns = theme.get("patterns", {})

    brand_colors = {
        "primary": colors.get("accent"),
        "secondary": colors.get("surface"),
        "accent": colors.get("accent"),
        "background": colors.get("bg"),
        "text": colors.get("text"),
    }
    # Remove None values
    brand_colors = {k: v for k, v in brand_colors.items() if v}

    ctx = f"Brand: {name}\n"
    if brand_colors:
        ctx += f"Colors: {json.dumps(brand_colors)}\n"
    if fonts.get("heading") or fonts.get("body"):
        parts = []
        if fonts.get("heading"):
            parts.append(f"Heading: {fonts['heading']}")
        if fonts.get("body"):
            parts.append(f"Body: {fonts['body']}")
        ctx += f"Fonts: {', '.join(parts)}\n"
    if style:
        ctx += f"Design style: {style}\n"
    if animation:
        ctx += f"Animation preset: {animation}\n"

    if patterns:
        ctx += "\nVisual patterns from website:\n"
        cards = patterns.get("cards", {})
        if cards:
            ctx += f"  Cards: corners={cards.get('corners')}, shadow={cards.get('shadowDepth')}, border={cards.get('borderStyle')}\n"
        spacing = patterns.get("spacing", {})
        if spacing:
            ctx += f"  Spacing: density={spacing.get('density')}, gridGap={spacing.get('gridGap')}px\n"
        images = patterns.get("images", {})
        if images:
            ctx += f"  Images: treatment={images.get('treatment')}, overlay={images.get('overlay')}\n"
        layout = patterns.get("layout", {})
        if layout:
            ctx += f"  Layout: direction={layout.get('direction')}\n"
            decorative = layout.get("decorativeElements", [])
            if decorative:
                ctx += f"  Decorative elements: {', '.join(decorative)}\n"

    if brand_kit_data:
        if brand_kit_data.get("logos"):
            ctx += "Logo available via props.logoUrl\n"
        if brand_kit_data.get("images"):
            ctx += f"{len(brand_kit_data['images'])} brand image(s) available via props.brandImages\n"
        dl = brand_kit_data.get("design_language", {})
        if dl:
            for key in ("vibe", "density", "shapes"):
                if dl.get(key):
                    ctx += f"{key.title()}: {dl[key]}\n"

    use_gradient = colors.get("bg2") is not None
    if use_gradient:
        ctx += f"Background: gradient from {colors.get('bg')} to {colors.get('bg2')} — use gradient backgrounds\n"
    else:
        ctx += f"Background: solid color {colors.get('bg')} — use SOLID backgrounds only, NO gradients\n"

    if source_url:
        ctx += f"Website: {source_url}\n"
    if category:
        ctx += f"Category: {category}\n"
    if video_style:
        ctx += f"Video style: {video_style}\n"
    if personality:
        ctx += f"Brand personality: {personality}\n"

    return ctx


# ─── Brand scene type decision ──────────────────────────────────


def _decide_brand_scene_types(brand_context: str) -> list[dict]:
    """Ask the AI to decide scene types tailored to this brand.

    Retries once on failure. Raises RuntimeError if both attempts fail.
    Returns list of dicts: [{"id": "...", "scene_type": "...", "best_for": [...], "description": "..."}]
    """
    ensure_dspy_configured()
    module = dspy.ChainOfThought(DecideBrandSceneTypes)
    codegen_lm = get_custom_lm()

    last_error = None
    for attempt in range(2):
        t0 = time.time()
        try:
            with dspy.context(lm=codegen_lm):
                result = module(brand_context=brand_context)

            raw = (result.scene_types_json or "").strip()
            if raw.startswith("```"):
                lines = raw.split("\n")[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw = "\n".join(lines)

            scene_types = json.loads(raw)

            if not isinstance(scene_types, list) or len(scene_types) < 3:
                raise ValueError(f"Expected list of 3+ scene types, got {type(scene_types).__name__} with {len(scene_types) if isinstance(scene_types, list) else 0} items")

            # Validate structure
            validated = []
            for st in scene_types:
                if not isinstance(st, dict) or "id" not in st:
                    continue
                validated.append({
                    "id": st["id"],
                    "scene_type": st.get("scene_type", "content"),
                    "best_for": st.get("best_for", []),
                    "description": st.get("description", st["id"]),
                })

            # Ensure we have intro and outro (structural requirement)
            has_intro = any(s["scene_type"] == "intro" for s in validated)
            has_outro = any(s["scene_type"] == "outro" for s in validated)
            if not has_intro:
                validated.insert(0, {"id": "hero_intro", "scene_type": "intro", "best_for": [], "description": "Opening scene"})
            if not has_outro:
                validated.append({"id": "closing_outro", "scene_type": "outro", "best_for": [], "description": "Closing scene"})

            content_types = [s for s in validated if s["scene_type"] == "content"]
            if not content_types:
                raise ValueError("AI returned no content scene types")

            elapsed = time.time() - t0
            print(
                f"[F7-DEBUG] [SCENE-TYPES] Decided {len(validated)} scene types in {elapsed:.1f}s: "
                f"{[s['id'] for s in validated]}"
            )
            return validated

        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            elapsed = time.time() - t0
            print(f"[F7-DEBUG] [SCENE-TYPES] Attempt {attempt + 1} failed in {elapsed:.1f}s: {e}")
            if attempt == 0:
                print(f"[F7-DEBUG] [SCENE-TYPES] Retrying...")

    raise RuntimeError(f"Failed to decide brand scene types after 2 attempts: {last_error}")


# ─── Design system generation ────────────────────────────────────


def _generate_design_system(brand_context: str) -> str:
    """Generate a concise visual design system for cross-scene consistency."""
    ensure_dspy_configured()

    module = dspy.ChainOfThought(
        GenerateDesignSystem,
        rationale_field=dspy.OutputField(
            prefix="Analysis:",
            desc="Brief: brand personality → 3 key CSS decisions",
        ),
    )

    t0 = time.time()
    codegen_lm = get_custom_lm()
    with dspy.context(lm=codegen_lm):
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
    scene_purpose: str,
) -> str:
    """Generate a single scene using DSPy ChainOfThought + Refine (sync)."""
    ensure_dspy_configured()

    base_module = dspy.ChainOfThought(
        GenerateSceneCode,
        rationale_field=dspy.OutputField(
            prefix="Plan:",
            desc="3 bullet points: (1) layout approach, (2) animation strategy, (3) content rendering",
        ),
    )

    refined = dspy.Refine(
        module=base_module,
        N=REFINE_N,
        reward_fn=_scene_reward,
        threshold=0.75,
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
            scene_purpose=scene_purpose,
        )

    elapsed = time.time() - t0
    code = clean_code(result.code or "")
    line_count = code.count("\n") + 1

    print(f"[F7-DEBUG] [REFINE] Scene {scene_index} ({scene_type}) done: {line_count} lines in {elapsed:.1f}s")
    return code


_SCENE_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="scene-gen")


async def _generate_single_scene(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    scene_purpose: str,
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
        scene_purpose,
    )


# ─── Main generation entry point ────────────────────────────────


async def generate_component_code(template: CustomTemplate) -> dict[str, str | list[str]]:
    """Generate scene variant code for a custom template using DSPy Refine.

    1. Build brand context (raw data)
    2. Ask AI to decide brand-specific scene types
    3. Generate design system
    4. Generate all scenes in parallel (1 intro + N content + 1 outro)

    Returns dict with keys:
      - intro_code: str
      - outro_code: str
      - content_codes: list[str]
      - archetype_ids: list[dict] — full metadata for content-aware matching
    Raises RuntimeError if generation fails.
    """
    theme = json.loads(template.theme) if isinstance(template.theme, str) else template.theme

    brand_kit_data = None
    if template.brand_kit:
        bk = template.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if isinstance(bk.colors, str) else bk.colors,
            "fonts": json.loads(bk.fonts) if isinstance(bk.fonts, str) else bk.fonts,
            "logos": json.loads(bk.logos) if isinstance(bk.logos, str) else bk.logos,
            "design_language": json.loads(bk.design_language) if isinstance(bk.design_language, str) else bk.design_language,
        }

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

    codegen_lm = get_custom_lm()
    _tok = (getattr(codegen_lm, "kwargs", None) or {}).get("max_tokens")
    print(
        f"[F7-DEBUG] [CODEGEN] LLM model={codegen_lm.model!r} max_tokens={_tok}"
    )

    # Step 1: AI decides scene types for this brand
    loop = asyncio.get_event_loop()
    all_scene_types = await loop.run_in_executor(None, _decide_brand_scene_types, brand_context)

    intro_archetype = next(s for s in all_scene_types if s["scene_type"] == "intro")
    outro_archetype = next(s for s in all_scene_types if s["scene_type"] == "outro")
    content_archetypes = [s for s in all_scene_types if s["scene_type"] == "content"]

    # Step 2: Generate design system
    design_system = await loop.run_in_executor(None, _generate_design_system, brand_context)

    num_content = len(content_archetypes)
    total_scenes = 1 + num_content + 1

    print(
        f"[F7-DEBUG] [CODEGEN] Generating {total_scenes} scenes for '{template.name}': "
        f"1 intro + {num_content} content archetypes + 1 outro"
    )

    # Step 3: Generate ALL scenes in parallel
    tasks = [
        _generate_single_scene(
            brand_context=brand_context,
            design_system=design_system,
            scene_type="intro",
            scene_index=0,
            total_scenes=total_scenes,
            scene_purpose=f"{intro_archetype['id']}: {intro_archetype['description']}",
        ),
    ]
    for i, arch in enumerate(content_archetypes):
        tasks.append(
            _generate_single_scene(
                brand_context=brand_context,
                design_system=design_system,
                scene_type="content",
                scene_index=i + 1,
                total_scenes=total_scenes,
                scene_purpose=f"{arch['id']}: {arch['description']}",
            ),
        )
    tasks.append(
        _generate_single_scene(
            brand_context=brand_context,
            design_system=design_system,
            scene_type="outro",
            scene_index=total_scenes - 1,
            total_scenes=total_scenes,
            scene_purpose=f"{outro_archetype['id']}: {outro_archetype['description']}",
        ),
    )

    scenes = await asyncio.gather(*tasks)

    # Log what was generated
    scene_labels = [intro_archetype["id"]] + [a["id"] for a in content_archetypes] + [outro_archetype["id"]]
    for i, (label, code) in enumerate(zip(scene_labels, scenes)):
        line_count = code.count("\n") + 1
        print(f"[F7-DEBUG] [CODEGEN] Scene {i} ({label}): {line_count} lines")

    # Final validation pass
    scene_types_simple = ["intro"] + ["content"] * num_content + ["outro"]
    for i, code in enumerate(scenes):
        valid, err = validate_component_code(code, scene_type=scene_types_simple[i])
        if not valid:
            raise RuntimeError(f"Scene {i} ({scene_types_simple[i]}) failed validation after Refine: {err}")

    intro_code = scenes[0]
    outro_code = scenes[-1]
    content_codes = list(scenes[1:-1])

    t_total = time.time() - t_start

    scene_summary = ", ".join(
        f"{label}:{code.count(chr(10)) + 1}L"
        for label, code in zip(scene_labels, scenes)
    )
    print(
        f"[F7-DEBUG] [CODEGEN] '{template.name}' done in {t_total:.1f}s — "
        f"{len(scenes)} scenes ({scene_summary})"
    )

    return {
        "intro_code": intro_code,
        "outro_code": outro_code,
        "content_codes": content_codes,
        # Full archetype metadata for content-aware matching at video time
        "archetype_ids": [{"id": a["id"], "best_for": a["best_for"]} for a in content_archetypes],
    }
