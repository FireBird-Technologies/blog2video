import { API_BASE_URL } from "../config";
import { getAuth } from "../lib/storage";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = await getAuth();
  const headers = new Headers(init.headers);
  if (auth) headers.set("Authorization", `Bearer ${auth.accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Connection (unauthenticated) ───

export interface BeginConnectionResult {
  connection_id: number;
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
}

export function beginConnection(browserLabel: string): Promise<BeginConnectionResult> {
  return request("/connections/begin", {
    method: "POST",
    body: JSON.stringify({ browser_label: browserLabel }),
  });
}

export type ConnectionTokenResult =
  | { status: "authorization_pending" }
  | { status: "connected"; access_token: string; connection_id: number };

export function exchangeConnectionToken(connectionId: number, deviceCode: string): Promise<ConnectionTokenResult> {
  return request("/connections/token", {
    method: "POST",
    body: JSON.stringify({ connection_id: connectionId, device_code: deviceCode }),
  });
}

export function revokeConnection(): Promise<{ revoked: boolean }> {
  return request("/connections/revoke", { method: "POST" });
}

// ─── Account + catalog ───

export interface Account {
  email: string;
  name: string;
  plan: string;
  videos_used: number;
  video_limit: number;
  can_create_video: boolean;
  ai_edit_credits_available: number;
}

export function getAccount(): Promise<Account> {
  return request("/account");
}

export interface CatalogTemplate {
  id: string;
  name: string;
  preview_url: string;
  [key: string]: unknown;
}

export interface CatalogVoice {
  voice_id: string;
  name: string;
  preview_url: string;
  gender: string;
  accent: string;
  description: string;
  source: string;
}

export interface Catalog {
  templates: CatalogTemplate[];
  voices: CatalogVoice[];
}

export function getCatalog(): Promise<Catalog> {
  return request("/catalog");
}

// ─── Project lifecycle ───

export interface CreateProjectInput {
  source_url: string;
  content: string;
  idempotency_key: string;
  content_hash: string;
  title: string;
  template: string;
  video_style?: "auto" | "explainer" | "promotional" | "storytelling";
  video_length?: "auto" | "short" | "medium" | "detailed" | "more_detailed";
  voice_gender?: string;
  voice_accent?: string;
  custom_voice_id?: string | null;
  aspect_ratio?: "landscape" | "portrait";
  stock_footage_enabled?: boolean;
  script_review_enabled?: boolean;
  logo_position?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
  logo_opacity?: number;
}

export interface CreateProjectResult {
  project_id: number;
  state: "queued" | "existing";
  editor_available: boolean;
}

export function createProject(data: CreateProjectInput): Promise<CreateProjectResult> {
  return request("/projects", {
    method: "POST",
    headers: { "Idempotency-Key": data.idempotency_key },
    body: JSON.stringify(data),
  });
}

export function uploadProjectLogo(projectId: number, file: File): Promise<{ logo_url: string }> {
  const body = new FormData();
  body.append("file", file);
  return request(`/projects/${projectId}/logo`, { method: "POST", body });
}

export interface ProjectStatus {
  project_id: number;
  status: string;
  step: number;
  running: boolean;
  error: string | null;
  error_code?: string | null;
  notice?: string | null;
  r2_video_url: string | null;
  editor_available: boolean;
}

export function getProjectStatus(projectId: number): Promise<ProjectStatus> {
  return request(`/projects/${projectId}/status`);
}

/** The server-side project pointer for this browser connection. */
export function getCurrentProject(): Promise<ProjectStatus | null> {
  return request("/projects/current");
}

export function clearCurrentProject(): Promise<void> {
  return request("/projects/current", { method: "DELETE" });
}

export interface RenderStartResult {
  detail: string;
  progress: number;
  resolution?: string;
  render_run_id?: string;
  r2_video_url?: string;
}

export function startRender(projectId: number): Promise<RenderStartResult> {
  return request(`/projects/${projectId}/render`, { method: "POST" });
}

export interface RenderStatus {
  progress: number;
  status: string;
  done?: boolean;
  error?: string | null;
  r2_video_url: string | null;
}

export function getRenderStatus(projectId: number): Promise<RenderStatus> {
  return request(`/projects/${projectId}/render-status`);
}

export interface EmbedResult {
  preview_url: string;
}

export function getEmbed(projectId: number): Promise<EmbedResult> {
  return request(`/projects/${projectId}/embed`, { method: "POST" });
}
