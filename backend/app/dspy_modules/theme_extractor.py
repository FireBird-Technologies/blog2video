"""
DSPy module for extracting visual themes from scraped website content.
Takes HTML/CSS + markdown and produces a structured theme JSON.
"""

import json
import dspy

from app.dspy_modules import ensure_dspy_configured
from app.services.theme_scraper import ScrapedThemeData


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

    ═══ STYLE SELECTION (choose ONE — match the website's personality) ═══
    - "minimal": Clean editorial sites, documentation, text-heavy blogs. Understated elegance.
             Use for: The New Yorker, Medium, Notion docs, academic sites.
    - "glass": Modern SaaS, fintech, AI products. Depth through transparency.
             Use for: Linear, Stripe, Vercel, modern dashboards.
    - "bold": Confident brands, news outlets, sports, agencies. Strong visual presence.
             Use for: ESPN, Nike, design agencies, political sites, editorial magazines.
    - "neon": Developer tools, gaming, nightlife, cyberpunk aesthetic. Dark + vibrant.
             Use for: GitHub, Discord, gaming sites, crypto platforms.
    - "soft": Lifestyle, food, wellness, children, friendly products. Warm and approachable.
             Use for: Restaurants, Airbnb, wellness brands, recipe sites, e-commerce.

    ═══ ANIMATION PRESET (match the energy level) ═══
    - "fade": Calm, editorial, thoughtful content (news, blogs, documentation)
    - "slide": Modern, professional, product-focused (SaaS, corporate, portfolios)
    - "spring": Energetic, dynamic, playful (sports, entertainment, social, food)
    - "typewriter": Storytelling, educational, narrative-driven (courses, tutorials, stories)

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
      * "gradients" — modern depth, SaaS, lifestyle (radial gradient orbs)
      * "accent-lines" — editorial elegance, structure (thin colored dividers)
      * "background-shapes" — playful, creative, approachable (geometric shapes)
      * "dots" — tech, data, structured patterns (dot grid textures)
      Combine 1-3 elements. NEVER return ["none"] — every site has visual character worth expressing.

    ═══ EXAMPLES OF GOOD EXTRACTION ═══

    Restaurant website (warm, inviting, food-focused):
      style: "soft", animation: "spring"
      colors: warm accent (#E85D2C), cream bg (#FFF8F0), dark text
      fonts: heading=Playfair Display, body=Nunito, mono=Fira Code
      corners: "pill", shadows: "medium", borders: "none"
      density: "spacious", gridGap: 24, images: "full-bleed" + "gradient" overlay
      decorative: ["gradients", "background-shapes"], direction: "centered"

    News/editorial site (authoritative, dense, text-heavy):
      style: "bold", animation: "fade"
      colors: strong accent (#CC0000), white bg, near-black text
      fonts: heading=Merriweather, body=Georgia, mono=Courier
      corners: "sharp", shadows: "none", borders: "thin"
      density: "balanced", gridGap: 20, images: "full-bleed" + "none" overlay
      decorative: ["accent-lines"], direction: "left-aligned"

    Tech startup (modern, trustworthy, product-focused):
      style: "glass", animation: "slide"
      colors: blue/purple accent (#6366F1), light bg (#FAFAFE)
      fonts: heading=Space Grotesk, body=Inter, mono=JetBrains Mono
      corners: "rounded", shadows: "medium", borders: "accent"
      density: "balanced", gridGap: 16, images: "rounded" + "gradient" overlay
      decorative: ["gradients", "dots"], direction: "left-aligned"

    Sports blog (energetic, passionate, dynamic):
      style: "bold", animation: "spring"
      colors: team-inspired accent (#1E40AF), white bg
      fonts: heading=Oswald, body=Open Sans, mono=Source Code Pro
      corners: "sharp", shadows: "heavy", borders: "accent"
      density: "compact", gridGap: 12, images: "full-bleed" + "dark-scrim" overlay
      decorative: ["accent-lines", "background-shapes"], direction: "asymmetric"

    Fashion/lifestyle (elegant, visual, aspirational):
      style: "soft", animation: "slide"
      colors: muted accent (#8B5E3C), off-white bg (#FAF7F2)
      fonts: heading=Cormorant Garamond, body=Lato, mono=IBM Plex Mono
      corners: "pill", shadows: "subtle", borders: "gradient"
      density: "spacious", gridGap: 28, images: "full-bleed" + "color-wash" overlay
      decorative: ["gradients", "dots"], direction: "asymmetric"

    ═══ OUTPUT FORMAT ═══
    - extractable: true if there's enough content to understand the site's purpose and personality
    - reason: brief explanation of what was extracted and the website's personality
    - theme_json: VALID JSON string matching the schema (only when extractable=true)
    - patterns_json: VALID JSON string with visual patterns (only when extractable=true)
    - template_name: A creative 2-3 word name capturing the site's essence
    """

    url: str = dspy.InputField(desc="The source URL being analyzed")
    html_content: str = dspy.InputField(desc="First 20K chars of rendered HTML with inline styles and CSS")
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
        desc='Valid JSON: {"colors":{"accent":"#hex","bg":"#hex","text":"#hex","surface":"#hex","muted":"#hex"},"fonts":{"heading":"Name","body":"Name","mono":"Name"},"borderRadius":number,"style":"minimal|glass|bold|neon|soft","animationPreset":"fade|slide|spring|typewriter","category":"educational|product|blog|creative|tech|corporate|lifestyle"}. Do NOT include patterns here. Return "{}" if not extractable.'
    )
    patterns_json: str = dspy.OutputField(
        desc='Valid JSON with visual design patterns. Schema: {"cards":{"corners":"rounded|sharp|pill","shadowDepth":"none|subtle|medium|heavy","borderStyle":"none|thin|accent|gradient"},"spacing":{"density":"compact|balanced|spacious","gridGap":8-32},"images":{"treatment":"rounded|full-bleed|framed|circle","overlay":"none|gradient|dark-scrim|color-wash","captionStyle":"below|overlay|hidden"},"layout":{"direction":"centered|left-aligned|asymmetric","decorativeElements":["gradients","accent-lines","background-shapes","dots"]}}. decorativeElements MUST have at least one non-"none" value. Return "{}" if not extractable.'
    )
    template_name: str = dspy.OutputField(
        desc='Creative 2-3 word name capturing the site\'s essence (e.g. "Editorial Authority", "Warm Kitchen", "Neon Dev"). Return "" if not extractable.'
    )


VALID_STYLES = {"minimal", "glass", "bold", "neon", "soft"}
VALID_ANIMATIONS = {"fade", "slide", "spring", "typewriter"}
VALID_CATEGORIES = {"educational", "product", "blog", "creative", "tech", "corporate", "lifestyle"}


class ThemeExtractor:
    """Extracts a visual theme from scraped website content using DSPy."""

    def __init__(self):
        ensure_dspy_configured()
        self._predictor = dspy.ChainOfThought(ExtractThemeFromContent)
        self.predictor = dspy.asyncify(self._predictor)

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
        try:
            result = await self.predictor(
                url=scraped.url,
                html_content=scraped.html,
                markdown_content=scraped.markdown,
                page_title=scraped.title,
                page_description=scraped.description,
            )
        except Exception as e:
            return {
                "extractable": False,
                "reason": f"Theme extraction failed: {e}",
                "theme": None,
                "template_name": "",
            }

        extractable = result.extractable
        if isinstance(extractable, str):
            extractable = extractable.lower().strip() in ("true", "yes", "1")

        if not extractable:
            return {
                "extractable": False,
                "reason": result.reason or "Site did not have enough visual data",
                "theme": None,
                "template_name": "",
            }

        # Parse and validate theme + patterns JSON
        theme = self._parse_theme(result.theme_json, result.patterns_json)
        if theme is None:
            return {
                "extractable": False,
                "reason": "Failed to parse extracted theme JSON",
                "theme": None,
                "template_name": "",
            }

        return {
            "extractable": True,
            "reason": result.reason or "Theme extracted successfully",
            "theme": theme,
            "template_name": (result.template_name or "").strip() or "Custom Theme",
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

        if theme.get("style") not in VALID_STYLES:
            return None

        if theme.get("animationPreset") not in VALID_ANIMATIONS:
            return None

        if theme.get("category") not in VALID_CATEGORIES:
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
