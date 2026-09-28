"""Shared plumbing for the content-source clients (ghost_api, beehiiv_api, wordpress_api).

Both are API-key integrations: the user pastes a key, we validate it against
the provider, store it encrypted on a SocialConnection row, and later use it to
list posts, import one, or (Ghost) publish a video back into a post.
"""
import ipaddress
import re
import socket
from urllib.parse import urlparse, urlunparse

import httpx

from app.config import settings

HTTP_TIMEOUT = httpx.Timeout(20.0)
# Media uploads can be hundreds of MB over a slow link to a small Ghost host.
UPLOAD_TIMEOUT = httpx.Timeout(600.0, connect=20.0)


class SourceError(Exception):
    """A provider call failed in a way the user can act on.

    ``code`` is machine-readable so the client can pick its own copy and
    affordance (reconnect / retry / pick another post):

      invalid_key        — the provider rejected the credential; reconnect
      invalid_site       — the Ghost site URL is malformed, private, or not Ghost
      post_not_found     — the post was deleted or the key can't see it
      rate_limited       — slow down, retry later
      empty_post         — the post has no readable content
      upload_too_large   — Ghost refused the media upload (plan size limit)
      unsupported_editor — the Ghost post has neither lexical nor mobiledoc
      conflict           — the post changed while we were editing it
      plan_required      — the provider's plan doesn't allow this write (Beehiiv)
      provider_error     — anything else from the provider
    """

    def __init__(self, message: str, code: str = "provider_error", retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


def raise_for_provider_status(resp: httpx.Response, provider: str) -> None:
    """Map an HTTP error response to a SourceError; no-op on success."""
    if resp.status_code < 400:
        return
    # Our own short wording: provider error bodies are often long and technical
    # ("Authorization failed… check that cookies are being passed through").
    # A provider's message is only kept for the catch-all, and only when short.
    detail = _provider_message(resp)
    if resp.status_code in (401, 403):
        raise SourceError(f"{provider} did not accept the API key. Please check it and try again.", code="invalid_key")
    if resp.status_code == 404:
        raise SourceError("The post could not be found. It may have been deleted.", code="post_not_found")
    if resp.status_code == 409:
        raise SourceError(
            "The post changed while we were updating it. Please try again.",
            code="conflict", retryable=True,
        )
    if resp.status_code == 413:
        raise SourceError(f"The file is too large for {provider}.", code="upload_too_large")
    if resp.status_code == 429:
        raise SourceError(
            "Too many requests. Please try again shortly.",
            code="rate_limited", retryable=True,
        )
    short = detail if detail and len(detail) <= 120 else None
    raise SourceError(
        short or f"{provider} couldn't complete that. Please try again.",
        code="provider_error", retryable=resp.status_code >= 500,
    )


def _provider_message(resp: httpx.Response) -> str | None:
    """Best-effort human message from a Ghost ({errors:[{message}]}) or
    Beehiiv ({errors:[{message}]} / {message}) error body."""
    try:
        body = resp.json()
    except ValueError:
        return None
    if isinstance(body, dict):
        errors = body.get("errors")
        if isinstance(errors, list) and errors and isinstance(errors[0], dict):
            msg = errors[0].get("message") or errors[0].get("context")
            if msg:
                return str(msg)[:300]
        if body.get("message"):
            return str(body["message"])[:300]
    return None


def normalize_site_url(raw: str, provider: str = "Ghost") -> str:
    """Canonicalise a user-typed Ghost/WordPress site URL and refuse internal hosts.

    Accepts ``myblog.ghost.io``, ``https://myblog.com/``, or an admin URL
    (``https://myblog.com/ghost/#/dashboard``, ``…/wp-admin/``, ``…/wp-login.php``)
    and returns ``https://myblog.com``. Subdirectory installs
    (``https://example.com/blog``) keep their path.

    The SSRF guard matters because the server will make authenticated requests
    to whatever host is stored here: a user must not be able to point it at
    the metadata service or an internal admin panel.
    """
    value = (raw or "").strip()
    if not value:
        raise SourceError(f"Enter your {provider} site URL.", code="invalid_site")
    if "://" not in value:
        value = "https://" + value
    parsed = urlparse(value)
    local = settings.ENVIRONMENT == "local"
    if parsed.scheme != "https" and not (local and parsed.scheme == "http"):
        raise SourceError(f"Your {provider} site URL must start with https://", code="invalid_site")
    host = (parsed.hostname or "").lower()
    if not host or ("." not in host and not (local and host == "localhost")):
        raise SourceError("That doesn't look like a valid site URL.", code="invalid_site")
    if parsed.username or parsed.password:
        raise SourceError("That doesn't look like a valid site URL.", code="invalid_site")

    path = parsed.path or ""
    # Strip the admin suffix people copy from their address bar.
    path = re.sub(r"/(ghost|wp-admin)(/.*)?$|/wp-login\.php$", "", path).rstrip("/")

    if not local:
        assert_public_host(host)

    netloc = host if parsed.port is None else f"{host}:{parsed.port}"
    return urlunparse((parsed.scheme, netloc, path, "", "", ""))


def assert_public_host(host: str) -> None:
    """Raise unless every address ``host`` resolves to is publicly routable."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise SourceError(
            "Couldn't reach that site. Check the URL.", code="invalid_site"
        )
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if (
            addr.is_private or addr.is_loopback or addr.is_link_local
            or addr.is_reserved or addr.is_multicast or addr.is_unspecified
        ):
            raise SourceError("That site URL isn't allowed.", code="invalid_site")
