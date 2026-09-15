"""
Depth tier — multi-provider identity rules (Google + Apple + Microsoft).

The invariant under test: one account per email, forever, bound for life to the
provider that created it. A second provider presenting a known email is always
rejected (409 wrong_auth_provider) — never linked, never duplicated — and that
rejection outranks the soft-delete/reactivation prompt.
"""
import pytest

import app.routers.auth as auth_router
from app.models.user import AuthProvider, PlanTier, User
from app.services.apple_auth import AppleAuthError, AppleIdentity
from app.services.microsoft_auth import (
    MicrosoftAuthError,
    MicrosoftIdentity,
    MicrosoftNoEmailError,
)

pytestmark = pytest.mark.depth


# ─── Helpers ────────────────────────────────────────────────────────────────

def _mock_google(monkeypatch, *, sub, email, name="Google User"):
    monkeypatch.setattr(
        auth_router.id_token, "verify_oauth2_token",
        lambda *a, **k: {"sub": sub, "email": email, "name": name, "picture": None},
        raising=True,
    )


def _mock_apple(monkeypatch, *, sub, email, private=False):
    monkeypatch.setattr(
        auth_router, "verify_apple_identity_token",
        lambda *a, **k: AppleIdentity(
            apple_id=sub, email=email, email_verified=True, is_private_email=private
        ),
        raising=True,
    )


def _mock_microsoft(monkeypatch, *, oid, email, name="Microsoft User"):
    monkeypatch.setattr(
        auth_router, "verify_microsoft_id_token",
        lambda *a, **k: MicrosoftIdentity(
            microsoft_id=oid, email=email, name=name, tenant_id="tenant-1"
        ),
        raising=True,
    )


def _google_login(client, **params):
    return client.post("/api/auth/google", json={"credential": "tok"}, params=params)


def _apple_login(client, user=None, **params):
    body = {"identity_token": "tok"}
    if user is not None:
        body["user"] = user
    return client.post("/api/auth/apple", json=body, params=params)


def _microsoft_login(client, **params):
    return client.post("/api/auth/microsoft", json={"id_token": "tok"}, params=params)


# Mirrors auth_identity._PROVIDER_ID_COLUMN — kept explicit so a new provider
# fails here loudly rather than silently writing the wrong column.
_ID_COLUMN = {
    AuthProvider.GOOGLE: "google_id",
    AuthProvider.APPLE: "apple_id",
    AuthProvider.MICROSOFT: "microsoft_id",
}


def _make_user(db, *, email, provider, sub, **kw):
    user = User(
        email=email, name="Existing", auth_provider=provider,
        plan=kw.pop("plan", PlanTier.FREE), **{_ID_COLUMN[provider]: sub}, **kw,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ─── Rule 3: an email never yields a second account ─────────────────────────

def test_google_account__apple_login_same_email__409_and_no_new_account(
    client, db_session, monkeypatch
):
    existing = _make_user(
        db_session, email="dup@test.local", provider=AuthProvider.GOOGLE, sub="g-1"
    )
    _mock_apple(monkeypatch, sub="a-1", email="dup@test.local")

    resp = _apple_login(client)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["code"] == "wrong_auth_provider"
    assert detail["provider"] == "google"
    assert detail["provider_label"] == "Google"
    assert detail["deleted"] is False

    # No second account, and the existing row is untouched.
    assert db_session.query(User).filter_by(email="dup@test.local").count() == 1
    db_session.refresh(existing)
    assert existing.google_id == "g-1"
    assert existing.apple_id is None
    assert existing.auth_provider is AuthProvider.GOOGLE


def test_apple_account__google_login_same_email__409(client, db_session, monkeypatch):
    existing = _make_user(
        db_session, email="dup2@test.local", provider=AuthProvider.APPLE, sub="a-2"
    )
    _mock_google(monkeypatch, sub="g-2", email="dup2@test.local")

    resp = _google_login(client)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["provider"] == "apple"
    assert detail["provider_label"] == "Apple"

    # The pre-existing bug this guards: google_id must NOT be overwritten.
    db_session.refresh(existing)
    assert existing.google_id is None
    assert existing.apple_id == "a-2"
    assert db_session.query(User).filter_by(email="dup2@test.local").count() == 1


def test_email_match_is_case_insensitive(client, db_session, monkeypatch):
    """A mixed-case legacy row must still be found, or it would be duplicated."""
    _make_user(db_session, email="MiXeD@test.local", provider=AuthProvider.GOOGLE, sub="g-3")
    _mock_apple(monkeypatch, sub="a-3", email="mixed@test.local")

    resp = _apple_login(client)

    assert resp.status_code == 409
    assert db_session.query(User).count() == 1


# ─── Rule 2: deleted account + wrong provider ───────────────────────────────

def test_deleted_google_account__apple_login__409_with_deleted_flag(
    client, db_session, monkeypatch
):
    """Wrong-provider outranks account_deleted, and says so via deleted=True."""
    _make_user(
        db_session, email="gone@test.local", provider=AuthProvider.GOOGLE,
        sub="g-4", is_active=False,
    )
    _mock_apple(monkeypatch, sub="a-4", email="gone@test.local")

    resp = _apple_login(client)

    assert resp.status_code == 409  # NOT 403 account_deleted
    detail = resp.json()["detail"]
    assert detail["code"] == "wrong_auth_provider"
    assert detail["provider"] == "google"
    assert detail["deleted"] is True


def test_deleted_google_account__google_login__still_403_account_deleted(
    client, db_session, monkeypatch
):
    """The correct provider keeps the existing reactivation flow."""
    _make_user(
        db_session, email="gone2@test.local", provider=AuthProvider.GOOGLE,
        sub="g-5", is_active=False,
    )
    _mock_google(monkeypatch, sub="g-5", email="gone2@test.local")

    assert _google_login(client).status_code == 403
    assert _google_login(client).json()["detail"] == "account_deleted"

    resp = _google_login(client, reactivate="true")
    assert resp.status_code == 200
    assert resp.json()["user"]["auth_provider"] == "google"


def test_deleted_apple_account__apple_login_reactivates(client, db_session, monkeypatch):
    user = _make_user(
        db_session, email="gone3@test.local", provider=AuthProvider.APPLE,
        sub="a-5", is_active=False, plan=PlanTier.PRO,
    )
    _mock_apple(monkeypatch, sub="a-5", email="gone3@test.local")

    assert _apple_login(client).status_code == 403
    resp = _apple_login(client, reactivate="true")

    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.is_active is True
    assert user.plan == PlanTier.FREE


# ─── Apple sign-up specifics ────────────────────────────────────────────────

def test_apple_signup__creates_apple_bound_account(client, db_session, monkeypatch):
    _mock_apple(monkeypatch, sub="a-new", email="fresh@test.local")

    resp = _apple_login(client, user={"name": {"firstName": "Ada", "lastName": "Lovelace"}})

    assert resp.status_code == 200
    assert resp.json()["user"]["auth_provider"] == "apple"
    user = db_session.query(User).filter_by(email="fresh@test.local").one()
    assert user.auth_provider is AuthProvider.APPLE
    assert user.apple_id == "a-new"
    assert user.google_id is None
    assert user.name == "Ada Lovelace"


def test_apple_relogin__does_not_clobber_name_with_email_stub(
    client, db_session, monkeypatch
):
    """Apple sends the name only on first authorization; later logins must not
    overwrite it with the email-derived placeholder."""
    _mock_apple(monkeypatch, sub="a-name", email="ada@test.local")
    _apple_login(client, user={"name": {"firstName": "Ada", "lastName": "Lovelace"}})

    _apple_login(client)  # second sign-in: no user payload

    user = db_session.query(User).filter_by(email="ada@test.local").one()
    assert user.name == "Ada Lovelace"


def test_apple_private_relay_email__rejected_and_no_account(
    client, db_session, monkeypatch
):
    _mock_apple(
        monkeypatch, sub="a-priv",
        email="abc123@privaterelay.appleid.com", private=True,
    )

    resp = _apple_login(client)

    assert resp.status_code == 400
    assert resp.json()["detail"] == "apple_private_email"
    assert db_session.query(User).count() == 0


def test_apple_invalid_token__401(client, monkeypatch):
    def _boom(*a, **k):
        raise AppleAuthError("Invalid Apple token: signature mismatch")

    monkeypatch.setattr(auth_router, "verify_apple_identity_token", _boom, raising=True)

    assert _apple_login(client).status_code == 401


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
    assert user.apple_id is None
    assert user.auth_provider is AuthProvider.GOOGLE


def test_google_relogin__same_account_no_duplicate(client, db_session, monkeypatch):
    _mock_google(monkeypatch, sub="g-rep", email="repeat@test.local")

    first = _google_login(client)
    second = _google_login(client)

    assert first.status_code == second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert db_session.query(User).filter_by(email="repeat@test.local").count() == 1


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


# ─── Microsoft ──────────────────────────────────────────────────────────────

def test_microsoft_signup__creates_microsoft_bound_account(
    client, db_session, monkeypatch
):
    _mock_microsoft(monkeypatch, oid="ms-new", email="new@outlook.com", name="Grace H")

    resp = _microsoft_login(client)

    assert resp.status_code == 200
    assert resp.json()["user"]["auth_provider"] == "microsoft"
    user = db_session.query(User).filter_by(email="new@outlook.com").one()
    assert user.auth_provider is AuthProvider.MICROSOFT
    assert user.microsoft_id == "ms-new"
    assert user.google_id is None
    assert user.apple_id is None
    assert user.name == "Grace H"


def test_google_account__microsoft_login_same_email__409_and_no_new_account(
    client, db_session, monkeypatch
):
    existing = _make_user(
        db_session, email="dup-ms@test.local", provider=AuthProvider.GOOGLE, sub="g-ms"
    )
    _mock_microsoft(monkeypatch, oid="ms-1", email="dup-ms@test.local")

    resp = _microsoft_login(client)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["code"] == "wrong_auth_provider"
    assert detail["provider"] == "google"
    assert detail["provider_label"] == "Google"
    assert detail["deleted"] is False

    assert db_session.query(User).filter_by(email="dup-ms@test.local").count() == 1
    db_session.refresh(existing)
    assert existing.google_id == "g-ms"
    assert existing.microsoft_id is None


def test_microsoft_account__google_login_same_email__409_labels_microsoft(
    client, db_session, monkeypatch
):
    """Guards the AuthProvider.label mapping.

    A two-way ternary would mislabel Microsoft as "Apple" here, telling the user
    to sign in with a provider that does not own their account.
    """
    existing = _make_user(
        db_session, email="ms-owner@test.local", provider=AuthProvider.MICROSOFT, sub="ms-2"
    )
    _mock_google(monkeypatch, sub="g-2b", email="ms-owner@test.local")

    resp = _google_login(client)

    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["provider"] == "microsoft"
    assert detail["provider_label"] == "Microsoft"

    db_session.refresh(existing)
    assert existing.google_id is None
    assert existing.microsoft_id == "ms-2"


def test_microsoft_and_apple__reject_each_other(client, db_session, monkeypatch):
    _make_user(
        db_session, email="cross@test.local", provider=AuthProvider.APPLE, sub="a-x"
    )
    _mock_microsoft(monkeypatch, oid="ms-x", email="cross@test.local")
    resp = _microsoft_login(client)
    assert resp.status_code == 409
    assert resp.json()["detail"]["provider_label"] == "Apple"

    _make_user(
        db_session, email="cross2@test.local", provider=AuthProvider.MICROSOFT, sub="ms-y"
    )
    _mock_apple(monkeypatch, sub="a-y", email="cross2@test.local")
    resp = _apple_login(client)
    assert resp.status_code == 409
    assert resp.json()["detail"]["provider_label"] == "Microsoft"


def test_deleted_google_account__microsoft_login__409_with_deleted_flag(
    client, db_session, monkeypatch
):
    """Wrong-provider outranks account_deleted, for the new provider too."""
    _make_user(
        db_session, email="gone-ms@test.local", provider=AuthProvider.GOOGLE,
        sub="g-gone-ms", is_active=False,
    )
    _mock_microsoft(monkeypatch, oid="ms-gone", email="gone-ms@test.local")

    resp = _microsoft_login(client)

    assert resp.status_code == 409  # NOT 403 account_deleted
    detail = resp.json()["detail"]
    assert detail["provider"] == "google"
    assert detail["deleted"] is True


def test_deleted_microsoft_account__microsoft_login_reactivates(
    client, db_session, monkeypatch
):
    user = _make_user(
        db_session, email="ms-dead@test.local", provider=AuthProvider.MICROSOFT,
        sub="ms-dead", is_active=False, plan=PlanTier.PRO,
    )
    _mock_microsoft(monkeypatch, oid="ms-dead", email="ms-dead@test.local")

    assert _microsoft_login(client).status_code == 403
    resp = _microsoft_login(client, reactivate="true")

    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.is_active is True
    assert user.plan == PlanTier.FREE


def test_microsoft_relogin__same_account_no_duplicate(client, db_session, monkeypatch):
    _mock_microsoft(monkeypatch, oid="ms-rep", email="repeat-ms@test.local")

    first = _microsoft_login(client)
    second = _microsoft_login(client)

    assert first.status_code == second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert db_session.query(User).filter_by(email="repeat-ms@test.local").count() == 1


def test_microsoft_no_email__400_and_no_account(client, db_session, monkeypatch):
    def _boom(*a, **k):
        raise MicrosoftNoEmailError("Email not provided by Microsoft")

    monkeypatch.setattr(auth_router, "verify_microsoft_id_token", _boom, raising=True)

    resp = _microsoft_login(client)

    assert resp.status_code == 400
    assert resp.json()["detail"] == "microsoft_no_email"
    assert db_session.query(User).count() == 0


def test_microsoft_invalid_token__401(client, monkeypatch):
    def _boom(*a, **k):
        raise MicrosoftAuthError("Invalid Microsoft token: signature mismatch")

    monkeypatch.setattr(auth_router, "verify_microsoft_id_token", _boom, raising=True)

    assert _microsoft_login(client).status_code == 401


# ─── Microsoft token verification (claim handling) ──────────────────────────
# These exercise microsoft_auth directly rather than through the router, since
# the router tests mock verification out.

def _ms_claims(**over):
    base = {
        "oid": "oid-1", "sub": "sub-1", "tid": "tenant-1",
        "iss": "https://login.microsoftonline.com/tenant-1/v2.0",
        "aud": "test-client", "exp": 9999999999,
        "email": "person@outlook.com", "name": "A Person",
    }
    base.update(over)
    return base


def _verify_with(monkeypatch, claims, client_id="test-client"):
    """Drive verify_microsoft_id_token with decode/JWKS stubbed out."""
    import app.services.microsoft_auth as ms
    from app.config import settings

    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", client_id, raising=False)
    monkeypatch.setattr(ms, "_signing_key_for", lambda *a, **k: type("K", (), {"key": "k"})(), raising=True)
    monkeypatch.setattr(ms.jwt, "decode", lambda *a, **k: claims, raising=True)
    return ms.verify_microsoft_id_token("tok")


def test_verify__prefers_oid_over_sub(monkeypatch):
    identity = _verify_with(monkeypatch, _ms_claims())
    # `sub` is pairwise per-app and changes if the registration is recreated.
    assert identity.microsoft_id == "oid-1"


def test_verify__falls_back_to_sub_when_oid_absent(monkeypatch):
    claims = _ms_claims()
    del claims["oid"]
    assert _verify_with(monkeypatch, claims).microsoft_id == "sub-1"


def test_verify__issuer_must_match_token_tenant(monkeypatch):
    # Well-formed token from an unrelated tenant: iss and tid disagree.
    claims = _ms_claims(iss="https://login.microsoftonline.com/other-tenant/v2.0")
    with pytest.raises(MicrosoftAuthError, match="issuer"):
        _verify_with(monkeypatch, claims)


def test_verify__org_tenant_issuer_accepted(monkeypatch):
    # Any tenant is fine as long as iss matches that tenant — this is what
    # makes work/school accounts work under the "common" endpoint.
    claims = _ms_claims(tid="contoso", iss="https://login.microsoftonline.com/contoso/v2.0")
    assert _verify_with(monkeypatch, claims).tenant_id == "contoso"


def test_verify__uses_preferred_username_when_email_missing(monkeypatch):
    claims = _ms_claims(preferred_username="Work.User@contoso.com")
    del claims["email"]
    assert _verify_with(monkeypatch, claims).email == "work.user@contoso.com"


def test_verify__rejects_non_email_upn(monkeypatch):
    # A UPN that isn't email-shaped is not a deliverable address.
    claims = _ms_claims(preferred_username="DOMAIN\\user")
    del claims["email"]
    with pytest.raises(MicrosoftNoEmailError):
        _verify_with(monkeypatch, claims)


def test_verify__rejects_when_no_email_claims_at_all(monkeypatch):
    claims = _ms_claims()
    del claims["email"]
    with pytest.raises(MicrosoftNoEmailError):
        _verify_with(monkeypatch, claims)


def test_verify__unconfigured_client_id_fails_closed(monkeypatch):
    with pytest.raises(MicrosoftAuthError, match="not configured"):
        _verify_with(monkeypatch, _ms_claims(), client_id="")
