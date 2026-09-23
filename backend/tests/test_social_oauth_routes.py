"""Depth tier — social publishing OAuth connect/callback/disconnect.

Two things here are security regression tests rather than behaviour tests, and
should not be relaxed:

* the popup callback must never postMessage to "*" — the message carries the
  connected account's identity;
* the signed state must never authenticate as the user. ``get_current_user``
  accepts any JWT signed with JWT_SECRET that carries a ``sub`` claim, without
  checking ``typ`` — so the state deliberately stores the id in ``uid``. A state
  token appears in URLs, history and referrer headers; if it carried ``sub`` each
  of those would be a usable API credential.
"""
import datetime as dt

import jwt
import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.models.social_connection import (
    PLATFORM_LINKEDIN,
    PLATFORM_X,
    PLATFORM_YOUTUBE,
    STATUS_ACTIVE,
    SocialConnection,
)
from app.services import social_oauth, token_crypto

pytestmark = pytest.mark.depth

BACKEND = "https://api.test.local"
FRONTEND = "https://app.test.local"


@pytest.fixture()
def configured(monkeypatch):
    """YouTube fully configured; X and LinkedIn deliberately left off (the flags)."""
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_ID", "yt-client-id")
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_SECRET", "yt-client-secret")
    monkeypatch.setattr(settings, "X_CLIENT_ID", "")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "")
    monkeypatch.setattr(settings, "BACKEND_URL", BACKEND)
    monkeypatch.setattr(settings, "FRONTEND_URL", FRONTEND)
    token_crypto.reset_cache()
    yield
    token_crypto.reset_cache()


@pytest.fixture()
def linkedin_configured(monkeypatch, configured):
    """LinkedIn on top of `configured` — both halves, since it is confidential."""
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "li-client-id")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "li-client-secret")
    yield


@pytest.fixture()
def unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", "")
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "X_CLIENT_ID", "")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "")
    token_crypto.reset_cache()
    yield
    token_crypto.reset_cache()


# ─── Capability reporting ───────────────────────────────────────────────────

def test_config_reports_disabled_when_unconfigured(client, unconfigured):
    body = client.get("/api/integrations/config").json()
    assert body == {
        "youtube_enabled": False,
        "x_enabled": False,
        "linkedin_enabled": False,
    }


def test_config_reports_youtube_only_when_x_flag_is_off(client, configured):
    body = client.get("/api/integrations/config").json()
    assert body["youtube_enabled"] is True
    assert body["x_enabled"] is False


def test_x_enables_purely_from_client_id(client, configured, monkeypatch):
    """Turning X on is a config change, not a deploy."""
    monkeypatch.setattr(settings, "X_CLIENT_ID", "x-client-id")
    assert client.get("/api/integrations/config").json()["x_enabled"] is True


def test_linkedin_enables_from_client_id_and_secret(client, linkedin_configured):
    assert client.get("/api/integrations/config").json()["linkedin_enabled"] is True


def test_linkedin_stays_off_without_a_secret(client, configured, monkeypatch):
    """Unlike X's public PKCE client, LinkedIn is confidential — an id alone is
    not enough to complete the token exchange, so offering it would strand users
    at the callback."""
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "li-client-id")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "")
    assert client.get("/api/integrations/config").json()["linkedin_enabled"] is False


def test_missing_encryption_key_disables_a_fully_configured_platform(
    client, configured, monkeypatch
):
    """Client credentials are not enough — tokens must be storable."""
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", "")
    token_crypto.reset_cache()
    assert client.get("/api/integrations/config").json()["youtube_enabled"] is False


# ─── Auth gating ────────────────────────────────────────────────────────────

def test_connect_url_requires_auth(client, configured):
    assert client.get("/api/integrations/youtube/connect-url").status_code == 401


def test_connections_requires_auth(client, configured):
    assert client.get("/api/integrations/connections").status_code == 401


def test_unknown_platform_is_404(client, configured, free_user, auth):
    resp = client.get("/api/integrations/tiktok/connect-url", headers=auth(free_user))
    assert resp.status_code == 404


def test_connect_url_503_when_platform_unconfigured(client, unconfigured, free_user, auth):
    resp = client.get("/api/integrations/youtube/connect-url", headers=auth(free_user))
    assert resp.status_code == 503


def test_disabled_x_refuses_connect(client, configured, free_user, auth):
    resp = client.get("/api/integrations/x/connect-url", headers=auth(free_user))
    assert resp.status_code == 503


# ─── Authorize URL shape ────────────────────────────────────────────────────

def test_youtube_authorize_url_requests_a_refresh_token(client, configured, free_user, auth):
    """offline + consent are what make Google issue a refresh token.

    Without prompt=consent Google returns one only on a user's first-ever grant,
    so anyone who disconnects and reconnects would end up with a connection that
    silently dies an hour later.
    """
    resp = client.get("/api/integrations/youtube/connect-url", headers=auth(free_user))
    url = resp.json()["authorize_url"]

    assert resp.status_code == 200
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "youtube.upload" in url
    assert f"{BACKEND}/api/integrations/youtube/callback" in url.replace("%3A", ":").replace("%2F", "/")


def test_x_authorize_url_uses_s256_pkce(client, configured, free_user, auth, monkeypatch):
    import base64
    import hashlib
    from urllib.parse import parse_qs, urlparse

    monkeypatch.setattr(settings, "X_CLIENT_ID", "x-client-id")
    resp = client.get("/api/integrations/x/connect-url", headers=auth(free_user))
    params = parse_qs(urlparse(resp.json()["authorize_url"]).query)

    assert params["code_challenge_method"] == ["S256"]
    assert "offline.access" in params["scope"][0]
    assert "media.write" in params["scope"][0]

    # The challenge must be the real S256 of the verifier carried in the state.
    state = jwt.decode(
        params["state"][0], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    expected = base64.urlsafe_b64encode(
        hashlib.sha256(state["cv"].encode()).digest()
    ).decode().rstrip("=")
    assert params["code_challenge"] == [expected]


def test_linkedin_authorize_url_shape(client, linkedin_configured, free_user, auth):
    from urllib.parse import parse_qs, urlparse

    resp = client.get("/api/integrations/linkedin/connect-url", headers=auth(free_user))
    assert resp.status_code == 200
    params = parse_qs(urlparse(resp.json()["authorize_url"]).query)

    assert params["response_type"] == ["code"]
    assert params["client_id"] == ["li-client-id"]
    assert params["redirect_uri"] == [f"{BACKEND}/api/integrations/linkedin/callback"]
    assert "w_member_social" in params["scope"][0]


def test_linkedin_authorize_url_uses_no_pkce(client, linkedin_configured, free_user, auth):
    """LinkedIn's confidential flow is plain RFC 6749.

    Guards against someone 'fixing' LinkedIn by copying X's branch: the secret is
    what authenticates the exchange, and a code_challenge with no verifier stored
    would break the callback.
    """
    from urllib.parse import parse_qs, urlparse

    resp = client.get("/api/integrations/linkedin/connect-url", headers=auth(free_user))
    params = parse_qs(urlparse(resp.json()["authorize_url"]).query)

    assert "code_challenge" not in params
    assert "code_challenge_method" not in params
    state = jwt.decode(
        params["state"][0], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert "cv" not in state


def test_linkedin_never_requests_organization_scopes(
    client, linkedin_configured, free_user, auth
):
    """The approval-risk regression test.

    w_organization_social belongs to the Community Management API, which LinkedIn
    grants only after a manual review. Requesting an unapproved scope makes
    LinkedIn reject the ENTIRE authorize request — so adding it here would take
    personal posting down with it for every user.
    """
    resp = client.get("/api/integrations/linkedin/connect-url", headers=auth(free_user))
    url = resp.json()["authorize_url"]

    assert "w_organization_social" not in url
    assert "r_organization_admin" not in url


def test_disabled_linkedin_refuses_connect(client, configured, free_user, auth):
    resp = client.get("/api/integrations/linkedin/connect-url", headers=auth(free_user))
    assert resp.status_code == 503


def test_build_authorize_url_rejects_an_unknown_platform(configured, free_user, monkeypatch):
    """Regression: build_authorize_url used to fall through to X.

    A platform present in SUPPORTED_PLATFORMS but with no branch of its own would
    silently receive X's authorize URL — sending users to consent to the wrong
    provider entirely. It must raise instead.
    """
    monkeypatch.setattr(
        social_oauth, "SUPPORTED_PLATFORMS", social_oauth.SUPPORTED_PLATFORMS + ("tiktok",)
    )
    monkeypatch.setattr(social_oauth, "platform_enabled", lambda p: True)

    with pytest.raises(social_oauth.OAuthConfigError):
        social_oauth.build_authorize_url("tiktok", free_user.id)


def test_the_callback_rejects_an_unknown_platform_instead_of_treating_it_as_x(
    client, configured, free_user, monkeypatch
):
    """Regression: oauth_callback's `else` branch used to mean 'X'.

    An unknown platform reaching the callback must render the error page, not
    exchange the code against X's token endpoint.
    """
    monkeypatch.setattr(
        social_oauth, "SUPPORTED_PLATFORMS", social_oauth.SUPPORTED_PLATFORMS + ("tiktok",)
    )
    monkeypatch.setattr(social_oauth, "platform_enabled", lambda p: True)
    state = social_oauth.build_state(free_user.id, "tiktok")

    resp = client.get(
        "/api/integrations/tiktok/callback", params={"code": "abc", "state": state}
    )
    assert resp.status_code == 200
    assert "ok: false" in resp.text


# ─── State token security ───────────────────────────────────────────────────

def test_state_token_cannot_authenticate_api_calls(client, configured, free_user):
    """SECURITY REGRESSION: the state must not work as a bearer token.

    get_current_user does not inspect `typ`, so this holds only because the
    state stores the user id in `uid` rather than `sub`.
    """
    state = social_oauth.build_state(free_user.id, PLATFORM_YOUTUBE)

    resp = client.get(
        "/api/integrations/connections", headers={"Authorization": f"Bearer {state}"}
    )

    assert resp.status_code == 401


def test_state_token_carries_no_sub_claim(configured, free_user):
    payload = jwt.decode(
        social_oauth.build_state(free_user.id, PLATFORM_YOUTUBE),
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    assert "sub" not in payload
    assert payload["uid"] == free_user.id


def test_state_is_rejected_for_a_different_platform(configured, free_user):
    state = social_oauth.build_state(free_user.id, PLATFORM_YOUTUBE)
    with pytest.raises(social_oauth.OAuthStateError):
        social_oauth.parse_state(state, PLATFORM_X)


def test_expired_state_is_rejected(configured, free_user):
    payload = jwt.decode(
        social_oauth.build_state(free_user.id, PLATFORM_YOUTUBE),
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    payload["exp"] = dt.datetime.utcnow() - dt.timedelta(minutes=1)
    expired = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(social_oauth.OAuthStateError):
        social_oauth.parse_state(expired, PLATFORM_YOUTUBE)


def test_state_signed_with_another_secret_is_rejected(configured, free_user):
    forged = jwt.encode(
        {"uid": free_user.id, "platform": PLATFORM_YOUTUBE, "typ": "social_oauth_state"},
        "attacker-secret",
        algorithm="HS256",
    )
    with pytest.raises(social_oauth.OAuthStateError):
        social_oauth.parse_state(forged, PLATFORM_YOUTUBE)


# ─── Callback ───────────────────────────────────────────────────────────────

def test_callback_never_uses_a_wildcard_post_message_origin(client, configured):
    """SECURITY REGRESSION: "*" would leak the account identity to any opener."""
    resp = client.get(
        "/api/integrations/youtube/callback", params={"code": "c", "state": "garbage"}
    )

    assert "postMessage" in resp.text
    assert "'*'" not in resp.text
    assert '"*"' not in resp.text
    assert FRONTEND in resp.text


def test_callback_renders_html_for_a_tampered_state(client, configured):
    """A popup must never be shown a raw JSON error it cannot recover from."""
    resp = client.get(
        "/api/integrations/youtube/callback", params={"code": "c", "state": "garbage"}
    )

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert "ok: false" in resp.text


def test_callback_reports_user_cancellation_gently(client, configured):
    resp = client.get(
        "/api/integrations/youtube/callback", params={"error": "access_denied"}
    )

    assert resp.status_code == 200
    assert "cancelled" in resp.text.lower()


def test_callback_without_a_code_does_not_crash(client, configured, free_user):
    state = social_oauth.build_state(free_user.id, PLATFORM_YOUTUBE)
    resp = client.get("/api/integrations/youtube/callback", params={"state": state})

    assert resp.status_code == 200
    assert "ok: false" in resp.text


# ─── Connections listing + disconnect ───────────────────────────────────────

def test_connections_lists_every_platform_as_disconnected_initially(
    client, configured, free_user, auth
):
    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    assert {c["platform"] for c in body["connections"]} == set(
        social_oauth.SUPPORTED_PLATFORMS
    )
    assert all(c["connected"] is False for c in body["connections"])


def test_connections_never_leaks_tokens(client, configured, free_user, auth, db_session):
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            access_token_enc="ciphertext-access",
            refresh_token_enc="ciphertext-refresh",
            account_name="My Channel",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    resp = client.get("/api/integrations/connections", headers=auth(free_user))

    assert "ciphertext-access" not in resp.text
    assert "ciphertext-refresh" not in resp.text
    assert "token" not in resp.text.lower()
    youtube = next(c for c in resp.json()["connections"] if c["platform"] == PLATFORM_YOUTUBE)
    assert youtube["connected"] is True
    assert youtube["account_name"] == "My Channel"


def test_a_revoked_connection_reports_as_not_connected(
    client, configured, free_user, auth, db_session
):
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            account_name="Stale Channel",
            status="revoked",
        )
    )
    db_session.commit()

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    youtube = next(c for c in body["connections"] if c["platform"] == PLATFORM_YOUTUBE)

    assert youtube["connected"] is False
    assert youtube["status"] == "revoked"


def test_missing_upload_scope_is_reported(client, configured, free_user, auth, db_session):
    """Surfaced before the user fills in an upload form, not after it fails."""
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            scopes="https://www.googleapis.com/auth/youtube.readonly",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    youtube = next(c for c in body["connections"] if c["platform"] == PLATFORM_YOUTUBE)

    assert youtube["scopes_ok"] is False


def test_linkedin_scopes_ok_needs_only_w_member_social(
    client, linkedin_configured, free_user, auth, db_session
):
    """openid/profile only supply the display name — a grant without them still
    publishes, so demanding them would nag users over nothing."""
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_LINKEDIN,
            scopes="w_member_social",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    linkedin = next(c for c in body["connections"] if c["platform"] == PLATFORM_LINKEDIN)

    assert linkedin["scopes_ok"] is True


def test_linkedin_scopes_ok_with_comma_delimited_grant(
    client, linkedin_configured, free_user, auth, db_session
):
    """LinkedIn returns `scope` comma-delimited, not space-delimited as RFC 6749
    specifies. Splitting on whitespace alone left the whole string as one token,
    so a perfectly good grant looked like it was missing w_member_social and the
    publish modal demanded a reconnect that could never fix it."""
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_LINKEDIN,
            scopes="openid,profile,w_member_social",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    linkedin = next(c for c in body["connections"] if c["platform"] == PLATFORM_LINKEDIN)

    assert linkedin["scopes_ok"] is True


def test_linkedin_scopes_not_ok_when_comma_grant_lacks_posting(
    client, linkedin_configured, free_user, auth, db_session
):
    """The comma fix must not turn the check into a rubber stamp: a sign-in-only
    grant genuinely cannot post and still has to ask for a reconnect."""
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_LINKEDIN,
            scopes="openid,profile",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    linkedin = next(c for c in body["connections"] if c["platform"] == PLATFORM_LINKEDIN)

    assert linkedin["scopes_ok"] is False


# ─── Expiry nudge ───────────────────────────────────────────────────────────

def _add_conn(db, user, platform, *, expires_in_days, refresh_token_enc=None):
    db.add(
        SocialConnection(
            user_id=user.id,
            platform=platform,
            status=STATUS_ACTIVE,
            refresh_token_enc=refresh_token_enc,
            token_expires_at=dt.datetime.utcnow() + dt.timedelta(days=expires_in_days),
        )
    )
    db.commit()


def test_a_soon_expiring_unrefreshable_connection_is_flagged(
    client, linkedin_configured, free_user, auth, db_session
):
    """LinkedIn's 60-day tokens mostly cannot be refreshed, so the user has to
    reconnect by hand — better prompted than discovered mid-upload."""
    _add_conn(db_session, free_user, PLATFORM_LINKEDIN, expires_in_days=2)

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    linkedin = next(c for c in body["connections"] if c["platform"] == PLATFORM_LINKEDIN)

    assert linkedin["expires_soon"] is True


def test_a_connection_with_a_refresh_token_never_nags(
    client, linkedin_configured, free_user, auth, db_session
):
    """We can renew it ourselves, so its expiry is not the user's problem.
    This is what keeps YouTube and X out of the nudge entirely."""
    _add_conn(
        db_session, free_user, PLATFORM_LINKEDIN,
        expires_in_days=1, refresh_token_enc="ciphertext",
    )

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    linkedin = next(c for c in body["connections"] if c["platform"] == PLATFORM_LINKEDIN)

    assert linkedin["expires_soon"] is False


def test_a_long_lived_connection_is_not_flagged(
    client, linkedin_configured, free_user, auth, db_session
):
    _add_conn(db_session, free_user, PLATFORM_LINKEDIN, expires_in_days=45)

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()
    linkedin = next(c for c in body["connections"] if c["platform"] == PLATFORM_LINKEDIN)

    assert linkedin["expires_soon"] is False


def test_disconnect_deletes_the_row_without_reaching_the_provider(
    client, configured, free_user, auth, db_session
):
    """An undecryptable token leaves nothing to revoke — delete locally anyway.

    The network kill-switch would raise on any real outbound call, so this also
    proves no provider request is attempted.
    """
    db_session.add(
        SocialConnection(
            user_id=free_user.id,
            platform=PLATFORM_YOUTUBE,
            refresh_token_enc="undecryptable-under-this-key",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    resp = client.request("DELETE", "/api/integrations/youtube", headers=auth(free_user))

    assert resp.status_code == 200
    assert (
        db_session.query(SocialConnection)
        .filter(SocialConnection.user_id == free_user.id)
        .count()
        == 0
    )


def test_disconnect_when_not_connected_is_a_no_op(client, configured, free_user, auth):
    resp = client.request("DELETE", "/api/integrations/youtube", headers=auth(free_user))
    assert resp.status_code == 200


def test_users_cannot_see_each_others_connections(
    client, configured, free_user, other_user, auth, db_session
):
    db_session.add(
        SocialConnection(
            user_id=other_user.id,
            platform=PLATFORM_YOUTUBE,
            account_name="Someone Else's Channel",
            status=STATUS_ACTIVE,
        )
    )
    db_session.commit()

    body = client.get("/api/integrations/connections", headers=auth(free_user)).json()

    assert all(c["connected"] is False for c in body["connections"])
    assert "Someone Else's Channel" not in str(body)
