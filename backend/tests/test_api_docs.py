"""The hand-written API reference (frontend/src/content/apiDocs.ts) stays in step with the route policy."""
import re
from pathlib import Path

import pytest

from app.services.api_route_policy import API_KEY_ROUTES

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS = REPO_ROOT / "frontend/src/content/apiDocs.ts"

# Every endpoint entry is `ep("METHOD", "/path", ...)`; apiDocs.ts keeps that form.
EP = re.compile(r'\bep\(\s*"(GET|POST|PUT|PATCH|DELETE)",\s*"([^"]+)"')

needs_docs = pytest.mark.skipif(not DOCS.exists(), reason="frontend sources not present")


def _documented() -> set[tuple[str, str]]:
    return set(EP.findall(DOCS.read_text(encoding="utf-8")))


def _real_routes() -> set[tuple[str, str]]:
    from app.main import app

    return {
        (m.upper(), path)
        for path, ops in app.openapi()["paths"].items()
        for m in ops
        if m in ("get", "post", "put", "patch", "delete")
    }


@needs_docs
def test_docs_file_is_parsed():
    # Guards the regex: if apiDocs.ts changes shape, the checks below must not pass vacuously.
    assert len(_documented()) > 100


@needs_docs
def test_every_allowed_route_is_documented():
    missing = sorted(API_KEY_ROUTES - _documented())
    assert missing == [], f"routes an API key can call but the docs don't cover: {missing}"


@needs_docs
def test_every_documented_route_exists_and_is_allowed():
    documented = _documented()
    unknown = sorted(documented - _real_routes())
    assert unknown == [], f"docs describe routes that don't exist: {unknown}"
    outside = sorted(r for r in documented if r not in API_KEY_ROUTES and not r[1].startswith("/api/v1/"))
    assert outside == [], f"docs describe routes an API key can't call: {outside}"


def test_auto_generated_openapi_is_hidden_by_default(client):
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
