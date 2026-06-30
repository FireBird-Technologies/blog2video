/**
 * GeneratedVideo — Remotion composition for AI-generated custom templates.
 *
 * Renders AI-generated React components written per-brand. The generated code
 * files are overwritten in the render workspace with actual generated code
 * before Remotion bundles.
 *
 * Scene type mapping:
 *   - Scene 0 (first scene)  → Intro component
 *   - Scene N (last scene)   → Outro component
 *   - Content scenes         → Cycle through N unique content variants
 *
 * The contentVariantIndex field on each scene (from data.json) assigns which
 * content variant to use. Scenes cycle through variants for visual variety.
 */
import { Fragment, useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  delayRender,
  continueRender,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { resolveFontFamily } from "../../fonts/registry";
import type { GeneratedVideoData, GeneratedSceneData, GeneratedSceneProps } from "./types";

// Static imports — these files are placeholder stubs in the repo but get
// overwritten with actual AI-generated code in the render workspace.
import IntroScene from "./SceneIntro";
import OutroScene from "./SceneOutro";

// Content variant registry — generated at render time by remotion.py
// In the repo this file exports an empty array; at render time it's overwritten
// with imports of SceneContent0, SceneContent1, etc.
import { CONTENT_VARIANTS } from "./contentRegistry";
import { pickGeneratedTransition } from "./generatedTransitions";
import { GeneratedCtaOverlay } from "./GeneratedCtaOverlay";
// Dedicated, deterministic data-viz scenes (chart + table) — rendered from a
// bound table rather than AI code, so custom templates always get a reliable,
// editable chart/table pair like the built-in templates.
import { DataChartScene, DataTableScene } from "./kit";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

// ─── Types ───────────────────────────────────────────────────

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

const FPS = 30;

// ─── Metadata ─────────────────────────────────────────────────

export const calculateGeneratedMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: GeneratedVideoData = await res.json();
      const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);

      const sceneFrames = data.scenes.map((s) =>
        getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
      );
      const totalFrames = sceneFrames.reduce((sum, f) => sum + f, 0);
      const isPortrait = data.aspectRatio === "portrait";

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch (e) {
      console.warn("calculateGeneratedMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Scene type resolution ────────────────────────────────────

function getSceneComponent(
  scene: GeneratedSceneData,
  index: number,
  totalScenes: number,
): React.FC<GeneratedSceneProps> {
  // Determine scene type
  const sceneType =
    scene.sceneType ||
    (index === 0
      ? "intro"
      : index === totalScenes - 1 && totalScenes > 1
        ? "outro"
        : "content");

  if (sceneType === "intro") return IntroScene;
  if (sceneType === "outro") return OutroScene;
  // Dedicated data-viz scenes render via the kit (deterministic, not AI code).
  if (sceneType === "dataviz_chart") return DataChartScene;
  if (sceneType === "dataviz_table") return DataTableScene;

  // Content scene — pick variant by contentVariantIndex (cycling through available variants)
  if (CONTENT_VARIANTS.length > 0) {
    const variantIdx =
      scene.contentVariantIndex !== undefined
        ? scene.contentVariantIndex % CONTENT_VARIANTS.length
        : index % CONTENT_VARIANTS.length;
    return CONTENT_VARIANTS[variantIdx];
  }

  // Fallback: no content variants available, use intro
  return IntroScene;
}

// ─── Composition ───────────────────────────────────────────────

export const GeneratedVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<GeneratedVideoData | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [fontHandle] = useState(() =>
    delayRender("Loading fonts for generated video", {
      timeoutInMilliseconds: 15_000,
    }),
  );

  useEffect(() => {
    setFontsReady(false);
    setData(null);

    const finishFontLoad = () => {
      setFontsReady(true);
      continueRender(fontHandle);
    };

    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((d: GeneratedVideoData) => {
        setData(d);

        // Wait for EVERY font the scenes actually paint with before releasing the
        // render — not just the project font. The intro leads with the large
        // heading font, so if it isn't loaded the title paints in the fallback and
        // then swaps when the real font arrives → intro flicker on render. Gather
        // the project font + the theme heading/body fonts (each at 400 & 700) and
        // await them all, then document.fonts.ready, before continueRender.
        //
        // headingFont/bodyFont can be a RAW theme string from the AI extractor
        // (e.g. "Playfair Display"), so sanitize each to a single bare family
        // (strip any CSS fallback list / quotes) — document.fonts.load() throws
        // on an unparseable font shorthand, and an unguarded throw here would fall
        // to the outer .catch() and replace the whole video with fallback data.
        const cleanFamily = (f: string): string =>
          f.split(",")[0].replace(/['"]/g, "").trim();
        const families = Array.from(
          new Set(
            [
              resolveFontFamily(d.fontFamily ?? null),
              resolveFontFamily(d.headingFont ?? null) || d.headingFont,
              resolveFontFamily(d.bodyFont ?? null) || d.bodyFont,
            ]
              .filter((f): f is string => !!f && !!f.trim())
              .map(cleanFamily)
              .filter(Boolean),
          ),
        );

        if (families.length > 0) {
          // Each load is individually guarded so one bad family name can neither
          // throw synchronously nor reject the whole batch.
          const safeLoad = (spec: string) => {
            try {
              return document.fonts.load(spec).catch(() => undefined);
            } catch {
              return Promise.resolve(undefined);
            }
          };
          const loads = families.flatMap((f) => [
            safeLoad(`400 16px "${f}"`),
            safeLoad(`700 16px "${f}"`),
          ]);
          Promise.all(loads)
            .then(() => document.fonts.ready)
            .then(() => finishFontLoad())
            .catch(() => finishFontLoad());
          return;
        }

        // No custom fonts — just finish
        finishFontLoad();
      })
      .catch(() => {
        // Emergency fallback data
        setData({
          projectName: "Generated Preview",
          accentColor: "#7C3AED",
          bgColor: "#FFFFFF",
          textColor: "#1A1A2E",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "Generated template preview.",
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
        setFontsReady(true);
        continueRender(fontHandle);
      });
  }, [dataUrl, fontHandle]);

  const resolvedFontFamily = resolveFontFamily(data?.fontFamily ?? null);
  // Resolve heading/body fonts: user override (font ID) gets resolved via registry,
  // theme font names (e.g. "Inter") are used as-is.
  const headingFont = resolveFontFamily(data?.headingFont ?? null) || data?.headingFont || undefined;
  const bodyFont = resolveFontFamily(data?.bodyFont ?? null) || data?.bodyFont || undefined;

  if (!data || !fontsReady) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            color: "#666",
            fontSize: 28,
            fontFamily: resolvedFontFamily ?? "Inter, sans-serif",
          }}
        >
          Loading...
        </p>
      </AbsoluteFill>
    );
  }

  // Build brand colors from data
  const brandColors: GeneratedSceneProps["brandColors"] = data.brandColors || {
    primary: data.accentColor || "#7C3AED",
    secondary: "#F5F5F5",
    accent: data.accentColor || "#7C3AED",
    background: data.bgColor || "#FFFFFF",
    text: data.textColor || "#1A1A2E",
  };
  // Thread the optional gradient endpoint so the kit (SceneFrame) can render a
  // solid-vs-gradient background at render time without regenerating code.
  if (data.bg2Color && !brandColors.bg2) {
    brandColors.bg2 = data.bg2Color;
  }

  const totalScenes = data.scenes.length;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const isPortrait = (data.aspectRatio as string) === "portrait";
  const canvasW = isPortrait ? 1080 : 1920;
  const canvasH = isPortrait ? 1920 : 1080;

  console.log(
    `[GeneratedVideo] Rendering ${totalScenes} scenes with ${CONTENT_VARIANTS.length} content variants`,
  );

  // Per-scene durations (audio-aligned) + the transition consumed AFTER each
  // non-last scene. By setting each non-last TransitionSeries.Sequence to
  // sceneFrames + transitionFrames, the overlap the transition consumes is
  // exactly the added hold — so BOTH the total duration and the audio start
  // frames stay identical to a plain back-to-back render (zero audio-sync
  // drift, and calculateGeneratedMetadata needs no change). The transitions
  // are real two-scene moves (incoming + outgoing overlap) keyed to the brand's
  // motion personality — see generatedTransitions.ts.
  const sceneFrames = data.scenes.map((scene) =>
    getSceneDurationFrames(scene.durationSeconds, FPS, playbackSpeed),
  );
  const transitions = data.scenes.map((_, i) =>
    i < totalScenes - 1
      ? pickGeneratedTransition(i, data.transitionFamily, canvasW, canvasH, brandColors.accent)
      : null,
  );
  const sequenceFrames = sceneFrames.map((f, i) =>
    transitions[i] ? f + transitions[i]!.frames : f,
  );
  // Audio start frames === plain back-to-back schedule (see note above).
  const sceneStartFrames: number[] = [];
  {
    let running = 0;
    for (let i = 0; i < totalScenes; i++) {
      sceneStartFrames[i] = running;
      running += sceneFrames[i];
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColors.background,
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      <TransitionSeries>
        {data.scenes.map((scene, index) => {
          const SceneComp = getSceneComponent(scene, index, totalScenes);
          const imageUrl =
            scene.images.length > 0
              ? staticFile(scene.images[0])
              : (scene.ogImageUrl || undefined);
          const focusX = Number(scene.layoutProps?.imageFocusX ?? 50);
          const focusY = Number(scene.layoutProps?.imageFocusY ?? 50);
          const imageZoom = Math.max(0.1, Number(scene.layoutProps?.imageZoom ?? 1));
          const imageObjectPosition = `${Math.max(0, Math.min(100, focusX))}% ${Math.max(0, Math.min(100, focusY))}%`;

          // Spread structured content (bullets, metrics, quotes, etc.) onto scene props
          const sc = (scene.structuredContent || {}) as Record<string, unknown>;
          const sceneProps: GeneratedSceneProps = {
            displayText: scene.displayText || scene.narration || scene.title,
            narrationText: scene.narrationText || scene.narration || "",
            imageUrl,
            imageObjectPosition,
            imageZoom,
            sceneIndex: index,
            totalScenes,
            logoUrl: (data.logo || data.brandLogo) ? staticFile((data.logo || data.brandLogo)!) : undefined,
            brandImages: data.brandImages?.map((f) => staticFile(f)),
            brandColors,
            aspectRatio: (data.aspectRatio as "landscape" | "portrait") || "landscape",
            contentType: sc.contentType as GeneratedSceneProps["contentType"],
            bullets: sc.bullets as string[] | undefined,
            metrics: sc.metrics as GeneratedSceneProps["metrics"],
            codeLines: sc.codeLines as string[] | undefined,
            codeLanguage: sc.codeLanguage as string | undefined,
            quote: sc.quote as string | undefined,
            quoteAuthor: sc.quoteAuthor as string | undefined,
            comparisonLeft: sc.comparisonLeft as GeneratedSceneProps["comparisonLeft"],
            comparisonRight: sc.comparisonRight as GeneratedSceneProps["comparisonRight"],
            timelineItems: sc.timelineItems as GeneratedSceneProps["timelineItems"],
            steps: sc.steps as string[] | undefined,
            // Prefer the editable layoutProps location (what SceneEditModal writes)
            // and fall back to structuredContent from the content extractor.
            chartTable: (scene.layoutProps?.chartTable ?? sc.chartTable) as GeneratedSceneProps["chartTable"],
            chartType: (scene.layoutProps?.chartType ?? sc.chartType) as string | undefined,
            chartSummary: (scene.layoutProps?.chartSummary ?? sc.chartSummary) as string | undefined,
            titleFontSize: scene.layoutConfig?.titleFontSize as number | undefined,
            descriptionFontSize: scene.layoutConfig?.descriptionFontSize as number | undefined,
            headingFont,
            bodyFont,
          };

          const visual = scene.ctaProps ? (
            <GeneratedCtaOverlay
              ctaProps={scene.ctaProps}
              brandColors={brandColors}
              aspectRatio={(data.aspectRatio as "landscape" | "portrait") || "landscape"}
              headingFont={headingFont}
              bodyFont={bodyFont}
              title={sceneProps.displayText}
              logoUrl={sceneProps.logoUrl}
            />
          ) : (
            <AbsoluteFill
              style={{
                ["--img-pos" as string]: imageObjectPosition,
                ["--img-zoom" as string]: String(imageZoom),
              }}
            >
              <style>{`[data-scene-wrapper] img:not([data-logo]){object-position:var(--img-pos,50% 50%) !important;transform:scale(var(--img-zoom,1)) !important;transform-origin:var(--img-pos,50% 50%) !important;}[data-scene-wrapper] [data-content-img]{object-position:var(--img-pos,50% 50%) !important;background-position:var(--img-pos,50% 50%) !important;transform:scale(var(--img-zoom,1)) !important;transform-origin:var(--img-pos,50% 50%) !important;}`}</style>
              <div data-scene-wrapper style={{ width: "100%", height: "100%" }}>
                <SceneComp {...sceneProps} />
              </div>
            </AbsoluteFill>
          );

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sequenceFrames[index]}
            >
              {visual}
            </TransitionSeries.Sequence>
          );

          const t = transitions[index];
          if (!t) return sequence;
          return (
            <Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={t.presentation}
                timing={linearTiming({ durationInFrames: t.frames })}
              />
            </Fragment>
          );
        })}
      </TransitionSeries>

      {/* Voiceover lives on a parallel absolute timeline (NOT inside the
          TransitionSeries) so the transition overlap never warps audio sync —
          sceneStartFrames is the plain back-to-back schedule. */}
      {data.scenes.map((scene, index) =>
        scene.voiceoverFile ? (
          <Sequence
            key={`audio-${scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={sceneFrames[index]}
          >
            <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
            {data.captionsEnabled && (scene.narrationText || scene.narration) && (
              <CaptionTrack
                text={scene.narrationText || scene.narration}
                position={data.captionPosition || "bottom_center"}
                aspectRatio={data.aspectRatio || "landscape"}
                fontFamily={data.captionFontFamily ? (resolveFontFamily(data.captionFontFamily) || data.captionFontFamily) : (resolvedFontFamily || undefined)}
                fontSize={data.captionFontSize ? Number(data.captionFontSize) : undefined}
                offset={data.captionOffset ?? 0}
                speechDurationFrames={
                  scene.speechDurationSeconds
                    ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, playbackSpeed)
                    : undefined
                }
              />
            )}
          </Sequence>
        ) : null,
      )}

      {data.logo && (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          size={data.logoSize || "default"}
          aspectRatio={data.aspectRatio || "landscape"}
        />
      )}

      {data.bgmFile && (
        <BackgroundMusic src={staticFile(data.bgmFile)} volume={data.bgmVolume ?? 0.10} scenes={data.scenes} />
      )}
    </AbsoluteFill>
  );
};
