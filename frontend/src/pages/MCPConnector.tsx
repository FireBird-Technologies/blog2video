import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Seo from "../components/seo/Seo";
import { useAuth } from "../hooks/useAuth";

const MCP_SERVER_URL = "https://api.blog2video.app/mcp/sse";

export default function MCPConnector() {
  const { token } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guide, setGuide] = useState("");

  useEffect(() => {
    fetch("/n8n.md")
      .then((r) => r.text())
      .then(setGuide)
      .catch(() => {});
  }, []);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <Seo
        title="Connect to AI"
        description="Connect Blog2Video to Claude, ChatGPT or n8n via the Model Context Protocol (MCP) and use Blog2Video tools directly inside your AI assistant or automations."
        path="/mcp-connector"
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* ─── Hero ──────────────────────────────────────────── */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full bg-purple-50 border border-purple-100 text-xs font-medium text-purple-700">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            Model Context Protocol
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 mb-4 tracking-tight">
            Connect Blog2Video to
            <br />
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Claude, ChatGPT &amp; n8n
            </span>
          </h1>
          <p className="text-base text-gray-600 max-w-xl mx-auto">
            Bring Blog2Video into the tools you already use. Chat with{" "}
            <strong className="font-semibold text-gray-800">Claude</strong> or{" "}
            <strong className="font-semibold text-gray-800">ChatGPT</strong> to pick templates,
            create projects, and generate &amp; render videos — or wire it into{" "}
            <strong className="font-semibold text-gray-800">n8n</strong> to automate the entire
            blog-to-video pipeline. One-time setup, sign in once with Google.
          </p>
        </header>

        {/* ─── Server URL card ───────────────────────────────── */}
        <section className="mb-12">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">MCP Server URL</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Paste this into Claude or ChatGPT when prompted for an MCP server address.
                </p>
              </div>
              <button
                onClick={() => copy(MCP_SERVER_URL, "url")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              >
                {copiedKey === "url" ? (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy URL
                  </>
                )}
              </button>
            </div>
            <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono text-gray-800 select-all overflow-x-auto">
              {MCP_SERVER_URL}
            </code>
          </div>
        </section>

        {/* ─── Connector flows: two cards side-by-side ──────── */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Claude card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 16.5L6 13.5l1.5-1.5L11 15.5l5.5-5.5L18 11.5l-7 7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Connect to Claude.ai</h2>
                <p className="text-xs text-gray-500">Anthropic's Claude desktop & web</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">1</span>
                <span>
                  Open{" "}
                  <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
                    claude.ai
                  </a>{" "}
                  → <strong>Settings → Connectors → Add custom connector</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">2</span>
                <span>
                  Paste the server URL above. Leave Client ID and Client Secret
                  empty — Claude registers itself automatically.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">3</span>
                <span>
                  Click <strong>Connect</strong>. Sign in with the same Google
                  account you use on Blog2Video.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">4</span>
                <span>
                  The connector turns green. In any chat, try:{" "}
                  <em className="text-gray-900">"List my Blog2Video projects."</em>
                </span>
              </li>
            </ol>
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2 text-xs font-medium text-orange-700">
                <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch: setting up a Claude connector
              </div>
              <div className="relative w-full overflow-hidden rounded-xl border border-orange-100 bg-black" style={{ aspectRatio: "16 / 9" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/_jjSS0qGFbI?start=1"
                  title="Setting up a Claude connector"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          {/* ChatGPT card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm4.93 7.5l-5.43 5.43a1 1 0 0 1-1.41 0L7.07 12a1 1 0 1 1 1.41-1.41l2.31 2.32 4.73-4.73a1 1 0 0 1 1.41 1.41z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Connect to ChatGPT</h2>
                <p className="text-xs text-gray-500">OpenAI Apps SDK custom connector</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">1</span>
                <span>
                  Open{" "}
                  <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
                    chatgpt.com
                  </a>{" "}
                  → <strong>Settings → Apps → Advanced settings</strong> → toggle{" "}
                  <strong>Developer mode</strong> ON.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">2</span>
                <span>
                  Back on the <strong>Apps</strong> screen, click{" "}
                  <strong>+ Add app</strong> and paste the server URL above.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">3</span>
                <span>
                  OAuth is auto-detected. Click Connect, sign in with Google.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">4</span>
                <span>
                  Start a fresh chat and try:{" "}
                  <em className="text-gray-900">"Make a Blog2Video video from &lt;blog URL&gt;."</em>
                </span>
              </li>
            </ol>
            <div className="mt-5">
              <a
                href="https://openai.com/index/more-ways-to-work-with-your-team/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 mb-2 text-xs font-medium text-emerald-700 hover:underline"
              >
                <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Read: working with apps in ChatGPT
              </a>
              <a
                href="https://openai.com/index/more-ways-to-work-with-your-team/"
                target="_blank"
                rel="noreferrer"
                className="relative block w-full overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white group"
                style={{ aspectRatio: "16 / 9" }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <span className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-emerald-900">OpenAI's official guide</span>
                    <span className="block text-xs text-emerald-600 mt-0.5">More ways to work with your team →</span>
                  </span>
                </div>
              </a>
            </div>
            <p className="mt-4 text-[11px] text-gray-500 border-t border-gray-100 pt-3">
              On Business / Enterprise / Edu plans, your workspace admin may need
              to enable Developer mode org-wide first.
            </p>
          </div>
        </section>

        {/* ─── Connect to n8n ────────────────────────────────── */}
        <section className="mb-12">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="18" r="3" />
                  <line x1="8.6" y1="10.7" x2="15.4" y2="7.3" />
                  <line x1="8.6" y1="13.3" x2="15.4" y2="16.7" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Connect to n8n</h2>
                <p className="text-xs text-gray-500">Automate Blog2Video from an n8n workflow</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              In n8n's <strong>MCP Client Tool</strong> node, set the server URL above with{" "}
              <strong>HTTP Streamable</strong> transport, choose <strong>Bearer Auth</strong>, and paste
              the token below.
            </p>

            {/* JWT block */}
            <div className="mb-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs font-semibold text-gray-900">Your Blog2Video JWT</span>
                <div className="flex items-center gap-3">
                  {token && (
                    <button
                      onClick={() => setShowToken((s) => !s)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {showToken ? "Hide" : "Show"}
                    </button>
                  )}
                  <button
                    onClick={() => copy(token ?? "", "jwt")}
                    disabled={!token}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {copiedKey === "jwt" ? (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy token
                      </>
                    )}
                  </button>
                </div>
              </div>
              <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono text-gray-800 break-all">
                {token ? (showToken ? token : "•".repeat(48)) : "Sign in to view your token"}
              </code>
              <p className="text-[11px] text-gray-500 mt-2">
                This token expires in ~72 hours — if n8n stops working, sign in again and copy a fresh one.
                Treat it like a password: anyone with it can act on your account.
              </p>
            </div>

            {/* Setup guide: inline + download */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setShowGuide((s) => !s)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <svg className={`w-4 h-4 transition-transform ${showGuide ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {showGuide ? "Hide setup guide" : "Show setup guide"}
                </button>
                <a
                  href="/n8n.md"
                  download="blog2video-n8n-guide.md"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download setup guide
                </a>
              </div>
              {showGuide && (
                <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
                  {guide ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-semibold text-gray-900 mt-4 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-sm font-semibold text-gray-700 mt-2 mb-1">{children}</h4>,
                        p: ({ children }) => <p className="text-sm text-gray-700 leading-relaxed my-2">{children}</p>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline break-words">{children}</a>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-outside pl-5 space-y-1 my-2 text-sm">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-outside pl-5 space-y-1 my-2 text-sm">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-700 text-sm">{children}</li>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-purple-200 pl-3 my-2 text-sm text-gray-600 italic">{children}</blockquote>,
                        code: ({ children }) => <code className="bg-gray-200/70 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800 break-words">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-100 border border-gray-200 rounded-lg p-3 text-[12px] leading-relaxed overflow-x-auto my-2">{children}</pre>,
                        hr: () => <hr className="my-4 border-gray-200" />,
                        table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-sm border-collapse">{children}</table></div>,
                        th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-800 bg-gray-100">{children}</th>,
                        td: ({ children }) => <td className="border border-gray-200 px-2 py-1 text-gray-700">{children}</td>,
                      }}
                    >
                      {guide}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-gray-500">Loading guide…</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ─── Try prompts ───────────────────────────────────── */}
        <section className="mb-4">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              What you can do once connected
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Try natural-language prompts like these in Claude or ChatGPT.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "List the templates I can use.",
                "Show me my last 5 projects.",
                "Create a video from https://… using the Bloomberg template.",
                "Is project 783 finished rendering? Give me the video link.",
                "Regenerate scene 2 in project 783 with the prompt: \"highlight Q3 volatility\".",
                "Render project 783 and let me know when it's done.",
              ].map((prompt) => (
                <div
                  key={prompt}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700"
                >
                  <svg className="shrink-0 w-4 h-4 text-purple-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>"{prompt}"</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
