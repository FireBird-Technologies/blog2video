import asyncio
import dspy

from app.dspy_modules import ensure_dspy_configured


class GenerateDisplayText(dspy.Signature):
    """
    Generate SHORT on-screen display text for a scene from its narration.

    The display text is what will be rendered as large typography on screen.
    Voiceover audio is generated separately from the full narration_text and
    MUST NOT depend on this display text.

    ═══ INPUTS ═══
    - template_id: which visual template is being used (default, nightfall, spotlight,
      gridcraft, whiteboard, newspaper).
    - video_style: explainer / promotional / storytelling (tone only).
    - scene_title: title of this scene.
    - narration: the underlying narration_text for this scene (source of truth).
    - visual_description: visual hints and layout intent.

    ═══ GLOBAL RULES ═══
    - Do NOT invent new facts.
    - Paraphrase or compress the narration; you may slightly rephrase for punchiness.
    - Keep language simple and scannable on screen.
    - No markdown, no quotes, no bullet markers. Plain text sentences only.

    ═══ TEMPLATE-SPECIFIC LENGTH RULES (CRITICAL) ═══
    1) NEWSPAPER + WHITEBOARD
       - Aim for 3–4 short sentences.
       - Each sentence ≈ 6–10 words (target ~8 words).
       - Sentences should feel like separate lines in a layout.

    2) NIGHTFALL + SPOTLIGHT + GRIDCRAFT
       - Aim for 1–2 punchy sentences.
       - Each sentence MAX 5 words (3–5 words ideal).
       - Think bold, headline-like text.

    3) OTHER / DEFAULT
       - 1 concise sentence, 10–20 words.

    ═══ FORMATTING RULES ═══
    - Sentences separated by a single space. Example:
      "First punchy line here. Second line here."
    - Do NOT prefix with numbers or bullets.
    - Respect template rules above even if narration is long.
    """

    template_id: str = dspy.InputField(
        desc="Template ID in lowercase, e.g. default, nightfall, spotlight, gridcraft, whiteboard, newspaper"
    )
    video_style: str = dspy.InputField(
        desc="Video style for tone only: explainer, promotional, or storytelling"
    )
    scene_title: str = dspy.InputField(desc="Title of this scene")
    narration: str = dspy.InputField(desc="Full narration_text for this scene (source of truth)")
    visual_description: str = dspy.InputField(
        desc="Visual description for this scene (for extra context when phrasing text)"
    )

    display_text: str = dspy.OutputField(
        desc="Final on-screen display text following the template-specific sentence/count rules. Plain text only."
    )


class DisplayTextGenerator:
    """
    Service for generating template-aware display_text strings for scenes.
    """

    def __init__(self, template_id: str, video_style: str = "explainer"):
        ensure_dspy_configured()
        self.template_id = (template_id or "default").strip().lower()
        self.video_style = (video_style or "explainer").strip().lower()
        self._predictor = dspy.ChainOfThought(GenerateDisplayText)
        self.predictor = dspy.asyncify(self._predictor)

    async def generate_for_scenes(self, scenes: list[dict]) -> list[str]:
        """
        Generate display_text for a list of scene dicts.

        Each scene dict must have: title, narration, visual_description.
        Falls back to narration when generation fails or returns empty.
        """
        if not scenes:
            return []

        # Limit per-pipeline concurrency to avoid monopolizing the shared thread pool
        sem = asyncio.Semaphore(4)

        async def _bounded_predict(**kwargs):
            async with sem:
                return await self.predictor(**kwargs)

        tasks = []
        for s in scenes:
            narration = (s.get("narration") or "").strip()
            visual = (s.get("visual_description") or "").strip()
            title = (s.get("title") or "").strip()

            # If there is no narration at all (e.g. silent visual scene),
            # just reuse the title as display text.
            if not narration:
                tasks.append(None)
                continue

            tasks.append(
                _bounded_predict(
                    template_id=self.template_id,
                    video_style=self.video_style,
                    scene_title=title,
                    narration=narration,
                    visual_description=visual,
                )
            )

        # Run all DSPy calls concurrently where needed
        results = await asyncio.gather(
            *[t for t in tasks if t is not None],
            return_exceptions=True,
        )

        display_texts: list[str] = []
        result_idx = 0
        for s, task in zip(scenes, tasks):
            narration = (s.get("narration") or "").strip()

            if task is None:
                # No narration: fall back to title or empty
                fallback = (s.get("title") or narration).strip()
                display_texts.append(fallback)
                continue

            res = results[result_idx]
            result_idx += 1

            text = narration
            if not isinstance(res, Exception):
                try:
                    out = (getattr(res, "display_text", "") or "").strip()
                    if out:
                        text = out
                except Exception:
                    # Fallback to narration
                    text = narration

            display_texts.append(text)

        return display_texts

