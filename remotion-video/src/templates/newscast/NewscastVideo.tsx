import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
} from "remotion";
import "../../fonts/newspaper-defaults";
import { NEWSCAST_LAYOUT_REGISTRY } from "./layouts";
import { resolveFontFamily } from "../../fonts/registry";
import type { NewscastLayoutProps, NewscastLayoutType } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { NewsCastBackground } from "./NewsCastBackground";
import { NewsCastChrome } from "./NewsCastChrome";
import { NewscastSceneZTransition } from "./NewscastSceneZTransition";
import { normalizeNewscastDataVizLayoutProps } from "./normalizeDataVizLayoutProps";

const TRANS_IN_SEC = 1.15;

const NewscastSequenceInner: React.FC<{
  startFrame: number;
  durationInFrames: number;
  sceneIndex: number;
  sceneCount: number;
  isHero: boolean;
  layoutType: NewscastLayoutType;
  layoutProps: NewscastLayoutProps;
  LayoutComponent: React.ComponentType<NewscastLayoutProps>;
  voiceoverSrc?: string;
}> = ({
  startFrame,
  durationInFrames,
  sceneIndex,
  sceneCount,
  isHero,
  layoutType,
  layoutProps,
  LayoutComponent,
  voiceoverSrc,
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
      {voiceoverSrc ? <Audio src={voiceoverSrc} /> : null}
    </AbsoluteFill>
  );
};

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  layoutConfig?: { titleFontSize?: number; descriptionFontSize?: number };
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}

interface VideoData {
  projectName: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

export const calculateNewscastMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const totalSeconds = data.scenes.reduce((sum, s) => sum + (s.durationSeconds || 5), 0);
      const totalFrames = Math.ceil((totalSeconds + 2) * FPS);
      const isPortrait = data.aspectRatio === "portrait";

      // Newscast base resolution: 1280×720 in landscape, 720×1280 in portrait
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 720 : 1280,
        height: isPortrait ? 1280 : 720,
      };
    } catch {
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1280,
        height: 720,
      };
    }
  };

export const NewscastVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Newscast Preview",
          accentColor: "#E82020",
          bgColor: "#060614",
          textColor: "#B8C8E0",
          aspectRatio: "landscape",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "NEWS BULLETIN",
              narration: "A clear, editorial opening for live broadcast updates.",
              layout: "cinematic_title",
              layoutProps: {
                tickerItems: [
                  "LIVE BREAKING FEED",
                  "TOP DEVELOPMENTS UPDATE",
                  "NEW DETAILS SURFACE",
                  "OFFICIAL CONFIRMATIONS",
                ],
                lowerThirdTag: "LIVE COVERAGE",
                lowerThirdHeadline: "Correspondent Report",
                lowerThirdSub: "Reporting live from the broadcast desk",
              },
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  if (!data) return <AbsoluteFill style={{ backgroundColor: "#FAFAF8" }} />;

  const FPS = 30;
  let currentFrame = 0;
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#FAFAF8",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {data.scenes.map((scene, sceneIndex) => {
        const normalizedLayout =
          scene.layout === "kinetix_insight" ? "kinetic_insight" : scene.layout;
        const durationFrames = Math.max(1, Math.round((Number(scene.durationSeconds) || 5) * FPS));
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          NEWSCAST_LAYOUT_REGISTRY[normalizedLayout as NewscastLayoutType] ||
          NEWSCAST_LAYOUT_REGISTRY.glass_narrative;

        const imageUrlFromAssets = scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;
        const lp = (scene.layoutProps ?? {}) as Record<string, unknown>;
        const normalizedLp =
          normalizedLayout === "data_visualization"
            ? normalizeNewscastDataVizLayoutProps(lp)
            : lp;
        const base = normalizedLp as Partial<NewscastLayoutProps>;
        const lc = scene.layoutConfig;

        const layoutProps: NewscastLayoutProps = {
          ...base,
          titleFontSize: base.titleFontSize ?? lc?.titleFontSize,
          descriptionFontSize: base.descriptionFontSize ?? lc?.descriptionFontSize,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || "#FF3B30",
          bgColor: data.bgColor || "#FAFAF8",
          textColor: data.textColor || "#111111",
          aspectRatio: (data.aspectRatio as "landscape" | "portrait") || "landscape",
          imageUrl: imageUrlFromAssets ?? (typeof lp.imageUrl === "string" ? lp.imageUrl : undefined),
          fontFamily: resolvedFontFamily || undefined,
          globeRotationFrameOffset: startFrame,
        };

        const layoutType = normalizedLayout as NewscastLayoutType;
        const isHero = layoutType === "cinematic_title";

        return (
          <Sequence key={scene.id} from={startFrame} durationInFrames={durationFrames} name={scene.title}>
            <NewscastSequenceInner
              startFrame={startFrame}
              durationInFrames={durationFrames}
              sceneIndex={sceneIndex}
              sceneCount={data.scenes.length}
              isHero={isHero}
              layoutType={layoutType}
              layoutProps={layoutProps}
              LayoutComponent={LayoutComponent}
              voiceoverSrc={scene.voiceoverFile ? staticFile(scene.voiceoverFile) : undefined}
            />
          </Sequence>
        );
      })}

      {data.logo && (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          aspectRatio={data.aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};

