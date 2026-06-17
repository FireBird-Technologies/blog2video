"""
Group 1 — Public endpoints (no auth required).

Each test proves a genuinely public route responds correctly to a valid request
and rejects malformed input with the right status. These routes were verified by
reading each handler: several endpoints that *looked* public (background-music,
crafted-templates, free-download) are actually auth-gated and live in Group 2.

Confirmed public (no get_current_user dependency):
  - GET  /api/billing/plans
  - POST /api/contact/enterprise
  - GET  /api/custom-templates/public/featured
  - GET  /api/embed/project/{token}
  - GET  /unsubscribe
  - GET  /mcp/.well-known/oauth-authorization-server
  - GET  /api/health
"""
import pytest

pytestmark = pytest.mark.smoke


# ─── GET /api/billing/plans ─────────────────────────────────────────────────

def test_get_billing_plans__public__returns_200_with_seeded_plans(client):
    resp = client.get("/api/billing/plans")
    assert resp.status_code == 200
    plans = resp.json()
    assert isinstance(plans, list)
    slugs = {p["slug"] for p in plans}
    # seed_plans inserts these six; list_plans returns all active plans.
    assert {"free", "per_video", "pro_monthly", "pro_annual"} <= slugs


def test_get_billing_plans__plan_out_shape(client):
    resp = client.get("/api/billing/plans")
    assert resp.status_code == 200
    plan = next(p for p in resp.json() if p["slug"] == "free")
    # Exact PlanOut fields (from app/routers/billing.py::PlanOut).
    for field in ("id", "slug", "name", "price_cents", "video_limit",
                  "includes_studio", "includes_chat_editor", "sort_order"):
        assert field in plan
    assert plan["price_cents"] == 0
    assert plan["video_limit"] == 3


# ─── POST /api/contact/enterprise ───────────────────────────────────────────

def test_post_contact_enterprise__valid__returns_202(client):
    resp = client.post("/api/contact/enterprise", json={
        "name": "Ada", "company": "Analytical Engines",
        "contact_details": "ada@example.com", "message": "Interested in enterprise.",
    })
    assert resp.status_code == 202
    assert resp.json() == {"ok": True}


# ─── GET /api/custom-templates/public/featured ──────────────────────────────

def test_get_featured_templates__unknown_ids__returns_200_empty_list(client):
    resp = client.get("/api/custom-templates/public/featured", params={"ids": "99999999"})
    assert resp.status_code == 200
    assert resp.json() == []


# ─── GET /api/embed/project/{token} ─────────────────────────────────────────

def test_get_embed_project__unknown_token__returns_404(client):
    resp = client.get("/api/embed/project/does-not-exist")
    assert resp.status_code == 404


# ─── GET /unsubscribe ───────────────────────────────────────────────────────

def test_get_unsubscribe__invalid_token__returns_400_html(client):
    resp = client.get("/unsubscribe", params={"email": "x@test.local", "token": "bad"})
    assert resp.status_code == 400
    assert "text/html" in resp.headers["content-type"]


# ─── GET /mcp/.well-known/oauth-authorization-server ─────────────────────────

def test_get_oauth_metadata__public__returns_rfc8414_document(client):
    resp = client.get("/mcp/.well-known/oauth-authorization-server")
    assert resp.status_code == 200
    body = resp.json()
    # Exact keys from _oauth_metadata().
    assert body["response_types_supported"] == ["code"]
    assert body["code_challenge_methods_supported"] == ["S256"]
    assert body["issuer"].endswith("/mcp")


# ─── GET /api/health ────────────────────────────────────────────────────────

def test_get_health__public__returns_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ─── GET /api/template-studio/auth/status ───────────────────────────────────
# Verified public (no get_current_user) — reports only whether a gate password
# is configured, never the secret. With TEMPLATE_STUDIO_PASSWORD blank in tests,
# the gate is reported disabled.

def test_get_template_studio_auth_status__public__returns_gated_flag(client):
    resp = client.get("/api/template-studio/auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"gated": False}
