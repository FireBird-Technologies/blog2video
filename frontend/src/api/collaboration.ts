import api from "./http";

// ─── Collaboration types ──────────────────────────────────

export interface Member {
  id: number;
  email: string;
  role: string; // "owner" | "editor"
  status: string; // "pending" | "accepted" | "revoked"
  user_id: number | null;
  name: string | null;
  picture: string | null;
  created_at: string;
  is_you: boolean;
}

export interface PendingInvite {
  project_id: number;
  project_name: string;
  invited_by: string | null;
  invite_token: string;
}

export interface FieldChange {
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  scene_id: number | null;
}

export interface ChangeSet {
  change_set_id: string | null;
  target: string; // "published" (edits apply directly to the live video)
  edited_at: string;
  is_ai_assisted: boolean;
  user_instruction: string | null;
  reverted: boolean;
  revert_of_change_set_id: string | null;
  /** False for bulk operations logged for visibility but not revertable. */
  revertable: boolean;
  user_id: number | null;
  user_name: string | null;
  user_picture: string | null;
  changes: FieldChange[];
}

// ─── Members ──────────────────────────────────────────────

export const listMembers = (projectId: number) =>
  api.get<Member[]>(`/projects/${projectId}/members`);

export const inviteMember = (projectId: number, email: string) =>
  api.post<Member>(`/projects/${projectId}/members`, { email });

export const revokeMember = (projectId: number, memberId: number) =>
  api.delete(`/projects/${projectId}/members/${memberId}`);

// ─── Invites (invitee side) ───────────────────────────────

export const listMyInvites = () => api.get<PendingInvite[]>(`/collab/invites`);

export const acceptInvite = (token: string) =>
  api.post<{ project_id: number; status: string }>(`/collab/invites/${token}/accept`);

// ─── History / revert ─────────────────────────────────────

export const getProjectHistory = (projectId: number) =>
  api.get<ChangeSet[]>(`/projects/${projectId}/history`);

export const getSceneHistory = (projectId: number, sceneId: number) =>
  api.get<ChangeSet[]>(`/projects/${projectId}/scenes/${sceneId}/history`);

export const revertChangeSet = (projectId: number, changeSetId: string) =>
  api.post<ChangeSet[]>(`/projects/${projectId}/history/${changeSetId}/revert`);

// ─── Scene comments ───────────────────────────────────────

export interface SceneComment {
  id: number;
  scene_id: number;
  body: string;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  user_picture: string | null;
}

export const listComments = (projectId: number, sceneId?: number) =>
  api.get<SceneComment[]>(`/projects/${projectId}/comments`, {
    params: sceneId != null ? { scene_id: sceneId } : undefined,
  });

export const addComment = (projectId: number, sceneId: number, body: string) =>
  api.post<SceneComment>(`/projects/${projectId}/scenes/${sceneId}/comments`, { body });

export const deleteComment = (projectId: number, commentId: number) =>
  api.delete(`/projects/${projectId}/comments/${commentId}`);
