"""
DSPy module for extracting visual themes from scraped website content.
Takes HTML/CSS + markdown and produces a structured theme JSON.
"""

import colorsys
import hashlib
import json
import logging
import dspy

from app.dspy_modules import ensure_dspy_configured, get_brand_extraction_lm
from app.services.render_registry import (
    DEFAULT_BODY_FONT,
    DEFAULT_HEADING_FONT,
    FONT_IDS,
    snap,
)
from app.services.theme_scraper import (
    ScrapedThemeData,
    USER_THEME_AI_ERROR,
    USER_THEME_NOT_EXTRACTABLE,
)

logger = logging.getLogger(__name__)


# The narrative half of brand extraction, shared by the URL and brief paths so
# link / prompt / doc all produce it.
#
# The structured fields (colours, fonts, patterns) say WHAT a brand uses; they
# cannot say what it FEELS like, and a template designed from hexes and font
# names alone is a recolour. This field is the design brief a human art director
# would write before drawing anything, and it is the primary input to the design
# doc stage — so its quality sets the ceiling on how distinct templates can be.
#
# Deliberately open-ended: naming a fixed list of styles here would recreate, one
# stage earlier, exactly the menu-driven convergence this refactor removed.
_BRAND_DESCRIPTION_DESC = (
    "2-4 sentences of VISUAL DESIGN CONTEXT for this brand, written for a "
    "designer who will build a video template from it. Name the design register "
    "(animatic, modernist, classical, editorial, brutalist, hand-drawn, "
    "cinematic, technical, playful, austere — or any other that genuinely fits), "
    "the emotional temperature, the typographic and compositional character, how "
    "motion should feel, and what this brand would NEVER look like. Write prose, "
    "not keywords. Do NOT restrict yourself to the examples listed here — if the "
    "brand is something else, say what it actually is. Be specific to THIS brand: "
    "a description that would fit any company in its industry is useless."
)


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
    EXACTLY THREE colours. Everything else the renderer derives from them
    (panels, borders, muted label text and a readable accent-on-background) —
    supplying more only invited off-brand hues into the video.
    - accent: The primary brand/CTA color (buttons, links, highlights, rules)
    - bg: Main background color
    - text: Primary text color — must be readable on bg
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
        desc='Valid JSON: {"colors":{"accent":"#hex","bg":"#hex","text":"#hex"},"fonts":{"heading":"Name","body":"Name","mono":"Name"},"borderRadius":number,"style":"free-form string describing visual identity","animationPreset":"free-form string describing motion feel","category":"free-form string for industry/niche"}. Do NOT include patterns here. Return "{}" if not extractable.'
    )
    patterns_json: str = dspy.OutputField(
        desc='Valid JSON with visual design patterns. Schema: {"cards":{"corners":"string","shadowDepth":"string","borderStyle":"string"},"spacing":{"density":"string","gridGap":number},"images":{"treatment":"string","overlay":"string","captionStyle":"string"},"layout":{"direction":"string","decorativeElements":["string"]}}. Values are descriptive — use your best judgment. decorativeElements MUST have at least one value. Return "{}" if not extractable.',
        default="{}",
    )
    template_name: str = dspy.OutputField(
        desc='The actual brand or company name from the website (e.g. "Careem", "Nike", "Stripe", "The New York Times"). Extract the real name, not a creative description. Return "" if not extractable.',
        default="",
    )
    # Optional: JSONAdapter compares parsed keys to the signature with STRICT
    # equality, so one truncated trailing field discards an otherwise complete
    # extraction. Every consumer of these three already falls back
    # (`or ""`, `or "Custom Theme"`, patterns_json defaults to "{}"), so a
    # default costs nothing and buys back the whole result.
    brand_description: str = dspy.OutputField(
        desc=_BRAND_DESCRIPTION_DESC, default=""
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
    EXACTLY THREE colours; the renderer derives panels/borders/muted from them.
    - accent: primary brand/CTA color   - bg: main background   - text: primary text
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
        desc='Valid JSON: {"colors":{"accent":"#hex","bg":"#hex","text":"#hex"},"fonts":{"heading":"Name","body":"Name","mono":"Name"},"borderRadius":number,"style":"free-form string describing visual identity","animationPreset":"free-form string describing motion feel","category":"free-form string for industry/niche"}. Do NOT include patterns here. Return "{}" if not extractable.'
    )
    patterns_json: str = dspy.OutputField(
        desc='Valid JSON with visual design patterns. Schema: {"cards":{"corners":"string","shadowDepth":"string","borderStyle":"string"},"spacing":{"density":"string","gridGap":number},"images":{"treatment":"string","overlay":"string","captionStyle":"string"},"layout":{"direction":"string","decorativeElements":["string"]}}. decorativeElements MUST have at least one value. Return "{}" if not extractable.',
        default="{}",
    )
    template_name: str = dspy.OutputField(
        desc='The brand name if the brief states one, else a short fitting name for the template. Return "" if not extractable.',
        default="",
    )
    # Optional: JSONAdapter compares parsed keys to the signature with STRICT
    # equality, so one truncated trailing field discards an otherwise complete
    # extraction. Every consumer of these three already falls back
    # (`or ""`, `or "Custom Theme"`, patterns_json defaults to "{}"), so a
    # default costs nothing and buys back the whole result.
    brand_description: str = dspy.OutputField(
        desc=_BRAND_DESCRIPTION_DESC, default=""
    )




def _decide_gradient(theme: dict) -> bool:
    """Whether to give this brand a gradient background. Always False.

    SOLID IS THE DEFAULT, and a gradient is now something the user turns on in
    the editor's background control (which writes `colors.bg2` directly).

    This used to return `"gradients" in decorativeElements`, which fired for
    NINE OF TWELVE recent templates — the extractor lists "gradients" for almost
    any modern site, because almost any modern site has a gradient somewhere.
    That is far too weak a signal to change a template's whole background
    treatment, and a gradient nobody asked for is the more surprising outcome.

    Kept as a function rather than inlined so the decision has one home if it
    ever becomes a real (e.g. user-set) flag again.
    """
    return False


def _relative_luminance(hex_str: str) -> float:
    """WCAG relative luminance. Mirrors kit/theme.ts so poles agree."""
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))

    def _lin(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def _contrast(a: str, b: str) -> float:
    la, lb = _relative_luminance(a), _relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _readable_pole(hex_str: str) -> str:
    """Which foreground this colour wants — the exact test kit/theme.ts uses.

    Two colours sharing a pole can carry the SAME text colour, which is what
    makes a two-stop gradient safe.
    """
    return "#FFFFFF" if _contrast(hex_str, "#FFFFFF") >= _contrast(hex_str, "#0A0A0A") else "#0A0A0A"


def _compute_bg2(bg_hex: str, accent_hex: str | None = None) -> str:
    """The gradient's second stop: `bg` tinted TOWARD THE BRAND ACCENT.

    Why not simply the accent itself, which is what "a gradient between the
    accent and the background" literally asks for: measured over five real
    brands, FOUR have an accent on the opposite side of the light/dark divide
    from their background (NVIDIA #0B0B0B -> #76B900, Stripe #FFFFFF -> #635BFF,
    a red brand #FAFAFA -> #E4002B). A gradient spanning that divide has no
    legible text colour at all — kit/theme.ts records the measurement: "49% of
    unconstrained two-stop gradients admit no colour clearing AA on both ends",
    white reading 17:1 on one stop and 1.18:1 on the other.

    So the stop walks from `bg` toward the accent and stops at the last point
    where BOTH ENDS STILL WANT THE SAME TEXT COLOUR. The result is visibly the
    brand's accent — a green-tinted black for NVIDIA — and the copy stays
    readable across the whole sweep.

    Falls back to the previous lightness-nudge when no accent is available.
    """
    try:
        bg_hex = "#" + bg_hex.lstrip("#")
        pole = _readable_pole(bg_hex)

        if accent_hex:
            accent_hex = "#" + accent_hex.lstrip("#")
            br, bgc, bb = (int(bg_hex.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
            ar, ag, ab = (int(accent_hex.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
            # Walk down from a strong tint; take the strongest that keeps the pole.
            for step in (0.55, 0.45, 0.35, 0.28, 0.22, 0.16, 0.12, 0.08):
                mixed = "#{:02x}{:02x}{:02x}".format(
                    round(br + (ar - br) * step),
                    round(bgc + (ag - bgc) * step),
                    round(bb + (ab - bb) * step),
                )
                if _readable_pole(mixed) == pole:
                    return mixed
            # Every tint crossed the divide (a bg sitting right on it). Fall
            # through to the lightness nudge rather than shipping a stop that
            # would force the text colour to move.

        h_ = bg_hex.lstrip("#")
        r, g, b = int(h_[0:2], 16) / 255, int(h_[2:4], 16) / 255, int(h_[4:6], 16) / 255
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        l2 = max(0.0, l - 0.12) if l > 0.5 else min(1.0, l + 0.10)
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

# ── Brand buckets ──────────────────────────────────────────────────────────
# A coarse category classifier, kept for ONE purpose: motion energy needs a prior
# so that two brands diverge (data->smooth vs editorial->calm vs bold->energetic)
# instead of every brand collapsing to "calm" off vague preset wording.
#
# This used to anchor a much larger "signature engine" that also assigned each
# brand a decor system, a surface variant, a type treatment and an artifact
# motion from fixed pools. That bundle was a primary cause of template
# convergence: brands differed only by which cell of a fixed grid they hashed
# into, which is a permutation, not a design. The design doc now authors all of
# it in prose, so only the keywords survive.
_BUCKET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "data": ("fintech", "finance", "data", "tech", "saas", "dashboard", "market", "crypto", "stock", "developer", "platform", "analytics", "software"),
    "editorial": ("editorial", "news", "magazine", "journal", "media", "blog", "publication", "press", "story", "report"),
    "luxury": ("luxury", "fashion", "beauty", "jewel", "premium", "couture", "boutique", "elegant", "spa"),
    "lifestyle": ("food", "travel", "lifestyle", "wellness", "health", "creative", "restaurant", "recipe", "fitness wellness", "home"),
    "bold": ("sports", "gaming", "game", "music", "entertainment", "fitness", "esports", "athletic", "energy"),
}

# Each bucket has a default motion energy so the inter-brand motion axis actually
# MOVES. Keyword matching alone collapsed nearly every brand to "calm" (any
# "fade"/"soft"/"editorial" in the preset triggered it), making all brands share
# the quietest transition family — a recolour in motion terms.
_ENERGY_BY_BUCKET = {
    "data": "smooth",
    "editorial": "calm",
    "luxury": "calm",
    "lifestyle": "smooth",
    "bold": "energetic",
    "default": "smooth",
}


def _classify_brand_bucket(style: str, category: str) -> str:
    """Pick the bucket whose keywords best match the brand text."""
    hay = f"{style} {category}".lower()
    best, best_hits = "default", 0
    for name, keywords in _BUCKET_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in hay)
        if hits > best_hits:
            best, best_hits = name, hits
    return best


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
    # Shuffled per brand, not handed out as a fixed preset list.
    #
    # There are only three energy buckets, so every "energetic" brand received a
    # byte-identical family in a fixed order — and the renderer picks by
    # `index % len(pool)`, so identical order means identical transition on every
    # cut. Two unrelated brands (Yango, LaDucTrading) demonstrably shared a whole
    # rhythm. The bucket still decides WHICH moves a brand gets (that is the
    # motion personality); the seed decides the order it gets them in.
    _tf_seed = f"{category}|{style}|{(theme.get('colors') or {}).get('accent', '')}"
    motion.setdefault(
        "transitionFamily",
        sorted(
            _TRANSITION_FAMILY_BY_ENERGY[energy],
            key=lambda t: hashlib.md5(f"{_tf_seed}|tf|{t}".encode()).hexdigest(),
        ),
    )
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

    # decor — derived from the brand's own decorative elements.
    #
    # This used to prefer `signature.decorSystem`, one field of a deterministic
    # per-brand "identity bundle" that also picked a surface style, a type
    # treatment and an artifact motion from fixed enum lists. That bundle was
    # the seed of template convergence — brands differed by which cell of a
    # fixed grid they hashed into — and it is gone. The design doc now authors
    # all of that in prose; only this decor fallback, which the render path
    # still reads, survives.
    decor = theme.get("decor")
    if not isinstance(decor, dict):
        decor = {}
    element_system = next((_DECOR_BY_ELEMENT[d] for d in decoratives if d in _DECOR_BY_ELEMENT), "none")
    decor.setdefault("system", element_system)
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
        theme_lm = get_brand_extraction_lm()

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
        theme_lm = get_brand_extraction_lm()

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
            bg2 = _compute_bg2(bg_hex, theme["colors"].get("accent"))
            theme["colors"]["bg2"] = bg2
            print(f"[F7-DEBUG] [GRADIENT-DECISION] bg={theme['colors'].get('bg')} → bg2={bg2}")

        # The narrative design brief. Primary input to the design-doc stage, so
        # it is carried on the theme rather than being logged and discarded.
        brand_description = (getattr(result, "brand_description", "") or "").strip()
        if brand_description:
            theme["brand_description"] = brand_description
        else:
            # Not fatal — the design doc still has colours, fonts and style to
            # work from — but it is the strongest signal it gets, so say so.
            logger.warning("No brand_description returned for %s", label)

        # Derive first-class motion / charts / decor / sceneBias fields from the
        # extracted signals so the renderer gets explicit brand cues.
        _derive_extended_theme_fields(theme)
        _motion = theme.get("motion", {})
        print(
            f"[F7-DEBUG] [THEME] Extended: motion={_motion.get('energy')}/{_motion.get('transitionFamily')}, "
            f"decor={theme.get('decor', {}).get('system')}@{theme.get('decor', {}).get('intensity')}, "
            f"charts={theme.get('charts', {}).get('style')}, sceneBias={theme.get('sceneBias')}"
        )
        print(
            f"[F7-DEBUG] [THEME] brand_description ({len(brand_description)} chars): "
            f"{brand_description[:240]}"
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
        # Three required keys, not five. This guard returns None — discarding
        # the ENTIRE extraction — so leaving surface/muted here while removing
        # them from the prompt would fail every extraction outright.
        for key in ("accent", "bg", "text"):
            if key not in colors or not isinstance(colors[key], str):
                return None
        # Older callers and stored themes may still carry these; drop them so a
        # freshly extracted theme is exactly the three brand colours.
        for legacy in ("surface", "muted"):
            colors.pop(legacy, None)

        fonts = theme.get("fonts")
        if not isinstance(fonts, dict):
            return None
        for key in ("heading", "body", "mono"):
            if key not in fonts or not isinstance(fonts[key], str):
                return None

        # Snap font names onto faces the app actually ships.
        #
        # Whatever the model saw on the site was stored verbatim, and that is not
        # a usable font identifier: templates carry "merriweather", "oswald",
        # "playfair_display", "dm_sans". The preview builds a Google Fonts URL
        # from this value, and Google Fonts is case-sensitive and rejects
        # snake_case — `family=merriweather` returns HTTP 400 (verified live), so
        # the stylesheet never loaded and every scene fell back to the system
        # sans. Measured across the 12 most recent templates, 4 stored at least
        # one name that 400s.
        #
        # snap() normalises case and separators, so "Playfair Display",
        # "playfair_display" and "PLAYFAIR-DISPLAY" all land on the real id. A
        # name outside FONT_IDS is a face nothing can load, so it falls back to
        # the default rather than being stored as an unrenderable string.
        fonts["heading"] = snap(fonts["heading"], FONT_IDS, DEFAULT_HEADING_FONT)
        fonts["body"] = snap(fonts["body"], FONT_IDS, DEFAULT_BODY_FONT)
        # Mono has no dedicated default — fira_code is the only mono face bundled.
        fonts["mono"] = snap(fonts["mono"], FONT_IDS, "fira_code")

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

