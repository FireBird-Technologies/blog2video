"""
Group 2 — Authenticated simple reads.

Each route here requires a valid Bearer token and returns data scoped to the
caller. Tests assert three things:
  - valid token   -> 200 + correct response shape
  - no token      -> 401 "Not authenticated". (Verified at runtime: the app
                    remaps HTTPBearer's default 403 to 401, so BOTH a missing
                    header and an invalid token return 401 here.)
  - list/own-data routes return ONLY the caller's rows (isolation)

All handlers were read to confirm they are pure DB reads (no external I/O):
  - billing/invoices returns [] when the user has no stripe_customer_id (our
    fresh fixtures do), so it never calls Stripe.
  - billing/subscription returns None (JSON null) when there is no subscription.
"""
import pytest

pytestmark = pytest.mark.smoke


# Authenticated GET routes that take no required query/path params and should
# 401 without a token. (method is always GET here.)
AUTHED_READ_PATHS = [
    "/api/auth/me",
    "/api/billing/status",
    "/api/billing/subscription",
    "/api/billing/invoices",
    "/api/projects",
    "/api/projects/template-availability",
    "/api/voices/saved",
    "/api/voices/custom",
    # Share B2V (referral/invite) disabled
    # "/api/affiliate/link",
    # "/api/affiliate/stats",
    "/api/background-music/tracks",
    "/api/crafted-templates",
    "/api/crafted-templates/cache-stats",
]


@pytest.mark.parametrize("path", AUTHED_READ_PATHS)
def test_authed_read__without_token__returns_401(client, path):
    # Missing Authorization header -> 401 "Not authenticated" (app remaps the
    # HTTPBearer 403 to 401). Verified at runtime, not assumed.
    resp = client.get(path)
    assert resp.status_code == 401, f"{path} should reject anonymous access"


# ─── GET /api/auth/me ───────────────────────────────────────────────────────

def test_get_auth_me__valid_token__returns_current_user(client, free_user, auth):
    resp = client.get("/api/auth/me", headers=auth(free_user))
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == free_user.id
    assert body["email"] == "free@test.local"
    assert body["plan"] == "free"
    # Computed fields surfaced by UserOut.
    assert body["video_limit"] == 2
    assert body["can_create_video"] is True


# ─── GET /api/billing/status ────────────────────────────────────────────────

def test_get_billing_status__free_user__returns_usage(client, free_user, auth):
    resp = client.get("/api/billing/status", headers=auth(free_user))
    assert resp.status_code == 200
    body = resp.json()
    assert body["plan"] == "free"
    assert body["videos_used"] == 0
    assert body["video_limit"] == 2
    assert body["can_create_video"] is True


def test_get_billing_subscription__no_subscription__returns_null(client, free_user, auth):
    resp = client.get("/api/billing/subscription", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() is None


def test_get_billing_invoices__no_stripe_customer__returns_empty_list(client, free_user, auth):
    resp = client.get("/api/billing/invoices", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() == []


# ─── GET /api/projects ──────────────────────────────────────────────────────

def test_get_projects__new_user__returns_empty_list(client, free_user, auth):
    resp = client.get("/api/projects", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_projects__isolation__returns_only_callers_projects(
    client, db_session, free_user, other_user, auth
):
    # Give each user one project; each must see only their own.
    from app.models.project import Project

    mine = Project(user_id=free_user.id, name="Mine", blog_url="https://a.test")
    theirs = Project(user_id=other_user.id, name="Theirs", blog_url="https://b.test")
    db_session.add_all([mine, theirs])
    db_session.commit()

    resp = client.get("/api/projects", headers=auth(free_user))
    assert resp.status_code == 200
    names = {p["name"] for p in resp.json()}
    assert names == {"Mine"}


# ─── GET /api/projects/template-availability ────────────────────────────────

def test_get_template_availability__new_user__all_false(client, free_user, auth):
    resp = client.get("/api/projects/template-availability", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() == {"has_custom_templates": False, "has_crafted_templates": False}


# ─── GET /api/voices/saved and /custom ──────────────────────────────────────

def test_get_saved_voices__new_user__returns_empty_list(client, free_user, auth):
    resp = client.get("/api/voices/saved", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_custom_voices__new_user__returns_empty_list(client, free_user, auth):
    resp = client.get("/api/voices/custom", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() == []


# ─── GET /api/affiliate/link and /stats ─────────────────────────────────────
# Share B2V (referral/invite) disabled — endpoints removed, tests no longer apply.
# def test_get_affiliate_link__returns_referral_link(client, free_user, auth):
#     resp = client.get("/api/affiliate/link", headers=auth(free_user))
#     assert resp.status_code == 200
#     assert isinstance(resp.json()["link"], str)
#     assert resp.json()["link"]
#
#
# def test_get_affiliate_stats__new_user__zeroed(client, free_user, auth):
#     resp = client.get("/api/affiliate/stats", headers=auth(free_user))
#     assert resp.status_code == 200
#     body = resp.json()
#     assert body["signups_count"] == 0
#     assert body["bonus_earned"] == 0
#     assert isinstance(body["link"], str)


# ─── GET /api/background-music/tracks ───────────────────────────────────────

def test_get_background_music_tracks__authed__returns_list(client, free_user, auth):
    resp = client.get("/api/background-music/tracks", headers=auth(free_user))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── GET /api/crafted-templates (disabled by default) ───────────────────────
# CRAFTED_TEMPLATES_ENABLED is False in tests, so list returns [] for any user.

def test_get_crafted_templates__disabled__returns_empty_list(client, free_user, auth):
    resp = client.get("/api/crafted-templates", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_crafted_cache_stats__authed__returns_dict(client, free_user, auth):
    resp = client.get("/api/crafted-templates/cache-stats", headers=auth(free_user))
    assert resp.status_code == 200
    assert isinstance(resp.json(), dict)
