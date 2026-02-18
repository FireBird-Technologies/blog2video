export * from "./types";
export * from "./auth";
export * from "./billing";
export * from "./projects";
export * from "./enterprise";

import axios from "axios";

// In production, VITE_BACKEND_URL points to the Cloud Run backend.
// In local dev it's empty — Vite proxy handles /api and /media routing.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Auth interceptor ─────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("b2v_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("b2v_token");
      localStorage.removeItem("b2v_user");
      // Only redirect if not already on landing/login page
      if (
        window.location.pathname !== "/" &&
        window.location.pathname !== "/pricing"
      ) {
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

// ─── Types ────────────────────────────────────────────────

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
  visual_description: string;
  remotion_code: string | null;
  voiceover_path: string | null;
  duration_seconds: number;
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
  blog_url: string | null;
  blog_content: string | null;
  status: string;
  template?: string;
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
  custom_voice_id: string | null;
  aspect_ratio: string;
  ai_assisted_editing_count?: number;
  created_at: string;
  updated_at: string;
  scenes: Scene[];
  assets: Asset[];
}

export interface ProjectListItem {
  id: number;
  name: string;
  blog_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  scene_count: number;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
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

// ─── Auth API ─────────────────────────────────────────────

export const googleLogin = (credential: string) =>
  api.post<AuthResponse>("/auth/google", { credential });

export const getMe = () => api.get<UserInfo>("/auth/me");

export const logoutCleanup = () => api.post("/auth/logout");

export const getPublicConfig = () =>
  api.get<PublicConfig>("/config/public");

// ─── Billing API ──────────────────────────────────────────

export const createCheckoutSession = (billingCycle: "monthly" | "annual" = "monthly") =>
  api.post<{ checkout_url: string }>("/billing/checkout", {
    billing_cycle: billingCycle,
  });

export const createPerVideoCheckout = (projectId?: number) =>
  api.post<{ checkout_url: string }>("/billing/checkout-per-video", {
    project_id: projectId ?? null,
  });

export const createPortalSession = () =>
  api.post<{ portal_url: string }>("/billing/portal");

export const getBillingStatus = () =>
  api.get<BillingStatus>("/billing/status");

export const getSubscriptionDetail = () =>
  api.get<SubscriptionDetail | null>("/billing/subscription");

export const getInvoices = () =>
  api.get<Invoice[]>("/billing/invoices");

export const getDataSummary = () =>
  api.get<DataSummary>("/billing/data-summary");

export const getPlans = () =>
  api.get<PlanInfo[]>("/billing/plans");

export const cancelSubscription = () =>
  api.post("/billing/cancel");

export const resumeSubscription = () =>
  api.post("/billing/resume");

// ─── Project API ──────────────────────────────────────────

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  preview_colors?: { accent: string; bg: string; text: string };
}

export const getTemplates = () =>
  api.get<TemplateMeta[]>("/templates");

export const createProject = (
  blog_url: string,
  name?: string,
  voice_gender?: string,
  voice_accent?: string,
  accent_color?: string,
  bg_color?: string,
  text_color?: string,
  animation_instructions?: string,
  logo_position?: string,
  logo_opacity?: number,
  custom_voice_id?: string,
  aspect_ratio?: string,
  template?: string
) =>
  api.post<Project>("/projects", {
    blog_url,
    name,
    voice_gender,
    voice_accent,
    accent_color,
    bg_color,
    text_color,
    animation_instructions,
    logo_position,
    logo_opacity,
    custom_voice_id,
    aspect_ratio,
    template,
  });

export const createProjectFromDocs = (
  files: File[],
  config: {
    name?: string;
    voice_gender?: string;
    voice_accent?: string;
    accent_color?: string;
    bg_color?: string;
    text_color?: string;
    animation_instructions?: string;
    logo_position?: string;
    logo_opacity?: number;
    custom_voice_id?: string;
    aspect_ratio?: string;
    template?: string;
  } = {}
) => {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  if (config.name) formData.append("name", config.name);
  if (config.voice_gender) formData.append("voice_gender", config.voice_gender);
  if (config.voice_accent) formData.append("voice_accent", config.voice_accent);
  if (config.accent_color) formData.append("accent_color", config.accent_color);
  if (config.bg_color) formData.append("bg_color", config.bg_color);
  if (config.text_color) formData.append("text_color", config.text_color);
  if (config.animation_instructions)
    formData.append("animation_instructions", config.animation_instructions);
  if (config.logo_position) formData.append("logo_position", config.logo_position);
  if (config.logo_opacity !== undefined)
    formData.append("logo_opacity", String(config.logo_opacity));
  if (config.custom_voice_id) formData.append("custom_voice_id", config.custom_voice_id);
  if (config.aspect_ratio) formData.append("aspect_ratio", config.aspect_ratio);
  if (config.template) formData.append("template", config.template);
  return api.post<Project>("/projects/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const uploadProjectDocuments = (projectId: number, files: File[]) => {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  return api.post<Project>(`/projects/${projectId}/upload-documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const uploadLogo = (projectId: number, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ logo_url: string; logo_position: string }>(
    `/projects/${projectId}/logo`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const listProjects = () =>
  api.get<ProjectListItem[]>("/projects");

export const getProject = (id: number) =>
  api.get<Project>(`/projects/${id}`);

export const deleteProject = (id: number) =>
  api.delete(`/projects/${id}`);

export const toggleAssetExclusion = (projectId: number, assetId: number) =>
  api.patch<{ id: number; excluded: boolean }>(
    `/projects/${projectId}/assets/${assetId}/exclude`
  );

export const deleteAsset = (projectId: number, assetId: number) =>
  api.delete(`/projects/${projectId}/assets/${assetId}`);

export const scrapeProject = (id: number) =>
  api.post<Project>(`/projects/${id}/scrape`);

export const generateScript = (id: number) =>
  api.post<Project>(`/projects/${id}/generate-script`);

export const generateScenes = (id: number) =>
  api.post<Project>(`/projects/${id}/generate-scenes`);

// ─── Async pipeline ──────────────────────────────────────

export interface PipelineStatus {
  status: string;
  step: number;
  running: boolean;
  error: string | null;
  studio_port: number | null;
}

export const startGeneration = (id: number) =>
  api.post(`/projects/${id}/generate`);

export const getPipelineStatus = (id: number) =>
  api.get<PipelineStatus>(`/projects/${id}/status`);

export const updateScene = (
  projectId: number,
  sceneId: number,
  data: Partial<Scene>
) => api.put<Scene>(`/projects/${projectId}/scenes/${sceneId}`, data);

export interface LayoutInfo {
  layouts: string[];
  layout_names: Record<string, string>;
}

export const getValidLayouts = (projectId: number) =>
  api.get<LayoutInfo>(`/projects/${projectId}/layouts`);

export interface SceneOrderItem {
  scene_id: number;
  order: number;
}

export const reorderScenes = (
  projectId: number,
  sceneOrders: SceneOrderItem[]
) =>
  api.post<Scene[]>(`/projects/${projectId}/scenes/reorder`, {
    scene_orders: sceneOrders,
  });

export const regenerateScene = (
  projectId: number,
  sceneId: number,
  description: string,
  narrationText: string,
  regenerateVoiceover: boolean,
  layout?: string,
  imageFile?: File
) => {
  const formData = new FormData();
  // Only append description if it has a value
  if (description && description.trim()) {
    formData.append("description", description);
  }
  formData.append("narration_text", narrationText);
  formData.append("regenerate_voiceover", regenerateVoiceover ? "true" : "false");
  if (layout) formData.append("layout", layout);
  if (imageFile) formData.append("image", imageFile);
  return api.post<Scene>(
    `/projects/${projectId}/scenes/${sceneId}/regenerate`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const launchStudio = (id: number) =>
  api.post<StudioResponse>(`/projects/${id}/launch-studio`);

export const renderVideo = (id: number, resolution: string = "1080p") =>
  api.post(`/projects/${id}/render?resolution=${resolution}`);

export interface RenderStatus {
  progress: number;
  rendered_frames: number;
  total_frames: number;
  done: boolean;
  error: string | null;
  time_remaining: string | null;
  r2_video_url: string | null;
}

export const getRenderStatus = (id: number) =>
  api.get<RenderStatus>(`/projects/${id}/render-status`);

/** Fetch video as blob for playback. Returns object URL; caller must revoke it. */
export const fetchVideoBlob = async (id: number): Promise<string> => {
  const res = await api.get(`/projects/${id}/download`, {
    responseType: "blob",
  });
  if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
  const blob = res.data as Blob;
  if (!blob || blob.size === 0) throw new Error("Empty video");
  return window.URL.createObjectURL(blob);
};

export const downloadVideo = async (id: number, filename?: string) => {
  const blobUrl = await fetchVideoBlob(id);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "video.mp4";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export const downloadStudioZip = async (id: number, filename?: string) => {
  const res = await api.get(`/projects/${id}/download-studio`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "studio_project.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const sendChatMessage = (id: number, message: string) =>
  api.post<ChatResponse>(`/projects/${id}/chat`, { message });

export const getChatHistory = (id: number) =>
  api.get<ChatMessage[]>(`/projects/${id}/chat/history`);

export default api;
