import axios, { AxiosError } from "axios";
import { BACKEND_URL } from "./client";

const SESSION_KEY = "b2v_support_session";
const CONVERSATION_KEY = "b2v_support_conversation_id";

export type GuidanceStep = {
  selector: string;
  tooltip: string;
  placement?: string;
};

export type UIGuidance = {
  action_id: string;
  steps: GuidanceStep[];
};

export type NavigationHint = {
  target_route: string;
  requires_project_id: boolean;
  description: string;
};

export type ChatResponse = {
  conversation_id: number;
  answer: string;
  citations: string[];
  ui_guidance: UIGuidance[];
  navigation: NavigationHint | null;
};

export type SupportMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  page_path: string | null;
  cited_docs: string[] | null;
  ui_guidance: UIGuidance[] | null;
  created_at: string;
};

export type ConversationDetail = {
  id: number;
  summary: string;
  session_state: Record<string, unknown>;
  messages: SupportMessage[];
};

function getOrCreateSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function getStoredConversationId(): number | null {
  const raw = localStorage.getItem(CONVERSATION_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setStoredConversationId(id: number | null): void {
  if (id == null) {
    localStorage.removeItem(CONVERSATION_KEY);
  } else {
    localStorage.setItem(CONVERSATION_KEY, String(id));
  }
}

const supportApi = axios.create({
  baseURL: `${BACKEND_URL}/api/support`,
  headers: { "Content-Type": "application/json" },
});

supportApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("b2v_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Support-Session"] = getOrCreateSessionId();
  return config;
});

export async function sendChat(
  message: string,
  pagePath: string,
  conversationId: number | null,
): Promise<ChatResponse> {
  const { data } = await supportApi.post<ChatResponse>("/chat", {
    message,
    page_path: pagePath,
    conversation_id: conversationId,
  });
  setStoredConversationId(data.conversation_id);
  return data;
}

export type StreamDonePayload = Omit<ChatResponse, "answer">;

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onDone: (data: StreamDonePayload) => void;
  onError: (err: Error) => void;
};

export async function sendChatStream(
  message: string,
  pagePath: string,
  conversationId: number | null,
  callbacks: StreamCallbacks,
): Promise<void> {
  const authToken = localStorage.getItem("b2v_token");
  const sessionId = getOrCreateSessionId();
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/support/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        "X-Support-Session": sessionId,
      },
      body: JSON.stringify({ message, page_path: pagePath, conversation_id: conversationId }),
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }
  if (!res.ok || !res.body) {
    callbacks.onError(new Error(`HTTP ${res.status}`));
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          // Strip only the single leading space SSE mandates; do NOT trim() — tokens may start/end with spaces.
          const raw = line.slice(5);
          const data = raw.startsWith(" ") ? raw.slice(1) : raw;
          if (!data && eventType !== "token") continue;
          if (eventType === "token") {
            // Empty data line represents a newline character (SSE can't embed raw newlines)
            callbacks.onToken(data === "" ? "\n" : data);
          } else if (eventType === "done") {
            const parsed: StreamDonePayload = JSON.parse(data);
            setStoredConversationId(parsed.conversation_id);
            callbacks.onDone(parsed);
          } else if (eventType === "error") {
            callbacks.onError(new Error(data));
          }
          eventType = "";
        }
      }
    }
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function getConversation(
  conversationId: number,
): Promise<ConversationDetail | null> {
  try {
    const { data } = await supportApi.get<ConversationDetail>(
      `/conversations/${conversationId}`,
    );
    return data;
  } catch (err) {
    if ((err as AxiosError).response?.status === 404 || (err as AxiosError).response?.status === 403) {
      return null;
    }
    throw err;
  }
}

export async function startNewConversation(): Promise<void> {
  setStoredConversationId(null);
  try {
    await supportApi.post("/conversations/new", {});
  } catch {
    /* no-op endpoint, ignore */
  }
}

export async function claimConversation(conversationId: number): Promise<void> {
  await supportApi.post("/conversations/claim", {
    conversation_id: conversationId,
  });
}
