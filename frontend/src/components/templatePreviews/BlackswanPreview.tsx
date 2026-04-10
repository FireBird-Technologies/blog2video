import { useEffect, useRef, useState } from "react";

const INTERNAL_W = 480;
const INTERNAL_H = 270;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / INTERNAL_W);
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

export default function BlackswanPreview() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => (v + 1) % 1000), 70);
    return () => clearInterval(id);
  }, []);

  return (
    <ScaledCanvas>
      <div style={{ width: "100%", height: "100%", position: "relative", background: "#000000", overflow: "hidden" }}>
        <svg viewBox="0 0 480 270" style={{ position: "absolute", inset: 0 }}>
          {[0, 1, 2, 3].map((i) => (
            <ellipse
              key={i}
              cx={240}
              cy={205 - i * 3}
              rx={70 + i * 36 + (tick % 60) * 0.9}
              ry={16 + i * 5 + (tick % 60) * 0.24}
              fill="none"
              stroke="#00E5FF"
              strokeDasharray="12 8"
              strokeOpacity={0.28 - i * 0.04}
              strokeWidth={1.2}
            />
          ))}
          <path
            d="M240 62 C269 77, 284 106, 263 126 C280 118, 290 134, 272 146 C250 160, 209 148, 202 118 C196 93, 216 72, 240 62 Z"
            fill="none"
            stroke="#00E5FF"
            strokeWidth={2}
            strokeOpacity={0.85}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={`droplet-${i}`}
              cx={60 + i * 84}
              cy={44 + ((tick + i * 30) % 2)}
              r={1.4}
              fill="#00AAFF"
              opacity={0.5}
            />
          ))}
        </svg>

        <div style={{ position: "absolute", inset: 0, padding: "30px 34px", color: "#DFFFFF", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", letterSpacing: 3, color: "#00AAFF", fontSize: 11 }}>
            BLACKSWAN • NEON WATER
          </div>
          <div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, color: "#00E5FF", fontSize: 48, lineHeight: 1 }}>
              BLACKSWAN
            </div>
            <div style={{ marginTop: 8, fontSize: 14, maxWidth: 320 }}>
              Cinematic neon-on-black explainer scenes with ripple energy.
            </div>
          </div>
        </div>
      </div>
    </ScaledCanvas>
  );
}
