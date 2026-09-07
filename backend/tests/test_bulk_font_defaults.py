"""
Bulk scene font-defaults: PATCH /{id}/scenes/font-defaults.

The editor's Save writes every scene whose sliders moved. It used to do that as N
sequential per-scene requests, which HAD to be sequential because each re-reads,
merges and rewrites the same `scene_font_defaults` column.

The batch route must therefore be indistinguishable from running those requests
one after another — same clamping, same partial-merge semantics — or the same
slider would store different values depending on how it was saved. That
equivalence is what these tests pin down.
"""
import json

import pytest

from app.models.custom_template import CustomTemplate
from app.services.code_generator import _USER_BANDS

pytestmark = pytest.mark.depth


def _template(db, user, *, num_content: int = 3, font_defaults=None) -> CustomTemplate:
    tpl = CustomTemplate(
        user_id=user.id,
        name="T",
        theme=json.dumps({
            "colors": {"bg": "#ffffff", "text": "#111111", "accent": "#3366ff"},
            "fonts": {"heading": "inter", "body": "inter"},
        }),
        intro_code="const A = () => null;",
        outro_code="const Z = () => null;",
        content_codes=json.dumps(["const C = () => null;"] * num_content),
        scene_font_defaults=json.dumps(font_defaults) if font_defaults else None,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


def _url(tpl_id: int) -> str:
    return f"/api/custom-templates/{tpl_id}/scenes/font-defaults"


def _stored(db, tpl_id: int) -> dict:
    db.expire_all()
    row = db.query(CustomTemplate).filter(CustomTemplate.id == tpl_id).first()
    return json.loads(row.scene_font_defaults or "{}")


# ─── The point of the route: many scenes, one request ───────────────────────

def test_bulk__writes_every_scene_in_one_call(client, db_session, free_user, auth):
    tpl = _template(db_session, free_user)
    resp = client.patch(
        _url(tpl.id),
        headers=auth(free_user),
        json={"scenes": {
            "intro": {"title": {"landscape": 119}},
            "content_1": {"title": {"landscape": 84}, "description": {"landscape": 40}},
            "outro": {"description": {"portrait": 33}},
        }},
    )
    assert resp.status_code == 200

    stored = _stored(db_session, tpl.id)
    assert stored["intro"]["title"]["landscape"] == 119
    assert stored["content"][1]["title"]["landscape"] == 84
    assert stored["content"][1]["description"]["landscape"] == 40
    assert stored["outro"]["description"]["portrait"] == 33


def test_bulk__content_scenes_land_at_their_own_index(client, db_session, free_user, auth):
    """Index alignment: content_0 and content_2 must not overwrite each other."""
    tpl = _template(db_session, free_user, num_content=3)
    client.patch(
        _url(tpl.id),
        headers=auth(free_user),
        json={"scenes": {
            "content_0": {"title": {"landscape": 60}},
            "content_2": {"title": {"landscape": 90}},
        }},
    )
    content = _stored(db_session, tpl.id)["content"]
    assert content[0]["title"]["landscape"] == 60
    assert content[2]["title"]["landscape"] == 90
    # The untouched middle scene is padded, not filled with a neighbour's value.
    assert content[1] in ({}, None) or "title" not in (content[1] or {})


# ─── Equivalence with the per-scene route ───────────────────────────────────

def test_bulk__matches_sequential_per_scene_calls(client, db_session, free_user, auth):
    """One batch == the same edits sent one at a time. If these ever diverge,
    a slider stores a different number depending on how many scenes moved."""
    edits = {
        "intro": {"title": {"landscape": 119}, "description": {"landscape": 41}},
        "content_0": {"title": {"portrait": 55}},
        "outro": {"description": {"landscape": 37}},
    }

    bulk_tpl = _template(db_session, free_user)
    client.patch(_url(bulk_tpl.id), headers=auth(free_user), json={"scenes": edits})
    bulk_result = _stored(db_session, bulk_tpl.id)

    seq_tpl = _template(db_session, free_user)
    for key, body in edits.items():
        client.patch(
            f"/api/custom-templates/{seq_tpl.id}/scenes/{key}/font-defaults",
            headers=auth(free_user),
            json=body,
        )
    seq_result = _stored(db_session, seq_tpl.id)

    assert bulk_result == seq_result


# ─── Clamping and merging, shared with the per-scene route ──────────────────

def test_bulk__clamps_to_user_bands(client, db_session, free_user, auth):
    lo, hi = _USER_BANDS["title"]["landscape"]
    tpl = _template(db_session, free_user)
    client.patch(
        _url(tpl.id),
        headers=auth(free_user),
        json={"scenes": {
            "intro": {"title": {"landscape": hi + 500}},
            "outro": {"title": {"landscape": 1}},
        }},
    )
    stored = _stored(db_session, tpl.id)
    assert stored["intro"]["title"]["landscape"] == hi
    assert stored["outro"]["title"]["landscape"] == lo


def test_bulk__partial_update_preserves_untouched_axes(client, db_session, free_user, auth):
    """Sending only landscape must not blank a stored portrait size."""
    tpl = _template(
        db_session, free_user,
        font_defaults={"intro": {"title": {"landscape": 80, "portrait": 55}}},
    )
    client.patch(
        _url(tpl.id),
        headers=auth(free_user),
        json={"scenes": {"intro": {"title": {"landscape": 120}}}},
    )
    title = _stored(db_session, tpl.id)["intro"]["title"]
    assert title["landscape"] == 120
    assert title["portrait"] == 55


# ─── A bad key must not cost the whole batch ────────────────────────────────

def test_bulk__unparseable_key_is_skipped_not_fatal(client, db_session, free_user, auth):
    tpl = _template(db_session, free_user, num_content=2)
    resp = client.patch(
        _url(tpl.id),
        headers=auth(free_user),
        json={"scenes": {
            "content_99": {"title": {"landscape": 70}},   # out of range
            "not_a_scene": {"title": {"landscape": 70}},  # unparseable
            "intro": {"title": {"landscape": 99}},        # good
        }},
    )
    assert resp.status_code == 200
    stored = _stored(db_session, tpl.id)
    assert stored["intro"]["title"]["landscape"] == 99


def test_bulk__nothing_usable_is_422(client, db_session, free_user, auth):
    tpl = _template(db_session, free_user)
    resp = client.patch(
        _url(tpl.id),
        headers=auth(free_user),
        json={"scenes": {"not_a_scene": {"title": {"landscape": 70}}}},
    )
    assert resp.status_code == 422


def test_bulk__empty_body_is_422(client, db_session, free_user, auth):
    tpl = _template(db_session, free_user)
    resp = client.patch(_url(tpl.id), headers=auth(free_user), json={"scenes": {}})
    assert resp.status_code == 422


# ─── Ownership + routing ────────────────────────────────────────────────────

def test_bulk__other_users_template_is_not_writable(
    client, db_session, free_user, other_user, auth
):
    tpl = _template(db_session, free_user)
    resp = client.patch(
        _url(tpl.id),
        headers=auth(other_user),
        json={"scenes": {"intro": {"title": {"landscape": 99}}}},
    )
    assert resp.status_code == 404
    assert _stored(db_session, tpl.id) == {}


def test_bulk_route_does_not_shadow_per_scene_route(client, db_session, free_user, auth):
    """`/scenes/font-defaults` and `/scenes/{key}/font-defaults` both resolve.

    The literal path is registered first so it is not captured as a scene_key.
    """
    tpl = _template(db_session, free_user)
    single = client.patch(
        f"/api/custom-templates/{tpl.id}/scenes/intro/font-defaults",
        headers=auth(free_user),
        json={"title": {"landscape": 77}},
    )
    assert single.status_code == 200
    assert _stored(db_session, tpl.id)["intro"]["title"]["landscape"] == 77
