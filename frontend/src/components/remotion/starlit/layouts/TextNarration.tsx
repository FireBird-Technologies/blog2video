import {StarlitPhoto} from "../components/StarlitPhoto";
import {getConstellation, pickConstellationStyle} from "../components/constellations";
import React, {useMemo, useId} from "react";
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {SpaceBackdrop} from "../components/SpaceBackdrop";
import {FitText} from "../components/FitText";
import type {SceneLayoutProps} from "../types";
import {getStarlitFontFamily, getStarlitTypography} from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

const clamp = {extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const};

const splitIntoPhrases = (text: string) => {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  if (sentences.length > 1) return sentences.length <= 5 ? sentences : [...sentences.slice(0, 4), sentences.slice(4).join(" ")];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 18) return [text];
  const chunkSize = Math.ceil(words.length / Math.min(4, Math.ceil(words.length / 14)));
  return Array.from({length: Math.ceil(words.length / chunkSize)}, (_, index) => words.slice(index * chunkSize, (index + 1) * chunkSize).join(" "));
};

/** Pure deep-space editorial scene: typography plus continuous multi-depth stellar motion. */
export const TextNarration: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const constellationId = `constellation-${useId().replace(/:/g, "")}`;
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const duration = props.sceneDurationInFrames ?? 150;
  const heading = props.heading || props.title || "";
  const narration = (props.narration || "").trim();
  const authoredBody = (props.body || "").trim();
  const body = authoredBody && (!narration || authoredBody.length >= narration.length * .62 || (authoredBody.length >= 150 && authoredBody.length >= narration.length * .45)) ? authoredBody : narration || authoredBody;
  const phrases = splitIntoPhrases(body);
  const accent = props.accentColor || "#217cff";
  const text = props.textColor || "#ffffff";
  const font = getStarlitFontFamily(props);
  const type = getStarlitTypography({...props, titleFontSize: props.titleFontSize ?? (portrait ? 92 : 82), descriptionFontSize: props.descriptionFontSize ?? (portrait ? 51 : 40)}, portrait);
  const enter = spring({frame, fps, config: {damping: 24, stiffness: 96}});
  const exit = interpolate(frame, [duration - 18, duration], [1, 0], clamp);
  const titleIn = interpolate(frame, [13, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const bodyIn = interpolate(frame, [26, 48], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const foreground = useMemo(() => Array.from({length: portrait ? 18 : 24}, (_, index) => {
    const seed = (props.seed ?? 42) + index * 23.71;
    const random = (salt: number) => {
      const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };
    return {x: random(1) * width, y: random(2) * height, r: 1.1 + random(3) * 2.1, speed: 18 + random(4) * 28, phase: random(5) * Math.PI * 2, blue: index % 5 === 0};
  }), [props.seed, width, height, portrait]);
  // Every video gets a different constellation map: the style and its jitter come from the seed.
  const constellation = useMemo(() => getConstellation(props.constellationStyle ?? pickConstellationStyle(props.seed ?? 42), props.seed ?? 42), [props.seed, props.constellationStyle]);
  const seconds = frame / fps;
  const constellationIn = interpolate(frame, [16, 74], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const meteorCycle = (frame % 210) / 210;
  const meteorLive = interpolate(meteorCycle, [.08, .14, .31, .38], [0, 1, 1, 0], clamp);
  const meteorX = interpolate(meteorCycle, [.08, .38], [-width * .12, width * 1.12], clamp);
  const meteorY = height * .19 + meteorX * .16;
  const hasPhoto = Boolean(props.imageUrl || props.videoUrl);
  // With a photo, landscape drops the split columns for one left-aligned column so the photo can straddle the card edge.
  const alignment = hasPhoto && !portrait ? "left" : (props.textAlignment || "split");
  const splitLayout = alignment === "split" && !portrait;
  // Straddling disc: landscape - a large round photo half over the right edge of the card; portrait - half over the top edge.
  const discD = portrait ? 460 : 560;
  const portholeIn = interpolate(frame, [22, 52], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const orbitAngle = (frame / fps) * 38;
  const disc = hasPhoto ? <div style={{position: "absolute", width: discD, height: discD, ...(portrait ? {left: "50%", marginLeft: -discD / 2, top: -discD / 2} : {right: -discD / 2, top: "50%", marginTop: -discD / 2}), opacity: portholeIn, transform: `scale(${.88 + portholeIn * .12})`}}>
    <div style={{position: "absolute", inset: -22, borderRadius: "50%", border: `1px solid ${withOpacity(accent, .33)}`}} />
    <div style={{position: "absolute", inset: -22, borderRadius: "50%", transform: `rotate(${orbitAngle}deg)`}}><div style={{position: "absolute", left: "50%", top: -4, width: 8, height: 8, marginLeft: -4, borderRadius: "50%", background: thTxt, boxShadow: `0 0 14px 2px ${accent}`}} /></div>
    <div style={{position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${accent}`, boxShadow: `0 0 44px ${withOpacity(accent, .4)}, 0 18px 56px ${withOpacity(thBg,.55)}`, background: thBg}}><StarlitPhoto scene={props} /></div>
  </div> : null;
  const textAlign = alignment === "center" ? "center" : alignment === "right" ? "right" : "left";
  const itemAlign = alignment === "center" ? "center" : alignment === "right" ? "flex-end" : "flex-start";

  return (
    <AbsoluteFill style={{background: props.bgColor || "#000", overflow: "hidden", fontFamily: font}}>
      <SpaceBackdrop seed={props.seed} density={portrait ? 230 : 270} dustDensity={portrait ? 180 : 240} brightness={.9}  accentColor={props.accentColor}  backgroundColor={props.bgColor}  textColor={props.textColor} />
      <svg width={width} height={height} style={{position: "absolute", inset: 0, pointerEvents: "none"}}>
        <defs>
          <radialGradient id={`${constellationId}-halo`}>
            <stop offset="0%" stopColor={text} stopOpacity=".95" />
            <stop offset="12%" stopColor={text} stopOpacity=".65" />
            <stop offset="32%" stopColor={accent} stopOpacity=".45" />
            <stop offset="65%" stopColor={accent} stopOpacity=".12" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${constellationId}-nebula`}>
            <stop offset="0%" stopColor={mixTheme(thAcc, thTxt, .3)} stopOpacity=".46" />
            <stop offset="34%" stopColor={accent} stopOpacity=".22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <filter id={`${constellationId}-nebula-blur`} x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation={Math.max(30, Math.min(width, height) * .055)} />
          </filter>
        </defs>
        <g opacity={constellationIn} filter={`url(#${constellationId}-nebula-blur)`}>
          <ellipse cx={width * .48} cy={height * .21} rx={width * (portrait ? .42 : .25)} ry={height * .20} fill={`url(#${constellationId}-nebula)`} opacity=".38" />
          <ellipse cx={width * .54} cy={height * .52} rx={width * (portrait ? .48 : .29)} ry={height * .25} fill={`url(#${constellationId}-nebula)`} opacity=".48" />
          <ellipse cx={width * .43} cy={height * .80} rx={width * (portrait ? .40 : .23)} ry={height * .19} fill={`url(#${constellationId}-nebula)`} opacity=".34" />
        </g>
        {/* The full lattice drifts as one stable field; it never rotates. */}
        <g transform={`translate(${Math.sin(seconds * .12) * width * .008} ${Math.sin(seconds * .16) * height * .006})`}>
          {constellation.edges.map(([from, to], index) => {
            const a = constellation.nodes[from];
            const b = constellation.nodes[to];
            const delay = index / constellation.edges.length * .34;
            const edgeIn = interpolate(constellationIn, [delay, Math.min(1, delay + .46)], [0, 1], clamp);
            return <line key={`edge-${index}`} x1={a[0] * width} y1={a[1] * height} x2={b[0] * width} y2={b[1] * height}
              stroke={index % 5 === 0 ? accent : text}
              strokeWidth={Math.max(.65, Math.min(width, height) * .00082)}
              pathLength="1"
              strokeDasharray={`${edgeIn} 1`}
              opacity={(.18 + Math.sin(seconds * .32 + index * .17) * .035) * edgeIn} />;
          })}
          {constellation.nodes.map(([x, y], index) => {
            const delay = index / constellation.nodes.length * .40;
            const nodeIn = interpolate(constellationIn, [delay, Math.min(1, delay + .26)], [0, 1], clamp);
            const pulse = .82 + Math.sin(seconds * (.7 + index % 3 * .13) + index * 2.4) * .16;
            const unit = Math.min(width, height) / 1080;
            const weight = constellation.weights[index];
            const radius = (1.25 + weight * .78) * unit;
            // Each star glints on its own slow beat: a sharp rise to a bright cross-flare, then it settles.
            const beat = seconds * (.34 + (index % 5) * .05) + index * 1.91;
            const glint = Math.pow(Math.max(0, Math.sin(beat)), 4);
            return <g key={`anchor-${index}`} transform={`translate(${x * width} ${y * height}) scale(${.55 + nodeIn * .45})`} opacity={nodeIn}>
              <circle r={radius * (10 + weight * 2.4) * (1 + glint * .22)} fill={`url(#${constellationId}-halo)`} opacity={Math.min(1, pulse * (.54 + weight * .065) + glint * .2)} />
              <circle r={radius * (3 + weight * .65) * (1 + glint * .3)} fill={`url(#${constellationId}-halo)`} opacity={Math.min(1, pulse + glint * .18)} />
              <circle r={radius * 1.3} fill={accent} opacity={pulse * .6} />
              <circle r={radius * (.85 + glint * .25)} fill={text} opacity={Math.min(1, pulse + glint * .2)} />
            </g>;
          })}
        </g>
        {foreground.map((star, index) => {
          const x = ((star.x + seconds * star.speed) % (width + 40)) - 20;
          const y = ((star.y + seconds * star.speed * .18 + Math.sin(seconds * .5 + star.phase) * 3) % (height + 40)) - 20;
          const pulse = .55 + Math.sin(seconds * (1.2 + index % 4 * .16) + star.phase) * .35;
          const size = star.r * (1 + pulse * .18);
          return <g key={index} transform={`translate(${x} ${y})`} opacity={.4 + pulse * .45}><circle r={size} fill={star.blue ? accent : text} />{index % 11 === 0 ? <><line x1={-size * 4} x2={size * 4} stroke={text} strokeWidth=".7" /><line y1={-size * 4} y2={size * 4} stroke={text} strokeWidth=".7" /></> : null}</g>;
        })}
        <line x1={meteorX - width * .10} y1={meteorY - height * .016} x2={meteorX} y2={meteorY} stroke={text} strokeWidth="1.2" strokeLinecap="round" opacity={meteorLive * .76} />
        <line x1={meteorX - width * .15} y1={meteorY - height * .024} x2={meteorX - width * .025} y2={meteorY - height * .004} stroke={accent} strokeWidth=".8" strokeLinecap="round" opacity={meteorLive * .5} />
      </svg>

      <div style={{position: "absolute", inset: 0, background: `radial-gradient(ellipse 65% 36% at 50% 50%, color-mix(in srgb, ${props.bgColor || "#000000"} 48%, transparent), transparent 100%)`, pointerEvents: "none"}} />

      <div style={{position: "absolute", left: hasPhoto && !portrait ? "6%" : "50%", top: "50%", width: portrait ? "86%" : hasPhoto ? "66%" : splitLayout ? "86%" : "76%", maxWidth: splitLayout ? 1600 : 1320, padding: splitLayout ? "52px 58px" : portrait ? (hasPhoto ? `${50 + discD / 2}px 44px 50px` : "50px 44px") : hasPhoto ? `48px ${discD / 2 + 48}px 48px 56px` : "48px 54px", boxSizing: "border-box", opacity: enter * exit, transform: hasPhoto && !portrait ? "translate(0, -50%)" : "translate(-50%, -50%)", display: splitLayout ? "grid" : "flex", flexDirection: splitLayout ? undefined : "column", gridTemplateColumns: splitLayout ? ".76fr 1px 1.24fr" : undefined, columnGap: splitLayout ? (hasPhoto ? 150 : 52) : undefined, alignItems: splitLayout ? "center" : itemAlign, textAlign, overflow: hasPhoto ? "visible" : "hidden", borderRadius: portrait ? 26 : 30, border: `1px solid ${withOpacity(thPale,.20)}`, background: `linear-gradient(135deg, ${withOpacity(thBg,.84)} 0%, ${withOpacity(thBg,.72)} 54%, ${withOpacity(thBg,.80)} 100%)`, boxShadow: `0 28px 90px ${withOpacity(thBg,.48)}, inset 0 1px 0 ${withOpacity(thTxt,.06)}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)"}}>
        {disc}
        <div style={{position: "absolute", inset: 0, borderRadius: "inherit", background: `radial-gradient(circle at 12% 22%, ${withOpacity(accent, .14)} 0%, transparent 34%), linear-gradient(115deg, transparent 56%, ${withOpacity(thTxt,.025)} 100%)`, pointerEvents: "none"}} />
        <div style={{position: "relative", width: splitLayout ? undefined : "100%", maxWidth: splitLayout ? 650 : alignment === "center" ? 1100 : 940, opacity: titleIn, transform: `translateY(${(1 - titleIn) * 16}px)`}}>
          <FitText targetPx={type.titleIsUserSet ? type.title : portrait ? type.title * .9 : type.title} minPx={portrait ? 34 : 31} maxHeightPx={height * (splitLayout ? .38 : .19)} fitKey={`narration-title:${heading}:${portrait}:${splitLayout}`} exact={type.titleIsUserSet} style={{color: text, fontWeight: 700, letterSpacing: "-.05em", lineHeight: .98, textShadow: `0 3px 28px ${withOpacity(thBg,.86)}, 0 0 34px ${withOpacity(thAcc,.12)}`}}>{heading}</FitText>
          <div style={{width: portrait ? 72 : 82, height: 4, marginTop: portrait ? 26 : 24, marginLeft: textAlign === "right" ? "auto" : textAlign === "center" ? "auto" : 2, marginRight: textAlign === "center" ? "auto" : undefined, borderRadius: 999, background: `linear-gradient(90deg, ${accent}, ${thMid})`, boxShadow: `0 0 20px ${withOpacity(accent, .53)}`}} />
        </div>
        <div style={{height: splitLayout ? Math.max(210, height * .30) : 2, width: splitLayout ? 1 : portrait ? "34%" : "18%", margin: splitLayout ? 0 : portrait ? "38px 0 34px" : "32px 0 28px", background: splitLayout ? `linear-gradient(180deg, transparent, ${accent} 20%, ${accent} 80%, transparent)` : `linear-gradient(90deg, ${accent}, ${thMid})`, boxShadow: `0 0 18px ${withOpacity(accent, .33)}`, opacity: Math.min(titleIn, bodyIn), position: "relative"}}><div style={{position: "absolute", width: 9, height: 9, borderRadius: "50%", background: thTxt, boxShadow: `0 0 0 5px ${withOpacity(accent, .27)}, 0 0 18px ${accent}`, left: splitLayout ? -4 : alignment === "right" ? -4.5 : alignment === "center" ? "50%" : "100%", top: splitLayout ? "48%" : -3.5, transform: !splitLayout && alignment === "center" ? "translateX(-50%)" : undefined}} /></div>
        <div style={{position: "relative", width: splitLayout ? undefined : "100%", maxWidth: splitLayout ? 840 : alignment === "center" ? 1160 : 1000, opacity: bodyIn, transform: `translateY(${(1 - bodyIn) * 12}px)`}}>
          <FitText targetPx={type.body} minPx={portrait ? 23 : 20} maxHeightPx={height * (splitLayout ? .48 : hasPhoto ? .24 : .34)} fitKey={`narration-body:${body}:${portrait}:${splitLayout}:${hasPhoto}`} exact={type.bodyIsUserSet} style={{color: withOpacity(thTxt,.91), fontWeight: 500, lineHeight: 1.42, letterSpacing: "-.018em", textShadow: `0 2px 18px ${withOpacity(thBg,.72)}`}}>
            {phrases.map((phrase, index) => {
              const phraseIn = interpolate(frame, [31 + index * 9, 47 + index * 9], [.25, 1], clamp);
              return <React.Fragment key={`${phrase}-${index}`}><span style={{opacity: phraseIn}}>{phrase}</span>{index < phrases.length - 1 ? " " : null}</React.Fragment>;
            })}
          </FitText>
        </div>
      </div>
    </AbsoluteFill>
  );
};
