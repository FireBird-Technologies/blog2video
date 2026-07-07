"""
DSPy module for extracting visual themes from scraped website content.
Takes HTML/CSS + markdown and produces a structured theme JSON.
"""

import colorsys
import json
import logging
import dspy

from app.dspy_modules import ensure_dspy_configured, get_theme_lm
from app.services.theme_scraper import (
    ScrapedThemeData,
    USER_THEME_AI_ERROR,
    USER_THEME_NOT_EXTRACTABLE,
)

logger = logging.getLogger(__name__)


class ExtractThemeFromContent(dspy.Signature):
    """
    You are an expert web designer, brand strategist, and visual identity analyst.
    Given scraped HTML/CSS and markdown from a website, you must:

    1. UNDERSTAND what this website IS — its purpose, audience, industry, and personality
    2. EXTRACT actual visual data from CSS/HTML (colors, fonts, spacing, borders, shadows)
    3. DESIGN a cohesive visual theme that captures the website's unique identity

    ═══ CRITICAL: NO DEFAULTS ═══
    You MUST make an intelligent, deliberate choice for EVERY field. Never fall back to
    generic/bland values. Every website has a unique visual personality — a restaurant,
    a news outlet, a tech startup, a fashion brand all DEMAND different visual treatments.

    ═══ WEBSITE PERSONALITY ANALYSIS ═══
    Before extracting anything, analyze:
    - What industry/niche is this? (food, news, tech, fashion, finance, sports, education, etc.)
    - What feeling should it evoke? (warmth, trust, energy, elegance, playfulness, authority)
    - What's the visual energy level? (calm/editorial, moderate, high-energy/dynamic)
    - Who is the audience? (professionals, consumers, developers, creatives, etc.)
    Use this analysis to guide EVERY choice below.

    ═══ STYLE (free-form — describe the visual identity) ═══
    Choose a style description that captures this website's unique visual identity.
    Be specific — e.g. "warm rustic", "dark cyberpunk", "clean editorial", "glass morphism SaaS",
    "bold sports", "zen minimal", "retro vintage", "corporate trust", "playful gradient".
    Not limited to any preset list — invent a style that fits THIS brand.

    ═══ ANIMATION FEEL (free-form — describe the motion energy) ═══
    Choose an animation feel that matches the brand's energy level.
    Be specific — e.g. "calm editorial fade", "bouncy playful spring", "sharp snappy slide",
    "slow typewriter reveal", "energetic scale-pop", "smooth glass drift".
    Not limited to any preset list.

    ═══ COLOR EXTRACTION ═══
    - accent: The primary brand/CTA color (buttons, links, highlights)
    - bg: Main background color
    - text: Primary text color
    - surface: Secondary background (cards, panels) — must visibly contrast with bg
    - muted: Subtle text / disabled state color
    Extract from CSS/HTML. If not enough CSS data, INFER from the website's industry and mood.
    A restaurant → warm oranges/reds. A finance site → deep blues/greens. A creative agency → vibrant accent.

    ═══ FONT EXTRACTION ═══
    Extract from font-family, Google Fonts links, @font-face rules, font class names.
    If not found in CSS, choose fonts that MATCH THE WEBSITE'S PERSONALITY:
    - Editorial/news → serif headings (Playfair Display, Merriweather, Lora)
    - Tech/modern → geometric sans (Inter, Space Grotesk, DM Sans)
    - Creative/lifestyle → distinctive headings (Outfit, Sora, Cabinet Grotesk)
    - Corporate → professional (Roboto, Open Sans, Source Sans Pro)
    - Food/lifestyle → warm/friendly (Nunito, Quicksand, Poppins)
    - Sports → strong/impactful (Oswald, Bebas Neue, Anton)
    NEVER use the same font for all 3 slots unless the site genuinely uses one font family.

    ═══ VISUAL PATTERNS (analyze the site's design language) ═══

    Card Patterns — how does this site present grouped content?
    - corners: "rounded" (friendly, modern), "sharp" (editorial, corporate, precise), "pill" (playful, soft, lifestyle)
    - shadowDepth: "none" (flat/editorial), "subtle" (clean/modern), "medium" (depth/product), "heavy" (dramatic/bold)
    - borderStyle: "none" (minimal/clean), "thin" (subtle structure), "accent" (brand-forward), "gradient" (modern/creative)

    Spacing Patterns — how dense is the information?
    - density: "compact" (data-heavy, dashboards, tech docs), "balanced" (standard), "spacious" (editorial, luxury, lifestyle)
    - gridGap: 8-12 (compact), 14-20 (balanced), 22-32 (spacious)

    Image Patterns — how does this site treat visuals?
    - treatment: "rounded" (standard modern), "full-bleed" (immersive, editorial), "framed" (structured, portfolio), "circle" (avatars, team pages)
    - overlay: "none" (clean), "gradient" (modern readability), "dark-scrim" (text on images), "color-wash" (brand atmosphere)
    - captionStyle: "below" (standard), "overlay" (modern), "hidden" (visual-first)

    Layout Patterns — what's the content flow?
    - direction: "centered" (symmetric, calm), "left-aligned" (content-first, editorial), "asymmetric" (creative, dynamic)
    - decorativeElements: MUST include at least ONE non-"none" element. Choose based on personality:
      * "gradients" — ONLY if the site's background itself uses gradient colors (e.g. Stripe's purple-to-blue hero, Linear's dark gradient bg). Do NOT use for sites with solid white/dark backgrounds that merely feel "modern" or use gradient image overlays.
      * "accent-lines" — editorial elegance, structure (thin colored dividers)
      * "background-shapes" — playful, creative, approachable (geometric shapes)
      * "dots" — tech, data, structured patterns (dot grid textures)
      Combine 1-3 elements. NEVER return ["none"] — every site has visual character worth expressing.

    ═══ EXAMPLES OF GOOD EXTRACTION ═══

    Restaurant website (warm, inviting, food-focused):
      style: "warm rustic", animation: "bouncy playful spring"
      colors: warm accent (#E85D2C), cream bg (#FFF8F0), dark text
      fonts: heading=Playfair Display, body=Nunito, mono=Fira Code
      patterns: pill corners, medium shadows, spacious density

    News/editorial site (authoritative, dense, text-heavy):
      style: "sharp editorial", animation: "calm measured fade"
      colors: strong accent (#CC0000), white bg, near-black text
      fonts: heading=Merriweather, body=Georgia, mono=Courier
      patterns: sharp corners, no shadows, balanced density, accent-lines

    Tech startup (modern, trustworthy, product-focused):
      style: "glass morphism SaaS", animation: "smooth polished slide"
      colors: blue/purple accent (#6366F1), light bg (#FAFAFE)
      fonts: heading=Space Grotesk, body=Inter, mono=JetBrains Mono
      patterns: rounded corners, medium shadows, gradient decorations

    Sports blog (energetic, passionate, dynamic):
      style: "bold high-energy", animation: "punchy fast spring"
      colors: team-inspired accent (#1E40AF), white bg
      fonts: heading=Oswald, body=Open Sans, mono=Source Code Pro
      patterns: sharp corners, heavy shadows, compact density

    Fashion/lifestyle (elegant, visual, aspirational):
      style: "elegant organic", animation: "gentle flowing slide"
      colors: muted accent (#8B5E3C), off-white bg (#FAF7F2)
      fonts: heading=Cormorant Garamond, body=Lato, mono=IBM Plex Mono
      patterns: pill corners, subtle shadows, spacious density

    ═══ OUTPUT FORMAT ═══
    - extractable: true if there's enough content to understand the site's purpose and personality
    - reason: brief explanation of what was extracted and the website's personality
    - theme_json: VALID JSON string matching the schema (only when extractable=true)
    - patterns_json: VALID JSON string with visual patterns (only when extractable=true)
    - template_name: The actual brand or company name from the website
    """

    url: str = dspy.InputField(desc="The source URL being analyzed")
    html_content: str = dspy.InputField(desc="Rendered HTML with extracted CSS prepended (inline styles + external stylesheets)")
    markdown_content: str = dspy.InputField(desc="First 5K chars of page content as markdown")
    page_title: str = dspy.InputField(desc="Page title from metadata")
    page_description: str = dspy.InputField(desc="Meta description from metadata")

    reasoning: str = dspy.OutputField(
        desc="Step-by-step analysis: (1) Website personality — industry, audience, energy, feeling, (2) Colors found or inferred, (3) Fonts identified or chosen for personality, (4) Style choice rationale, (5) Animation choice rationale, (6) Pattern choices and why they fit this specific website"
    )
    extractable: bool = dspy.OutputField(
        desc="true if enough content exists to understand the site's purpose and design a theme"
    )
    reason: str = dspy.OutputField(
        desc="Brief explanation: what was extracted, the website's personality, and key design choices made"
    )
    theme_json: str = dspy.OutputField(
        desc='Valid JSON: {"colors":{"accent":"#hex","bg":"#hex","text":"#hex","surface":"#hex","muted":"#hex"},"fonts":{"heading":"Name","body":"Name","mono":"Name"},"borderRadius":number,"style":"free-form string describing visual identity","animationPreset":"free-form string describing motion feel","category":"free-form string for industry/niche"}. Do NOT include patterns here. Return "{}" if not extractable.'
    )
    patterns_json: str = dspy.OutputField(
        desc='Valid JSON with visual design patterns. Schema: {"cards":{"corners":"string","shadowDepth":"string","borderStyle":"string"},"spacing":{"density":"string","gridGap":number},"images":{"treatment":"string","overlay":"string","captionStyle":"string"},"layout":{"direction":"string","decorativeElements":["string"]}}. Values are descriptive — use your best judgment. decorativeElements MUST have at least one value. Return "{}" if not extractable.'
    )
    template_name: str = dspy.OutputField(
        desc='The actual brand or company name from the website (e.g. "Careem", "Nike", "Stripe", "The New York Times"). Extract the real name, not a creative description. Return "" if not extractable.'
    )


class ExtractThemeFromBrief(dspy.Signature):
    """
    You are an expert web designer, brand strategist, and visual identity analyst.
    The user is describing the brand/template they want — either as a free-text prompt
    OR as the text of a brand/design document they uploaded. Turn that brief into a
    cohesive visual theme.

    ═══ HOW TO READ THE BRIEF ═══
    - HONOR every explicit instruction: if they name colors, fonts, an industry, a
      reference brand, or a mood, use them directly.
    - INFER everything they left unsaid from the signals they DID give (industry,
      audience, vibe words, reference brands). Casual or slang wording ("make it pop",
      "gen-z neon", "classy fintech") is valid input — interpret it, don't reject it.
    - A brief is intentional input. Set extractable=false ONLY when there is genuinely
      NO usable brand signal — empty text, gibberish, or content unrelated to designing
      a brand/template (e.g. a random essay, a tax form). When in doubt, extract.

    ═══ CRITICAL: NO DEFAULTS ═══
    Make an intelligent, deliberate choice for EVERY field. Never fall back to
    generic/bland values. A restaurant, a news outlet, a fintech startup, a fashion
    brand all DEMAND different visual treatments.

    ═══ STYLE (free-form) ═══
    A specific description of the visual identity — e.g. "warm rustic", "dark cyberpunk",
    "clean editorial", "glass morphism SaaS", "bold sports", "zen minimal". Invent one
    that fits THIS brief; not limited to any preset list.

    ═══ ANIMATION FEEL (free-form) ═══
    Motion energy matching the brand — e.g. "calm editorial fade", "bouncy playful spring",
    "sharp snappy slide", "energetic scale-pop". Not limited to any preset list.

    ═══ COLORS ═══
    - accent: primary brand/CTA color   - bg: main background   - text: primary text
    - surface: secondary bg (cards) — must visibly contrast with bg   - muted: subtle text
    Use any colors the brief states; otherwise INFER from the stated industry/mood.
    (Restaurant → warm oranges/reds. Finance → deep blues/greens. Creative → vibrant accent.)

    ═══ FONTS ═══
    Use fonts the brief names; otherwise choose to MATCH the brand's personality:
    - Editorial/news → serif headings (Playfair Display, Merriweather, Lora)
    - Tech/modern → geometric sans (Inter, Space Grotesk, DM Sans)
    - Creative/lifestyle → distinctive headings (Outfit, Sora, Cabinet Grotesk)
    - Corporate → professional (Roboto, Open Sans, Source Sans Pro)
    - Food/lifestyle → warm/friendly (Nunito, Quicksand, Poppins)
    - Sports → strong/impactful (Oswald, Bebas Neue, Anton)
    NEVER use the same font for all 3 slots unless the brief explicitly asks for one family.

    ═══ VISUAL PATTERNS ═══
    Cards — corners: "rounded"|"sharp"|"pill"; shadowDepth: "none"|"subtle"|"medium"|"heavy";
      borderStyle: "none"|"thin"|"accent"|"gradient".
    Spacing — density: "compact"|"balanced"|"spacious"; gridGap: 8-12 / 14-20 / 22-32.
    Images — treatment: "rounded"|"full-bleed"|"framed"|"circle"; overlay: "none"|"gradient"|
      "dark-scrim"|"color-wash"; captionStyle: "below"|"overlay"|"hidden".
    Layout — direction: "centered"|"left-aligned"|"asymmetric"; decorativeElements: MUST
      include at least ONE of "gradients" (only if the brand bg itself is a gradient),
      "accent-lines", "background-shapes", "dots". Combine 1-3. NEVER return ["none"].

    ═══ EXAMPLES (input-agnostic — same target shape) ═══
    "dark fintech, warm accents, Stripe-ish but friendlier":
      style: "warm glass fintech", animation: "smooth polished slide"
      colors: warm accent (#F59E0B), deep bg (#0B1220), light text
      fonts: heading=Space Grotesk, body=Inter, mono=JetBrains Mono
      patterns: rounded corners, medium shadows, gradient/accent-lines
    "cozy neighbourhood bakery, hand-made feel":
      style: "warm rustic", animation: "bouncy playful spring"
      colors: warm accent (#E85D2C), cream bg (#FFF8F0), dark text
      fonts: heading=Playfair Display, body=Nunito, mono=Fira Code
      patterns: pill corners, medium shadows, spacious density

    ═══ OUTPUT FORMAT ═══
    - extractable: true if the brief carries enough signal to design a coherent theme
    - reason: brief explanation of the personality read and key design choices
    - theme_json: VALID JSON matching the schema (only when extractable=true)
    - patterns_json: VALID JSON with visual patterns (only when extractable=true)
    - template_name: the brand name if the brief states one, else a short fitting name
    """

    brief: str = dspy.InputField(desc="The user's free-text prompt OR the extracted text of an uploaded brand/design document")
    name_hint: str = dspy.InputField(desc="Optional desired template name supplied by the user (may be empty)")

    reasoning: str = dspy.OutputField(
        desc="Step-by-step: (1) personality read — industry, audience, energy, feeling, (2) colors stated or inferred, (3) fonts stated or chosen for personality, (4) style rationale, (5) animation rationale, (6) pattern choices and why they fit this brief"
    )
    extractable: bool = dspy.OutputField(
        desc="true if the brief carries enough signal to design a coherent theme; false only for empty/gibberish/unrelated content"
    )
    reason: str = dspy.OutputField(
        desc="Brief explanation: the personality read from the brief and key design choices made"
    )
    theme_json: str = dspy.OutputField(
        desc='Valid JSON: {"colors":{"accent":"#hex","bg":"#hex","text":"#hex","surface":"#hex","muted":"#hex"},"fonts":{"heading":"Name","body":"Name","mono":"Name"},"borderRadius":number,"style":"free-form string describing visual identity","animationPreset":"free-form string describing motion feel","category":"free-form string for industry/niche"}. Do NOT include patterns here. Return "{}" if not extractable.'
    )
    patterns_json: str = dspy.OutputField(
        desc='Valid JSON with visual design patterns. Schema: {"cards":{"corners":"string","shadowDepth":"string","borderStyle":"string"},"spacing":{"density":"string","gridGap":number},"images":{"treatment":"string","overlay":"string","captionStyle":"string"},"layout":{"direction":"string","decorativeElements":["string"]}}. decorativeElements MUST have at least one value. Return "{}" if not extractable.'
    )
    template_name: str = dspy.OutputField(
        desc='The brand name if the brief states one, else a short fitting name for the template. Return "" if not extractable.'
    )




def _decide_gradient(theme: dict) -> bool:
    """Decide whether this brand warrants a gradient background.

    Only trusts decorativeElements — the most direct signal for background treatment.
    borderStyle/overlay are too generic (e.g. image overlays on white-bg sites) and
    produce false positives for solid-identity brands like Careem.
    """
    patterns = theme.get("patterns", {})
    decorative = patterns.get("layout", {}).get("decorativeElements", [])

    return "gradients" in decorative


def _compute_bg2(bg_hex: str) -> str:
    """Compute a subtle gradient endpoint from a bg color — stays on-brand, never jarring."""
    try:
        bg_hex = bg_hex.lstrip("#")
        r, g, b = int(bg_hex[0:2], 16) / 255, int(bg_hex[2:4], 16) / 255, int(bg_hex[4:6], 16) / 255
        h, l, s = colorsys.rgb_to_hls(r, g, b)

        if l > 0.5:
            # Light bg: darken slightly (-12% lightness) for a subtle gradient
            l2 = max(0.0, l - 0.12)
        else:
            # Dark bg: lighten slightly (+10% lightness)
            l2 = min(1.0, l + 0.10)

        r2, g2, b2 = colorsys.hls_to_rgb(h, l2, s)
        return "#{:02x}{:02x}{:02x}".format(int(r2 * 255), int(g2 * 255), int(b2 * 255))
    except Exception:
        return bg_hex  # Fallback: same color (effectively no gradient)


# Transition-style pools by motion energy. Family keys MUST exist in the
# pickGeneratedTransition pool in generatedTransitions.ts (mirrored in frontend).
# Each energy keeps a distinct personality so motionEnergy is a real inter-brand
# lever: calm = quiet fades/washes/folds, smooth = polished pushes/bars, energetic
# = punchy whips/flips. Each pool now mixes the stock @remotion moves with the
# richer palette-driven custom presentations (parallax_push / whip_pan / accent_bar
# / page_fold / ink_bleed) so each energy gets a distinct, varied rhythm; the pool
# also rotates each move's DIRECTION by index for varied handoffs.
_TRANSITION_FAMILY_BY_ENERGY = {
    "calm": ["fade", "ink_bleed", "page_fold", "cover_wipe", "ink_wash"],
    "smooth": ["parallax_push", "fade", "accent_bar", "page_fold", "clock_sweep", "ink_bleed"],
    "energetic": ["whip_pan", "accent_bar", "rule_sweep", "page_flip", "parallax_push", "whip_blur"],
}
_DECOR_BY_ELEMENT = {
    "gradients": "orbs",
    "background-shapes": "orbs",
    "dots": "dots",
    "accent-lines": "rules",
}
_INTENSITY_BY_DENSITY = {"compact": 0.3, "balanced": 0.45, "spacious": 0.6}

# ── Brand-signature engine (v3) ────────────────────────────────────────────
# The load-bearing answer to "won't every scraped brand look like a recolored
# copy?": identity is carried mostly by decor + surface + type + motion, NOT
# geometry. We deterministically map each brand's category/style to a SIGNATURE
# bundle across those axes, so two different sites (e.g. fintech vs editorial)
# provably diverge. The kit exposes the matching decor systems / surface
# variants / reveal personalities; code generation is told the signature so the
# AI threads it into each scene. decorSystem values MUST exist in kit/Decor.tsx;
# surfaceStyle in kit/cards.tsx cardStyle(); typeTreatment guides the prompt.
#
# surfaceStyle values MUST be kit/cards.tsx SurfaceVariant (panel/glass/outline/
# flat-hairline/embossed/soft/flat); typeTreatment values MUST be keys of the
# `_type_hint` map in code_generator. `surface`/`type` are POOLS (not scalars) so
# two brands in the SAME bucket still diverge on those axes — otherwise every
# fintech would share surface+type and read as a recolor of the last one.
_SIGNATURE_BUCKETS: dict[str, dict] = {
    "data": {
        "keywords": ("fintech", "finance", "data", "tech", "saas", "dashboard", "market", "crypto", "stock", "developer", "platform", "analytics", "software"),
        "decor": ["mesh", "ticker", "grid"],
        "surface": ["glass", "outline", "panel"],
        "type": ["tight-sans", "clean-sans"],
    },
    "editorial": {
        "keywords": ("editorial", "news", "magazine", "journal", "media", "blog", "publication", "press", "story", "report"),
        "decor": ["hairlines", "concentric", "rules"],
        "surface": ["flat-hairline", "flat", "outline"],
        "type": ["editorial-serif", "clean-sans"],
    },
    "luxury": {
        "keywords": ("luxury", "fashion", "beauty", "jewel", "premium", "couture", "boutique", "elegant", "spa"),
        "decor": ["wash", "vignette", "concentric"],
        "surface": ["embossed", "soft", "panel"],
        "type": ["display-serif", "editorial-serif"],
    },
    "lifestyle": {
        "keywords": ("food", "travel", "lifestyle", "wellness", "health", "creative", "restaurant", "recipe", "fitness wellness", "home"),
        "decor": ["orbs", "dots", "wash"],
        "surface": ["soft", "panel", "embossed"],
        "type": ["rounded-sans", "clean-sans"],
    },
    "bold": {
        "keywords": ("sports", "gaming", "game", "music", "entertainment", "fitness", "esports", "athletic", "energy"),
        "decor": ["starfield", "rules", "mesh"],
        "surface": ["outline", "glass", "panel"],
        "type": ["display-bold", "tight-sans"],
    },
    "default": {
        "keywords": (),
        "decor": ["rules", "dots", "grid"],
        "surface": ["flat", "panel", "outline"],
        "type": ["clean-sans", "tight-sans"],
    },
}


# Per-bucket SIGNATURE ARTIFACT motion treatments. The brand's `decorSystem`
# motif is its recurring artifact; this is HOW that motif animates — picked per
# brand so two brands sharing a motif still move it differently. Evocative motion
# words the codegen model interprets into spring/interpolate beats on the motif.
# Woven through every scene where it fits (hero take in intro, echoes in content,
# callback in outro) — this is what gives a custom template a nightfall/bloomberg-
# style signature beat without a per-brand hand-built component.
# Widened pools (each motion is rendered by a distinct kit artifact via the
# SignatureArtifact dispatcher). More options per bucket → two same-bucket brands
# collide on the headline artifact far less often. Every value here MUST exist as
# a case in kit/Artifacts.tsx SignatureArtifact, or it falls through to the
# default StreakField.
# Order matters: the FIRST entries are the bolder / more legible artifacts, so the
# deterministic pick favours something visible over the faintest motif. streak /
# drift / dust are the subtlest (low-opacity background shimmer) — kept in the
# pools for variety but demoted so a loud brand doesn't land on an invisible motif.
_ARTIFACT_MOTION_BY_BUCKET = {
    "data": ["sweep", "build", "tick", "orbit", "halftone"],
    "editorial": ["draw-in", "rule-slide", "orbit", "halftone", "dust"],
    "luxury": ["bloom", "orbit", "halftone", "drift", "dust"],
    "lifestyle": ["bloom", "halftone", "sweep", "float", "dust"],
    "bold": ["shards", "slam", "pulse", "spin", "stamp", "streak"],
    "default": ["sweep", "shards", "orbit", "halftone", "drift"],
}


def _classify_brand_bucket(style: str, category: str) -> str:
    """Pick the signature bucket whose keywords best match the brand text."""
    hay = f"{style} {category}".lower()
    best, best_hits = "default", 0
    for name, spec in _SIGNATURE_BUCKETS.items():
        if name == "default":
            continue
        hits = sum(1 for kw in spec["keywords"] if kw in hay)
        if hits > best_hits:
            best, best_hits = name, hits
    return best


def _stable_pick(options: list, seed: str):
    """Deterministically choose one option from a stable hash of `seed`.

    Lets two brands in the SAME bucket still diverge (mesh vs ticker) while
    staying stable across regenerations of the same brand.
    """
    if not options:
        return None
    import hashlib

    h = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    return options[h % len(options)]


def _stable_order(options: list, seed: str) -> list:
    """Deterministic brand-seeded ordering of `options` (Fisher–Yates from a stable
    hash). Two different brands get different orders; the same brand is stable."""
    import hashlib

    out = list(options)
    rng = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    for k in range(len(out) - 1, 0, -1):
        rng, j = divmod(rng, k + 1)
        out[k], out[j] = out[j], out[k]
    return out


def _derive_brand_signature(theme: dict, energy: str, motion: dict) -> dict:
    """Deterministic per-brand signature bundle. See _SIGNATURE_BUCKETS."""
    style = (theme.get("style") or "").lower()
    category = (theme.get("category") or "").lower()
    bucket = _classify_brand_bucket(style, category)
    spec = _SIGNATURE_BUCKETS[bucket]
    # Fold the accent colour into the seed so two same-bucket brands with the same
    # name/category/style but different palettes still diverge on the signature
    # picks (more inter-brand entropy, still deterministic per brand).
    accent = (theme.get("colors", {}) or {}).get("accent", "")
    seed = f"{theme.get('category', '')}|{theme.get('style', '')}|{theme.get('name', '')}|{accent}"
    # Independent seed suffixes so decor/surface/type vary on separate axes —
    # two same-bucket brands shouldn't move in lockstep across all three.
    decor_system = _stable_pick(spec["decor"], seed)
    surface_style = _stable_pick(spec["surface"], seed + "|surface")
    type_treatment = _stable_pick(spec["type"], seed + "|type")
    pool = _ARTIFACT_MOTION_BY_BUCKET.get(bucket, _ARTIFACT_MOTION_BY_BUCKET["default"])
    artifact_motion = _stable_pick(pool, seed + "|artifactMotion")
    # A small per-brand artifact SET (the primary pick + up to 2 more from the same
    # bucket, brand-seeded order) so scenes can ROTATE through a related family
    # instead of repeating one motif everywhere — variety within a coherent brand.
    artifact_set = [artifact_motion]
    for cand in _stable_order(pool, seed + "|artifactSet"):
        if cand not in artifact_set:
            artifact_set.append(cand)
        if len(artifact_set) >= 3:
            break
    return {
        "bucket": bucket,
        "decorSystem": decor_system,
        "surfaceStyle": surface_style,
        "typeTreatment": type_treatment,
        "artifactMotion": artifact_motion,
        "artifactSet": artifact_set,
        "motionEnergy": energy,
        "transitionFamily": list(motion.get("transitionFamily") or []),
    }


# Each signature bucket has a default motion energy so the inter-brand motion
# axis actually MOVES. Keyword matching alone collapsed nearly every brand to
# "calm" (any "fade"/"soft"/"editorial" in the preset triggered it), making all
# brands share the quietest transition family — a recolor in motion terms.
_ENERGY_BY_BUCKET = {
    "data": "smooth",
    "editorial": "calm",
    "luxury": "calm",
    "lifestyle": "smooth",
    "bold": "energetic",
    "default": "smooth",
}


def _derive_motion_energy(animation_preset: str, bucket: str = "default") -> str:
    """Motion energy = the brand bucket's default, overridden ONLY by an
    unambiguous explicit cue in the preset. The bucket is the prior so two
    different brands diverge (data→smooth vs editorial→calm vs bold→energetic);
    the preset can still pull it to an extreme when the wording is clearly high-
    or low-energy, but vague words like "fade"/"editorial" no longer force calm.
    """
    a = (animation_preset or "").lower()
    if any(k in a for k in ("bounc", "punch", "energetic", "snappy", "kinetic", "explosive", "high-energy", "high energy")):
        return "energetic"
    if any(k in a for k in ("slow", "gentle", "measured", "stately", "serene", "minimal")):
        return "calm"
    return _ENERGY_BY_BUCKET.get(bucket, "smooth")


def _derive_extended_theme_fields(theme: dict) -> None:
    """Populate first-class motion / charts / decor / sceneBias fields on the theme.

    Deterministic — derived from the already-extracted style/animation/category/
    patterns so the fields always exist, stay coherent, and are user-editable.
    These are consumed by the craft kit at render time (transitionFamily, decor)
    and by code generation (sceneBias). Never overwrites values already present
    (e.g. user edits). Mutates `theme` in place.
    """
    style = (theme.get("style") or "").lower()
    category = (theme.get("category") or "").lower()
    patterns = theme.get("patterns", {}) or {}
    layout = patterns.get("layout", {}) or {}
    decoratives = layout.get("decorativeElements", []) or []
    density = (patterns.get("spacing", {}) or {}).get("density", "balanced")

    # Classify the brand bucket first so motion energy can use it as a prior
    # (otherwise every brand collapses to "calm" — see _derive_motion_energy).
    bucket = _classify_brand_bucket(style, category)
    energy = _derive_motion_energy(theme.get("animationPreset", ""), bucket)
    easing = {"calm": "easeInOutCubic", "smooth": "easeOutQuint", "energetic": "easeOutBack"}[energy]

    # motion
    motion = theme.get("motion")
    if not isinstance(motion, dict):
        motion = {}
    motion.setdefault("energy", energy)
    motion.setdefault("easing", easing)
    motion.setdefault("transitionFamily", list(_TRANSITION_FAMILY_BY_ENERGY[energy]))
    theme["motion"] = motion

    # charts
    is_data = any(k in (style + " " + category) for k in ("finance", "data", "tech", "saas", "dashboard", "market", "crypto", "stock"))
    is_editorial = any(k in (style + " " + category) for k in ("editorial", "news", "magazine", "journal"))
    is_minimal = any(k in style for k in ("minimal", "zen", "clean"))
    charts = theme.get("charts")
    if not isinstance(charts, dict):
        charts = {}
    charts.setdefault("style", "precise" if is_data else "editorial" if is_editorial else "clean")
    charts.setdefault("gridStyle", "horizontal" if is_editorial else "none" if is_minimal else "dashed")
    theme["charts"] = charts

    # signature — the deterministic per-brand identity bundle (v3). Computed
    # before decor so the brand's signature decor system drives the backdrop
    # (richer + brand-distinct) instead of the old element-only mapping.
    signature = theme.get("signature")
    if not isinstance(signature, dict):
        signature = _derive_brand_signature(theme, energy, motion)
        theme["signature"] = signature

    # decor — prefer the signature decor system; fall back to the element-based
    # mapping only if the signature somehow yielded nothing.
    decor = theme.get("decor")
    if not isinstance(decor, dict):
        decor = {}
    element_system = next((_DECOR_BY_ELEMENT[d] for d in decoratives if d in _DECOR_BY_ELEMENT), "none")
    decor.setdefault("system", signature.get("decorSystem") or element_system)
    decor.setdefault("intensity", _INTENSITY_BY_DENSITY.get(density, 0.45))
    theme["decor"] = decor

    # sceneBias — preferred content archetypes for this brand
    if not theme.get("sceneBias"):
        if is_data:
            bias = ["metrics", "comparison", "timeline", "bullets"]
        elif is_editorial:
            bias = ["quote", "timeline", "bullets", "image"]
        elif any(k in (style + " " + category) for k in ("food", "lifestyle", "fashion", "travel", "creative")):
            bias = ["image", "bullets", "quote", "steps"]
        else:
            bias = ["bullets", "metrics", "quote", "image"]
        theme["sceneBias"] = bias


class ThemeExtractor:
    """Extracts a visual theme from scraped website content using DSPy."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.ChainOfThought(ExtractThemeFromContent)
        self.predictor = dspy.asyncify(self._predictor)
        self._brief_predictor = dspy.ChainOfThought(ExtractThemeFromBrief)
        self.brief_predictor = dspy.asyncify(self._brief_predictor)

    async def extract_theme(self, scraped: ScrapedThemeData) -> dict:
        """
        Extract theme from scraped data.

        Returns:
            {
                "extractable": bool,
                "reason": str,
                "theme": dict (CustomTheme) or None,
                "template_name": str or ""
            }
        """
        # Use dedicated theme LM (lower temp, smaller token budget)
        theme_lm = get_theme_lm()

        try:
            with dspy.context(lm=theme_lm):
                result = await self.predictor(
                    url=scraped.url,
                    html_content=scraped.html,
                    markdown_content=scraped.markdown,
                    page_title=scraped.title,
                    page_description=scraped.description,
                )
        except Exception as e:
            logger.warning("Theme LM call failed for %s: %s", scraped.url, e, exc_info=True)
            return {
                "extractable": False,
                "reason": USER_THEME_AI_ERROR,
                "theme": None,
                "template_name": "",
            }

        return self._finalize(result, scraped.url)

    async def extract_theme_from_brief(self, brief: str, name_hint: str = "") -> dict:
        """
        Extract a theme from a free-text prompt or extracted document text.

        Produces the SAME shape as extract_theme() — colors/fonts/patterns plus the
        derived motion/charts/decor/signature fields — so the entire downstream
        pipeline (BrandKit, build_custom_prompt, code generation, preview) is unchanged.

        Returns:
            {"extractable": bool, "reason": str, "theme": dict | None, "template_name": str}
        """
        theme_lm = get_theme_lm()

        try:
            with dspy.context(lm=theme_lm):
                result = await self.brief_predictor(
                    brief=brief,
                    name_hint=name_hint or "",
                )
        except Exception as e:
            logger.warning("Theme LM (brief) call failed: %s", e, exc_info=True)
            return {
                "extractable": False,
                "reason": USER_THEME_AI_ERROR,
                "theme": None,
                "template_name": "",
            }

        return self._finalize(
            result,
            "brief",
            template_name_fallback=name_hint,
            not_extractable_reason=(
                "We couldn't build a theme from that. Try adding more detail about the "
                "brand, its industry, and the look and feel you want."
            ),
        )

    def _finalize(
        self,
        result,
        label: str,
        template_name_fallback: str = "",
        not_extractable_reason: str = USER_THEME_NOT_EXTRACTABLE,
    ) -> dict:
        """Shared tail for both extract paths: validate `extractable`, parse + validate
        the theme/patterns JSON, decide gradient, and derive extended fields.
        `label` is used only for logging (a URL or 'brief')."""
        extractable = result.extractable
        if isinstance(extractable, str):
            extractable = extractable.lower().strip() in ("true", "yes", "1")

        if not extractable:
            raw_reason = (result.reason or "").strip()
            if raw_reason:
                logger.info(
                    "Theme not extractable for %s (model reason): %s",
                    label,
                    raw_reason[:500],
                )
            return {
                "extractable": False,
                "reason": not_extractable_reason,
                "theme": None,
                "template_name": "",
            }

        # Parse and validate theme + patterns JSON
        theme = self._parse_theme(result.theme_json, result.patterns_json)
        if theme is None:
            logger.warning(
                "Failed to parse theme JSON for %s (theme_json len=%s, patterns len=%s)",
                label,
                len(result.theme_json or ""),
                len(result.patterns_json or ""),
            )
            return {
                "extractable": False,
                "reason": USER_THEME_AI_ERROR,
                "theme": None,
                "template_name": "",
            }

        # AI-decide gradient vs solid based on extracted brand signals
        use_gradient = _decide_gradient(theme)
        decorative = theme.get("patterns", {}).get("layout", {}).get("decorativeElements", [])
        print(
            f"[F7-DEBUG] [GRADIENT-DECISION] brand='{theme.get('category')}' "
            f"decorative={decorative} → {'GRADIENT' if use_gradient else 'SOLID'}"
        )
        if use_gradient:
            bg_hex = theme["colors"].get("bg", "#000000")
            bg2 = _compute_bg2(bg_hex)
            theme["colors"]["bg2"] = bg2
            print(f"[F7-DEBUG] [GRADIENT-DECISION] bg={theme['colors'].get('bg')} → bg2={bg2}")

        # Derive first-class motion / charts / decor / sceneBias fields from the
        # extracted signals so the craft kit + codegen get explicit brand cues.
        _derive_extended_theme_fields(theme)
        _motion = theme.get("motion", {})
        print(
            f"[F7-DEBUG] [THEME] Extended: motion={_motion.get('energy')}/{_motion.get('transitionFamily')}, "
            f"decor={theme.get('decor', {}).get('system')}@{theme.get('decor', {}).get('intensity')}, "
            f"charts={theme.get('charts', {}).get('style')}, sceneBias={theme.get('sceneBias')}"
        )
        _sig = theme.get("signature", {}) or {}
        print(
            f"[F7-DEBUG] [V3][SIGNATURE] bucket={_sig.get('bucket')} | "
            f"decorSystem={_sig.get('decorSystem')} | surfaceStyle={_sig.get('surfaceStyle')} | "
            f"typeTreatment={_sig.get('typeTreatment')} | artifactMotion={_sig.get('artifactMotion')} | "
            f"artifactSet={_sig.get('artifactSet')} | "
            f"motionEnergy={_sig.get('motionEnergy')} | transitionFamily={_sig.get('transitionFamily')}"
        )

        colors = theme.get("colors", {})
        fonts = theme.get("fonts", {})
        print(
            f"[F7-DEBUG] [THEME] Extracted: "
            f"style='{theme.get('style')}', "
            f"colors=[accent={colors.get('accent')}, bg={colors.get('bg')}, bg2={colors.get('bg2')}], "
            f"fonts=[{fonts.get('heading')}/{fonts.get('body')}], "
            f"category='{theme.get('category')}', gradient={colors.get('bg2') is not None}"
        )

        template_name = (result.template_name or "").strip() or (template_name_fallback or "").strip() or "Custom Theme"
        return {
            "extractable": True,
            "reason": result.reason or "Theme extracted successfully",
            "theme": theme,
            "template_name": template_name,
        }

    @staticmethod
    def _strip_code_blocks(raw: str) -> str:
        """Strip markdown code fences from a JSON string."""
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = "\n".join(lines)
        return raw

    def _parse_theme(self, theme_json_str: str, patterns_json_str: str = "") -> dict | None:
        """Parse and validate theme + patterns JSON from LLM output.
        Returns None if either JSON is invalid or incomplete — no hardcoded fallbacks."""

        # Parse theme JSON
        try:
            raw = self._strip_code_blocks(theme_json_str)
            theme = json.loads(raw)
            if not isinstance(theme, dict) or not theme:
                return None
        except (json.JSONDecodeError, TypeError):
            return None

        # Validate required fields exist and have correct types
        colors = theme.get("colors")
        if not isinstance(colors, dict):
            return None
        for key in ("accent", "bg", "text", "surface", "muted"):
            if key not in colors or not isinstance(colors[key], str):
                return None

        fonts = theme.get("fonts")
        if not isinstance(fonts, dict):
            return None
        for key in ("heading", "body", "mono"):
            if key not in fonts or not isinstance(fonts[key], str):
                return None

        if not isinstance(theme.get("borderRadius"), (int, float)):
            return None

        # Style, animation, category must be non-empty strings (free-form, no enum)
        for field in ("style", "animationPreset", "category"):
            if not isinstance(theme.get(field), str) or not theme[field].strip():
                return None

        # Parse patterns JSON
        if not patterns_json_str:
            return None

        try:
            raw_patterns = self._strip_code_blocks(patterns_json_str)
            patterns = json.loads(raw_patterns)
            if not isinstance(patterns, dict) or not patterns:
                return None
        except (json.JSONDecodeError, TypeError):
            return None

        # Remove patterns if LLM leaked them into theme_json, then set from dedicated field
        theme.pop("patterns", None)
        theme["patterns"] = patterns

        return theme

