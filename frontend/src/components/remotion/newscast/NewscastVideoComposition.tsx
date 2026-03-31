import React from "react";
import "../../../fonts/newspaper-defaults";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { NEWSCAST_LAYOUT_REGISTRY } from "./layouts";
import type { NewscastLayoutProps, NewscastLayoutType } from "./layouts/types";
import { LogoOverlay } from "../LogoOverlay";
import { NewsCastBackground } from "./NewsCastBackground";
import { NewsCastChrome } from "./NewsCastChrome";
import { NewscastSceneZTransition } from "./NewscastSceneZTransition";
import { normalizeNewscastDataVizLayoutProps } from "./normalizeDataVizLayoutProps";

const TRANS_IN_SEC = 1.15;

/** Per-sequence body: wires global `rotationFrame` so the globe never resets between scenes. */
const NewscastSequenceInner: React.FC<{
  startFrame: number;
  durationInFrames: number;
  sceneIndex: number;
  sceneCount: number;
  isHero: boolean;
  layoutType: NewscastLayoutType;
  layoutProps: NewscastLayoutProps;
  LayoutComponent: React.ComponentType<NewscastLayoutProps>;
  voiceoverUrl?: string;
}> = ({
  startFrame,
  durationInFrames,
  sceneIndex,
  sceneCount,
  isHero,
  layoutType,
  layoutProps,
  LayoutComponent,
  voiceoverUrl,
}) => {
  const localFrame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portraitScale = 1;
  const portraitTranslateY = height > width ? -((portraitScale - 1) * height * 0.5) : 0;
  const rotationFrame = startFrame + localFrame;

  // Entrance motion window matches the timing used by `NewscastSceneZTransition`.
  const capHalf = Math.max(1, Math.floor(durationInFrames / 2));
  const transInFrames = Math.min(
    Math.round(TRANS_IN_SEC * fps),
    Math.max(10, Math.floor(durationInFrames * 0.38)),
    capHalf,
  );
  const entryT = interpolate(localFrame, [0, transInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const transOutStart = Math.max(0, durationInFrames - transInFrames);
  const exitT = interpolate(localFrame, [transOutStart, Math.max(transOutStart, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const globeHandoffEnabled =
    !isHero &&
    (layoutType === "glass_image" ||
      layoutType === "kinetic_insight" ||
      layoutType === "glass_stack" ||
      layoutType === "glass_code" ||
      layoutType === "glow_metric" ||
      layoutType === "chapter_break");

  // Slower visible entries: long, smooth approach and clear settle before rotation dominates.
  const kineticSlowT = Math.pow(entryT, 1.18);
  const glassImageSlowT = Math.pow(entryT, 1.16);
  const kineticSlowExitT = Math.pow(exitT, 1.18);
  const glassImageSlowExitT = Math.pow(exitT, 1.16);

  const globeTranslateXIn =
    !isHero && (layoutType === "glass_narrative" || layoutType === "ending_socials")
      ? entryT * -220
      : !isHero && layoutType === "kinetic_insight"
        ? kineticSlowT * -188
      : !isHero && layoutType === "glass_image"
        ? Math.sin(entryT * Math.PI) * -42 + glassImageSlowT * -210
      : !isHero && layoutType === "glass_code"
        ? Math.pow(entryT, 1.08) * -150
      : !isHero && layoutType === "glow_metric"
      ? Math.pow(entryT, 1.08) * -170
      : !isHero && layoutType === "chapter_break"
        ? Math.sin(entryT * Math.PI) * -72 + entryT * -360
      : !isHero && layoutType === "split_glass"
        ? entryT * -260
      : !isHero && layoutType === "glass_stack"
        ? entryT * -90
        : 0;
  const globeTranslateXOut =
    !isHero && (layoutType === "glass_narrative" || layoutType === "ending_socials")
      ? exitT * -220
      : !isHero && layoutType === "kinetic_insight"
        ? kineticSlowExitT * -188
      : !isHero && layoutType === "glass_image"
        ? Math.sin(exitT * Math.PI) * -42 + glassImageSlowExitT * -210
      : !isHero && layoutType === "glass_code"
        ? Math.pow(exitT, 1.08) * -150
      : !isHero && layoutType === "glow_metric"
      ? Math.pow(exitT, 1.08) * -170
      : !isHero && layoutType === "chapter_break"
        ? Math.sin(exitT * Math.PI) * -72 + exitT * -360
      : !isHero && layoutType === "split_glass"
        ? exitT * -260
      : !isHero && layoutType === "glass_stack"
        ? exitT * -90
        : 0;
  const globeTranslateYIn =
    !isHero && (layoutType === "glass_narrative" || layoutType === "ending_socials")
      ? entryT * -26
      : !isHero && layoutType === "kinetic_insight"
        ? kineticSlowT * 54 + Math.sin(entryT * Math.PI) * -5
      : !isHero && layoutType === "glass_image"
        ? Math.sin(entryT * Math.PI) * -48 + glassImageSlowT * 108
      : !isHero && layoutType === "glass_code"
        ? Math.sin(entryT * Math.PI) * -12 + Math.pow(entryT, 1.08) * 8
      : !isHero && layoutType === "glow_metric"
      ? Math.sin(entryT * Math.PI) * -18 + Math.pow(entryT, 1.08) * 10
      : !isHero && layoutType === "chapter_break"
        ? Math.sin(entryT * Math.PI) * -44 + entryT * 16
      : !isHero && layoutType === "split_glass"
        ? Math.sin(entryT * Math.PI) * -22 + entryT * 10
      : !isHero && layoutType === "glass_stack"
        ? entryT * 16
        : 0;
  const globeTranslateYOut =
    !isHero && (layoutType === "glass_narrative" || layoutType === "ending_socials")
      ? exitT * -26
      : !isHero && layoutType === "kinetic_insight"
        ? kineticSlowExitT * 54 + Math.sin(exitT * Math.PI) * -5
      : !isHero && layoutType === "glass_image"
        ? Math.sin(exitT * Math.PI) * -48 + glassImageSlowExitT * 108
      : !isHero && layoutType === "glass_code"
        ? Math.sin(exitT * Math.PI) * -12 + Math.pow(exitT, 1.08) * 8
      : !isHero && layoutType === "glow_metric"
      ? Math.sin(exitT * Math.PI) * -18 + Math.pow(exitT, 1.08) * 10
      : !isHero && layoutType === "chapter_break"
        ? Math.sin(exitT * Math.PI) * -44 + exitT * 16
      : !isHero && layoutType === "split_glass"
        ? Math.sin(exitT * Math.PI) * -22 + exitT * 10
      : !isHero && layoutType === "glass_stack"
        ? exitT * 16
        : 0;
  const globeTranslateX = globeHandoffEnabled ? globeTranslateXIn + globeTranslateXOut : 0;
  const globeTranslateY = globeHandoffEnabled ? globeTranslateYIn + globeTranslateYOut : 0;
  const glassStackGlobeT = Math.pow(entryT, 1.5);
  const glassStackGlobeExitT = Math.pow(exitT, 1.5);
  const chapterGlobeT = Math.pow(entryT, 1.9);
  const chapterGlobeExitT = Math.pow(exitT, 1.9);
  const finalGlobeTranslateX =
    globeHandoffEnabled && !isHero && layoutType === "chapter_break"
      ? Math.sin(chapterGlobeT * Math.PI) * -64 +
        chapterGlobeT * -360 +
        Math.sin(chapterGlobeExitT * Math.PI) * -64 +
        chapterGlobeExitT * -360
      : globeHandoffEnabled && !isHero && layoutType === "glass_stack"
        ? Math.sin(glassStackGlobeT * Math.PI) * -74 +
          glassStackGlobeT * -100 +
          Math.sin(glassStackGlobeExitT * Math.PI) * -74 +
          glassStackGlobeExitT * -100
        : globeTranslateX;
  const finalGlobeTranslateY =
    globeHandoffEnabled && !isHero && layoutType === "chapter_break"
      ? Math.sin(chapterGlobeT * Math.PI) * -44 +
        chapterGlobeT * 16 +
        Math.sin(chapterGlobeExitT * Math.PI) * -44 +
        chapterGlobeExitT * 16
      : globeHandoffEnabled && !isHero && layoutType === "glass_stack"
        ? Math.sin(glassStackGlobeT * Math.PI) * -48 +
          glassStackGlobeT * 22 +
          Math.sin(glassStackGlobeExitT * Math.PI) * -48 +
          glassStackGlobeExitT * 22
      : globeTranslateY;
  return (
    <AbsoluteFill>
      <NewscastSceneZTransition
        durationInFrames={durationInFrames}
        sceneIndex={sceneIndex}
        sceneCount={sceneCount}
        layoutType={layoutType}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateY(${portraitTranslateY}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(${portraitScale})`,
              transformOrigin: "50% 50%",
            }}
          >
            <div>
              <NewsCastBackground
                variant="hero"
                globeOpacity={0.44}
                globePosition="right"
                rotationFrame={rotationFrame}
                globeTranslateX={finalGlobeTranslateX}
                globeTranslateY={finalGlobeTranslateY}
                solidBackground
              />
            </div>
            {!isHero ? (
              <NewsCastChrome
                tickerItems={layoutProps.tickerItems}
                lowerThirdTag={layoutProps.lowerThirdTag}
                lowerThirdHeadline={layoutProps.lowerThirdHeadline}
                lowerThirdSub={layoutProps.lowerThirdSub}
                aspectRatio={layoutProps.aspectRatio}
                accentColor={layoutProps.accentColor}
                textColor={layoutProps.textColor}
                descriptionFontSize={layoutProps.descriptionFontSize}
                fontFamily={layoutProps.fontFamily}
              />
            ) : null}
            <LayoutComponent {...layoutProps} />
          </div>
        </div>
      </NewscastSceneZTransition>
      {voiceoverUrl ? <Audio src={voiceoverUrl} /> : null}
    </AbsoluteFill>
  );
};

export interface NewscastSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  /** When present (e.g. hybrid descriptors), typography may live here instead of layoutProps. */
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number };
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface NewscastVideoCompositionProps {
  scenes: NewscastSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
}

export const NewscastVideoComposition: React.FC<NewscastVideoCompositionProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
}) => {
  const FPS = 30;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        const normalizedLayout =
          scene.layout === "kinetix_insight" ? "kinetic_insight" : scene.layout;
        const startFrame = scenes
          .slice(0, index)
          .reduce((acc, s) => acc + Math.max(1, Math.round(s.durationSeconds * FPS)), 0);

        const durationFrames = Math.max(1, Math.round(scene.durationSeconds * FPS));

        const LayoutComponent =
          NEWSCAST_LAYOUT_REGISTRY[normalizedLayout as NewscastLayoutType] ||
          NEWSCAST_LAYOUT_REGISTRY.glass_narrative;

        const rawLp =
          normalizedLayout === "data_visualization"
            ? normalizeNewscastDataVizLayoutProps((scene.layoutProps ?? {}) as Record<string, unknown>)
            : scene.layoutProps ?? {};

        const base = rawLp as Partial<NewscastLayoutProps>;
        const lc = scene.layoutConfig;
        const layoutProps: NewscastLayoutProps = {
          ...base,
          titleFontSize: base.titleFontSize ?? lc?.titleFontSize,
          descriptionFontSize: base.descriptionFontSize ?? lc?.descriptionFontSize,
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#FF3B30",
          bgColor: bgColor || "#FAFAF8",
          textColor: textColor || "#111111",
          aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
          fontFamily,
          globeRotationFrameOffset: startFrame,
        };

        const layoutType = normalizedLayout as NewscastLayoutType;
        const isHero = layoutType === "cinematic_title";

        return (
          <Sequence
            key={`${scene.id}-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <NewscastSequenceInner
              startFrame={startFrame}
              durationInFrames={durationFrames}
              sceneIndex={index}
              sceneCount={scenes.length}
              isHero={isHero}
              layoutType={layoutType}
              layoutProps={layoutProps}
              LayoutComponent={LayoutComponent}
              voiceoverUrl={scene.voiceoverUrl}
            />
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

