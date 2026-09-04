"""`design_version` must accompany the scene code wherever the code travels.

WHY THIS EXISTS

The player decides who renders the ENDING from `design_version`: a v1 outro is
replaced by the built-in CTA overlay (it was drawn expecting that and paints no
CTA of its own), while a v2 outro composes the CTA inside its own layout and
must render untouched. The fallback is 1, because that is safe for old
templates.

That safe fallback is exactly what made this bug invisible. THREE surfaces can
hand scene code to the player:

    GET /custom-templates/{id}/code            — had design_version
    GET /projects/{pid}/custom-templates/{id}/code — had design_version
    GET /custom-templates  (the LIST)          — did NOT

ProjectView prefers the list, because it already holds the code and skips a
round-trip. So the player silently fell back to v1 and overlaid the built-in CTA
on every v2 outro, discarding the ending the template had designed — while both
endpoints that DID carry the field were never consulted.

A missing field cannot be caught by the type checker (it is optional by design),
so it is pinned here instead.
"""
from __future__ import annotations

import json

from app.routers.custom_templates import _design_version, _serialize_template


class _Tpl:
    """A stand-in carrying every CustomTemplate column.

    Built from the real model's columns rather than a hand-listed set, so a new
    column cannot make this test SKIP — a skip here would hide exactly the
    regression it exists to catch.
    """

    def __init__(self, blueprint: dict | None) -> None:
        from app.models.custom_template import CustomTemplate

        for col in CustomTemplate.__table__.columns:
            setattr(self, col.name, None)
        self.id = 1
        self.name = "T"
        self.user_id = 1
        self.category = None
        self.genres = None
        self.theme = json.dumps({"colors": {}})
        self.design_blueprint = json.dumps(blueprint) if blueprint is not None else None
        self.intro_code = "const SceneComponent = () => null;"
        self.outro_code = "const SceneComponent = () => null;"
        self.content_codes = json.dumps(["const SceneComponent = () => null;"])
        self.content_archetype_ids = None
        self.current_version_id = None
        self.preview_image_url = None
        self.og_image = None
        self.generation_failed = False
        self.created_at = None
        self.updated_at = None
        self.is_public = False
        self.brand_kit = None
        self.layout_prop_schemas = None
        self.image_box_aspect_ratios = None
        self.scene_sample_content = None
        self.scene_font_defaults = None
        self.stub_scene_keys = None
        self.generated_prompt = None
        self.has_generated_code = True
        self.source_url = None
        self.logo_urls = None


def _serialize(blueprint: dict | None) -> dict:
    return _serialize_template(_Tpl(blueprint))


def test_the_list_serializer_carries_design_version() -> None:
    """The regression. ProjectView uses this payload as precompiled preview data."""
    assert _serialize(({"version": 2})).get("design_version") == 2


def test_a_v1_template_still_reports_v1() -> None:
    assert _serialize({"version": 1}).get("design_version") == 1


def test_a_template_with_no_blueprint_falls_back_to_v1() -> None:
    """The safe default: a pre-blueprint template keeps the built-in overlay."""
    assert _serialize(None).get("design_version") == 1


def test_design_version_reads_the_blueprint() -> None:
    assert _design_version(_Tpl({"version": 2})) == 2
    assert _design_version(_Tpl({})) == 1


# ─── scene_font_defaults travels the same three roads ──────────────────────


def test_every_code_surface_returns_scene_font_defaults() -> None:
    """The per-scene DEFAULT type sizes must reach whoever compiles the code.

    Same failure shape as `design_version` above, and the same invisibility: the
    field is optional, so a surface that omits it silently falls back — here to
    the literal baked into the generated scene (`?? (isPortrait ? 52 : 76)`),
    while services/remotion.py injects the STORED default into the render. The
    project preview and the exported MP4 then showed different type sizes for
    the same scene, and nothing failed.

    `GET /custom-templates/{id}/code` and its project-scoped twin are what
    VideoPreview compiles from; the LIST is what the template gallery reads.
    """
    import inspect

    from app.routers import custom_templates as ct
    from app.routers import project_shared_assets as psa

    for fn in (
        ct.get_template_code,
        psa.get_project_custom_template_code,
        ct._serialize_template,
    ):
        src = inspect.getsource(fn)
        assert '"scene_font_defaults"' in src, (
            f"{fn.__qualname__} does not return scene_font_defaults — the surface "
            "that compiles from it will fall back to the literal in the code and "
            "disagree with the render"
        )


def test_the_project_layouts_endpoint_carries_the_editor_typography_meta() -> None:
    """The editor's sliders need both, and read them from /projects/{id}/layouts.

    `design_version` decides how the two sliders are LABELLED (v3 binds the top
    one to the scene title, v1/v2 bound it to the display text), and
    `scene_font_defaults` is the value each opens on. Without the second, the
    editor fell through to a hardcoded 72/30 unrelated to the template — and
    since it DELETES a value equal to the default, a user deliberately choosing
    72 had it discarded.
    """
    import inspect

    from app.routers.projects import _custom_template_type_meta

    src = inspect.getsource(_custom_template_type_meta)
    assert '"design_version"' in src
    assert '"scene_font_defaults"' in src


def test_bulk_typography_clamps_custom_templates_to_the_user_bands() -> None:
    """"Apply to all" was the one write path that never clamped.

    Every other slider is bounded by its control; this one takes a raw number
    from a request body and writes it to every scene. An out-of-band value then
    survived until something downstream repaired it on READ, so the stored
    project and the video it rendered disagreed.
    """
    import inspect

    from app.routers.projects import bulk_update_scene_typography

    src = inspect.getsource(bulk_update_scene_typography)
    assert "_USER_BANDS" in src, "bulk typography must clamp to the user bands"
    assert "_clamp(data.title_font_size" in src
    assert "_clamp(\n                    data.description_font_size" in src or \
        "_clamp(data.description_font_size" in src
