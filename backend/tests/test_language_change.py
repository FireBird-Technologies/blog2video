"""Tests for the change-language feature.

Three things carry real risk and are covered here:

1. **Prop selection** — translating the wrong leaf of a scene descriptor silently
   breaks the render (a translated URL, a translated enum, a translated chart number).
2. **Billing** — a collaborator may trigger the change, but the OWNER's quota is what
   gets charged, exactly once, and it is refunded when the job fails.
3. **Revert** — a failed run must restore the original copy, language, and descriptors.
"""
from __future__ import annotations

import json

import pytest

from app.models.project import Project, ProjectStatus
from app.models.project_language_change_job import ProjectLanguageChangeJob
from app.models.project_member import MemberRole, MemberStatus, ProjectMember
from app.models.scene import Scene
from app.services.translation import (
    apply_translations,
    collect_translatable_props,
    get_values_at,
    is_translatable_value,
)


# ─────────────────────────── prop selection ───────────────────────────


def test_ending_socials__translates_cta_only():
    """The real descriptor built in pipeline.py mixes prose with links/images.

    ``ctaButtonText`` must translate; ``websiteLink`` / ``socials`` / ``assignedImage``
    must not — even though several are declared ``type: "string"`` by templates.
    """
    props = {
        "hideImage": True,
        "socials": [{"handle": "@acme"}],
        "showWebsiteButton": True,
        "ctaButtonText": "Get started",
        "websiteLink": "https://example.com/post",
        "assignedImage": "scene_3.png",
        "structuredContent": {"contentType": "dataviz"},
    }
    assert collect_translatable_props("ending_socials", props, None) == [("ctaButtonText",)]


def test_unschemad_layout__prose_fallback_catches_title_and_body():
    """nightfall/cinematic_title declares ONLY font-size fields, yet renders title+body.

    A schema-only collector would translate nothing on this layout.
    """
    schema = {"cinematic_title": {"fields": [
        {"key": "titleFontSize", "type": "number", "responsive": True},
    ]}}
    props = {
        "title": "Three ways to cut costs",
        "description": "A short explainer intro.",
        "titleFontSize": {"portrait": 113, "landscape": 140},
    }
    paths = collect_translatable_props("cinematic_title", props, schema)
    assert set(paths) == {("title",), ("description",)}


def test_object_array__translates_label_keeps_value_and_suffix():
    schema = {"glow_metric": {"fields": [
        {"key": "metrics", "type": "object_array",
         "subFields": [{"key": "value"}, {"key": "label"}, {"key": "suffix"}]},
    ]}}
    props = {"metrics": [
        {"value": "$251B", "label": "Total flows", "suffix": "%"},
        {"value": "48", "label": "Vol control", "suffix": ""},
    ]}
    paths = collect_translatable_props("glow_metric", props, schema)
    assert paths == [("metrics", 0, "label"), ("metrics", 1, "label")]
    assert get_values_at(props, paths) == ["Total flows", "Vol control"]


def test_bare_value_subkey__is_prose_and_translates():
    """`keyPoints[].value` / `points[].value` hold whole sentences, not numbers.

    The same `value` subkey means a number in `metrics`/`stats`, so the decision must be
    made by CONTENT (is_translatable_value), never by subkey name.
    """
    props = {"keyPoints": [{"value": "No editors needed"}, {"value": "No voice talent required"}]}
    paths = collect_translatable_props("feature", props, None)
    assert get_values_at(props, paths) == ["No editors needed", "No voice talent required"]


def test_indicators__numeric_companions_skipped_labels_kept():
    props = {"indicators": [{
        "value": "12.4", "label": "Momentum", "delta": "-2.1%",
        "compareValue": "11.0", "compareLabel": "Prior",
    }]}
    paths = collect_translatable_props("x", props, None)
    assert get_values_at(props, paths) == ["Momentum", "Prior"]


def test_pros_cons_and_qa_subkeys_translate():
    props = {
        "pros": [{"lead": "Fast", "body": "Renders in minutes."}],
        "exchanges": [{"q": "What is it?", "a": "A video tool."}],
    }
    paths = collect_translatable_props("x", props, None)
    assert get_values_at(props, paths) == ["Fast", "Renders in minutes.", "What is it?", "A video tool."]


def test_ctas_and_socials__flags_and_links_skipped():
    props = {
        "ctas": [{"ctaButtonText": "Get started", "websiteLink": "https://x.com", "showWebsiteButton": True}],
        "items": [{"platform": "x", "enabled": True, "label": "Follow us"}],
    }
    paths = collect_translatable_props("x", props, None)
    assert get_values_at(props, paths) == ["Get started", "Follow us"]


def test_steps__number_skipped_prose_kept():
    props = {"steps": [{"number": "1", "label": "Paste URL", "sub": "Any blog post"}]}
    paths = collect_translatable_props("x", props, None)
    assert get_values_at(props, paths) == ["Paste URL", "Any blog post"]


def test_ticker_table__headers_and_prose_cells_translate():
    """A ticker/chart table's headers and prose cells are on-screen copy.

    Regression: these were denied wholesale, so a Hindi translation left the table in
    English while the surrounding tickerTitle/tickerFootnote translated.
    """
    props = {
        "tickerTitle": "Simple workflow",
        "tickerTable": {
            "headers": ["Step", "Action"],
            "rows": [
                ["1. Paste URL", "Paste your URL"],
                ["4. Export Video", "Render and export"],
            ],
        },
        "tickerHighlightCol": -1,
        "hideImage": True,
    }
    paths = collect_translatable_props("ticker_table", props, None)
    assert get_values_at(props, paths) == [
        "Simple workflow", "Step", "Action",
        "1. Paste URL", "Paste your URL",
        "4. Export Video", "Render and export",
    ]

    out = apply_translations(props, paths, [v.upper() for v in get_values_at(props, paths)])
    assert out["tickerHighlightCol"] == -1
    assert out["hideImage"] is True
    assert out["tickerTable"]["rows"][0] == ["1. PASTE URL", "PASTE YOUR URL"]


def test_chart_table__only_headers_translate_data_cells_stay():
    """Currency / date / grade cells must survive verbatim; headers are prose."""
    props = {
        "chartTable": {
            "headers": ["GOLD PURITY", "PER TOLA", "PER 10 GRAM"],
            "rows": [["24K", "Rs. 431,600", "Rs. 370,027"], ["22K", "Rs. 395,735", "Rs. 339,192"]],
        }
    }
    paths = collect_translatable_props("x", props, None)
    assert get_values_at(props, paths) == ["GOLD PURITY", "PER TOLA", "PER 10 GRAM"]


def test_chart_table__dates_and_period_codes_stay():
    props = {
        "chartTable": {
            "headers": ["Date", "Quarter", "Revenue"],
            "rows": [["Jul 01, 26", "Q1", "120"], ["2026-07-01", "Q2", "145"]],
        }
    }
    paths = collect_translatable_props("x", props, None)
    assert get_values_at(props, paths) == ["Date", "Quarter", "Revenue"]


@pytest.mark.parametrize("value", [
    "Rs. 431,600", "USD 1,204", "12,000 PKR", "Jul 01, 26", "Jun 30, 2026",
    "2026-07-01", "01/07/26", "Q1", "24K", "18K", "FY26", "H2",
])
def test_data_tokens_are_not_prose(value):
    assert is_translatable_value(value) is False


@pytest.mark.parametrize("value", [
    "Gold 24K Tola", "10 Gram Gold 22K", "PER 10 GRAM", "1. Paste URL", "Growth %",
    "24K Gold", "Alphabet Inc. (Class A)", "Annual Revenue ($US Dollars)",
    # hyphenated prose must not be mistaken for a machine identifier
    "state-of-the-art", "well-known",
])
def test_data_tokens_do_not_over_match_real_headers(value):
    """A data pattern must match the WHOLE cell — these contain digits but are prose."""
    assert is_translatable_value(value) is True


@pytest.mark.parametrize("value", [
    # Real cells found in production tables — filenames and asset ids, not prose.
    "20210225_052918_ss01_u0001_pansharpened_clip.png",
    "ssc14_u0005",
    "chart.png",
    "data.csv",
    # spelled-out magnitudes are units, not prose: an LLM would reformat the number
    "$1.2 billion", "3.6 million", "$1.145 T", "2.5 crore",
])
def test_identifiers_and_magnitudes_are_not_prose(value):
    assert is_translatable_value(value) is False


def test_code_lines_and_language_never_translated():
    schema = {"glass_code": {"fields": [
        {"key": "codeLines", "type": "string_array"},
        {"key": "codeLanguage", "type": "string"},
        {"key": "title", "type": "string"},
    ]}}
    props = {
        "codeLines": ["if (x) return 1;", "const y = 2;"],
        "codeLanguage": "ts",
        "title": "How it works",
    }
    assert collect_translatable_props("glass_code", props, schema) == [("title",)]


def test_select_enum_not_translated():
    """`select` values are render-time enums; translating them breaks the layout."""
    schema = {"x": {"fields": [
        {"key": "align", "type": "select"},
        {"key": "heading", "type": "string"},
    ]}}
    props = {"align": "left", "heading": "Revenue grew"}
    assert collect_translatable_props("x", props, schema) == [("heading",)]


@pytest.mark.parametrize("value", [
    "https://example.com", "www.example.com", "#7C3AED", "$251B", "-2.4%",
    "1,204", "  ", "", "→", "12x",
])
def test_non_prose_values_rejected(value):
    assert is_translatable_value(value) is False


@pytest.mark.parametrize("value", ["Total flows", "Revenue grew 12% last year", "Get started"])
def test_prose_values_accepted(value):
    assert is_translatable_value(value) is True


def test_apply_translations__preserves_everything_else():
    props = {
        "metrics": [{"value": "$251B", "label": "Total flows", "suffix": "%"}],
        "assignedImage": "a.png",
        "titleFontSize": {"portrait": 113, "landscape": 140},
    }
    paths = [("metrics", 0, "label")]
    out = apply_translations(props, paths, ["Flujos totales"])

    assert out["metrics"][0]["label"] == "Flujos totales"
    assert out["metrics"][0]["value"] == "$251B"
    assert out["metrics"][0]["suffix"] == "%"
    assert out["assignedImage"] == "a.png"
    assert out["titleFontSize"] == {"portrait": 113, "landscape": 140}
    # original untouched (apply returns a copy)
    assert props["metrics"][0]["label"] == "Total flows"


def test_apply_translations__length_mismatch_raises():
    with pytest.raises(ValueError):
        apply_translations({"a": "x"}, [("a",)], ["one", "two"])


# ─────────────────────────── billing / access ───────────────────────────


def _make_project(db, owner, *, language="en", scenes=2) -> Project:
    project = Project(
        user_id=owner.id, name="P", status=ProjectStatus.GENERATED,
        template="default", content_language=language,
    )
    db.add(project)
    db.flush()
    for i in range(scenes):
        db.add(Scene(
            project_id=project.id, order=i, title=f"T{i}",
            narration_text=f"Narration {i}", display_text=f"Display {i}",
            visual_description="v",
            remotion_code=json.dumps({"layout": "l", "layoutProps": {"heading": f"H{i}"}}),
        ))
    db.commit()
    db.refresh(project)
    return project


def _add_editor(db, project, user) -> None:
    db.add(ProjectMember(
        project_id=project.id, user_id=user.id, invited_email=user.email,
        role=MemberRole.EDITOR, status=MemberStatus.ACCEPTED,
    ))
    db.commit()


@pytest.fixture(autouse=True)
def _no_background_work(monkeypatch):
    """Exercise the endpoint without running the real LLM/TTS worker.

    The job is dispatched with ``loop.run_in_executor(None, _run_language_change, ...)``,
    so we replace the worker symbol the endpoint resolves at call time. Stubbing the
    executor (or ``BackgroundTasks.add_task``) instead would be coupled to the dispatch
    mechanism; this stays correct whichever is used.

    ``language_change_progress`` is a module-level dict keyed by project id. In
    production the worker calls ``finish()``, which clears the "active" flag that
    ``_assert_no_active_job`` reads. Here the worker never runs, so the record would
    leak into the next test and make it 409. Reset the store around each test.
    """
    from app.routers import projects as projects_router
    from app.services import language_change_progress

    monkeypatch.setattr(projects_router, "_run_language_change", lambda *a, **k: None)
    language_change_progress._progress.clear()
    yield
    language_change_progress._progress.clear()


def test_change_language__collaborator_triggers__owner_is_charged(
    client, db_session, paid_user, other_user, auth
):
    """The whole point of the feature: any editor may run it, the OWNER pays."""
    project = _make_project(db_session, paid_user)
    _add_editor(db_session, project, other_user)

    owner_before = paid_user.videos_used_this_period
    actor_before = other_user.videos_used_this_period

    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(other_user),
        json={"content_language": "es"},
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(paid_user)
    db_session.refresh(other_user)
    assert paid_user.videos_used_this_period == owner_before + 1
    assert other_user.videos_used_this_period == actor_before  # collaborator never charged

    job = db_session.query(ProjectLanguageChangeJob).filter_by(project_id=project.id).one()
    assert job.user_id == paid_user.id  # payer, so the refund targets the owner
    assert job.target_language == "es"
    assert job.total_scenes == 4  # 2 scenes x 2 phases


def test_change_language__accepts_language_name(client, db_session, paid_user, auth):
    project = _make_project(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(paid_user), json={"content_language": "Spanish"},
    )
    assert resp.status_code == 200
    db_session.refresh(project)
    assert project.content_language == "es"


def test_change_language__history_label_uses_language_name_not_code(
    client, db_session, paid_user, auth
):
    """The edit-history modal renders the label verbatim, so it must say "Urdu", not "ur"."""
    from app.models.Project_edit_history import ProjectEditHistory

    project = _make_project(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(paid_user), json={"content_language": "ur"},
    )
    assert resp.status_code == 200

    entry = (
        db_session.query(ProjectEditHistory)
        .filter(ProjectEditHistory.project_id == project.id)
        .order_by(ProjectEditHistory.id.desc())
        .first()
    )
    # log_project_event stores the human label in `field_name` (see edit_tracker.py).
    assert entry is not None
    assert entry.field_name == "Language changed to Urdu"


def test_change_language__same_language__400_and_no_charge(client, db_session, paid_user, auth):
    project = _make_project(db_session, paid_user, language="en")
    before = paid_user.videos_used_this_period

    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(paid_user), json={"content_language": "en"},
    )
    assert resp.status_code == 400
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == before


def test_change_language__owner_out_of_credits__403_and_no_charge(
    client, db_session, free_user, auth
):
    project = _make_project(db_session, free_user)
    free_user.videos_used_this_period = free_user.video_limit
    db_session.commit()

    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(free_user), json={"content_language": "es"},
    )
    assert resp.status_code == 403

    db_session.refresh(project)
    db_session.refresh(free_user)
    assert free_user.videos_used_this_period == free_user.video_limit  # unchanged
    assert project.content_language == "en"  # language not applied
    assert db_session.query(ProjectLanguageChangeJob).count() == 0


def test_change_language__collaborator_blocked_by_owner_limit__mentions_owner(
    client, db_session, free_user, other_user, auth
):
    """A collaborator can't fix a FREE owner's exhausted quota by upgrading themselves."""
    project = _make_project(db_session, free_user)
    _add_editor(db_session, project, other_user)
    free_user.videos_used_this_period = free_user.video_limit
    db_session.commit()

    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(other_user), json={"content_language": "es"},
    )
    assert resp.status_code == 403
    assert "owner" in resp.json()["detail"].lower()


def test_change_language__non_member__404(client, db_session, paid_user, other_user, auth):
    """Non-members get 404, never 403 — project existence is not disclosed."""
    project = _make_project(db_session, paid_user)
    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(other_user), json={"content_language": "es"},
    )
    assert resp.status_code == 404


def test_change_language__no_scenes__400(client, db_session, paid_user, auth):
    project = _make_project(db_session, paid_user, scenes=0)
    resp = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(paid_user), json={"content_language": "es"},
    )
    assert resp.status_code == 400


def test_change_language__second_start_conflicts_409(client, db_session, paid_user, auth):
    project = _make_project(db_session, paid_user)
    first = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(paid_user), json={"content_language": "es"},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/projects/{project.id}/change-language",
        headers=auth(paid_user), json={"content_language": "fr"},
    )
    assert second.status_code == 409


# ─────────────────────────── revert on failure ───────────────────────────


def test_restore_content_snapshot__restores_copy_language_and_descriptors(db_session, paid_user):
    from app.routers.projects import _restore_content_snapshot, _scene_content_snapshot

    project = _make_project(db_session, paid_user, language="en")
    scenes = db_session.query(Scene).filter_by(project_id=project.id).order_by(Scene.order).all()
    snapshot = _scene_content_snapshot(scenes, project.content_language)

    # Simulate a half-finished translation.
    project.content_language = "es"
    scenes[0].title = "Título traducido"
    scenes[0].narration_text = "Narración traducida"
    scenes[0].display_text = "Mostrar"
    scenes[0].remotion_code = json.dumps({"layout": "l", "layoutProps": {"heading": "Encabezado"}})
    db_session.commit()

    _restore_content_snapshot(db_session, project, snapshot)
    db_session.commit()

    db_session.refresh(project)
    restored = db_session.query(Scene).filter_by(project_id=project.id).order_by(Scene.order).first()
    assert project.content_language == "en"
    assert restored.title == "T0"
    assert restored.narration_text == "Narration 0"
    assert restored.display_text == "Display 0"
    assert json.loads(restored.remotion_code)["layoutProps"]["heading"] == "H0"


def test_refund_video_credit__is_atomic_and_floors_at_zero(db_session, paid_user):
    from app.routers.projects import _refund_video_credit

    paid_user.videos_used_this_period = 1
    db_session.commit()

    _refund_video_credit(db_session, paid_user.id)
    db_session.commit()
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == 0

    # A double refund (worker + reaper racing) must not go negative.
    _refund_video_credit(db_session, paid_user.id)
    db_session.commit()
    db_session.refresh(paid_user)
    assert paid_user.videos_used_this_period == 0
