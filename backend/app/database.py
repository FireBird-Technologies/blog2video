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
    engine_kwargs["pool_recycle"] = 300  # recycle connections after 5 min to avoid SSL drops

    # Neon requires SSL
    if "sslmode" not in settings.DATABASE_URL:
        connect_args["sslmode"] = "require"

    # TCP keepalives prevent Neon (and intermediate firewalls/NATs) from
    # killing connections that sit idle while a long DSPy/LLM call awaits.
    # pool_pre_ping only checks on checkout; a connection already held by an
    # active session is not re-pinged, so a 30-60s LLM await can silently
    # break the socket and the next commit fails with "server closed the
    # connection unexpectedly". Keepalives keep the socket warm at the OS
    # level — first probe at 30s idle, then every 10s, give up after 5.
    connect_args["keepalives"] = 1
    connect_args["keepalives_idle"] = 30
    connect_args["keepalives_interval"] = 10
    connect_args["keepalives_count"] = 5

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

if IS_SQLITE:
    # SQLite disables foreign-key enforcement per-connection by default, so
    # ON DELETE CASCADE would not fire — deleting a project would orphan its
    # members, edit history, comments, etc. Turn it on for every connection.
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _sqlite_fk_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
            "logo_size": "REAL DEFAULT 70",
            "custom_voice_id": "VARCHAR(100)",
            "template": "VARCHAR(50) DEFAULT 'default'",
            "crafted_template_id": "INTEGER",
            "video_style": "VARCHAR(30) DEFAULT 'explainer'",
            "aspect_ratio": "VARCHAR(20) DEFAULT 'landscape'",
            "ai_assisted_editing_count": "INTEGER DEFAULT 0",
            "font_family": "VARCHAR(255)",
            "is_active": "BOOLEAN DEFAULT 1",
            "embed_token": "VARCHAR(64)",
            "video_length": "VARCHAR(10) DEFAULT 'auto'",
            "playback_speed": "REAL DEFAULT 1.0",
            "captions_enabled": "BOOLEAN DEFAULT 0",
            "caption_position": "VARCHAR(20) DEFAULT 'bottom_center'",
            "caption_font_family": "VARCHAR(50) DEFAULT 'inter'",
            "caption_font_size": "VARCHAR(10) DEFAULT '36'",
            "caption_offset": "INTEGER DEFAULT 0",
            "content_language": "VARCHAR(10)",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
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
            "ai_edit_credits": "INTEGER DEFAULT 6",
            "custom_template_bonus": "INTEGER DEFAULT 0",
            "custom_templates_created": "INTEGER DEFAULT 0",
            "period_start": "DATETIME",
            "is_active": "BOOLEAN DEFAULT 1",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
            "retention_offer_shown_count": "INTEGER DEFAULT 0",
            "retention_offer_suppressed": "BOOLEAN DEFAULT 0",
            "email_unsubscribed": "BOOLEAN DEFAULT 0",
            "last_coupon_email_at": "DATETIME",
            "referrals_given": "INTEGER DEFAULT 0",
            "referral_video_bonus": "INTEGER DEFAULT 0",
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
            "extra_hold_seconds": "REAL",
            "scene_type": "VARCHAR(20)",
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
            "theme": "TEXT",
            "generated_prompt": "TEXT",
            "preview_image_url": "VARCHAR(2048)",
            "component_code": "TEXT",
            "intro_code": "TEXT",
            "outro_code": "TEXT",
            "brand_kit_id": "INTEGER",
            "current_version_id": "INTEGER",
            "content_codes": "TEXT",
            "content_archetype_ids": "TEXT",
            "image_box_aspect_ratios": "TEXT",
            "generation_failed": "BOOLEAN DEFAULT 0",
            "created_at": "DATETIME",
            "updated_at": "DATETIME",
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
            "quantity": "INTEGER DEFAULT 1",
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
            "user_id": "INTEGER",
            "change_set_id": "TEXT",
            "target": "TEXT DEFAULT 'published'",
            "reverted": "BOOLEAN DEFAULT 0",
            "revert_of_change_set_id": "TEXT",
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
            "user_id": "INTEGER",
            "change_set_id": "TEXT",
            "target": "TEXT DEFAULT 'published'",
            "reverted": "BOOLEAN DEFAULT 0",
            "revert_of_change_set_id": "TEXT",
        }
        with eng.begin() as conn:
            for col_name, col_def in peh_migrations.items():
                if col_name not in peh_cols:
                    conn.execute(
                        text(f"ALTER TABLE project_edit_history ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Template versions table ──────────────────────────────────────
    if "template_versions" in insp.get_table_names():
        tv_cols = {c["name"] for c in insp.get_columns("template_versions")}
        tv_migrations = {
            "content_codes": "TEXT",
        }
        with eng.begin() as conn:
            for col_name, col_def in tv_migrations.items():
                if col_name not in tv_cols:
                    conn.execute(
                        text(f"ALTER TABLE template_versions ADD COLUMN {col_name} {col_def}")
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

    # ─── Project template change jobs ────────────────────────────────
    if "project_template_change_jobs" in insp.get_table_names():
        tcj_cols = {c["name"] for c in insp.get_columns("project_template_change_jobs")}
        with eng.begin() as conn:
            if "scene_snapshot" not in tcj_cols:
                conn.execute(
                    text("ALTER TABLE project_template_change_jobs ADD COLUMN scene_snapshot TEXT")
                )

    # ─── Project voice change jobs ───────────────────────────────────
    if "project_voice_change_jobs" in insp.get_table_names():
        vcj_cols = {c["name"] for c in insp.get_columns("project_voice_change_jobs")}
        with eng.begin() as conn:
            if "voice_snapshot" not in vcj_cols:
                conn.execute(
                    text("ALTER TABLE project_voice_change_jobs ADD COLUMN voice_snapshot TEXT")
                )

    # ─── Project members (collaboration ACL) ─────────────────────────
    if "project_members" in insp.get_table_names():
        pm_cols = {c["name"] for c in insp.get_columns("project_members")}
        pm_migrations = {
            "user_id": "INTEGER",
            "invited_email": "VARCHAR(320)",
            "role": "VARCHAR(20) DEFAULT 'editor'",
            "status": "VARCHAR(20) DEFAULT 'pending'",
            "invited_by_id": "INTEGER",
            "invite_token": "VARCHAR(64)",
            "error_message": "VARCHAR(500)",
            "created_at": "DATETIME",
            "accepted_at": "DATETIME",
        }
        with eng.begin() as conn:
            for col_name, col_def in pm_migrations.items():
                if col_name not in pm_cols:
                    conn.execute(
                        text(f"ALTER TABLE project_members ADD COLUMN {col_name} {col_def}")
                    )

    # ─── Scene comments (threaded replies) ───────────────────────────
    if "scene_comments" in insp.get_table_names():
        sc_cols = {c["name"] for c in insp.get_columns("scene_comments")}
        # Nullable self-reference to the parent comment (null = root comment).
        sc_migrations = {"parent_id": "INTEGER"}
        with eng.begin() as conn:
            for col_name, col_def in sc_migrations.items():
                if col_name not in sc_cols:
                    conn.execute(
                        text(f"ALTER TABLE scene_comments ADD COLUMN {col_name} {col_def}")
                    )


def _backfill_owner_members(eng) -> None:
    """Ensure every project has an OWNER ProjectMember row for its ``user_id``.

    Idempotent: only inserts rows for projects that don't already have an OWNER
    member. Runs after tables exist. Used on SQLite; the Alembic migration does
    the equivalent for Postgres.
    """
    import uuid

    insp = inspect(eng)
    names = insp.get_table_names()
    if "projects" not in names or "project_members" not in names:
        return

    with eng.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT p.id AS project_id, p.user_id AS user_id, u.email AS email
                FROM projects p
                JOIN users u ON u.id = p.user_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM project_members m
                    WHERE m.project_id = p.id AND m.role = 'owner'
                )
                """
            )
        ).fetchall()
        for r in rows:
            conn.execute(
                text(
                    """
                    INSERT INTO project_members
                        (project_id, user_id, invited_email, role, status,
                         invited_by_id, invite_token, created_at, accepted_at)
                    VALUES
                        (:pid, :uid, :email, 'owner', 'accepted',
                         :uid, :token, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {
                    "pid": r.project_id,
                    "uid": r.user_id,
                    "email": r.email,
                    "token": uuid.uuid4().hex,
                },
            )


def _ai_edit_credits_backfilled(eng) -> bool:
    """Whether the (non-idempotent, additive) AI-edit backfill has already run.

    Uses a one-row ``app_migration_flags`` marker table so re-running init_db on an
    already-migrated dev DB never adds the free grant twice.
    """
    with eng.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS app_migration_flags "
                "(flag VARCHAR(100) PRIMARY KEY, applied_at DATETIME)"
            )
        )
        row = conn.execute(
            text("SELECT 1 FROM app_migration_flags WHERE flag = :f"),
            {"f": "ai_edit_credits_free_grant"},
        ).first()
    return row is not None


def _mark_ai_edit_credits_backfilled(conn) -> None:
    """Record that the AI-edit backfill ran (within the caller's transaction)."""
    conn.execute(
        text(
            "INSERT INTO app_migration_flags (flag, applied_at) "
            "VALUES (:f, CURRENT_TIMESTAMP)"
        ),
        {"f": "ai_edit_credits_free_grant"},
    )


def _backfill_ai_edit_credits(eng) -> None:
    """Grant every user the free AI-edit pool by adding ``FREE_AI_EDIT_CREDITS``.

    Users at 0 (or NULL) become exactly the grant; users who already have credits
    get the grant added on top (e.g. 20 → 26). Runs once — NOT idempotent, so it is
    guarded by ``_ai_edit_credits_backfilled`` so re-running init_db never re-adds.
    Postgres does the equivalent in an Alembic migration.
    """
    from app.models.user import FREE_AI_EDIT_CREDITS

    insp = inspect(eng)
    if "users" not in insp.get_table_names():
        return
    if "ai_edit_credits" not in {c["name"] for c in insp.get_columns("users")}:
        return
    if _ai_edit_credits_backfilled(eng):
        return

    with eng.begin() as conn:
        conn.execute(
            text(
                "UPDATE users SET ai_edit_credits = "
                "COALESCE(ai_edit_credits, 0) + :grant"
            ),
            {"grant": FREE_AI_EDIT_CREDITS},
        )
        _mark_ai_edit_credits_backfilled(conn)


def init_db():
    """
    Initialize database schema and seed reference data.

    - SQLite: create missing tables and add missing columns in-place.
    - PostgreSQL: schema is managed by Alembic; this only seeds plans.
    """
    from app.models import (  # noqa: F401
        Asset,
        BrandKit,
        ChatMessage,
        CustomTemplate,
        CraftedTemplate,
        CraftedTemplateEntitlement,
        Project,
        CustomVoice,
        SavedVoice,
        Scene,
        Subscription,
        SubscriptionPlan,
        User,
        ProjectEditHistory,
        SceneEditHistory,
        TemplateVersion,
        PrebuiltVoice,
        Review,
        TemplateRating,
        ProjectTemplateChangeJob,
        ProjectRegenerateScriptJob,
        ProjectVoiceChangeJob,
        Referral,
        ReferralSignup,
        SupportConversation,
        SupportMessage,
        ProjectMember,
    )
    from app.models.subscription import seed_plans

    # For SQLite we manage schema programmatically (dev / local use).
    if IS_SQLITE:
        # Create any missing tables defined by SQLAlchemy models.
        Base.metadata.create_all(bind=engine)
        # Add new columns to existing tables without destructive changes.
        _migrate_sqlite(engine)
        # Ensure every existing project has an OWNER collaboration member row.
        _backfill_owner_members(engine)
        # Grant every existing user the free per-user AI-edit pool.
        _backfill_ai_edit_credits(engine)

    # Seed subscription plans (idempotent) for all databases.
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()
