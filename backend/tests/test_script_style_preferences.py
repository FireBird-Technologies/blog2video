import asyncio
from contextlib import nullcontext
from types import SimpleNamespace

from app.models.custom_video_style import CustomVideoStyle
from app.models.project import Project
from app.models.user_video_style import UserBuiltinVideoStyle
from app.services.script_preferences import MAX_PROFILE_CHARS, normalize_profile
from app.services.script_style import snapshot_style_for_project, style_guidance_for_project
from app.services.video_styles import BUILTIN_STYLE_DEFAULT_GUIDANCE


def test_profile_normalization_deduplicates_and_caps():
    raw = "\n".join(["- Keep sentences concise.", "* Keep sentences concise."] + [f"- Preference {i} " + ("x" * 250) for i in range(30)])
    profile = normalize_profile(raw)
    assert len(profile) <= MAX_PROFILE_CHARS
    assert profile.count("Keep sentences concise") == 1


def test_preference_lm_uses_glm_53_flash_with_low_reasoning(monkeypatch):
    from app import dspy_modules

    captured = {}
    sentinel = SimpleNamespace()

    def fake_make_zai_lm(model, temperature, max_tokens, **kwargs):
        captured.update(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        return sentinel

    monkeypatch.setattr(dspy_modules, "_preference_lm", None)
    monkeypatch.setattr(dspy_modules, "_make_zai_lm", fake_make_zai_lm)
    monkeypatch.setattr(dspy_modules.settings, "SCRIPT_PREFERENCE_LM", "glm-5.3-flash")

    assert dspy_modules.get_preference_lm() is sentinel
    assert dspy_modules.get_preference_lm() is sentinel
    assert captured == {
        "model": "glm-5.3-flash",
        "temperature": 0.1,
        "max_tokens": 1200,
        "thinking": True,
        "reasoning_effort": "low",
    }
    assert sentinel.cache is False


def test_preference_lm_disables_thinking_for_non_53_override(monkeypatch):
    from app import dspy_modules

    captured = {}
    sentinel = SimpleNamespace()

    def fake_make_zai_lm(model, temperature, max_tokens, **kwargs):
        captured.update(model=model, **kwargs)
        return sentinel

    monkeypatch.setattr(dspy_modules, "_preference_lm", None)
    monkeypatch.setattr(dspy_modules, "_make_zai_lm", fake_make_zai_lm)
    monkeypatch.setattr(dspy_modules.settings, "SCRIPT_PREFERENCE_LM", "glm-5.2")

    dspy_modules.get_preference_lm()
    assert sentinel.cache is False

    assert captured == {
        "model": "glm-5.2",
        "thinking": False,
        "reasoning_effort": None,
    }


def test_merge_uses_flash_without_dspy_chain_of_thought(monkeypatch):
    from app.services import script_preferences

    flash_lm = object()
    captured = {}

    async def fake_predict(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(merged_profile="- Prefer concise, direct openings.")

    monkeypatch.setattr(script_preferences, "ensure_dspy_configured", lambda: None)
    monkeypatch.setattr(script_preferences, "get_preference_lm", lambda: flash_lm)
    monkeypatch.setattr(
        script_preferences,
        "get_scene_lm",
        lambda: (_ for _ in ()).throw(AssertionError("scene LM should not be used")),
    )
    monkeypatch.setattr(script_preferences.dspy, "Predict", lambda _signature: object())
    monkeypatch.setattr(script_preferences.dspy, "asyncify", lambda _predictor: fake_predict)
    monkeypatch.setattr(script_preferences.dspy, "context", lambda **_kwargs: nullcontext())

    merged = asyncio.run(script_preferences._merge("", '[{"before": {}, "after": {}}]'))

    assert merged == "- Prefer concise, direct openings."
    assert captured["current_profile"] == "(none yet)"


def test_merge_final_retry_uses_scene_model_fallback(monkeypatch):
    from app.services import script_preferences

    fallback_lm = object()
    used_lms = []

    async def fake_predict(**_kwargs):
        return SimpleNamespace(merged_profile="- Keep narration conversational.")

    monkeypatch.setattr(script_preferences, "ensure_dspy_configured", lambda: None)
    monkeypatch.setattr(
        script_preferences,
        "get_preference_lm",
        lambda: (_ for _ in ()).throw(AssertionError("Flash should not be used")),
    )
    monkeypatch.setattr(script_preferences, "get_scene_lm", lambda: fallback_lm)
    monkeypatch.setattr(script_preferences.dspy, "Predict", lambda _signature: object())
    monkeypatch.setattr(script_preferences.dspy, "asyncify", lambda _predictor: fake_predict)
    monkeypatch.setattr(
        script_preferences.dspy,
        "context",
        lambda **kwargs: used_lms.append(kwargs["lm"]) or nullcontext(),
    )

    merged = asyncio.run(
        script_preferences._merge("", "[]", use_fallback=True)
    )

    assert merged == "- Keep narration conversational."
    assert used_lms == [fallback_lm]


def test_your_style_is_snapshotted_from_server_user(paid_user):
    paid_user.script_preferences = "- Use warm, concise hooks."
    paid_user.script_preferences_version = 4
    project = Project(user_id=paid_user.id, name="Styled", video_style="your_style")
    snapshot_style_for_project(project, paid_user)
    assert project.script_style_snapshot == paid_user.script_preferences
    assert project.script_preferences_version_used == 4
    assert style_guidance_for_project(project) == paid_user.script_preferences


def test_your_style_without_profile_falls_back_to_auto(paid_user):
    paid_user.script_preferences = None
    project = Project(user_id=paid_user.id, name="Styled", video_style="your_style")
    snapshot_style_for_project(project, paid_user)
    assert project.video_style == "auto"
    assert project.script_style_snapshot is None


def test_custom_style_without_guidance_falls_back_to_explainer(db_session, paid_user):
    style = CustomVideoStyle(
        user_id=paid_user.id,
        name="Cleared style",
        guidance="   ",
        creation_method="manual",
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)

    project = Project(user_id=paid_user.id, name="Styled", video_style=f"custom:{style.id}")
    snapshot_style_for_project(project, paid_user, db_session)
    assert project.video_style == "explainer"
    assert project.script_style_snapshot is None
    assert style_guidance_for_project(project) == BUILTIN_STYLE_DEFAULT_GUIDANCE["explainer"]


def test_builtin_override_without_guidance_falls_back_to_builtin_default(db_session, paid_user):
    db_session.add(
        UserBuiltinVideoStyle(
            user_id=paid_user.id,
            builtin_key="promotional",
            guidance="",
        )
    )
    db_session.commit()

    project = Project(user_id=paid_user.id, name="Styled", video_style="promotional")
    snapshot_style_for_project(project, paid_user, db_session)
    assert project.script_style_snapshot == BUILTIN_STYLE_DEFAULT_GUIDANCE["promotional"]
    assert style_guidance_for_project(project) == BUILTIN_STYLE_DEFAULT_GUIDANCE["promotional"]
