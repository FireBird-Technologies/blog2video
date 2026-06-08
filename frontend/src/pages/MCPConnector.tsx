import { useState } from "react";
// Kept for the inline setup guide (now linked out to the blog — see below):
// import { useEffect } from "react";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
import Seo from "../components/seo/Seo";
import { useAuth } from "../hooks/useAuth";

const MCP_SERVER_URL = "https://api.blog2video.app/mcp/sse";

export default function MCPConnector() {
  const { token } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  // Inline setup-guide state — superseded by the blog link below, kept for reference:
  // const [showGuide, setShowGuide] = useState(false);
  // const [guide, setGuide] = useState("");

  // useEffect(() => {
  //   fetch("/n8n.md")
  //     .then((r) => r.text())
  //     .then(setGuide)
  //     .catch(() => {});
  // }, []);

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

        {/* ─── Server URL + n8n side by side ────────────────── */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* MCP Server URL */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col">
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

            {/* Supported clients */}
            <div className="mt-5 flex-1 flex flex-col justify-end">
              <p className="text-xs font-medium text-gray-500 mb-3">Works with</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Claude.ai", sub: "Anthropic", color: "bg-orange-50 border-orange-100 text-orange-700" },
                  { label: "ChatGPT", sub: "OpenAI", color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
                  { label: "Gemini CLI", sub: "Google", color: "bg-blue-50 border-blue-100 text-blue-700" },
                  { label: "n8n", sub: "Automation", color: "bg-rose-50 border-rose-100 text-rose-700" },
                ].map(({ label, sub, color }) => (
                  <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${color}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold leading-none">{label}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Connect to n8n */}
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

            {/* Setup guide link */}
            <div className="border-t border-gray-100 pt-4">
              <a
                href="https://blog2video.app/blogs/blog2video-mcp-server-n8n"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-white p-4 transition-colors hover:border-purple-300 hover:from-purple-100"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-purple-700">
                    Read the full n8n setup guide
                  </p>
                  <p className="text-xs text-gray-500">
                    Step-by-step walkthrough with ready-to-import workflows.
                  </p>
                </div>
                <svg className="h-5 w-5 shrink-0 text-purple-500 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* ─── Connector flows: three cards side-by-side ──────────
            Break out wider than the page's max-w-5xl (≈1024px) so three
            cards have comfortable width on large screens. The negative
            margins widen the row symmetrically; below lg it stays inside
            the page padding and the grid collapses to 1 column on mobile. */}
        <section className="mb-12 lg:-mx-24 xl:-mx-40 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Claude card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                {/* Anthropic / Claude logo */}
                <svg className="w-5 h-5 text-orange-600" viewBox="0 0 46 32" fill="currentColor">
                  <path d="M32.73 0h-6.945L38.45 32h6.945L32.73 0ZM12.665 0 0 32h7.082l2.59-6.72h13.25l2.59 6.72h7.082L19.929 0h-7.264Zm-.702 19.337 4.334-11.246 4.334 11.246h-8.668Z" />
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
                {/* OpenAI logo */}
                <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 22.005a4.5 4.5 0 0 1-6.14-1.636zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
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

          {/* Gemini card */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2c.34 3.36 1.86 5.3 3.78 6.6C17.42 9.7 19.3 10.2 22 12c-2.7 1.8-4.58 2.3-6.22 3.4C13.86 16.7 12.34 18.64 12 22c-.34-3.36-1.86-5.3-3.78-6.6C6.58 14.3 4.7 13.8 2 12c2.7-1.8 4.58-2.3 6.22-3.4C10.14 7.3 11.66 5.36 12 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Connect to Gemini</h2>
                <p className="text-xs text-gray-500">Google Gemini CLI</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">1</span>
                <span>
                  Install the Gemini CLI:{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800 break-words">npm install -g @google/gemini-cli</code>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">2</span>
                <span>
                  Add a <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">blog2video</code> entry to{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">~/.gemini/settings.json</code> under{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">mcpServers</code>, with{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">httpUrl</code> set to the server URL above.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">3</span>
                <span>
                  Add an <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">Authorization: Bearer &lt;JWT&gt;</code> header
                  (the same token from the n8n section below) and a{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">timeout</code> of{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">600000</code>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center justify-center mt-0.5">4</span>
                <span>
                  Run <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">gemini</code>, type{" "}
                  <code className="bg-gray-100 rounded px-1 py-0.5 text-[12px] font-mono text-gray-800">/mcp</code> to confirm the tools, then try:{" "}
                  <em className="text-gray-900">"Make a Blog2Video video from &lt;blog URL&gt;."</em>
                </span>
              </li>
            </ol>
            <div className="mt-5">
              <a
                href="https://blog2video.app/blogs/blog2video-mcp-server-gemini"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 mb-2 text-xs font-medium text-blue-700 hover:underline"
              >
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Read: connecting Gemini to Blog2Video
              </a>
              <a
                href="https://blog2video.app/blogs/blog2video-mcp-server-gemini"
                target="_blank"
                rel="noreferrer"
                className="relative block w-full overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white group"
                style={{ aspectRatio: "16 / 9" }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <span className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-blue-900">The full Gemini guide</span>
                    <span className="block text-xs text-blue-600 mt-0.5">CLI, Firebase Studio &amp; Enterprise →</span>
                  </span>
                </div>
              </a>
            </div>
            <p className="mt-4 text-[11px] text-gray-500 border-t border-gray-100 pt-3">
              The consumer Gemini app has no custom-connector box — use the Gemini
              CLI (or Firebase Studio / Enterprise) to connect.
            </p>
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
