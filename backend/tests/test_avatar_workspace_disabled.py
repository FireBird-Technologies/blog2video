"""
Depth tier — the provider-is-switched-off seam: classify, fail fast, refund.

WHY THIS FILE EXISTS
On 2026-08-10 the Modal workspace behind avatar rendering was disabled (billing)
mid-batch. Modal answered every call in ~5.7s with

    HTTP 404
    modal-http: workspace ac-alGR5PDJJWtSEMLrxSQ6bf is disabled

and the backend threw that away: `_ping_service` was `return resp.status_code ==
200`, so "disabled forever" and "still booting" were the same False. Each job
then polled the full wait window three times — 45 minutes — and reported "may be
out of capacity", which was a guess and the wrong one.

The fix is one classification. `retryable=False` is load-bearing twice over: it
stops the retry loop in avatar_queue (so the job does not burn attempts 2 and 3
holding a concurrency slot) AND it makes refund_exhausted_avatar_failures pay out
on the first attempt instead of at the attempt cap.

These tests pin the classifier's boundaries, because both directions are
expensive: too narrow and the 45-minute hang comes back, too wide and an ordinary
transient 500 stops being retried and starts refunding batches that would have
succeeded on their own.

Deliberately NOT tested here: the refund sweep itself (covered by its own
behaviour in avatar_queue) and driving the dispatcher end to end — see the note
in test_avatar_inline_matte.py about draining the connection pool.
"""
import pytest

from app.services.avatar import (
    AVATAR_SERVICE_UNAVAILABLE,
    _is_workspace_disabled,
)

pytestmark = pytest.mark.depth


# The exact body observed from Modal on 2026-08-10, kept verbatim: this string is
# the entire contract with the provider, and a test that paraphrases it would
# keep passing after Modal changed the wording.
REAL_DISABLED_BODY = "modal-http: workspace ac-alGR5PDJJWtSEMLrxSQ6bf is disabled"


class TestWorkspaceDisabledClassifier:
    def test_matches_the_real_modal_response(self):
        assert _is_workspace_disabled(404, REAL_DISABLED_BODY) is True

    def test_matches_403_variant(self):
        # Not observed in the wild, but a suspended account plausibly 403s and
        # the consequence is identical, so both codes are accepted.
        assert _is_workspace_disabled(403, REAL_DISABLED_BODY) is True

    def test_case_insensitive(self):
        assert _is_workspace_disabled(404, REAL_DISABLED_BODY.upper()) is True

    @pytest.mark.parametrize("code", [408, 409, 425, 429, 500, 502, 503, 504])
    def test_transient_codes_are_never_fatal(self, code):
        # These are the codes the render path retries. If the classifier ever
        # claimed one of them, a routine cold-start race would refund the batch
        # and mark the scene permanently failed.
        assert _is_workspace_disabled(code, REAL_DISABLED_BODY) is False

    def test_200_is_never_fatal(self):
        assert _is_workspace_disabled(200, REAL_DISABLED_BODY) is False

    def test_plain_404_is_not_fatal(self):
        # A bad path or a torn-down deployment also 404s. Those are not worth
        # refunding a batch over, which is why the body is matched too.
        assert _is_workspace_disabled(404, "Not Found") is False

    def test_empty_body_is_not_fatal(self):
        assert _is_workspace_disabled(404, "") is False
        assert _is_workspace_disabled(404, None) is False

    def test_needs_both_words(self):
        # Guards against loosening the match to a single token later: "disabled"
        # alone shows up in unrelated provider errors.
        assert _is_workspace_disabled(404, "workspace not found") is False
        assert _is_workspace_disabled(404, "this feature is disabled") is False


class TestPingClassification:
    """_ping_service must report WHY, not just that it failed."""

    def _resp(self, code, body):
        class R:
            status_code = code
            text = body
        return R()

    def test_disabled_workspace_returns_fatal_reason(self, monkeypatch):
        import app.services.avatar as av

        monkeypatch.setattr(
            av.requests, "get", lambda *a, **k: self._resp(404, REAL_DISABLED_BODY)
        )
        ok, fatal = av._ping_service()
        assert ok is False
        # The provider's own words survive to the caller — that is what reaches
        # the log and tells an operator this is a billing problem, not capacity.
        assert fatal == REAL_DISABLED_BODY

    def test_healthy_service(self, monkeypatch):
        import app.services.avatar as av

        monkeypatch.setattr(av.requests, "get", lambda *a, **k: self._resp(200, "ok"))
        assert av._ping_service() == (True, None)

    def test_transient_5xx_is_not_fatal(self, monkeypatch):
        import app.services.avatar as av

        monkeypatch.setattr(
            av.requests, "get", lambda *a, **k: self._resp(503, "unavailable")
        )
        ok, fatal = av._ping_service()
        assert ok is False
        assert fatal is None  # keep polling; this is what the wait loop is for

    def test_connection_error_is_not_fatal(self, monkeypatch):
        import app.services.avatar as av

        def boom(*a, **k):
            raise OSError("connection refused")

        monkeypatch.setattr(av.requests, "get", boom)
        assert av._ping_service() == (False, None)


class TestWaitShortCircuits:
    def test_fatal_probe_aborts_immediately(self, monkeypatch):
        """The 45-minute hang, pinned: one probe, no sleeping."""
        import app.services.avatar as av

        calls = {"pings": 0, "sleeps": 0}

        def fake_ping(*a, **k):
            calls["pings"] += 1
            return False, REAL_DISABLED_BODY

        monkeypatch.setattr(av, "_ping_service", fake_ping)
        monkeypatch.setattr(
            av.time, "sleep", lambda s: calls.__setitem__("sleeps", calls["sleeps"] + 1)
        )

        ready, fatal = av._wait_for_service()

        assert ready is False
        assert fatal == REAL_DISABLED_BODY
        assert calls["pings"] == 1, "must not keep polling a disabled workspace"
        assert calls["sleeps"] == 0, "must not wait out the window"

    def test_transient_failure_still_polls(self, monkeypatch):
        """The classifier must not have broken ordinary cold-start waiting."""
        import app.services.avatar as av

        state = {"n": 0}

        def fake_ping(*a, **k):
            state["n"] += 1
            return (True, None) if state["n"] >= 3 else (False, None)

        monkeypatch.setattr(av, "_ping_service", fake_ping)
        monkeypatch.setattr(av.time, "sleep", lambda s: None)

        ready, fatal = av._wait_for_service()

        assert ready is True
        assert fatal is None
        assert state["n"] == 3, "should have kept polling until it came up"


class TestUserFacingMessage:
    def test_names_the_refund(self):
        # The scene is fine and the money is already back; the generic
        # "we couldn't generate an avatar" reads as a fault the user should try
        # to fix, which is the wrong thing to tell them here.
        assert "unavailable" in AVATAR_SERVICE_UNAVAILABLE.lower()
        assert "refund" in AVATAR_SERVICE_UNAVAILABLE.lower()
