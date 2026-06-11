import { useEffect, useRef, useState, type ReactNode } from "react";

// ─── Hub-and-spoke diagram geometry (SVG viewBox 640 × 420) ─────────────────
const VIEW_W = 760;
const VIEW_H = 360;
const HUB = { x: 380, y: 180 };

// ─── Brand logos ────────────────────────────────────────────────────────────
// Claude / ChatGPT / Gemini use the official asset files (same as the MCP page on
// main); n8n stays an inline nodes icon.
const ClaudeLogo = (
  <img src="/anthropic.svg" alt="Claude" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
);

const OpenAILogo = (
  <img src="/openai.png" alt="ChatGPT" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
);

const GeminiLogo = (
  <img src="/gemini-color.svg" alt="Gemini" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
);

const N8nLogo = (
  <svg className="w-7 h-7 sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
    hex: "#f97316",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-600",
    ring: "ring-orange-300",
    pos: { x: 140, y: 80 },
    logo: ClaudeLogo,
    prompt: "Create a video from my latest blog post.",
    result: "Video rendered",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    hex: "#10b981",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    ring: "ring-emerald-300",
    pos: { x: 620, y: 80 },
    logo: OpenAILogo,
    prompt: "Turn this URL into a video with the Bloomberg template.",
    result: "Video rendered",
  },
  {
    id: "gemini",
    name: "Gemini",
    hex: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    ring: "ring-blue-300",
    pos: { x: 140, y: 280 },
    logo: GeminiLogo,
    prompt: "Is project 783 done? Send me the link.",
    result: "Link ready",
  },
  {
    id: "n8n",
    name: "n8n",
    hex: "#f43f5e",
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-600",
    ring: "ring-rose-300",
    pos: { x: 620, y: 280 },
    logo: N8nLogo,
    prompt: "When a post publishes, auto-generate a video.",
    result: "Automated",
  },
];

const CYCLE_MS = 2800;

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export default function MCPHubDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [idx, setIdx] = useState(0);

  // Respect the user's reduced-motion preference (no traveling pulse / cycling).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Only run the animation once the diagram scrolls into view.
  useEffect(() => {
    const el = ref.current;
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
    <div ref={ref}>
      <div className="glass-card p-5 sm:p-8 rounded-xl max-w-5xl mx-auto">
        <div className="relative w-full mx-auto" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxWidth: 860 }}>
          {/* SVG layer: connection lines + a single pulse on the active line */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            fill="none"
            aria-hidden
          >
            {CLIENTS.map((c, i) => {
              const isActive = i === idx;
              return (
                <line
                  key={c.id}
                  x1={c.pos.x}
                  y1={c.pos.y}
                  x2={HUB.x}
                  y2={HUB.y}
                  stroke={isActive ? c.hex : "#e5e7eb"}
                  strokeWidth={isActive ? 2 : 1.5}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                  opacity={isActive ? 0.85 : 0.6}
                />
              );
            })}
            {animate && (
              <circle r={5} fill={active.hex}>
                <animateMotion
                  key={active.id}
                  dur="1.6s"
                  repeatCount="indefinite"
                  path={`M${active.pos.x},${active.pos.y} L${HUB.x},${HUB.y}`}
                />
              </circle>
            )}
          </svg>

          {/* Center hub — the B2V brand mark */}
          <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "50%" }}>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl bg-purple-600 font-bold text-white text-3xl sm:text-4xl shadow-lg shadow-purple-500/25">
                B2V
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-400">MCP Server</span>
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
                <div
                  className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border bg-white ${c.text} shadow-sm transition-all duration-500 ${
                    isActive ? `${c.bg} ${c.border} ring-2 ring-offset-1 ${c.ring}` : "border-gray-200"
                  }`}
                >
                  {c.logo}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-gray-600">{c.name}</p>
              </div>
            );
          })}
        </div>

        {/* Prompt → result caption (updates with the active client) */}
        <div className="mt-6 flex items-center justify-center" style={{ minHeight: 60 }}>
          <div key={idx} className="mcp-bubble flex flex-col sm:flex-row items-center gap-3 w-full max-w-3xl">
            <div className="flex items-start gap-2.5 flex-1 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
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

      <style>{`
        @keyframes mcpBubbleIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mcp-bubble { animation: mcpBubbleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
        @media (prefers-reduced-motion: reduce) {
          .mcp-bubble { animation: none; }
        }
      `}</style>
    </div>
  );
}
