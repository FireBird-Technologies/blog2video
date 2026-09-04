from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class CustomTemplate(Base):
    __tablename__ = "custom_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    category: Mapped[str] = mapped_column(String(255), default="blog")
    theme: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string of CustomTheme
    generated_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    # AI-generated component code
    component_code: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy single content variant
    intro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    outro_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Multiple unique content scene variants (JSON array of code strings)
    # The codegen LLM decides how many to generate (typically 4-8). Scenes cycle through them.
    content_codes: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list of code strings
    content_archetype_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of archetype IDs matching content_codes order
    image_box_aspect_ratios: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {"intro": {"landscape": "W / H", "portrait": "W / H"}, "content": [{"landscape": ..., "portrait": ...}, ...], "outro": {...}}

    # JSON array of human-readable warnings from the last generation — e.g. a
    # scene that fell back to the deterministic stub after exhausting its repair
    # attempts. Surfaced in the UI so a degraded scene is visible, not silent.
    generation_warnings: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON Design Blueprint (P2): the per-brand template design — layouts with
    # authored geometry, persistent structure, type system, safe-area policy and
    # per-layout image capability. NULL for templates generated before the
    # blueprint path existed, which fall back to the legacy behaviour.
    design_blueprint: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON per-layout editable props (P3), shaped {"intro": [...],
    # "content": [[...], ...], "outro": [...]} — same indexing convention as
    # image_box_aspect_ratios. Feeds meta.layout_prop_schema, which the scene
    # editor's existing generic field renderer already consumes.
    layout_prop_schemas: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The shared visual design system this template's scenes were generated
    # against. Cached so a single-scene AI edit reuses it instead of
    # regenerating — regenerating would drift the styling and leave the edited
    # scene subtly out of step with its siblings.
    design_system: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Representative on-screen copy per scene, written at generation time and
    # shaped {"intro": {...}, "content": [{...}, ...], "outro": {...}} — the
    # same indexing convention as image_box_aspect_ratios and
    # layout_prop_schemas, so all four arrays stay addressable the same way.
    #
    # Preview text used to be synthesised in the browser on every render, so it
    # was generic ("Our Brand", "Scene 2"), never matched the template's own
    # subject matter, and could not be edited or inspected. Generating it once
    # against each scene's design doc gives the gallery and the editor copy that
    # actually belongs to the template. NULL for templates generated before this
    # existed — the frontend keeps its client-side fallback for those.
    scene_sample_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Per-scene DEFAULT type sizes, shaped
    #   {"intro": {"title": {"landscape": N, "portrait": N},
    #              "description": {"landscape": N, "portrait": N}}, ...}
    # — indexed exactly like scene_sample_content above.
    #
    # Sizes used to live only as literals the model baked into each scene
    # (`props.titleFontSize ?? (isPortrait ? 52 : 76)`), so nothing could size a
    # scene to the copy it actually holds and the editor's sliders had no
    # defaults to start from. Computed from the sample copy's length and stored
    # here, they become a template property: previewed, editable, and used by
    # the render. NULL on older templates, which fall through to the literals.
    scene_font_defaults: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Set to True when background code generation permanently fails
    generation_failed: Mapped[bool] = mapped_column(default=False)

    # True while a regenerate-code background job is running for this template.
    # DB-persisted (not in-memory) so a page refresh/tab-switch mid-regeneration
    # still shows the correct in-progress state instead of the stale old code.
    is_regenerating: Mapped[bool] = mapped_column(default=False)

    # True once the custom-template slot charged for this template has been
    # refunded after a failed generation. Guards against handing out a free slot
    # on every retry: a retry reuses the original charge, so only the first
    # failure refunds. Not reused for regenerations — those charge and refund
    # within a single run, so they reset this back to False when they start.
    slot_refunded: Mapped[bool] = mapped_column(default=False)

    # Link to BrandKit (optional — existing templates have no brand kit)
    brand_kit_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("brand_kits.id"), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Active version pointer (nullable — NULL means no versioning yet / use current code fields)
    current_version_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # The generation run currently working on this template, if any. The durable
    # replacement for the in-memory _codegen_progress dict, which is lost on
    # restart and invisible to other workers. is_regenerating is kept in step
    # with it for now because the frontend poller still reads that flag.
    active_gen_run_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="custom_templates")
    brand_kit = relationship("BrandKit", back_populates="custom_templates")
    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan", order_by="TemplateVersion.created_at.desc()")
    ratings = relationship("TemplateRating", back_populates="custom_template", cascade="all, delete-orphan")
    gen_runs = relationship(
        "CustomTemplateGenRun",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="CustomTemplateGenRun.started_at.desc()",
    )


class CustomTemplateGenRun(Base):
    """One generation attempt, staged so partial progress survives a crash.

    Generation used to be a single ~370s call whose output was written only at
    the end, so a crash at scene 7 of 9 discarded all nine — including the
    60-90s blueprint call that had long since succeeded. A run row is written
    at each stage boundary and after every individual scene, so a resumed run
    regenerates only what is actually missing.

    A separate table rather than columns on CustomTemplate because a run has a
    lifecycle of its own, regenerations want history, and `scene_results` is
    rewritten ~9 times per run — churn that should not touch the template row
    the render path reads. TemplateVersion cannot serve: it snapshots FINISHED
    code and has no notion of a partial or failed scene.
    """

    __tablename__ = "custom_template_gen_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("custom_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # "initial" | "regenerate"
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="initial")
    # blueprint | scenes | examine | persist | done | failed
    stage: Mapped[str] = mapped_column(String(32), nullable=False, default="blueprint")
    # running | complete | failed
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="running")

    # Stage A output, written before any scene work starts.
    blueprint_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    design_system: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON: the scene manifest (labels + total), so a resume knows the shape.
    scene_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON list, one slot per scene: {index, code, aspect_ratios, prop_schema,
    # error, attempts}. Rewritten as each scene lands.
    scene_results: Mapped[str | None] = mapped_column(Text, nullable=True)

    warnings: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    template = relationship("CustomTemplate", back_populates="gen_runs")
