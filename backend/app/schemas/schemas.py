import re
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator
from typing import Optional, Union

MIN_PLAYBACK_SPEED = 0.5
MAX_PLAYBACK_SPEED = 2.5

VALID_CAPTION_POSITIONS = {"top_center", "bottom_center"}


def _normalize_caption_position(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    n = (v or "").strip().lower()
    if n not in VALID_CAPTION_POSITIONS:
        raise ValueError("caption_position must be 'top_center' or 'bottom_center'")
    return n


# ─── Avatar overlay presentation ───────────────────────────

VALID_AVATAR_SHAPES = {"circle", "rounded", "square"}
VALID_AVATAR_POSITIONS = {"top_left", "top_right", "bottom_left", "bottom_right"}
VALID_AVATAR_MOTION_STYLES = {"subtle", "natural", "expressive"}
MIN_AVATAR_SIZE = 0.10
MAX_AVATAR_SIZE = 0.32
# Floor rather than 0.0: a fully invisible avatar is indistinguishable from a
# broken render, so the slider bottoms out at "clearly faded but present".
MIN_AVATAR_OPACITY = 0.2

# avatar_bg value meaning "show the clip exactly as filmed, room and all".
#
# NULL cannot express this at SCENE scope, because there it already means
# "inherit the project setting" — so a scene had no way to say "original" while
# the project default was a colour. This sentinel is that missing fourth state.
AVATAR_BG_ORIGINAL = "original"


def avatar_bg_wants_cutout(bg: Optional[str]) -> bool:
    """Does this avatar_bg require the MATTED clip rather than the plain mp4?

    `bg` conflates two questions — "do we want a cutout?" and "what fill goes
    behind it?" — and only the first one decides which file to load. Every
    caller must ask through here rather than testing `bg is not None`, which
    silently treats "original" as a request to matte.

    BG-REMOVAL-DISABLED: HARD-WIRED TO False. Because every consumer routes
    through this one predicate, returning False here disables the entire cutout
    path server-side in a single place:

      - services/remotion.py picks the plain mp4 instead of the .mov
      - services/avatar_queue.py chains no follow-up matte jobs
      - stored avatar_bg values ("transparent", "#RRGGBB") become inert rather
        than invalid, so existing rows keep validating and nothing is migrated

    Values already in the DB are deliberately left alone: flipping this back
    restores each project's previous background exactly. Its twin is
    avatarBgWantsCutout() in frontend/src/api/types.ts — flip both together.
    """
    return False
    # TO RE-ENABLE: delete the `return False` above and restore this line.
    # return bg is not None and bg != AVATAR_BG_ORIGINAL


def _normalize_avatar_shape(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    n = (v or "").strip().lower()
    if n not in VALID_AVATAR_SHAPES:
        raise ValueError("avatar_shape must be 'circle', 'rounded' or 'square'")
    return n


def _normalize_avatar_position(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    n = (v or "").strip().lower()
    if n not in VALID_AVATAR_POSITIONS:
        raise ValueError(
            "avatar_position must be one of 'top_left', 'top_right', "
            "'bottom_left', 'bottom_right'"
        )
    return n


def _normalize_avatar_motion_style(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    n = (v or "").strip().lower()
    if n not in VALID_AVATAR_MOTION_STYLES:
        raise ValueError("avatar_motion_style must be 'subtle', 'natural' or 'expressive'")
    return n


def _normalize_avatar_size(v: Optional[float]) -> Optional[float]:
    """Clamp rather than reject — the UI slider is already bounded, so an
    out-of-range value is a stale client, not something worth 422-ing over."""
    if v is None:
        return None
    return round(max(MIN_AVATAR_SIZE, min(MAX_AVATAR_SIZE, float(v))), 3)


def _normalize_avatar_opacity(v: Optional[float]) -> Optional[float]:
    """Clamp like _normalize_avatar_size — the UI slider is bounded, so an
    out-of-range value means a stale client, not something worth 422-ing over.
    Floored at 0.2 so the presenter can never be made completely invisible."""
    if v is None:
        return None
    return round(max(MIN_AVATAR_OPACITY, min(1.0, float(v))), 2)


def _normalize_avatar_bg(v: Optional[str]) -> Optional[str]:
    """NULL | "original" | "transparent" | "#RRGGBB".

    Only the last two need matting; the first two show the clip as filmed.

      NULL          on a PROJECT: keep the portrait's own photographic background.
                    on a SCENE:   inherit whatever the project says.
      "original"    keep the photographic background, explicitly. Exists because
                    NULL is already spoken for at scene scope — without it a scene
                    simply cannot say "show the room" while the project default is
                    a colour, which is the bug this value was added to fix.
      "transparent" matted, no fill.
      "#RRGGBB"     matted, composited over that colour.

    Anything else is rejected rather than coerced: a bad colour would otherwise
    cost the user a matte job before they found out.
    """
    if v is None:
        return None
    n = (v or "").strip().lower()
    if not n:
        return None
    if n in ("transparent", AVATAR_BG_ORIGINAL):
        return n
    if not re.fullmatch(r"#[0-9a-f]{6}", n):
        raise ValueError(
            "avatar_bg must be null, 'original', 'transparent', or a '#RRGGBB' hex colour"
        )
    return n


# ─── Project ───────────────────────────────────────────────

class ProjectCreate(BaseModel):
    blog_url: Optional[str] = None
    name: Optional[str] = None
    template: Optional[str] = "default"
    voice_gender: Optional[str] = "female"   # "male", "female", or "none"
    voice_accent: Optional[str] = "american"  # "american" or "british"
    # None (not a literal colour) so the template's own preview_colors win in
    # create_project's `data.X or colors.get(...) or <fallback>` chain. With a
    # literal default the first branch was never falsy, so every project got
    # purple regardless of template. The frontend always sends explicit values.
    accent_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None        # optional font ID override
    animation_instructions: Optional[str] = None
    logo_position: Optional[str] = "bottom_right"  # top_left, top_right, bottom_left, bottom_right
    logo_opacity: Optional[float] = 0.9  # 0.0 - 1.0
    logo_size: Optional[float] = 100.0  # percentage, e.g. 100 = 100%
    custom_voice_id: Optional[str] = None    # ElevenLabs voice ID (Pro users)
    voice_emotion: Optional[str] = None      # narration emotion/tone key (paid); neutral/None = default v2 path
    aspect_ratio: Optional[str] = "landscape"  # "landscape" or "portrait"
    video_style: Optional[str] = "auto"   # auto | explainer | promotional | storytelling (auto = LLM picks after scraping)
    video_length: Optional[str] = "auto"  # auto | short (4-5) | medium (12-15) | detailed (23-30) | more_detailed (35-40)
    playback_speed: Optional[float] = 1.0
    content_language: Optional[str] = None     # preferred target language (ISO code or name)
    bgm_track_id: Optional[str] = None
    bgm_volume: Optional[float] = 0.10
    # Available on every plan and every template (see _resolve_stock_footage_flag).
    # Free users get a clip on a single scene, paid users on all image-capable
    # scenes. When false the pipeline skips stock fetching entirely.
    stock_footage_enabled: Optional[bool] = False
    captions_enabled: Optional[bool] = False
    caption_position: Optional[str] = "bottom_center"  # bottom_center | top_center
    caption_font_family: Optional[str] = "inter"
    caption_font_size: Optional[str] = "36"
    caption_offset: Optional[int] = 0  # vertical shift within bottom region: -100..+100 (0 = default, + = up)
    avatar_shape: Optional[str] = "circle"       # circle | rounded | square
    avatar_size: Optional[float] = 0.16          # fraction of composition width
    avatar_position: Optional[str] = "bottom_left"
    avatar_bg: Optional[str] = None              # None | "transparent" | "#RRGGBB"
    avatar_opacity: Optional[float] = 1.0        # 0.2 - 1.0
    avatar_motion_style: Optional[str] = "expressive"  # subtle | natural | expressive

    @field_validator("avatar_shape")
    @classmethod
    def validate_create_avatar_shape(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_shape(v)

    @field_validator("avatar_motion_style")
    @classmethod
    def validate_create_avatar_motion_style(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_motion_style(v)

    @field_validator("avatar_position")
    @classmethod
    def validate_create_avatar_position(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_position(v)

    @field_validator("avatar_size")
    @classmethod
    def validate_create_avatar_size(cls, v: Optional[float]) -> Optional[float]:
        return _normalize_avatar_size(v)

    @field_validator("avatar_bg")
    @classmethod
    def validate_create_avatar_bg(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_bg(v)

    @field_validator("avatar_opacity")
    @classmethod
    def validate_create_avatar_opacity(cls, v: Optional[float]) -> Optional[float]:
        return _normalize_avatar_opacity(v)

    @field_validator("bgm_volume")
    @classmethod
    def validate_create_bgm_volume(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return 0.10
        return round(max(0.0, min(1.0, float(v))), 2)

    @field_validator("caption_position")
    @classmethod
    def validate_create_caption_position(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_caption_position(v)

    @field_validator("playback_speed")
    @classmethod
    def validate_create_playback_speed(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        value = round(float(v), 2)
        if value < MIN_PLAYBACK_SPEED or value > MAX_PLAYBACK_SPEED:
            raise ValueError("playback_speed must be between 0.5 and 2.5")
        return value


class ProjectUpdate(BaseModel):
    accent_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None
    content_language: Optional[str] = None
    video_length: Optional[str] = None
    aspect_ratio: Optional[str] = None  # "landscape" | "portrait"
    playback_speed: Optional[float] = None
    bgm_track_id: Optional[str] = None
    bgm_volume: Optional[float] = None
    captions_enabled: Optional[bool] = None
    caption_position: Optional[str] = None
    caption_font_family: Optional[str] = None
    caption_font_size: Optional[Union[str, int]] = None
    caption_offset: Optional[int] = None
    avatar_shape: Optional[str] = None
    avatar_size: Optional[float] = None
    avatar_position: Optional[str] = None
    # NULL here means "keep the portrait's own background". Because that is a real
    # value rather than "unchanged", update_project() lists avatar_bg among the
    # fields allowed to be nulled — see the field loop in routers/projects.py.
    avatar_bg: Optional[str] = None
    avatar_opacity: Optional[float] = None
    avatar_motion_style: Optional[str] = None  # subtle | natural | expressive
    # Set once the placeholder $5 batch-generation paywall has been cleared.
    avatar_batch_unlocked: Optional[bool] = None

    @field_validator("avatar_shape")
    @classmethod
    def validate_update_avatar_shape(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_shape(v)

    @field_validator("avatar_motion_style")
    @classmethod
    def validate_update_avatar_motion_style(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_motion_style(v)

    @field_validator("avatar_position")
    @classmethod
    def validate_update_avatar_position(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_position(v)

    @field_validator("avatar_size")
    @classmethod
    def validate_update_avatar_size(cls, v: Optional[float]) -> Optional[float]:
        return _normalize_avatar_size(v)

    @field_validator("avatar_bg")
    @classmethod
    def validate_update_avatar_bg(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_bg(v)

    @field_validator("avatar_opacity")
    @classmethod
    def validate_update_avatar_opacity(cls, v: Optional[float]) -> Optional[float]:
        return _normalize_avatar_opacity(v)

    @field_validator("caption_font_size", mode="before")
    @classmethod
    def coerce_caption_font_size(cls, v: Optional[Union[str, int]]) -> Optional[str]:
        if v is None:
            return None
        return str(v)

    @field_validator("caption_offset", mode="before")
    @classmethod
    def clamp_caption_offset(cls, v: Optional[Union[str, int]]) -> Optional[int]:
        if v is None or v == "":
            return None
        try:
            return max(-100, min(100, int(v)))
        except (TypeError, ValueError):
            return None

    @field_validator("bgm_volume")
    @classmethod
    def validate_bgm_volume(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        return round(max(0.0, min(1.0, float(v))), 2)

    @field_validator("caption_position")
    @classmethod
    def validate_update_caption_position(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_caption_position(v)

    @field_validator("aspect_ratio")
    @classmethod
    def validate_aspect_ratio(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        n = (v or "").strip().lower()
        if n not in ("landscape", "portrait"):
            raise ValueError("aspect_ratio must be 'landscape' or 'portrait'")
        return n

    @field_validator("playback_speed")
    @classmethod
    def validate_playback_speed(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        value = round(float(v), 2)
        if value < MIN_PLAYBACK_SPEED or value > MAX_PLAYBACK_SPEED:
            raise ValueError("playback_speed must be between 0.5 and 2.5")
        return value


class ProjectVoiceChange(BaseModel):
    """Body for changing a project's voice and regenerating all voiceovers."""
    voice_gender: Optional[str] = None
    voice_accent: Optional[str] = None
    custom_voice_id: Optional[str] = None
    voice_emotion: Optional[str] = None


class ProjectLanguageChange(BaseModel):
    """Body for translating a project into a new language.

    ``content_language`` accepts an ISO 639-1 code ('es') or a language name
    ('Spanish'); it is normalized server-side by ``normalize_preferred_language_code``.
    """
    content_language: str


class ProjectTemplateChangeRequest(BaseModel):
    template: str


class ProjectTemplateChangeJobOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    target_template: str
    status: str
    total_scenes: int
    processed_scenes: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectRegenerateScriptJobOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    # The collaborator who initiated this regen. Only they may approve/regenerate the
    # review; the frontend compares it to the current user to gate those controls.
    initiated_by_user_id: Optional[int] = None
    status: str
    current_step: str = "analyzing_instruction"
    total_scenes: int
    processed_scenes: int
    error_message: Optional[str] = None
    user_instruction: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SceneOut(BaseModel):
    id: int
    project_id: int
    order: int
    title: str
    narration_text: str
    display_text: Optional[str] = None
    visual_description: str
    remotion_code: Optional[str] = None
    preferred_layout: Optional[str] = None
    scene_type: Optional[str] = None
    voiceover_path: Optional[str] = None
    avatar_video_path: Optional[str] = None
    avatar_preset: Optional[str] = None
    # True once this scene's clip has been matted (services/avatar_matte.py), which
    # is what a custom background needs. The UI uses it to list the scenes still
    # requiring a ~1-min matte job before a background change can show.
    has_matte: bool = False
    # True once this scene's avatar failed for good and its credits were given
    # back (SceneAvatarJob.credits_refunded). The scene is permanently closed:
    # authorize_avatar_batch drops it from `eligible`, and the per-scene endpoint
    # 409s. Exposed so the UI can stop OFFERING it — without this the client has
    # no way to know, so the picker and the "N scenes still don't have an avatar"
    # banner both re-listed refunded scenes and the request was rejected or
    # silently short-changed. Defaults False, which is right for every scene that
    # has never had a job.
    avatar_credits_refunded: bool = False
    # Per-scene overrides; NULL means "inherit the project setting".
    avatar_shape: Optional[str] = None
    avatar_size: Optional[float] = None
    avatar_position: Optional[str] = None
    avatar_bg: Optional[str] = None
    avatar_opacity: Optional[float] = None
    # Which part of the rendered avatar frame to keep. NULL = default framing.
    avatar_focus_x: Optional[float] = None
    avatar_focus_y: Optional[float] = None
    avatar_zoom: Optional[float] = None
    duration_seconds: float
    extra_hold_seconds: Optional[float] = None
    bgm_volume: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RegenerateScriptPreviewScene(BaseModel):
    """A previous (pre-regeneration) scene, for the verify-step before/after comparison."""
    order: int
    title: str
    display_text: Optional[str] = None
    narration_text: str
    visual_description: str
    remotion_code: Optional[str] = None
    preferred_layout: Optional[str] = None


class RegenerateScriptPreviewOut(BaseModel):
    previous_scenes: list[RegenerateScriptPreviewScene] = []


class AssetOut(BaseModel):
    id: int
    project_id: int
    asset_type: str
    original_url: Optional[str] = None
    local_path: str
    filename: str
    r2_key: Optional[str] = None
    r2_url: Optional[str] = None
    excluded: bool = False
    created_at: datetime
    # VIDEO assets (stock footage) only — null on image/audio rows. Without these
    # the editor cannot tell whether a clip has an audio track (audio toggle) or
    # how long it is, so they must be serialized.
    duration_seconds: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    source_provider: Optional[str] = None
    source_id: Optional[str] = None
    source_author: Optional[str] = None
    source_page_url: Optional[str] = None
    audio_variant_filename: Optional[str] = None

    class Config:
        from_attributes = True


class ChatMessageOut(BaseModel):
    id: int
    project_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewStateOut(BaseModel):
    project_sequence: int
    has_review_for_project: bool
    should_show_inline: bool


class ReviewOut(BaseModel):
    id: int
    user_id: int
    project_id: int
    rating: int
    suggestion: Optional[str] = None
    source: str
    trigger_event: str
    project_sequence: int
    plan_at_submission: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewSubmit(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    suggestion: Optional[str] = None
    source: str
    trigger_event: str

    @field_validator("suggestion")
    @classmethod
    def normalize_suggestion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        allowed = {"inline_row", "first_project_popup"}
        if v not in allowed:
            raise ValueError("source must be one of: first_project_popup, inline_row")
        return v

    @field_validator("trigger_event")
    @classmethod
    def validate_trigger_event(cls, v: str) -> str:
        allowed = {"manual", "delayed_popup"}
        if v not in allowed:
            raise ValueError("trigger_event must be one of: delayed_popup, manual")
        return v


class ReviewSubmitResponse(BaseModel):
    review: ReviewOut
    review_state: ReviewStateOut


class TemplateRatingOut(BaseModel):
    id: int
    user_id: int
    custom_template_id: int
    rating: int
    suggestion: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateRatingSubmit(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    suggestion: Optional[str] = None

    @field_validator("suggestion")
    @classmethod
    def normalize_suggestion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class AvatarReviewOut(BaseModel):
    id: int
    user_id: int
    project_id: int
    rating: int
    suggestion: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AvatarReviewSubmit(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    suggestion: Optional[str] = None

    @field_validator("suggestion")
    @classmethod
    def normalize_suggestion(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None


class ProjectOut(BaseModel):
    id: int
    # Owner user id — lets the frontend tell owners from collaborators.
    user_id: int
    name: str
    blog_url: Optional[str] = None
    blog_content: Optional[str] = None
    status: str
    template: str = "default"
    voice_gender: str = "female"
    voice_accent: str = "american"
    accent_color: str = "#7C3AED"
    bg_color: str = "#FFFFFF"
    text_color: str = "#000000"
    font_family: Optional[str] = None
    animation_instructions: Optional[str] = None
    studio_unlocked: bool = False
    studio_port: Optional[int] = None
    player_port: Optional[int] = None
    r2_video_key: Optional[str] = None
    r2_video_url: Optional[str] = None
    logo_r2_url: Optional[str] = None
    logo_position: str = "bottom_right"
    logo_opacity: float = 0.9
    logo_size: float = 100.0  # percentage
    custom_voice_id: Optional[str] = None
    voice_emotion: Optional[str] = None
    aspect_ratio: str = "landscape"
    video_style: str = "explainer"
    video_length: str = "auto"
    playback_speed: float = 1.0
    bgm_track_id: Optional[str] = None
    bgm_volume: float = 0.10
    bgm_track_url: Optional[str] = None
    stock_footage_enabled: bool = False
    is_bulk: bool = False
    captions_enabled: bool = False
    caption_position: str = "bottom_center"
    caption_font_family: str = "inter"
    caption_font_size: str = "36"
    caption_offset: int = 0
    avatar_shape: str = "circle"
    avatar_size: float = 0.16
    avatar_position: str = "bottom_left"
    avatar_bg: Optional[str] = None
    avatar_opacity: float = 1.0
    avatar_motion_style: str = "expressive"
    # The user's uploaded presenter portrait (URL only — the server path is not
    # the client's business). Null means they are using the built-in roster.
    avatar_custom_image_url: Optional[str] = None
    # Cleared the Avatar tab's whole-video batch-generation paywall.
    avatar_batch_unlocked: bool = False
    content_language: Optional[str] = None  # ISO 639-1, e.g. 'en', 'es'. Null = auto-detect from content.
    ai_assisted_editing_count: int = 0
    custom_theme: Optional[dict] = None
    custom_image_box_aspect_ratios: Optional[dict] = None
    custom_template_missing: bool = False
    brand_logo_url: Optional[str] = None
    review_state: Optional[ReviewStateOut] = None
    # This user's avatar rating for this project, or null when they have not rated.
    # Rides on the project payload (like review_state) so the Avatar tab — which
    # unmounts on every tab switch — can decide whether to show the rating form or
    # the read-only summary on first paint, with no extra request and no flicker.
    avatar_review: Optional[AvatarReviewOut] = None
    # True when the project has ≥1 member (invited/pending or accepted). Gates the
    # per-scene comment affordance in the UI.
    is_shared: bool = False
    # True when the project OWNER is on a paid plan (lite/standard/pro). On a shared
    # project the owner pays, so the frontend gates premium features (custom/crafted
    # templates, paid voices) on the OWNER's plan for collaborators — not their own.
    owner_is_pro: bool = False
    # The project OWNER's remaining per-user purchased AI-edit credit pool. On a
    # shared project the owner pays, so a collaborator's AI-edit gating draws
    # from the OWNER's credits — this surfaces the owner's balance for the UI.
    owner_ai_edit_credits: int = 0
    # The project OWNER's remaining monthly plan allowance (0 on FREE). Combined
    # with owner_ai_edit_credits this is the owner's full spendable AI-edit budget.
    owner_ai_edit_allowance_remaining: int = 0
    # The project OWNER's display name. Populated for every project (owner + shared)
    # so a collaborator's settings pop-ups can attribute the templates/voices they see
    # as belonging to the owner (e.g. "Alice's custom templates").
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    scenes: list[SceneOut] = []
    assets: list[AssetOut] = []

    @field_validator("logo_size", mode="before")
    @classmethod
    def coerce_logo_size(cls, v: object) -> float:
        if v is None:
            return 100.0
        if isinstance(v, (int, float)):
            p = float(v)
            return max(50.0, min(200.0, p))
        return 100.0

    @model_validator(mode="after")
    def populate_bgm_track_url(self) -> "ProjectOut":
        if self.bgm_track_id and not self.bgm_track_url:
            from app.services.background_music import get_track_r2_url
            self.bgm_track_url = get_track_r2_url(self.bgm_track_id)
        return self

    class Config:
        from_attributes = True


class BulkProjectItem(BaseModel):
    """One project in a bulk create request (same fields as ProjectCreate)."""
    blog_url: str
    name: Optional[str] = None
    template: Optional[str] = "default"
    video_style: Optional[str] = "explainer"
    voice_gender: Optional[str] = "female"
    voice_accent: Optional[str] = "american"
    # None, not a literal colour — same reason as ProjectCreate above: a literal
    # default is never falsy, so the template's own palette could never win.
    accent_color: Optional[str] = None
    bg_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None
    animation_instructions: Optional[str] = None
    logo_position: Optional[str] = "bottom_right"
    logo_opacity: Optional[float] = 0.9
    custom_voice_id: Optional[str] = None
    aspect_ratio: Optional[str] = "landscape"
    content_language: Optional[str] = None
    video_length: Optional[str] = "auto"
    playback_speed: Optional[float] = 1.0
    voice_emotion: Optional[str] = None
    bgm_track_id: Optional[str] = None
    bgm_volume: Optional[float] = 0.10
    captions_enabled: Optional[bool] = False
    caption_position: Optional[str] = "bottom_center"
    caption_font_family: Optional[str] = "inter"
    caption_font_size: Optional[str] = "medium"
    stock_footage_enabled: Optional[bool] = False

    @field_validator("caption_position")
    @classmethod
    def validate_bulk_caption_position(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_caption_position(v)

    @field_validator("playback_speed")
    @classmethod
    def validate_bulk_playback_speed(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        value = round(float(v), 2)
        if value < MIN_PLAYBACK_SPEED or value > MAX_PLAYBACK_SPEED:
            raise ValueError("playback_speed must be between 0.5 and 2.5")
        return value


class BulkCreateResponse(BaseModel):
    project_ids: list[int]


class ProjectLogoUpdate(BaseModel):
    logo_position: Optional[str] = None  # top_left, top_right, bottom_left, bottom_right
    logo_size: Optional[float] = None    # percentage, e.g. 100 = 100% (50-200), REAL for smooth slider
    logo_opacity: Optional[float] = None # 0.0 - 1.0

    @field_validator("logo_size", mode="before")
    @classmethod
    def clamp_logo_size(cls, v: object) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return max(50.0, min(200.0, float(v)))
        return None


class ProjectListOut(BaseModel):
    id: int
    name: str
    blog_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    scene_count: int = 0
    # Collaboration: the acting user's role on this project ("owner"/"editor").
    # Lets the frontend split "My videos" from "Shared with me".
    role: str = "owner"
    owner_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Scene Update ──────────────────────────────────────────

class SceneTypographyBulkUpdate(BaseModel):
    title_font_size: Optional[int] = None
    description_font_size: Optional[int] = None

class SceneUpdate(BaseModel):
    title: Optional[str] = None
    narration_text: Optional[str] = None
    display_text: Optional[str] = None
    visual_description: Optional[str] = None
    remotion_code: Optional[str] = None
    duration_seconds: Optional[float] = None
    extra_hold_seconds: Optional[float] = None
    bgm_volume: Optional[float] = None

    @field_validator("bgm_volume")
    @classmethod
    def validate_scene_bgm_volume(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        return round(max(0.0, min(1.0, float(v))), 2)


class SceneAvatarFocusUpdate(BaseModel):
    """Which region of the rendered avatar clip to show.

    Mirrors the scene-image framing model (imageFocusX/Y + imageZoom): a focal
    point in percent plus a zoom, applied as CSS by the overlay rather than
    re-encoding the video. Bounds match _clamp_image_focus / _clamp_image_zoom in
    routers/projects.py, which do the authoritative clamping.
    """
    avatar_focus_x: float = Field(default=50, ge=0, le=100)
    avatar_focus_y: float = Field(default=35, ge=0, le=100)
    avatar_zoom: Optional[float] = Field(default=None, ge=0.5, le=4)


class SceneAvatarAppearanceUpdate(BaseModel):
    """Per-scene overrides of the project's avatar presentation.

    Deliberately separate from SceneUpdate: that path runs every field through
    MANUAL_TRACKED_FIELDS and the revertible edit-history change-set machinery,
    which is for editorial content (text, layout, timing). How an overlay looks is
    presentation, so it does not belong in a user's edit history.

    Every field is Optional and NULL is MEANINGFUL — it means "stop overriding,
    inherit the project setting again". The endpoint therefore reads
    ``model_fields_set`` rather than filtering nulls, so "omitted" (leave alone)
    stays distinguishable from "explicitly null" (reset to inherit). Losing that
    distinction is exactly what would make Reset-to-project silently do nothing.
    """
    avatar_shape: Optional[str] = None
    avatar_size: Optional[float] = None
    avatar_position: Optional[str] = None
    avatar_bg: Optional[str] = None
    avatar_opacity: Optional[float] = None

    @field_validator("avatar_shape")
    @classmethod
    def validate_scene_avatar_shape(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_shape(v)

    @field_validator("avatar_position")
    @classmethod
    def validate_scene_avatar_position(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_position(v)

    @field_validator("avatar_size")
    @classmethod
    def validate_scene_avatar_size(cls, v: Optional[float]) -> Optional[float]:
        return _normalize_avatar_size(v)

    @field_validator("avatar_bg")
    @classmethod
    def validate_scene_avatar_bg(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_avatar_bg(v)

    @field_validator("avatar_opacity")
    @classmethod
    def validate_scene_avatar_opacity(cls, v: Optional[float]) -> Optional[float]:
        return _normalize_avatar_opacity(v)


# ─── Scene Editing ──────────────────────────────────────────

class SceneOrderItem(BaseModel):
    scene_id: int
    order: int


class ReorderScenesRequest(BaseModel):
    scene_orders: list[SceneOrderItem]


class RegenerateSceneRequest(BaseModel):
    description: str
    layout: Optional[str] = None


class AddSceneRequest(BaseModel):
    # Free-text description of the scene the user wants generated.
    prompt: str
    # 1-indexed position among ACTIVE scenes to insert at. The new scene takes this
    # slot and everything at/after it shifts one down. Clamped server-side to
    # [1, active_count + 1] (append when omitted / out of range).
    position: Optional[int] = None


class AddSceneJobOut(BaseModel):
    """Status of a background add-scene generation job (polled by the frontend)."""
    id: int
    status: str  # queued | running | completed | failed
    current_step: str
    error_message: Optional[str] = None
    # Set on success so the client can locate the newly inserted scene row.
    new_scene_id: Optional[int] = None
    # 1-indexed insert position among active scenes (None = appended at end).
    position: Optional[int] = None

    class Config:
        from_attributes = True


# ─── Chat ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    changes_made: str
    updated_scenes: list[SceneOut] = []


# ─── Pipeline ─────────────────────────────────────────────

class StudioResponse(BaseModel):
    studio_url: str
    port: int


class RenderResponse(BaseModel):
    output_path: str
    status: str


# ─── Custom voices (creation records: prompt/response/form) ───

class CustomVoiceCreate(BaseModel):
    voice_id: str
    source: str  # "prompt" | "form"
    name: Optional[str] = None  # user-provided name; if missing, backend uses "Generated N"
    prompt_text: Optional[str] = None
    response: Optional[dict] = None  # full API response, stored as JSON
    form_gender: Optional[str] = None
    form_age: Optional[str] = None
    form_persona: Optional[str] = None
    form_speed: Optional[str] = None
    form_accent: Optional[str] = None
    preview_url: Optional[str] = None


class CustomVoiceOut(BaseModel):
    id: int
    name: str
    voice_id: str
    source: str
    prompt_text: Optional[str] = None
    form_gender: Optional[str] = None
    form_age: Optional[str] = None
    form_persona: Optional[str] = None
    form_speed: Optional[str] = None
    form_accent: Optional[str] = None
    preview_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Saved voices (user's My Voices; can reference custom_voice) ─

class SavedVoiceCreate(BaseModel):
    voice_id: str
    name: str
    preview_url: Optional[str] = None
    source: Optional[str] = "custom"  # "custom" | "prebuilt"
    plan: Optional[str] = None  # "free" | "paid" for prebuilt (ElevenLabs)
    gender: Optional[str] = None
    accent: Optional[str] = None
    description: Optional[str] = None
    custom_voice_id: Optional[int] = None


class SavedVoiceOut(BaseModel):
    id: int
    voice_id: str
    name: str
    preview_url: Optional[str] = None
    source: str = "custom"
    plan: Optional[str] = None
    gender: Optional[str] = None
    accent: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    custom_voice_id: Optional[int] = None

    class Config:
        from_attributes = True
