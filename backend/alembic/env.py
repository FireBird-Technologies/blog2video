from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base

# Import models so Base.metadata is fully populated for autogenerate.
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

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _alembic_database_url() -> str:
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres") and "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        return f"{db_url}{separator}sslmode=require"
    return db_url


config.set_main_option("sqlalchemy.url", _alembic_database_url())
target_metadata = Base.metadata



def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=False,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
