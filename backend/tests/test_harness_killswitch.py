"""
Kill-switch self-verification.

Two guarantees the rest of the suite depends on:
  1. The autouse network guard actually blocks real outbound connections, so a
     missing mock fails loudly instead of silently hitting a live service.
  2. The kill-switch is NOT over-mocked — it stubs external I/O only, never the
     app's auth or ownership logic. If it did, tests could pass for the wrong
     reason (a false green). We prove this by showing that, WITH the kill-switch
     active, a no-token request still 401s and a cross-user request still 404s.
"""
import socket

import pytest

from app.models.project import Project


def test_killswitch_blocks_real_outbound_socket():
    """A genuine socket connect must be refused by the guard.

    Asserted by exception *name* rather than imported identity: pytest may load
    tests/conftest.py under a different module name than ``tests.conftest``, so
    comparing class identity is unreliable. The name uniquely identifies the
    guard's RealNetworkBlockedError.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    with pytest.raises(Exception) as exc_info:
        s.connect(("93.184.216.34", 80))  # example.com — must never be reached
    assert exc_info.type.__name__ == "RealNetworkBlockedError"


def test_killswitch_does_not_bypass_auth(client):
    """With the kill-switch active, an anonymous request is still rejected."""
    resp = client.get("/api/projects")
    assert resp.status_code == 401


def test_killswitch_does_not_bypass_ownership(client, db_session, free_user, other_user, auth):
    """With the kill-switch active, cross-user access is still 404 (not 200)."""
    project = Project(user_id=free_user.id, name="Owned", blog_url="https://o.test")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    resp = client.get(f"/api/projects/{project.id}", headers=auth(other_user))
    assert resp.status_code == 404
