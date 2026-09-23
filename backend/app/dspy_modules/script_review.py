"""Grounded rewrite operations used by the initial script review editor."""
import json
import re

import dspy

from app.dspy_modules import ensure_dspy_configured, get_scene_lm


class DeriveNarration(dspy.Signature):
    """
    Write the spoken narration for one scene from its FINAL title and FINAL
    on-screen body. The viewer can already see that copy, so complement it instead
    of reading it aloud or closely paraphrasing it. Express the same central idea
    and tone, then add useful context, explanation, or a natural transition that
    makes the scene feel complete when title, body, and voiceover are experienced
    together.

    Treat the source and current narration as factual grounding. Retain useful,
    source-supported detail from the current narration when it still fits the
    final title and body. Never invent benefits, statistics, names, examples, or
    product claims. Use neighbouring scenes for continuity and avoid repeating
    information they already cover. Match the requested style and language.

    NARRATION LENGTH — precedence, in order:
    1. If scene_instruction requests a specific length (e.g. "shorter", "make it
       brief", "expand", "cut this down", "more detail", "under 10 words"),
       follow it exactly. This always wins over everything below.
    2. Otherwise, follow any specific narration word limit or range in
       style_guidance.
    3. If either instruction asks for brief/short narration without a number,
       use 10-18 words. If it asks for longer/more detailed narration without a
       number, use 15-30 words.
    4. If neither provides any length direction, use 12-25 words.
    Do NOT treat current_narration's length as a target on its own — only the
    three rules above determine length.

    Write natural speech, not ad-copy fragments: vary sentence openings, connect
    ideas smoothly, and avoid redundant slogans, stacked claims, awkward em-dash
    constructions, meta commentary, headings, labels, quotation marks, or
    markdown. Return only the words that should be spoken.
    """
    source_context: str = dspy.InputField(desc="Relevant factual source material; this is the boundary for factual claims")
    full_script_context: str = dspy.InputField(desc="Ordered scenes used to avoid repetition and create a natural transition")
    scene_number: int = dspy.InputField(desc="One-based position of the scene being written")
    title: str = dspy.InputField(desc="Final visible scene heading; guide the narration but do not read it verbatim")
    display_text: str = dspy.InputField(desc="Final visible body copy; narration must complement rather than duplicate it")
    current_narration: str = dspy.InputField(desc="Existing factual draft; a source of factual grounding only, not a length target")
    scene_instruction: str = dspy.InputField(desc="One-time user request for this scene's tone, delivery, or length; always takes precedence over saved style_guidance when provided")
    video_style: str = dspy.InputField(desc="Stable style identifier for routing and diagnostics; do not infer writing rules from its name")
    style_guidance: str = dspy.InputField(desc="Authoritative saved voice, tone, pacing, narrative, and narration-length guidance for this project")
    content_language: str = dspy.InputField(desc="Language in which all spoken narration must be written")
    narration: str = dspy.OutputField(desc="Natural voiceover only, with no label or formatting")


class RewriteTitleAndDisplay(dspy.Signature):
    """
    Apply the user's instruction to the selected scene. Rewrite the title and
    on-screen body first. Stay faithful to the source and consistent with the
    neighbouring draft. Do not rewrite other scenes and do not output narration.
    Return plain text fields with no markdown.
    """
    source_context: str = dspy.InputField()
    full_script_context: str = dspy.InputField()
    scene_number: int = dspy.InputField()
    title: str = dspy.InputField()
    display_text: str = dspy.InputField()
    current_narration: str = dspy.InputField()
    instruction: str = dspy.InputField()
    style_guidance: str = dspy.InputField()
    content_language: str = dspy.InputField()
    title_out: str = dspy.OutputField()
    display_text_out: str = dspy.OutputField()


def _terms(value: str) -> set[str]:
    return {w for w in re.findall(r"[\w'-]{4,}", value.lower()) if len(w) > 3}


def select_source_context(source: str, query: str, limit: int = 14000) -> str:
    """Keep opening context and the source paragraphs most relevant to a scene."""
    source = (source or "").strip()
    if len(source) <= limit:
        return source
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", source) if p.strip()]
    wanted = _terms(query)
    ranked = sorted(
        enumerate(paragraphs),
        key=lambda pair: (len(_terms(pair[1]) & wanted), -pair[0]),
        reverse=True,
    )
    selected: dict[int, str] = {i: p for i, p in enumerate(paragraphs[:3])}
    used = sum(len(p) for p in selected.values())
    for i, paragraph in ranked:
        if i in selected:
            continue
        if used + len(paragraph) > limit:
            continue
        selected[i] = paragraph
        used += len(paragraph)
    return "\n\n".join(selected[i] for i in sorted(selected))[:limit]


def _draft_json(draft_scenes: list[dict]) -> str:
    compact = [
        {
            "scene": index + 1,
            "title": (scene.get("title") or "")[:255],
            "display_text": (scene.get("display_text") or "")[:1500],
            "narration": (scene.get("narration") or "")[:2500],
        }
        for index, scene in enumerate(draft_scenes)
    ]
    return json.dumps(compact, ensure_ascii=False)[:20000]


async def derive_narration(
    *, source: str, draft_scenes: list[dict], scene_index: int, title: str,
    display_text: str, current_narration: str, style_guidance: str,
    content_language: str, scene_instruction: str = "", video_style: str = "explainer",
) -> str:
    ensure_dspy_configured()
    predictor = dspy.asyncify(dspy.ChainOfThought(DeriveNarration))
    query = f"{title}\n{display_text}\n{current_narration}"
    with dspy.context(lm=get_scene_lm()):
        result = await predictor(
            source_context=select_source_context(source, query),
            full_script_context=_draft_json(draft_scenes),
            scene_number=scene_index + 1,
            title=title.strip(),
            display_text=display_text.strip(),
            current_narration=current_narration.strip(),
            scene_instruction=scene_instruction.strip(),
            video_style=video_style,
            style_guidance=style_guidance,
            content_language=content_language,
        )
    narration = (getattr(result, "narration", "") or "").strip()
    if not narration:
        raise ValueError("The narration model returned an empty response")
    return narration[:6000]


async def rewrite_scene(
    *, source: str, draft_scenes: list[dict], scene_index: int, title: str,
    display_text: str, current_narration: str, instruction: str,
    style_guidance: str, content_language: str, video_style: str = "explainer",
) -> tuple[str, str, str]:
    ensure_dspy_configured()
    predictor = dspy.asyncify(dspy.ChainOfThought(RewriteTitleAndDisplay))
    query = f"{title}\n{display_text}\n{current_narration}\n{instruction}"
    with dspy.context(lm=get_scene_lm()):
        result = await predictor(
            source_context=select_source_context(source, query),
            full_script_context=_draft_json(draft_scenes),
            scene_number=scene_index + 1,
            title=title.strip(),
            display_text=display_text.strip(),
            current_narration=current_narration.strip(),
            instruction=instruction.strip(),
            style_guidance=style_guidance,
            content_language=content_language,
        )
    new_title = (getattr(result, "title_out", "") or "").strip()[:255]
    new_display = (getattr(result, "display_text_out", "") or "").strip()[:3000]
    if not new_title or not new_display:
        raise ValueError("The rewrite model returned incomplete scene text")
    revised = [dict(scene) for scene in draft_scenes]
    revised[scene_index] = {**revised[scene_index], "title": new_title, "display_text": new_display}
    narration = await derive_narration(
        source=source, draft_scenes=revised, scene_index=scene_index,
        title=new_title, display_text=new_display,
        current_narration=current_narration, style_guidance=style_guidance,
        content_language=content_language, scene_instruction=instruction,
        video_style=video_style,
    )
    return new_title, new_display, narration
