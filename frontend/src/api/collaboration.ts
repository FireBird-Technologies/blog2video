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
  invited_email: string;
  invite_token: string;
  status: string;
}

export interface FieldChange {
  /** Row id of this individual field edit — the unit of per-field revert/redo. */
  id: number | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  scene_id: number | null;
  /** This field edit is currently reverted (so its control shows "Redo"). */
  reverted: boolean;
  /** A newer edit to this field exists — it can no longer be reverted/redone. */
  stale: boolean;
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
  /** True when a newer edit to one of this change-set's fields exists — only the
   *  latest edit of a field can be reverted/redone. */
  stale: boolean;
  /** Row ids of this change-set's still-actionable (latest, revertable) fields —
   *  what "Revert all" / "Redo all" acts on. */
  revertable_field_ids: number[];
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

/** Public lookup of a single invite by token — works signed out or as any user. */
export const getInviteByToken = (token: string) =>
  api.get<PendingInvite>(`/collab/invites/by-token/${token}`);

export const acceptInvite = (token: string) =>
  api.post<{ project_id: number; status: string }>(`/collab/invites/${token}/accept`);

export const rejectInvite = (token: string) =>
  api.post<{ project_id: number; status: string }>(`/collab/invites/${token}/reject`);

// ─── History / revert ─────────────────────────────────────

export const getProjectHistory = (projectId: number) =>
  api.get<ChangeSet[]>(`/projects/${projectId}/history`);

export const getSceneHistory = (projectId: number, sceneId: number) =>
  api.get<ChangeSet[]>(`/projects/${projectId}/scenes/${sceneId}/history`);

/** Revert/redo individual field edits by row id. Each row toggles based on its own
 *  state (revert if active, redo if reverted). "Revert all" passes every actionable
 *  row id of a change-set. */
export const revertFields = (projectId: number, rowIds: number[]) =>
  api.post<ChangeSet[]>(`/projects/${projectId}/history/revert`, { row_ids: rowIds });

// ─── Scene comments ───────────────────────────────────────

export interface SceneComment {
  id: number;
  scene_id: number;
  body: string;
  created_at: string;
  /** Parent comment id for a threaded reply; null for a root comment. */
  parent_id: number | null;
  user_id: number | null;
  user_name: string | null;
  user_picture: string | null;
}

export const listComments = (projectId: number, sceneId?: number) =>
  api.get<SceneComment[]>(`/projects/${projectId}/comments`, {
    params: sceneId != null ? { scene_id: sceneId } : undefined,
  });

/** Post a comment, or a threaded reply when `parentId` is given. */
export const addComment = (
  projectId: number,
  sceneId: number,
  body: string,
  parentId?: number | null,
) =>
  api.post<SceneComment>(`/projects/${projectId}/scenes/${sceneId}/comments`, {
    body,
    parent_id: parentId ?? null,
  });

export const deleteComment = (projectId: number, commentId: number) =>
  api.delete(`/projects/${projectId}/comments/${commentId}`);
