"""Custom templates must use ONE layout vocabulary end to end.

A generated custom template's real layouts are `intro`, `content_0..N` and
`outro` — that is what meta declares, what the renderer dispatches on, and what
the scene-editor dropdown lists. But the script LLM was fed the legacy
arrangement catalog (`full-center`, `split-left`, `grid-3`, ...) and
`_sanitize_script_layouts` returned early for custom templates, so nothing ever
reconciled the two. Observed consequences in a real project:

  * scene lists showed arrangement names, including a hallucinated "comparison"
    that is not in ANY vocabulary;
  * the closing scene was handed an image/clip, because `layouts_without_image`
    is keyed by real layout id and the lookup used an arrangement name, so
    "outro" could never match.
"""
from __future__ import annotations

import re

import pytest

from app.routers.pipeline import _descriptor_layout_name, _sanitize_script_layouts
from app.services.custom_prompt_builder import build_custom_meta
from app.services.remotion import _custom_layout_id

CUSTOM_ID = "custom_1"


# ─── meta self-consistency ───────────────────────────────────────────────────


def test_generated_meta_hero_and_fallback_are_valid_layouts() -> None:
    """Hero/fallback must be members of the meta's OWN valid_layouts.

    They were hardcoded to the arrangement constants even in the generated
    branch, so `hero_layout in valid` in _sanitize_script_layouts silently failed
    and scene 0 was never pinned to the intro.
    """
    meta = build_custom_meta({"colors": {}}, "T", content_codes_count=7)
    assert meta["hero_layout"] in meta["valid_layouts"]
    assert meta["fallback_layout"] in meta["valid_layouts"]
    assert meta["hero_layout"] == "intro"


def test_generated_meta_marks_outro_image_free() -> None:
    """The CTA + socials row is composited over the outro; it takes no image."""
    meta = build_custom_meta({"colors": {}}, "T", content_codes_count=7)
    assert "outro" in meta["layouts_without_image"]


def test_legacy_meta_keeps_the_arrangement_vocabulary() -> None:
    """Theme-only templates (no generated code) legitimately still use arrangements."""
    meta = build_custom_meta({"colors": {}}, "Legacy", content_codes_count=0)
    assert meta["hero_layout"] == "full-center"
    assert meta["fallback_layout"] == "top-bottom"
    assert "full-center" in meta["valid_layouts"]


# ─── descriptor -> real layout id ────────────────────────────────────────────


def test_descriptor_layout_prefers_the_real_id_over_the_arrangement() -> None:
    """preferred_layout must not be re-stamped with a legacy arrangement name."""
    desc = {
        "sceneType": "content",
        "contentVariantIndex": 2,
        "layoutConfig": {"arrangement": "split-left"},
    }
    assert _descriptor_layout_name(CUSTOM_ID, desc) == "content_2"


def test_descriptor_layout_resolves_bookends() -> None:
    for scene_type in ("intro", "outro"):
        desc = {"sceneType": scene_type, "layoutConfig": {"arrangement": "full-center"}}
        assert _descriptor_layout_name(CUSTOM_ID, desc) == scene_type


def test_descriptor_layout_honours_a_scene_type_override() -> None:
    desc = {"sceneType": "content", "sceneTypeOverride": "outro", "contentVariantIndex": 1}
    assert _descriptor_layout_name(CUSTOM_ID, desc) == "outro"


def test_descriptor_layout_falls_back_for_legacy_descriptors() -> None:
    """A descriptor written before scene types were stored keeps working."""
    desc = {"layoutConfig": {"arrangement": "split-left"}}
    assert _descriptor_layout_name(CUSTOM_ID, desc) == "split-left"


def test_remotion_and_pipeline_resolvers_agree() -> None:
    """The two copies of this logic must not drift — they key the same policy."""
    for desc in (
        {"sceneType": "intro"},
        {"sceneType": "outro"},
        {"sceneType": "content", "contentVariantIndex": 3},
        {"sceneType": "content", "sceneTypeOverride": "outro"},
    ):
        assert _custom_layout_id(CUSTOM_ID, desc) == _descriptor_layout_name(CUSTOM_ID, desc)


def test_layout_resolvers_ignore_non_custom_templates() -> None:
    assert _custom_layout_id("newspaper", {"sceneType": "intro"}) is None


# ─── script-layout sanitisation now applies to custom templates ──────────────


def _scenes(*layouts: str) -> list[dict]:
    return [{"preferred_layout": lay, "visual_description": ""} for lay in layouts]


def test_sanitise_clamps_out_of_vocabulary_picks(monkeypatch) -> None:
    """A hallucinated layout must not reach the database.

    "comparison" was observed in production: it is in neither the arrangement
    list nor the generated ids, and passed straight through because
    _sanitize_script_layouts returned early for custom templates.
    """
    valid = {"intro", "content_0", "content_1", "content_2", "outro"}
    monkeypatch.setattr("app.routers.pipeline.get_valid_layouts", lambda _t: valid)
    monkeypatch.setattr("app.routers.pipeline.get_hero_layout", lambda _t: "intro")
    monkeypatch.setattr("app.routers.pipeline.get_fallback_layout", lambda _t: "content_0")

    out = _sanitize_script_layouts(
        CUSTOM_ID,
        _scenes("comparison", "split-left", "grid-3", "content_1"),
        include_ending_socials=True,
    )
    for scene in out:
        assert scene["preferred_layout"] in valid, scene["preferred_layout"]


def test_sanitise_pins_the_opening_scene_to_the_hero(monkeypatch) -> None:
    valid = {"intro", "content_0", "content_1", "outro"}
    monkeypatch.setattr("app.routers.pipeline.get_valid_layouts", lambda _t: valid)
    monkeypatch.setattr("app.routers.pipeline.get_hero_layout", lambda _t: "intro")
    monkeypatch.setattr("app.routers.pipeline.get_fallback_layout", lambda _t: "content_0")

    out = _sanitize_script_layouts(
        CUSTOM_ID, _scenes("split-left", "content_1", "content_0"), include_ending_socials=True
    )
    assert out[0]["preferred_layout"] == "intro"


def test_sanitise_reserves_the_last_scene_for_the_outro(monkeypatch) -> None:
    """Custom templates close on `outro`, not on a content layout.

    The ending slot used to be reserved only when an `ending_socials` layout
    existed — which custom templates do not have — so their closing scene fell
    through to the generic diverse-pick and the video ended on an ordinary
    content scene instead of the CTA/socials treatment.
    """
    valid = {"intro", "content_0", "content_1", "content_2", "outro"}
    monkeypatch.setattr("app.routers.pipeline.get_valid_layouts", lambda _t: valid)
    monkeypatch.setattr("app.routers.pipeline.get_hero_layout", lambda _t: "intro")
    monkeypatch.setattr("app.routers.pipeline.get_fallback_layout", lambda _t: "content_0")

    out = _sanitize_script_layouts(
        CUSTOM_ID,
        _scenes("full-center", "split-left", "grid-3", "stacked", "ending_socials"),
        include_ending_socials=True,
    )
    picked = [s["preferred_layout"] for s in out]
    assert picked[0] == "intro"
    assert picked[-1] == "outro"
    # And it must not appear anywhere but the end.
    assert picked.count("outro") == 1


def test_sanitise_full_chain_from_the_observed_failure(monkeypatch) -> None:
    """The exact layout list a real project produced must convert cleanly."""
    meta = build_custom_meta({"colors": {}}, "Britannica", content_codes_count=7)
    valid = set(meta["valid_layouts"])
    monkeypatch.setattr("app.routers.pipeline.get_valid_layouts", lambda _t: valid)
    monkeypatch.setattr("app.routers.pipeline.get_hero_layout", lambda _t: meta["hero_layout"])
    monkeypatch.setattr(
        "app.routers.pipeline.get_fallback_layout", lambda _t: meta["fallback_layout"]
    )

    observed = [
        "full-center", "split-left", "comparison", "grid-3",
        "split-right", "stacked", "split-left", "ending_socials",
    ]
    picked = [
        s["preferred_layout"]
        for s in _sanitize_script_layouts(
            CUSTOM_ID, _scenes(*observed), include_ending_socials=True
        )
    ]
    assert all(p in valid for p in picked)
    assert picked[0] == "intro" and picked[-1] == "outro"
    assert not any(p.startswith(("full-", "split-", "grid-")) for p in picked)


def test_sanitise_is_a_no_op_without_a_valid_set(monkeypatch) -> None:
    """No meta (a template still generating) must not wipe the LLM's picks."""
    monkeypatch.setattr("app.routers.pipeline.get_valid_layouts", lambda _t: set())
    out = _sanitize_script_layouts(
        CUSTOM_ID, _scenes("split-left", "grid-3"), include_ending_socials=True
    )
    assert [s["preferred_layout"] for s in out] == ["split-left", "grid-3"]


# ─── transitions must vary between cuts ──────────────────────────────────────


def _bp_with_transitions(families: list) -> dict:
    geom = (
        "A generous, specific geometry description that comfortably exceeds the "
        "minimum length required for a layout to be considered authored."
    )
    return {
        "identity": {"name": "T"},
        "transition_family": families,
        "layouts": (
            [{"id": "i", "role": "intro", "geometry": geom, "geometry_portrait": geom}]
            + [
                {
                    "id": f"c{i}",
                    "role": "content",
                    "best_for": ["plain"],
                    "geometry": geom + str(i),
                    "geometry_portrait": geom,
                }
                for i in range(5)
            ]
            + [{"id": "o", "role": "outro", "geometry": geom, "geometry_portrait": geom}]
        ),
    }


def test_hallucinated_transitions_are_dropped() -> None:
    """An unrenderable name falls through to `fade` on EVERY cut.

    generatedTransitions.ts has a `default:` arm that returns fade(), so a single
    invalid family name made every transition in the video identical — which is
    exactly what "all scenes use the same transition" looks like. The field was
    filtered only on isinstance(str), never against the legal names.
    """
    from app.dspy_modules.blueprint import validate_blueprint
    from app.services.kit_vocabulary import TRANSITION_FAMILIES

    bp, repairs = validate_blueprint(
        _bp_with_transitions(["smooth_dissolve", "ink_bleed", "cross_blur"]), seed="s"
    )
    assert all(t in TRANSITION_FAMILIES for t in bp["transition_family"])
    assert "ink_bleed" in bp["transition_family"], "a legal pick must survive"
    assert any("unrenderable" in r for r in repairs)


@pytest.mark.parametrize(
    "families",
    [[], ["fade"], ["smooth_dissolve"], ["fade", "bogus"]],
)
def test_short_transition_pools_are_topped_up(families: list) -> None:
    """The renderer rotates with `index % pool.length`.

    A pool of one repeats the same transition on every cut, so a blueprint that
    names too few legal families must be topped up rather than left short.
    """
    from app.dspy_modules.blueprint import validate_blueprint
    from app.services.kit_vocabulary import TRANSITION_FAMILIES

    bp, _ = validate_blueprint(_bp_with_transitions(families), seed="s")
    fam = bp["transition_family"]
    assert len(fam) >= 3, f"pool too short to vary: {fam}"
    assert len(set(fam)) == len(fam), "duplicates waste rotation slots"
    assert all(t in TRANSITION_FAMILIES for t in fam)


def test_preview_renders_every_transition_family() -> None:
    """The template preview must have a CSS case for all 14 families.

    It handled only 5; the other 9 fell through to `default:` — a plain fade. A
    template whose family was ["parallax_push","accent_bar","page_fold",
    "rule_sweep"] previewed as TWO distinct visuals across four cuts, which reads
    as "every scene uses the same transition" even though the stored data is
    correctly varied. The data was never the problem.
    """
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    preview = (
        root / "frontend/src/components/templatePreviews/CustomPreview.tsx"
    ).read_text()
    body = preview.split("const transitionStyleFor")[1].split("return (")[0]
    handled = set(re.findall(r'case "([a-z_]+)"', body))

    ts = re.sub(
        r"//[^\n]*",
        "",
        (root / "remotion-video/src/templates/generated/generatedTransitions.ts").read_text(),
    )
    legal = set(
        re.findall(r'"([a-z_]+)"', ts.split("export type GeneratedTransitionFamily =")[1].split(";")[0])
    )

    assert legal - handled == set(), (
        f"these families silently render as a plain fade in preview: {sorted(legal - handled)}"
    )


def test_transition_vocabulary_matches_the_renderer() -> None:
    """TRANSITION_FAMILIES must mirror the GeneratedTransitionFamily union.

    Parsed from the TSX so the two cannot drift — same approach as
    test_kit_vocabulary's checks against the kit source.
    """
    import re
    from pathlib import Path

    from app.services.kit_vocabulary import TRANSITION_FAMILIES

    src = (
        Path(__file__).resolve().parents[2]
        / "remotion-video/src/templates/generated/generatedTransitions.ts"
    ).read_text()
    # Strip line comments BEFORE splitting on ';' — one of them contains a
    # semicolon ("palette-driven; ported from ...") and would truncate the union.
    src = re.sub(r"//[^\n]*", "", src)
    union = src.split("export type GeneratedTransitionFamily =", 1)[1].split(";", 1)[0]
    names = set(re.findall(r'"([a-z_]+)"', union))
    assert names == set(TRANSITION_FAMILIES), (
        f"drift: only in TS {names - set(TRANSITION_FAMILIES)}, "
        f"only in Python {set(TRANSITION_FAMILIES) - names}"
    )


# ─── the script LLM is told the real layouts ─────────────────────────────────


def test_layout_catalog_lists_the_generated_ids(monkeypatch) -> None:
    """generated_prompt is stored at CREATION time, before any scene code exists.

    It therefore always describes the legacy arrangement vocabulary. The catalog
    appended by get_layout_prompt is what tells the script LLM the truth.
    """
    from app.services import template_service

    meta = {
        "valid_layouts": ["intro", "content_0", "content_1", "outro"],
        "layout_names": {"intro": "Intro Scene", "content_0": "Content Style 1"},
    }
    monkeypatch.setattr(template_service, "_load_meta", lambda _t: meta)
    out = template_service._custom_layout_catalog(CUSTOM_ID)

    assert "AUTHORITATIVE" in out
    for lid in meta["valid_layouts"]:
        assert f"`{lid}`" in out
    # And it must actively disown the stale vocabulary.
    assert "full-center" in out and "NOT valid here" in out


def test_layout_catalog_is_empty_for_a_legacy_template(monkeypatch) -> None:
    """Arrangement-based templates keep their own prompt untouched."""
    from app.services import template_service

    monkeypatch.setattr(
        template_service, "_load_meta", lambda _t: {"valid_layouts": ["full-center", "split-left"]}
    )
    assert template_service._custom_layout_catalog(CUSTOM_ID) == ""


def test_layout_catalog_omits_studio_only_layouts(monkeypatch) -> None:
    from app.services import template_service

    meta = {
        "valid_layouts": ["intro", "content_0", "outro", "studio_thing"],
        "studio_only_layouts": ["studio_thing"],
        "layout_names": {},
    }
    monkeypatch.setattr(template_service, "_load_meta", lambda _t: meta)
    out = template_service._custom_layout_catalog(CUSTOM_ID)
    assert "studio_thing" not in out
    assert "`intro`" in out


# ─── The three text fields must stay distinct ────────────────────────────────


def test_render_payload_keeps_display_text_unmixed() -> None:
    """displayText must be the SCENE'S display_text, not the on-screen fallback.

    `on_screen_text` is `display_text or narration_text`, and it was being sent
    as BOTH `narration` and `displayText`. Generated components read displayText,
    so a scene with no display_text rendered its VOICEOVER SCRIPT on screen as
    the headline — and the scene's own title was never shown at all.

    The two are genuinely different strings even when both exist: a real scene
    had display_text "Launching August 30" against narration "Launching August
    thirtieth" (the spoken form).
    """
    import inspect

    from app.services import remotion

    src = inspect.getsource(remotion.write_remotion_data)
    assert '"displayText": display_text_val or ""' in src, (
        "displayText must carry the unmixed display_text"
    )
    # The legacy on-screen field stays, because built-in templates read it.
    assert '"narration": on_screen_text' in src
    assert '"narrationText": scene.narration_text or ""' in src


def test_scene_prop_contract_documents_all_three_fields() -> None:
    """The generator must be told these are different things.

    It had no way to know: the props contract listed displayText and
    narrationText with no explanation, and sceneTitle did not exist.
    """
    from app.services.code_generator import GenerateSceneCode

    doc = GenerateSceneCode.__doc__ or ""
    assert "props.sceneTitle" in doc
    assert "VOICEOVER SCRIPT" in doc
    # The prompt must forbid rendering narration ANYWHERE, not merely "as the
    # headline". The weaker wording explicitly permitted a "small caption",
    # which the validator gate rejects — so the model followed the prompt,
    # the gate failed it, and scenes burned all three attempts at score 0.00.
    assert "NEVER RENDER IT AT ALL" in doc, (
        "the prompt must forbid rendering narration anywhere, matching the validator gate"
    )


def test_prompt_examples_satisfy_the_validator_gates() -> None:
    """Every headline example the prompt shows must PASS validation.

    This is the bug that made scenes burn all three attempts at score 0.00:
    the type directive's canonical example was `<FitText fontSize={70}>`, and
    the props contract permitted narration "as a deliberate small caption".
    Both were rejected by validator gates, so the model did exactly what it was
    told and failed every time. Prompt and gate must not drift apart.
    """
    from app.services.code_generator import (
        REPAIR_CHECKLIST,
        _bp_type_directive,
        GenerateSceneCode,
    )

    directive = _bp_type_directive(
        {
            "type_system": {
                "scale_ratio": 1.25,
                "base_body_px_landscape": 36,
                "base_body_px_portrait": 34,
            }
        }
    )
    doc = GenerateSceneCode.__doc__ or ""

    # No example may show a bare numeric headline fontSize — that is the exact
    # shape the titleFontSize gate rejects.
    for source, name in ((directive, "type directive"), (doc, "props contract")):
        for match in re.finditer(r'<FitText[^>]{0,200}?fontSize=\{([^}]+)\}', source):
            expr = match.group(1)
            assert "titleFontSize" in expr, (
                f"{name} shows `fontSize={{{expr}}}` on a headline, which the "
                f"validator rejects — the model would follow it and fail"
            )

    # The repair checklist must carry both gates, or a repair that fixes one
    # silently breaks the other and the attempts ping-pong.
    assert "titleFontSize" in REPAIR_CHECKLIST
    assert "narrationText" in REPAIR_CHECKLIST
