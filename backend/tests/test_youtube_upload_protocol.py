"""Depth tier — the YouTube resumable upload protocol.

These run against a fake YouTube implemented in-process (the suite's socket
kill-switch means nothing here can reach the real one). They exist because
resumable-upload bugs are close to invisible in production: the request
succeeds, YouTube finalizes the video, and only the *content* is wrong.

The load-bearing case is ``test_resumes_from_the_servers_offset_not_ours``. A
308 carries the number of bytes the server actually stored, which can be fewer
than were sent. Trusting our own counter instead skips bytes and produces a
corrupt video with a 200 OK.
"""
import pytest

from app.services import youtube_publish as yt

pytestmark = pytest.mark.depth


class _Resp:
    """Minimal stand-in for httpx.Response."""

    def __init__(self, status_code, headers=None, json_body=None, text=""):
        self.status_code = status_code
        self.headers = headers or {}
        self._json = json_body if json_body is not None else {}
        self.text = text

    def json(self):
        return self._json


class FakeYouTube:
    """Accumulates uploaded bytes and replays a scripted sequence of responses.

    ``script`` is a list of callables taking (offset, chunk) and returning a
    _Resp, or None to mean "behave normally".
    """

    def __init__(self, total_bytes, script=None):
        self.total_bytes = total_bytes
        self.stored = bytearray()
        self.script = list(script or [])
        self.requests = []
        self.offset_queries = 0

    def put(self, url, headers=None, content=None, **kwargs):
        headers = headers or {}
        content_range = headers.get("Content-Range", "")
        self.requests.append(content_range)

        # A zero-length "bytes */total" PUT is an offset query.
        if content_range.startswith("bytes */"):
            self.offset_queries += 1
            return _Resp(308, {"Range": f"bytes=0-{len(self.stored) - 1}"}) if self.stored \
                else _Resp(308, {})

        start = int(content_range.split(" ")[1].split("-")[0])

        if self.script:
            scripted = self.script.pop(0)
            resp = scripted(start, content)
            if resp is not None:
                return resp

        # Normal path: store only what continues from what we already hold.
        if start != len(self.stored):
            return _Resp(308, {"Range": f"bytes=0-{len(self.stored) - 1}"})
        self.stored.extend(content)

        if len(self.stored) >= self.total_bytes:
            return _Resp(200, json_body={"id": "vid123", "status": {"privacyStatus": "public"}})
        return _Resp(308, {"Range": f"bytes=0-{len(self.stored) - 1}"})


@pytest.fixture()
def fake_client(monkeypatch):
    """Route httpx.Client through a FakeYouTube instance the test installs."""
    holder = {}

    class _Client:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def put(self, url, **kwargs):
            return holder["server"].put(url, **kwargs)

    monkeypatch.setattr(yt.httpx, "Client", _Client)
    monkeypatch.setattr(yt.time, "sleep", lambda *_: None)
    return holder


def _write(tmp_path, size):
    path = tmp_path / "video.mp4"
    path.write_bytes(bytes(range(256)) * (size // 256) + b"\0" * (size % 256))
    return str(path), size


# ─── Happy path ─────────────────────────────────────────────────────────────

def test_uploads_the_whole_file_in_order(fake_client, tmp_path, monkeypatch):
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 4096)
    server = FakeYouTube(size)
    fake_client["server"] = server

    result = yt.upload_file(
        upload_url="https://upload.test/session",
        file_path=path,
        total_bytes=size,
        access_token="tok",
    )

    assert result["id"] == "vid123"
    assert bytes(server.stored) == open(path, "rb").read()


def test_reports_progress_as_chunks_land(fake_client, tmp_path, monkeypatch):
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 4096)
    fake_client["server"] = FakeYouTube(size)
    seen = []

    yt.upload_file(
        upload_url="https://upload.test/session",
        file_path=path,
        total_bytes=size,
        access_token="tok",
        on_progress=lambda done, total: seen.append(done),
    )

    assert seen == sorted(seen), "progress must not go backwards"
    assert seen[-1] == size


# ─── The critical case ──────────────────────────────────────────────────────

def test_resumes_from_the_servers_offset_not_ours(fake_client, tmp_path, monkeypatch):
    """A 308 whose Range is SHORTER than what we sent: a partial store.

    If the client continued from its own counter it would skip the unstored
    bytes, and the final file would be silently corrupt.
    """
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 4096)

    def partial_store(start, chunk):
        # Accept only the first half of this chunk.
        keep = len(chunk) // 2
        server.stored.extend(chunk[:keep])
        return _Resp(308, {"Range": f"bytes=0-{len(server.stored) - 1}"})

    server = FakeYouTube(size, script=[partial_store])
    fake_client["server"] = server

    yt.upload_file(
        upload_url="https://upload.test/session",
        file_path=path,
        total_bytes=size,
        access_token="tok",
    )

    # The reassembled file must be byte-identical despite the short write.
    assert bytes(server.stored) == open(path, "rb").read()


def test_parse_range_end_handles_the_header_forms():
    assert yt._parse_range_end("bytes=0-262143") == 262144
    assert yt._parse_range_end(None) == 0        # server holds nothing yet
    assert yt._parse_range_end("") == 0
    assert yt._parse_range_end("garbage") == 0   # never crash on a weird header


# ─── Token expiry mid-upload ────────────────────────────────────────────────

def test_refreshes_the_token_on_a_401_and_continues(fake_client, tmp_path, monkeypatch):
    """Uploads outlive the 1h access token, so a mid-upload 401 is routine."""
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 4096)

    server = FakeYouTube(size, script=[lambda s, c: _Resp(401, text="expired")])
    fake_client["server"] = server
    refreshes = []

    yt.upload_file(
        upload_url="https://upload.test/session",
        file_path=path,
        total_bytes=size,
        access_token="stale",
        refresh_access_token=lambda: (refreshes.append(1), "fresh")[1],
    )

    assert len(refreshes) == 1, "should refresh exactly once"
    assert bytes(server.stored) == open(path, "rb").read()


def test_401_without_a_refresher_is_retryable_not_fatal(fake_client, tmp_path, monkeypatch):
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 2048)
    fake_client["server"] = FakeYouTube(size, script=[lambda s, c: _Resp(401)])

    with pytest.raises(yt.PublishError) as exc:
        yt.upload_file(
            upload_url="https://upload.test/session",
            file_path=path,
            total_bytes=size,
            access_token="stale",
        )

    assert exc.value.code == "reauth_required"
    assert exc.value.retryable is True


# ─── Transient failures ─────────────────────────────────────────────────────

def test_retries_a_500_then_succeeds(fake_client, tmp_path, monkeypatch):
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 2048)
    server = FakeYouTube(size, script=[lambda s, c: _Resp(500, text="backend error")])
    fake_client["server"] = server

    yt.upload_file(
        upload_url="https://upload.test/session",
        file_path=path,
        total_bytes=size,
        access_token="tok",
    )

    assert bytes(server.stored) == open(path, "rb").read()
    assert server.offset_queries >= 1, "a 500 must be followed by an offset query"


def test_network_error_requeries_the_offset(fake_client, tmp_path, monkeypatch):
    """A request that errored may still have been partially stored."""
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 2048)

    def boom(start, chunk):
        raise yt.httpx.RequestError("connection reset")

    server = FakeYouTube(size, script=[boom])
    fake_client["server"] = server

    yt.upload_file(
        upload_url="https://upload.test/session",
        file_path=path,
        total_bytes=size,
        access_token="tok",
    )

    assert bytes(server.stored) == open(path, "rb").read()


def test_a_stalled_upload_eventually_gives_up(fake_client, tmp_path, monkeypatch):
    """A server that never advances must not loop forever."""
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    monkeypatch.setattr(yt, "MAX_CHUNK_ATTEMPTS", 3)
    path, size = _write(tmp_path, 8192)

    server = FakeYouTube(size, script=[lambda s, c: _Resp(308, {"Range": "bytes=0-99"})] * 20)
    fake_client["server"] = server

    with pytest.raises(yt.PublishError) as exc:
        yt.upload_file(
            upload_url="https://upload.test/session",
            file_path=path,
            total_bytes=size,
            access_token="tok",
        )

    assert exc.value.code == "upload_stalled"


# ─── Terminal failures ──────────────────────────────────────────────────────

def test_expired_session_is_not_retryable(fake_client, tmp_path, monkeypatch):
    """A dead session cannot be resumed — retrying would waste upload quota."""
    monkeypatch.setattr(yt, "CHUNK_SIZE", 1024)
    path, size = _write(tmp_path, 2048)
    fake_client["server"] = FakeYouTube(size, script=[lambda s, c: _Resp(404)])

    with pytest.raises(yt.PublishError) as exc:
        yt.upload_file(
            upload_url="https://upload.test/session",
            file_path=path,
            total_bytes=size,
            access_token="tok",
        )

    assert exc.value.code == "session_expired"
    assert exc.value.retryable is False


@pytest.mark.parametrize(
    "body,expected_code,retryable",
    [
        ('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', "quota_exceeded", True),
        ('{"error":{"errors":[{"reason":"uploadLimitExceeded"}]}}', "account_upload_limit", False),
        ('{"error":{"errors":[{"reason":"youtubeSignupRequired"}]}}', "no_channel", False),
        ('{"error":{"message":"insufficient permissions"}}', "reauth_required", False),
    ],
)
def test_error_reasons_map_to_actionable_codes(body, expected_code, retryable):
    err = yt._classify_error(body, 403)
    assert err.code == expected_code
    assert err.retryable is retryable


def test_upload_limit_is_recognised_on_a_400_not_just_a_403():
    """YouTube returns uploadLimitExceeded as a 400 from videos.insert.

    Classifying on the status first produced a useless "refused the upload
    (400)" for what is the most likely real failure a user will hit.
    """
    body = (
        '{"error":{"code":400,"message":"The user has exceeded the number of '
        'videos they may upload.","errors":[{"reason":"uploadLimitExceeded"}]}}'
    )

    err = yt._classify_error(body, 400)

    assert err.code == "account_upload_limit"
    assert "upload limit" in str(err).lower()
    assert "youtube" in str(err).lower(), "must say whose limit it is"


def test_quota_exceeded_is_retryable_so_the_job_waits_rather_than_dying():
    """The daily bucket refills; failing the job would lose the user's intent."""
    err = yt._classify_error('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', 403)
    assert err.retryable is True


def test_an_unrecognised_error_surfaces_youtubes_own_message():
    """A real sentence beats a bare status code."""
    err = yt._classify_error(
        '{"error":{"code":400,"message":"Invalid video title."}}', 400
    )
    assert "Invalid video title." in str(err)
    assert err.retryable is False


def test_an_unrecognised_5xx_stays_retryable():
    err = yt._classify_error("<html>502 Bad Gateway</html>", 502)
    assert err.retryable is True


# ─── Metadata handling ──────────────────────────────────────────────────────

def test_sanitize_strips_characters_youtube_rejects():
    """YouTube 400s on < and > with an opaque message."""
    assert yt.sanitize_text("A <script> title") == "A script title"
    assert yt.sanitize_text(None) == ""


def test_a_missing_youtube_channel_is_not_reported_as_bad_credentials():
    """Regression: YouTube returns youtubeSignupRequired as a 401.

    The session-start path used to treat every 401 as "reconnect your account",
    which sent the user round a loop that could never fix it — reconnecting the
    same channel-less account produces the same 401 every time.

    This is the exact body the API returns.
    """
    body = (
        '{"error":{"code":401,"message":"Unauthorized","errors":[{"message":'
        '"Unauthorized","domain":"youtube.header","reason":"youtubeSignupRequired",'
        '"location":"Authorization","locationType":"header"}]}}'
    )

    err = yt._classify_error(body, 401)

    assert err.code == "no_channel"
    assert err.retryable is False, "reconnecting cannot create a channel"
    assert "channel" in str(err).lower()


def test_a_genuine_401_still_asks_for_a_reconnect():
    """The fallback must not swallow real credential failures."""
    err = yt._classify_error('{"error":{"code":401,"message":"Invalid Credentials"}}', 401)

    assert err.code == "reauth_required"
