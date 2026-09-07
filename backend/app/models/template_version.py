# app/models/template_version.py

from datetime import datetime
from sqlalchemy import Integer, ForeignKey, Text, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    template_id: Mapped[int] = mapped_column(
        ForeignKey("custom_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Snapshot of all code variants at this version
    component_code: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy single content variant
    intro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    outro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of code strings

    # Metadata that MUST travel with the code. Before these columns existed,
    # rollback_to_version restored intro/outro/content code but left
    # content_archetype_ids and image_box_aspect_ratios describing a DIFFERENT
    # generation — so after a rollback, content-scene matching mapped content
    # types to the wrong variants and the image-adjust modal showed the wrong
    # aspect ratio.
    content_archetype_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_box_aspect_ratios: Mapped[str | None] = mapped_column(Text, nullable=True)
    design_blueprint: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout_prop_schemas: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Per-scene sample copy, for the same reason as the four above: it is
    # indexed in lockstep with content_codes, so a rollback that restored the
    # code without it would show one generation's copy over another's layouts.
    scene_sample_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Type sizes travel with the code for the same reason: they are computed
    # from that generation's copy, so restoring code without them would land one
    # generation's type scale on another's layouts.
    scene_font_defaults: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Single-scene snapshots (P4). kind="scene_edit" + scene_role identifies a
    # draft produced by an AI edit of ONE scene; "full" is a whole-template
    # snapshot. is_draft marks a version that is not yet applied.
    kind: Mapped[str] = mapped_column(String(32), default="full")
    scene_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_draft: Mapped[bool] = mapped_column(default=False)

    # Human-readable label: "Initial generation", "Regenerated", "After edits", etc.
    label: Mapped[str] = mapped_column(String(255), default="Generated")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    template = relationship("CustomTemplate", back_populates="versions")
