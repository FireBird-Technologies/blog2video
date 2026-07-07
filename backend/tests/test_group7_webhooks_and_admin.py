"""
Group 7 — Webhooks, plan-change, studio gate, MCP (smoke level only).

These exercise the *entry* behaviour of the more complex flows:
  - the Stripe webhook rejects bad signatures and dispatches valid events to the
    correct handler (idempotency / grant-amount correctness = depth tier)
  - plan-change validates input and is auth-gated (proration math = depth tier)
  - the template-studio gate verifies without a configured password
  - the MCP template-gallery iframe route serves HTML

POST /api/billing/webhook
POST /api/billing/change-plan
POST /api/template-studio/auth/verify
GET  /mcp/ui/template_gallery
"""
import pytest

from app.routers import billing as billing_router

pytestmark = pytest.mark.webhooks


# ─── POST /api/billing/webhook ──────────────────────────────────────────────

def test_webhook__bad_signature__returns_400(client):
    # STRIPE_WEBHOOK_SECRET is blank in tests, so construct_event raises and the
    # handler returns 400 — i.e. unsigned/forged events are rejected.
    resp = client.post(
        "/api/billing/webhook",
        content=b'{"type":"checkout.session.completed"}',
        headers={"stripe-signature": "t=1,v1=forged"},
    )
    assert resp.status_code == 400


def test_webhook__valid_event__dispatches_to_correct_handler(client, monkeypatch):
    # Mock signature verification to return a known event, and spy on the handler.
    fake_event = {
        "type": "checkout.session.completed",
        "data": {"object": {"customer": "cus_x", "metadata": {}}},
    }
    monkeypatch.setattr(
        billing_router.stripe.Webhook, "construct_event",
        lambda *a, **k: fake_event, raising=True,
    )
    called = {}
    monkeypatch.setattr(
        billing_router, "_handle_checkout_completed",
        lambda data, db: called.setdefault("data", data), raising=True,
    )

    resp = client.post(
        "/api/billing/webhook", content=b"{}",
        headers={"stripe-signature": "sig"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    assert called.get("data") == {"customer": "cus_x", "metadata": {}}


def test_webhook__unknown_event_type__returns_200(client, monkeypatch):
    monkeypatch.setattr(
        billing_router.stripe.Webhook, "construct_event",
        lambda *a, **k: {"type": "customer.created", "data": {"object": {}}},
        raising=True,
    )
    resp = client.post(
        "/api/billing/webhook", content=b"{}", headers={"stripe-signature": "sig"},
    )
    assert resp.status_code == 200


# ─── POST /api/billing/change-plan ──────────────────────────────────────────

def test_change_plan__without_token__returns_401(client):
    resp = client.post("/api/billing/change-plan",
                       json={"plan": "pro", "billing_cycle": "monthly"})
    assert resp.status_code == 401


def test_change_plan__invalid_plan_value__returns_400(client, paid_user, auth):
    # Validation (_validate_change_plan_request) runs before any Stripe call.
    resp = client.post(
        "/api/billing/change-plan", headers=auth(paid_user),
        json={"plan": "gold", "billing_cycle": "monthly"},
    )
    assert resp.status_code == 400


# ─── POST /api/template-studio/auth/verify ──────────────────────────────────

def test_studio_verify__no_password_configured__returns_ok_ungated(client):
    # TEMPLATE_STUDIO_PASSWORD is blank in tests -> gate disabled, anything passes.
    resp = client.post("/api/template-studio/auth/verify", json={"password": "x"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "gated": False}


# ─── GET /mcp/ui/template_gallery ───────────────────────────────────────────

def test_mcp_template_gallery__serves_html(client):
    resp = client.get("/mcp/ui/template_gallery")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "<" in resp.text  # an actual HTML document, not an empty body
