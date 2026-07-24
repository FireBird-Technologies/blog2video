"""
Depth tier — stock footage (Pexels/Pixabay clips attached to scenes).

Covers the two things most likely to break silently:

  1. The image auto-assignment cascade in ``write_remotion_data`` must treat a
     scene holding a clip as FULL. If it doesn't, a generic scraped image is
     assigned underneath and the scene renders a still *and* a clip.
  2. Provider response parsing — the shapes were verified against the live docs,
     so these lock them in against drift.
"""
import json
from types import SimpleNamespace

import pytest

from app.models.project import Project, ProjectStatus
from app.models.scene import Scene
from app.services import stock_footage

pytestmark = pytest.mark.depth


# ─── Provider parsing ───────────────────────────────────────────────────────


def test_pexels_search__picks_largest_variant_at_or_under_1080p(monkeypatch):
    """4K variants are skipped: renders top out at 1080p."""
    payload = {
        "videos": [
            {
                "id": 123,
                "width": 3840,
                "height": 2160,
                "url": "https://www.pexels.com/video/x-123/",
                "image": "https://images.pexels.com/thumb.jpg",
                "duration": 12,
                "user": {"id": 7, "name": "Jane Doe", "url": "https://pexels.com/@jane"},
                "video_files": [
                    {"id": 1, "quality": "sd", "file_type": "video/mp4",
                     "width": 640, "height": 360, "fps": 25, "link": "https://cdn/360.mp4"},
                    {"id": 2, "quality": "hd", "file_type": "video/mp4",
                     "width": 1920, "height": 1080, "fps": 30, "link": "https://cdn/1080.mp4"},
                    {"id": 3, "quality": "hd", "file_type": "video/mp4",
                     "width": 3840, "height": 2160, "fps": 30, "link": "https://cdn/2160.mp4"},
                ],
            }
        ]
    }
    monkeypatch.setattr(stock_footage.settings, "PEXELS_API_KEY", "k", raising=False)
    monkeypatch.setattr(
        stock_footage.requests, "get",
        lambda *a, **k: SimpleNamespace(
            json=lambda: payload, raise_for_status=lambda: None
        ),
    )

    clips = stock_footage._pexels_search("news", 10, 1, "landscape")

    assert len(clips) == 1
    clip = clips[0]
    assert clip.download_url == "https://cdn/1080.mp4"   # not the 2160 variant
    assert clip.height == 1080
    assert clip.provider == "pexels"
    assert clip.author == "Jane Doe"
    assert clip.page_url == "https://www.pexels.com/video/x-123/"


def test_pexels_search__falls_back_to_smallest_when_all_variants_exceed_1080p(monkeypatch):
    payload = {
        "videos": [{
            "id": 9, "width": 3840, "height": 2160, "url": "u", "image": "i", "duration": 5,
            "user": {"name": "A"},
            "video_files": [
                {"width": 3840, "height": 2160, "fps": 30, "link": "https://cdn/2160.mp4"},
                {"width": 2560, "height": 1440, "fps": 30, "link": "https://cdn/1440.mp4"},
            ],
        }]
    }
    monkeypatch.setattr(stock_footage.settings, "PEXELS_API_KEY", "k", raising=False)
    monkeypatch.setattr(
        stock_footage.requests, "get",
        lambda *a, **k: SimpleNamespace(json=lambda: payload, raise_for_status=lambda: None),
    )

    clips = stock_footage._pexels_search("q", 10, 1, None)
    # Downscaled in ffmpeg rather than dropping an otherwise-good result.
    assert clips[0].download_url == "https://cdn/1440.mp4"


def test_pixabay_search__filters_portrait_client_side(monkeypatch):
    """Pixabay's video API has no `orientation` param, so we filter ourselves."""
    payload = {
        "hits": [
            {   # landscape — must be dropped when portrait is requested
                "id": 1, "pageURL": "https://pixabay.com/videos/1/", "duration": 10,
                "user": "Bob", "picture_id": "abc",
                "videos": {"large": {"url": "https://cdn/l1.mp4", "width": 1920,
                                     "height": 1080, "size": 100}},
            },
            {   # portrait — kept
                "id": 2, "pageURL": "https://pixabay.com/videos/2/", "duration": 8,
                "user": "Ann", "picture_id": "def",
                "videos": {"large": {"url": "https://cdn/l2.mp4", "width": 1080,
                                     "height": 1920, "size": 100}},
            },
        ]
    }
    monkeypatch.setattr(stock_footage.settings, "PIXABAY_API_KEY", "k", raising=False)
    monkeypatch.setattr(
        stock_footage.requests, "get",
        lambda *a, **k: SimpleNamespace(json=lambda: payload, raise_for_status=lambda: None),
    )

    clips = stock_footage._pixabay_search("q", 10, 1, "portrait")

    assert [c.id for c in clips] == ["2"]
    assert clips[0].author == "Ann"


def test_fps_rank__orders_by_how_cleanly_a_rate_maps_onto_30():
    """30 first, clean multiples next, unknown mid, genuine resampling last."""
    assert stock_footage.fps_rank(30.0) == 0
    # 29.97 is a sub-frame nudge; 60/120 decimate cleanly.
    assert stock_footage.fps_rank(29.97) == 1
    assert stock_footage.fps_rank(60.0) == 1
    assert stock_footage.fps_rank(120.0) == 1
    # Pixabay reports no fps — unknown, not known-bad, so it beats 25/24.
    assert stock_footage.fps_rank(None) == 2
    for bad in (25.0, 24.0, 23.98, 50.0, 100.0):
        assert stock_footage.fps_rank(bad) == 3, bad
    assert stock_footage.fps_rank(30.0) < stock_footage.fps_rank(25.0)


def test_search__sorts_30fps_first_and_keeps_provider_interleave(monkeypatch):
    """Ranking must reorder by fps while preserving interleave within a rank."""
    def clip(provider, cid, fps):
        return stock_footage.StockClip(
            provider=provider, id=cid, preview_url="p", thumbnail_url="t",
            download_url="d", width=1920, height=1080, duration=5.0, fps=fps,
            author="a", page_url="u",
        )

    monkeypatch.setattr(
        stock_footage, "_pexels_search",
        lambda *a, **k: [clip("pexels", "p25", 25.0), clip("pexels", "p30", 30.0)],
    )
    monkeypatch.setattr(
        stock_footage, "_pixabay_search",
        lambda *a, **k: [clip("pixabay", "x-none", None)],
    )

    out = stock_footage.search("q")
    assert [c.id for c in out] == [
        "p30",      # exact 30 wins
        "x-none",   # unknown fps beats known-bad
        "p25",      # genuine resampling last
    ]


def test_pick_rendition__smallest_that_covers_the_box():
    files = [
        {"width": 426, "height": 240}, {"width": 640, "height": 360},
        {"width": 960, "height": 540}, {"width": 1280, "height": 720},
        {"width": 1920, "height": 1080},
    ]
    # A full-bleed box needs the full 1080p rendition.
    assert stock_footage._pick_rendition(files, 1920, 1080)["height"] == 1080
    # A smaller box only needs a rendition that covers it.
    assert stock_footage._pick_rendition(files, 640, 360)["height"] == 360
    assert stock_footage._pick_rendition(files, 700, 400)["height"] == 540
    # Unknown box → previous behaviour (largest at or under 1080p).
    assert stock_footage._pick_rendition(files, None, None)["height"] == 1080
    # 4K-only upload → smallest, and let ffmpeg downscale.
    assert stock_footage._pick_rendition(
        [{"width": 3840, "height": 2160}, {"width": 2560, "height": 1440}], 1920, 1080
    )["height"] == 1440


def test_search__missing_api_keys_yield_no_results_rather_than_erroring(monkeypatch):
    monkeypatch.setattr(stock_footage.settings, "PEXELS_API_KEY", "", raising=False)
    monkeypatch.setattr(stock_footage.settings, "PIXABAY_API_KEY", "", raising=False)
    assert stock_footage.search("anything") == []


def test_search__empty_query_short_circuits():
    assert stock_footage.search("   ") == []


# ─── Render-workspace assignment ────────────────────────────────────────────


def _newscast_project(db, user, n_scenes=2):
    project = Project(user_id=user.id, name="Clips", blog_url="https://c.test",
                      status=ProjectStatus.GENERATED, template="newscast")
    db.add(project)
    db.commit()
    db.refresh(project)
    scenes = []
    for i in range(1, n_scenes + 1):
        s = Scene(project_id=project.id, order=i, title=f"S{i}",
                  narration_text="n", visual_description="v",
                  remotion_code=json.dumps({"layout": "anchor_narrative", "layoutProps": {}}))
        db.add(s)
        scenes.append(s)
    db.commit()
    for s in scenes:
        db.refresh(s)
    return project, scenes


def test_project_response_serializes_video_asset_audio_field(
    client, db_session, paid_user, auth
):
    """AssetOut must expose audio_variant_filename + duration.

    The editor decides whether to show the audio toggle from these; if they are
    dropped in serialization every clip looks silent (the reported bug).
    """
    from app.models.asset import Asset, AssetType

    project = Project(user_id=paid_user.id, name="V", blog_url="https://v.test",
                      status=ProjectStatus.GENERATED, template="newscast")
    db_session.add(project); db_session.commit(); db_session.refresh(project)
    db_session.add(Asset(
        project_id=project.id, asset_type=AssetType.VIDEO,
        local_path="/x.mp4", filename="clip.mp4", excluded=False,
        duration_seconds=7.0, width=1920, height=1080,
        source_provider="pexels", source_author="A",
        audio_variant_filename="clip_audio.mp4",
    ))
    db_session.commit()

    resp = client.get(f"/api/projects/{project.id}", headers=auth(paid_user))
    assert resp.status_code == 200, resp.text
    vids = [a for a in resp.json()["assets"] if a["asset_type"] == "video"]
    assert len(vids) == 1
    v = vids[0]
    assert v["audio_variant_filename"] == "clip_audio.mp4"
    assert v["duration_seconds"] == 7.0
    assert v["width"] == 1920


def test_upload_endpoint_creates_asset_but_does_not_link_scene(
    client, db_session, paid_user, auth, tmp_path, monkeypatch
):
    """Staging contract: uploading a clip must NOT touch the scene descriptor.

    The scene link is written later by the normal scene Save. If upload eagerly
    wrote ``assignedVideo`` the 'stage then cancel' flow would leak clips onto
    scenes the user never confirmed.
    """
    from app.services import stock_footage

    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)
    scene = scenes[0]
    descriptor_before = scene.remotion_code

    # Stub the network + ffmpeg boundaries so no real download/transcode happens.
    def _fake_download(url):
        p = tmp_path / "dl.mp4"
        p.write_bytes(b"x")
        return str(p)

    def _fake_normalise(src, dest, with_audio=False):
        import os
        os.makedirs(os.path.dirname(dest), exist_ok=True)  # real normalise() does this
        with open(dest, "wb") as f:
            f.write(b"y")

    monkeypatch.setattr(stock_footage, "download_to_temp", _fake_download)
    monkeypatch.setattr(stock_footage, "normalise", _fake_normalise)
    monkeypatch.setattr(stock_footage, "has_audio_stream", lambda p: False)
    monkeypatch.setattr(
        stock_footage, "probe",
        lambda p: {"duration_seconds": 8.0, "width": 1920, "height": 1080, "fps": 30.0},
    )
    monkeypatch.setattr("app.services.r2_storage.is_r2_configured", lambda: False)

    resp = client.post(
        f"/api/projects/{project.id}/scenes/{scene.id}/stock-footage",
        headers=auth(paid_user),
        json={
            "provider": "pexels", "clip_id": "1",
            "download_url": "https://cdn.example/clip.mp4",
            "width": 1920, "height": 1080, "duration": 8.0,
            "author": "Someone", "page_url": "https://pexels.com/x",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["filename"].startswith(f"scene_{scene.id}_")
    assert body["has_audio"] is False
    assert body["duration_seconds"] == 8.0

    # The asset exists…
    from app.models.asset import Asset
    asset = db_session.query(Asset).filter(
        Asset.project_id == project.id, Asset.asset_type == "VIDEO"
    ).one()
    assert asset.filename == body["filename"]

    # …but the scene descriptor is byte-for-byte unchanged (no eager link).
    db_session.refresh(scene)
    assert scene.remotion_code == descriptor_before
    assert "assignedVideo" not in (scene.remotion_code or "")


def _stub_stock_pipeline(monkeypatch, tmp_path):
    """Stub the network + ffmpeg boundaries so no real download/transcode runs."""
    from app.services import stock_footage

    def _fake_download(url):
        p = tmp_path / "dl.mp4"
        p.write_bytes(b"x")
        return str(p)

    def _fake_normalise(src, dest, with_audio=False):
        import os
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(b"y")

    monkeypatch.setattr(stock_footage, "download_to_temp", _fake_download)
    monkeypatch.setattr(stock_footage, "normalise", _fake_normalise)
    monkeypatch.setattr(stock_footage, "has_audio_stream", lambda p: False)
    monkeypatch.setattr(
        stock_footage, "probe",
        lambda p: {"duration_seconds": 8.0, "width": 1920, "height": 1080, "fps": 30.0},
    )
    monkeypatch.setattr("app.services.r2_storage.is_r2_configured", lambda: False)


_CLIP_BODY = {
    "provider": "pexels", "clip_id": "1",
    "download_url": "https://cdn.example/clip.mp4",
    "width": 1920, "height": 1080, "duration": 8.0,
    "author": "A", "page_url": "https://pexels.com/x",
}


def test_adding_stock_footage_charges_three_ai_edits(
    client, db_session, free_user, auth, tmp_path, monkeypatch
):
    from app.routers.projects import STOCK_FOOTAGE_CREDIT_COST

    assert STOCK_FOOTAGE_CREDIT_COST == 3

    _stub_stock_pipeline(monkeypatch, tmp_path)
    project, scenes = _newscast_project(db_session, free_user, n_scenes=1)
    free_user.ai_edit_credits = 10
    db_session.commit()

    resp = client.post(
        f"/api/projects/{project.id}/scenes/{scenes[0].id}/stock-footage",
        headers=auth(free_user), json=_CLIP_BODY,
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(free_user)
    assert free_user.ai_edit_credits == 7   # 10 - 3


def test_adding_stock_footage_blocked_when_credits_insufficient(
    client, db_session, free_user, auth, tmp_path, monkeypatch
):
    """Gate runs BEFORE the download, so nothing is fetched and no asset is made."""
    from app.models.asset import Asset
    from app.services import stock_footage

    project, scenes = _newscast_project(db_session, free_user, n_scenes=1)
    free_user.ai_edit_credits = 2   # one short of the 3 required
    db_session.commit()

    def _boom(url):
        raise AssertionError("download must not run when credits are insufficient")

    monkeypatch.setattr(stock_footage, "download_to_temp", _boom)

    resp = client.post(
        f"/api/projects/{project.id}/scenes/{scenes[0].id}/stock-footage",
        headers=auth(free_user), json=_CLIP_BODY,
    )
    assert resp.status_code == 403
    assert "3 AI edits" in resp.json()["detail"]

    db_session.refresh(free_user)
    assert free_user.ai_edit_credits == 2   # untouched
    assert db_session.query(Asset).filter(Asset.project_id == project.id).count() == 0


def test_pro_owner_is_not_charged_for_stock_footage(
    client, db_session, paid_user, auth, tmp_path, monkeypatch
):
    _stub_stock_pipeline(monkeypatch, tmp_path)
    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)
    paid_user.ai_edit_credits = 4
    db_session.commit()

    resp = client.post(
        f"/api/projects/{project.id}/scenes/{scenes[0].id}/stock-footage",
        headers=auth(paid_user), json=_CLIP_BODY,
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(paid_user)
    assert paid_user.ai_edit_credits == 4   # PRO is unlimited — nothing spent


def test_upload_broadcasts_project_reload_to_collaborators(
    client, db_session, paid_user, auth, tmp_path, monkeypatch
):
    """Collaborators must be told to refetch, or the new clip asset never reaches them."""
    _stub_stock_pipeline(monkeypatch, tmp_path)
    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)

    sent: list[dict] = []

    async def _capture(project_id, message, exclude_user_id=None):
        sent.append(
            {"project_id": project_id, "message": message, "exclude_user_id": exclude_user_id}
        )

    from app.routers import collab_ws
    monkeypatch.setattr(collab_ws.collab_manager, "broadcast", _capture)

    resp = client.post(
        f"/api/projects/{project.id}/scenes/{scenes[0].id}/stock-footage",
        headers=auth(paid_user), json=_CLIP_BODY,
    )
    assert resp.status_code == 200, resp.text

    reloads = [s for s in sent if s["message"].get("type") == "project_reloaded"]
    assert len(reloads) == 1, f"expected one project_reloaded, got {sent}"
    assert reloads[0]["project_id"] == project.id
    # The actor already has the data — only OTHER collaborators reload.
    assert reloads[0]["exclude_user_id"] == paid_user.id


def test_deleting_a_clip_removes_both_files_and_unlinks_scenes(
    client, db_session, paid_user, auth, tmp_path, monkeypatch
):
    """Deleting a VIDEO asset must purge the silent file AND its audio sibling."""
    from app.models.asset import Asset, AssetType

    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)
    scene = scenes[0]

    vid = tmp_path / "clip.mp4"
    aud = tmp_path / "clip_audio.mp4"
    vid.write_bytes(b"v")
    aud.write_bytes(b"a")

    asset = Asset(
        project_id=project.id, asset_type=AssetType.VIDEO,
        local_path=str(vid), filename="clip.mp4", excluded=False,
        duration_seconds=5.0, audio_variant_filename="clip_audio.mp4",
        r2_key="dev/users/1/projects/1/videos/clip.mp4",
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    desc = json.loads(scene.remotion_code)
    desc["layoutProps"]["assignedVideo"] = "clip.mp4"
    desc["layoutProps"]["videoMuted"] = False
    scene.remotion_code = json.dumps(desc)
    db_session.commit()

    deleted_keys: list[str] = []
    monkeypatch.setattr(
        "app.services.r2_storage.delete_object",
        lambda key: deleted_keys.append(key),
    )

    resp = client.delete(
        f"/api/projects/{project.id}/assets/{asset.id}", headers=auth(paid_user)
    )
    assert resp.status_code == 200, resp.text

    # Both local files gone.
    assert not vid.exists(), "silent variant still on disk"
    assert not aud.exists(), "audio variant still on disk"
    # Both R2 objects deleted.
    assert deleted_keys == [
        "dev/users/1/projects/1/videos/clip.mp4",
        "dev/users/1/projects/1/videos/clip_audio.mp4",
    ]
    # Row gone, and the scene no longer references it.
    assert db_session.query(Asset).filter(Asset.id == asset.id).first() is None
    db_session.refresh(scene)
    lp = json.loads(scene.remotion_code)["layoutProps"]
    assert "assignedVideo" not in lp
    assert "videoMuted" not in lp
    assert lp["hideImage"] is True


def test_upload_endpoint_rejected_on_non_newscast_template(
    client, db_session, paid_user, auth
):
    project = Project(user_id=paid_user.id, name="X", blog_url="https://x.test",
                      status=ProjectStatus.GENERATED, template="economist")
    db_session.add(project); db_session.commit(); db_session.refresh(project)
    s = Scene(project_id=project.id, order=1, title="S", narration_text="n",
              visual_description="v",
              remotion_code=json.dumps({"layout": "x", "layoutProps": {}}))
    db_session.add(s); db_session.commit(); db_session.refresh(s)

    resp = client.post(
        f"/api/projects/{project.id}/scenes/{s.id}/stock-footage",
        headers=auth(paid_user),
        json={"provider": "pexels", "clip_id": "1",
              "download_url": "https://cdn.example/clip.mp4"},
    )
    assert resp.status_code == 400
    assert "Newscast" in resp.json()["detail"]


def test_assigning_image_clears_an_existing_clip(client, db_session, paid_user, auth, tmp_path):
    """Mutual exclusivity: uploading an image onto a clip scene drops the clip."""
    from app.models.asset import Asset, AssetType

    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)
    scene = scenes[0]
    desc = json.loads(scene.remotion_code)
    desc["layoutProps"]["assignedVideo"] = "clip.mp4"
    desc["layoutProps"]["videoMuted"] = False
    scene.remotion_code = json.dumps(desc)
    db_session.commit()

    # A tiny valid PNG.
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000d49444154789c6360000002000100ffff03000006"
        "0005a30f0a0000000049454e44ae426082"
    )
    resp = client.post(
        f"/api/projects/{project.id}/scenes/{scene.id}/image",
        headers=auth(paid_user),
        files={"image": ("x.png", png, "image/png")},
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(scene)
    lp = json.loads(scene.remotion_code)["layoutProps"]
    assert "assignedImage" in lp
    assert "assignedVideo" not in lp    # clip cleared
    assert "videoMuted" not in lp


def test_image_focus_endpoint_accepts_a_clip_scene(client, db_session, paid_user, auth):
    """Framing (focus/zoom) is shared between stills and clips.

    A scene with assignedVideo (and no assignedImage) must be able to save
    framing — otherwise the Adjust-framing flow 400s on every clip.
    """
    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)
    scene = scenes[0]
    desc = json.loads(scene.remotion_code)
    desc["layoutProps"]["assignedVideo"] = "scene_x.mp4"
    scene.remotion_code = json.dumps(desc)
    db_session.commit()

    resp = client.patch(
        f"/api/projects/{project.id}/scenes/{scene.id}/image-focus",
        headers=auth(paid_user),
        json={"image_focus_x": 30, "image_focus_y": 70, "image_zoom": 1.2},
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(scene)
    lp = json.loads(scene.remotion_code)["layoutProps"]
    assert lp["imageFocusX"] == 30
    assert lp["imageFocusY"] == 70
    assert lp["imageZoom"] == 1.2
    assert lp["assignedVideo"] == "scene_x.mp4"  # untouched


def test_video_scene_is_not_also_given_a_generic_image(db_session, paid_user, tmp_path, monkeypatch):
    """The core regression: a clip fills the slot, so no still may be assigned."""
    from app.models.asset import Asset, AssetType
    from app.services import remotion as remotion_service

    # Three scenes: the last is treated as an outro (hideImage) by the existing
    # cascade, so we need a genuine middle scene to prove images still flow.
    project, scenes = _newscast_project(db_session, paid_user, n_scenes=3)

    # One clip on scene 1, plus a generic scraped image in the pool.
    clip_path = tmp_path / "scene_1_1.mp4"
    clip_path.write_bytes(b"fake-mp4")
    img_path = tmp_path / "generic.jpg"
    img_path.write_bytes(b"fake-jpg")

    db_session.add(Asset(project_id=project.id, asset_type=AssetType.VIDEO,
                         local_path=str(clip_path), filename="scene_1_1.mp4",
                         duration_seconds=6.0, excluded=False))
    db_session.add(Asset(project_id=project.id, asset_type=AssetType.IMAGE,
                         local_path=str(img_path), filename="generic.jpg",
                         excluded=False))
    db_session.commit()

    desc = json.loads(scenes[0].remotion_code)
    desc["layoutProps"]["assignedVideo"] = "scene_1_1.mp4"
    scenes[0].remotion_code = json.dumps(desc)
    db_session.commit()

    workspace = tmp_path / "ws"
    (workspace / "public").mkdir(parents=True)
    monkeypatch.setattr(remotion_service, "provision_workspace", lambda *a, **k: str(workspace))

    db_session.refresh(project)
    remotion_service.write_remotion_data(
        project, db_session.query(Scene).filter(Scene.project_id == project.id)
        .order_by(Scene.order).all(), db_session,
    )

    data = json.loads((workspace / "public" / "data.json").read_text())
    s1, s2 = data["scenes"][0], data["scenes"][1]

    # Scene 1: the clip, and NO still underneath it.
    assert s1["video"] == "scene_1_1.mp4"
    assert s1["images"] == []
    assert s1["videoDurationSeconds"] == 6.0
    assert s1["videoMuted"] is True

    # The middle scene still receives the generic image as normal — the guards
    # must not starve ordinary image assignment.
    assert s2.get("video") is None
    assert s2["images"] == ["generic.jpg"]


def test_stale_assigned_video_is_pruned(db_session, paid_user, tmp_path, monkeypatch):
    """A clip whose asset was deleted must not leave the scene rendering nothing."""
    from app.services import remotion as remotion_service

    project, scenes = _newscast_project(db_session, paid_user, n_scenes=1)
    desc = json.loads(scenes[0].remotion_code)
    desc["layoutProps"]["assignedVideo"] = "gone.mp4"   # no matching asset row
    scenes[0].remotion_code = json.dumps(desc)
    db_session.commit()

    workspace = tmp_path / "ws"
    (workspace / "public").mkdir(parents=True)
    monkeypatch.setattr(remotion_service, "provision_workspace", lambda *a, **k: str(workspace))

    db_session.refresh(project)
    remotion_service.write_remotion_data(
        project, db_session.query(Scene).filter(Scene.project_id == project.id).all(), db_session,
    )

    data = json.loads((workspace / "public" / "data.json").read_text())
    assert data["scenes"][0].get("video") is None

    db_session.refresh(scenes[0])
    assert "assignedVideo" not in json.loads(scenes[0].remotion_code)["layoutProps"]
