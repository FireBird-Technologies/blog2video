from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool, StaticPool
from app.config import settings

# Handle SQLite vs PostgreSQL connection args
connect_args = {}
engine_kwargs = {}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    engine_kwargs["poolclass"] = StaticPool
else:
    # PostgreSQL connection pool settings
    engine_kwargs["poolclass"] = QueuePool
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_pre_ping"] = True  # reconnect on stale connections

    # Neon requires SSL
    if "sslmode" not in settings.DATABASE_URL:
        connect_args["sslmode"] = "require"

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables, run lightweight migrations, and seed plans."""
    from app.models import User, Project, Scene, Asset, ChatMessage, SubscriptionPlan, Subscription  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate(engine)

    # Seed subscription plans on every startup (idempotent)
    from app.models.subscription import seed_plans
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()


def _migrate(eng):
    """Add columns that may be missing from older schemas."""
    from sqlalchemy import text, inspect

    insp = inspect(eng)
    if "projects" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("projects")}
    is_pg = not settings.DATABASE_URL.startswith("sqlite")

    with eng.begin() as conn:
        # Helper: ALTER TABLE ADD COLUMN (Postgres ignores IF NOT EXISTS style,
        # so we check the column set in Python first)
        migrations = {
            "voice_gender": "VARCHAR(10) DEFAULT 'female'",
            "voice_accent": "VARCHAR(10) DEFAULT 'american'",
            "player_port": "INTEGER",
            "accent_color": "VARCHAR(20) DEFAULT '#7C3AED'",
            "bg_color": "VARCHAR(20) DEFAULT '#0A0A0A'",
            "text_color": "VARCHAR(20) DEFAULT '#FFFFFF'",
            "animation_instructions": "TEXT",
            "studio_unlocked": "BOOLEAN DEFAULT 0",
        }
        for col_name, col_def in migrations.items():
            if col_name not in cols:
                conn.execute(text(
                    f"ALTER TABLE projects ADD COLUMN {col_name} {col_def}"
                ))
