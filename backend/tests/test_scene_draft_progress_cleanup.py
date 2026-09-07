"""Resolving a draft must also retire the job that produced it.

A scene edit is tracked in TWO places: the draft row in the DB, and the job
entry in the in-process `_scene_edit_progress` dict. Apply and Discard used to
clear only the first.

The stale entry still said `status: "complete"` with a `draft_version_id`, and
`get_scene_edit_status` reads the dict BEFORE it falls back to the DB — so it
kept answering "a draft is ready" for a row that had already been deleted. The
editor showed the draft banner and the Apply/Discard buttons permanently, while
every `/draft` fetch behind them 404'd, and pressing Discard again could not
help: discard 404s too once the row is gone. The UI had no way to clear itself.

Observed as a tight 404 loop against
`GET /custom-templates/{id}/scenes/content_6/draft` — the poll re-flagged the
scene on every tick from the stale entry, the flag triggered a fetch, the fetch
404'd and cleared the flag, and the next tick set it again.
"""
import json

import pytest

from app.models.custom_template import CustomTemplate
from app.models.template_version import TemplateVersion
from app.routers.custom_templates import (
    _forget_finished_scene_edits,
    _scene_edit_progress,
)

pytestmark = pytest.mark.depth

SCENE = "content_6"


@pytest.fixture(autouse=True)
def _clean_progress():
    """The dict is module-global, so leakage between tests would be invisible."""
    _scene_edit_progress.clear()
    yield
    _scene_edit_progress.clear()


def _template(db, user) -> CustomTemplate:
    t = CustomTemplate(
        user_id=user.id,
        name="NVIDIA",
        theme=json.dumps({"primary": "#000"}),
        content_codes=json.dumps(["code"] * 8),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def _draft(db, tpl, user, scene=SCENE) -> TemplateVersion:
    v = TemplateVersion(
        template_id=tpl.id,
        kind="scene_edit",
        is_draft=True,
        scene_role=scene,
        content_codes=json.dumps({"code": "const SceneComponent = () => null;"}),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def _finished_entry(tpl_id: int, draft_id: int, scene=SCENE) -> str:
    """A settled job, exactly as the edit thread leaves it on success."""
    edit_id = f"{tpl_id}:{scene}:1788752687816900000"
    _scene_edit_progress[edit_id] = {
        "status": "complete", "step": "done", "running": False,
        "error": None, "draft_version_id": draft_id,
    }
    return edit_id


# ─── the helper itself ───────────────────────────────────────────────────────


def test_settled_entries_for_the_scene_are_dropped(db_session, paid_user):
    tpl = _template(db_session, paid_user)
    _finished_entry(tpl.id, 1)
    _forget_finished_scene_edits(tpl.id, SCENE)
    assert _scene_edit_progress == {}


def test_a_running_job_is_left_alone(db_session, paid_user):
    """A live entry is what the 409 concurrency guard scans for, and the edit
    thread still owns the refund bookkeeping on it. Dropping it would let a
    second edit start alongside the first and could refund twice."""
    tpl = _template(db_session, paid_user)
    live = f"{tpl.id}:{SCENE}:1788752687816900001"
    _scene_edit_progress[live] = {
        "status": "running", "step": "generating", "running": True,
        "error": None, "draft_version_id": None,
    }
    _forget_finished_scene_edits(tpl.id, SCENE)
    assert live in _scene_edit_progress


def test_other_scenes_and_templates_are_untouched(db_session, paid_user):
    """The prefix is `{template_id}:{scene_key}:` — a bare `startswith` on the
    template id alone would wipe every sibling scene's status."""
    tpl = _template(db_session, paid_user)
    _finished_entry(tpl.id, 1)
    sibling = _finished_entry(tpl.id, 2, scene="content_1")
    other_tpl = _finished_entry(tpl.id + 999, 3)

    _forget_finished_scene_edits(tpl.id, SCENE)

    assert set(_scene_edit_progress) == {sibling, other_tpl}


def test_content_6_does_not_match_content_60(db_session, paid_user):
    """`content_6:` vs `content_60:` — the trailing colon is load-bearing."""
    tpl = _template(db_session, paid_user)
    near = _finished_entry(tpl.id, 1, scene="content_60")
    _forget_finished_scene_edits(tpl.id, SCENE)
    assert near in _scene_edit_progress


# ─── through the endpoints, which is where the bug was seen ──────────────────


def test_discard_stops_status_reporting_a_ready_draft(
    client, db_session, paid_user, auth
):
    """The reported bug, end to end."""
    tpl = _template(db_session, paid_user)
    draft = _draft(db_session, tpl, paid_user)
    edit_id = _finished_entry(tpl.id, draft.id)
    h = auth(paid_user)

    # Before: the editor is correctly told a draft is waiting.
    before = client.get(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/ai-edit/status",
        params={"edit_id": edit_id}, headers=h,
    )
    assert before.json()["status"] == "complete"

    assert client.post(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/draft/discard", headers=h
    ).status_code == 200

    # After: the banner's source of truth must no longer claim a draft.
    after = client.get(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/ai-edit/status",
        params={"edit_id": edit_id}, headers=h,
    )
    assert after.json()["status"] == "unknown"
    assert after.json()["draft_version_id"] is None

    # And the row really is gone — the 404 the frontend was looping on.
    assert client.get(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/draft", headers=h
    ).status_code == 404


def test_discarded_scene_drops_out_of_the_summary(client, db_session, paid_user, auth):
    """`/scene-drafts` drives the per-row dot; a discarded scene must lose it."""
    tpl = _template(db_session, paid_user)
    draft = _draft(db_session, tpl, paid_user)
    _finished_entry(tpl.id, draft.id)
    h = auth(paid_user)

    client.post(f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/draft/discard", headers=h)

    summary = client.get(f"/api/custom-templates/{tpl.id}/scene-drafts", headers=h).json()
    assert SCENE not in summary["drafts"]
    assert SCENE not in summary["running"]


def test_apply_also_retires_the_job(client, db_session, paid_user, auth):
    """Apply resolves the draft too, so it had the same stale-banner bug."""
    tpl = _template(db_session, paid_user)
    draft = _draft(db_session, tpl, paid_user)
    edit_id = _finished_entry(tpl.id, draft.id)
    h = auth(paid_user)

    resp = client.post(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/draft/apply", headers=h
    )
    assert resp.status_code == 200, resp.text

    after = client.get(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/ai-edit/status",
        params={"edit_id": edit_id}, headers=h,
    ).json()
    assert after["status"] == "unknown"


def test_status_without_an_edit_id_is_also_clear_after_discard(
    client, db_session, paid_user, auth
):
    """A reopened modal polls with NO edit_id and resolves the newest live job.
    That path must not resurrect the banner either."""
    tpl = _template(db_session, paid_user)
    draft = _draft(db_session, tpl, paid_user)
    _finished_entry(tpl.id, draft.id)
    h = auth(paid_user)

    client.post(f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/draft/discard", headers=h)

    after = client.get(
        f"/api/custom-templates/{tpl.id}/scenes/{SCENE}/ai-edit/status", headers=h
    ).json()
    assert after["status"] == "unknown"
