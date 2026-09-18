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
    """YouTube fully configured; X deliberately left off (the feature flag)."""
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", Fernet.generate_key().decode())
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_ID", "yt-client-id")
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_SECRET", "yt-client-secret")
    monkeypatch.setattr(settings, "X_CLIENT_ID", "")
    monkeypatch.setattr(settings, "BACKEND_URL", BACKEND)
    monkeypatch.setattr(settings, "FRONTEND_URL", FRONTEND)
    token_crypto.reset_cache()
    yield
    token_crypto.reset_cache()


@pytest.fixture()
def unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "SOCIAL_TOKEN_ENC_KEY", "")
    monkeypatch.setattr(settings, "YOUTUBE_CLIENT_ID", "")
    monkeypatch.setattr(settings, "X_CLIENT_ID", "")
    token_crypto.reset_cache()
    yield
    token_crypto.reset_cache()


# ─── Capability reporting ───────────────────────────────────────────────────

def test_config_reports_disabled_when_unconfigured(client, unconfigured):
    body = client.get("/api/integrations/config").json()
    assert body == {"youtube_enabled": False, "x_enabled": False}


def test_config_reports_youtube_only_when_x_flag_is_off(client, configured):
    body = client.get("/api/integrations/config").json()
    assert body["youtube_enabled"] is True
    assert body["x_enabled"] is False


def test_x_enables_purely_from_client_id(client, configured, monkeypatch):
    """Turning X on is a config change, not a deploy."""
    monkeypatch.setattr(settings, "X_CLIENT_ID", "x-client-id")
    assert client.get("/api/integrations/config").json()["x_enabled"] is True


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
