import { BACKEND_URL, type Project, type Scene } from "../api/client";

/**
 * Resolve the URL for a scene's raw talking-head avatar clip — always the
 * plain mp4 (never the transparent matte twin), so it plays correctly
 * standalone as a normal <video>. Mirrors the lookup in VideoPreview.tsx
 * (R2 asset first, else the local /media path), minus the matte branch that
 * only matters when compositing onto a custom background.
 */
export function resolveAvatarClipUrl(project: Project, scene: Scene): string | undefined {
  if (!scene.avatar_video_path) return undefined;

  const avatarFilename = `avatar_scene_${scene.order}.mp4`;
  const avatarAssets = project.assets.filter((a) => a.asset_type === "avatar");
  const matching = avatarAssets.filter((a) => a.filename === avatarFilename);
  const latest = matching.length > 0 ? matching.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] : null;

  if (latest) {
    const isLocalDev = !BACKEND_URL || BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1");
    const localPath = `/media/projects/${project.id}/avatars/${avatarFilename}`;
    const base = isLocalDev ? (latest.r2_url ? latest.r2_url : localPath) : latest.r2_url ? latest.r2_url : `${BACKEND_URL}${localPath}`;
    return latest.id != null ? `${base}${base.includes("?") ? "&" : "?"}v=${latest.id}` : base;
  }

  const isLocalDev = !BACKEND_URL || BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1");
  const localPath = `/media/projects/${project.id}/avatars/${avatarFilename}`;
  return isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
}
