"""
Group 3 — Ownership / tenant-isolation sweep (the security crown jewel).

For every project-scoped route, a second user must NOT be able to reach another
user's project. All ownership helpers (_get_user_project / _get_project) filter
by user_id and raise 404 when the project isn't the caller's, so the expected
cross-user status is 404 (a wrong-owner project is simply "not found").

Each parametrized case carries a readable id (method + path) so the run output
reads as a checklist, e.g.
  test_cross_user__returns_404[GET /api/projects/{id}]

Also here:
  - the owner-succeeds direction (proves the 404 is about ownership, not a
    blanket failure)
  - an invalid-token sweep (garbage token -> 401), complementing Group 2's
    missing-token sweep
  - a KNOWN-BUG guard on chat history (xfail, strict) — see note below.
"""
import pytest

from app.models.chat_message import ChatMessage, MessageRole
from app.models.project import Project

pytestmark = pytest.mark.ownership


@pytest.fixture()
def owned_project(db_session, free_user):
    """A project belonging to ``free_user`` (the victim in cross-user tests)."""
    project = Project(user_id=free_user.id, name="Owned", blog_url="https://owned.test")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


# (method, path-template) for routes that take the project as a path/query param
# and have NO request body, so the ownership check is reached cleanly. Verified
# each calls _get_user_project / _get_project (404 on wrong owner) before any
# heavy work.
CROSS_USER_ROUTES = [
    ("GET", "/api/projects/{pid}"),
    ("GET", "/api/projects/{pid}/layouts"),
    ("DELETE", "/api/projects/{pid}"),
    ("GET", "/api/pipeline/status?project_id={pid}"),
    ("GET", "/api/pipeline/render-status?project_id={pid}"),
    ("GET", "/api/pipeline/download-url?project_id={pid}"),
]


@pytest.mark.parametrize(
    "method,path",
    CROSS_USER_ROUTES,
    ids=[f"{m} {p}" for m, p in CROSS_USER_ROUTES],
)
def test_cross_user__returns_404(client, owned_project, other_user, auth, method, path):
    """A different user hitting someone else's project must get 404, not 200."""
    url = path.format(pid=owned_project.id)
    resp = client.request(method, url, headers=auth(other_user))
    assert resp.status_code == 404, (
        f"{method} {url} leaked another user's project (got {resp.status_code})"
    )


def test_owner_can_read_own_project(client, owned_project, free_user, auth):
    """Owner-succeeds direction: proves the cross-user 404 is about ownership."""
    resp = client.get(f"/api/projects/{owned_project.id}", headers=auth(free_user))
    assert resp.status_code == 200
    assert resp.json()["id"] == owned_project.id


def test_unknown_project_id__returns_404(client, free_user, auth):
    resp = client.get("/api/projects/99999999", headers=auth(free_user))
    assert resp.status_code == 404


# ─── Invalid-token sweep (complements Group 2's missing-token sweep) ─────────

INVALID_TOKEN_PATHS = [
    "/api/auth/me",
    "/api/billing/status",
    "/api/projects",
    "/api/voices/saved",
]


@pytest.mark.parametrize("path", INVALID_TOKEN_PATHS)
def test_garbage_token__returns_401(client, path):
    resp = client.get(path, headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_cross_user_chat_history__should_return_404(
    client, db_session, owned_project, other_user, auth
):
    db_session.add(ChatMessage(
        project_id=owned_project.id, role=MessageRole.USER, content="secret note",
    ))
    db_session.commit()

    resp = client.get(
        f"/api/projects/{owned_project.id}/chat/history",
        headers=auth(other_user),
    )
    assert resp.status_code == 404
