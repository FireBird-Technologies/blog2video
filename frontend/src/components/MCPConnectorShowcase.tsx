import { useEffect, useRef, useState, type ReactNode } from "react";

// ─── Hub-and-spoke diagram geometry (SVG viewBox 640 × 420) ─────────────────
const VIEW_W = 640;
const VIEW_H = 420;
const HUB = { x: 320, y: 210 };

// ─── Brand logos (copied verbatim from the MCP connector page) ──────────────
const ClaudeLogo = (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 46 32" fill="currentColor" aria-hidden>
    <path d="M32.73 0h-6.945L38.45 32h6.945L32.73 0ZM12.665 0 0 32h7.082l2.59-6.72h13.25l2.59 6.72h7.082L19.929 0h-7.264Zm-.702 19.337 4.334-11.246 4.334 11.246h-8.668Z" />
  </svg>
);

const OpenAILogo = (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 22.005a4.5 4.5 0 0 1-6.14-1.636zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

const GeminiLogo = (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
  </svg>
);

const N8nLogo = (
  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M21.4737 5.6842c-1.1772 0-2.1663.8051-2.4468 1.8947h-2.8955c-1.235 0-2.289.893-2.492 2.111l-.1038.623a1.263 1.263 0 0 1-1.246 1.0555H11.289c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947s-2.1663.8051-2.4467 1.8947H4.973c-.2805-1.0896-1.2696-1.8947-2.4468-1.8947C1.1311 9.4737 0 10.6047 0 12s1.131 2.5263 2.5263 2.5263c1.1772 0 2.1663-.8051 2.4468-1.8947h1.4223c.2804 1.0896 1.2696 1.8947 2.4467 1.8947 1.1772 0 2.1663-.8051 2.4468-1.8947h1.0008a1.263 1.263 0 0 1 1.2459 1.0555l.1038.623c.203 1.218 1.257 2.111 2.492 2.111h.3692c.2804 1.0895 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263c-1.1772 0-2.1664.805-2.4468 1.8947h-.3692a1.263 1.263 0 0 1-1.246-1.0555l-.1037-.623A2.52 2.52 0 0 0 13.9607 12a2.52 2.52 0 0 0 .821-1.4794l.1038-.623a1.263 1.263 0 0 1 1.2459-1.0555h2.8955c.2805 1.0896 1.2696 1.8947 2.4468 1.8947 1.3952 0 2.5263-1.131 2.5263-2.5263s-1.131-2.5263-2.5263-2.5263m0 1.2632a1.263 1.263 0 0 1 1.2631 1.2631 1.263 1.263 0 0 1-1.2631 1.2632 1.263 1.263 0 0 1-1.2632-1.2632 1.263 1.263 0 0 1 1.2632-1.2631M2.5263 10.7368A1.263 1.263 0 0 1 3.7895 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 1.2632 12a1.263 1.263 0 0 1 1.2631-1.2632m6.3158 0A1.263 1.263 0 0 1 10.1053 12a1.263 1.263 0 0 1-1.2632 1.2632A1.263 1.263 0 0 1 7.579 12a1.263 1.263 0 0 1 1.2632-1.2632m10.1053 3.7895a1.263 1.263 0 0 1 1.2631 1.2632 1.263 1.263 0 0 1-1.2631 1.2631 1.263 1.263 0 0 1-1.2632-1.2631 1.263 1.263 0 0 1 1.2632-1.2632" />
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
    pos: { x: 130, y: 90 },
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
    pos: { x: 510, y: 90 },
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
    pos: { x: 130, y: 330 },
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
    pos: { x: 510, y: 330 },
    logo: N8nLogo,
    prompt: "When a post publishes, auto-generate a video.",
    result: "Automated",
  },
];

const CYCLE_MS = 2800;

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

export default function MCPConnectorShowcase({ onExplore }: { onExplore?: () => void }) {
  const sectionRef = useRef<HTMLDivElement>(null);
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
      <div className="inline-flex items-center gap-2 mb-3 w-full justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
        <p className="text-[11px] font-medium text-purple-600 tracking-widest uppercase">
          Model Context Protocol
        </p>
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-3">
        Make videos right from your AI assistant
      </h2>
      <p className="text-[13px] text-gray-500 text-center max-w-md mx-auto mb-6 leading-relaxed">
        Connect Blog2Video to Claude, ChatGPT, Gemini or n8n — then just ask, in plain language,
        to pick templates, create projects and render videos.
      </p>

      {/* Diagram card */}
      <div className="glass-card p-4 sm:p-6 rounded-xl max-w-xl mx-auto">
        <div className="relative w-full mx-auto" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxWidth: 360 }}>
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

          {/* Center hub — the actual B2V brand mark */}
          <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: "50%", top: "50%" }}>
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-purple-600 font-bold text-white text-[11px] sm:text-sm shadow-md shadow-purple-500/20">
                B2V
              </div>
              <span className="text-[9px] sm:text-[10px] font-medium text-gray-400">MCP Server</span>
            </div>
          </div>

          {/* Client chips (reuse the MCP page brand logos) */}
          {CLIENTS.map((c, i) => {
            const isActive = i === idx;
            return (
              <div
                key={c.id}
                className="absolute z-10 flex flex-col items-center gap-1.5 -translate-x-1/2 -translate-y-1/2"
                style={{ left: pct(c.pos.x, VIEW_W), top: pct(c.pos.y, VIEW_H) }}
              >
                <div
                  className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl border bg-white ${c.text} shadow-sm transition-all duration-500 ${
                    isActive ? `${c.bg} ${c.border} ring-2 ring-offset-1 ${c.ring}` : "border-gray-200"
                  }`}
                >
                  {c.logo}
                </div>
                <p className="text-[9px] sm:text-[11px] font-semibold text-gray-600">{c.name}</p>
              </div>
            );
          })}
        </div>

        {/* Prompt → result caption (updates with the active client) */}
        <div className="mt-5 flex items-center justify-center" style={{ minHeight: 48 }}>
          <div key={idx} className="mcp-bubble flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-lg">
            <div className="flex items-start gap-2 flex-1 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-lg ${active.bg} ${active.text}`}>
                <span className="scale-[0.65]">{active.logo}</span>
              </span>
              <span className="text-[13px] text-gray-700 leading-snug">"{active.prompt}"</span>
            </div>
            <svg className="shrink-0 rotate-90 sm:rotate-0 text-gray-300 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {active.result}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onExplore}
          className="group inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
        >
          Explore the MCP connector
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
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
