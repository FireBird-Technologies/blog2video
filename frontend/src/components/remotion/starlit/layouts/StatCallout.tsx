import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { FitText } from "../components/FitText";
import { useFitText } from "../components/useFitText";
import type { SceneLayoutProps } from "../types";
import { getStarlitFontFamily, getStarlitTypography } from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";


/** Stellar Burst: a metric detonates a full-frame starfall into deep space. */
export const StatCallout: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = props.aspectRatio === "portrait";
  const p = portrait;
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 140 : 117),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 80 : 78),
  }, p);
  const font = getStarlitFontFamily(props);
  const duration = props.sceneDurationInFrames ?? 150;
  const raw = String(props.statValue ?? "").trim(); // only the supplied statistic: never the title, never a placeholder
  const numeric = raw.match(/^([\d.]+)(.*)$/);
  const count = interpolate(frame, [5, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const value = numeric ? `${Math.floor(Number(numeric[1]) * count)}${props.statSuffix || numeric[2]}` : raw;
  const enter = interpolate(frame, [9, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [duration - 18, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const valueIn = interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const descriptionIn = interpolate(frame, [35, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const particles = useMemo(() => Array.from({ length: portrait ? 54 : 68 }, (_, index) => {
    const rand = (offset: number) => {
      const n = Math.sin((props.seed ?? 42) * 97 + index * 131 + offset * 17) * 10000;
      return n - Math.floor(n);
    };
    const angle = rand(1) * Math.PI * 2;
    const edgeX = (width / 2) / Math.max(.04, Math.abs(Math.cos(angle)));
    const edgeY = (height / 2) / Math.max(.04, Math.abs(Math.sin(angle)));
    const edgeDistance = Math.min(edgeX, edgeY);
    const depth = rand(6);
    return {
      angle,
      distance: edgeDistance * (1.08 + rand(2) * .58),
      size: .45 + depth * 1.25,
      phase: rand(4) * 104,
      speed: .52 + depth * 1.42,
      tail: 14 + depth * 62,
      blue: rand(7) > .72,
      width: .45 + depth * .65,
    };
  }), [height, portrait, props.seed, width]);
  const burst = interpolate(frame, [5, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cx = width / 2;
  const cy = portrait ? height * .48 : height * .50;
  const description = props.descriptor || props.narration || "";
  const valueFontSize = type.titleIsUserSet ? type.title : type.titleRelative(portrait ? 190 : 172);
  const descriptionFontSize = type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 40 : 29);
  const valueMeasureRef = React.useRef<HTMLDivElement>(null);
  const finalValue = numeric ? `${numeric[1]}${props.statSuffix || numeric[2]}` : raw;
  const valueFit = useFitText(valueMeasureRef, valueFontSize, type.titleIsUserSet ? valueFontSize : portrait ? 52 : 44, [finalValue, valueFontSize, type.titleIsUserSet, portrait, width, height], height * .25, width * (portrait ? .86 : .78));

  if (!raw) return <AbsoluteFill style={{ background: thBg }} />; // no statistic supplied: render empty

  return (
    <AbsoluteFill style={{ background: thBg, overflow: "hidden", fontFamily: font, opacity: exit }}>
      <SpaceBackdrop seed={props.seed} density={210}  accentColor={props.accentColor}  backgroundColor={props.bgColor}  textColor={props.textColor} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {particles.map((particle, index) => {
          const progress = ((frame * particle.speed + particle.phase) % 104) / 104;
          const accelerated = Math.pow(progress, .72);
          const distance = particle.distance * accelerated;
          const x = cx + Math.cos(particle.angle) * distance;
          const y = cy + Math.sin(particle.angle) * distance;
          const tail = particle.tail * (.72 + accelerated * .28);
          const opacity = interpolate(progress, [0, .06, .72, 1], [0, 1, .82, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const color = particle.blue ? thAcc : thTxt;
          return <g key={index} opacity={opacity * (.32 + burst * .28)}>
            <line x1={x - Math.cos(particle.angle) * tail} y1={y - Math.sin(particle.angle) * tail} x2={x} y2={y} stroke={color} strokeWidth={particle.width} strokeLinecap="round" />
            <circle cx={x} cy={y} r={particle.size} fill={color} />
          </g>;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center, ${withOpacity(thBg,.72)} 0%, ${withOpacity(thBg,.5)} 15%, ${withOpacity(thBg,.18)} 32%, transparent 53%)` }} />
      <div ref={valueMeasureRef} aria-hidden style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontFamily: font, fontWeight: 700, letterSpacing: "-.045em", lineHeight: 1 }}>{finalValue}</div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: portrait ? "0 56px" : "0 160px", transform: `translateY(${(1 - enter) * 20}px)`, opacity: enter }}>
        <div
          style={{
            color: props.textColor || "#ffffff",
            fontFamily: font,
            fontSize: valueFit.px,
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: "-.045em",
            paddingRight: ".045em",
            textShadow: `0 0 12px ${withOpacity(thTxt,.32)}, 0 0 34px ${withOpacity(thAcc,.38)}, 0 0 72px ${withOpacity(thAcc,.2)}, 0 3px 28px ${withOpacity(thBg,.9)}`,
            opacity: valueIn,
            transform: `scale(${.72 + valueIn * .28})`,
          }}
        >
          {value}
        </div>
        {description ? <FitText targetPx={descriptionFontSize} minPx={portrait ? 24 : 21} maxHeightPx={height * .45} maxWidthPx={portrait ? 720 : 920} fitKey={`stat-description:${description}:${portrait}`} exact={type.bodyIsUserSet} style={{ color: withOpacity(thTxt,.86), fontFamily: font, fontWeight: 500, lineHeight: 1.16, letterSpacing: "-.025em", marginTop: portrait ? 34 : 30, textShadow: `0 2px 22px ${thBg}, 0 0 34px ${withOpacity(thAcc,.3)}`, opacity: descriptionIn, transform: `translateY(${(1 - descriptionIn) * 14}px)` }}>{description}</FitText> : null}
      </div>
    </AbsoluteFill>
  );
};
