"""
Depth tier — JWT revocation via users.token_version.

Our access tokens are stateless, so the only thing standing between a leaked
token and a live session is this counter. The properties under test:

1. Bumping the counter invalidates every token issued before the bump.
2. Logging out and resetting a password both bump it — the two moments a user
   expects their old sessions to die.
3. A token minted before the ``tv`` claim existed still works, so shipping this
   signs nobody out.
"""
import jwt as pyjwt
import pytest

from app.auth import create_access_token, create_refresh_token
from app.config import settings
from app.models.user import AuthProvider, PlanTier, User
from app.services import rate_limit
from app.services.password import hash_password

import app.routers.auth as auth_router

pytestmark = pytest.mark.depth

CODE = "123456"
PASSWORD = "Correct-Horse-1"


@pytest.fixture(autouse=True)
def _fixed_code(monkeypatch):
    monkeypatch.setattr(
        auth_router.verification, "generate_code", lambda: CODE, raising=True
    )
    rate_limit.reset_all_limiters()
    yield
    rate_limit.reset_all_limiters()


@pytest.fixture()
def sent(monkeypatch):
    out: list[tuple[str, str]] = []
    monkeypatch.setattr(
        auth_router.email_service, "send_password_reset_code_email",
        lambda to, code: out.append((to, code)), raising=True,
    )
    return out


def _make_email_user(db, *, email, password=PASSWORD, **kw):
    user = User(
        email=email, name="Token User", auth_provider=AuthProvider.EMAIL,
        password_hash=hash_password(password), plan=PlanTier.FREE, is_active=True, **kw,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─── The core property ──────────────────────────────────────────────────────

def test_token_is_accepted_while_the_version_matches(client, db_session):
    user = _make_email_user(db_session, email="tv1@test.local")

    token = create_access_token(user.id, user.token_version)

    assert client.get("/api/auth/me", headers=_bearer(token)).status_code == 200


def test_bumping_the_version_invalidates_an_existing_token(client, db_session):
    user = _make_email_user(db_session, email="tv2@test.local")
    token = create_access_token(user.id, user.token_version)
    assert client.get("/api/auth/me", headers=_bearer(token)).status_code == 200

    user.token_version = (user.token_version or 0) + 1
    db_session.commit()

    res = client.get("/api/auth/me", headers=_bearer(token))
    assert res.status_code == 401
    # Same body as an expired token: telling a holder of a stale token that it
    # was deliberately revoked confirms the account exists.
    assert res.json()["detail"] == "Invalid or expired token"


def test_legacy_token_without_the_claim_still_works(client, db_session):
    """A token minted before `tv` existed reads as version 0 — deploying this
    must not sign the entire userbase out."""
    user = _make_email_user(db_session, email="tv3@test.local")
    assert (user.token_version or 0) == 0

    legacy = pyjwt.encode(
        {"sub": str(user.id), "exp": 9999999999, "iat": 0, "typ": "access"},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )

    assert client.get("/api/auth/me", headers=_bearer(legacy)).status_code == 200


def test_legacy_token_dies_once_the_account_revokes_once(client, db_session):
    user = _make_email_user(db_session, email="tv4@test.local")
    legacy = pyjwt.encode(
        {"sub": str(user.id), "exp": 9999999999, "iat": 0, "typ": "access"},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )

    user.token_version = 1
    db_session.commit()

    assert client.get("/api/auth/me", headers=_bearer(legacy)).status_code == 401


def test_new_users_start_at_version_zero(client, db_session):
    user = _make_email_user(db_session, email="tv5@test.local")
    assert user.token_version == 0


# ─── Revocation triggers ────────────────────────────────────────────────────

def test_logout_revokes_the_token_it_was_called_with(client, db_session):
    user = _make_email_user(db_session, email="out@test.local")
    token = create_access_token(user.id, user.token_version)

    assert client.post("/api/auth/logout", headers=_bearer(token)).status_code == 200

    # The very token that authorized the logout is now dead — the whole point on
    # a shared machine, where the copy left behind is the threat.
    assert client.get("/api/auth/me", headers=_bearer(token)).status_code == 401
    db_session.refresh(user)
    assert user.token_version == 1


def test_password_reset_revokes_tokens_issued_under_the_old_password(
    client, db_session, sent
):
    """The reset is meant to evict whoever knew the old password."""
    user = _make_email_user(db_session, email="reset@test.local")
    stolen = create_access_token(user.id, user.token_version)
    assert client.get("/api/auth/me", headers=_bearer(stolen)).status_code == 200

    assert client.post(
        "/api/auth/password/forgot/start", json={"email": "reset@test.local"}
    ).status_code == 200
    res = client.post(
        "/api/auth/password/forgot/complete",
        json={
            "email": "reset@test.local",
            "code": CODE,
            "new_password": "Brand-New-Password1",
        },
    )
    assert res.status_code == 200

    # The attacker's token is dead...
    assert client.get("/api/auth/me", headers=_bearer(stolen)).status_code == 401
    # ...while the token handed back by the reset works, so the legitimate user
    # is not bounced out of the browser they just reset from.
    fresh = res.json()["access_token"]
    assert client.get("/api/auth/me", headers=_bearer(fresh)).status_code == 200


def test_login_issues_a_token_carrying_the_current_version(client, db_session):
    """After a revocation, signing in again must work — the new token has to be
    minted against the bumped counter, not a stale one."""
    user = _make_email_user(db_session, email="again@test.local")
    user.token_version = 7
    db_session.commit()

    res = client.post(
        "/api/auth/email/login",
        json={"email": "again@test.local", "password": PASSWORD},
    )
    assert res.status_code == 200

    token = res.json()["access_token"]
    assert client.get("/api/auth/me", headers=_bearer(token)).status_code == 200
    assert pyjwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )["tv"] == 7


def test_signup_issues_a_token_that_works(client, db_session, monkeypatch):
    monkeypatch.setattr(
        auth_router.email_service, "send_verification_code_email",
        lambda to, code: None, raising=True,
    )
    assert client.post(
        "/api/auth/email/register/start",
        json={"email": "fresh@test.local", "password": PASSWORD},
    ).status_code == 200
    res = client.post(
        "/api/auth/email/register/verify",
        json={"email": "fresh@test.local", "code": CODE},
    )

    assert res.status_code == 200
    token = res.json()["access_token"]
    assert client.get("/api/auth/me", headers=_bearer(token)).status_code == 200


# ─── MCP refresh tokens ─────────────────────────────────────────────────────

async def test_revoked_refresh_token_cannot_mint_a_new_pair(db_session, monkeypatch):
    """Otherwise revocation undoes itself: the 30-day MCP credential would
    quietly reissue past a password change."""
    from mcp.server.auth.provider import RefreshToken

    import app.services.mcp_provider as mcp_provider

    user = _make_email_user(db_session, email="mcp@test.local")
    stale = create_refresh_token(user.id, user.token_version)

    user.token_version = (user.token_version or 0) + 1
    db_session.commit()

    # The provider opens its own SessionLocal(), which under the suite's
    # rolled-back outer transaction would see an empty database. Point it at the
    # test session so it reads the row we just bumped.
    monkeypatch.setattr(
        mcp_provider, "SessionLocal", lambda: _NonClosing(db_session), raising=True
    )

    provider = mcp_provider.BlogVideoOAuthProvider()
    with pytest.raises(ValueError):
        await provider.exchange_refresh_token(
            client=None,
            refresh_token=RefreshToken(
                token=stale, client_id="c1", scopes=[], expires_at=9999999999
            ),
            scopes=[],
        )


async def test_current_refresh_token_still_mints_a_new_pair(db_session, monkeypatch):
    """The guard must not break ordinary refreshes — claude.ai renews on a timer,
    so a false rejection here silently disconnects the integration."""
    from mcp.server.auth.provider import RefreshToken

    import app.services.mcp_provider as mcp_provider

    user = _make_email_user(db_session, email="mcp-ok@test.local")
    good = create_refresh_token(user.id, user.token_version)

    monkeypatch.setattr(
        mcp_provider, "SessionLocal", lambda: _NonClosing(db_session), raising=True
    )

    provider = mcp_provider.BlogVideoOAuthProvider()
    out = await provider.exchange_refresh_token(
        client=None,
        refresh_token=RefreshToken(
            token=good, client_id="c1", scopes=[], expires_at=9999999999
        ),
        scopes=[],
    )
    assert out.access_token and out.refresh_token


class _NonClosing:
    """Wrap the test session so provider code calling .close() doesn't end it."""

    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass
