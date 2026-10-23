import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {NotestackHorizon, SpaceBackdrop} from "../components/SpaceBackdrop";
import {FitText} from "../components/FitText";
import type {SceneLayoutProps} from "../types";
import {getStarlitFontFamily, getStarlitTypography} from "../typography";
import { mixTheme, withOpacity } from "../components/themeColor";

/**
 * Starlit's original, restrained hero treatment: a black planet, a thin blue
 * atmospheric rim, and a single white travelling light. The copy stays in the
 * true centre of the canvas instead of following the planet or its flare.
 */
export const CosmicHero: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = props.aspectRatio === "portrait" || height > width;
  const p = portrait;
  const typography = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 137 : 132),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 67 : 56),
  }, p);
  const fontFamily = getStarlitFontFamily(props);
  const duration = props.sceneDurationInFrames ?? 150;
  const accent = props.accentColor || "#217cff";
  const textColor = props.textColor || "#ffffff";
  const background = props.bgColor || "#000000";
  // Without an explicit subtitle fall back to only the narration's first
  // sentence, capped, so the hero stays short instead of printing a paragraph.
  const subtitle = props.subtitle ?? (props.narration ? props.narration.split(/(?<=[.!?])\s/)[0].slice(0, 90) : props.narration);

  const backdropIn = interpolate(frame, [0, 1], [1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleIn = interpolate(frame, [48, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleIn = interpolate(frame, [68, 112], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const horizonBeaconIn = interpolate(frame, [0, 1], [1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [duration - 24, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSize = typography.titleIsUserSet ? typography.title : typography.titleRelative(portrait ? 102 : 116);
  const bodySize = typography.bodyIsUserSet ? typography.body : typography.bodyRelative(portrait ? 54 : 62);

  return (
    <AbsoluteFill style={{background, overflow: "hidden", color: textColor, fontFamily, opacity: exit}}>
      <AbsoluteFill style={{opacity: backdropIn}}>
        <SpaceBackdrop seed={props.seed ?? 42} density={portrait ? 120 : 150} brightness={0.72}  accentColor={props.accentColor}  backgroundColor={props.bgColor}  textColor={props.textColor} />
        <NotestackHorizon textColor={thTxt} bgColor={thBg} portrait={portrait} accentColor={accent} placement="bottom" beaconOpacity={horizonBeaconIn} portraitDepthW={.3} brightSparkle sparkleCycleSeconds={10} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: portrait ? "10% 8%" : "8% 12%",
          boxSizing: "border-box",
          textAlign: "center",
          pointerEvents: "none",
          // Portrait copy belongs at the true centre of the tall canvas. The
          // landscape composition keeps its slight optical lift so the
          // horizon and travelling light retain a clean lane beneath it.
          transform: `translateY(${portrait ? 0 : -height * .075}px)`,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: portrait ? 920 : 1420,
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 22}px)`,
          }}
        >
          <FitText
            targetPx={titleSize}
            minPx={portrait ? 42 : 38}
            maxHeightPx={height * (portrait ? .27 : .30)}
            fitKey={`hero-title:${props.title}:${portrait}`}
            exact={typography.titleIsUserSet}
            style={{
              fontWeight: 700,
              letterSpacing: "-.045em",
              lineHeight: 1,
              textShadow: `0 3px 28px ${thBg}, 0 0 54px ${withOpacity(thBg,.96)}`,
            }}
          >
            {props.title}
          </FitText>
          {subtitle ? (
            <FitText
              targetPx={bodySize}
              minPx={portrait ? 27 : 24}
              maxHeightPx={height * (portrait ? .20 : .22)}
              fitKey={`hero-subtitle:${subtitle}:${portrait}`}
              exact={typography.bodyIsUserSet}
              style={{
                maxWidth: portrait ? 880 : 1100,
                margin: `${portrait ? 30 : 26}px auto 0`,
                color: thPale,
                fontWeight: 500,
                letterSpacing: "-.025em",
                lineHeight: 1.16,
                opacity: subtitleIn,
                transform: `translateY(${(1 - subtitleIn) * 12}px)`,
                textShadow: `0 3px 24px ${thBg}, 0 0 42px ${withOpacity(thBg,.95)}`,
              }}
            >
              {subtitle}
            </FitText>
          ) : null}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
