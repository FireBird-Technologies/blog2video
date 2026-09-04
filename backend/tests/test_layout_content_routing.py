"""The layout is chosen ONCE, and the props are extracted to fit it.

WHY THIS EXISTS — project 1209

Every scene came back `contentType: "bullets"`, INCLUDING the intro (whose only
job is to carry the video's title), and the scenes were then routed to
content_0/3/4 — layouts built for other data. Each received `bullets: [...]` and
`timelineItems: undefined` and drew a fallback branch instead of the composition
it was designed for.

Three mechanisms decided the layout and none of them looked at content and
layout together:

  * the script LLM picked from a catalog listing layout NAMES ONLY, no best_for
  * the classifier ran without knowing the layout, under a prompt that said
    "STRONGLY prefer bullets over plain" with no counterweight
  * the archetype matcher discarded the content match whenever two consecutive
    scenes shared a type — the normal case once everything is bullets

These tests pin the invariant that replaced them: whatever layout a scene ends
up on, its content type is one that layout can actually render.
"""
from __future__ import annotations

import pytest

from app.services.content_classifier import (
    _layout_hosts,
    _layout_hosts_kinds,
    match_scenes_to_archetypes,
    reconcile_layouts_and_content,
)

# A template shaped like a real one: four content layouts, each built for
# something different.
# layout id -> its single declared content_type, the shape
# meta["layout_content_types"] now stores. The reconciler widens each through
# COMPATIBLE_CONTENT_TYPES itself.
_BEST_FOR = {
    "content_0": "bullets",
    "content_1": "metrics",
    "content_2": "timeline",
    "content_3": "quote",
}


# The same map after COMPATIBLE_CONTENT_TYPES widening, for direct host checks.
_RANKED = {
    "content_0": ["bullets", "steps", "plain"],
    "content_1": ["metrics", "comparison"],
    "content_2": ["timeline", "steps", "bullets"],
    "content_3": ["quote", "plain"],
}


def _scenes(*layouts: str) -> list[dict]:
    total = len(layouts)
    out = []
    for i, lid in enumerate(layouts):
        role = "intro" if i == 0 else "outro" if i == total - 1 else "content"
        out.append({"preferred_layout": lid, "role": role})
    return out


# ─── Bookends are never content-routed ───────────────────────────────────────


def test_the_intro_never_carries_structured_props() -> None:
    """The exact 1209 symptom: a four-item bullet list on the title card.

    The design stage forces bookends to "plain" (design_doc) and so does
    sample-copy generation (code_generator); the project pipeline was the only
    path without the rule.
    """
    scenes = _scenes("intro", "content_0", "outro")
    sc = [
        {"contentType": "bullets", "bullets": ["Go", "Eat", "Get", "Pay"],
         "title": "The Everything App"},
        {"contentType": "bullets", "bullets": ["Daily Rides", "Bikes"]},
        {"contentType": "bullets", "bullets": ["Download today"]},
    ]
    reconcile_layouts_and_content(scenes, sc, _BEST_FOR)

    assert sc[0]["contentType"] == "plain"
    assert "bullets" not in sc[0]
    # The title survives — it is what the intro renders.
    assert sc[0]["title"] == "The Everything App"

    assert sc[2]["contentType"] == "plain"
    assert "bullets" not in sc[2]


def test_bookend_layouts_are_left_alone() -> None:
    scenes = _scenes("intro", "content_0", "outro")
    sc = [{"contentType": "plain"} for _ in range(3)]
    out = reconcile_layouts_and_content(scenes, sc, _BEST_FOR)
    assert [o["preferred_layout"] for o in out] == ["intro", "content_0", "outro"]


# ─── A scene's layout must be able to draw its content ───────────────────────


def test_content_that_its_layout_cannot_draw_moves_layout() -> None:
    """Bullets assigned to a timeline layout land on a bullets layout instead.

    The extractor is instructed to fill the assigned layout and to report
    honestly when the narration cannot — never to invent. So a mismatch here
    means the content is real and the layout is the wrong one, and the layout is
    the cheaper of the two to change.
    """
    scenes = _scenes("intro", "content_2", "outro")   # content_2 is for timelines
    sc = [
        {"contentType": "plain"},
        {"contentType": "bullets", "bullets": ["A", "B", "C"]},
        {"contentType": "plain"},
    ]
    out = reconcile_layouts_and_content(scenes, sc, _BEST_FOR)
    assert out[1]["preferred_layout"] == "content_0", out
    # And the content was NOT rewritten to suit the old layout.
    assert sc[1]["bullets"] == ["A", "B", "C"]


def test_a_layout_built_for_the_content_is_kept() -> None:
    scenes = _scenes("intro", "content_1", "outro")
    sc = [
        {"contentType": "plain"},
        {"contentType": "metrics", "metrics": [{"value": "3x", "label": "Growth"}]},
        {"contentType": "plain"},
    ]
    out = reconcile_layouts_and_content(scenes, sc, _BEST_FOR)
    assert out[1]["preferred_layout"] == "content_1"


def test_every_scene_lands_on_a_layout_that_hosts_its_type() -> None:
    """The invariant, over the whole 1209 shape."""
    scenes = _scenes("intro", "content_2", "content_0", "content_1", "outro")
    sc = [
        {"contentType": "bullets", "bullets": ["Go", "Eat"]},
        {"contentType": "bullets", "bullets": ["Rides", "Bikes"]},
        {"contentType": "bullets", "bullets": ["Meals", "Pharmacy"]},
        {"contentType": "bullets", "bullets": ["Send", "Pay"]},
        {"contentType": "bullets", "bullets": ["Download"]},
    ]
    out = reconcile_layouts_and_content(scenes, sc, _BEST_FOR)
    for i, (o, c) in enumerate(zip(out, sc)):
        lid = o["preferred_layout"]
        if not lid.startswith("content_"):
            assert c["contentType"] == "plain", i
            continue
        assert _layout_hosts_kinds(_RANKED[lid], c["contentType"]), (i, lid, c["contentType"])


def test_a_template_with_no_best_for_metadata_is_left_untouched() -> None:
    """Legacy templates declare nothing; a swap would be guesswork."""
    scenes = _scenes("intro", "content_2", "outro")
    sc = [{"contentType": "plain"}, {"contentType": "bullets"}, {"contentType": "plain"}]
    out = reconcile_layouts_and_content(scenes, sc, {})
    assert out[1]["preferred_layout"] == "content_2"


# ─── The matcher's anti-repeat rule ──────────────────────────────────────────


def test_anti_repeat_never_picks_a_layout_that_cannot_host_the_type() -> None:
    """The rule that put bullets on content_0/3/4.

    It used to take `alternatives[scene_idx % len(alternatives)]` — a positional
    round-robin over every OTHER archetype, regardless of what they hold. It
    fires whenever two consecutive scenes share a type, which for a list-heavy
    article is nearly every scene.
    """
    archetypes = [
        {"id": "everything_list", "best_for": ["bullets", "steps"]},
        {"id": "stat_block", "best_for": ["metrics"]},
        {"id": "milestone_track", "best_for": ["timeline"]},
        {"id": "quote_card", "best_for": ["quote"]},
    ]
    structured = [{"contentType": "bullets"} for _ in range(4)]
    assignments = match_scenes_to_archetypes(structured, archetypes)

    for i, a in enumerate(assignments):
        kinds = archetypes[a]["best_for"]
        assert _layout_hosts_kinds(kinds, "bullets"), (
            f"scene {i} routed to {archetypes[a]['id']} ({kinds}), which cannot "
            f"draw bullets"
        )


def test_anti_repeat_still_varies_when_a_compatible_alternative_exists() -> None:
    """Variety is kept where it is free — two layouts both host bullets."""
    archetypes = [
        {"id": "list_a", "best_for": ["bullets"]},
        {"id": "list_b", "best_for": ["steps", "bullets"]},
    ]
    structured = [{"contentType": "bullets"} for _ in range(4)]
    assignments = match_scenes_to_archetypes(structured, archetypes)
    assert len(set(assignments)) > 1, assignments


def test_a_repeat_is_kept_when_nothing_else_can_host_the_type() -> None:
    """A correct repeat beats a wrong layout."""
    archetypes = [
        {"id": "list_only", "best_for": ["bullets"]},
        {"id": "quote_card", "best_for": ["quote"]},
    ]
    structured = [{"contentType": "bullets"} for _ in range(3)]
    assignments = match_scenes_to_archetypes(structured, archetypes)
    assert assignments == [0, 0, 0], assignments


# ─── The catalog the script LLM reads ────────────────────────────────────────


def test_the_layout_catalog_tells_the_llm_what_each_layout_is_for() -> None:
    """Without best_for the model picks between layout NAMES, which is guessing."""
    from app.services.template_service import _custom_layout_catalog

    meta = {
        "valid_layouts": ["intro", "content_0", "content_1", "outro"],
        "layout_names": {"content_0": "Everything List", "content_1": "Milestone Track"},
        "layout_best_for": {
            "content_0": "A scannable list of six to eight short named items.",
            "content_1": "Three to five dated events shown in order.",
        },
    }
    import app.services.template_service as ts

    _orig = ts._load_meta
    ts._load_meta = lambda _tid: meta
    try:
        out = _custom_layout_catalog("custom_1")
    finally:
        ts._load_meta = _orig

    # Prose, in the same shape a built-in template's layout_prompt.md uses.
    assert "- Best for: A scannable list of six to eight short named items." in out, out
    assert "- Best for: Three to five dated events shown in order." in out, out
    assert "MATCH THE CONTENT TO THE LAYOUT" in out


# ─── The CTA the outro actually renders from ─────────────────────────────────


def test_ending_props_carry_the_ctas_array() -> None:
    """The ending contract maps `ctas`; the pipeline never wrote one.

    A contract-compliant outro mapped an empty list and drew no button at all,
    while ctaButtonText sat correctly in the descriptor.
    """
    from app.routers.projects import _build_ending_socials_props

    class _P:
        blog_content = ""
        blog_url = "https://example.com/post"

    class _S:
        visual_description = ""
        remotion_code = None

    props = _build_ending_socials_props(_P(), _S())
    assert isinstance(props.get("ctas"), list) and props["ctas"], props
    assert props["ctas"][0]["ctaButtonText"] == props["ctaButtonText"]
    assert props["ctas"][0]["websiteLink"] == "https://example.com/post"


def test_an_uploaded_document_project_still_shows_its_cta() -> None:
    """`showWebsiteButton` was bool(source_link), false for every upload://."""
    from app.routers.projects import _build_ending_socials_props

    class _P:
        blog_content = ""
        blog_url = "upload://doc.pdf"

    class _S:
        visual_description = ""
        remotion_code = None

    props = _build_ending_socials_props(_P(), _S())
    assert props["websiteLink"] == ""
    assert props["showWebsiteButton"] is True, props
    assert props["ctas"][0]["ctaButtonText"]


# ─── The classifier is told which layout it is extracting for ────────────────


def test_the_extractor_prompt_carries_layout_and_role() -> None:
    """The caller always passed preferred_layout; the payload builder dropped it.

    So the classifier could not know which layout a scene would render in — nor
    that scene 0 was a title card — and chose a content type unrelated to both.
    Asserted on the signature rather than by calling the LLM.
    """
    from app.services.content_classifier import BatchContentExtractor

    desc = BatchContentExtractor.model_fields["scenes_json"].json_schema_extra["desc"]
    assert "layout_best_for" in desc, desc
    assert "role" in desc, desc

    doc = BatchContentExtractor.__doc__ or ""
    assert "THE SCENE'S LAYOUT IS ALREADY CHOSEN" in doc
    # The bias that made everything bullets must be gone.
    assert "STRONGLY prefer" not in doc, doc
    # And inventing content to fill a layout must stay forbidden.
    assert "NEVER invent data" in doc


def test_the_payload_builder_keeps_the_layout() -> None:
    """Pins the drop itself, not just the prompt text."""
    import inspect

    from app.services import content_classifier as cc

    src = inspect.getsource(cc.extract_structured_content_batch)
    assert '"layout"' in src and '"role"' in src, src
    assert "preferred_layout" in src, src


# ─── best_for is prose, like a built-in's layout_prompt.md ───────────────────


def test_archetype_best_for_is_the_designers_sentence() -> None:
    """A taxonomy list could not break a tie between layouts.

    Eight layouts in one template routinely share a content type — three can
    hold a list — so `["bullets", "steps"]` said only "any of these three" and
    the choice fell to position. A sentence distinguishes "a dense scannable
    list" from "three items given equal weight", which is what decides where a
    scene belongs.
    """
    from app.services.code_generator import _archetype_entry

    entry = _archetype_entry(
        {
            "id": "everything_list",
            "content_type": "bullets",
            "doc": "A dense ledger of items. Further design prose.",
            "best_for": "A scannable list of six to eight short named items.",
        },
        0,
    )
    assert entry["best_for"] == "A scannable list of six to eight short named items."
    # The taxonomy key survives alongside it — the render's matcher needs a key
    # it can look up without an LLM.
    assert entry["content_type"] == "bullets"


def test_a_doc_without_a_sentence_still_gets_one() -> None:
    """Older docs, and any the design stage returns without best_for."""
    from app.services.code_generator import _archetype_entry

    entry = _archetype_entry({"id": "stat_block", "content_type": "metrics"}, 1)
    assert entry["best_for"], entry
    assert entry["content_type"] == "metrics"


def test_the_design_stage_is_asked_for_the_sentence() -> None:
    from app.dspy_modules.design_doc import GenerateTemplateDesignDocs

    desc = GenerateTemplateDesignDocs.model_fields["scenes_json"].json_schema_extra["desc"]
    assert '"best_for"' in desc, desc
    assert "ONE SENTENCE" in desc, desc


def test_the_render_matcher_still_routes_on_the_taxonomy() -> None:
    """The prose is for choosing; routing needs a key, with no LLM available."""
    archetypes = [
        {"id": "list", "content_type": "bullets", "best_for": "A scannable list."},
        {"id": "stats", "content_type": "metrics", "best_for": "Headline figures."},
    ]
    got = match_scenes_to_archetypes(
        [{"contentType": "metrics"}, {"contentType": "bullets"}], archetypes
    )
    assert got == [1, 0], got


def test_a_legacy_taxonomy_list_still_routes() -> None:
    """Templates generated before the change stored a ranked list."""
    archetypes = [
        {"id": "list", "best_for": ["bullets", "steps"]},
        {"id": "stats", "best_for": ["metrics"]},
    ]
    got = match_scenes_to_archetypes(
        [{"contentType": "metrics"}, {"contentType": "bullets"}], archetypes
    )
    assert got == [1, 0], got


# ─── Changing a scene's layout must bring its content along ──────────────────


def test_a_layout_switch_refills_content_for_the_new_layout() -> None:
    """The reported defect: the same sentence rendered twice.

    Changing a scene from Statement to Chronology rewrote contentVariantIndex
    and NOTHING else, so the scene kept `contentType: "plain"` with no props on a
    layout built for `timeline`. It mapped an empty timelineItems, fell back to
    displayText, and printed that sentence as both the subtitle and the only
    row.

    Asserted on the wiring rather than by calling the LLM: the switch must ask
    for a refill and must record the new layout.
    """
    import inspect

    from app.routers import projects

    src = inspect.getsource(projects.regenerate_scene)
    assert src.count("refill_structured_content_for_layout(") == 2, (
        "both switch paths — instant and post-AI-regen — must refill"
    )
    assert src.count("scene.preferred_layout = resolve_base_layout(") >= 2, (
        "both paths must record the layout actually switched to"
    )


def test_the_refill_only_fires_for_content_layouts() -> None:
    """intro / outro / data-viz are not content-routed, so nothing to refill."""
    import asyncio

    from app.services.content_classifier import refill_structured_content_for_layout

    for lid in ("intro", "outro", "custom_chart", "custom_table"):
        got = asyncio.run(
            refill_structured_content_for_layout(
                template_id="custom_1", layout_id=lid, title="T", narration="N"
            )
        )
        assert got is None, lid


def test_the_refill_returns_none_without_template_metadata() -> None:
    """A template with no metadata at all keeps whatever it had.

    Returning None means the caller leaves the existing content in place, which
    always renders — better than blanking a scene over missing metadata.
    """
    import asyncio

    from app.services.content_classifier import refill_structured_content_for_layout

    got = asyncio.run(
        refill_structured_content_for_layout(
            template_id="custom_999999", layout_id="content_0", title="T", narration="N"
        )
    )
    assert got is None


def test_the_refill_still_runs_without_a_layout_content_types_entry(monkeypatch) -> None:
    """`layout_content_types[layout_id]` used to gate the refill, but nothing
    downstream ever reads the value it holds — `layout_best_for` is what
    actually steers the extraction call. A template whose archetypes never set
    `content_type` (only `best_for`) has `layout_best_for` but no
    `layout_content_types` entry; before this fix the refill silently bailed
    for such a template FOREVER, leaving every layout switch's structuredContent
    stale (project 1211 scene 5's `contentType: "plain"` after switching to a
    chronology/timeline layout). Refill must proceed as long as `layout_best_for`
    names the layout, even with `layout_content_types` absent entirely.
    """
    import asyncio

    from app.services import content_classifier
    from app.services import template_service

    monkeypatch.setattr(
        template_service,
        "get_meta",
        lambda template_id: {
            "layout_best_for": {"content_2": "Ordered or grouped events over time."},
            # No "layout_content_types" key at all — the old gate's exact failure mode.
        },
    )

    captured: dict = {}

    async def _fake_extract(scenes_data, **kwargs):
        captured["layout_best_for"] = kwargs.get("layout_best_for")
        captured["preferred_layout"] = scenes_data[0].get("preferred_layout")
        return [{"contentType": "timeline", "timelineItems": [{"label": "A", "description": "B"}]}]

    monkeypatch.setattr(content_classifier, "extract_structured_content_batch", _fake_extract)

    got = asyncio.run(
        content_classifier.refill_structured_content_for_layout(
            template_id="custom_1", layout_id="content_2", title="T", narration="N"
        )
    )

    assert got == {"contentType": "timeline", "timelineItems": [{"label": "A", "description": "B"}]}
    assert captured["preferred_layout"] == "content_2"
    assert captured["layout_best_for"] == {"content_2": "Ordered or grouped events over time."}


def test_the_refill_still_bails_with_no_best_for_and_no_content_types(monkeypatch) -> None:
    """A layout with genuinely no routing metadata (neither best_for nor
    content_types) has nothing to extract against, so this must still return
    None rather than guess."""
    import asyncio

    from app.services import content_classifier
    from app.services import template_service

    monkeypatch.setattr(
        template_service,
        "get_meta",
        lambda template_id: {"layout_best_for": {}},
    )

    got = asyncio.run(
        content_classifier.refill_structured_content_for_layout(
            template_id="custom_1", layout_id="content_2", title="T", narration="N"
        )
    )
    assert got is None


def test_the_render_keeps_preferred_layout_in_step() -> None:
    """A variant resolved at render time must update the hint column too.

    remotion.py persists a newly-resolved contentVariantIndex into the
    descriptor. It left preferred_layout on the script stage's guess, so the
    video rendered one layout while the editor's badge named another.
    """
    import inspect

    from app.services import remotion

    src = inspect.getsource(remotion.write_remotion_data)
    assert "scene_obj.preferred_layout = _resolved_lid" in src, src[:0] or (
        "the render resolves a variant but never syncs preferred_layout"
    )
