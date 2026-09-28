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
    rev = _load_revision()
    assert rev.down_revision == "add_pinned_learning_target"
    versions = _REV.parent
    children = [
        p.name for p in versions.glob("*.py")
        if 'down_revision = "add_content_source_integrations"' in p.read_text()
    ]
    assert children == ["add_wordpress_source_columns.py"]


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


def test_source_site_revision_is_the_head():
    children = [
        p.name for p in _REV.parent.glob("*.py")
        if 'down_revision = "add_project_source_site"' in p.read_text()
    ]
    assert children == []
