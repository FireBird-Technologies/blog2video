export interface UserInfo {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  plan: string;
  videos_used_this_period: number;
  video_limit: number;
  can_create_video: boolean;
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
  aspect_ratio: string;
  custom_template_missing?: boolean;
  review_state?: ReviewState | null;
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
  created_at: string;
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
