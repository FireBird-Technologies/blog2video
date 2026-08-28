"""
Meta Conversions API (server-side event delivery).

Sends the same conversion events the browser Pixel fires, directly from our
backend to Meta's Graph API. Unlike the Pixel, this can't be blocked by ad
blockers or dropped by Safari's Intelligent Tracking Prevention — it's how we
avoid undercounting signups/purchases in Meta's ad optimization.

Every call site MUST pass the same `event_id` used by the matching frontend
`fbq('track', ...)` call for the same real-world event (e.g. the Stripe
Checkout Session id for checkout events) — Meta deduplicates Pixel + CAPI
events sharing an event_id within a 48h window, so mismatched ids cause
double-counted conversions.

No-ops (logs at debug, returns without raising) when META_PIXEL_ID or
META_CAPI_ACCESS_TOKEN is unset, so this is safe to call unconditionally
before real credentials are configured.
"""
import hashlib
import time
from typing import Any

import requests

from app.config import settings
from app.observability.logging import get_logger

logger = get_logger(__name__)

GRAPH_API_VERSION = "v21.0"
_HASHED_USER_DATA_FIELDS = ("em", "ph", "external_id")


def _sha256_lower(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


def _prepare_user_data(user_data: dict[str, Any]) -> dict[str, Any]:
    """Hash the PII fields Meta requires as SHA-256; pass everything else through."""
    prepared: dict[str, Any] = {}
    for key, value in user_data.items():
        if value is None or value == "":
            continue
        if key in _HASHED_USER_DATA_FIELDS:
            prepared[key] = _sha256_lower(str(value))
        else:
            prepared[key] = value
    return prepared


def send_capi_event(
    *,
    event_name: str,
    event_id: str,
    event_source_url: str,
    user_data: dict[str, Any],
    custom_data: dict[str, Any] | None = None,
    event_time: int | None = None,
) -> None:
    """
    Send one event to the Meta Conversions API.

    event_name: a Meta standard event ("CompleteRegistration", "InitiateCheckout",
        "Purchase") or a custom event name ("CheckoutAbandon", "Login").
    event_id: shared dedup key with the matching browser fbq() call — see module
        docstring. Required (not optional) so callers can't accidentally skip dedup.
    user_data: raw (unhashed) values are fine here — em/ph/external_id are hashed
        below before anything leaves the process. Include client_ip_address,
        client_user_agent, fbp, fbc when available for match quality.
    """
    if not settings.META_PIXEL_ID or not settings.META_CAPI_ACCESS_TOKEN:
        logger.debug(
            "[META_CAPI] Skipped %s (event_id=%s): META_PIXEL_ID/META_CAPI_ACCESS_TOKEN not configured",
            event_name, event_id,
        )
        return

    payload: dict[str, Any] = {
        "data": [
            {
                "event_name": event_name,
                "event_time": event_time or int(time.time()),
                "event_id": event_id,
                "action_source": "website",
                "event_source_url": event_source_url,
                "user_data": _prepare_user_data(user_data),
                **({"custom_data": custom_data} if custom_data else {}),
            }
        ],
    }
    if settings.META_CAPI_TEST_EVENT_CODE:
        payload["test_event_code"] = settings.META_CAPI_TEST_EVENT_CODE

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{settings.META_PIXEL_ID}/events"
    try:
        resp = requests.post(
            url,
            params={"access_token": settings.META_CAPI_ACCESS_TOKEN},
            json=payload,
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.error(
                "[META_CAPI] %s (event_id=%s) failed: %s %s",
                event_name, event_id, resp.status_code, resp.text[:500],
            )
        else:
            logger.info("[META_CAPI] Sent %s (event_id=%s)", event_name, event_id)
    except Exception as exc:
        # Best-effort: a Meta API outage must never break signup/checkout for the user.
        logger.error(
            "[META_CAPI] %s (event_id=%s) raised: %s", event_name, event_id, exc, exc_info=True,
        )
