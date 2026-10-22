import React from "react";
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig, Easing} from "remotion";
import {SpaceBackdrop} from "../components/SpaceBackdrop";
import {NEBULA_CORE_CONTENT_DELAY, NebulaCoreTransition} from "../components/SceneTransition";

const NEBULA_CORE_ZOOM_START = 26;
const NEBULA_CORE_CONTENT_END = 100;
import {StarlitImageBackdrop} from "../components/StarlitImageBackdrop";
import {FitText} from "../components/FitText";
import type {SceneLayoutProps} from "../types";
import {getStarlitFontFamily, getStarlitTypography} from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

/** Edge-to-edge photography, softly blended into a readable editorial column. */
const SplitImageScene: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const type = getStarlitTypography({...props, titleFontSize: props.titleFontSize ?? (portrait ? 92 : 76), descriptionFontSize: props.descriptionFontSize ?? (portrait ? 52 : 40)}, portrait);
  const accent = props.accentColor || "#217cff";
  const text = props.textColor || "#ffffff";
  const bg = props.bgColor || "#000000";
  const duration = props.sceneDurationInFrames ?? 150;
  const clamp = {extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const};
  const enter = interpolate(frame, [12, 38], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const bodyIn = interpolate(frame, [25, 48], [0, 1], clamp);
  const exit = interpolate(frame, [Math.max(0, duration - 18), duration], [1, 0], clamp);
  return <AbsoluteFill style={{background: bg, overflow: "hidden", fontFamily: getStarlitFontFamily(props)}}>
    <SpaceBackdrop seed={props.seed} density={160} accentColor={accent} backgroundColor={bg} textColor={text} />
    {/* The entrance nebula stays behind the scene at a lower opacity. */}
    <NebulaCoreTransition persist floor={.32} accentColor={accent} bgColor={bg} textColor={text} />
    <StarlitImageBackdrop scene={props} feature />
    <div style={{position: "absolute", left: "8%", top: "50%", width: portrait ? "84%" : props.imageUrl || props.videoUrl ? "42%" : "72%", textAlign: portrait ? "center" : undefined, transform: "translateY(-50%)", opacity: exit}}>
      <div style={{width: 68 * enter, height: 2, background: accent, marginBottom: 28, marginLeft: portrait ? "auto" : undefined, marginRight: portrait ? "auto" : undefined}} />
      <FitText targetPx={type.title} minPx={portrait ? 38 : 34} maxHeightPx={height * .24} fitKey={`split-title:${props.heading || props.title}:${portrait}`} exact={type.titleIsUserSet} style={{color: text, fontWeight: 700, lineHeight: 1.01, letterSpacing: "-.04em", opacity: enter, transform: `translateY(${(1 - enter) * 18}px)`}}>{props.heading || props.title}</FitText>
      <FitText targetPx={type.body} minPx={portrait ? 25 : 22} maxHeightPx={height * .34} fitKey={`split-body:${props.body || props.narration}:${portrait}`} exact={type.bodyIsUserSet} style={{color: text, lineHeight: 1.45, marginTop: 28, opacity: bodyIn * .76}}>{props.body || props.narration}</FitText>
      {props.ctaLabel ? <div style={{marginTop: 28, opacity: bodyIn, display: portrait ? "flex" : undefined, justifyContent: portrait ? "center" : undefined}}><span style={{display: "inline-flex", alignItems: "center", gap: 20, padding: "14px 0", borderBottom: `1px solid ${accent}`, color: text, fontSize: type.bodyRelative(19), fontWeight: 600}}>{props.ctaLabel}<span style={{color: accent}}>↗</span></span></div> : null}
    </div>
  </AbsoluteFill>;
};

/** The scene starts once the nebula entrance has begun to dissolve. */
export const SplitImage: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const delay = NEBULA_CORE_CONTENT_DELAY;
  const duration = props.sceneDurationInFrames ?? 150;
  const frame = useCurrentFrame();
  // The scene settles in from slightly zoomed, continuing the camera's push through the nebula.
  const arrive = interpolate(frame, [NEBULA_CORE_ZOOM_START + 8, NEBULA_CORE_CONTENT_END - 6], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin)});
  const settle = interpolate(frame, [NEBULA_CORE_ZOOM_START, NEBULA_CORE_CONTENT_END], [1.14, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  return (
    <AbsoluteFill style={{background: props.bgColor || "#000"}}>
      <AbsoluteFill style={{transform: `scale(${settle})`, transformOrigin: "50% 50%", opacity: arrive}}>
        <Sequence from={delay} layout="none">
          <SplitImageScene {...props} sceneDurationInFrames={Math.max(60, duration - delay)} />
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
