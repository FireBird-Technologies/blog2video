from logging.config import fileConfig

from sqlalchemy import create_engine
from sqlalchemy import pool

from alembic import context

# Load app config and metadata so autogenerate sees all models
from app.config import settings
from app.database import Base

# Import all models so they are registered on Base.metadata
from app.models import (  # noqa: F401
    User,
    Project,
    Scene,
    Asset,
    ChatMessage,
    SubscriptionPlan,
    Subscription,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Use same DB URL and connection behavior as the app
def get_url():
    return settings.DATABASE_URL


def get_connect_args():
    if settings.DATABASE_URL.startswith("sqlite"):
        return {"check_same_thread": False}
    connect_args = {}
    if "sslmode" not in settings.DATABASE_URL:
        connect_args["sslmode"] = "require"
    return connect_args


def get_engine_kwargs():
    if settings.DATABASE_URL.startswith("sqlite"):
        return {"poolclass": pool.StaticPool}
    return {
        "poolclass": pool.QueuePool,
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
    }


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = create_engine(
        get_url(),
        connect_args=get_connect_args(),
        **get_engine_kwargs(),
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
