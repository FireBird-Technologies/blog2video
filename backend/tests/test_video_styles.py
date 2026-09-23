from app.models.custom_video_style import CustomVideoStyle
from app.models.project import Project
from app.models.script_preference_learning_job import ScriptPreferenceLearningJob
from app.models.user_video_style import UserBuiltinVideoStyle, UserVideoStyleSettings
from app.services.script_style import snapshot_style_for_project, style_guidance_for_project
from app.services.video_styles import (
    BUILTIN_STYLE_DEFAULT_GUIDANCE,
    DEFAULT_STYLE_IDS,
    auto_add_learned_style,
    effective_selection,
)


def test_new_user_gets_four_virtual_defaults(client, paid_user, auth):
    response = client.get("/api/video-styles", headers=auth(paid_user))

    assert response.status_code == 200
    assert response.json()["selected_ids"] == DEFAULT_STYLE_IDS
    assert response.json()["max_selected"] == 9
    assert response.json()["min_selected"] == 3

    by_id = {style["id"]: style for style in response.json()["styles"]}
    assert "auto" not in by_id
    assert response.json()["auto_style"]["id"] == "auto"
    for key in ("explainer", "storytelling", "promotional"):
        assert by_id[key]["editable"] is True
        assert by_id[key]["customized"] is False
        assert by_id[key]["version"] == 0
        assert by_id[key]["guidance"] == BUILTIN_STYLE_DEFAULT_GUIDANCE[key]


def test_free_user_can_manage_all_video_style_features(client, free_user, auth):
    headers = auth(free_user)

    listed = client.get("/api/video-styles", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["max_selected"] == 9

    customized_builtin = client.patch(
        "/api/video-styles/builtin/explainer",
        headers=headers,
        json={"guidance": "Explain the subject clearly and concisely.", "version": 0},
    )
    assert customized_builtin.status_code == 200

    created = client.post(
        "/api/video-styles/custom",
        headers=headers,
        json={
            "name": "Concise",
            "guidance": "Use short, direct sentences.",
            "creation_method": "manual",
        },
    )
    assert created.status_code == 200
    custom_id = created.json()["custom_id"]
    custom_ref = created.json()["id"]
    assert custom_ref in created.json()["selected_ids"]
    after_create = client.get("/api/video-styles", headers=headers)
    assert after_create.status_code == 200
    assert custom_ref in after_create.json()["selected_ids"]

    updated = client.patch(
        f"/api/video-styles/custom/{custom_id}",
        headers=headers,
        json={
            "name": "Direct",
            "guidance": "Use direct sentences and concrete wording.",
            "creation_method": "manual",
            "version": created.json()["version"],
        },
    )
    assert updated.status_code == 200

    selected = client.put(
        "/api/video-styles/selection",
        headers=headers,
        json={"style_ids": ["explainer", "storytelling", "promotional", custom_ref]},
    )
    assert selected.status_code == 200
    assert custom_ref in selected.json()["selected_ids"]

    pinned = client.put(
        "/api/video-styles/pin",
        headers=headers,
        json={"target_ref": custom_ref},
    )
    assert pinned.status_code == 200
    assert pinned.json()["pinned_target"] == custom_ref

    deleted = client.delete(f"/api/video-styles/custom/{custom_id}", headers=headers)
    assert deleted.status_code == 200


def test_new_custom_style_replaces_oldest_selection_when_all_nine_slots_are_full(
    client, paid_user, auth
):
    headers = auth(paid_user)
    created_refs = []
    for index in range(7):
        created = client.post(
            "/api/video-styles/custom",
            headers=headers,
            json={
                "name": f"Automatic {index + 1}",
                "guidance": f"Use automatic style {index + 1}.",
                "creation_method": "manual",
            },
        )
        assert created.status_code == 200
        created_refs.append(created.json()["id"])

    listed = client.get("/api/video-styles", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()["selected_ids"]) == 9
    assert created_refs[-1] in listed.json()["selected_ids"]
    assert "explainer" not in listed.json()["selected_ids"]


def test_builtin_style_override_is_private_versioned_and_resettable(
    client, db_session, paid_user, other_user, auth
):
    custom_guidance = "Use dry humor and keep the conclusion understated."
    updated = client.patch(
        "/api/video-styles/builtin/explainer",
        headers=auth(paid_user),
        json={"guidance": custom_guidance, "version": 0},
    )
    assert updated.status_code == 200
    assert updated.json()["guidance"] == custom_guidance
    assert updated.json()["customized"] is True
    assert updated.json()["version"] == 1

    stale = client.patch(
        "/api/video-styles/builtin/explainer",
        headers=auth(paid_user),
        json={"guidance": "Use a different tone.", "version": 0},
    )
    assert stale.status_code == 409

    other_response = client.get("/api/video-styles", headers=auth(other_user))
    other_by_id = {style["id"]: style for style in other_response.json()["styles"]}
    assert other_by_id["explainer"]["guidance"] == BUILTIN_STYLE_DEFAULT_GUIDANCE["explainer"]
    assert other_by_id["explainer"]["customized"] is False

    reset = client.delete(
        "/api/video-styles/builtin/explainer", headers=auth(paid_user)
    )
    assert reset.status_code == 200
    assert reset.json()["guidance"] == BUILTIN_STYLE_DEFAULT_GUIDANCE["explainer"]
    assert reset.json()["customized"] is False
    assert db_session.query(UserBuiltinVideoStyle).filter_by(user_id=paid_user.id).count() == 0


def test_auto_and_unknown_builtin_styles_cannot_be_edited(client, paid_user, auth):
    for key in ("auto", "your_style", "unknown"):
        response = client.patch(
            f"/api/video-styles/builtin/{key}",
            headers=auth(paid_user),
            json={"guidance": "Use a concise style.", "version": 0},
        )
        assert response.status_code == 404


def test_builtin_override_is_snapshotted_and_later_edits_do_not_change_project(
    client, db_session, paid_user, auth
):
    first = client.patch(
        "/api/video-styles/builtin/storytelling",
        headers=auth(paid_user),
        json={"guidance": "Use quiet tension and restrained transitions.", "version": 0},
    )
    assert first.status_code == 200

    project = Project(user_id=paid_user.id, name="Built-in snapshot", video_style="storytelling")
    snapshot_style_for_project(project, paid_user, db_session)
    original = project.script_style_snapshot
    assert original == "Use quiet tension and restrained transitions."

    second = client.patch(
        "/api/video-styles/builtin/storytelling",
        headers=auth(paid_user),
        json={"guidance": "Use energetic cliffhangers.", "version": 1},
    )
    assert second.status_code == 200
    assert project.script_style_snapshot == original
    assert style_guidance_for_project(project) == original


def test_auto_waits_until_resolution_before_snapshotting_builtin_override(
    db_session, paid_user
):
    db_session.add(
        UserBuiltinVideoStyle(
            user_id=paid_user.id,
            builtin_key="explainer",
            guidance="Lead with the conclusion and use dry, precise language.",
        )
    )
    db_session.commit()

    project = Project(user_id=paid_user.id, name="Auto snapshot", video_style="auto")
    snapshot_style_for_project(project, paid_user, db_session)
    assert project.script_style_snapshot is None

    # This mirrors the pipeline's Auto resolution step: resolve the concrete key,
    # then freeze that user's effective rules onto the project.
    project.video_style = "explainer"
    snapshot_style_for_project(project, paid_user, db_session)
    assert project.script_style_snapshot == (
        "Lead with the conclusion and use dry, precise language."
    )


def test_selection_below_minimum_is_rejected(client, paid_user, auth):
    response = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["explainer", "storytelling"]},
    )
    assert response.status_code == 422


def test_auto_cannot_be_added_or_removed_via_selection(client, paid_user, auth):
    response = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["auto", "explainer", "storytelling"]},
    )
    assert response.status_code == 422


def test_deleting_custom_style_backfills_to_minimum(client, db_session, paid_user, auth):
    created = client.post(
        "/api/video-styles/custom",
        headers=auth(paid_user),
        json={"name": "Terse", "guidance": "Keep it brief.", "creation_method": "manual"},
    )
    custom_ref = created.json()["id"]
    custom_id = created.json()["custom_id"]

    selection = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["explainer", "storytelling", custom_ref]},
    )
    assert selection.status_code == 200

    deleted = client.delete(f"/api/video-styles/custom/{custom_id}", headers=auth(paid_user))
    assert deleted.status_code == 200
    # The vacated slot is backfilled with the one default not already selected.
    assert deleted.json()["selected_ids"] == ["explainer", "storytelling", "promotional"]


def test_learned_style_fills_fifth_slot_unless_dismissed(db_session, paid_user):
    paid_user.script_preferences = "- Keep sentences concise."
    paid_user.script_preferences_version = 1
    db_session.commit()

    assert effective_selection(db_session, paid_user) == [*DEFAULT_STYLE_IDS, "your_style"]

    db_session.add(UserVideoStyleSettings(user_id=paid_user.id, learned_style_dismissed=True))
    db_session.commit()
    assert effective_selection(db_session, paid_user) == DEFAULT_STYLE_IDS


def test_learning_appends_your_style_to_explicit_selection(db_session, paid_user, client, auth):
    response = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["explainer", "storytelling", "promotional"]},
    )
    assert response.status_code == 200

    paid_user.script_preferences = "- Use direct openings."
    auto_add_learned_style(db_session, paid_user)
    db_session.commit()

    assert effective_selection(db_session, paid_user) == [
        "explainer", "storytelling", "promotional", "your_style",
    ]


def test_learning_evicts_oldest_slot_when_selection_is_full(db_session, paid_user, client, auth):
    custom_refs = []
    for index in range(6):
        created = client.post(
            "/api/video-styles/custom",
            headers=auth(paid_user),
            json={
                "name": f"Custom {index + 1}",
                "guidance": f"Apply custom writing style {index + 1}.",
                "creation_method": "manual",
            },
        )
        assert created.status_code == 200
        custom_refs.append(created.json()["id"])

    full = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={
            "style_ids": [
                "explainer",
                "storytelling",
                "promotional",
                *custom_refs,
            ]
        },
    )
    assert full.status_code == 200
    assert len(full.json()["selected_ids"]) == 9
    before = full.json()["selected_ids"]

    paid_user.script_preferences = "- Use direct openings."
    auto_add_learned_style(db_session, paid_user)
    db_session.commit()

    selected = effective_selection(db_session, paid_user)
    assert len(selected) == 9
    assert "your_style" in selected
    # Exactly one previously-selected slot was evicted to make room.
    kept = [s for s in before if s in selected]
    assert len(kept) == 8
    assert set(selected) == set(kept) | {"your_style"}


def test_custom_style_crud_selection_and_snapshot(client, db_session, paid_user, auth):
    created = client.post(
        "/api/video-styles/custom",
        headers=auth(paid_user),
        json={
            "name": "Documentary",
            "guidance": "Use restrained narration and evidence-led transitions.",
            "creation_method": "manual",
        },
    )
    assert created.status_code == 200
    style_ref = created.json()["id"]
    custom_id = created.json()["custom_id"]

    selection = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["explainer", "storytelling", style_ref]},
    )
    assert selection.status_code == 200
    assert selection.json()["selected_ids"] == ["explainer", "storytelling", style_ref]

    project = Project(user_id=paid_user.id, name="Snapshot", video_style=style_ref)
    snapshot_style_for_project(project, paid_user, db_session)
    original_guidance = project.script_style_snapshot

    updated = client.patch(
        f"/api/video-styles/custom/{custom_id}",
        headers=auth(paid_user),
        json={
            "name": "Documentary v2",
            "guidance": "Use slower pacing.",
            "creation_method": "manual",
        },
    )
    assert updated.status_code == 200
    assert project.script_style_snapshot == original_guidance
    assert style_guidance_for_project(project) == original_guidance

    deleted = client.delete(
        f"/api/video-styles/custom/{custom_id}", headers=auth(paid_user)
    )
    assert deleted.status_code == 200
    assert deleted.json()["selected_ids"] == ["explainer", "storytelling", "promotional"]
    assert project.script_style_snapshot == original_guidance


def test_url_project_creation_keeps_custom_reference_and_snapshot(
    client, db_session, paid_user, auth
):
    style = CustomVideoStyle(
        user_id=paid_user.id,
        name="Crisp analysis",
        guidance="Lead with the conclusion, then support it with concise evidence.",
        creation_method="manual",
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)

    response = client.post(
        "/api/projects",
        headers=auth(paid_user),
        json={
            "blog_url": "https://example.com/custom-style-project",
            "video_style": f"custom:{style.id}",
        },
    )

    assert response.status_code == 200
    saved = db_session.get(Project, response.json()["id"])
    assert saved.video_style == f"custom:{style.id}"
    assert saved.script_style_snapshot == style.guidance


def test_selection_validation_and_cross_user_isolation(
    client, db_session, paid_user, other_user, auth
):
    foreign = CustomVideoStyle(
        user_id=other_user.id,
        name="Private",
        guidance="Use a private style.",
        creation_method="manual",
    )
    db_session.add(foreign)
    db_session.commit()
    db_session.refresh(foreign)

    duplicate = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["explainer", "explainer", "storytelling"]},
    )
    assert duplicate.status_code == 422

    too_many = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={
            "style_ids": [
                "explainer",
                "storytelling",
                "promotional",
                "custom:999",
                "custom:998",
                "custom:997",
                "custom:996",
                "custom:995",
                "custom:994",
                "custom:993",
            ]
        },
    )
    assert too_many.status_code == 422

    cross_user = client.put(
        "/api/video-styles/selection",
        headers=auth(paid_user),
        json={"style_ids": ["explainer", "storytelling", f"custom:{foreign.id}"]},
    )
    assert cross_user.status_code == 404


def test_your_style_update_uses_optimistic_version(client, paid_user, auth):
    first = client.patch(
        "/api/video-styles/your-style",
        headers=auth(paid_user),
        json={"guidance": "Keep sentences concise.\nKeep sentences concise.", "version": 0},
    )
    assert first.status_code == 200
    assert first.json()["version"] == 1
    assert first.json()["guidance"] == "- Keep sentences concise."

    stale = client.patch(
        "/api/video-styles/your-style",
        headers=auth(paid_user),
        json={"guidance": "Use long sentences.", "version": 0},
    )
    assert stale.status_code == 409


def test_delete_your_style_clears_profile_and_selection(db_session, paid_user, client, auth):
    paid_user.script_preferences = "- Use direct openings."
    paid_user.script_preferences_version = 3
    db_session.commit()
    auto_add_learned_style(db_session, paid_user)
    db_session.commit()
    assert effective_selection(db_session, paid_user) == [*DEFAULT_STYLE_IDS, "your_style"]

    response = client.delete("/api/video-styles/your-style", headers=auth(paid_user))

    assert response.status_code == 200
    assert response.json()["selected_ids"] == DEFAULT_STYLE_IDS
    db_session.expire_all()
    refreshed = db_session.get(type(paid_user), paid_user.id)
    assert refreshed.script_preferences is None
    assert refreshed.script_preferences_version == 4
    assert effective_selection(db_session, refreshed) == DEFAULT_STYLE_IDS


def test_delete_your_style_is_idempotent(client, db_session, paid_user, auth):
    initial_version = paid_user.script_preferences_version

    first = client.delete("/api/video-styles/your-style", headers=auth(paid_user))
    second = client.delete("/api/video-styles/your-style", headers=auth(paid_user))

    assert first.status_code == 200
    assert second.status_code == 200
    db_session.refresh(paid_user)
    assert paid_user.script_preferences is None
    assert paid_user.script_preferences_version == initial_version


def test_delete_your_style_removes_all_job_rows(db_session, paid_user, client, auth):
    project = Project(user_id=paid_user.id, name="Job history", blog_url="https://e.test")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    paid_user.script_preferences = "- Use direct openings."
    paid_user.script_preferences_version = 1
    db_session.add_all([
        ScriptPreferenceLearningJob(
            user_id=paid_user.id, project_id=project.id,
            idempotency_key="test-completed", evidence_json="[]",
            target_version_at_enqueue=1, status="completed",
        ),
        ScriptPreferenceLearningJob(
            user_id=paid_user.id, project_id=project.id,
            idempotency_key="test-failed", evidence_json="[]",
            target_version_at_enqueue=1, status="failed",
        ),
        ScriptPreferenceLearningJob(
            user_id=paid_user.id, project_id=project.id,
            idempotency_key="test-queued", evidence_json="[]",
            target_version_at_enqueue=1, status="queued",
        ),
    ])
    db_session.commit()
    assert db_session.query(ScriptPreferenceLearningJob).filter_by(user_id=paid_user.id).count() == 3

    response = client.delete("/api/video-styles/your-style", headers=auth(paid_user))

    assert response.status_code == 200
    assert db_session.query(ScriptPreferenceLearningJob).filter_by(user_id=paid_user.id).count() == 0


def test_deleting_your_style_lets_it_relearn_without_manual_reselection(
    db_session, paid_user, client, auth
):
    paid_user.script_preferences = "- Use direct openings."
    paid_user.script_preferences_version = 1
    db_session.commit()
    auto_add_learned_style(db_session, paid_user)
    db_session.commit()

    delete_response = client.delete("/api/video-styles/your-style", headers=auth(paid_user))
    assert delete_response.status_code == 200

    db_session.expire_all()
    refreshed = db_session.get(type(paid_user), paid_user.id)
    refreshed.script_preferences = "- Keep pacing brisk."
    auto_add_learned_style(db_session, refreshed)
    db_session.commit()

    assert effective_selection(db_session, refreshed) == [*DEFAULT_STYLE_IDS, "your_style"]
