/** Avatar overlay presentation — mirrors the projects.avatar_* columns. */
export type AvatarShape = "circle" | "rounded" | "square";
export type AvatarCorner =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right";

/**
 * What sits behind the presenter.
 *   null           PROJECT: keep the portrait's own photographic background.
 *                  SCENE:   inherit whatever the project says.
 *   "original"     keep the photographic background, explicitly (see below)
 *   "transparent"  cut out, no fill — presenter sits directly on the scene
 *   "#RRGGBB"      cut out, composited over this solid colour
 *
 * Only the last two require the scene's clip to have been matted first
 * (Scene.has_matte) — the roster portraits have their rooms baked in.
 */
export type AvatarBg = string | null;

/** avatar_bg value meaning "show the clip exactly as filmed, room and all".
 *
 *  Exists because null is already spoken for at SCENE scope, where it means
 *  "inherit". Without this a scene could not say "original" while the project
 *  default was a colour — clicking Original wrote null, which just re-inherited
 *  the colour, so the cut-out kept showing.
 *
 *  Mirrors AVATAR_BG_ORIGINAL in backend/app/schemas/schemas.py. */
export const AVATAR_BG_ORIGINAL = "original";

/** Does this background require the MATTED clip rather than the plain mp4?
 *
 *  `bg` conflates two questions — "do we want a cutout?" and "what fill goes
 *  behind it?" — and only the first decides which file to load. Ask through
 *  here rather than testing `bg !== null`, which treats "original" as a request
 *  to matte and would show the cut-out (and queue CPU work) for a user who
 *  explicitly asked for the room.
 *
 *  BG-REMOVAL-DISABLED: HARD-WIRED TO false. Every consumer routes through this
 *  one predicate, so returning false disables the whole cutout path client-side
 *  from a single place:
 *
 *    - VideoPreview.tsx loads the .mp4 rather than the matted .webm
 *    - AvatarBatchWizard.tsx never enters its matte phase (MattePhase stays "none")
 *    - SceneAvatarSection.tsx queues no cutout on save
 *
 *  Twin of avatar_bg_wants_cutout() in backend/app/schemas/schemas.py — the two
 *  must always agree, so flip them together. */
export function avatarBgWantsCutout(bg: AvatarBg | undefined): boolean {
  return false;
  // TO RE-ENABLE: delete the `return false` above and restore this line.
  // return bg != null && bg !== AVATAR_BG_ORIGINAL;
}

export const AVATAR_MIN_SIZE = 0.10;
export const AVATAR_MAX_SIZE = 0.32;
/** Floor rather than 0: a fully invisible avatar reads as a broken render. */
export const AVATAR_MIN_OPACITY = 0.2;

/** Sentinel preset id meaning "use the portrait this user uploaded".
 *  Mirrors CUSTOM_PRESET_ID in backend/app/services/avatar_presets.py. */
export const AVATAR_CUSTOM_PRESET_ID = "custom";

/** Curated background swatches offered next to the free-form colour picker. */
export const AVATAR_BG_PRESETS: { value: string; label: string }[] = [
  { value: "#1E293B", label: "Slate" },
  { value: "#0F172A", label: "Ink" },
  { value: "#7C3AED", label: "Purple" },
  { value: "#0E7490", label: "Teal" },
  { value: "#B91C1C", label: "Crimson" },
  { value: "#F1F5F9", label: "Paper" },
];

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  plan: string;
  videos_used_this_period: number;
  video_limit: number;
  can_create_video: boolean;
  custom_templates_created: number;
  custom_template_limit: number;
  can_create_custom_template: boolean;
  preferred_voice_emotion: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export interface Scene {
  id: number;
  project_id: number;
  order: number;
  title: string;
  narration_text: string;
  display_text?: string | null;
  visual_description: string;
  remotion_code: string | null;
  voiceover_path: string | null;
  avatar_video_path?: string | null;
  avatar_preset?: string | null;
  /** True once this scene's clip has been cut out — required for a custom background. */
  has_matte?: boolean;
  /** Per-scene overrides of the project avatar presentation; null = inherit. */
  avatar_shape?: AvatarShape | null;
  avatar_size?: number | null;
  avatar_position?: AvatarCorner | null;
  avatar_bg?: AvatarBg;
  avatar_opacity?: number | null;
  /** Which region of the rendered clip to show; null = default framing. */
  avatar_focus_x?: number | null;
  avatar_focus_y?: number | null;
  avatar_zoom?: number | null;
  duration_seconds: number;
  extra_hold_seconds?: number | null;
  created_at: string;
}

export interface Asset {
  id: number;
  project_id: number;
  asset_type: string;
  original_url: string | null;
  local_path: string;
  filename: string;
  r2_key: string | null;
  r2_url: string | null;
  excluded: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  blog_url: string;
  blog_content: string | null;
  status: string;
  voice_gender: string;
  voice_accent: string;
  accent_color: string;
  bg_color: string;
  text_color: string;
  animation_instructions: string | null;
  studio_unlocked: boolean;
  studio_port: number | null;
  player_port: number | null;
  r2_video_key: string | null;
  r2_video_url: string | null;
  logo_r2_url: string | null;
  logo_position: string;
  logo_opacity: number;
  logo_size: number;
  custom_voice_id: string | null;
  voice_emotion?: string | null;
  aspect_ratio: string;
  playback_speed?: number;
  captions_enabled?: boolean;
  caption_position?: "bottom_center" | "top_center";
  caption_font_family?: string;
  caption_font_size?: string | number;
  caption_offset?: number;
  avatar_shape?: AvatarShape;
  avatar_size?: number;
  avatar_position?: AvatarCorner;
  avatar_bg?: AvatarBg;
  avatar_opacity?: number;
  /** URL of the presenter photo this user uploaded; null = using the roster. */
  avatar_custom_image_url?: string | null;
  /** Cleared the Avatar tab's whole-video batch-generation paywall. */
  avatar_batch_unlocked?: boolean;
  custom_template_missing?: boolean;
  review_state?: ReviewState | null;
  /** This user's avatar rating, or null when they have not rated. Rides on the
   *  project payload so the Avatar tab (which unmounts on tab switch) can pick
   *  the form vs. the saved-summary view on first paint, with no flicker. */
  avatar_review?: AvatarReview | null;
  /** True when the project has ≥1 collaborator — gates the per-scene comment button. */
  is_shared?: boolean;
  /** True when the project OWNER is on a paid plan — collaborators gate Pro-only features on this. */
  owner_is_pro?: boolean;
  /** The project OWNER's display name — used to attribute owner-scoped templates/voices in a collaborator's UI. */
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
  scenes: Scene[];
  assets: Asset[];
}

export interface ProjectListItem {
  id: number;
  name: string;
  blog_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  scene_count: number;
  // Collaboration: acting user's role on this project ("owner" | "editor").
  role?: string;
  owner_name?: string | null;
}

export interface ProjectTemplateChangeJob {
  id: number;
  project_id: number;
  user_id: number;
  target_template: string;
  status: "queued" | "running" | "completed" | "failed";
  total_scenes: number;
  processed_scenes: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ProjectRegenerateScriptJob {
  id: number;
  project_id: number;
  user_id: number;
  /** The collaborator who initiated this regen — only they may approve/regenerate the review. */
  initiated_by_user_id?: number | null;
  status: "queued" | "running" | "awaiting_review" | "completed" | "failed";
  current_step?: "analyzing_instruction" | "generating_script" | "verify" | "generating_scenes";
  total_scenes: number;
  processed_scenes: number;
  error_message: string | null;
  user_instruction?: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Previous (pre-regeneration) scene for the verify-step before/after comparison.
export interface RegenerateScriptPreviewScene {
  order: number;
  title: string;
  display_text?: string | null;
  narration_text: string;
  visual_description: string;
  remotion_code?: string | null;
  preferred_layout?: string | null;
}

export interface RegenerateScriptPreviewOut {
  previous_scenes: RegenerateScriptPreviewScene[];
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ReviewState {
  project_sequence: number;
  has_review_for_project: boolean;
  should_show_inline: boolean;
}

export interface Review {
  id: number;
  user_id: number;
  project_id: number;
  rating: number;
  suggestion: string | null;
  source: "first_project_popup" | "inline_row";
  trigger_event: "delayed_popup" | "manual";
  project_sequence: number;
  plan_at_submission: string;
  created_at: string;
  updated_at: string;
}

export interface SubmitProjectReviewPayload {
  rating: 1 | 2 | 3 | 4 | 5;
  suggestion?: string;
  source: "first_project_popup" | "inline_row";
  trigger_event: "delayed_popup" | "manual";
}

export interface SubmitProjectReviewResponse {
  review: Review;
  review_state: ReviewState;
}

/** This user's star rating + message for a project's avatar overlays. */
export interface AvatarReview {
  id: number;
  user_id: number;
  project_id: number;
  rating: number;
  suggestion: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitAvatarReviewPayload {
  rating: 1 | 2 | 3 | 4 | 5;
  suggestion?: string;
}

export interface ChatResponse {
  reply: string;
  changes_made: string;
  updated_scenes: Scene[];
}

export interface StudioResponse {
  studio_url: string;
  port: number;
}

export interface BillingStatus {
  plan: string;
  videos_used: number;
  video_limit: number;
  can_create_video: boolean;
  stripe_subscription_id: string | null;
  is_active: boolean;
}

export interface SubscriptionDetail {
  id: number;
  plan_name: string;
  plan_slug: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  videos_used: number;
  amount_paid_cents: number;
  canceled_at: string | null;
  retention_offer_eligible: boolean;
  scheduled_plan_slug: string | null;
  scheduled_plan_name: string | null;
  scheduled_change_at: string | null;
  created_at: string;
}

export interface ChangePlanPreview {
  direction: "upgrade" | "downgrade";
  current_plan_slug: string;
  target_plan_slug: string;
  amount_due_today_cents: number;
  proration_credit_cents: number;
  credit_to_balance_cents: number;
  target_plan_price_cents: number;
  new_period_start_iso: string;
  new_period_end_iso: string | null;
  effective_date_iso: string;
  currency: string;
}

export interface ChangePlanResult {
  status: string;
  direction: "upgrade" | "downgrade";
  target_plan_slug: string;
  effective_date_iso: string;
  amount_due_today_cents: number;
}

export interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

export interface DataSummary {
  total_projects: number;
  total_videos_rendered: number;
  total_assets: number;
  account_created: string;
  plan: string;
}

export interface PlanInfo {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  video_limit: number;
  includes_studio: boolean;
  includes_chat_editor: boolean;
  includes_priority_support: boolean;
  sort_order: number;
}

export interface PublicConfig {
  google_client_id: string;
  stripe_publishable_key: string;
}

export interface PipelineStatus {
  status: string;
  step: number;
  running: boolean;
  error: string | null;
  error_code?: string | null;
  project_removed?: boolean;
  notice?: {
    code: string;
    message?: string;
    requested_video_length?: string;
    effective_video_length?: string;
    video_style?: string;
  } | null;
  stock_footage?: {
    current: number;
    total: number;
    scene_id: number;
  } | null;
  studio_port: number | null;
}

export interface RenderStatus {
  progress: number;
  rendered_frames: number;
  total_frames: number;
  done: boolean;
  error: string | null;
  time_remaining: string | null;
  /** Stable ETA from elapsed time and % complete (seconds). */
  eta_seconds: number | null;
  /** True when this API instance has no progress state (e.g. load-balanced poll). */
  progress_unknown?: boolean;
  render_attempt?: number | null;
  r2_video_url: string | null;
}
