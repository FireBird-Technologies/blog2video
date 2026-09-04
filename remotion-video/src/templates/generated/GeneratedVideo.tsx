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
import { Fragment, useEffect, useRef, useState } from "react";
import { AvatarOverlay } from "../../components/AvatarOverlay";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  delayRender,
  continueRender,
  useCurrentFrame,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { ZoomCropVideo } from "./components/ZoomCropVideo";
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
import SceneErrorBoundary from "./SceneErrorBoundary";
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

// ─── Clip-slot overlay ─────────────────────────────────────────

/**
 * Positions a stock-footage clip for a generated scene component.
 *
 * imageUrl is genuinely omitted for a clip scene (never fed a video URL as a
 * fake image src — Remotion's <Img> calls cancelRender() on a failed load
 * with no onError handler, which hard-fails real CLI renders even though it
 * looked harmless in the interactive Player/Studio).
 *
 * Components generated under the hasVideo-aware prompt (code_generator.py)
 * know to leave a real, empty [data-content-img] placeholder box (no <Img>)
 * when props.hasVideo is true — same geometry as their normal with-image
 * layout. We measure that box and position the clip to fill it exactly,
 * expressed as a PERCENTAGE of the container (not raw pixels): Remotion
 * Studio/Player scale the whole composition to fit their preview panel, and
 * our overlay renders inside that same scaled ancestor, so copying already-
 * scaled pixel values would double-apply the scale.
 *
 * Older, already-generated components predate that contract and have no such
 * marker (their no-image branch renders an opaque full-width backdrop
 * instead, with no data-content-img at all when hasImage is false). For
 * those we fall back to a full-bleed layer, always rendered BEHIND SceneComp
 * (z-index in SceneVisual) — a solid legacy backdrop simply hides the clip
 * (no worse than before this feature existed), while a semi-transparent one
 * lets it show through. Not a precise fit, but the only option without
 * regenerating that brand's code (via the dashboard's Regenerate action).
 *
 * Re-measures every frame (via useCurrentFrame): the box isn't static — most
 * generated components spring/translate the image container in on entrance,
 * so a one-time on-mount measurement would freeze the clip at whatever
 * position the slot happened to be in on that first paint.
 */
function ClipSlotOverlay({
  containerRef,
  videoUrl,
  imageObjectPosition,
  imageZoom,
  muted,
  volume,
  durationInFrames,
  startInFrames,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoUrl: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  muted?: boolean;
  volume?: number;
  durationInFrames?: number;
  startInFrames?: number;
}) {
  const frame = useCurrentFrame();
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [legacyFallback, setLegacyFallback] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slot = container.querySelector<HTMLElement>("[data-content-img]");
    if (!slot) {
      setLegacyFallback(true);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const next = {
      left: ((slotRect.left - containerRect.left) / containerRect.width) * 100,
      top: ((slotRect.top - containerRect.top) / containerRect.height) * 100,
      width: (slotRect.width / containerRect.width) * 100,
      height: (slotRect.height / containerRect.height) * 100,
    };
    // Skip the re-render when nothing actually moved (common once an
    // entrance animation settles) — avoids a setState-per-frame churn for
    // the rest of a long, static scene.
    setBox((prev) =>
      prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height
        ? prev
        : next,
    );
  }, [containerRef, frame]);

  const video = (
    <ZoomCropVideo
      src={videoUrl}
      imageObjectPosition={imageObjectPosition}
      imageZoom={imageZoom}
      muted={muted}
      volume={volume}
      durationInFrames={durationInFrames}
      startInFrames={startInFrames}
    />
  );

  if (legacyFallback) {
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {video}
      </div>
    );
  }

  if (!box || box.width <= 0 || box.height <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        overflow: "hidden",
      }}
    >
      {video}
    </div>
  );
}

// ─── Scene visual (image/clip layer + generated component) ────

function SceneVisual({
  SceneComp,
  sceneProps,
  videoUrl,
  imageObjectPosition,
  imageZoom,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  brandColors,
  headingFont,
  resolvedFontFamily,
}: {
  SceneComp: React.FC<GeneratedSceneProps>;
  sceneProps: GeneratedSceneProps;
  videoUrl?: string;
  imageObjectPosition: string;
  imageZoom: number;
  videoMuted?: boolean;
  videoVolume?: number;
  videoDurationInFrames?: number;
  videoStartInFrames?: number;
  brandColors: GeneratedSceneProps["brandColors"];
  headingFont?: string;
  resolvedFontFamily?: string | null;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  return (
    <AbsoluteFill
      style={{
        ["--img-pos" as string]: imageObjectPosition,
        ["--img-zoom" as string]: String(imageZoom),
      }}
    >
      <style>{`[data-scene-wrapper] img:not([data-logo]){object-position:var(--img-pos,50% 50%) !important;transform:scale(var(--img-zoom,1)) !important;transform-origin:var(--img-pos,50% 50%) !important;}[data-scene-wrapper] [data-content-img]{object-position:var(--img-pos,50% 50%) !important;background-position:var(--img-pos,50% 50%) !important;transform:scale(var(--img-zoom,1)) !important;transform-origin:var(--img-pos,50% 50%) !important;}${videoUrl ? "[data-scene-wrapper] [data-scenecomp-layer]{background:transparent !important;}[data-scene-wrapper] [data-scenecomp-layer]>div{background:transparent !important;}" : ""}`}</style>
      <div data-scene-wrapper ref={wrapperRef} style={{ width: "100%", height: "100%", position: "relative" }}>
        {/* Clip layer paints first (behind). In the precise-slot case this
            doesn't matter — the placeholder it fills is empty and non-
            overlapping with SceneComp's other content. In the legacy
            full-bleed case (no placeholder found) it's required — SceneComp's
            own backdrop/text must stay on top or the clip would cover them. */}
        {videoUrl && (
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <ClipSlotOverlay
              containerRef={wrapperRef}
              videoUrl={videoUrl}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              muted={videoMuted}
              volume={videoVolume}
              durationInFrames={videoDurationInFrames}
              startInFrames={videoStartInFrames}
            />
          </div>
        )}
        {/* data-scenecomp-layer: when a clip is active, the CSS above forces
            this layer's own background AND its direct child's background-color
            to transparent — some generated components correctly gate their
            inner decorative backdrop on hasVideo but leave their OUTERMOST
            AbsoluteFill's own backgroundColor unconditional (an opaque fill
            that would otherwise sit right on top of the clip). */}
        <div data-scenecomp-layer style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <SceneErrorBoundary
            brandColors={brandColors}
            fallbackText={sceneProps.displayText}
            fontFamily={headingFont || resolvedFontFamily || undefined}
          >
            <SceneComp {...sceneProps} logoUrl={undefined} />
          </SceneErrorBoundary>
        </div>
      </div>
    </AbsoluteFill>
  );
}

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
              avatarVideoFile: null,
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
          // Dataviz scenes render a bound chart/table, not an image/clip slot,
          // and CTA scenes render the overlay branch below — neither gets a clip.
          const canShowClip = !scene.ctaProps && scene.sceneType !== "dataviz_chart" && scene.sceneType !== "dataviz_table";
          const videoUrl = canShowClip && scene.video ? staticFile(scene.video) : undefined;
          const videoDurationInFrames = scene.videoDurationSeconds
            ? Math.max(1, Math.round(scene.videoDurationSeconds * FPS))
            : undefined;
          const videoStartInFrames = scene.videoStartSeconds
            ? Math.max(0, Math.round(scene.videoStartSeconds * FPS))
            : undefined;
          const focusX = Number(scene.layoutProps?.imageFocusX ?? 50);
          const focusY = Number(scene.layoutProps?.imageFocusY ?? 50);
          const imageZoom = Math.max(0.1, Number(scene.layoutProps?.imageZoom ?? 1));
          const imageObjectPosition = `${Math.max(0, Math.min(100, focusX))}% ${Math.max(0, Math.min(100, focusY))}%`;

          // Spread structured content (bullets, metrics, quotes, etc.) onto scene props
          const sc = (scene.structuredContent || {}) as Record<string, unknown>;
          const sceneProps: GeneratedSceneProps = {
            displayText: scene.displayText || scene.narration || scene.title,
            narrationText: scene.narrationText || scene.narration || "",
            // Never pass a video URL as imageUrl: Remotion's <Img> calls
            // cancelRender() on a failed load with no onError handler, which
            // hard-fails real CLI renders (confirmed — looked harmless in the
            // interactive Player/Studio but isn't). Omit it for a clip scene;
            // hasVideo tells hasVideo-aware components (see prompt) to still
            // reserve the with-image layout/geometry without an <Img>.
            imageUrl: videoUrl ? undefined : imageUrl,
            hasVideo: !!videoUrl,
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
            <SceneVisual
              SceneComp={SceneComp}
              sceneProps={sceneProps}
              videoUrl={videoUrl}
              imageObjectPosition={imageObjectPosition}
              imageZoom={imageZoom}
              videoMuted={scene.videoMuted ?? true}
              videoVolume={scene.videoVolume ?? 0.35}
              videoDurationInFrames={videoDurationInFrames}
              videoStartInFrames={videoStartInFrames}
              brandColors={brandColors}
              headingFont={headingFont}
              resolvedFontFamily={resolvedFontFamily}
            />
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
            {scene.avatarVideoFile && (
              <AvatarOverlay src={staticFile(scene.avatarVideoFile)} aspectRatio={data.aspectRatio || "landscape"} shape={scene.avatarShape ?? data.avatarShape} size={scene.avatarSize ?? data.avatarSize} position={scene.avatarPosition ?? data.avatarPosition} bg={scene.avatarBg ?? data.avatarBg} opacity={scene.avatarOpacity ?? data.avatarOpacity} focusX={scene.avatarFocusX} focusY={scene.avatarFocusY} zoom={scene.avatarZoom} />
            )}
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
