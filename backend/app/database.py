from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# Handle SQLite-specific connect args
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
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
    """Create all tables and run lightweight migrations."""
    from app.models import User, Project, Scene, Asset, ChatMessage  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate(engine)


def _migrate(eng):
    """Add columns that may be missing from older schemas (SQLite-safe)."""
    from sqlalchemy import text, inspect

    insp = inspect(eng)
    if "projects" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("projects")}
        with eng.begin() as conn:
            if "voice_gender" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN voice_gender VARCHAR(10) DEFAULT 'female'"
                ))
            if "voice_accent" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN voice_accent VARCHAR(10) DEFAULT 'american'"
                ))
            if "player_port" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN player_port INTEGER"
                ))
            if "accent_color" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN accent_color VARCHAR(20) DEFAULT '#7C3AED'"
                ))
            if "bg_color" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN bg_color VARCHAR(20) DEFAULT '#0A0A0A'"
                ))
            if "text_color" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN text_color VARCHAR(20) DEFAULT '#FFFFFF'"
                ))
            if "animation_instructions" not in cols:
                conn.execute(text(
                    "ALTER TABLE projects ADD COLUMN animation_instructions TEXT"
                ))
