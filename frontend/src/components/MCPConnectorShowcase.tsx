import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

// ─── Hub-and-spoke diagram geometry (SVG viewBox 640 × 420) ─────────────────
const VIEW_W = 640;
const VIEW_H = 420;
const HUB = { x: 320, y: 210 };

// ─── Brand logos (copied verbatim from the MCP connector page) ──────────────
const ClaudeLogo = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 46 32" fill="currentColor" aria-hidden>
    <path d="M32.73 0h-6.945L38.45 32h6.945L32.73 0ZM12.665 0 0 32h7.082l2.59-6.72h13.25l2.59 6.72h7.082L19.929 0h-7.264Zm-.702 19.337 4.334-11.246 4.334 11.246h-8.668Z" />
  </svg>
);

const OpenAILogo = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 22.005a4.5 4.5 0 0 1-6.14-1.636zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

const GeminiLogo = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2c.34 3.36 1.86 5.3 3.78 6.6C17.42 9.7 19.3 10.2 22 12c-2.7 1.8-4.58 2.3-6.22 3.4C13.86 16.7 12.34 18.64 12 22c-.34-3.36-1.86-5.3-3.78-6.6C6.58 14.3 4.7 13.8 2 12c2.7-1.8 4.58-2.3 6.22-3.4C10.14 7.3 11.66 5.36 12 2z" />
  </svg>
);

const N8nLogo = (
  <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="18" r="3" />
    <line x1="8.6" y1="10.7" x2="15.4" y2="7.3" />
    <line x1="8.6" y1="13.3" x2="15.4" y2="16.7" />
  </svg>
);

// ─── Clients orbiting the hub ───────────────────────────────────────────────
interface Client {
  id: string;
  name: string;
  sub: string;
  hex: string;
  bg: string;
  border: string;
  text: string;
  ring: string;
  pos: { x: number; y: number };
  logo: ReactNode;
  prompt: string;
  result: string;
}

const CLIENTS: Client[] = [
  {
    id: "claude",
    name: "Claude",
    sub: "Anthropic",
    hex: "#f97316",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-600",
    ring: "ring-orange-400",
    pos: { x: 130, y: 90 },
    logo: ClaudeLogo,
    prompt: "Create a video from my latest blog post.",
    result: "Video rendered",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    sub: "OpenAI",
    hex: "#10b981",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    ring: "ring-emerald-400",
    pos: { x: 510, y: 90 },
    logo: OpenAILogo,
    prompt: "Turn this URL into a video with the Bloomberg template.",
    result: "Video rendered",
  },
  {
    id: "gemini",
    name: "Gemini",
    sub: "Google",
    hex: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    ring: "ring-blue-400",
    pos: { x: 130, y: 330 },
    logo: GeminiLogo,
    prompt: "Is project 783 done? Send me the link.",
    result: "Link ready",
  },
  {
    id: "n8n",
    name: "n8n",
    sub: "Automation",
    hex: "#f43f5e",
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-600",
    ring: "ring-rose-400",
    pos: { x: 510, y: 330 },
    logo: N8nLogo,
    prompt: "When a post publishes, auto-generate a video.",
    result: "Automated",
  },
];

const CYCLE_MS = 2800;

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export default function MCPConnectorShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [idx, setIdx] = useState(0);

  // Respect the user's reduced-motion preference (no traveling pulses / cycling).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Only run the animation once the diagram scrolls into view (matches PlatformShowcaseSection).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Cycle the active client.
  useEffect(() => {
    if (!started || reduced) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % CLIENTS.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [started, reduced]);

  const active = CLIENTS[idx];
  const animate = started && !reduced;

  return (
    <div className="reveal" ref={sectionRef}>
      {/* Header — matches the other landing showcases */}
      <div className="inline-flex items-center gap-2 mb-4 w-full justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
        <p className="text-xs font-medium text-purple-600 tracking-widest uppercase">
          Model Context Protocol
        </p>
      </div>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Make videos right from your AI assistant
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-xl mx-auto mb-8 leading-relaxed">
        Connect Blog2Video to the tools you already use. Just ask <strong className="font-semibold text-gray-700">Claude</strong>,{" "}
        <strong className="font-semibold text-gray-700">ChatGPT</strong> or <strong className="font-semibold text-gray-700">Gemini</strong> in plain
        language to pick templates, create projects and render videos — or wire it into{" "}
        <strong className="font-semibold text-gray-700">n8n</strong> to automate the whole blog-to-video pipeline.
      </p>

      {/* Diagram card */}
      <div className="glass-card p-6 sm:p-10 rounded-xl hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all max-w-3xl mx-auto">
        <div className="relative w-full mx-auto" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxWidth: 560 }}>
          {/* SVG layer: connection lines + traveling pulses */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            fill="none"
            aria-hidden
          >
            {CLIENTS.map((c, i) => {
              const isActive = i === idx;
              const path = `M${c.pos.x},${c.pos.y} L${HUB.x},${HUB.y}`;
              return (
                <g key={c.id}>
                  <line
                    x1={c.pos.x}
                    y1={c.pos.y}
                    x2={HUB.x}
                    y2={HUB.y}
                    stroke={isActive ? c.hex : "#e5e7eb"}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                    opacity={isActive ? 0.9 : 0.7}
                  />
                  {animate && (
                    <circle r={isActive ? 5 : 3.5} fill={c.hex} opacity={isActive ? 1 : 0.5}>
                      <animateMotion
                        dur={isActive ? "1.4s" : "2.4s"}
                        repeatCount="indefinite"
                        path={path}
                        begin={`-${i * 0.5}s`}
                      />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML overlay: hub + client chips (reuse brand logos directly) */}
          {/* Center hub */}
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: "50%", top: "50%" }}
          >
            <div className="relative flex items-center justify-center">
              {animate && (
                <span
                  className="mcp-ping absolute inset-0 rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}
                />
              )}
              <div className="relative flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-lg shadow-purple-500/20">
                <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="2" width="20" height="8" rx="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
                <div className="text-center leading-tight">
                  <p className="text-[11px] sm:text-xs font-semibold">Blog2Video</p>
                  <p className="text-[9px] sm:text-[10px] text-purple-100/90">MCP Server</p>
                </div>
              </div>
            </div>
          </div>

          {/* Client chips */}
          {CLIENTS.map((c, i) => {
            const isActive = i === idx;
            return (
              <div
                key={c.id}
                className="absolute z-10 flex flex-col items-center gap-1.5 -translate-x-1/2 -translate-y-1/2"
                style={{ left: pct(c.pos.x, VIEW_W), top: pct(c.pos.y, VIEW_H) }}
              >
                <div className="relative">
                  {isActive && animate && (
                    <span className={`mcp-ping absolute inset-0 rounded-2xl ${c.bg}`} style={{ background: c.hex, opacity: 0.35 }} />
                  )}
                  <div
                    className={`relative flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border ${c.bg} ${c.border} ${c.text} shadow-sm transition-all duration-500 ${
                      isActive ? `ring-2 ring-offset-2 ${c.ring} scale-105` : ""
                    }`}
                  >
                    {c.logo}
                  </div>
                </div>
                <div className="text-center leading-none">
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-700">{c.name}</p>
                  <p className="hidden sm:block text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prompt → result caption (updates with the active client) */}
        <div className="mt-8 flex items-center justify-center" style={{ minHeight: 64 }}>
          <div key={idx} className="mcp-bubble flex flex-col sm:flex-row items-center gap-3 w-full max-w-xl">
            <div className="flex items-start gap-2.5 flex-1 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <span className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg ${active.bg} ${active.text}`}>
                <span className="scale-[0.7]">{active.logo}</span>
              </span>
              <span className="text-sm text-gray-700 leading-snug">"{active.prompt}"</span>
            </div>
            <svg className="shrink-0 rotate-90 sm:rotate-0 text-gray-300 w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {active.result}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: works-with pills + CTA */}
      <div className="mt-8 flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-gray-400 mr-1">Works with</span>
          {[
            { label: "Claude.ai", color: "bg-orange-50 border-orange-100 text-orange-700" },
            { label: "ChatGPT", color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
            { label: "Gemini CLI", color: "bg-blue-50 border-blue-100 text-blue-700" },
            { label: "n8n", color: "bg-rose-50 border-rose-100 text-rose-700" },
          ].map(({ label, color }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {label}
            </span>
          ))}
        </div>
        <Link
          to="/mcp-connector"
          className="group inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
        >
          Explore the MCP connector
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>

      <style>{`
        @keyframes mcpPing {
          0%   { transform: scale(1);    opacity: 0.55; }
          70%  { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .mcp-ping { animation: mcpPing 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
        @keyframes mcpBubbleIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mcp-bubble { animation: mcpBubbleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
        @media (prefers-reduced-motion: reduce) {
          .mcp-ping { animation: none; }
          .mcp-bubble { animation: none; }
        }
      `}</style>
    </div>
  );
}
