"""
Anti card-testing guard for Stripe Checkout session creation.

A card tester uses a live checkout endpoint as an oracle: mint a Checkout
Session, then replay stolen card numbers against the hosted Stripe page until
one authorizes. Our own auth barely slows that down — one throwaway Google
account yields a JWT, and every payment attempt after that happens on Stripe's
page, where we see nothing and gate nothing. The ad-hoc-amount endpoints
(per-video, custom template) are the favourite target: cheap, one-time,
``mode="payment"``, no subscription to unwind.

Three layers, cheapest first:

1. **Rate limits** on session creation, per user and per client IP. In-process
   and best-effort (multiple instances each keep their own counters), but it
   turns "thousands of sessions an hour" into a handful.
2. **Account-trust gate** — optional age minimum for ad-hoc-amount checkouts,
   off by default because it costs conversions. Turn it on while an attack is
   live via ``CHECKOUT_MIN_ACCOUNT_AGE_SECONDS``.
3. **Decline history from Stripe** — a customer with recent failed charges is
   cut off for a cooldown window. This one is authoritative across instances
   and restarts because the state lives in Stripe, not in our process.

None of this replaces Stripe Radar rules, which are the only control that sees
each individual card attempt. Treat this module as the layer that stops the
*session minting*, and Radar as the layer that stops the *card attempts*.
"""

import threading
import time
from datetime import datetime, timezone

import stripe
from fastapi import HTTPException, Request

from app.config import settings
from app.models.user import User
from app.observability.logging import get_logger

logger = get_logger(__name__)

# Checkout kinds that build a price on the fly (price_data) rather than using a
# fixed Price ID. These are the ones an attacker can drive at an arbitrary,
# low amount, so they carry the extra trust gate.
AD_HOC_AMOUNT_KINDS = frozenset({"per_video", "custom_template"})

_HOUR = 3600.0

_lock = threading.Lock()
# user_id -> last session-creation timestamp (monotonic)
_last_session: dict[int, float] = {}
# user_id / ip -> (window_start_monotonic, count)
_user_window: dict[int, tuple[float, int]] = {}
_ip_window: dict[str, tuple[float, int]] = {}
# stripe customer_id -> (checked_at_monotonic, decline_count) — short cache so a
# retry loop doesn't turn into a Stripe API call per attempt.
_decline_cache: dict[str, tuple[float, int]] = {}
_DECLINE_CACHE_TTL = 60.0


def client_ip(request: Request | None) -> str:
    """Best-effort client identifier. Prefers X-Forwarded-For behind a proxy."""
    if request is None:
        return "unknown"
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else "unknown"


def _bump_window(store: dict, key, limit: int, now: float) -> bool:
    """Increment `key`'s hourly counter. Returns False if it is over `limit`."""
    window_start, count = store.get(key, (now, 0))
    if (now - window_start) > _HOUR:
        window_start, count = now, 0
    if count >= limit:
        store[key] = (window_start, count)
        return False
    store[key] = (window_start, count + 1)
    return True


def _check_rate_limits(user_id: int, ip: str) -> None:
    now = time.monotonic()
    with _lock:
        cooldown = settings.CHECKOUT_SESSION_COOLDOWN_SECONDS
        last = _last_session.get(user_id)
        if last is not None and (now - last) < cooldown:
            raise HTTPException(
                status_code=429,
                detail="Please wait a moment before starting another checkout.",
            )
        if not _bump_window(_user_window, user_id, settings.CHECKOUT_MAX_SESSIONS_PER_USER_HOUR, now):
            logger.warning("[CHECKOUT_GUARD] user=%s ip=%s over hourly session cap", user_id, ip)
            raise HTTPException(
                status_code=429,
                detail="Too many checkout attempts. Please try again later or contact support.",
            )
        if ip != "unknown" and not _bump_window(
            _ip_window, ip, settings.CHECKOUT_MAX_SESSIONS_PER_IP_HOUR, now
        ):
            logger.warning("[CHECKOUT_GUARD] ip=%s over hourly session cap (user=%s)", ip, user_id)
            raise HTTPException(
                status_code=429,
                detail="Too many checkout attempts. Please try again later or contact support.",
            )
        _last_session[user_id] = now


def _check_account_age(user: User, kind: str) -> None:
    min_age = settings.CHECKOUT_MIN_ACCOUNT_AGE_SECONDS
    if min_age <= 0 or kind not in AD_HOC_AMOUNT_KINDS:
        return
    created = user.created_at
    if created is None:
        return
    if created.tzinfo is not None:
        created = created.astimezone(timezone.utc).replace(tzinfo=None)
    age = (datetime.utcnow() - created).total_seconds()
    if age < min_age:
        logger.warning(
            "[CHECKOUT_GUARD] user=%s blocked: account age %.0fs < %ss", user.id, age, min_age
        )
        raise HTTPException(
            status_code=403,
            detail="This purchase isn't available yet on a brand-new account. Please try again shortly.",
        )


def recent_decline_count(customer_id: str) -> int:
    """Failed charges for this Stripe customer inside the decline window.

    Reads from Stripe so the count is shared across instances and survives
    restarts. Failures are swallowed: a Stripe outage must not block payments.
    """
    if not customer_id:
        return 0
    now = time.monotonic()
    with _lock:
        cached = _decline_cache.get(customer_id)
        if cached and (now - cached[0]) < _DECLINE_CACHE_TTL:
            return cached[1]

    window_start = int(time.time()) - settings.CHECKOUT_DECLINE_WINDOW_HOURS * 3600
    try:
        charges = stripe.Charge.list(
            customer=customer_id,
            limit=50,
            created={"gte": window_start},
        )
        count = sum(1 for c in charges.get("data", []) if c.get("status") == "failed")
    except Exception as exc:  # network / API error — fail open
        logger.error("[CHECKOUT_GUARD] decline lookup failed for %s: %s", customer_id, exc)
        return 0

    with _lock:
        _decline_cache[customer_id] = (now, count)
    return count


def _check_decline_history(user: User) -> None:
    max_declines = settings.CHECKOUT_MAX_RECENT_DECLINES
    if max_declines <= 0 or not user.stripe_customer_id:
        return
    declines = recent_decline_count(user.stripe_customer_id)
    if declines > max_declines:
        logger.warning(
            "[CHECKOUT_GUARD] user=%s customer=%s blocked: %s declines in %sh",
            user.id,
            user.stripe_customer_id,
            declines,
            settings.CHECKOUT_DECLINE_WINDOW_HOURS,
        )
        raise HTTPException(
            status_code=403,
            detail=(
                "We couldn't process recent payment attempts on this account. "
                "Please contact support to complete your purchase."
            ),
        )


def invalidate_decline_cache(customer_id: str | None) -> None:
    """Drop the cached decline count so the next read hits Stripe.

    Call after any event that changes the customer's payment history — a
    success (they should stop being throttled) or a fresh failure (the cached
    count predates it).
    """
    if not customer_id:
        return
    with _lock:
        _decline_cache.pop(customer_id, None)


def note_successful_payment(customer_id: str | None) -> None:
    """A payment went through: forget the stale decline count."""
    invalidate_decline_cache(customer_id)


def enforce_checkout_guard(user: User, request: Request | None, kind: str) -> None:
    """Run every guard layer before a Checkout Session is created.

    Raises HTTPException (429/403) when the caller looks like a card tester.
    `kind` matches the session's metadata type: per_video, custom_template,
    bulk_500, or the subscription/lifetime types.
    """
    if kind == "per_video" and not settings.PER_VIDEO_CHECKOUT_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Single-video purchases are temporarily unavailable. Please try a plan instead.",
        )
    ip = client_ip(request)
    _check_rate_limits(user.id, ip)
    _check_account_age(user, kind)
    _check_decline_history(user)


def reset_state_for_tests() -> None:
    """Clear all in-process counters (test helper — module state is global)."""
    with _lock:
        _last_session.clear()
        _user_window.clear()
        _ip_window.clear()
        _decline_cache.clear()
