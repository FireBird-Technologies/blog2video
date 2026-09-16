"""
Depth tier — multi-provider identity rules (Google + built-in email/password).

The invariant under test: one account per email, forever, bound for life to the
provider that created it. A second provider presenting a known email is always
rejected (409 wrong_auth_provider) — never linked, never duplicated — and that
rejection outranks the soft-delete/reactivation prompt.

Apple and Microsoft sign-in were removed (see the drop_apple_microsoft_auth
migration), so the cross-provider cases here run Google against our own
email/password provider — the only pair that still exists. The rules themselves
are provider-agnostic and live in services/auth_identity.py.
"""
import pytest

import app.routers.auth as auth_router
from app.models.user import AuthProvider, PlanTier, User
from app.services.password import hash_password

pytestmark = pytest.mark.depth

PASSWORD = "Correct-Horse-1"


# ─── Helpers ────────────────────────────────────────────────────────────────

def _mock_google(monkeypatch, *, sub, email, name="Google User"):
    monkeypatch.setattr(
        auth_router.id_token, "verify_oauth2_token",
        lambda *a, **k: {"sub": sub, "email": email, "name": name, "picture": None},
        raising=True,
    )


def _google_login(client, **params):
    return client.post("/api/auth/google", json={"credential": "tok"}, params=params)


def _email_login(client, email, password=PASSWORD, **params):
    return client.post(
        "/api/auth/email/login", json={"email": email, "password": password}, params=params
    )


def _email_register_start(client, email, password=PASSWORD):
    return client.post(
        "/api/auth/email/register/start", json={"email": email, "password": password}
    )


# Mirrors auth_identity._PROVIDER_ID_COLUMN — kept explicit so a new provider
# fails here loudly rather than silently writing the wrong column. EMAIL is
# absent on purpose: it has no external subject id, its credential is
# password_hash.
_ID_COLUMN = {
    AuthProvider.GOOGLE: "google_id",
}


def _make_user(db, *, email, provider, sub=None, **kw):
    ident = (
        {_ID_COLUMN[provider]: sub}
        if provider in _ID_COLUMN
        else {"password_hash": hash_password(kw.pop("password", PASSWORD))}
    )
    user = User(
        email=email, name="Existing", auth_provider=provider,
        plan=kw.pop("plan", PlanTier.FREE), **ident, **kw,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ─── Rule 3: an email never yields a second account ─────────────────────────

def test_google_account__email_signup_same_email__409_and_no_new_account(
    client, db_session
):
    _make_user(db_session, email="taken@test.local", provider=AuthProvider.GOOGLE, sub="g-1")

    resp = _email_register_start(client, "taken@test.local")

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["code"] == "wrong_auth_provider"
    assert detail["provider"] == "google"
    assert detail["provider_label"] == "Google"
    assert db_session.query(User).count() == 1


def test_email_account__google_login_same_email__409(client, db_session, monkeypatch):
    """The mirror image: a password account is not signed into with Google."""
    _make_user(db_session, email="mine@test.local", provider=AuthProvider.EMAIL)
    _mock_google(monkeypatch, sub="g-2", email="mine@test.local")

    resp = _google_login(client)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["provider"] == "email"
    assert detail["provider_label"] == "Email"
    assert db_session.query(User).count() == 1


def test_email_match_is_case_insensitive(client, db_session, monkeypatch):
    """A mixed-case legacy row must still be found, or it would be duplicated."""
    _make_user(db_session, email="MiXeD@test.local", provider=AuthProvider.EMAIL)
    _mock_google(monkeypatch, sub="g-3", email="mixed@test.local")

    resp = _google_login(client)

    assert resp.status_code == 409
    assert db_session.query(User).count() == 1


# ─── Rule 2: deleted account + wrong provider ───────────────────────────────

def test_deleted_google_account__email_signup__409_with_deleted_flag(
    client, db_session
):
    """Wrong-provider outranks the deletion prompt, and says so — otherwise the
    user is offered a reactivation they cannot complete on this provider."""
    _make_user(
        db_session, email="gone@test.local", provider=AuthProvider.GOOGLE,
        sub="g-gone", is_active=False,
    )

    resp = _email_register_start(client, "gone@test.local")

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["provider"] == "google"
    assert detail["deleted"] is True


def test_deleted_google_account__google_login__still_403_account_deleted(
    client, db_session, monkeypatch
):
    _make_user(
        db_session, email="back@test.local", provider=AuthProvider.GOOGLE,
        sub="g-back", is_active=False,
    )
    _mock_google(monkeypatch, sub="g-back", email="back@test.local")

    resp = _google_login(client)

    assert resp.status_code == 403
    assert resp.json()["detail"] == "account_deleted"


def test_deleted_google_account__google_login_reactivates(
    client, db_session, monkeypatch
):
    user = _make_user(
        db_session, email="revive@test.local", provider=AuthProvider.GOOGLE,
        sub="g-revive", is_active=False, plan=PlanTier.PRO,
    )
    _mock_google(monkeypatch, sub="g-revive", email="revive@test.local")

    resp = _google_login(client, reactivate=True)

    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.is_active is True
    # Reactivation is always as a FREE user.
    assert user.plan is PlanTier.FREE


# ─── Google regression: nothing about the existing flow changed ─────────────

def test_google_signup__still_works_and_reports_provider(client, db_session, monkeypatch):
    _mock_google(monkeypatch, sub="g-new", email="newgoogle@test.local", name="Grace")

    resp = _google_login(client)

    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["auth_provider"] == "google"
    user = db_session.query(User).filter_by(email="newgoogle@test.local").one()
    assert user.google_id == "g-new"
    assert user.password_hash is None
    assert user.auth_provider is AuthProvider.GOOGLE


def test_google_relogin__same_account_no_duplicate(client, db_session, monkeypatch):
    _mock_google(monkeypatch, sub="g-rep", email="repeat@test.local")

    first = _google_login(client)
    second = _google_login(client)

    assert first.status_code == second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert db_session.query(User).filter_by(email="repeat@test.local").count() == 1


def test_google_relogin__refreshes_name_from_the_provider(
    client, db_session, monkeypatch
):
    """Google sends name and picture on every sign-in and is authoritative for
    them, so a changed profile name lands on the row."""
    user = _make_user(
        db_session, email="renamed@test.local", provider=AuthProvider.GOOGLE, sub="g-rename"
    )
    _mock_google(monkeypatch, sub="g-rename", email="renamed@test.local", name="New Name")

    assert _google_login(client).status_code == 200

    db_session.refresh(user)
    assert user.name == "New Name"


def test_same_provider_new_subject_id__rebinds_instead_of_duplicating(
    client, db_session, monkeypatch
):
    """A re-issued Google subject for a known email adopts the new id."""
    existing = _make_user(
        db_session, email="reissue@test.local", provider=AuthProvider.GOOGLE, sub="g-old"
    )
    _mock_google(monkeypatch, sub="g-brand-new", email="reissue@test.local")

    resp = _google_login(client)

    assert resp.status_code == 200
    db_session.refresh(existing)
    assert existing.google_id == "g-brand-new"
    assert db_session.query(User).filter_by(email="reissue@test.local").count() == 1


# ─── Removed providers ──────────────────────────────────────────────────────

@pytest.mark.parametrize("path", ["/api/auth/apple", "/api/auth/microsoft"])
def test_removed_provider_routes_are_gone(client, path):
    """Apple and Microsoft sign-in were removed; their routes must not linger."""
    resp = client.post(path, json={"identity_token": "tok", "id_token": "tok"})

    assert resp.status_code == 404


@pytest.mark.parametrize("value", ["apple", "microsoft"])
def test_removed_providers_are_not_valid_auth_provider_values(value):
    """The enum coerces on load, so a legacy row fails loudly rather than
    silently degrading to a bare string."""
    with pytest.raises(ValueError):
        AuthProvider(value)


# ─── Concurrency ────────────────────────────────────────────────────────────

def test_concurrent_signup_race__resolves_instead_of_500(
    client, db_session, monkeypatch
):
    """An IntegrityError from a racing first-login must resolve to the winner's
    row, not surface as a raw 500."""
    from sqlalchemy.exc import IntegrityError
    import app.services.auth_identity as identity

    _mock_google(monkeypatch, sub="g-race", email="race@test.local")

    original_flush = identity.Session.flush
    state = {"raised": False}

    def _flush_once_then_fail(self, *a, **kw):
        if not state["raised"]:
            state["raised"] = True
            # Simulate the winner having committed this row already.
            self.rollback()
            db_session.add(
                User(email="race@test.local", name="Winner",
                     google_id="g-race", auth_provider=AuthProvider.GOOGLE)
            )
            db_session.commit()
            raise IntegrityError("dup", None, Exception("unique"))
        return original_flush(self, *a, **kw)

    monkeypatch.setattr(identity.Session, "flush", _flush_once_then_fail, raising=True)

    resp = _google_login(client)

    assert resp.status_code == 200
    assert db_session.query(User).filter_by(email="race@test.local").count() == 1
