import { useState, useEffect, useRef } from "react";

// ── Portrait scale wrapper (9:16)
const INTERNAL_W = 270;
const INTERNAL_H = 480;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const s = el.offsetWidth / INTERNAL_W;
      if (s > 0) setScale(s);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${INTERNAL_W}/${INTERNAL_H}`, overflow: "hidden", position: "relative" }}>
      <div style={{ width: INTERNAL_W, height: INTERNAL_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

const INK = "#101014";
const ACCENT = "#6d28d9";
const SWATCHES = ["#6d28d9", "#2563eb", "#0ea5e9", "#f59e0b"];

export default function YourOwnBrandPreviewPortrait(_: { thumbnailMode?: boolean } = {}) {
  return (
    <ScaledCanvas>
      <div
        style={{
          width: INTERNAL_W,
          height: INTERNAL_H,
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: INK,
        }}
      >
        {/* Editorial frame */}
        <div style={{ position: "absolute", inset: 16, border: `1px solid ${INK}14`, borderRadius: 10 }} />

        {/* Corner registration ticks */}
        {[
          { top: 10, left: 10 },
          { top: 10, right: 10 },
          { bottom: 10, left: 10 },
          { bottom: 10, right: 10 },
        ].map((pos, i) => (
          <Tick key={i} style={pos} />
        ))}

        {/* Section label + rule */}
        <div style={{ position: "absolute", top: 44, left: 30, right: 30, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "#6b7280", fontWeight: 600 }}>
            Custom Template
          </span>
          <span style={{ width: 24, height: 2, background: ACCENT, display: "inline-block" }} />
        </div>

        {/* Monogram */}
        <div style={{ position: "absolute", top: 96, left: 30 }}>
          <Monogram />
        </div>

        {/* Headline */}
        <div style={{ position: "absolute", top: 196, left: 30, right: 30 }}>
          <h2 style={{ margin: 0, fontSize: 40, lineHeight: 1.02, fontWeight: 600, letterSpacing: "-0.025em" }}>
            Your
            <br />
            Own
            <br />
            <span style={{ position: "relative", display: "inline-block" }}>
              Brand
              <svg width="150" height="16" viewBox="0 0 150 16" style={{ position: "absolute", left: -3, bottom: -8 }} fill="none">
                <path d="M3 9 L146 9" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
          </h2>
        </div>

        {/* Brand-kit swatches */}
        <div style={{ position: "absolute", top: 372, left: 30, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex" }}>
            {SWATCHES.map((c, i) => (
              <span
                key={i}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: c,
                  border: "2px solid #fff",
                  marginLeft: i === 0 ? 0 : -8,
                }}
              />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ position: "absolute", bottom: 36, left: 30, right: 30, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: INK }}>
          Request a custom template
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: ACCENT,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h12M12 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </ScaledCanvas>
  );
}

function Tick({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 10, height: 10, ...style }}>
      <span style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: `${INK}26` }} />
      <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: `${INK}26` }} />
    </div>
  );
}

function Monogram() {
  return (
    <div
      style={{
        width: 84,
        height: 84,
        borderRadius: 18,
        background: ACCENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <span style={{ color: "#fff", fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
        A
      </span>
      <span
        style={{
          position: "absolute",
          bottom: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          color: ACCENT,
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      >
        +
      </span>
    </div>
  );
}
