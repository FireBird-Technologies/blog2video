import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useCollabSocket, CollabEdit, CommentEvent, Peer } from "../hooks/useCollabSocket";

/** Lightweight scene reference for the history panel's scene navigator. */
export interface SceneRef {
  id: number;
  order: number;
  title: string;
}

interface CollabContextValue {
  projectId: number;
  projectName: string;
  isOwner: boolean;
  connected: boolean;
  peers: Peer[];
  inviteOpen: boolean;
  openInvite: () => void;
  closeInvite: () => void;
  onDraftResolved?: () => void;
}

const CollabContext = createContext<CollabContextValue | null>(null);

export function useCollab(): CollabContextValue {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error("useCollab must be used within <CollabProvider>");
  return ctx;
}

interface ProviderProps {
  projectId: number;
  projectName: string;
  isOwner: boolean;
  onRemoteEdit?: (edit: CollabEdit) => void;
  onRemoteComment?: (event: CommentEvent) => void;
  /** A bulk job finished elsewhere — refetch the whole project. */
  onRemoteReload?: () => void;
  onDraftResolved?: () => void;
  children: ReactNode;
}

/**
 * Owns the project's collaboration websocket + live state and exposes it to both
 * the header controls (presence) and the collaboration sub-bar (edit history), so
 * those can live in separate parts of the layout. Collaborator edits apply directly
 * to the live video — there is no draft to finalise or discard.
 */
export function CollabProvider({
  projectId,
  projectName,
  isOwner,
  onRemoteEdit,
  onRemoteComment,
  onRemoteReload,
  onDraftResolved,
  children,
}: ProviderProps) {
  const { token } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { connected, peers } = useCollabSocket({
    projectId,
    token,
    enabled: true,
    onEdit: onRemoteEdit,
    onComment: onRemoteComment,
    onReload: onRemoteReload,
  });

  const openInvite = useCallback(() => setInviteOpen(true), []);
  const closeInvite = useCallback(() => setInviteOpen(false), []);

  const value: CollabContextValue = {
    projectId,
    projectName,
    isOwner,
    connected,
    peers: peers.filter((p: Peer) => p.user_id !== undefined),
    inviteOpen,
    openInvite,
    closeInvite,
    onDraftResolved,
  };

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}
