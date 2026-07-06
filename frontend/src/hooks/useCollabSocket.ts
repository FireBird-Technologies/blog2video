import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../api/http";

// ─── Message shapes ───────────────────────────────────────

export interface Peer {
  user_id: number;
  name: string;
  picture: string | null;
}

export interface CollabEdit {
  scope: "scene" | "project";
  scene_id?: number;
  field: string;
  value: unknown;
  user_id: number;
  name: string;
  change_set_id: string;
}

interface ProjectState {
  project: Record<string, unknown>;
  scenes: Array<Record<string, unknown> & { id: number }>;
}

export interface CommentEvent {
  type: "comment_added" | "comment_deleted";
  comment?: { scene_id: number; [k: string]: unknown };
  comment_id?: number;
  scene_id?: number;
}

interface UseCollabSocketOpts {
  projectId: number;
  token: string | null;
  enabled: boolean;
  onEdit?: (edit: CollabEdit) => void;
  onComment?: (event: CommentEvent) => void;
  /** A bulk job (template change, regen) finished — refetch the whole project. */
  onReload?: () => void;
}

interface UseCollabSocket {
  connected: boolean;
  peers: Peer[];
  state: ProjectState | null;
  /** Push a local field edit; it applies directly to the live video for everyone. */
  sendEdit: (edit: {
    scope: "scene" | "project";
    scene_id?: number;
    field: string;
    value: unknown;
    change_set_id?: string;
  }) => void;
  /** Advisory soft lock so peers see "X is editing this scene". */
  lockScene: (sceneId: number) => void;
  unlockScene: (sceneId: number) => void;
}

/**
 * Live collaboration socket for a project.
 *
 * Connects to the backend websocket, tracks presence + the seeded project state,
 * applies inbound edits via ``onEdit``, and exposes ``sendEdit`` to broadcast local
 * edits (which apply directly to the live video). Reconnects with backoff while
 * ``enabled``. No-op (disconnected) when disabled or unauthenticated so single-owner
 * projects pay no websocket cost until shared.
 */
export function useCollabSocket({
  projectId,
  token,
  enabled,
  onEdit,
  onComment,
  onReload,
}: UseCollabSocketOpts): UseCollabSocket {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [state, setState] = useState<ProjectState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUsRef = useRef(false);

  // Keep latest callbacks without re-opening the socket.
  const cbRef = useRef({ onEdit, onComment, onReload });
  cbRef.current = { onEdit, onComment, onReload };

  const connect = useCallback(() => {
    if (!enabled || !token) return;
    console.log("[COLLAB] connect() called, projectId=", projectId, "existing readyState=", wsRef.current?.readyState);
    // Don't open a second socket if one is already open or connecting — prevents a
    // pile of orphaned server-side connections when connect() runs more than once.
    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }
    closedByUsRef.current = false;

    const scheme = BACKEND_URL.startsWith("https") ? "wss" : window.location.protocol === "https:" ? "wss" : "ws";
    const host = BACKEND_URL
      ? BACKEND_URL.replace(/^https?:\/\//, "")
      : window.location.host;
    const url = `${scheme}://${host}/api/projects/${projectId}/collab?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "init":
          setState(msg.state as ProjectState);
          setPeers((msg.peers as Peer[]) || []);
          break;
        case "presence":
          console.log("[COLLAB] presence", msg.event, "peers:", (msg.peers as Peer[])?.length);
          setPeers((msg.peers as Peer[]) || []);
          break;
        case "edit":
          console.log("[COLLAB] received edit", msg);
          cbRef.current.onEdit?.(msg as unknown as CollabEdit);
          break;
        case "comment_added":
        case "comment_deleted":
          cbRef.current.onComment?.(msg as unknown as CommentEvent);
          break;
        case "project_reloaded":
          cbRef.current.onReload?.();
          break;
        default:
          break;
      }
    };

    ws.onclose = (ev) => {
      setConnected(false);
      wsRef.current = null;
      // 4401/4403/4404 are auth/access closes — don't retry (revoked or no access).
      const noRetry = [4401, 4403, 4404].includes(ev.code);
      if (!closedByUsRef.current && !noRetry && enabled) {
        const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
        retryRef.current += 1;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    };
  }, [enabled, token, projectId]);

  useEffect(() => {
    console.log("[COLLAB] hook effect MOUNT, projectId=", projectId);
    connect();
    return () => {
      console.log("[COLLAB] hook effect CLEANUP, projectId=", projectId);
      closedByUsRef.current = true;
      // Cancel any pending reconnect so it can't open a socket after unmount.
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Tell the server we're leaving so it drops us from presence immediately,
        // rather than waiting for the TCP disconnect to surface.
        try {
          ws.send(JSON.stringify({ type: "leave" }));
        } catch {
          /* noop */
        }
      }
      ws?.close();
      wsRef.current = null;
    };
  }, [connect]);

  // Tab close / hard refresh doesn't reliably run the React cleanup above, so send
  // an explicit leave on pagehide too, dropping us from presence for the others.
  useEffect(() => {
    const onPageHide = () => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "leave" }));
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  const send = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const sendEdit = useCallback<UseCollabSocket["sendEdit"]>(
    (edit) => send({ type: "edit", ...edit }),
    [send]
  );

  const lockScene = useCallback((sceneId: number) => send({ type: "lock", scene_id: sceneId }), [send]);
  const unlockScene = useCallback((sceneId: number) => send({ type: "unlock", scene_id: sceneId }), [send]);

  return { connected, peers, state, sendEdit, lockScene, unlockScene };
}
