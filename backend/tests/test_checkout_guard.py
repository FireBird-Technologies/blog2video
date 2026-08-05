"""
Anti card-testing guard on the checkout endpoints.

The attack these cover: a throwaway account mints Checkout Sessions in a loop
and replays stolen cards against the hosted Stripe pages. Each test asserts one
layer of app/services/checkout_guard.py actually refuses the caller — a 200 here
means the guard is off and the endpoint is a card-testing oracle again.

POST /api/billing/checkout-per-video
POST /api/billing/checkout-custom-template
"""
import pytest

from app.config import settings
from app.services import checkout_guard

pytestmark = pytest.mark.gates

PER_VIDEO_URL = "/api/billing/checkout-per-video"


@pytest.fixture(autouse=True)
def _reset_guard_state():
    """The guard keeps per-process counters in module-level dicts; clear them
    around every test so limits are deterministic."""
    checkout_guard.reset_state_for_tests()
    yield
    checkout_guard.reset_state_for_tests()


@pytest.fixture()
def stub_stripe(monkeypatch):
    """Stub the Stripe calls a successful checkout makes (no network in tests).

    Returns a dict recording how many sessions were created, so a test can
    assert the guard stopped Stripe from being called at all.
    """
    calls = {"sessions": 0}

    class _Session:
        url = "https://checkout.stripe.test/session"

    def _create(**kwargs):
        calls["sessions"] += 1
        calls["last_kwargs"] = kwargs
        return _Session()

    class _Customer:
        id = "cus_test"

    monkeypatch.setattr(
        checkout_guard.stripe.Charge, "list",
        lambda **kwargs: {"data": []}, raising=True,
    )
    from app.routers import billing as billing_router

    monkeypatch.setattr(billing_router.stripe.checkout.Session, "create", _create, raising=True)
    monkeypatch.setattr(
        billing_router.stripe.Customer, "create",
        lambda **kwargs: _Customer(), raising=True,
    )
    return calls


def _buy(client, user, auth, quantity=1):
    return client.post(
        PER_VIDEO_URL, json={"project_id": None, "quantity": quantity},
        headers=auth(user),
    )


# ─── Layer 1: rate limits ───────────────────────────────────────────────────

def test_per_video__second_call_within_cooldown__429(client, free_user, auth, stub_stripe, monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_SESSION_COOLDOWN_SECONDS", 10)

    assert _buy(client, free_user, auth).status_code == 200
    resp = _buy(client, free_user, auth)

    assert resp.status_code == 429
    # The guard must reject before Stripe is touched.
    assert stub_stripe["sessions"] == 1


def test_per_video__over_hourly_cap__429(client, free_user, auth, stub_stripe, monkeypatch):
    monkeypatch.setattr(settings, "CHECKOUT_SESSION_COOLDOWN_SECONDS", 0)
    monkeypatch.setattr(settings, "CHECKOUT_MAX_SESSIONS_PER_USER_HOUR", 3)

    for _ in range(3):
        assert _buy(client, free_user, auth).status_code == 200
    resp = _buy(client, free_user, auth)

    assert resp.status_code == 429
    assert stub_stripe["sessions"] == 3


# ─── Layer 2: account-age gate (opt-in lever) ───────────────────────────────

def test_per_video__brand_new_account_with_age_gate_on__403(
    client, free_user, auth, stub_stripe, monkeypatch
):
    monkeypatch.setattr(settings, "CHECKOUT_MIN_ACCOUNT_AGE_SECONDS", 3600)

    resp = _buy(client, free_user, auth)

    assert resp.status_code == 403
    assert stub_stripe["sessions"] == 0


def test_per_video__age_gate_off_by_default__allowed(client, free_user, auth, stub_stripe):
    assert settings.CHECKOUT_MIN_ACCOUNT_AGE_SECONDS == 0
    assert _buy(client, free_user, auth).status_code == 200


# ─── Layer 3: decline history ───────────────────────────────────────────────

def test_per_video__customer_over_decline_threshold__403(
    client, free_user, auth, stub_stripe, monkeypatch, db_session
):
    free_user.stripe_customer_id = "cus_carder"
    db_session.commit()
    monkeypatch.setattr(settings, "CHECKOUT_MAX_RECENT_DECLINES", 2)
    monkeypatch.setattr(
        checkout_guard.stripe.Charge, "list",
        lambda **kwargs: {"data": [{"status": "failed"}] * 5}, raising=True,
    )

    resp = _buy(client, free_user, auth)

    assert resp.status_code == 403
    assert stub_stripe["sessions"] == 0


def test_per_video__stripe_lookup_fails__fails_open(
    client, free_user, auth, stub_stripe, monkeypatch, db_session
):
    """A Stripe outage must not block paying customers."""
    free_user.stripe_customer_id = "cus_ok"
    db_session.commit()

    def _boom(**kwargs):
        raise RuntimeError("stripe unavailable")

    monkeypatch.setattr(checkout_guard.stripe.Charge, "list", _boom, raising=True)

    assert _buy(client, free_user, auth).status_code == 200


# ─── Emergency kill switch ──────────────────────────────────────────────────

def test_per_video__kill_switch_off__503(client, free_user, auth, stub_stripe, monkeypatch):
    monkeypatch.setattr(settings, "PER_VIDEO_CHECKOUT_ENABLED", False)

    resp = _buy(client, free_user, auth)

    assert resp.status_code == 503
    assert stub_stripe["sessions"] == 0


def test_kill_switch__does_not_affect_plan_checkout(
    client, free_user, auth, stub_stripe, monkeypatch
):
    monkeypatch.setattr(settings, "PER_VIDEO_CHECKOUT_ENABLED", False)
    monkeypatch.setattr(settings, "STRIPE_STANDARD_PRICE_ID", "price_standard_test")

    resp = client.post(
        "/api/billing/checkout",
        json={"plan": "standard", "billing_cycle": "monthly"},
        headers=auth(free_user),
    )

    assert resp.status_code == 200


# ─── Session lifetime ───────────────────────────────────────────────────────

def test_per_video__session_expiry_is_capped_at_30_minutes(
    client, free_user, auth, stub_stripe
):
    """Session lifetime is the ceiling on how many cards one minted session can
    test, so the ad-hoc-amount endpoints use Stripe's 30-minute floor."""
    import time

    assert _buy(client, free_user, auth).status_code == 200

    expires_at = stub_stripe["last_kwargs"]["expires_at"]
    assert 0 < expires_at - int(time.time()) <= 1800


def test_per_video__records_client_ip_in_metadata(client, free_user, auth, stub_stripe):
    assert _buy(client, free_user, auth).status_code == 200
    assert stub_stripe["last_kwargs"]["metadata"]["client_ip"]
