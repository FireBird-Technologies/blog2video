import api from "./http";
import {
  Asset,
  ChatMessage,
  ChatResponse,
  PipelineStatus,
  Project,
  ProjectListItem,
  RenderStatus,
  Scene,
  StudioResponse,
} from "./types";

// ─── Project API ──────────────────────────────────────────

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
  aspect_ratio?: string
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
  });

export const uploadLogo = (projectId: number, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ logo_url: string; logo_position: string }>(
    `/projects/${projectId}/logo`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const listProjects = () => api.get<ProjectListItem[]>("/projects");

export const getProject = (id: number) => api.get<Project>(`/projects/${id}`);

export const deleteProject = (id: number) => api.delete(`/projects/${id}`);

export const toggleAssetExclusion = (projectId: number, assetId: number) =>
  api.patch<{ id: number; excluded: boolean }>(
    `/projects/${projectId}/assets/${assetId}/exclude`
  );

export const scrapeProject = (id: number) =>
  api.post<Project>(`/projects/${id}/scrape`);

export const generateScript = (id: number) =>
  api.post<Project>(`/projects/${id}/generate-script`);

export const generateScenes = (id: number) =>
  api.post<Project>(`/projects/${id}/generate-scenes`);

// ─── Async pipeline ──────────────────────────────────────

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

export const renderVideo = (id: number, resolution: string = "720p") =>
  api.post(`/projects/${id}/render?resolution=${resolution}`);

export const getRenderStatus = (id: number) =>
  api.get<RenderStatus>(`/projects/${id}/render-status`);

export const downloadVideo = async (id: number, filename?: string) => {
  const urlRes = await api.get<{ url: string }>(`/projects/${id}/download-url`);
  const videoUrl = urlRes.data.url;

  // Fetch the video as a blob so the download works even with popup blockers.
  // Using fetch() directly (not axios) because the URL may be a cross-origin R2 URL.
  const resp = await fetch(videoUrl);
  if (!resp.ok) throw new Error(`Download failed (${resp.status})`);
  const blob = await resp.blob();
  const blobUrl = window.URL.createObjectURL(blob);

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

