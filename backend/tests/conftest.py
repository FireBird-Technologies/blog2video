"""
Tier A test fixtures: authenticated users + the network kill-switch.

The kill-switch is the safety floor for the whole suite: it installs a socket
guard that raises on ANY real outbound connection, so a missing mock fails the
test loudly instead of silently hitting a live service (Stripe, ElevenLabs, R2,
an LLM, or — worst case — a real database). External SDK boundaries that the
smoke tests legitimately exercise (e.g. the transactional email service used by
the public contact form) are stubbed to no-ops.

IMPORTANT: the kill-switch stubs *I/O boundaries only*. It never touches the
route's own logic, the auth dependency, the ownership query, or response status
codes — otherwise a test could pass for the wrong reason (a false green).
"""
from __future__ import annotations

import json
import socket
from pathlib import Path

import pytest

from app.auth import create_access_token
from app.models.user import PlanTier, User

# ─── LLM recordings (record/replay) ─────────────────────────────────────────
RECORDINGS_DIR = Path(__file__).parent / "recordings"


def load_recording(name: str) -> dict | None:
    """Load a captured LLM output by name, or None if it hasn't been captured."""
    path = RECORDINGS_DIR / f"{name}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def available_recordings() -> list[str]:
    """Names of all captured recordings (drives skip-if-absent parametrization)."""
    if not RECORDINGS_DIR.exists():
        return []
    return sorted(p.stem for p in RECORDINGS_DIR.glob("*.json"))


@pytest.fixture()
def replay_script(monkeypatch):
    """Patch ScriptGenerator.generate to return a recorded dict instead of calling
    the real LLM. Usage: ``replay_script(recording_dict)`` then drive the pipeline."""
    from app.dspy_modules.script_gen import ScriptGenerator

    def _install(recording: dict):
        async def _fake_generate(self, *args, **kwargs):
            return recording
        monkeypatch.setattr(ScriptGenerator, "generate", _fake_generate, raising=True)
        return recording

    return _install


# ─── Network kill-switch ────────────────────────────────────────────────────

_REAL_SOCKET_CONNECT = socket.socket.connect
_REAL_SOCKET_CONNECT_EX = socket.socket.connect_ex


class RealNetworkBlockedError(RuntimeError):
    """Raised when a test attempts a real outbound network connection."""


def _blocked_connect(self, address, *args, **kwargs):  # noqa: ANN001
    # TestClient talks to the app in-process (no socket); SQLite uses a file.
    # So any socket connect here is an un-mocked external call we want to catch.
    raise RealNetworkBlockedError(
        f"Real network connection blocked in tests: {address!r}. "
        "Add a mock for this external call in tests/conftest.py."
    )


@pytest.fixture(autouse=True)
def kill_network(monkeypatch):
    """Autouse: block real sockets and stub external I/O boundaries.

    Applies to every test. After installing it, the suite's own red-green
    check (test_killswitch.py) confirms it does NOT manufacture passing
    results — a no-token request must still 401, a wrong-user request must
    still 403/404.
    """
    # 1) Hard socket guard — the universal catch-all.
    monkeypatch.setattr(socket.socket, "connect", _blocked_connect, raising=True)
    monkeypatch.setattr(socket.socket, "connect_ex", _blocked_connect, raising=True)

    # 2) Stub the transactional email service so any email-sending route returns
    #    its real status without SMTP. Patched on the EmailService CLASS (not just
    #    the shared singleton) because some routers build their own instance
    #    (e.g. affiliate._email_service = EmailService()).
    from app.services import email as email_module

    for method in (
        "send_enterprise_contact_email",
        "send_custom_template_request_email",
        "send_referral_invite_email",
    ):
        monkeypatch.setattr(
            email_module.EmailService, method,
            lambda *a, **k: None, raising=True,
        )

    yield


# ─── User fixtures ──────────────────────────────────────────────────────────

def _make_user(db, *, email, name, plan=PlanTier.FREE, google_id=None, **extra) -> User:
    user = User(
        email=email,
        name=name,
        google_id=google_id or f"google-{email}",
        plan=plan,
        is_active=True,
        **extra,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def free_user(db_session) -> User:
    """A FREE-tier active user with no usage yet."""
    return _make_user(
        db_session, email="free@test.local", name="Free User", plan=PlanTier.FREE,
    )


@pytest.fixture()
def paid_user(db_session) -> User:
    """A PRO-tier active user (passes paid/quota gates)."""
    return _make_user(
        db_session, email="paid@test.local", name="Paid User", plan=PlanTier.PRO,
    )


@pytest.fixture()
def other_user(db_session) -> User:
    """A second, distinct user used to prove cross-tenant isolation."""
    return _make_user(
        db_session, email="other@test.local", name="Other User", plan=PlanTier.PRO,
    )


def auth_header(user: User) -> dict[str, str]:
    """Bearer header carrying a real JWT for ``user`` (reuses app.auth)."""
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture()
def auth():
    """Convenience: ``auth(user)`` -> Authorization header dict."""
    return auth_header
