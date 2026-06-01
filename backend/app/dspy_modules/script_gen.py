import asyncio
import json
import dspy

from app.dspy_modules import ensure_dspy_configured
from app.services.social_content_signals import (
    detect_social_platforms_in_text,
    format_social_platforms_for_script_prompt,
)

class BlogToScript(dspy.Signature):
    """
    Given blog content, a list of image URLs from the blog, and a hero image path,
    create a structured video script. The script tone and structure MUST match the
    chosen video_style (explainer / promotional / storytelling). The script should be
    engaging, clear, and organized into scenes suitable for a Remotion-based video.

    ═══ STYLE-SPECIFIC RULES (CRITICAL — STRICTLY follow the given video_style) ═══
    - Treat video_style as a HARD CONSTRAINT.
    - Do NOT mix styles in the same output.
    - If video_style is promotional, every scene must feel like an ad/promo beat.
    - If video_style is explainer, every scene must feel like a documentary-style explanation.
    - If video_style is storytelling, every scene must feel like a story beat in sequence.

    EXPLAINER (DOCUMENTARY MODE):
    - Cover the blog content thoroughly with a documentary narrator tone.
    - Use structured, detailed, factual phrasing with context and insight (not classroom instruction style).
    - Scenes should progress logically: context -> key idea -> evidence/example -> takeaway.
    - Narrations: 1-2 polished documentary-style sentences, target medium length (12-25 words).
    - Avoid ad copy, hype language, and fictional storytelling dramatization.

    PROMOTIONAL:
    - Tone must be strictly promotional/advertisement-like from start to end.
    - Prioritize value proposition, benefits, transformation, and urgency over technical depth.
    - Use persuasive sentence structures: hooks, benefit-led statements, social proof-style claims, and CTA language.
    - Every scene should sound like a promo beat, not a neutral explanation.
    - Narrations should be medium length (10-18 words), punchy but complete.
    - Structure: hook -> problem -> solution/value -> key benefits/features -> CTA/closing push.

    STORYTELLING:
    - Narrative arc is mandatory: setup -> inciting moment -> progression -> tension/challenge -> resolution/payoff.
    - Scenes must build on each other step by step (clear continuity from previous scene).
    - Use narrative connectors and progression cues naturally (then, next, after that, finally) in the target language.
    - Narrations should be medium length (15-30 words), sounding like a human narrator telling a story.
    - Avoid lecture tone and ad-slogan tone unless explicitly required by the source story context.

    GENERAL (all styles):
    - Scene count is controlled by `video_length`, not by `video_style`.
    - Ensure title, scene titles, narrations, and visual_description all reflect the chosen style consistently.

    ═══ VIDEO LENGTH RULES (CRITICAL) ═══
    - video_length values: auto | short | medium | detailed | more_detailed
    - short: best-effort 4-5 scenes (cap at 5).
    - medium: best-effort 12–15 scenes (cap at 15).
    - detailed: best-effort 25-34 scenes (cap at 34).
    - more_detailed: best-effort 43-50 scenes (cap at 50).
    - auto: choose a natural scene count based on scraped blog_content length and structure,
      but NEVER exceed 20 scenes.

    FIRST SCENE RULE:
    - The FIRST scene displays the hero/banner image with the blog title overlaid
      and a SHORT narration (1 sentence, ~14-16 words maximum).
    - The title of this scene MUST be the actual blog/video title (e.g. "Building a Reliable Text-to-SQL Pipeline").
      Do NOT use generic titles like "Hero Opening" or "Introduction" for scene 1.
    - The narration should be a brief, compelling hook, e.g. "Let's explore how X works." Keep it concise.
    - Set its duration to 6-7 seconds. This scene WILL have a voiceover.
    - The second scene continues with the main introduction/content.
    - If NO hero image is available (hero_image says "no hero image"), the first scene
      should use a BOLD TEXT BANNER with the title as large centered text on a colored
      background. Set visual_description to: "Title text banner: [THE TITLE] displayed
      as large bold centered text on gradient background, no image needed."
      Leave suggested_images as an empty list [].

    PORTRAIT MODE RULE:
    - If aspect_ratio is "portrait", the video will be rendered in 9:16 (1080x1920) vertical format.
    - For portrait hero scenes: prefer CENTERED title text with shorter lines. Use fewer
      words per line — keep the title concise (max ~6 words per line).
    - For portrait image scenes: images should be described as FULL-WIDTH with text below,
      NOT side-by-side layouts. Avoid "split-screen" or "side-by-side" descriptions.
    - For portrait flow diagrams: use VERTICAL flows (top to bottom), not horizontal.
    - For portrait comparisons: use STACKED layout (top vs bottom), not side-by-side.
    - Keep narrations punchy but still ensure minimum voiceover viability.
    - Narrations: explainer 12-25 words max; promotional 10-18 words max; storytelling about 15-30 words per scene. Display texts shown on screen.

    Duration calculation: Each scene's duration_seconds should be based on narration
    word count: roughly 1 second per 2.5 words, minimum 5 seconds per scene.
    Note: Narrations are display texts (short), voiceover will be generated separately and will be longer.

    ═══ VISUAL DESCRIPTION RULES (CRITICAL) ═══
    The visual_description field drives which visual components get used. Be SPECIFIC:
    - If the blog has CODE → write "Show code block with: [paste actual code]"
    - If listing features/steps → write "Animated bullet list: 1) item, 2) item, ..."
    - If describing a flow/pipeline/architecture → write "Flow diagram: Step1 → Step2 → Step3 → Output"
    - If comparing two things → write "Comparison split-screen: X vs Y"
    - If showing statistics → write "Big metric: 97% with animated counter"
    - If a key quote/definition → write "Quote callout: [the quote]"
    - If an image is relevant → write "Show image with caption: [description]"
    - If describing phases or history → write "Timeline: Phase1, Phase2, Phase3"
    - NEVER write vague descriptions like "display information" or "show content"
    - ALWAYS include the ACTUAL content to be visualized (real items, real code, real numbers)

    ═══ MAXIMIZE VISUAL VARIETY ═══
    Your video should feel polished and cinematic with strong visual variety. To achieve this:
    - EVERY scene should have a SPECIFIC visual layout hint in visual_description
    - Strongly prefer flow diagrams, bullet lists, metrics, comparisons, and timelines
    - Use plain text narration as an ABSOLUTE LAST RESORT — only if nothing else fits
    - Think about what a designer would PUT ON SCREEN: charts, diagrams, lists, numbers
    - If the narration describes any process or workflow, always suggest a flow diagram
    - If there are any numbers, stats, or metrics, always suggest animated metric counters
    - If comparing approaches, technologies, or ideas, always suggest a comparison layout
    - Aim for at least 70% of scenes to use structured visuals (not plain text)

    Output the scenes as a JSON array.

    ═══ CONTENT COVERAGE — USE ALL SOURCE DATA (CRITICAL) ═══
    - You MUST cover the FULL blog_content — do not summarise only the first half or skip sections.
    - Read blog_content to the end before planning scenes. Every major point, statistic, finding,
      and section of the article must appear in at least one scene's narration or visual_description.
    - If video_length forces fewer scenes than topics, merge related points into single scenes —
      but do NOT silently drop entire sections of the article.
    - For bloomberg specifically: every numeric claim, statistic, or data point found anywhere in
      blog_content must be represented. Do not stop extracting data after the first few paragraphs.

    ═══ LANGUAGE RULE (CRITICAL) ═══
    - content_language specifies the language of the scraped blog content.
    - Generate ALL output (title, scene titles, narrations, visual_description) EXCLUSIVELY in that language.
    - Do NOT translate to English if the content is in another language. Match the source language exactly.

    ═══ LAYOUT SUGGESTION (OPTIONAL, TEMPLATE-AWARE) ═══
    - When layout_catalog is provided, use it to suggest a layout ID for each scene.
    - Think about the **entire video** as a sequence — layout choices should feel like a deliberate visual journey, not random picks.

    ═══ DIVERSITY TARGETS BY VIDEO LENGTH ═══
    - short (4-5 scenes): use at least 6 distinct layouts. Max 2 scenes may share the same layout.
    - medium (12–15 scenes): use at least 9 distinct layouts. Max 2 scenes may share the same layout.
    - detailed (25-34 scenes): use at least 18 distinct layouts. Max 6 scenes may share the same layout.
    - more_detailed (43-50 scenes): use at least 25 distinct layouts. Max 8 scenes may share the same layout.
    - For any other length: use at least ceil(total_scenes * 0.7) distinct layouts.
    - These are MINIMUM targets — more variety is always better if the content supports it.

    ═══ DISTRIBUTION RULES ═══
    - NEVER place the same layout in consecutive scenes (scene N and scene N+1 must differ).
    - When a layout must repeat, space it out: at least 3 scenes apart (e.g. scene 2 and scene 5, not scene 2 and scene 3).
    - Spread visually heavy layouts (grids, charts, timelines) across the video — do not cluster them together.
    - Spread visually light layouts (full-center, quote, body-text) across the video similarly.
    - Think of the video in thirds: opening (scenes 0-2), middle (scenes 3-6), closing (scenes 7+). Each third should have its own visual identity.

    ═══ PLANNING STEP (REQUIRED) ═══
    - Before assigning layouts, write out a short plan:
    1. List all available layouts from layout_catalog.
    2. Group them by visual weight: heavy (data-rich) vs light (text/hero).
    3. Sketch a layout sequence for all scenes that satisfies the diversity target and distribution rules.
    4. Only then assign preferred_layout per scene.
    - This planning happens in your reasoning — the final output is still just preferred_layout per scene.

    ═══ TEMPLATE-SPECIFIC RULES ═══
    - For BUILT-IN templates (default, nightfall, gridcraft, spotlight, whiteboard, newspaper, matrix, newscast, mosaic, blackswan, chronicle,bloomberg):
    - Choose layout IDs EXACTLY from layout_catalog — the layout_catalog field is the single source of truth for which layout IDs are allowed for this template. Do NOT guess layout IDs from examples here.
    - When include_ending_socials is true: assign preferred_layout "ending_socials" ONLY to the LAST scene in
      scenes_json. No other scene may use "ending_socials" — not the first scene, not the middle, only the final index.
    - ENDING SCENE (when include_ending_socials is true): the LAST scene MUST be a call-to-action grounded in the
      actual blog_content — title, narration, and visual_description should reflect the article's topic, takeaway,
      or next step (not generic filler). Follow social_platforms_detected strictly: only name social platforms
      listed there when inviting followers; if it says NONE, do not name Facebook, Instagram, YouTube, etc.
    - Follow the "Best for" / "When to Use" hints when deciding per scene.
    - Hero/opening scenes should use the template's hero layout (e.g. hero_image, news_headline).
    - For CUSTOM templates (universal layout engine):
    - layout_catalog describes ARRANGEMENTS (e.g. full-center, split-left, grid-2x2).
    - Suggest one arrangement name per scene.
    - For each scene object in scenes_json, include a "preferred_layout" field (string):
    - BUILT-IN: layout ID from the template's layout catalog.
    - CUSTOM: arrangement name from the layout_catalog list.
    - If unsure, leave preferred_layout as empty string "" for that scene.
    """

    blog_content: str = dspy.InputField(
        desc="The full text content extracted from the blog post. "
        "May contain '═══ CODE BLOCKS FROM THIS BLOG ═══' section with actual code snippets. "
        "Use these code blocks in visual_description when relevant."
    )
    blog_images: str = dspy.InputField(desc="JSON array of image URLs/paths available from the blog")
    hero_image: str = dspy.InputField(desc="Path to the main hero/header image of the blog. Use this in the first (hero opening) scene.")
    aspect_ratio: str = dspy.InputField(desc="Video aspect ratio: 'landscape' (16:9, 1920x1080) or 'portrait' (9:16, 1080x1920). Adjust layouts accordingly.")
    video_style: str = dspy.InputField(
        desc="Video style that defines tone and structure: 'explainer' = educational, clear, step-by-step; "
        "'promotional' = persuasive, benefit-focused, call-to-action, product/solution sell; "
        "'storytelling' = narrative arc, emotional hooks, character/journey, story-driven. "
        "Write title, scene titles, narrations, and visual_description to match this style exactly."
    )
    video_length: str = dspy.InputField(
        desc="Video length category controlling scene count: auto | short | medium | detailed | more_detailed."
    )
    layout_catalog: str = dspy.InputField(
        desc=(
            "Template-specific layout catalog. For BUILT-IN templates (default, nightfall, gridcraft, spotlight, "
            "whiteboard, newspaper, matrix, newscast, mosaic, blackswan, chronicle), this lists the allowed "
            "layout IDs and short descriptions. For CUSTOM templates, this lists arrangement names and descriptions. "
            "This is the SINGLE SOURCE OF TRUTH for which preferred_layout values are valid for this template. "
            "Use it ONLY to pick a suitable preferred_layout per scene; do NOT copy it verbatim into narrations."
        )
    )
    content_language: str = dspy.InputField(
        desc="Language of the scraped content (e.g. 'English', 'Spanish', 'French'). Generate ALL output in this language."
    )

    include_ending_socials: bool = dspy.InputField(
        desc=(
            "Built-in templates only. When true, DSPy MUST append exactly one final ending scene as the LAST "
            "scene with preferred_layout='ending_socials'. All other scenes MUST NOT use preferred_layout="
            "'ending_socials'. When false, output only the normal scenes."
        )
    )

    social_platforms_detected: str = dspy.InputField(
        desc=(
            "Summary of which social platforms are explicitly referenced in blog_content. "
            "Follow this when writing the final ending scene: only invite followers to platforms "
            "that are listed; if NONE, do not name social networks."
        )
    )

    template_style_hint: str = dspy.InputField(
        desc=(
            "Optional template-specific narration style instructions that OVERRIDE the general rules above. "
            "When non-empty, apply these instructions to EVERY scene's narration, not just data scenes. "
            "Empty string means no special override — follow the standard rules."
        )
    )

    chartable_tables_json: str = dspy.InputField(
        desc=(
            "JSON array of table-to-scene bindings extracted from the blog. Each entry has keys: "
            '"index" (int, original table index), "chartType" (\'line\'|\'bar\'|\'histogram\'|\'auto\'), '
            '"headers" (list of str), "rows" (list of list of str, up to 20 sample rows), "source" (str), '
            'and OPTIONAL "preferred_layout" (str) specifying the layout to use for that scene '
            '(e.g. "terminal_chart", "terminal_table", "data_visualization"). '
            "Empty string when no tables are available. "
            "When non-empty: you MUST emit exactly one scene per entry. "
            "Use the entry's \"preferred_layout\" value as the scene's preferred_layout; "
            "if the entry has no preferred_layout, default to \"data_visualization\". "
            "Each such scene MUST include a \"data_table_index\" field (int) set to that entry's \"index\" value. "
            "That scene's narration MUST be grounded entirely in the specific table — analyse the data, not just "
            "recite it. Identify the key pattern (growth, decline, comparison, outlier), explain what it means "
            "in the context of the article, and give the viewer the insight they couldn't get just by looking at "
            "the raw numbers. At minimum cite one concrete figure to anchor the analysis. "
            "For terminal_chart scenes specifically: narration must NEVER just read out numbers or describe what is "
            "visually on screen. Instead, analyse the data and explain what it MEANS. "
            "If a 'chart_analysis' object is present, use its pre-computed insights (verdict, trend, momentum, "
            "biggest_move, range_position, volatility) as your foundation. "
            "If 'chart_analysis' is absent, derive the analysis yourself from the rows: identify the direction "
            "(is the close column rising or falling overall?), the magnitude of change, any notable spikes or drops, "
            "and what the pattern implies. In either case, always: "
            "(1) state the overall verdict in plain English (e.g. 'prices climbed steadily', 'a sharp reversal hit'), "
            "(2) explain the 'so what' — why this pattern matters in the context of the blog's topic, "
            "(3) connect the chart movement to a real-world cause or consequence mentioned in the article, "
            "(4) write for a smart non-finance reader — avoid all jargon, no RSI/Bollinger/MA references unless "
            "the article itself discusses them, and if you must use a finance term, explain it in the same breath. "
            "E.g. instead of 'RSI climbed past 60', write 'buyers stepped in aggressively after the dip, pushing "
            "the stock back toward its highs — reflecting the recovery story this article describes'. "
            "Match framing to chartType: line=trend over time, bar=comparison between categories, histogram=distribution. "
            "CHART DATA INTEGRITY — CRITICAL, NO EXCEPTIONS: "
            "NEVER invent, fabricate, extrapolate, or assume any data values. Every number, date, label, and data point "
            "in your narration MUST come verbatim from the rows/headers provided in this chartable_tables_json entry. "
            "If a value is not in the supplied rows, do not mention it. "
            "LAYOUT PRIORITY FOR BLOOMBERG — apply in this order: "
            "(1) If the table has OHLCV columns (open, high, low, close + date) → preferred_layout MUST be 'terminal_chart'. "
            "(2) If the table has a time/date column with numeric values but is NOT OHLCV → preferred_layout MUST be 'terminal_dataviz' (line chart). "
            "(3) If the table is purely categorical with no numeric progression → preferred_layout MUST be 'terminal_table'. "
            "NEVER assign 'terminal_chart' to any non-OHLCV table, even if it has a time column. "
            "NEVER assign 'terminal_table' to a table that has a time-series or numeric progression. "
            "These scenes must be placed after the hero/opening scene and before the ending_socials scene. "
            "Scenes using these layouts MUST NOT appear in any other scene, and other scenes "
            "MUST NOT reference these tables in their narration. "
            "LAYOUT PRIORITY FOR MARKET-ANNOTATION TEMPLATES (LaDuc, FJ Market Brief) — apply in this order: "
            "(1) If the entry's preferred_layout is 'market_annotation' → emit a scene with "
            "preferred_layout='market_annotation'. DO NOT downgrade it to data_impact, deep_dive, "
            "two_column, or any other layout. The chartable_tables_json bindings are AUTHORITATIVE "
            "for LaDuc — the upstream pipeline has already confirmed the table is chartable. "
            "(2) If the entry's preferred_layout is 'ticker' → emit a scene with preferred_layout='ticker'. "
            "(3) Every chartable entry needs its OWN dedicated scene. Two chartable tables = two "
            "market_annotation scenes, never one scene that references both, never one chart scene + "
            "one data_impact scene for the second table. "
            "HARD CARDINALITY RULE: count the entries in chartable_tables_json. The number of scenes "
            "whose preferred_layout matches the entry's preferred_layout MUST equal that count. If "
            "chartable_tables_json has 2 entries with preferred_layout='market_annotation', the output "
            "MUST contain exactly 2 scenes with preferred_layout='market_annotation', each with its own "
            "data_table_index (one per entry). "
            "EXAMPLE — given chartable_tables_json = [{index:0, preferred_layout:'market_annotation', "
            "headers:['GOLD PURITY','PER TOLA','PER 10 GRAM']}, {index:1, preferred_layout:'market_annotation', "
            "headers:['Date','Gold 24K Tola','10 Gram Gold 22K']}], the script MUST contain two scenes: "
            "one with preferred_layout='market_annotation' and data_table_index=0 (comparing gold purity "
            "tiers), and another with preferred_layout='market_annotation' and data_table_index=1 (showing "
            "the gold-price time-series). Never collapse them. Never reassign either to data_impact or any "
            "non-chart layout."
        )
    )

    title: str = dspy.OutputField(desc="A compelling title for the video (tone must match video_style)")
    narrative_summary: str = dspy.OutputField(
        desc=(
            "3-5 sentence summary of the ENTIRE video's narrative arc — what story or argument "
            "is being told, how it progresses, and what conclusion it reaches. Written in content_language. "
            "This will be passed to each scene expander so every scene stays coherent with the overall flow."
        )
    )
    scenes_json: str = dspy.OutputField(
        desc=(
            'COMPACT outline only — a JSON array where each object has these keys: '
            '"title" (str), "key_point" (str — 1 sentence describing the core idea of this scene), '
            '"preferred_layout" (str — layout ID from layout_catalog, or "" if unsure), '
            'and "data_table_index" (int) — REQUIRED on any scene that corresponds to an entry in '
            'chartable_tables_json; the value MUST equal that entry\'s "index". Omit this key on '
            'scenes that are not bound to a chartable table. '
            'Do NOT include narration, visual_description, suggested_images, or duration_seconds — '
            'those are generated in a separate expansion step. '
            'FIRST scene title MUST be the actual blog/video title (never "Hero Opening"). '
            'Scene count follows video_length: short=4-5, medium=12-15, detailed=25-30, more_detailed=38-50, auto=natural. '
            'When include_ending_socials is true: the LAST scene MUST have preferred_layout="ending_socials" '
            'and its key_point should summarize the CTA grounded in the article topic. '
            'Layout diversity rules still apply to preferred_layout assignments. '
            'Example: [{"title": "How AI Changes Development", "key_point": "AI tools are reshaping how developers write and review code.", "preferred_layout": "hero_image"}, '
            '{"title": "Gold purity ladder", "key_point": "Per-tola price drops as purity falls from 24K to 18K.", "preferred_layout": "market_annotation", "data_table_index": 0}, '
            '{"title": "Gold price drift this week", "key_point": "Daily quotes hold steady around the all-time high.", "preferred_layout": "market_annotation", "data_table_index": 1}]'
        )
    )


class SceneExpander(dspy.Signature):
    """
    Expand a single scene outline into full scene content.
    You are given the blog content, the complete scene outline for context/continuity,
    and the specific scene to expand. Produce narration, visual description, layout, and images.
    """

    # ── context ──────────────────────────────────────────────────────────────
    blog_content: str = dspy.InputField(
        desc="Full blog text — use it to ground narration and visuals in real content."
    )
    full_outline: str = dspy.InputField(
        desc="JSON array of all scene outlines (title + key_point) for continuity context."
    )
    narrative_summary: str = dspy.InputField(
        desc=(
            "3-5 sentence summary of the full video's narrative arc. "
            "Use this to ensure your scene's narration stays coherent and on-thread with the rest of the video. "
            "Your scene must fit naturally within this overall story/argument."
        )
    )
    scene_index: int = dspy.InputField(
        desc="0-based index of this scene in the full outline."
    )
    total_scenes: int = dspy.InputField(desc="Total number of scenes in the video.")
    hero_image: str = dspy.InputField(desc="Path to hero/header image (used for scene 0 only).")
    # ── style / format ────────────────────────────────────────────────────────
    video_style: str = dspy.InputField(
        desc="explainer | promotional | storytelling. Tone and structure must match exactly."
    )
    aspect_ratio: str = dspy.InputField(desc="landscape (16:9) or portrait (9:16).")
    content_language: str = dspy.InputField(desc="Output language for all text fields.")
    # ── scene spec ────────────────────────────────────────────────────────────
    scene_title: str = dspy.InputField(desc="Title for this scene (from outline).")
    scene_key_point: str = dspy.InputField(desc="Key point / brief description from outline.")
    assigned_layout: str = dspy.InputField(
        desc=(
            "Layout already planned by the outline stage for layout diversity. "
            "Use this exact value as preferred_layout in your output — do NOT change it."
        )
    )
    is_hero: bool = dspy.InputField(desc="True only for scene 0 (hero/banner scene).")
    is_ending: bool = dspy.InputField(
        desc="True only for the last scene when a CTA ending is requested."
    )
    social_platforms_detected: str = dspy.InputField(
        desc="Social platforms referenced in the blog. Used in ending CTA narration."
    )
    # ── outputs ───────────────────────────────────────────────────────────────
    narration: str = dspy.OutputField(
        desc=(
            "Scene narration. Match video_style word counts: explainer 12-25 words; "
            "promotional 10-18 words; storytelling 15-30 words. "
            "Hero scene: 1 sentence hook, max 15 words. "
            "Ending scene: CTA tied to the article topic."
        )
    )
    visual_description: str = dspy.OutputField(
        desc=(
            "Specific visual description for the scene. For hero: 'Hero banner image with title overlay and fade-in'. "
            "For ending: 'CTA ending screen reflecting the topic'. "
            "For code scenes: 'Show code block with: [code]'. Be specific."
        )
    )
    preferred_layout: str = dspy.OutputField(
        desc="Copy assigned_layout exactly. Do not pick a different layout."
    )
    suggested_images_json: str = dspy.OutputField(
        desc='JSON array of image filenames/URLs relevant to this scene, e.g. ["hero.jpg"]. Use [] if none.'
    )
    duration_seconds: int = dspy.OutputField(
        desc="Scene duration in seconds. Hero: 6. Others: ~1 sec per 2.5 words, min 5."
    )
    cta_button_text: str = dspy.OutputField(
        desc=(
            "Only for ending scene: short pill label 2-6 words in content_language, grounded in the article topic "
            "(e.g. 'Read the full guide', 'Explore the tutorial'). Empty string for all other scenes."
        )
    )


class ScriptGenerator:
    """Service that uses DSPy to generate video scripts from blog content."""

    @staticmethod
    def _coerce_text_str(value: object) -> str:
        """LLM output may use nested objects for text fields; coerce to str for .strip() / DB."""
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)

    @staticmethod
    def _coerce_layout_str(value: object) -> str:
        """preferred_layout / cta should be a single string; models sometimes return a small dict."""
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            for key in ("layout", "id", "name", "preferred_layout", "value", "cta_button_text"):
                inner = value.get(key)
                if isinstance(inner, str) and inner.strip():
                    return inner.strip()
            return ""
        return ""

    def __init__(self):
        ensure_dspy_configured()
        self._generator = dspy.Predict(BlogToScript)
        self.generator = dspy.asyncify(self._generator)
        self._expander = dspy.Predict(SceneExpander)
        self.expander = dspy.asyncify(self._expander)

    @staticmethod
    def _normalize_video_length_alias(video_length: str | None) -> str:
        """
        Accept both DB compact form ("mdetailed") and prompt form ("more_detailed").
        DSPy prompt/contracts use "more_detailed".
        """
        raw = (video_length or "auto").strip().lower() or "auto"
        aliases = {
            "mdetailed": "more_detailed",
            "more-detailed": "more_detailed",
            "more detailed": "more_detailed",
        }
        return aliases.get(raw, raw)

    async def generate(
        self,
        blog_content: str,
        blog_images: list[str],
        hero_image: str = "",
        aspect_ratio: str = "landscape",
        video_style: str = "explainer",
        video_length: str = "auto",
        layout_catalog: str = "",
        content_language: str = "English",
        include_ending_socials: bool = False,
        chartable_tables_json: str = "",
        template_id: str = "",
        template_style_hint: str = "",
    ) -> dict:
        """
        Generate a video script from blog content using a 2-stage parallel pipeline.

        Stage 1: single call → video title + compact scene outline (titles + key points).
        Stage 2: all scenes expanded in parallel → full narration, visuals, layout per scene.

        Returns:
            dict with 'title' and 'scenes' (list of scene dicts)
        """
        social_flags = detect_social_platforms_in_text(blog_content)
        social_hint = format_social_platforms_for_script_prompt(social_flags)
        fallback_ending = self._build_fallback_ending_scene(social_flags)

        style = (video_style or "explainer").strip().lower() or "explainer"
        length = self._normalize_video_length_alias(video_length)
        ar = aspect_ratio or "landscape"
        lang = (content_language or "English").strip()
        hero = hero_image or "(no hero image available)"

        # ── Stage 1: outline (one fast call, small output) ────────────────────
        outline_result = await self.generator(
            blog_content=blog_content,
            blog_images=json.dumps(blog_images),
            hero_image=hero,
            aspect_ratio=ar,
            video_style=style,
            video_length=length,
            layout_catalog=layout_catalog or "",
            content_language=lang,
            include_ending_socials=bool(include_ending_socials),
            social_platforms_detected=social_hint,
            template_style_hint=template_style_hint or "",
            chartable_tables_json=chartable_tables_json,
        )

        title_str = self._coerce_text_str(getattr(outline_result, "title", None)).strip() or "Untitled"
        narrative_summary = self._coerce_text_str(getattr(outline_result, "narrative_summary", None)).strip()

        # Parse compact outline from stage 1 (title + key_point + preferred_layout only)
        outline_scenes = self._parse_outline(
            outline_result.scenes_json,
            video_length=length,
            include_ending_socials=include_ending_socials,
            fallback_ending=fallback_ending,
        )

        if not outline_scenes:
            return {"title": title_str, "scenes": []}

        total = len(outline_scenes)
        full_outline_json = json.dumps(
            [{"title": s["title"], "key_point": s.get("key_point", "")} for s in outline_scenes]
        )

        # ── Stage 2: expand every scene in parallel ───────────────────────────
        async def expand_scene(idx: int, outline: dict) -> dict:
            is_hero = idx == 0
            is_ending = include_ending_socials and idx == total - 1
            try:
                res = await self.expander(
                    blog_content=blog_content[:3000],
                    full_outline=full_outline_json,
                    narrative_summary=narrative_summary,
                    scene_index=idx,
                    total_scenes=total,
                    hero_image=hero,
                    video_style=style,
                    aspect_ratio=ar,
                    content_language=lang,
                    scene_title=outline["title"],
                    scene_key_point=outline.get("key_point", ""),
                    assigned_layout=outline.get("preferred_layout") or "",
                    is_hero=is_hero,
                    is_ending=is_ending,
                    social_platforms_detected=social_hint,
                )
                suggested = []
                try:
                    raw = self._coerce_text_str(getattr(res, "suggested_images_json", "[]"))
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        suggested = parsed
                except Exception:
                    pass

                duration = outline.get("duration_seconds", 10)
                try:
                    duration = int(getattr(res, "duration_seconds", duration))
                except Exception:
                    pass

                scene: dict = {
                    "title": outline["title"],
                    "narration": self._coerce_text_str(getattr(res, "narration", "")).strip(),
                    "visual_description": self._coerce_text_str(getattr(res, "visual_description", "")).strip(),
                    # Enforce script-stage planned layout. Scene expansion must not mutate it.
                    "preferred_layout": outline.get("preferred_layout") or self._coerce_layout_str(getattr(res, "preferred_layout", None)),
                    "suggested_images": suggested or outline.get("suggested_images", []),
                    "duration_seconds": duration,
                }
                # Carry the LLM's chart-table binding forward so the renderer charts the table the narration is actually about.
                if isinstance(outline.get("data_table_index"), int):
                    scene["data_table_index"] = outline["data_table_index"]
                if is_ending:
                    cta = self._coerce_layout_str(getattr(res, "cta_button_text", None))
                    if cta:
                        scene["cta_button_text"] = cta
                    scene["preferred_layout"] = "ending_socials"
                return scene
            except Exception:
                # Fall back to a minimal scene built from the outline
                fallback: dict = {
                    "title": outline["title"],
                    "narration": outline.get("key_point", ""),
                    "visual_description": outline.get("key_point", ""),
                    "suggested_images": [],
                    "duration_seconds": 10,
                    "preferred_layout": outline.get("preferred_layout"),
                }
                if isinstance(outline.get("data_table_index"), int):
                    fallback["data_table_index"] = outline["data_table_index"]
                return fallback

        expanded = await asyncio.gather(*[expand_scene(i, s) for i, s in enumerate(outline_scenes)])

        # Re-apply scene cap and ending enforcement on the expanded result
        scenes = self._parse_scenes(
            json.dumps(list(expanded)),
            video_style=style,
            video_length=length,
            include_ending_socials=include_ending_socials,
            fallback_ending_scene=fallback_ending,
        )

        return {"title": title_str, "scenes": scenes}

    @staticmethod
    def _build_fallback_ending_scene(social_flags: dict[str, bool]) -> dict:
        """Minimal last scene when the model returns no JSON (still respects social detection)."""
        order = [
            ("facebook", "Facebook"),
            ("instagram", "Instagram"),
            ("youtube", "YouTube"),
            ("medium", "Medium"),
            ("substack", "Substack"),
            ("linkedin", "LinkedIn"),
            ("tiktok", "TikTok"),
        ]
        labels = [lab for key, lab in order if social_flags.get(key)]
        if labels:
            narration = (
                "Thanks for watching. If you found this valuable, connect with us on "
                + ", ".join(labels)
                + "."
            )
        else:
            narration = (
                "Thanks for watching. Take these ideas forward and revisit the source when you need the details."
            )
        return {
            "title": "Thanks for watching",
            "narration": narration,
            "visual_description": (
                "Call-to-action ending grounded in the article: thank viewers and reinforce the main takeaway; "
                "optional social follow only when relevant to the source material."
            ),
            "suggested_images": [],
            "duration_seconds": 6,
            "preferred_layout": "ending_socials",
            "cta_button_text": "Learn more",
        }

    def _max_scenes_for_video_length(self, video_length: str) -> int:
        """Maximum number of scenes allowed for the given video length category."""
        vl = self._normalize_video_length_alias(video_length)
        if vl == "short":
            return 5
        if vl == "medium":
            return 15
        if vl == "detailed":
            return 30
        if vl == "more_detailed":
            return 50
        # auto: best-effort natural scene count, but never exceed 20 scenes
        return 20

    def _min_scenes_for_video_length(self, video_length: str) -> int:
        """
        Minimum scene count requirement by selected video length.
        """
        vl = self._normalize_video_length_alias(video_length)
        if vl == "short":
            return 4
        if vl == "medium":
            return 12
        if vl == "detailed":
            return 25
        if vl == "more_detailed":
            return 43
        return 0

    def _ensure_min_scene_count(
        self,
        scenes: list[dict],
        *,
        min_scenes: int,
        include_ending_socials: bool,
        fallback_ending_scene: dict | None = None,
        outline_mode: bool = False,
    ) -> list[dict]:
        """Expand existing scene threads up to min_scenes (no generic filler scenes)."""
        if min_scenes <= 0 or len(scenes) >= min_scenes:
            return scenes

        out = list(scenes)
        ending = None
        if include_ending_socials and out:
            ending = out[-1]
            out = out[:-1]

        if not out:
            return scenes

        # Expand by creating continuation scenes from existing ones in round-robin order.
        seeds = list(out)
        seed_idx = 0
        while len(out) + (1 if ending else 0) < min_scenes:
            idx = len(out) + 1
            base = seeds[seed_idx % len(seeds)]
            seed_idx += 1
            if outline_mode:
                base_title = self._coerce_text_str(base.get("title")).strip() or f"Scene {seed_idx}"
                base_point = self._coerce_text_str(base.get("key_point")).strip()
                out.append(
                    {
                        "title": f"{base_title} — Deep Dive",
                        "key_point": (
                            f"{base_point} Add one deeper example, implication, or edge-case from the same topic."
                            if base_point
                            else "Add one deeper example, implication, or edge-case from this topic."
                        ),
                        "preferred_layout": base.get("preferred_layout"),
                    }
                )
            else:
                base_title = self._coerce_text_str(base.get("title")).strip() or f"Scene {seed_idx}"
                base_narration = self._coerce_text_str(base.get("narration")).strip()
                base_visual = self._coerce_text_str(base.get("visual_description")).strip()
                out.append(
                    {
                        "title": f"{base_title} — Deep Dive",
                        "narration": (
                            f"{base_narration} Add one concrete supporting detail that expands this same point."
                            if base_narration
                            else "Add one concrete supporting detail that expands this same point."
                        ),
                        "visual_description": (
                            f"{base_visual} Extend with one additional concrete example grounded in the article."
                            if base_visual
                            else "Extend this scene with one additional concrete example grounded in the article."
                        ),
                        "suggested_images": base.get("suggested_images", []),
                        "duration_seconds": base.get("duration_seconds", 10),
                        "preferred_layout": base.get("preferred_layout"),
                    }
                )

        if ending:
            out.append(ending)
        elif include_ending_socials:
            out.append(fallback_ending_scene or self._build_fallback_ending_scene({}))
            # If appending ending caused overflow, keep ending and trim body.
            if len(out) > min_scenes:
                out = out[: max(0, min_scenes - 1)] + [out[-1]]
        return out

    @staticmethod
    def _norm_layout_key(raw: str | None) -> str:
        return (raw or "").strip().lower().replace(" ", "_").replace("-", "_")

    def _apply_ending_socials_placement(
        self,
        scenes: list[dict],
        *,
        include_ending_socials: bool,
        max_scenes: int,
        fallback_ending_scene: dict | None = None,
    ) -> list[dict]:
        """
        Enforce: `ending_socials` is assigned only to the final scene when enabled, and never otherwise.

        - Strips accidental `ending_socials` from non-final scenes (or from all scenes when disabled).
        - Reserves the last list slot for the ending when `include_ending_socials` (same as scene-cap logic).
        - If the model returned no scenes but an ending is required, appends a minimal ending scene.
        """
        ENDING = "ending_socials"

        if not scenes:
            if not include_ending_socials:
                return []
            return [fallback_ending_scene or self._build_fallback_ending_scene({})]

        if include_ending_socials:
            # Keep the last scene as the single ending slot; cap body so total length <= max_scenes.
            body = scenes[:-1][: max(0, max_scenes - 1)]
            tail = [scenes[-1]]
            trimmed = body + tail
        else:
            trimmed = scenes[:max_scenes]

        out: list[dict] = []
        last_i = len(trimmed) - 1
        for i, scene in enumerate(trimmed):
            pl_raw = self._coerce_layout_str(scene.get("preferred_layout"))
            pl_norm = self._norm_layout_key(pl_raw)

            if include_ending_socials and i == last_i:
                preferred_layout = ENDING
            elif pl_norm == ENDING:
                preferred_layout = None
            else:
                preferred_layout = pl_raw or None

            out.append({**scene, "preferred_layout": preferred_layout})

        return out

    def _parse_outline(
        self,
        scenes_json: object,
        video_length: str = "auto",
        include_ending_socials: bool = False,
        fallback_ending: dict | None = None,
    ) -> list[dict]:
        """Parse the compact stage-1 outline (title + key_point + preferred_layout per scene)."""
        try:
            if not isinstance(scenes_json, str):
                scenes_json = json.dumps(scenes_json) if isinstance(scenes_json, (dict, list)) else str(scenes_json)
            cleaned = scenes_json.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])
            raw = json.loads(cleaned)
            if not isinstance(raw, list):
                raw = [raw]
        except (json.JSONDecodeError, Exception):
            raw = []

        max_scenes = self._max_scenes_for_video_length(video_length)

        # Apply ending slot logic
        raw = self._apply_ending_socials_placement(
            raw,
            include_ending_socials=include_ending_socials,
            max_scenes=max_scenes,
            fallback_ending_scene=fallback_ending,
        )
        raw = self._ensure_min_scene_count(
            raw,
            min_scenes=self._min_scenes_for_video_length(video_length),
            include_ending_socials=include_ending_socials,
            fallback_ending_scene=fallback_ending,
            outline_mode=True,
        )

        out = []
        for i, scene in enumerate(raw):
            title = self._coerce_text_str(scene.get("title")).strip() or f"Scene {i + 1}"
            key_point = self._coerce_text_str(scene.get("key_point") or scene.get("narration") or scene.get("visual_description")).strip()
            preferred_layout = self._coerce_layout_str(scene.get("preferred_layout")) or None
            row: dict = {"title": title, "key_point": key_point, "preferred_layout": preferred_layout}
            # Preserve the LLM's chartable-table binding so it survives into the expansion stage.
            raw_idx = scene.get("data_table_index")
            if isinstance(raw_idx, int):
                row["data_table_index"] = raw_idx
            out.append(row)
        return out

    def _parse_scenes(
        self,
        scenes_json: str,
        video_style: str = "explainer",
        video_length: str = "auto",
        include_ending_socials: bool = False,
        fallback_ending_scene: dict | None = None,
    ) -> list[dict]:
        """Parse and validate scenes JSON.

        - Scene cap is driven by `video_length` (not by `video_style`).
        - Narration text is normalized for whitespace only.
        """
        try:
            # Model may return a parsed object or non-string; normalize before .strip() / json.loads
            if not isinstance(scenes_json, str):
                if isinstance(scenes_json, (dict, list)):
                    scenes_json = json.dumps(scenes_json)
                else:
                    scenes_json = str(scenes_json)

            # Try to extract JSON from the response (it might have markdown code fences)
            cleaned = scenes_json.strip()
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                cleaned = "\n".join(lines[1:-1])

            scenes = json.loads(cleaned)

            if not isinstance(scenes, list):
                scenes = [scenes]

            max_scenes = self._max_scenes_for_video_length(video_length)

            kept = self._apply_ending_socials_placement(
                scenes,
                include_ending_socials=include_ending_socials,
                max_scenes=max_scenes,
                fallback_ending_scene=fallback_ending_scene,
            )
            kept = self._ensure_min_scene_count(
                kept,
                min_scenes=self._min_scenes_for_video_length(video_length),
                include_ending_socials=include_ending_socials,
                fallback_ending_scene=fallback_ending_scene,
                outline_mode=False,
            )

            validated = []
            for i, scene in enumerate(kept):
                narration = self._coerce_text_str(scene.get("narration")).strip()
                narration = " ".join(narration.split())

                preferred_layout_raw = self._coerce_layout_str(scene.get("preferred_layout"))
                preferred_layout: str | None = preferred_layout_raw or None

                cta_btn = self._coerce_layout_str(scene.get("cta_button_text"))
                title_s = self._coerce_text_str(scene.get("title")).strip() or f"Scene {i + 1}"
                vd_s = self._coerce_text_str(scene.get("visual_description")).strip()
                row = {
                    "title": title_s,
                    "narration": narration,
                    "visual_description": vd_s,
                    "suggested_images": scene.get("suggested_images", []),
                    "duration_seconds": scene.get("duration_seconds", 10),
                    # May be a layout ID (built-in templates) or an arrangement name (custom templates)
                    "preferred_layout": preferred_layout,
                }
                if preferred_layout == "ending_socials" and cta_btn:
                    row["cta_button_text"] = cta_btn
                raw_idx = scene.get("data_table_index")
                _data_layouts = {"data_visualization", "terminal_chart", "terminal_table", "terminal_dataviz", "market_annotation", "ticker"}
                if preferred_layout in _data_layouts and isinstance(raw_idx, int):
                    row["data_table_index"] = raw_idx
                validated.append(row)

            return validated

        except json.JSONDecodeError:
            # Fallback: create a single scene from the raw text
            return [
                {
                    "title": "Main Content",
                    "narration": " ".join((scenes_json[:500] or "").split()),
                    "visual_description": "Display blog content with images",
                    "suggested_images": [],
                    "duration_seconds": 30,
                }
            ]
