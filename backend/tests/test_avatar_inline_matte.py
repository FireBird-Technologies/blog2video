"""
Depth tier — inline GPU matting: the parse/persist seam and R2 headers.

WHY THIS FILE EXISTS
Matting moved off this server and INTO the Modal render container, so /render
now answers with multipart/form-data carrying three files (mp4 + transparent
ProRes .mov + WebM .webm) instead of a bare mp4 body. That was verified on a
live L40S — but by calling /render DIRECTLY, which bypassed everything below:
the multipart parse, writing three files to disk, three R2 uploads, and the
single transaction that records two Scene columns plus three Asset rows.

These tests cover exactly that seam. They are hermetic — no GPU, no network
(conftest's autouse kill_network would block it anyway) — because the thing
worth testing here is the plumbing, not the model.

Deliberately NOT tested: driving the queue dispatcher end to end. That means
concurrent sessions against a pool (size 5 + 10 overflow) which has been drained
before, and cost a render that had already been paid for on the GPU. The
parse-and-persist seam is reachable without it.
"""
import os
import uuid

import pytest

from app.models.asset import Asset, AssetType
from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.services import r2_storage
from app.services.avatar import _parse_render_response, _render_and_store

pytestmark = pytest.mark.depth


# ─── helpers ────────────────────────────────────────────────────────────────

class _FakeResponse:
    """Enough of requests.Response for _parse_render_response."""

    def __init__(self, content: bytes, headers: dict):
        self.content = content
        self.headers = headers
        self.status_code = 200
        self.text = ""


def _multipart(parts: list[tuple[str, str, str, bytes]]) -> tuple[bytes, str]:
    """Build a body byte-for-byte like the service's _multipart_response does.

    Hand-rolled on BOTH sides on purpose (see the encoder's comment in
    modal-service/omniavatar/app.py), so this test is what proves the two
    hand-rolled halves actually agree.
    """
    boundary = f"----omniavatar{uuid.uuid4().hex}"
    chunks = []
    for name, filename, content_type, body in parts:
        chunks.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n".encode()
        )
        chunks.append(body)
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _three_part_response(mp4=b"MP4DATA", mov=b"MOVDATA", webm=b"WEBMDATA", **headers):
    body, ctype = _multipart([
        ("video", "r.mp4", "video/mp4", mp4),
        ("matte", "r.mov", "video/quicktime", mov),
        ("preview", "r.webm", "video/webm", webm),
    ])
    return _FakeResponse(body, {"content-type": ctype, **headers})


def _bind_service_sessions(monkeypatch, db):
    """Make avatar.py's own SessionLocal() calls reuse the test session.

    The service deliberately opens FRESH short-lived sessions rather than taking
    one from the caller — a DB connection must never be held across the
    multi-minute render, because Neon drops idle SSL connections. That is correct
    in production and inconvenient here: db_session binds to its own connection
    inside an uncommitted outer transaction, so a genuinely new session sees none
    of the test's rows and the service reports "That scene no longer exists."

    Handing back the test session (with close() neutered, since the service
    closes it in a finally) preserves the call pattern while keeping every write
    inside the transaction the fixture rolls back.
    """
    monkeypatch.setattr(db, "close", lambda: None)
    monkeypatch.setattr("app.services.avatar.SessionLocal", lambda: db)


def _project_with_scene(db, user, tmp_path):
    project = Project(user_id=user.id, name="Avatar", blog_url="https://a.test",
                      status=ProjectStatus.GENERATED)
    db.add(project)
    db.commit()
    db.refresh(project)

    # The render reads this scene's voiceover; a real file must exist on disk or
    # _render_and_store bails before it ever reaches the parse.
    voiceover = tmp_path / "scene_1.mp3"
    voiceover.write_bytes(b"ID3fake-audio")

    scene = Scene(project_id=project.id, order=1, title="S1", narration_text="n",
                  visual_description="v", voiceover_path=str(voiceover))
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return project, scene


# ─── _parse_render_response ─────────────────────────────────────────────────

def test_parse__multipart_returns_all_three_parts_byte_exact():
    mp4, mov, webm = os.urandom(5000), os.urandom(9000), os.urandom(3000)
    payload = _parse_render_response(_three_part_response(mp4, mov, webm))

    # Byte-exact matters: these are binary video payloads, and a framing bug in
    # the hand-rolled encoder/decoder pair would show up as silent corruption
    # rather than an exception.
    assert payload.mp4 == mp4
    assert payload.mov == mov
    assert payload.webm == webm
    assert payload.matte_error is None


def test_parse__bare_mp4_body_still_works():
    """The legacy single-file contract.

    Backend and Modal service deploy SEPARATELY, so either can be newer than the
    other for a while. A backend that could only parse multipart would break
    every render the moment it shipped ahead of the service.
    """
    payload = _parse_render_response(
        _FakeResponse(b"JUSTTHEMP4", {"content-type": "video/mp4"})
    )
    assert payload.mp4 == b"JUSTTHEMP4"
    assert payload.mov is None
    assert payload.webm is None


def test_parse__captures_matte_error_and_timing_headers():
    resp = _FakeResponse(b"MP4ONLY", {
        "content-type": "video/mp4",
        "X-Matte-Error": "CalledProcessError: ffmpeg rc=1",
        "X-Matte-Rembg-Seconds": "21.7",
        "X-Matte-Frames": "358",
    })
    payload = _parse_render_response(resp)
    assert payload.mp4 == b"MP4ONLY"
    assert payload.matte_error == "CalledProcessError: ffmpeg rc=1"
    assert payload.timings["X-Matte-Rembg-Seconds"] == "21.7"


# ─── _render_and_store: files + DB ──────────────────────────────────────────

def test_render_and_store__persists_three_files_and_asset_rows(
    db_session, paid_user, tmp_path, monkeypatch
):
    project, scene = _project_with_scene(db_session, paid_user, tmp_path)
    monkeypatch.setattr("app.config.settings.MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setattr(r2_storage, "is_r2_configured", lambda: False)
    _bind_service_sessions(monkeypatch, db_session)
    monkeypatch.setattr(
        "app.services.avatar.requests.post",
        lambda *a, **k: _three_part_response(),
    )

    err = _render_and_store(scene.id, project.id, "man_beard")
    assert err is None

    db_session.expire_all()
    scene = db_session.query(Scene).filter(Scene.id == scene.id).first()

    # The .mov is what the Remotion render actually reads (remotion.py picks it
    # over the mp4 when a background is chosen), so it must land on the scene.
    assert scene.avatar_matte_path.endswith("avatar_scene_1.mov")
    assert scene.avatar_video_path.endswith("avatar_scene_1.mp4")
    assert scene.avatar_matte_error is None
    assert scene.avatar_matte_failed_at is None

    for path in (scene.avatar_video_path, scene.avatar_matte_path):
        assert os.path.exists(path), f"{path} was not written to disk"

    # All three go in the same AssetType.AVATAR bucket, differing only by
    # filename/codec, so the frontend's filename-based lookup finds the .webm.
    filenames = {
        a.filename
        for a in db_session.query(Asset).filter(
            Asset.project_id == project.id,
            Asset.asset_type == AssetType.AVATAR,
        )
    }
    assert filenames == {
        "avatar_scene_1.mp4", "avatar_scene_1.mov", "avatar_scene_1.webm",
    }


def test_render_and_store__matte_failure_keeps_the_paid_render(
    db_session, paid_user, tmp_path, monkeypatch
):
    """A matte crash must never cost a render that already burned GPU money.

    The service degrades to an mp4-only response plus X-Matte-Error; the render
    is still a success, and the reason is recorded ON THE SCENE (not the job row,
    which is `completed`) so the UI can explain why a background change is
    unavailable instead of silently ignoring the user's colour choice.
    """
    project, scene = _project_with_scene(db_session, paid_user, tmp_path)
    monkeypatch.setattr("app.config.settings.MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setattr(r2_storage, "is_r2_configured", lambda: False)
    _bind_service_sessions(monkeypatch, db_session)
    monkeypatch.setattr(
        "app.services.avatar.requests.post",
        lambda *a, **k: _FakeResponse(
            b"MP4ONLY",
            {"content-type": "video/mp4", "X-Matte-Error": "RuntimeError: no frames"},
        ),
    )

    err = _render_and_store(scene.id, project.id, "man_beard")
    assert err is None, "a matte failure must not fail the render"

    db_session.expire_all()
    scene = db_session.query(Scene).filter(Scene.id == scene.id).first()
    assert scene.avatar_video_path is not None
    assert scene.avatar_matte_path is None
    assert scene.avatar_matte_error == "RuntimeError: no frames"
    assert scene.avatar_matte_failed_at is not None

    rows = db_session.query(Asset).filter(
        Asset.project_id == project.id, Asset.asset_type == AssetType.AVATAR
    ).all()
    assert len(rows) == 1


# ─── R2 headers ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("filename,expect_type", [
    ("avatar_scene_1.mp4", "video/mp4"),
    ("avatar_scene_1.mov", "video/quicktime"),
    ("avatar_scene_1.webm", "video/webm"),
    ("custom_presenter_1.png", "image/png"),
])
def test_upload_project_avatar__labels_each_format_correctly(
    tmp_path, monkeypatch, filename, expect_type
):
    """upload_project_avatar carries FOUR formats through one helper.

    It used to hardcode content_type="video/mp4" for all of them, which also
    suppressed upload_file's own guess_type fallback. A portrait stored as
    video/mp4 is a broken <img>, and a VP9-with-alpha stream stored as video/mp4
    silently fails to decode in the <video> tag that reads it.
    """
    captured = {}

    class _FakeClient:
        def upload_file(self, Filename, Bucket, Key, ExtraArgs):  # noqa: N803
            captured.update(ExtraArgs)

    local = tmp_path / filename
    local.write_bytes(b"x")
    monkeypatch.setattr(r2_storage, "is_r2_configured", lambda: True)
    monkeypatch.setattr(r2_storage, "_get_client", lambda: _FakeClient())
    monkeypatch.setattr("app.config.settings.R2_BUCKET_NAME", "b")
    monkeypatch.setattr("app.config.settings.R2_PUBLIC_URL", "https://cdn.test")

    r2_storage.upload_project_avatar(1, 2, str(local), filename)

    assert captured["ContentType"] == expect_type
    # None of these are downloads — every one is played or shown inline.
    assert "ContentDisposition" not in captured


def test_upload_project_video__still_marked_as_a_download(tmp_path, monkeypatch):
    """The finished project video is the ONE thing a user saves to disk, so it
    keeps the attachment header the avatar files must not have."""
    captured = {}

    class _FakeClient:
        def upload_file(self, Filename, Bucket, Key, ExtraArgs):  # noqa: N803
            captured.update(ExtraArgs)

    local = tmp_path / "out.mp4"
    local.write_bytes(b"x")
    monkeypatch.setattr(r2_storage, "is_r2_configured", lambda: True)
    monkeypatch.setattr(r2_storage, "_get_client", lambda: _FakeClient())
    monkeypatch.setattr("app.config.settings.R2_BUCKET_NAME", "b")
    monkeypatch.setattr("app.config.settings.R2_PUBLIC_URL", "https://cdn.test")

    r2_storage.upload_project_video(1, 2, str(local))

    assert captured["ContentType"] == "video/mp4"
    assert captured["ContentDisposition"].startswith("attachment")


# ─── automatic-sweep backoff ────────────────────────────────────────────────

def test_scene_needs_matte_filters__excludes_scenes_that_already_failed(
    db_session, paid_user, tmp_path
):
    """The backoff that stops an unbounded retry loop.

    Inline matting gets ONE attempt (its failures are deterministic), so without
    avatar_matte_failed_at in this predicate a failing scene is re-enqueued every
    time any other render in the project completes.
    """
    from app.services.avatar_queue import scene_needs_matte_filters

    project, ok_scene = _project_with_scene(db_session, paid_user, tmp_path)
    ok_scene.avatar_video_path = "/tmp/a.mp4"

    failed = Scene(project_id=project.id, order=2, title="S2", narration_text="n",
                   visual_description="v", avatar_video_path="/tmp/b.mp4",
                   avatar_matte_error="boom",
                   avatar_matte_failed_at=__import__("datetime").datetime.utcnow())
    db_session.add(failed)
    db_session.commit()

    swept = (
        db_session.query(Scene)
        .filter(Scene.project_id == project.id, *scene_needs_matte_filters())
        .all()
    )
    orders = {s.order for s in swept}
    assert 1 in orders, "a healthy un-matted scene should still be swept"
    assert 2 not in orders, "a previously-failed scene must be skipped"
