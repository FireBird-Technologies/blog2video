import { useState, useEffect } from "react";

function useSpring(
  active: boolean,
  options: { stiffness?: number; damping?: number; delay?: number } = {}
) {
  const { stiffness = 200, damping = 18, delay = 0 } = options;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) { setValue(0); return; }
    let start: number | null = null;
    let raf: number;
    let vel = 0;
    let pos = 0;

    function tick(t: number) {
      if (!start) start = t + delay;
      if (t < start) { raf = requestAnimationFrame(tick); return; }
      const force = -stiffness * (pos - 1) - damping * vel;
      vel += force * (1 / 60);
      pos += vel * (1 / 60);
      setValue(pos);
      if (Math.abs(pos - 1) > 0.001 || Math.abs(vel) > 0.001) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(1);
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, delay, stiffness, damping]);

  return value;
}

export default function SpotlightPreview() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 400);
    return () => clearTimeout(t);
  }, []);

  const s = useSpring(active, { stiffness: 210, damping: 16 });
  const subS = useSpring(active, { stiffness: 160, damping: 20, delay: 400 });
  const scale = active ? 0.6 + s * 0.4 + Math.sin(s * Math.PI) * 0.05 : 0.6;

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "16 / 9",
        background: "#000000",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Subtle noise texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
          opacity: 0.4,
        }}
      />
      <div style={{ textAlign: "center", padding: "0 8%", position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: "clamp(18px, 4.5vw, 52px)",
            fontWeight: 900,
            color: "#FFFFFF",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            transform: `scale(${Math.max(scale, 0.3)})`,
            opacity: Math.min(s * 2, 1),
            fontFamily: "'Arial Black', Arial, sans-serif",
            textTransform: "uppercase",
          }}
        >
          THE FUTURE
          <br />
          <span style={{ color: "#EF4444" }}>IS NOW</span>
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: "clamp(7px, 1.1vw, 12px)",
            fontWeight: 300,
            color: "#666666",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            opacity: subS,
            transform: `translateY(${(1 - subS) * 12}px)`,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Bold statements for the modern era
        </div>
      </div>
    </div>
  );
}
