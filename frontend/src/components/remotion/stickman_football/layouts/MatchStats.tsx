import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";

export const MatchStats: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";

  const titlePx = titleFontSize ?? (p ? 103 : 70);
  const descPx = descriptionFontSize ?? (p ? 60 : 44);

  const stats: Array<{ label: string; value: string }> = (props as any).stats ?? [];
  const clampedStats = stats.filter((s) => s && (s.label || s.value)).slice(0, 4);
  const n = clampedStats.length || 1;

  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = sceneDurationInFrames ?? 150;
  const msToFrames = (ms: number) => (ms / 1000) * fps;

  // Scene-level enter/exit
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sceneOpacity = enter * exit;

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  // Canvas dimensions
  const W = p ? 1080 : 1920;
  const H = p ? 1920 : 1080;

  const accent = accentColor ?? "#2E7D32";
  const text = textColor ?? "#111111";
  const font = fontFamily ?? "'Patrick Hand', system-ui, sans-serif";

  // ── Full-green pitch fill ──────────────────────────────────────────────────
  const grass = accent;

  // ── Top-down football pitch geometry (white markings) ──────────────────────
  // Portrait: pitch runs VERTICALLY (goals top & bottom, halfway line horizontal).
  // Landscape: pitch runs HORIZONTALLY (goals left & right, halfway line vertical).
  const pxL = W * 0.06;          // pitch boundary
  const pxR = W * 0.94;
  const pyT = H * 0.05;
  const pyB = H * 0.95;
  const pw = pxR - pxL;
  const ph = pyB - pyT;
  const cxc = W / 2;
  const cyc = H / 2;

  const lineColor = "rgba(255,255,255,0.85)";
  const lineW = 4;
  const dashOpacity = 0.85;

  // Goal-end boxes are sized off the pitch dimension running ACROSS the goal line.
  // `acr` = span across the goal mouth, `depth` = how far the boxes reach into play.
  const acr = p ? pw : ph;       // across the goal line
  const penAcr = acr * 0.5;      // penalty-area width (across)
  const penDepth = (p ? H : W) * (p ? 0.11 : 0.13); // into the field
  const goalAreaAcr = acr * 0.26;
  const goalAreaDepth = (p ? H : W) * (p ? 0.05 : 0.06);
  const goalAcr = acr * 0.18;
  const goalDepth = Math.min(W, H) * 0.018;
  const cornerR = Math.min(W, H) * 0.03;
  const centreR = Math.min(W, H) * (p ? 0.12 : 0.14);

  // Draw-on animation: pitch markings fade/sweep in.
  const pitchDraw = interpolate(frame, [0, msToFrames(700)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOut,
  });

  // ── Text reveals ───────────────────────────────────────────────────────────
  const titleStartF = msToFrames(100);
  const titleEndF = titleStartF + msToFrames(420);
  const titleY = interpolate(frame, [titleStartF, titleEndF], [50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });
  const titleOpacity = interpolate(frame, [titleStartF, titleEndF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const underlineScale = interpolate(frame, [msToFrames(260), msToFrames(640)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });
  const narrationOpacity = interpolate(frame, [msToFrames(500), msToFrames(800)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Stat cards (cardboard look, matching the rest of the template) ──────────
  const cardBaseF = msToFrames(650);
  const cardIn = (i: number) => interpolate(frame, [cardBaseF + msToFrames(i * 110), cardBaseF + msToFrames(i * 110) + msToFrames(420)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });

  // Numeric count-up for card values.
  const counterValue = (value: string, i: number): string => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const numeric = parseFloat(cleaned);
    const isNumeric = cleaned !== "" && !isNaN(numeric) && cleaned === value.trim().replace(/[^0-9.]/g, "");
    if (!isNumeric) return value;
    const startF = cardBaseF + msToFrames(i * 110) + msToFrames(180);
    const endF = startF + msToFrames(600);
    const prog = interpolate(frame, [startF, endF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut });
    const decimals = (value.split(".")[1] || "").length;
    const suffix = value.replace(/[0-9.]/g, ""); // keep units like "%", "k"
    return (numeric * prog).toFixed(decimals) + suffix;
  };

  return (
    <AbsoluteFill style={{ background: grass, opacity: sceneOpacity, fontFamily: font, overflow: "hidden" }}>
      {/* Light white overlay to soften the green */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "rgba(255,255,255,0.30)" }} />
      {/* Subtle mowing stripes + vignette for depth */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.16) 100%)" }} />

      {/* Top-down pitch markings (orientation-aware) */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: pitchDraw }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
          {/* Outer boundary + centre circle + spot (shared) */}
          <rect x={pxL} y={pyT} width={pw} height={ph} fill="none" stroke={lineColor} strokeWidth={lineW} />
          <circle cx={cxc} cy={cyc} r={centreR} fill="none" stroke={lineColor} strokeWidth={lineW} />
          <circle cx={cxc} cy={cyc} r={lineW * 1.6} fill={lineColor} />

          {p ? (
            <>
              {/* VERTICAL pitch: halfway line horizontal, goals top & bottom */}
              <line x1={pxL} y1={cyc} x2={pxR} y2={cyc} stroke={lineColor} strokeWidth={lineW} />

              {/* Top goal */}
              <rect x={cxc - penAcr / 2} y={pyT} width={penAcr} height={penDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAreaAcr / 2} y={pyT} width={goalAreaAcr} height={goalAreaDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAcr / 2} y={pyT - goalDepth} width={goalAcr} height={goalDepth} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
              <circle cx={cxc} cy={pyT + penDepth * 0.62} r={lineW * 1.4} fill={lineColor} />
              <path d={`M ${cxc - centreR * 0.5} ${pyT + penDepth} A ${centreR * 0.5} ${centreR * 0.5} 0 0 0 ${cxc + centreR * 0.5} ${pyT + penDepth}`} fill="none" stroke={lineColor} strokeWidth={lineW} />

              {/* Bottom goal */}
              <rect x={cxc - penAcr / 2} y={pyB - penDepth} width={penAcr} height={penDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAreaAcr / 2} y={pyB - goalAreaDepth} width={goalAreaAcr} height={goalAreaDepth} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={cxc - goalAcr / 2} y={pyB} width={goalAcr} height={goalDepth} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
              <circle cx={cxc} cy={pyB - penDepth * 0.62} r={lineW * 1.4} fill={lineColor} />
              <path d={`M ${cxc - centreR * 0.5} ${pyB - penDepth} A ${centreR * 0.5} ${centreR * 0.5} 0 0 1 ${cxc + centreR * 0.5} ${pyB - penDepth}`} fill="none" stroke={lineColor} strokeWidth={lineW} />
            </>
          ) : (
            <>
              {/* HORIZONTAL pitch: halfway line vertical, goals left & right */}
              <line x1={cxc} y1={pyT} x2={cxc} y2={pyB} stroke={lineColor} strokeWidth={lineW} />

              {/* Left goal */}
              <rect x={pxL} y={cyc - penAcr / 2} width={penDepth} height={penAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxL} y={cyc - goalAreaAcr / 2} width={goalAreaDepth} height={goalAreaAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxL - goalDepth} y={cyc - goalAcr / 2} width={goalDepth} height={goalAcr} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
              <circle cx={pxL + penDepth * 0.62} cy={cyc} r={lineW * 1.4} fill={lineColor} />
              <path d={`M ${pxL + penDepth} ${cyc - centreR * 0.5} A ${centreR * 0.5} ${centreR * 0.5} 0 0 1 ${pxL + penDepth} ${cyc + centreR * 0.5}`} fill="none" stroke={lineColor} strokeWidth={lineW} />

              {/* Right goal */}
              <rect x={pxR - penDepth} y={cyc - penAcr / 2} width={penDepth} height={penAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxR - goalAreaDepth} y={cyc - goalAreaAcr / 2} width={goalAreaDepth} height={goalAreaAcr} fill="none" stroke={lineColor} strokeWidth={lineW} />
              <rect x={pxR} y={cyc - goalAcr / 2} width={goalDepth} height={goalAcr} fill="rgba(255,255,255,0.18)" stroke={lineColor} strokeWidth={lineW} />
              <circle cx={pxR - penDepth * 0.62} cy={cyc} r={lineW * 1.4} fill={lineColor} />
              <path d={`M ${pxR - penDepth} ${cyc - centreR * 0.5} A ${centreR * 0.5} ${centreR * 0.5} 0 0 0 ${pxR - penDepth} ${cyc + centreR * 0.5}`} fill="none" stroke={lineColor} strokeWidth={lineW} />
            </>
          )}

          {/* Corner arcs (shared) */}
          <path d={`M ${pxL + cornerR} ${pyT} A ${cornerR} ${cornerR} 0 0 1 ${pxL} ${pyT + cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
          <path d={`M ${pxR - cornerR} ${pyT} A ${cornerR} ${cornerR} 0 0 0 ${pxR} ${pyT + cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
          <path d={`M ${pxL + cornerR} ${pyB} A ${cornerR} ${cornerR} 0 0 0 ${pxL} ${pyB - cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
          <path d={`M ${pxR - cornerR} ${pyB} A ${cornerR} ${cornerR} 0 0 1 ${pxR} ${pyB - cornerR}`} fill="none" stroke={lineColor} strokeWidth={lineW} opacity={dashOpacity} />
        </svg>
      </AbsoluteFill>

      {/* Title — top centre */}
      <div
        style={{
          position: "absolute",
          top: p ? H * 0.09 : H * 0.08,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: titlePx,
            fontWeight: 900,
            color: text,
            fontFamily: font,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1.05,
            textAlign: "center",
            padding: "0 6%",
            textShadow: "3px 3px 0 rgba(255,255,255,0.28)",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </div>
        <div
          style={{
            height: 5,
            width: p ? W * 0.42 : W * 0.3,
            background: "#FFFFFF",
            transformOrigin: "center",
            transform: `scaleX(${underlineScale})`,
            borderRadius: 3,
            marginTop: 14,
            boxShadow: "2px 2px 0 rgba(0,0,0,0.18)",
          }}
        />
      </div>

      {/* Narration — middle centre (inside the centre circle area) */}
      {narration ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              maxWidth: p ? W * 0.84 : W * 0.64,
              textAlign: "center",
              fontSize: descPx,
              fontWeight: 600,
              color: text,
              fontFamily: font,
              lineHeight: 1.4,
              letterSpacing: "0.01em",
              opacity: narrationOpacity,
              textShadow: "2px 2px 0 rgba(255,255,255,0.28)",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {narration}
          </div>
        </div>
      ) : null}

      {/* Stat cards — bottom centre */}
      <div
        style={{
          position: "absolute",
          bottom: p ? H * 0.1 : H * 0.1,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: p ? 24 : 32,
          padding: "0 5%",
          pointerEvents: "none",
        }}
      >
        {clampedStats.map((stat, i) => {
          const inP = cardIn(i);
          return (
            <div
              key={i}
              style={{
                opacity: inP,
                transform: `translateY(${(1 - inP) * 26}px) rotate(${(i % 2 === 0 ? -1 : 1) * 1.5}deg)`,
                background: "#C8A26A",
                border: "4px solid #8A6A3B",
                borderRadius: 12,
                padding: p ? "26px 30px" : "24px 38px",
                minWidth: p ? 180 : 220,
                textAlign: "center",
                boxShadow: "5px 7px 0 rgba(0,0,0,0.22)",
              }}
            >
              <div
                style={{
                  fontFamily: font,
                  fontWeight: 900,
                  color: "#2B1C0B",
                  fontSize: p ? 64 : 72,
                  lineHeight: 1,
                }}
              >
                {counterValue(stat.value, i)}
              </div>
              <div
                style={{
                  fontFamily: font,
                  color: "#4A3416",
                  fontSize: p ? 26 : 28,
                  marginTop: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
