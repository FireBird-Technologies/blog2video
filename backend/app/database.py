from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import QueuePool

from app.config import settings


IS_SQLITE = settings.DATABASE_URL.startswith("sqlite")

# Handle SQLite vs PostgreSQL connection args
connect_args: dict = {}
engine_kwargs: dict = {}

if IS_SQLITE:
    # Required for SQLite in multithreaded FastAPI apps
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


def _migrate_sqlite(eng) -> None:
    """
    Lightweight, idempotent migrations for SQLite.

    - Only adds missing columns for known tables.
    - Never drops/renames columns or tables.
    - Safe to run on every startup.
    """
    insp = inspect(eng)

    # ─── Projects table ──────────────────────────────────────────────
    if "projects" in insp.get_table_names():
        columns = {c["name"] for c in insp.get_columns("projects")}
        migrations = {
            "voice_gender": "VARCHAR(10) DEFAULT 'female'",
            "voice_accent": "VARCHAR(10) DEFAULT 'american'",
            "studio_unlocked": "BOOLEAN DEFAULT 0",
            "studio_port": "INTEGER",
            "player_port": "INTEGER",
            "accent_color": "VARCHAR(20) DEFAULT '#7C3AED'",
            "bg_color": "VARCHAR(20) DEFAULT '#FFFFFF'",
            "text_color": "VARCHAR(20) DEFAULT '#000000'",
            "animation_instructions": "TEXT",
            "r2_video_key": "VARCHAR(512)",
            "r2_video_url": "VARCHAR(2048)",
            "logo_r2_key": "VARCHAR(512)",
            "logo_r2_url": "VARCHAR(2048)",
            "logo_position": "VARCHAR(20) DEFAULT 'bottom_right'",
            "logo_opacity": "REAL DEFAULT 0.9",
            "logo_size": "REAL DEFAULT 100",
            "custom_voice_id": "VARCHAR(100)",
            "template": "VARCHAR(50) DEFAULT 'default'",
            "video_style": "VARCHAR(30) DEFAULT 'explainer'",
            "aspect_ratio": "VARCHAR(20) DEFAULT 'landscape'",
            "ai_assisted_editing_count": "INTEGER DEFAULT 0",
        }
        with eng.begin() as conn:
            for col_name, col_def in migrations.items():
                if col_name not in columns:
                    conn.execute(
                        text(f"ALTER TABLE projects ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Users table ─────────────────────────────────────────────────
    if "users" in insp.get_table_names():
        user_cols = {c["name"] for c in insp.get_columns("users")}
        user_migrations = {
            "picture": "VARCHAR(2048)",
            "plan": "VARCHAR(20) DEFAULT 'free'",
            "stripe_customer_id": "VARCHAR(255)",
            "stripe_subscription_id": "VARCHAR(255)",
            "videos_used_this_period": "INTEGER DEFAULT 0",
            "video_limit_bonus": "INTEGER DEFAULT 0",
            "period_start": "DATETIME",
            "is_active": "BOOLEAN DEFAULT 1",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in user_migrations.items():
                if col_name not in user_cols:
                    conn.execute(
                        text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Assets table ────────────────────────────────────────────────
    if "assets" in insp.get_table_names():
        asset_cols = {c["name"] for c in insp.get_columns("assets")}
        asset_migrations = {
            "r2_key": "VARCHAR(512)",
            "r2_url": "VARCHAR(2048)",
            "excluded": "BOOLEAN DEFAULT 0",
        }
        with eng.begin() as conn:
            for col_name, col_def in asset_migrations.items():
                if col_name not in asset_cols:
                    conn.execute(
                        text(f"ALTER TABLE assets ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Scenes table ────────────────────────────────────────────────
    if "scenes" in insp.get_table_names():
        scene_cols = {c["name"] for c in insp.get_columns("scenes")}
        scene_migrations = {
            "display_text": "TEXT",
            "remotion_code": "TEXT",
            "voiceover_path": "VARCHAR(512)",
            "duration_seconds": "REAL DEFAULT 10.0",
            "preferred_layout": "VARCHAR(64)",
        }
        with eng.begin() as conn:
            for col_name, col_def in scene_migrations.items():
                if col_name not in scene_cols:
                    conn.execute(
                        text(f"ALTER TABLE scenes ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Chat messages table ────────────────────────────────────────
    if "chat_messages" in insp.get_table_names():
        chat_cols = {c["name"] for c in insp.get_columns("chat_messages")}
        chat_migrations = {
            # In case table existed without created_at
            "created_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in chat_migrations.items():
                if col_name not in chat_cols:
                    conn.execute(
                        text(f"ALTER TABLE chat_messages ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Custom templates table ─────────────────────────────────────
    if "custom_templates" in insp.get_table_names():
        ct_cols = {c["name"] for c in insp.get_columns("custom_templates")}
        ct_migrations = {
            "source_url": "VARCHAR(2048)",
            "category": "VARCHAR(50) DEFAULT 'blog'",
            "supported_video_style": "VARCHAR(30) DEFAULT 'explainer'",
            "theme": "TEXT",
            "generated_prompt": "TEXT",
            "preview_image_url": "VARCHAR(2048)",
        }
        with eng.begin() as conn:
            for col_name, col_def in ct_migrations.items():
                if col_name not in ct_cols:
                    conn.execute(
                        text(f"ALTER TABLE custom_templates ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Subscription plans table ───────────────────────────────────
    if "subscription_plans" in insp.get_table_names():
        sp_cols = {c["name"] for c in insp.get_columns("subscription_plans")}
        sp_migrations = {
            "description": "TEXT",
            "price_cents": "INTEGER NOT NULL DEFAULT 0",
            "currency": "VARCHAR(3) DEFAULT 'usd'",
            "billing_interval": "VARCHAR(20) DEFAULT 'one_time'",
            "video_limit": "INTEGER DEFAULT 0",
            "includes_studio": "BOOLEAN DEFAULT 0",
            "includes_chat_editor": "BOOLEAN DEFAULT 0",
            "includes_priority_support": "BOOLEAN DEFAULT 0",
            "stripe_price_id": "VARCHAR(255)",
            "is_active": "BOOLEAN DEFAULT 1",
            "sort_order": "INTEGER DEFAULT 0",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in sp_migrations.items():
                if col_name not in sp_cols:
                    conn.execute(
                        text(f"ALTER TABLE subscription_plans ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Subscriptions table ────────────────────────────────────────
    if "subscriptions" in insp.get_table_names():
        sub_cols = {c["name"] for c in insp.get_columns("subscriptions")}
        sub_migrations = {
            "status": "VARCHAR(32) DEFAULT 'active'",
            "stripe_subscription_id": "VARCHAR(255)",
            "stripe_checkout_session_id": "VARCHAR(255)",
            "project_id": "INTEGER",
            "current_period_start": "DATETIME",
            "current_period_end": "DATETIME",
            "videos_used": "INTEGER DEFAULT 0",
            "amount_paid_cents": "INTEGER DEFAULT 0",
            "canceled_at": "DATETIME",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in sub_migrations.items():
                if col_name not in sub_cols:
                    conn.execute(
                        text(f"ALTER TABLE subscriptions ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Scene edit history table ───────────────────────────────────
    if "scene_edit_history" in insp.get_table_names():
        seh_cols = {c["name"] for c in insp.get_columns("scene_edit_history")}
        seh_migrations = {
            "project_id": "INTEGER",
            "scene_id": "INTEGER",
            "field_name": "TEXT",
            "old_value": "TEXT",
            "new_value": "TEXT",
            "user_instruction": "TEXT",
            "is_ai_assisted": "BOOLEAN DEFAULT 0",
            "edited_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in seh_migrations.items():
                if col_name not in seh_cols:
                    conn.execute(
                        text(f"ALTER TABLE scene_edit_history ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Project edit history table ─────────────────────────────────
    if "project_edit_history" in insp.get_table_names():
        peh_cols = {c["name"] for c in insp.get_columns("project_edit_history")}
        peh_migrations = {
            "project_id": "INTEGER",
            "field_name": "TEXT",
            "old_value": "TEXT",
            "new_value": "TEXT",
            "is_ai_assisted": "BOOLEAN DEFAULT 0",
            "edited_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in peh_migrations.items():
                if col_name not in peh_cols:
                    conn.execute(
                        text(f"ALTER TABLE project_edit_history ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Prebuilt voices table ──────────────────────────────────────
    if "prebuilt_voices" in insp.get_table_names():
        pb_cols = {c["name"] for c in insp.get_columns("prebuilt_voices")}
        pb_migrations = {
            "preview_url": "VARCHAR(2048)",
            "labels": "TEXT DEFAULT '{}'",
            "description": "TEXT",
            "plan": "VARCHAR(20) DEFAULT 'paid'",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in pb_migrations.items():
                if col_name not in pb_cols:
                    conn.execute(
                        text(f"ALTER TABLE prebuilt_voices ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Custom voices table ────────────────────────────────────────
    if "custom_voices" in insp.get_table_names():
        cv_cols = {c["name"] for c in insp.get_columns("custom_voices")}
        cv_migrations = {
            "prompt_text": "TEXT",
            "response_json": "TEXT",
            "form_gender": "VARCHAR(50)",
            "form_age": "VARCHAR(50)",
            "form_persona": "VARCHAR(100)",
            "form_speed": "VARCHAR(50)",
            "form_accent": "VARCHAR(100)",
            "preview_url": "VARCHAR(2048)",
            "created_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in cv_migrations.items():
                if col_name not in cv_cols:
                    conn.execute(
                        text(f"ALTER TABLE custom_voices ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Saved voices table ─────────────────────────────────────────
    if "saved_voices" in insp.get_table_names():
        sv_cols = {c["name"] for c in insp.get_columns("saved_voices")}
        sv_migrations = {
            "preview_url": "VARCHAR(2048)",
            "source": "VARCHAR(20) DEFAULT 'custom'",
            "plan": "VARCHAR(20)",
            "gender": "VARCHAR(20)",
            "accent": "VARCHAR(50)",
            "description": "TEXT",
            "created_at": "DATETIME",
            "custom_voice_id": "INTEGER",
        }
        with eng.begin() as conn:
            for col_name, col_def in sv_migrations.items():
                if col_name not in sv_cols:
                    conn.execute(
                        text(f"ALTER TABLE saved_voices ADD COLUMN {col_name} {col_def}")
                    )


def init_db():
    """
    Initialize database schema and seed reference data.

    - SQLite: create missing tables and add missing columns in-place.
    - PostgreSQL: schema is managed by Alembic; this only seeds plans.
    """
    from app.models import (  # noqa: F401
        Asset,
        ChatMessage,
        CustomTemplate,
        Project,
        CustomVoice,
        SavedVoice,
        Scene,
        Subscription,
        SubscriptionPlan,
        User,
        ProjectEditHistory,
        SceneEditHistory,
        # Ensure SQLite creates the prebuilt_voices table in dev/local.
        PrebuiltVoice,
    )
    from app.models.subscription import seed_plans

    # For SQLite we manage schema programmatically (dev / local use).
    if IS_SQLITE:
        # Create any missing tables defined by SQLAlchemy models.
        Base.metadata.create_all(bind=engine)
        # Add new columns to existing tables without destructive changes.
        _migrate_sqlite(engine)

    # Seed subscription plans (idempotent) for all databases.
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()
