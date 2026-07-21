import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getConversation,
  getStoredConversationId,
  HttpError,
  sendChatStream,
  setStoredConversationId,
  startNewConversation,
  type NavigationHint,
  type SupportMessage,
  type UIGuidance,
} from "../../api/support";
import { useAuth } from "../../hooks/useAuth";
import SupportAuthModal from "../SupportAuthModal";
import { useSupportTour } from "./SupportTourContext";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  ui_guidance?: UIGuidance[];
  navigation?: NavigationHint | null;
  pending?: boolean;
  streaming?: boolean;
};

function fromServer(msg: SupportMessage): LocalMessage {
  return {
    role: msg.role,
    content: msg.content,
    citations: msg.cited_docs ?? undefined,
    ui_guidance: msg.ui_guidance ?? undefined,
  };
}

const SUGGESTED_QUESTIONS = [
  "How do I turn an article into a video?",
  "What templates are available?",
  "How do I render and download my video?",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <p className="font-bold text-sm text-gray-900 mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-semibold text-sm text-gray-900 mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold text-xs text-gray-700 mt-2 mb-0.5">{children}</p>,
        p: ({ children }) => <p className="text-sm text-gray-900 leading-relaxed mb-1 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1 text-sm">{children}</ol>,
        li: ({ children }) => <li className="text-gray-800 text-sm">{children}</li>,
        code: ({ children }) => <code className="bg-gray-100 rounded px-1 text-xs font-mono text-gray-800">{children}</code>,
        pre: ({ children }) => <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto my-1">{children}</pre>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function SupportChat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { startTour } = useSupportTour();
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<number | null>(getStoredConversationId());

  useEffect(() => {
    let cancelled = false;
    const cid = conversationIdRef.current;
    if (cid == null) return;
    (async () => {
      const conv = await getConversation(cid);
      if (cancelled) return;
      if (!conv) {
        setStoredConversationId(null);
        conversationIdRef.current = null;
        return;
      }
      setMessages(conv.messages.map(fromServer));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // If the user becomes signed-in through any path (not just this modal's own
  // onSuccess — e.g. they already had a session, or signed in elsewhere while
  // this panel was mounted), never leave a stale sign-in prompt showing.
  useEffect(() => {
    if (user && showSignIn) {
      setShowSignIn(false);
      setPendingMessage(null);
    }
  }, [user, showSignIn]);

  const submitMessage = async (text: string) => {
    if (!text || sending) return;
    if (!user) {
      setPendingMessage(text);
      setShowSignIn(true);
      return;
    }
    setSending(true);
    // Index of the assistant placeholder we're about to append. Tracked explicitly
    // (not "last message") because input re-enables on answer_done, so the user may
    // append new messages before this request's `done` event arrives.
    const assistantIndex = messages.length + 1;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "", pending: true, streaming: true },
    ]);
    const updateAssistant = (patch: LocalMessage) => {
      setMessages((m) => {
        if (assistantIndex >= m.length) return m;
        const copy = m.slice();
        copy[assistantIndex] = patch;
        return copy;
      });
    };
    let accumulated = "";
    await sendChatStream(text, location.pathname, conversationIdRef.current, {
      onToken: (token) => {
        accumulated += token;
        updateAssistant({ role: "assistant", content: accumulated, pending: false, streaming: true });
      },
      onAnswerDone: (data) => {
        // Visible answer is complete — stop the cursor and unfreeze the input now.
        // Citations and "Show me" buttons attach when `done` arrives a moment later.
        conversationIdRef.current = data.conversation_id;
        updateAssistant({ role: "assistant", content: accumulated.trim() || "Sorry — I couldn't form an answer.", streaming: false });
        setSending(false);
      },
      onDone: (data) => {
        conversationIdRef.current = data.conversation_id;
        const answer = accumulated.trim() || "Sorry — I couldn't form an answer.";
        updateAssistant({ role: "assistant", content: answer, citations: data.citations, ui_guidance: data.ui_guidance, navigation: data.navigation, streaming: false });
        if (data.ui_guidance.length > 0 && !data.navigation) {
          const steps = data.ui_guidance.flatMap((g) => g.steps);
          if (steps.length > 0) startTour(steps);
        }
      },
      onError: (err) => {
        console.error("support chat stream error", err);
        if (err instanceof HttpError && err.status === 401) {
          void logout();
          updateAssistant({ role: "assistant", content: "Your session expired.", streaming: false });
          setPendingMessage(text);
          setShowSignIn(true);
          return;
        }
        updateAssistant({ role: "assistant", content: "Sorry — something went wrong. Please try again in a moment.", streaming: false });
      },
    });
    setSending(false);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void submitMessage(text);
  };

  const handleNavigate = (nav: NavigationHint, guidance: UIGuidance[]) => {
    const steps = guidance.flatMap((g) => g.steps);
    if (nav.requires_project_id) {
      const projectMatch = location.pathname.match(/\/projects?\/([^/]+)/);
      const projectId = projectMatch?.[1];
      if (projectId) {
        const resolved = nav.target_route.replace(":id", projectId);
        navigate(resolved);
        if (steps.length > 0) window.setTimeout(() => startTour(steps), 1500);
      } else {
        // No project in URL — send to dashboard so user can pick a project
        navigate("/dashboard");
      }
    } else {
      navigate(nav.target_route);
      if (steps.length > 0) window.setTimeout(() => startTour(steps), 1500);
    }
  };

  const handleNewConversation = async () => {
    await startNewConversation();
    conversationIdRef.current = null;
    setMessages([]);
  };

  const sendSuggested = (q: string) => {
    void submitMessage(q);
  };

  return (
    // Mobile: full screen. Desktop: fixed bottom-right panel.
    <div className="fixed bottom-20 right-4 z-[9999] w-[340px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
      {showSignIn && (
        <SupportAuthModal
          onClose={() => {
            setShowSignIn(false);
            setPendingMessage(null);
          }}
          onSuccess={() => {
            setShowSignIn(false);
            const text = pendingMessage;
            setPendingMessage(null);
            if (text) void submitMessage(text);
          }}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-purple-600 rounded-t-xl shrink-0">
        <div>
          <p className="text-white font-semibold text-sm">Blog2Video Support</p>
          <p className="text-purple-100 text-xs">Ask anything about turning content into video</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewConversation}
            title="New conversation"
            className="text-purple-100 hover:text-white text-xs px-2 py-1 rounded hover:bg-purple-700"
          >
            New
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="text-purple-100 hover:text-white text-lg px-2 leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="px-1 py-4">
            <p className="font-medium text-gray-700 text-sm mb-3">How can I help you today?</p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendSuggested(q)}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-purple-200 bg-white text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-colors shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "bg-purple-600 text-white rounded-2xl rounded-br-sm px-3 py-2 max-w-[85%] text-sm"
                  : "bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%] shadow-sm"
              }
            >
              {m.pending ? (
                <TypingIndicator />
              ) : m.role === "user" ? (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              ) : m.streaming ? (
                <div>
                  <MarkdownMessage content={m.content} />
                  <span className="inline-block w-1.5 h-3.5 bg-purple-400 animate-pulse ml-0.5 rounded-sm align-middle" />
                </div>
              ) : (
                <MarkdownMessage content={m.content} />
              )}

              {(() => {
                if (m.pending || m.role !== "assistant") return null;
                const steps = m.ui_guidance?.flatMap((g) => g.steps) ?? [];
                const nav = m.navigation;

                if (nav) {
                  // If tour requires a project ID, we can only show it when already on a project page
                  const onProjectPage = /\/projects?\/[^/]+/.test(location.pathname);
                  const canNavigate = !nav.requires_project_id;
                  const canShowTour = nav.requires_project_id ? onProjectPage : true;

                  if (canNavigate) {
                    // Non-project page action (e.g. /pricing) — can navigate directly
                    return (
                      <div className="mt-2 p-2 rounded bg-purple-50 border border-purple-200 text-xs flex items-center justify-between gap-3">
                        <p className="text-purple-700">{nav.description}</p>
                        <button
                          onClick={() => { onClose(); handleNavigate(nav, m.ui_guidance ?? []); }}
                          className="shrink-0 px-2.5 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 whitespace-nowrap"
                        >
                          {steps.length > 0 ? "Show me →" : "Take me there →"}
                        </button>
                      </div>
                    );
                  }

                  if (canShowTour && steps.length > 0) {
                    // Already on a project page — show tour directly
                    return (
                      <button
                        onClick={() => { onClose(); startTour(steps); }}
                        className="mt-2 text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                      >
                        Show me
                      </button>
                    );
                  }

                  // requires_project_id but not on a project — just show the hint text, no button
                  return (
                    <p className="mt-2 text-xs text-purple-600 italic">{nav.description} Open a project to use this feature.</p>
                  );
                }

                if (steps.length > 0) {
                  return (
                    <button
                      onClick={() => { onClose(); startTour(steps); }}
                      className="mt-2 text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Show me
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="border-t border-gray-200 px-3 py-2 flex gap-2 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 text-sm px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="px-3 py-2 rounded-md bg-purple-600 text-white text-sm font-medium disabled:bg-gray-300 hover:bg-purple-700 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
