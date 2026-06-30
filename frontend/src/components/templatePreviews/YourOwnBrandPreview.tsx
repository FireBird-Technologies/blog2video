import { useState, useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
   SCALE WRAPPER — renders at 700×394 internally, CSS-scales to fit
   (matches the convention used by the other template previews)
───────────────────────────────────────────────────────────── */
const IW = 700, IH = 394;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / IW);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", aspectRatio: `${IW}/${IH}`, position: "relative", overflow: "hidden", borderRadius: 14 }}>
      <div style={{ width: IW, height: IH, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute" }}>
        {children}
      </div>
    </div>
  );
}

const INK = "#101014";
const ACCENT = "#6d28d9";

const SWATCHES = ["#6d28d9", "#2563eb", "#0ea5e9", "#f59e0b"];

export default function YourOwnBrandPreview(_: { thumbnailMode?: boolean } = {}) {
  return (
    <ScaledCanvas>
      <div
        style={{
          width: IW,
          height: IH,
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: INK,
        }}
      >
        {/* Quiet editorial frame */}
        <div style={{ position: "absolute", inset: 26, border: `1px solid ${INK}14`, borderRadius: 10 }} />

        {/* Corner registration ticks — design-studio cue */}
        {[
          { top: 18, left: 18 },
          { top: 18, right: 18 },
          { bottom: 18, left: 18 },
          { bottom: 18, right: 18 },
        ].map((pos, i) => (
          <Tick key={i} style={pos} />
        ))}

        {/* Section label + rule below it */}
        <div style={{ position: "absolute", top: 64, left: 64, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 12, letterSpacing: "0.32em", textTransform: "uppercase", color: "#6b7280", fontWeight: 600 }}>
            Custom Template
          </span>
          <span style={{ width: 28, height: 2, background: ACCENT, display: "inline-block" }} />
        </div>

        {/* Headline */}
        <div style={{ position: "absolute", top: 118, left: 64, right: 64 }}>
          <h2 style={{ margin: 0, fontSize: 58, lineHeight: 1.02, fontWeight: 600, letterSpacing: "-0.025em" }}>
            Your Own
            <br />
            <span style={{ position: "relative", display: "inline-block" }}>
              Brand
              <svg
                width="220"
                height="20"
                viewBox="0 0 220 20"
                style={{ position: "absolute", left: -4, bottom: -10 }}
                fill="none"
              >
                <path d="M4 11 L214 11" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
              </svg>
            </span>
          </h2>
        </div>

        {/* Brand-kit chip row (bottom-left) */}
        <div style={{ position: "absolute", left: 64, bottom: 64, display: "flex", alignItems: "center", gap: 18 }}>
          <ColorStack />
          <div style={{ width: 1, height: 38, background: `${INK}12` }} />
          <Typeface label="Aa" name="Heading" />
          <Typeface label="Aa" name="Body" light />
        </div>

        {/* Right column: monogram tile + CTA */}
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <Monogram />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 15,
              fontWeight: 600,
              color: INK,
            }}
          >
            Request a custom template
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: ACCENT,
                color: "#fff",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h12M12 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </ScaledCanvas>
  );
}

function Tick({ style }: { style: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", width: 12, height: 12, ...style }}>
      <span style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: `${INK}26` }} />
      <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: `${INK}26` }} />
    </div>
  );
}

function ColorStack() {
  return (
    <div style={{ display: "flex" }}>
      {SWATCHES.map((c, i) => (
        <span
          key={i}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: c,
            border: "2px solid #fff",
            marginLeft: i === 0 ? 0 : -10,
          }}
        />
      ))}
    </div>
  );
}

function Typeface({ label, name, light }: { label: string; name: string; light?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
      <span style={{ fontSize: 24, fontWeight: light ? 500 : 700, letterSpacing: "-0.02em" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, letterSpacing: "0.04em" }}>{name}</span>
    </div>
  );
}

function Monogram() {
  return (
    <div
      style={{
        width: 96,
        height: 96,
        borderRadius: 20,
        background: ACCENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* logo letter */}
      <span style={{ color: "#fff", fontSize: 52, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em" }}>
        A
      </span>
      <span
        style={{
          position: "absolute",
          bottom: -7,
          right: -7,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#fff",
          color: ACCENT,
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </span>
    </div>
  );
}
