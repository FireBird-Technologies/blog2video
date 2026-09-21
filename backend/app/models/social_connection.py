from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Platform slugs. Kept as plain strings rather than a SQLAlchemy Enum so adding a
# platform is a code change only — no migration, matching how `Project.template`
# and the job tables' `status` columns are typed.
PLATFORM_YOUTUBE = "youtube"
PLATFORM_X = "x"
PLATFORM_LINKEDIN = "linkedin"

# Connection lifecycle.
#   active  — usable; tokens decrypt and the provider still honours them
#   revoked — the user (or the provider) withdrew the grant; needs a reconnect
#   error   — tokens are present but unusable, e.g. undecryptable after a
#             SOCIAL_TOKEN_ENC_KEY rotation. Also needs a reconnect, but is worth
#             distinguishing from `revoked` because the cause is on our side.
STATUS_ACTIVE = "active"
STATUS_REVOKED = "revoked"
STATUS_ERROR = "error"


class SocialConnection(Base):
    """One user's OAuth grant for one publishing platform (YouTube, X).

    Account-level, not project-level: the grant is a property of the user's
    identity on that platform, and every project they own publishes through the
    same one. The unique (user_id, platform) constraint makes reconnecting an
    UPSERT rather than an accumulation of dead rows — there is never more than
    one connection per user per platform, so "is this user connected?" is a
    single lookup with no ordering or tie-break.

    This is deliberately separate from the Google sign-in identity on
    ``User.google_id``. That one is an ID-token verification with no scopes and
    no refresh token (see routers/auth.py), which cannot upload anything; this
    one is a full authorization-code grant carrying ``youtube.upload``. They may
    name the same Google account and still are not interchangeable.

    Both tokens are Fernet ciphertext produced by services/token_crypto.py and
    are NEVER returned by any API response — the connection endpoints expose
    only the display fields (``account_name`` and friends) so the UI can say
    "Connected as ...". If the encryption key is unset, connecting is refused
    outright rather than falling back to plaintext: a ``youtube.upload`` refresh
    token is a standing capability to publish to the user's channel.
    """

    __tablename__ = "social_connections"
    __table_args__ = (
        UniqueConstraint("user_id", "platform", name="uq_social_connections_user_platform"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # ─── Credentials (Fernet ciphertext, never plaintext) ────────────────────
    access_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Nullable because a provider may decline to issue one. For YouTube that is
    # the `prompt=consent` failure mode: without it Google returns a refresh
    # token only on the first-ever grant, so a reconnect yields an access token
    # that dies in an hour with no way to renew it.
    refresh_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    # When the ACCESS token expires (UTC). The refresh token's own lifetime is
    # not knowable from the grant, so it is not modelled.
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Space-joined granted scopes as the provider reported them — which can be a
    # subset of what was asked for if the user unticked a box on the consent
    # screen. Checked before an upload so a missing scope surfaces as "reconnect"
    # rather than an opaque 403 from the provider mid-upload.
    scopes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ─── Display identity (safe to return to the client) ─────────────────────
    account_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    account_handle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default=STATUS_ACTIVE, index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="social_connections")
    publish_jobs = relationship("SocialPublishJob", back_populates="connection")
