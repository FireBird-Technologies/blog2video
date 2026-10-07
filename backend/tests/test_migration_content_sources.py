"""The add_content_source_integrations revision, run against a throwaway SQLite
DB via alembic Operations directly — never through alembic/env.py, which reads
backend/.env (the live database)."""
import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

pytestmark = pytest.mark.depth

_REV = Path(__file__).resolve().parents[1] / "alembic/versions/add_content_source_integrations.py"


def _load_revision():
    spec = importlib.util.spec_from_file_location("rev_content_sources", _REV)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _columns(engine, table):
    return {c["name"] for c in sa.inspect(engine).get_columns(table)}


def _run(engine, fn_name):
    rev = _load_revision()
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            getattr(rev, fn_name)()


def test_upgrade_adds_columns_idempotently_and_downgrade_removes_them(tmp_path):
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE projects (id INTEGER PRIMARY KEY)"))
        conn.execute(sa.text("CREATE TABLE social_connections (id INTEGER PRIMARY KEY)"))
        conn.execute(sa.text("CREATE TABLE social_publish_jobs (id INTEGER PRIMARY KEY)"))

    _run(engine, "upgrade")
    _run(engine, "upgrade")  # re-run on a migrated DB must be a no-op
    assert {"source_platform", "source_post_id"} <= _columns(engine, "projects")
    assert "site_url" in _columns(engine, "social_connections")
    assert {"target_post_id", "target_mode", "delivery"} <= _columns(engine, "social_publish_jobs")

    _run(engine, "downgrade")
    assert "source_platform" not in _columns(engine, "projects")
    assert "site_url" not in _columns(engine, "social_connections")


def test_revision_chains_off_current_head():
    """One linear history: a single head, and this branch's revisions hang off
    the previous head without forking it. Checked structurally (no hardcoded
    parent), so merging newer migrations underneath doesn't break the test —
    only an actual fork does. ScriptDirectory parses the files; env.py (and
    the live DB in backend/.env) is never touched."""
    from alembic.script import ScriptDirectory

    script = ScriptDirectory(str(_REV.parents[1]))
    assert len(script.get_heads()) == 1, f"multiple alembic heads: {script.get_heads()}"

    ours = script.get_revision("add_content_source_integrations")
    parent = script.get_revision(ours.down_revision)
    assert parent is not None, f"unknown parent revision {ours.down_revision!r}"
    assert parent.nextrev == frozenset({"add_content_source_integrations"})
    assert ours.nextrev == frozenset({"add_wordpress_source_columns"})


_WP_REV = _REV.parent / "add_wordpress_source_columns.py"


def _run_wp(engine, fn_name):
    spec = importlib.util.spec_from_file_location("rev_wordpress_sources", _WP_REV)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            getattr(mod, fn_name)()


def test_wordpress_revision_adds_columns_idempotently(tmp_path):
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'wp.db'}")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE social_connections (id INTEGER PRIMARY KEY)"))
    _run_wp(engine, "upgrade")
    _run_wp(engine, "upgrade")
    assert {"auth_kind", "api_root"} <= _columns(engine, "social_connections")
    _run_wp(engine, "downgrade")
    assert "auth_kind" not in _columns(engine, "social_connections")


def test_wordpress_revision_is_followed_by_source_site():
    children = [
        p.name for p in _REV.parent.glob("*.py")
        if 'down_revision = "add_wordpress_source_columns"' in p.read_text()
    ]
    assert children == ["add_project_source_site.py"]


_SITE_REV = _REV.parent / "add_project_source_site.py"


def test_source_site_revision_adds_column_idempotently(tmp_path):
    spec = importlib.util.spec_from_file_location("rev_source_site", _SITE_REV)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.down_revision == "add_wordpress_source_columns"
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'site.db'}")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE projects (id INTEGER PRIMARY KEY)"))

    def run(fn):
        with engine.begin() as conn:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                getattr(mod, fn)()

    run("upgrade")
    run("upgrade")
    assert "source_site" in _columns(engine, "projects")
    run("downgrade")
    assert "source_site" not in _columns(engine, "projects")


def test_public_api_revision_follows_mcp_oauth_state_text():
    # develop's mcp_oauth_codes_state_text landed on add_project_source_site, so
    # the public API revision was rebased onto it to keep a single head.
    children = [
        p.name for p in _REV.parent.glob("*.py")
        if 'down_revision = "mcp_oauth_codes_state_text"' in p.read_text()
    ]
    assert children == ["add_public_api.py"]


_API_REV = _REV.parent / "add_public_api.py"


def test_public_api_revision_is_idempotent_and_reversible(tmp_path):
    spec = importlib.util.spec_from_file_location("rev_public_api", _API_REV)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.down_revision == "mcp_oauth_codes_state_text"
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'api.db'}")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        conn.execute(sa.text("CREATE TABLE projects (id INTEGER PRIMARY KEY)"))

    def run(fn):
        with engine.begin() as conn:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                getattr(mod, fn)()

    run("upgrade")
    run("upgrade")
    tables = set(sa.inspect(engine).get_table_names())
    assert {"api_keys", "api_project_links"} <= tables
    # The partner-app integration is gone: none of its columns are created.
    assert "billing_source" not in _columns(engine, "users")
    link_cols = _columns(engine, "api_project_links")
    assert "partner_slug" not in link_cols and "partner_quota_state" not in link_cols
    assert "external_user_id" in link_cols
    run("downgrade")
    tables = set(sa.inspect(engine).get_table_names())
    assert "api_keys" not in tables and "api_project_links" not in tables


def test_public_api_revision_is_followed_by_key_encryption():
    children = [
        p.name for p in _REV.parent.glob("*.py")
        if 'down_revision = "add_public_api"' in p.read_text()
    ]
    assert children == ["add_api_key_encrypted.py"]


def test_api_key_encrypted_revision_is_idempotent_and_the_head(tmp_path):
    spec = importlib.util.spec_from_file_location("rev_api_key_enc", _REV.parent / "add_api_key_encrypted.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.down_revision == "add_public_api"
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'enc.db'}")
    with engine.begin() as conn:
        # api_keys as add_public_api created it: no key_encrypted yet.
        conn.execute(sa.text("CREATE TABLE api_keys (id INTEGER PRIMARY KEY, key_hash VARCHAR(64))"))

    def run(fn):
        with engine.begin() as conn:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                getattr(mod, fn)()

    run("upgrade")
    run("upgrade")
    assert "key_encrypted" in _columns(engine, "api_keys")
    run("downgrade")
    assert "key_encrypted" not in _columns(engine, "api_keys")

    children = [
        p.name for p in _REV.parent.glob("*.py")
        if 'down_revision = "add_api_key_encrypted"' in p.read_text()
    ]
    assert children == ["drop_partner_app.py"]


def test_drop_partner_app_cleans_up_an_old_partner_schema(tmp_path):
    spec = importlib.util.spec_from_file_location("rev_drop_partner", _REV.parent / "drop_partner_app.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.down_revision == "add_api_key_encrypted"
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'partner.db'}")
    with engine.begin() as conn:
        # The shape the old add_public_api left behind, with a service account.
        conn.execute(sa.text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255), is_active BOOLEAN, "
            "auth_provider VARCHAR(16), billing_source VARCHAR(16) NOT NULL DEFAULT 'blog2video')"
        ))
        conn.execute(sa.text("INSERT INTO users VALUES (1, 'real@example.com', 1, 'google', 'blog2video')"))
        conn.execute(sa.text("INSERT INTO users VALUES (2, 'svc@partner.invalid', 1, 'partner', 'partner')"))
        conn.execute(sa.text(
            "CREATE TABLE api_project_links (id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, "
            "external_user_id VARCHAR(255), partner_slug VARCHAR(64), "
            "partner_quota_state VARCHAR(16) NOT NULL DEFAULT 'none')"
        ))
        conn.execute(sa.text("CREATE INDEX ix_api_project_links_partner_slug ON api_project_links (partner_slug)"))
        conn.execute(sa.text("INSERT INTO api_project_links VALUES (1, 10, 'u1', 'acme', 'charged')"))

    def run(fn):
        with engine.begin() as conn:
            ctx = MigrationContext.configure(conn)
            with Operations.context(ctx):
                getattr(mod, fn)()

    run("upgrade")
    run("upgrade")
    assert "billing_source" not in _columns(engine, "users")
    assert _columns(engine, "api_project_links") == {"id", "project_id", "external_user_id"}
    with engine.connect() as conn:
        rows = dict(
            (r.id, (bool(r.is_active), r.auth_provider))
            for r in conn.execute(sa.text("SELECT id, is_active, auth_provider FROM users"))
        )
        assert conn.execute(sa.text("SELECT external_user_id FROM api_project_links")).scalar() == "u1"
    assert rows == {1: (True, "google"), 2: (False, "email")}
    run("downgrade")  # a no-op, but must not fail

    children = [
        p.name for p in _REV.parent.glob("*.py")
        if 'down_revision = "drop_partner_app"' in p.read_text()
    ]
    assert children == []
