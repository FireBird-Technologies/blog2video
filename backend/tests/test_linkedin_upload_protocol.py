"""Depth tier — the LinkedIn multipart video upload protocol.

These run against a fake LinkedIn implemented in-process (the suite's socket
kill-switch means nothing here can reach the real one). They exist for the same
reason the YouTube protocol tests do: the failure modes are close to invisible in
production, because LinkedIn returns 200 and publishes a post — only the *bytes*
are wrong.

The load-bearing case is ``test_part_ids_are_the_etags_in_instruction_order``.
LinkedIn reassembles the video from ``uploadedPartIds``, so submitting the ETags
in any other order finalizes a scrambled video with a success response.

Two more that guard traps rather than behaviour:
  * ``test_echoes_the_upload_token_from_initialize`` — the token is "" in
    LinkedIn's single-part samples, so hardcoding "" works right up until a file
    needs two parts;
  * ``test_part_urls_never_carry_the_bearer_token`` — the part URLs are
    pre-signed and point at a different host.
"""
import pytest

from app.services import linkedin_publish as li
from app.services.youtube_publish import PublishError

pytestmark = pytest.mark.depth

VIDEO_URN = "urn:li:video:C123"
POST_URN = "urn:li:ugcPost:987"


class _Resp:
    """Minimal stand-in for httpx.Response."""

    def __init__(self, status_code, headers=None, json_body=None, text=""):
        self.status_code = status_code
        self.headers = headers or {}
        self._json = json_body if json_body is not None else {}
        self.text = text

    def json(self):
        return self._json


class FakeLinkedIn:
    """Reassembles the uploaded parts and records what it was sent."""

    def __init__(self, total_bytes, *, part_size=1024, etags=None, expires_at=None):
        self.total_bytes = total_bytes
        self.part_size = part_size
        self.parts: dict[int, bytes] = {}
        self.part_headers: list[dict] = []
        self.finalize_body = None
        self.post_body = None
        self.upload_token = "tok-from-initialize"
        self.expires_at = expires_at
        # status values popped per poll; the last one repeats.
        self.statuses = ["AVAILABLE"]
        self.put_script = []
        self.custom_etags = etags

        n_parts = max(1, (total_bytes + part_size - 1) // part_size)
        self.instructions = [
            {
                "uploadUrl": f"https://dms-uploads.linkedin.test/part/{i}",
                "firstByte": i * part_size,
                "lastByte": (i + 1) * part_size - 1,
            }
            for i in range(n_parts)
        ]

    # -- api.linkedin.com ------------------------------------------------
    def post(self, url, params=None, headers=None, json=None, **kwargs):
        params = params or {}
        if params.get("action") == "initializeUpload":
            value = {
                "video": VIDEO_URN,
                "uploadToken": self.upload_token,
                "uploadInstructions": self.instructions,
            }
            if self.expires_at is not None:
                value["uploadUrlsExpireAt"] = self.expires_at
            return _Resp(200, json_body={"value": value})

        if params.get("action") == "finalizeUpload":
            self.finalize_body = json
            return _Resp(200)

        # POST /rest/posts
        self.post_body = json
        return _Resp(201, headers={"x-restli-id": POST_URN})

    def get(self, url, headers=None, **kwargs):
        status = self.statuses[0] if len(self.statuses) == 1 else self.statuses.pop(0)
        body = {"status": status}
        if status == "PROCESSING_FAILED":
            body["processingFailureReason"] = "CORRUPTED_FILE"
        return _Resp(200, json_body=body)

    # -- pre-signed part URLs --------------------------------------------
    def put(self, url, content=None, headers=None, **kwargs):
        index = int(url.rsplit("/", 1)[1])
        self.part_headers.append(headers or {})

        if self.put_script:
            scripted = self.put_script.pop(0)
            resp = scripted(index, content)
            if resp is not None:
                return resp

        self.parts[index] = content
        etag = (
            self.custom_etags[index]
            if self.custom_etags
            else f"/ambry-video/signedId/part-{index}.bin"
        )
        return _Resp(200, headers={"etag": etag})

    @property
    def assembled(self) -> bytes:
        return b"".join(self.parts[i] for i in sorted(self.parts))


@pytest.fixture()
def fake_client(monkeypatch):
    holder = {}

    class _Client:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, **kwargs):
            return holder["server"].post(url, **kwargs)

        def get(self, url, **kwargs):
            return holder["server"].get(url, **kwargs)

        def put(self, url, **kwargs):
            return holder["server"].put(url, **kwargs)

    monkeypatch.setattr(li.httpx, "Client", _Client)
    monkeypatch.setattr(li.time, "sleep", lambda *_: None)
    # A live token, so get_access_token short-circuits without a refresh call.
    monkeypatch.setattr(li, "get_access_token", lambda conn, db, **k: "live-token")
    return holder


class _Conn:
    """Just the fields publish_video reads."""

    account_id = "urn:li:person:abc"
    account_name = "Test Member"


def _write(tmp_path, size):
    path = tmp_path / "video.mp4"
    path.write_bytes(bytes(range(256)) * (size // 256) + b"\0" * (size % 256))
    return str(path), size


def _publish(server, path, size, **kwargs):
    return li.publish_video(
        conn=_Conn(), db=None, file_path=path, total_bytes=size,
        text=kwargs.pop("text", "hello"), **kwargs,
    )


# ─── Happy path ─────────────────────────────────────────────────────────────

def test_uploads_every_part_and_reassembles_byte_identically(fake_client, tmp_path):
    path, size = _write(tmp_path, 4096)
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server

    result = _publish(server, path, size)

    assert len(server.parts) == 4
    with open(path, "rb") as fh:
        assert server.assembled == fh.read()
    assert result == {"post_id": POST_URN, "post_url": li.post_url(POST_URN)}


def test_part_ids_are_the_etags_in_instruction_order(fake_client, tmp_path):
    """THE load-bearing test.

    LinkedIn reassembles from uploadedPartIds, so the order must match the
    instruction order regardless of what the ETag values happen to sort like.
    Getting this wrong publishes a scrambled video with a 200 OK.
    """
    path, size = _write(tmp_path, 3072)
    # Deliberately reverse-sorted values: anything that sorts or sets these
    # rather than preserving order will fail.
    etags = ["zzz-part-0", "mmm-part-1", "aaa-part-2"]
    server = FakeLinkedIn(size, part_size=1024, etags=etags)
    fake_client["server"] = server

    _publish(server, path, size)

    assert server.finalize_body["finalizeUploadRequest"]["uploadedPartIds"] == etags


def test_echoes_the_upload_token_from_initialize(fake_client, tmp_path):
    """Guards the hardcoded-"" trap: "" is valid only for single-part uploads."""
    path, size = _write(tmp_path, 2048)
    server = FakeLinkedIn(size, part_size=1024)
    server.upload_token = "a-real-multipart-token"
    fake_client["server"] = server

    _publish(server, path, size)

    assert server.finalize_body["finalizeUploadRequest"]["uploadToken"] == (
        "a-real-multipart-token"
    )


def test_part_urls_never_carry_the_bearer_token(fake_client, tmp_path):
    """Security regression: the part URLs are pre-signed and on another host."""
    path, size = _write(tmp_path, 2048)
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server

    _publish(server, path, size)

    assert server.part_headers
    for headers in server.part_headers:
        assert not any(k.lower() == "authorization" for k in headers)


def test_a_final_part_shorter_than_its_range_is_accepted(fake_client, tmp_path):
    """lastByte overshoots EOF when the size is not a multiple of the part size."""
    path, size = _write(tmp_path, 2500)  # 1024 + 1024 + 452
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server

    _publish(server, path, size)

    assert len(server.assembled) == size
    assert len(server.parts[2]) == 452


def test_quoted_etags_are_unquoted(fake_client, tmp_path):
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024, etags=['"quoted-etag"'])
    fake_client["server"] = server

    _publish(server, path, size)

    assert server.finalize_body["finalizeUploadRequest"]["uploadedPartIds"] == [
        "quoted-etag"
    ]


def test_progress_is_reported_after_each_part(fake_client, tmp_path):
    path, size = _write(tmp_path, 4096)
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server
    seen = []

    _publish(server, path, size, on_progress=lambda done, total: seen.append((done, total)))

    assert seen == [(1024, size), (2048, size), (3072, size), (4096, size)]


# ─── Posting ────────────────────────────────────────────────────────────────

def test_waits_for_processing_before_posting(fake_client, tmp_path):
    """Posting against a PROCESSING video is refused with MEDIA_ASSET_WAITING_UPLOAD."""
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    server.statuses = ["PROCESSING", "PROCESSING", "AVAILABLE"]
    fake_client["server"] = server

    _publish(server, path, size)

    assert server.post_body is not None


def test_processing_failure_is_not_retryable_and_names_the_reason(fake_client, tmp_path):
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    server.statuses = ["PROCESSING_FAILED"]
    fake_client["server"] = server

    with pytest.raises(PublishError) as exc:
        _publish(server, path, size)

    assert exc.value.code == "processing_failed"
    assert exc.value.retryable is False
    assert "CORRUPTED_FILE" in str(exc.value)


def test_processing_timeout_is_retryable(fake_client, tmp_path, monkeypatch):
    monkeypatch.setattr(li, "MAX_PROCESSING_SECONDS", 0)
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    server.statuses = ["PROCESSING"]
    fake_client["server"] = server

    with pytest.raises(PublishError) as exc:
        _publish(server, path, size)

    assert exc.value.code == "processing_timeout"
    assert exc.value.retryable is True


def test_the_post_carries_the_author_visibility_and_video(fake_client, tmp_path):
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server

    _publish(server, path, size, visibility="CONNECTIONS", title="My video")

    assert server.post_body["author"] == "urn:li:person:abc"
    assert server.post_body["visibility"] == "CONNECTIONS"
    assert server.post_body["commentary"] == "hello"
    assert server.post_body["content"]["media"]["id"] == VIDEO_URN
    assert server.post_body["content"]["media"]["title"] == "My video"
    assert server.post_body["lifecycleState"] == "PUBLISHED"


def test_post_urn_comes_from_the_x_restli_id_header(fake_client, tmp_path):
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server

    result = _publish(server, path, size)

    assert result["post_id"] == POST_URN
    assert result["post_url"] == f"https://www.linkedin.com/feed/update/{POST_URN}/"


def test_a_missing_x_restli_id_is_not_retryable(fake_client, tmp_path):
    """The post was almost certainly created — retrying would double-post."""
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    fake_client["server"] = server

    original_post = server.post

    def _post(url, params=None, **kwargs):
        resp = original_post(url, params=params, **kwargs)
        if not (params or {}).get("action"):
            return _Resp(201, headers={})  # header stripped by a proxy
        return resp

    server.post = _post

    with pytest.raises(PublishError) as exc:
        _publish(server, path, size)

    assert exc.value.retryable is False


def test_a_connection_with_no_account_id_asks_for_a_reconnect(fake_client, tmp_path):
    path, size = _write(tmp_path, 1024)
    fake_client["server"] = FakeLinkedIn(size, part_size=1024)

    class _Blank:
        account_id = None

    with pytest.raises(PublishError) as exc:
        li.publish_video(
            conn=_Blank(), db=None, file_path=path, total_bytes=size, text="hi"
        )

    assert exc.value.code == "reauth_required"
    assert exc.value.retryable is False


# ─── Failure handling ───────────────────────────────────────────────────────

def test_a_500_on_one_part_is_retried_then_succeeds(fake_client, tmp_path):
    path, size = _write(tmp_path, 2048)
    server = FakeLinkedIn(size, part_size=1024)
    server.put_script = [lambda i, c: None, lambda i, c: _Resp(500, text="boom")]
    fake_client["server"] = server

    _publish(server, path, size)

    assert len(server.assembled) == size


def test_a_missing_etag_is_a_retryable_failure(fake_client, tmp_path):
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    server.put_script = [lambda i, c: _Resp(200, headers={})]
    fake_client["server"] = server

    with pytest.raises(PublishError) as exc:
        _publish(server, path, size)

    assert exc.value.code == "upload_failed"
    assert exc.value.retryable is True


def test_a_401_on_a_part_means_expired_url_not_bad_credentials(fake_client, tmp_path):
    """The collision that matters.

    A 401 from a pre-signed part URL means the URL expired. Reporting it as
    reauth_required would send the user off to reconnect an account that is
    perfectly fine — and the retry that would actually fix it never happens.
    """
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024)
    server.put_script = [lambda i, c: _Resp(401, text="expired")]
    fake_client["server"] = server

    with pytest.raises(PublishError) as exc:
        _publish(server, path, size)

    assert exc.value.code == "upload_session_expired"
    assert exc.value.retryable is True


def test_upload_urls_about_to_expire_are_refused_before_sending_bytes(
    fake_client, tmp_path
):
    path, size = _write(tmp_path, 1024)
    server = FakeLinkedIn(size, part_size=1024, expires_at=0)  # epoch ms, long past
    fake_client["server"] = server

    with pytest.raises(PublishError) as exc:
        _publish(server, path, size)

    assert exc.value.code == "upload_session_expired"
    assert exc.value.retryable is True
    assert server.parts == {}


@pytest.mark.parametrize(
    "status,body,expected_code,expected_retryable",
    [
        (401, {"message": "Invalid access token"}, "reauth_required", False),
        (403, {"code": "ACCESS_DENIED", "message": "no"}, "reauth_required", False),
        (429, {"message": "Too many requests"}, "rate_limited", True),
        (400, {"message": "EXPIRED_UPLOAD_URL"}, "upload_session_expired", True),
        (400, {"message": "MEDIA_ASSET_PROCESSING_FAILED"}, "processing_failed", False),
        (400, {"message": "MEDIA_ASSET_WAITING_UPLOAD"}, "upload_failed", True),
        (400, {"message": "FIELD_LENGTH_TOO_LONG"}, "invalid_metadata", False),
        (500, {"message": "server error"}, "upload_failed", True),
        (400, {"message": "something else"}, "upload_failed", False),
    ],
)
def test_api_errors_map_to_actionable_codes(status, body, expected_code, expected_retryable):
    with pytest.raises(PublishError) as exc:
        li._raise_for_status(_Resp(status, json_body=body), stage="test")

    assert exc.value.code == expected_code
    assert exc.value.retryable is expected_retryable


def test_a_non_json_error_body_does_not_crash_the_mapper():
    class _Bad(_Resp):
        def json(self):
            raise ValueError("not json")

    with pytest.raises(PublishError) as exc:
        li._raise_for_status(_Bad(502, text="<html>gateway</html>"), stage="test")

    assert exc.value.code == "upload_failed"
    assert exc.value.retryable is True


# ─── Commentary ─────────────────────────────────────────────────────────────

def test_commentary_joins_title_and_description():
    assert li.compose_commentary("Title", "Body") == "Title\n\nBody"


def test_commentary_is_truncated_at_the_linkedin_limit():
    text = li.compose_commentary("x" * 4000, None)
    assert len(text) == li.COMMENTARY_MAX
    assert text.endswith("…")


def test_commentary_keeps_angle_brackets():
    """Stripping them is a YouTube quirk; doing it here would mangle real text."""
    assert "<3" in li.compose_commentary("I <3 this", None)
