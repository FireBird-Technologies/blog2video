"""ElevenLabs API key selection + main-key quota tracking + backup failover.

Two independent audiences read this module:
  - TTS synthesis (voiceover.py) -- may run on either the main (pro) or backup
    (creator) key, via get_tts_api_key(). Fails over to backup once the main
    key's remaining quota drops to/below ELEVENLABS_FAILOVER_THRESHOLD_PERCENT,
    and falls back to main if the backup key itself ever errors.
  - Custom voice creation/cloning/design (elevenlabs_voice_design.py, the
    design-from-preset/design-from-prompt routes in main.py, saved_voices.py,
    sync_prebuilt_voices.py) -- via get_voice_design_api_key(), which ALWAYS
    returns the main key with no failover branch. A voice created under the
    main ElevenLabs account does not exist on the backup account, so this is a
    hard correctness constraint, not a preference.

State is in-memory (single-instance deploy, same assumption main.py's other
periodic jobs already make) and resets on process restart.
"""

import requests

from app.config import settings
from app.observability.logging import get_logger

logger = get_logger(__name__)

ELEVENLABS_SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription"

_state = {
    "active": "main",  # "main" | "backup"
    "main_remaining_pct": None,  # last-known % remaining on the main key
    "last_checked": None,  # datetime of last successful quota check
}


def get_tts_api_key(*, pin_to_main: bool = False) -> str:
    """Key to use for TTS synthesis.

    pin_to_main=True forces the main/pro key -- callers MUST pass this whenever
    a custom_voice_id is involved, since custom voices only exist on the
    account that created them and would 404 against the backup key.
    """
    if pin_to_main or _state["active"] == "main":
        return settings.ELEVENLABS_API_KEY
    return settings.ELEVENLABS_BACKUP_API_KEY or settings.ELEVENLABS_API_KEY


def is_main_key(key: str) -> bool:
    """True if `key` is the main/pro key (used by callers to log which key served a request)."""
    return key == settings.ELEVENLABS_API_KEY


def get_last_known_main_remaining_percent() -> float | None:
    """Last-known remaining % on the main key, from the most recent periodic/reactive
    check. None if no check has completed yet (e.g. right after a restart)."""
    return _state["main_remaining_pct"]


def log_key_usage(api_key: str, context: str) -> None:
    """Log which key (main/backup) is about to be used for an ElevenLabs call.

    Call this immediately before every ElevenLabs API request in the codebase
    (TTS synthesis and voice design/cloning alike) so every ElevenLabs-hitting
    request has a corresponding log line. `context` should identify the call
    site, e.g. "voice preview", "IVC clone", "prebuilt voice sync".
    """
    key_type = "main" if is_main_key(api_key) else "backup"
    remaining = _state["main_remaining_pct"]
    remaining_str = f"{remaining:.1f}" if remaining is not None else "unknown"
    logger.info(
        "[ELEVENLABS KEY] %s: using %s key (main remaining=%s%%)",
        context,
        key_type,
        remaining_str,
    )


def get_voice_design_api_key() -> str:
    """Voice creation/cloning/design -- ALWAYS the main/pro key.

    No failover branch here, deliberately: this is a different function from
    get_tts_api_key() so voice-design call sites can never accidentally
    inherit failover logic in a future edit.
    """
    return settings.ELEVENLABS_API_KEY


def fetch_remaining_percent(api_key: str) -> float | None:
    """GET /v1/user/subscription -> percent of character quota remaining, or None on failure."""
    if not api_key:
        return None
    try:
        resp = requests.get(
            ELEVENLABS_SUBSCRIPTION_URL,
            headers={"xi-api-key": api_key},
            timeout=15,
        )
        if resp.status_code != 200:
            logger.warning(
                "[ELEVENLABS QUOTA] subscription check failed: status=%s",
                resp.status_code,
            )
            return None
        data = resp.json()
        limit = data.get("character_limit")
        count = data.get("character_count")
        if not limit:
            return None
        remaining_pct = 100.0 * (limit - count) / limit
        return max(0.0, min(100.0, remaining_pct))
    except Exception as e:
        logger.warning("[ELEVENLABS QUOTA] subscription check failed: %s", e)
        return None


def _send_transition_email(reason: str) -> None:
    try:
        from app.services.email import email_service

        email_service.send_elevenlabs_failover_alert_email(reason=reason)
    except Exception as e:
        logger.error("[ELEVENLABS QUOTA] failed to send failover alert email: %s", e)


def check_and_update_failover_state() -> None:
    """Called by the periodic daily job (and reactively on a main-key quota error).

    Fetches the main key's remaining %, updates _state, and flips active
    main<->backup when it crosses ELEVENLABS_FAILOVER_THRESHOLD_PERCENT.
    """
    from datetime import datetime, timezone

    remaining_pct = fetch_remaining_percent(settings.ELEVENLABS_API_KEY)
    if remaining_pct is None:
        return

    _state["main_remaining_pct"] = remaining_pct
    _state["last_checked"] = datetime.now(timezone.utc)
    logger.info(
        "[ELEVENLABS QUOTA] main key remaining=%.1f%% active=%s",
        remaining_pct,
        _state["active"],
    )

    threshold = settings.ELEVENLABS_FAILOVER_THRESHOLD_PERCENT

    if _state["active"] == "main" and remaining_pct <= threshold:
        _state["active"] = "backup"
        logger.warning(
            "[ELEVENLABS QUOTA] main key at %.1f%% remaining (<=%.1f%% threshold), switching TTS to backup key",
            remaining_pct,
            threshold,
        )
        _send_transition_email(
            f"Main ElevenLabs (pro) key is at {remaining_pct:.1f}% character quota remaining "
            f"(threshold: {threshold:.1f}%). TTS synthesis has switched to the backup (creator) key. "
            "Custom voice creation/cloning continues to use the main key only."
        )
    elif _state["active"] == "backup" and remaining_pct > threshold:
        _state["active"] = "main"
        logger.warning(
            "[ELEVENLABS QUOTA] main key recovered to %.1f%% remaining, switching TTS back to main key",
            remaining_pct,
        )
        _send_transition_email(
            f"Main ElevenLabs (pro) key has recovered to {remaining_pct:.1f}% character quota remaining. "
            "TTS synthesis has switched back to the main key."
        )


def report_backup_key_failure(error: Exception) -> None:
    """Called from voiceover.py's retry/except path when a TTS call made with the
    BACKUP key errors (exhausted/invalid/ElevenLabs-side failure).

    Immediately forces _state["active"] back to "main" -- regardless of main's
    last-known remaining % -- since it's better to risk exhausting main than to
    fail the request outright when the backup key itself is unusable.
    """
    if _state["active"] != "backup":
        return
    _state["active"] = "main"
    logger.warning(
        "[ELEVENLABS QUOTA] backup key errored (%s), switching TTS back to main key",
        error,
    )
    _send_transition_email(
        f"Backup (creator) ElevenLabs key errored during a TTS request: {error}. "
        "TTS synthesis has switched back to the main (pro) key immediately."
    )
