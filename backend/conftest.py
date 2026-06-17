"""
Root pytest configuration for the Tier A backend test suite.

CRITICAL ISOLATION GUARANTEE
----------------------------
This module sets ``DATABASE_URL`` to a throwaway local SQLite file *before*
``app`` (and therefore ``app.config`` / ``app.database``) is ever imported.
Even if ``.env`` points ``DATABASE_URL`` at the shared Neon develop database,
the test process overrides it here and "fails closed" onto disposable SQLite —
the suite can never read from or write to a real/remote database.

The same env override also neutralises any external credentials so a stray
un-mocked call cannot reach a live service with real keys.
"""
from __future__ import annotations

import os
import tempfile

# ── Fail-closed env overrides — MUST run before any `app.*` import ──────────
# A unique temp file per test session; removed in the session-scoped fixture.
_TEST_DB_FD, _TEST_DB_PATH = tempfile.mkstemp(prefix="b2v_test_", suffix=".db")
os.close(_TEST_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"

# Deterministic JWT signing for token fixtures, regardless of local .env.
# >= 32 bytes to satisfy PyJWT's HMAC key-length recommendation.
os.environ["JWT_SECRET"] = "test-secret-not-for-production-0123456789"

# Force the template-studio gate "disabled" regardless of the real .env value,
# so /auth/status deterministically reports gated=False in tests.
os.environ["TEMPLATE_STUDIO_PASSWORD"] = ""

# Keep crafted templates disabled (the default) so list/detail routes take their
# deterministic disabled-path (empty list / 404) in tests.
os.environ["CRAFTED_TEMPLATES_ENABLED"] = "false"

# Blank out external credentials so nothing can authenticate to a live service
# even if a mock is missed (defense in depth alongside the kill_network fixture).
for _var in (
    "ANTHROPIC_API_KEY", "TEMPLATE_CREATION_ANTHROPIC_API_KEY", "OPENAI_API_KEY",
    "GEMINI_API_KEY", "ELEVENLABS_API_KEY", "EXA_API_KEY", "FIRECRAWL_API_KEY",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "GOOGLE_CLIENT_SECRET",
    "RESEND_API_KEY", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
):
    os.environ[_var] = ""

import pytest  # noqa: E402  (import after env setup is intentional)
from sqlalchemy import event  # noqa: E402

# Importing app.database now binds its engine to the temp SQLite file above.
from app import database  # noqa: E402
from app.database import Base  # noqa: E402


# ── pysqlite transaction-control workaround ─────────────────────────────────
# The stdlib sqlite3 driver does NOT emit BEGIN the way SQLAlchemy's nested-
# transaction / SAVEPOINT machinery expects, so a per-test outer transaction
# cannot be rolled back (committed rows leak between tests). The documented fix
# is to disable the driver's implicit transaction handling and emit BEGIN
# ourselves, which makes the db_session rollback isolation actually work.
@event.listens_for(database.engine, "connect")
def _sqlite_disable_autobegin(dbapi_connection, _record):
    dbapi_connection.isolation_level = None


@event.listens_for(database.engine, "begin")
def _sqlite_emit_begin(conn):
    conn.exec_driver_sql("BEGIN")


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    """Create the full schema once on the disposable SQLite DB, then clean up.

    Importing every model module registers all tables on ``Base.metadata``;
    we reuse the app's own model-import list via ``init_db``'s imports by
    importing the models package.
    """
    import app.models  # noqa: F401  — registers all mapped classes on Base
    from app.models.subscription import seed_plans

    Base.metadata.create_all(bind=database.engine)

    # Seed reference data (subscription plans) once, committed OUTSIDE the
    # per-test transaction so it is visible to every test and survives the
    # per-test rollback. billing.list_plans and quota logic depend on these.
    seed_session = database.SessionLocal()
    try:
        seed_plans(seed_session)
    finally:
        seed_session.close()

    yield
    Base.metadata.drop_all(bind=database.engine)
    try:
        os.remove(_TEST_DB_PATH)
    except OSError:
        pass


@pytest.fixture()
def db_session(_create_schema):
    """A transactional session that is rolled back after each test.

    Open one connection, begin an outer transaction, and bind a session to it
    with ``join_transaction_mode="create_savepoint"`` (SQLAlchemy 2.0). That
    makes every ``session.commit()`` in route/test code commit only to a
    SAVEPOINT inside our outer transaction, so the single ``trans.rollback()``
    on teardown discards everything — nothing a test writes survives into the
    next test. (Replaces a hand-rolled savepoint-restart listener that failed
    to contain commits, leaking rows across tests.)
    """
    connection = database.engine.connect()
    trans = connection.begin()
    session = database.SessionLocal(
        bind=connection, join_transaction_mode="create_savepoint"
    )
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    """A ``TestClient`` whose ``get_db`` dependency yields the test session.

    NOTE: instantiated *without* the context-manager form on purpose — that
    would trigger the app ``lifespan`` (init_db + background asyncio cleanup
    loops / email scheduler), which we must not start in tests.
    """
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.main import app

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass  # session lifecycle is owned by the db_session fixture

    app.dependency_overrides[get_db] = _override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)
