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

export const createCheckoutSession = () =>
  api.post<{ checkout_url: string }>("/billing/checkout");

export const createPerVideoCheckout = (projectId: number) =>
  api.post<{ checkout_url: string }>("/billing/checkout-per-video", {
    project_id: projectId,
  });

export const createPortalSession = () =>
  api.post<{ portal_url: string }>("/billing/portal");

export const getBillingStatus = () =>
  api.get<BillingStatus>("/billing/status");

// ─── Project API ──────────────────────────────────────────

export const createProject = (
  blog_url: string,
  name?: string,
  voice_gender?: string,
  voice_accent?: string,
  accent_color?: string,
  bg_color?: string,
  text_color?: string,
  animation_instructions?: string
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
  });

export const listProjects = () =>
  api.get<ProjectListItem[]>("/projects");

export const getProject = (id: number) =>
  api.get<Project>(`/projects/${id}`);

export const deleteProject = (id: number) =>
  api.delete(`/projects/${id}`);

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

export const launchStudio = (id: number) =>
  api.post<StudioResponse>(`/projects/${id}/launch-studio`);

export const renderVideo = (id: number) =>
  api.post(`/projects/${id}/render`);

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

export const downloadVideo = async (id: number, filename?: string) => {
  const urlRes = await api.get<{ url: string }>(`/projects/${id}/download-url`);
  const a = document.createElement("a");
  a.href = urlRes.data.url;
  a.download = filename || "video.mp4";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
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
