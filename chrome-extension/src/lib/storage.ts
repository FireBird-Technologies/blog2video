export interface StoredAuth {
  accessToken: string;
}

const AUTH_KEY = "b2v_auth";
const PENDING_KEY = "b2v_pending_connection";

export interface PendingConnection {
  connectionId: number;
  deviceCode: string;
}

export async function getAuth(): Promise<StoredAuth | null> {
  const data = await chrome.storage.local.get(AUTH_KEY);
  return data[AUTH_KEY] ?? null;
}

export async function setAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([AUTH_KEY]);
}

export async function getPendingConnection(): Promise<PendingConnection | null> {
  const data = await chrome.storage.local.get(PENDING_KEY);
  return data[PENDING_KEY] ?? null;
}

export async function setPendingConnection(pending: PendingConnection): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: pending });
}

export async function clearPendingConnection(): Promise<void> {
  await chrome.storage.local.remove([PENDING_KEY]);
}

const ACTIVE_PROJECT_KEY = "b2v_active_project";

export interface ActiveProject {
  projectId: number;
  /** "generating" until the pipeline finishes scenes, "scenes_ready" once scenes exist
   *  and render must be started from the webapp, "rendering" once render has started,
   *  "review" when the website needs user input, "done" once a video URL exists — kept
   *  (not cleared) so reopening the popup after the video finishes still shows it
   *  instead of the template picker. */
  phase: "generating" | "scenes_ready" | "rendering" | "review" | "done";
  videoUrl?: string;
  previewUrl?: string | null;
}

/** Popups close the instant they lose focus, so an in-flight generate/render must be
 *  tracked outside popup state — reopening the popup checks this to resume polling
 *  the same project instead of dropping back to the template picker. */
export async function getActiveProject(): Promise<ActiveProject | null> {
  const data = await chrome.storage.local.get(ACTIVE_PROJECT_KEY);
  return data[ACTIVE_PROJECT_KEY] ?? null;
}

export async function setActiveProject(project: ActiveProject): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_PROJECT_KEY]: project });
}

export async function clearActiveProject(): Promise<void> {
  await chrome.storage.local.remove([ACTIVE_PROJECT_KEY]);
}
