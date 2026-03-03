from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import QueuePool

from app.config import settings

# Handle SQLite vs PostgreSQL connection args
connect_args = {}
engine_kwargs = {}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
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
    """Load models and seed plan data; schema is managed by Alembic."""
    from app.models import (  # noqa: F401
        Asset,
        ChatMessage,
        CustomTemplate,
        Project,
        Scene,
        Subscription,
        SubscriptionPlan,
        User,
    )
    from app.models.subscription import seed_plans

    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()
