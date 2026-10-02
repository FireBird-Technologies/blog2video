"""The hand-written API reference: paid-only, and in step with the route policy."""
from app.api_docs.catalog import catalog
from app.services.api_route_policy import API_KEY_ROUTES
from tests.test_public_api import _api_key


def _documented() -> set[tuple[str, str]]:
    return {(e["method"], e["path"]) for s in catalog()["sections"] for e in s["endpoints"]}


def _real_routes() -> set[tuple[str, str]]:
    from app.main import app

    return {
        (m.upper(), path)
        for path, ops in app.openapi()["paths"].items()
        for m in ops
        if m in ("get", "post", "put", "patch", "delete")
    }


def test_docs_are_for_paid_users_only(client, paid_user, free_user, auth):
    ok = client.get("/api/api-docs", headers=auth(paid_user))
    assert ok.status_code == 200
    body = ok.json()
    assert body["sections"] and body["guides"]
    assert client.get("/api/api-docs", headers=auth(free_user)).status_code == 403
    assert client.get("/api/api-docs").status_code in (401, 403)


def test_docs_are_not_reachable_with_an_api_key(client, paid_user, auth):
    # The reference is part of the app, not the API surface a key unlocks.
    assert client.get("/api/api-docs", headers=_api_key(client, paid_user, auth)).status_code == 403


def test_every_allowed_route_is_documented():
    missing = sorted(API_KEY_ROUTES - _documented())
    assert missing == [], f"routes an API key can call but the docs don't cover: {missing}"


def test_every_documented_route_exists_and_is_allowed():
    documented = _documented()
    unknown = sorted(documented - _real_routes())
    assert unknown == [], f"docs describe routes that don't exist: {unknown}"
    outside = sorted(r for r in documented if r not in API_KEY_ROUTES and not r[1].startswith("/api/v1/"))
    assert outside == [], f"docs describe routes an API key can't call: {outside}"


def test_every_entry_is_complete():
    for section in catalog()["sections"]:
        for e in section["endpoints"]:
            assert e["summary"], e["path"]
            assert e["response_example"] is not None or e["response_note"], f"{e['method']} {e['path']} has no response format"
            for p in e["params"]:
                if p["in"] == "path":
                    assert "{" + p["name"] + "}" in e["path"], (e["path"], p["name"])


def test_auto_generated_openapi_is_hidden_by_default(client):
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
