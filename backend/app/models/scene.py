from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    narration_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Optional on-screen display text. Falls back to narration_text when empty.
    display_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    visual_description: Mapped[str] = mapped_column(Text, nullable=False)
    remotion_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    voiceover_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Optional talking-head avatar clip rendered from this scene's voiceover (OmniAvatar).
    # Avatars are per-scene and ON DEMAND — the user asks for one from the Scene Edit
    # modal, which runs a SceneAvatarJob. NULL means this scene simply has no overlay.
    # Mirrors voiceover_path (local MEDIA_DIR path; the R2 copy lives on an
    # AssetType.AVATAR asset row, keyed by filename).
    avatar_video_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Which roster presenter this scene's avatar uses (see services/avatar_presets.py).
    avatar_preset: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Matted transparent ProRes 4444 (.mov) twin of avatar_video_path, produced ON
    # DEMAND by services/avatar_matte.py from the mp4 above. Kept BESIDE the mp4
    # rather than replacing it, so the original is always available to re-matte or
    # fall back to. NULL means "not matted yet" — a custom background needs a matte
    # job first.
    avatar_matte_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # Why this scene has no cutout, when the render itself succeeded.
    #
    # The matte now runs inside the Modal render container (see the /render
    # docstring in modal-service/omniavatar/app.py), and it gets exactly ONE
    # attempt: its failures are deterministic (ffmpeg, a bad frame, a codec), so a
    # retry would just hold a billed GPU to fail identically. A failure therefore
    # has to be RECORDED rather than retried.
    #
    # It lives on the Scene and not on the job row because the JOB SUCCEEDED — the
    # mp4 is there and the video plays; only the transparent twin is missing. That
    # is what lets the UI explain why a background change is unavailable and offer
    # the manual re-matte, instead of the reason existing only in a server log.
    # Both columns are cleared on a successful (re-)matte.
    avatar_matte_error: Mapped[str | None] = mapped_column(String(512), nullable=True)
    avatar_matte_failed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    # Per-scene avatar presentation, mirroring Project.avatar_shape / _size /
    # _position / _bg / _opacity.
    #
    # Saving the project-wide Avatar tab STAMPS its values onto every scene
    # (see update_project in routers/projects.py) — global always wins, last
    # write wins. A per-scene edit writes just that row; a later global save
    # overwrites it again. Before that, a scene the user had customised was the
    # one scene a global change could never reach, because its non-null value
    # kept winning the resolution below.
    #
    # NULL still resolves as "inherit the project setting" (resolution order is
    # scene ?? project ?? built-in default, see remotion.resolve_avatar_settings)
    # and is what every pre-stamp row holds, so nothing needed migrating — but
    # NULL is no longer the steady state for a project whose settings have been
    # saved at least once.
    avatar_shape: Mapped[str | None] = mapped_column(String(16), nullable=True)
    avatar_size: Mapped[float | None] = mapped_column(Float, nullable=True)
    avatar_position: Mapped[str | None] = mapped_column(String(20), nullable=True)
    avatar_bg: Mapped[str | None] = mapped_column(String(16), nullable=True)
    avatar_opacity: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Which part of the rendered avatar frame to keep, as a percentage focal point
    # plus a zoom — the same model scene images use (imageFocusX/Y + imageZoom).
    #
    # This exists because the roster photos are framed inconsistently and two are
    # shot so tight that no source crop can add margin; letting the user pick the
    # region on the ACTUAL rendered clip sidesteps that entirely. Applied as CSS
    # (objectPosition + scale) in both AvatarOverlay twins, so it is instant and
    # re-adjustable and never re-encodes the mp4.
    #
    # NULL means "use the default framing" (50/35 focus, zoom 1) — the same
    # inherit-by-null convention as the other per-scene avatar overrides.
    avatar_focus_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    avatar_focus_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    avatar_zoom: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=10.0)
    # Optional extra seconds to extend scene duration (e.g. for animations to complete).
    extra_hold_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional per-scene background-music volume override (0.0-1.0). NULL = use project bgm_volume.
    bgm_volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional hint for template_scene_gen: layout ID or arrangement name suggested by script generator.
    preferred_layout: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scene_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "intro"/"content"/"outro"; NULL = "content"
    # Soft-delete flag — False means the scene was deleted by the user. The row (and
    # its voiceover/image assets) is kept so the deletion can be reverted from the
    # edit history. Deleted scenes are filtered out of serving/render/count paths.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    @property
    def has_matte(self) -> bool:
        """Whether this scene's clip has been cut out yet. Exposed to the client
        instead of avatar_matte_path itself, which is a server filesystem detail."""
        return bool(self.avatar_matte_path)

    # Relationships
    project = relationship("Project", back_populates="scenes")
    edit_history = relationship("SceneEditHistory", back_populates="scene", cascade="all, delete-orphan", passive_deletes=True,)
    comments = relationship("SceneComment", back_populates="scene", cascade="all, delete-orphan", passive_deletes=True,)
    avatar_jobs = relationship("SceneAvatarJob", back_populates="scene", cascade="all, delete-orphan", passive_deletes=True,)