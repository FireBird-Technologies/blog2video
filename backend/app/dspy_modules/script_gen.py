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
    - video_length values: auto | short | medium | detailed
    - short: best-effort 6–8 scenes (cap at 8).
    - medium: best-effort 12–15 scenes (cap at 15).
    - detailed: best-effort 15–20 scenes (cap at 20).
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

    ═══ LANGUAGE RULE (CRITICAL) ═══
    - content_language specifies the language of the scraped blog content.
    - Generate ALL output (title, scene titles, narrations, visual_description) EXCLUSIVELY in that language.
    - Do NOT translate to English if the content is in another language. Match the source language exactly.

    ═══ LAYOUT SUGGESTION (OPTIONAL, TEMPLATE-AWARE) ═══
    - When layout_catalog is provided, use it to suggest a layout ID for each scene.
    - Think about the **entire video** as a sequence — layout choices should feel like a deliberate visual journey, not random picks.

    ═══ DIVERSITY TARGETS BY VIDEO LENGTH ═══
    - short (6–8 scenes): use at least 6 distinct layouts. Max 2 scenes may share the same layout.
    - medium (12–15 scenes): use at least 9 distinct layouts. Max 2 scenes may share the same layout.
    - detailed (15–20 scenes): use at least 10 distinct layouts. Max 4 scenes may share the same layout.
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
    - For BUILT-IN templates (default, nightfall, gridcraft, spotlight, whiteboard, newspaper, matrix):
    - Choose layout IDs EXACTLY from layout_catalog (e.g. hero_image, article_lead, data_snapshot).
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
        desc="Video length category controlling scene count: auto | short | medium | detailed."
    )
    layout_catalog: str = dspy.InputField(
        desc=(
            "Optional: template-specific layout catalog text. Either layout IDs and short descriptions for "
            "BUILT-IN templates (default, nightfall, gridcraft, spotlight, whiteboard, newspaper, matrix), "
            "or arrangement names and descriptions for CUSTOM templates. Use this ONLY to pick a suitable "
            "preferred_layout per scene; do NOT copy it verbatim into narrations."
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

    title: str = dspy.OutputField(desc="A compelling title for the video (tone must match video_style)")
    scenes_json: str = dspy.OutputField(
        desc=(
            'JSON array of scene objects. Each object has keys: "title" (str), '
            '"narration" (str — length by video_style: explainer 12-25 words; promotional 10-18 words; storytelling about 15-30 words; so voiceover remains concise, and must strictly match selected style), '
            '"visual_description" (str), "suggested_images" (list of str), '
            '"duration_seconds" (int), and OPTIONAL "preferred_layout" (str). '
            'FIRST scene title must be the actual blog title (never "Hero Opening"), '
            'with a concise narration hook (12-15 words max, 1 sentence) and duration_seconds=6. '
            'Narrations: storytelling (15-30) words per scene; explainer (12-25) words per scene; promotional (10-18) words max. '
            'If a hero image exists: visual_description="Hero banner image with title overlay and fade-in", suggested_images=["hero.jpg"]. '
            'If NO hero image: visual_description="Title text banner: [TITLE] displayed as large bold centered text on gradient background", suggested_images=[]. '
            'Example with image: [{"title": "How AI is Changing Everything", '
            '"narration": "Let\'s explore how AI transforms software development.", '
            '"visual_description": "Hero banner image with title overlay and fade-in", '
            '"suggested_images": ["hero.jpg"], "duration_seconds": 6, "preferred_layout": "hero_image"}]. '
            'Example without image: [{"title": "How AI is Changing Everything", '
            '"narration": "Let\'s explore how AI transforms software development.", '
            '"visual_description": "Title text banner: How AI is Changing Everything displayed as large bold centered text on gradient background", '
            '"suggested_images": [], "duration_seconds": 6, "preferred_layout": "text_narration"}]'
            ' When include_ending_socials is true: append exactly one final ending scene as the LAST element. '
            'The ending scene MUST set preferred_layout="ending_socials" and MUST NOT appear in any other scene. '
            'That ending scene MUST be a content-grounded call to action: "title" = memorable CTA headline tied to '
            'the blog topic; "narration" = CTA tied to the article (takeaway, next step, or follow-up) per video_style; '
            '"visual_description" = CTA ending screen reflecting the topic. Use social_platforms_detected: only '
            'mention social platforms listed there when inviting followers; if NONE, give a topic-based CTA without '
            'naming Facebook, Instagram, YouTube, or other networks. '
            'For that ending scene ONLY, also include "cta_button_text": a short pill label (2–6 words) for the '
            'button above the website link — in content_language, grounded in the article topic (e.g. "Read the full guide", '
            '"Explore the tutorial"), not generic English unless the content is English. '
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
        self._generator = dspy.ChainOfThought(BlogToScript)
        self.generator = dspy.asyncify(self._generator)

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
    ) -> dict:
        """
        Generate a video script from blog content (async).
        Scene count is controlled by `video_length` (auto/short/medium/detailed).
        video_style (explainer | promotional | storytelling) drives tone and structure.

        Returns:
            dict with 'title' and 'scenes' (list of scene dicts)
        """
        social_flags = detect_social_platforms_in_text(blog_content)
        social_hint = format_social_platforms_for_script_prompt(social_flags)
        fallback_ending = self._build_fallback_ending_scene(social_flags)

        result = await self.generator(
            blog_content=blog_content,
            blog_images=json.dumps(blog_images),
            hero_image=hero_image or "(no hero image available)",
            aspect_ratio=aspect_ratio or "landscape",
            video_style=(video_style or "explainer").strip().lower() or "explainer",
            video_length=(video_length or "auto").strip().lower() or "auto",
            layout_catalog=layout_catalog or "",
            content_language=(content_language or "English").strip(),
            include_ending_socials=bool(include_ending_socials),
            social_platforms_detected=social_hint,
        )

        # Parse the scenes JSON and apply limits
        style = (video_style or "explainer").strip().lower() or "explainer"
        scenes = self._parse_scenes(
            result.scenes_json,
            video_style=style,
            video_length=(video_length or "auto").strip().lower() or "auto",
            include_ending_socials=include_ending_socials,
            fallback_ending_scene=fallback_ending,
        )

        title_raw = getattr(result, "title", None)
        title_str = self._coerce_text_str(title_raw).strip() or "Untitled"

        return {
            "title": title_str,
            "scenes": scenes,
        }

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
        vl = (video_length or "auto").strip().lower()
        if vl == "short":
            return 8
        if vl == "medium":
            return 15
        if vl == "detailed":
            return 20
        # auto: best-effort natural scene count, but never exceed 20 scenes
        return 20

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
