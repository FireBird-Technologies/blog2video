"""In-process rate limiting for unauthenticated auth endpoints.

Generalizes the per-IP lockout in routers/template_studio.py so login, signup and
password-reset can share one implementation.

SCOPE, stated plainly: this is per-process state. Under ``uvicorn --workers N``
or several containers the effective allowance is N x the configured number, and a
restart clears it entirely. That is acceptable for what it is — a speed bump in
front of an Argon2 verification, where the KDF is the real cost bound — but it is
NOT a control to point at in a compliance document, and it must never be the only
thing enforcing a security-critical limit. The two limits that genuinely must
hold across workers (the 60s resend cooldown and the 5-attempt code burn) live in
the database instead; see services/email_verification.py. Swapping this for Redis
later means reimplementing this class and nothing else.
"""
from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from threading import Lock

from fastapi import HTTPException, Request


@dataclass(frozen=True)
class RateLimitPolicy:
    max_attempts: int
    lockout_seconds: int
    # Attempts stop counting toward the limit once this long has passed since the
    # last one, so an occasional typo over a week never accumulates into a lockout.
    window_seconds: int


class InProcessRateLimiter:
    """Failure-counting limiter with a fixed lockout. Not a token bucket.

    Only failures are recorded, so a user typing their password correctly is
    never throttled no matter how often they sign in.
    """

    def __init__(self, name: str, policy: RateLimitPolicy) -> None:
        self.name = name
        self.policy = policy
        self._entries: dict[str, dict[str, float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> None:
        """Raise 429 if ``key`` is currently locked out."""
        now = time.time()
        with self._lock:
            self._sweep(now)
            entry = self._entries.get(key)
            if entry and entry["locked_until"] > now:
                retry_in = max(1, int(entry["locked_until"] - now))
                raise HTTPException(
                    status_code=429,
                    detail="too_many_attempts",
                    headers={"Retry-After": str(retry_in)},
                )

    def record_failure(self, key: str) -> int:
        """Count a failed attempt. Returns attempts remaining before lockout."""
        now = time.time()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None or now - entry["last_seen"] > self.policy.window_seconds:
                entry = {"count": 0.0, "locked_until": 0.0, "last_seen": now}
            entry["count"] += 1
            entry["last_seen"] = now
            if entry["count"] >= self.policy.max_attempts:
                entry["locked_until"] = now + self.policy.lockout_seconds
                entry["count"] = 0.0
            self._entries[key] = entry
            return max(0, self.policy.max_attempts - int(entry["count"]))

    def clear(self, key: str) -> None:
        """Forget a key's failures — called on a successful authentication."""
        with self._lock:
            self._entries.pop(key, None)

    def reset(self) -> None:
        """Drop all state. For tests, which would otherwise bleed into each other."""
        with self._lock:
            self._entries.clear()

    def _sweep(self, now: float) -> None:
        """Drop entries that are neither locked nor inside their window.

        The template-studio limiter this is modelled on leaks one dict entry per
        IP forever; these endpoints face the open internet, so that is a slow
        memory leak rather than a curiosity.
        """
        if len(self._entries) < 512:
            return
        stale = [
            k
            for k, e in self._entries.items()
            if e["locked_until"] <= now
            and now - e["last_seen"] > self.policy.window_seconds
        ]
        for k in stale:
            self._entries.pop(k, None)


def client_key(request: Request) -> str:
    """Best-effort client identifier, preferring X-Forwarded-For behind a proxy."""
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if fwd:
        return fwd
    return request.client.host if request.client else "unknown"


def email_key(email: str) -> str:
    """Hashed key for per-account limiting.

    Hashed so the limiter's state isn't a plaintext list of who has been trying
    to sign in — it lives in memory, but it also reaches logs and crash dumps.
    """
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


_MINUTE = 60
_HOUR = 60 * 60

# Login is limited on BOTH axes on purpose: per-IP alone lets a botnet credential-
# stuff a single account, per-email alone lets one host spray many accounts.
login_ip_limiter = InProcessRateLimiter(
    "login_ip", RateLimitPolicy(max_attempts=10, lockout_seconds=15 * _MINUTE, window_seconds=15 * _MINUTE)
)
login_email_limiter = InProcessRateLimiter(
    "login_email", RateLimitPolicy(max_attempts=5, lockout_seconds=15 * _MINUTE, window_seconds=15 * _MINUTE)
)
register_limiter = InProcessRateLimiter(
    "register", RateLimitPolicy(max_attempts=5, lockout_seconds=_HOUR, window_seconds=_HOUR)
)
resend_limiter = InProcessRateLimiter(
    "resend", RateLimitPolicy(max_attempts=5, lockout_seconds=_HOUR, window_seconds=_HOUR)
)
verify_limiter = InProcessRateLimiter(
    "verify", RateLimitPolicy(max_attempts=20, lockout_seconds=15 * _MINUTE, window_seconds=15 * _MINUTE)
)
forgot_ip_limiter = InProcessRateLimiter(
    "forgot_ip", RateLimitPolicy(max_attempts=5, lockout_seconds=_HOUR, window_seconds=_HOUR)
)
forgot_email_limiter = InProcessRateLimiter(
    "forgot_email", RateLimitPolicy(max_attempts=5, lockout_seconds=_HOUR, window_seconds=_HOUR)
)

ALL_LIMITERS = (
    login_ip_limiter,
    login_email_limiter,
    register_limiter,
    resend_limiter,
    verify_limiter,
    forgot_ip_limiter,
    forgot_email_limiter,
)


def reset_all_limiters() -> None:
    """Clear every limiter. Used by the test suite between cases."""
    for limiter in ALL_LIMITERS:
        limiter.reset()
