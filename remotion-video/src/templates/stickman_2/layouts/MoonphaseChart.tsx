import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";

export const MoonphaseChart: React.FC<SceneLayoutProps> = (props) => {
  const {
    title,
    narration,
    accentColor,
    bgColor,
    textColor,
    aspectRatio,
    sceneDurationInFrames,
    titleFontSize,
    descriptionFontSize,
    fontFamily,
  } = props;
  const p = aspectRatio === "portrait";

  const titlePx = titleFontSize ?? (p ? 104 : 77);
  const descPx  = descriptionFontSize ?? (p ? 65 : 40);

  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const dur = sceneDurationInFrames ?? 150;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit  = interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const masterOpacity = enter * exit;

  const rawBars = (props as any).bars;
  const bars: { label: string; value?: number }[] = Array.isArray(rawBars)
    ? rawBars.slice(0, 5)
    : [];
  const numPhases = Math.max(bars.length, 3);

  // Phase shape value is evenly distributed 10→100 regardless of label/value
  const phases = Array.from({ length: numPhases }, (_, i) => ({
    label: bars[i]?.label ?? `Phase ${i + 1}`,
    shapeValue: Math.round(10 + (i / (numPhases - 1)) * 90),
  }));

  const accent = accentColor ?? "#FFFFFF";
  const bg     = bgColor     ?? "#000000";
  const stroke = textColor   ?? "#FFFFFF";
  const font   = fontFamily  ?? "'Patrick Hand', system-ui, sans-serif";
  const t = frame / fps;

  // ── Starfield ─────────────────────────────────────────────────────────────
  const bgStars = React.useMemo(() => {
    const arr: { x: number; y: number; r: number; period: number; phase: number; op: number }[] = [];
    for (let i = 0; i < 140; i++) {
      const s = i * 137.508;
      arr.push({
        x: (Math.sin(s) * 0.5 + 0.5) * width,
        y: (Math.cos(s * 1.3) * 0.5 + 0.5) * height,
        r: 1 + (Math.sin(s * 2.1) * 0.5 + 0.5),
        period: 2 + (Math.sin(s * 3.7) * 0.5 + 0.5) * 3,
        phase: (Math.sin(s * 5.3) * 0.5 + 0.5) * Math.PI * 2,
        op: 0.35 + (Math.sin(s * 7.1) * 0.5 + 0.5) * 0.45,
      });
    }
    return arr;
  }, [width, height]);

  // ── Moon phase drawing ─────────────────────────────────────────────────────
  // Pure two-arc SVG path — only the lit area is drawn, no shadow overlays.
  const moonR = p ? 72 : 62;

  function getMoonPath(value: number, cx: number, cy: number, r: number): React.ReactNode {
    const glow = 6 + value * 0.18;
    const glowFilter = `drop-shadow(0 0 ${glow}px ${accent}) drop-shadow(0 0 ${glow * 2}px ${accent}80)`;
    const top    = `${cx} ${cy - r}`;
    const bottom = `${cx} ${cy + r}`;

    if (value >= 95) {
      return (
        <g style={{ filter: glowFilter }}>
          <circle cx={cx} cy={cy} r={r + 5} fill={accent} opacity={0.08} />
          <circle cx={cx} cy={cy} r={r + 2} fill={accent} opacity={0.12} />
          <circle cx={cx} cy={cy} r={r} fill={accent} />
        </g>
      );
    }

    if (value >= 50) {
      // Gibbous — outer large-arc left + inner convex terminator
      const innerRx = r * interpolate(value, [50, 95], [0.01, 0.98]);
      const d = `M ${top} A ${r} ${r} 0 1 0 ${bottom} A ${innerRx} ${r} 0 0 1 ${top} Z`;
      return (
        <g>
          <g style={{ filter: glowFilter }}><path d={d} fill={accent} /></g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1} opacity={0.18} />
        </g>
      );
    }

    if (value >= 45) {
      // Half moon — exact left semicircle
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.22} />
          <g style={{ filter: glowFilter }}>
            <path d={`M ${top} A ${r} ${r} 0 0 1 ${bottom} L ${cx} ${cy + r} L ${cx} ${cy - r} Z`} fill={accent} />
          </g>
        </g>
      );
    }

    if (value >= 5) {
      // Crescent — outer large-arc left + inner concave terminator
      const innerRx = r * interpolate(value, [5, 45], [0.98, 0.01]);
      const d = `M ${top} A ${r} ${r} 0 1 0 ${bottom} A ${innerRx} ${r} 0 1 1 ${top} Z`;
      return (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.18} />
          <g style={{ filter: glowFilter }}><path d={d} fill={accent} /></g>
        </g>
      );
    }

    // New moon
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.22} />
      </g>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  const figScale   = p ? 2.6 : 2.1;
  const figX       = width / 2;
  const figGroundY = p ? height * 0.90 : height * 0.88;

  // Stickman geometry (local units, origin = feet)
  const hipLY      = -50;
  const torsoLen   = 46;
  const neckLen    = 8;
  const headR2     = 15;
  const breathing  = Math.sin(t * 1.4) * 1.0;
  const bob        = Math.sin(t * 0.9) * 1.5;
  const shoulderLY = hipLY - torsoLen + bob;
  const neckTopLY  = shoulderLY - neckLen - breathing;
  const headLY     = neckTopLY - headR2 - 1;

  // Arms — wider spread, originate lower on torso (not at shoulder top)
  const armOriginY = shoulderLY + 6;
  const armLen1    = 22; // upper arm
  const armLen2    = 20; // forearm
  const swingAmp   = 18;

  // Upper arm angle (from vertical), forearm bends at elbow
  const leftUpperAngle  = -115 + Math.sin(t * 1.8) * swingAmp;
  const rightUpperAngle =  115 + Math.sin(t * 1.8 + Math.PI) * swingAmp;
  const elbowCurve = 25; // extra bend in forearm (degrees outward)

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const leftElbowX  = Math.sin(toRad(leftUpperAngle)) * armLen1;
  const leftElbowY  = armOriginY + Math.cos(toRad(leftUpperAngle)) * armLen1;
  const leftForeAngle = leftUpperAngle - elbowCurve;
  const leftHandX   = leftElbowX  + Math.sin(toRad(leftForeAngle)) * armLen2;
  const leftHandY   = leftElbowY  + Math.cos(toRad(leftForeAngle)) * armLen2;

  const rightElbowX  = Math.sin(toRad(rightUpperAngle)) * armLen1;
  const rightElbowY  = armOriginY + Math.cos(toRad(rightUpperAngle)) * armLen1;
  const rightForeAngle = rightUpperAngle + elbowCurve;
  const rightHandX   = rightElbowX  + Math.sin(toRad(rightForeAngle)) * armLen2;
  const rightHandY   = rightElbowY  + Math.cos(toRad(rightForeAngle)) * armLen2;

  const moonAreaY  = p ? height * 0.56 : height * 0.46;
  const moonMargin = p ? width * 0.10 : width * 0.09;
  const getMoonX = (i: number, n: number) =>
    n === 1 ? width / 2 : moonMargin + (i / (n - 1)) * (width - moonMargin * 2);

  // In portrait, lift the moons onto an arc so the whole row reads as a bow:
  // ends sit at moonAreaY, the centre rises by `bowSpan`. Landscape stays flat.
  const bowSpan = height * 0.13;
  const getMoonY = (i: number, n: number) =>
    !p || n <= 1 ? moonAreaY : moonAreaY - Math.sin((i / (n - 1)) * Math.PI) * bowSpan;

  const phaseStagger  = 0.35;
  const phaseEnterDur = 0.4;

  const ulProg = interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: bg, opacity: masterOpacity, fontFamily: font, overflow: "hidden" }}>
      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        <defs>
          <filter id="chalk" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>

        {bgStars.map((s, i) => {
          const tw = s.op * (0.7 + 0.3 * Math.sin(t * (2 * Math.PI / s.period) + s.phase));
          return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i % 5 === 0 ? "#B0E8FF" : "#FFFFFF"} opacity={tw} />;
        })}

        <rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />

        {/* Decorative crescent top-right */}
        <g transform={`translate(${width - (p ? 80 : 100)}, ${p ? 80 : 65})`}
           style={{ filter: "drop-shadow(0 0 12px rgba(255,255,255,0.5))" }}>
          <path d="M 0 -32 A 32 32 0 1 1 0 32 A 21 21 0 1 0 0 -32 Z" fill="#FFFFFF" opacity={0.85} />
        </g>

        {/* Moon phases */}
        {phases.map((ph, i) => {
          const enterStart = i * phaseStagger * fps;
          const enterEnd   = enterStart + phaseEnterDur * fps;
          const prog = interpolate(frame, [enterStart, enterEnd], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          if (prog <= 0) return null;

          const mx = getMoonX(i, phases.length);
          const my = getMoonY(i, phases.length);
          const phaseBob = Math.sin(t * 0.8 + i * 1.1) * (p ? 6 : 5);

          return (
            <g key={i} opacity={prog} transform={`translate(0, ${phaseBob})`}>
              {getMoonPath(ph.shapeValue, mx, my, moonR * prog)}
            </g>
          );
        })}

        {/* Ground line */}
        <line x1={width * 0.08} y1={figGroundY} x2={width * 0.92} y2={figGroundY}
          stroke={stroke} strokeWidth={p ? 4 : 3} strokeLinecap="round" opacity={0.6} filter="url(#chalk)" />

        {/* Stickman with neck + elbowed arms */}
        <g filter="url(#chalk)">
          <g transform={`translate(${figX}, ${figGroundY + bob * figScale})`}>
            <g transform={`scale(${figScale})`} strokeLinecap="round" strokeLinejoin="round">
              {/* Head */}
              <circle cx={0} cy={headLY} r={headR2} stroke={stroke} strokeWidth={4.5} fill="none" />
              {/* Neck */}
              <line x1={0} y1={neckTopLY} x2={0} y2={shoulderLY} stroke={stroke} strokeWidth={3.5} />
              {/* Torso */}
              <line x1={0} y1={shoulderLY} x2={0} y2={hipLY} stroke={stroke} strokeWidth={5} />
              {/* Legs */}
              <line x1={0} y1={hipLY} x2={-14} y2={0} stroke={stroke} strokeWidth={4.5} />
              <line x1={0} y1={hipLY} x2={14}  y2={0} stroke={stroke} strokeWidth={4.5} />
              {/* Left arm with elbow */}
              <line x1={0} y1={armOriginY} x2={leftElbowX} y2={leftElbowY} stroke={stroke} strokeWidth={4.5} />
              <line x1={leftElbowX} y1={leftElbowY} x2={leftHandX} y2={leftHandY} stroke={stroke} strokeWidth={4} />
              {/* Right arm with elbow */}
              <line x1={0} y1={armOriginY} x2={rightElbowX} y2={rightElbowY} stroke={stroke} strokeWidth={4.5} />
              <line x1={rightElbowX} y1={rightElbowY} x2={rightHandX} y2={rightHandY} stroke={stroke} strokeWidth={4} />
            </g>
          </g>
        </g>
      </svg>

      {/* Moon labels (HTML for crisp text) */}
      {phases.map((ph, i) => {
        const enterStart = i * phaseStagger * fps;
        const enterEnd   = enterStart + phaseEnterDur * fps;
        const prog = interpolate(frame, [enterStart, enterEnd], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        if (prog <= 0) return null;

        const phaseBob = Math.sin(t * 0.8 + i * 1.1) * (p ? 6 : 5);
        const mx = getMoonX(i, phases.length);
        const my = getMoonY(i, phases.length);

        return (
          <div key={i} style={{ position: "absolute", pointerEvents: "none", opacity: prog }}>
            {/* Label below moon */}
            <div style={{
              position: "absolute",
              left: mx - 100,
              top: my + moonR + (p ? 14 : 10) + phaseBob,
              width: 200,
              textAlign: "center",
              color: stroke,
              fontSize: Math.round(descPx * 0.5),
              fontFamily: font,
              opacity: 0.85,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>{ph.label}</div>
          </div>
        );
      })}

      {/* Title + narration */}
      <div style={{
        position: "absolute",
        top: p ? 60 : 52,
        left: p ? 60 : 80,
        right: p ? 60 : 80,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [20, 0])}px)`,
        textAlign: p ? "center" : "left",
      }}>
        <div style={{
          fontSize: titlePx, fontWeight: 700, color: accent,
          lineHeight: 1.1, textShadow: `0 0 12px ${accent}B3`, letterSpacing: "0.01em",
        }}>{title}</div>
        <svg style={{ display: "block", marginTop: 6, ...(p ? { marginLeft: "auto", marginRight: "auto" } : {}) }}
          width={Math.min(p ? 500 : 700, width - 160)} height={12}
          viewBox={`0 0 ${Math.min(p ? 500 : 700, width - 160)} 12`}>
          <polyline
            points={`0,6 ${Math.min(p ? 500 : 700, width - 160) * ulProg},6`}
            stroke={accent} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.8} />
        </svg>
        {narration && (
          <div style={{
            fontSize: descPx, color: stroke, marginTop: 12,
            opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            textShadow: "0 0 6px rgba(255,255,255,0.4)",
            lineHeight: 1.4, maxWidth: p ? 820 : 1200,
            ...(p ? { marginLeft: "auto", marginRight: "auto", textAlign: "center" as const } : {}),
          }}>{narration}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};
