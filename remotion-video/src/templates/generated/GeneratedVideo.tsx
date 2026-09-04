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
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import {
  DataChartScene,
  DataTableScene,
  EyebrowSizeProvider,
  KitVariantProvider,
  backgroundCss,
  colorsFromBrand,
  derivePalette,
  enforceTheme,
  variantFromSeed,
  withAlpha,
  resolveTypeSizes,
  resolveTypeExactness,
  TypeTierProvider,
  BodySizeScope,
  eyebrowRepeatsHeadline,
  sanitizeSceneProps,
} from "./kit";
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
  bodyFont,
  resolvedFontFamily,
  imageMode,
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
  bodyFont?: string;
  resolvedFontFamily?: string | null;
  imageMode?: "background" | "half" | null;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  /* Soften a FULL-BLEED image or clip so the copy on top stays readable.
   *
   * The scene contract tells the generator a background image must carry its
   * own scrim, but nothing enforced it — the gate is a file-wide `rgba(` grep
   * that any unrelated boxShadow satisfies, and it never ran on templates that
   * already existed. The result was headline text sitting directly on a busy
   * photograph.
   *
   * Applied here rather than in the scene because it must reach templates the
   * user already owns, with no regeneration — the same reason the brand canvas
   * and the theme enforcement live in this wrapper.
   *
   * A BLUR plus a light wash, not a flat dark scrim: blurring destroys the
   * high-frequency detail that actually competes with letterforms (a keyboard,
   * foliage, a crowd), so the type separates at a far lighter overlay than a
   * pure wash would need — the picture stays recognisable instead of being
   * dimmed into mud.
   *
   * TRIGGERED BY WHAT IS ACTUALLY ON SCREEN, not only by the declared mode.
   * `imageMode` comes from the design doc and is the authority when it says
   * "background", but it is null on every scene of a template generated before
   * it was threaded through — and the render path still places clips on those.
   * A scene showing a full-bleed clip has media behind its type whatever its
   * doc claims, so that case is treated too. "half" is the one mode explicitly
   * opted OUT: its image sits beside the type, where softening it would only
   * damage the picture for no readability gain.
   *
   * TWO PLACEMENTS, because a still and a clip arrive by different routes:
   *   - a CLIP is painted by ClipSlotOverlay at zIndex 0, so the treatment is a
   *     sibling layer above it and below the scene layer;
   *   - a STILL is drawn by the SCENE ITSELF inside [data-scenecomp-layer], so
   *     a sibling would sit behind it. That one is handled with CSS on the
   *     [data-content-img] container: a blur on the image, and an ::after wash
   *     inside its own box — leaving type outside the slot untouched. */
  const scrimColor = withAlpha(
    derivePalette(colorsFromBrand(brandColors)).bg,
    0.32,
  );
  const wantsScrim = imageMode === "background" || (!!videoUrl && imageMode !== "half");
  const BACKDROP_BLUR = "blur(7px)";

  /* Snap any off-theme colour the scene painted back onto the brand palette.
   *
   * The validator now rejects hard-coded hues and unreadable text at GENERATION
   * time, but templates the user already owns carry the older code — one shipped
   * an indigo rule and white body copy onto a cream canvas, where the white was
   * invisible and the indigo was simply not a brand colour. Correcting in the
   * DOM fixes those without regenerating anything.
   *
   * Runs on every frame because scenes animate colour (a stat counter fading
   * from accent to text passes through values that only exist mid-tween), and
   * enforceTheme is idempotent so a no-op frame costs one walk and no writes. */
  const enforceFrame = useCurrentFrame();
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const p = derivePalette(colorsFromBrand(brandColors));
    enforceTheme(el, {
      palette: [
        p.accent, p.accentText, p.bg, p.bg2, p.text,
        p.panel, p.header, p.muted, p.border, p.grid,
      ].filter(
        (c): c is string => Boolean(c),
      ),
      background: p.bg,
      text: p.text,
    });
  }, [enforceFrame, brandColors]);

  return (
    <AbsoluteFill
      style={{
        ["--img-pos" as string]: imageObjectPosition,
        ["--img-zoom" as string]: String(imageZoom),
      }}
    >
      {/* Focus/zoom applied to the IMAGE only, and clipped to its own box.
        *
        * This used to put `transform:scale(var(--img-zoom))` on BOTH the
        * `[data-content-img]` container AND the `img` inside it. The generator
        * contract puts that marker on the container, so the zoom was applied
        * twice — an effective zoom². Since `transform` neither reflows siblings
        * nor is clipped by an ancestor without `overflow:hidden`, the scaled
        * container bled straight over the sibling text column.
        *
        * Now: the container only carries position hints (and clips), while the
        * scale lives on the img alone. `overflow:hidden` means even a large zoom
        * stays inside the slot the layout gave it.
        *
        * KEEP IDENTICAL to VideoPreview.tsx — player and export must not
        * diverge.
        *
        * The [data-content-img]-targeting rules (added alongside the sibling
        * neutraliser above) close a gap that let an opaque clip slot ship: the
        * sibling rule explicitly excludes [data-content-img] itself (a still
        * image needs to keep its own placeholder tint/backdrop while the <Img>
        * loads), but that exemption also protected an opaque fill painted
        * DIRECTLY on the slot itself or a div nested inside it — e.g.
        * `<div data-content-img style={{backgroundColor: ...}}><Img .../><div
        * style={{position:'absolute', inset:0, background: gradient}}/></div>`.
        * When hasVideo is true there is no <Img>, so that fill (and any nested
        * absolutely-positioned overlay meant to sit ON TOP of the image) is the
        * only thing painted in the slot — sitting directly over the clip
        * underneath at zIndex 0, blanking it out completely (observed on
        * template custom_201's content_1 "Detail" layout: the clip played,
        * correctly positioned, invisible under the slot's own placeholder
        * tint + gradient overlay). Scoped to data-has-clip so a real still
        * image's own slot styling is untouched. */}
      <style>{`[data-scene-wrapper] img:not([data-logo]){object-position:var(--img-pos,50% 50%) !important;transform:scale(var(--img-zoom,1)) !important;transform-origin:var(--img-pos,50% 50%) !important;}[data-scene-wrapper] [data-content-img]{object-position:var(--img-pos,50% 50%) !important;background-position:var(--img-pos,50% 50%) !important;overflow:hidden !important;}[data-scene-wrapper] [data-scenecomp-layer]{background:transparent !important;}[data-scene-wrapper] [data-scenecomp-layer]>*{background:transparent !important;}[data-scene-wrapper] [data-scenecomp-layer] div[style*="width:100%"][style*="height:100%"][style*="position:absolute"]{background:transparent !important;background-color:transparent !important;}${videoUrl ? '[data-scene-wrapper][data-has-clip] [data-scenecomp-layer] div[style*="position:absolute"]:not([data-content-img]):not([data-keep-fill]){background:transparent !important;background-color:transparent !important;}[data-scene-wrapper][data-has-clip] [data-content-img]:not([data-keep-fill]){background:transparent !important;background-color:transparent !important;background-image:none !important;}[data-scene-wrapper][data-has-clip] [data-content-img]:not([data-keep-fill]) *:not(img):not([data-keep-fill]){background:transparent !important;background-color:transparent !important;}' : ''}`}</style>
      {/* THE BRAND CANVAS, painted once per scene by the wrapper.
        *
        * Every scene in a template must sit on the same ground. Relying on the
        * generated code to do that did not work: a scene can set its root fill
        * through a variable, a spread or a computed value, none of which a
        * static check can see, and one template shipped a near-black scene, a
        * cream scene and a solid-red scene. The CSS above neutralises the
        * scene's own root fill AND any full-bleed backdrop layer nested inside
        * it, then this paints the real canvas behind them.
        *
        * The root alone was not enough: the shape that actually shipped a black
        * canvas kept a correct root and painted over it with a sibling layer —
        *     <AbsoluteFill style={{background: palette.background}}>
        *       <AbsoluteFill style={{background: '#0a0a0a'}} />
        * so the last selector matches any absolutely-positioned descendant that
        * is 100% x 100%. AbsoluteFill serialises exactly that, while a SIZED
        * panel (width:48%) does not — panels and cards keep their fills, which
        * is where per-scene contrast belongs.
        *
        * fontFamily is set here for the same reason: a scene whose fallback is
        * `inherit` then resolves to the template's body face rather than the
        * system sans.
        *
        * Applies to templates that already exist, with no regeneration — the
        * same reason EyebrowSizeProvider and KitVariantProvider live here. */}
      <div
        data-scene-wrapper
        // Scopes the nested-fill neutraliser above to clip scenes only, so a
        // still-image or plain scene keeps every fill its design intended.
        data-has-clip={videoUrl ? "1" : undefined}
        ref={wrapperRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: backgroundCss(derivePalette(colorsFromBrand(brandColors))),
          fontFamily: bodyFont || resolvedFontFamily || undefined,
        }}
      >
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
        {/* Treatment for a full-bleed CLIP: above the video, below the scene.
            backdropFilter blurs everything already painted beneath it, which is
            the clip; the background is the light wash over that. */}
        {wantsScrim && videoUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              backdropFilter: BACKDROP_BLUR,
              WebkitBackdropFilter: BACKDROP_BLUR,
              background: scrimColor,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Treatment for a full-bleed STILL, which the scene draws itself.
            Scoped to the image slot so type outside it is unaffected: the blur
            goes on the <img> (backdropFilter cannot reach a sibling that paints
            later), and the ::after lays the wash over it. `overflow:hidden` on
            the container comes from the style block above and clips the blur's
            soft edge. */}
        {wantsScrim && !videoUrl && sceneProps.imageUrl && (
          <style>{`[data-scene-wrapper] [data-content-img]{position:relative;}[data-scene-wrapper] [data-content-img] img{filter:${BACKDROP_BLUR};}[data-scene-wrapper] [data-content-img]::after{content:"";position:absolute;inset:0;background:${scrimColor};pointer-events:none;z-index:2;}`}</style>
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
            {/* No scene ever draws its own logo. The single corner LogoOverlay
              * below is the ONE logo treatment, on every scene, sized as a
              * fraction of the canvas — a scene-drawn mark would compete with
              * it at a different size and position on the same frame. */}
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

  // This template's structural variant — which arrangement the kit's content
  // components render. Derived once per template from a brand seed so it is
  // stable across renders and differs between brands. Without a seed the kit
  // falls back to DEFAULT_VARIANT (the historical arrangement), so older
  // projects render exactly as before.
  const kitVariant = data.kitVariantSeed
    ? variantFromSeed(data.kitVariantSeed, data.kitVariant ?? undefined)
    : null;

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
          // `hideImage` gates the OG fallback too.
          //
          // The backend uses hideImage to say "this scene shows no still" — it
          // is how an outro, and any layout that declines an image, is kept
          // clean. But the fallback below reached past it to the project's OG
          // image, so a scene the backend had deliberately blanked still
          // rendered a picture on any project that had one. The assigned image
          // is already absent in that case; honouring the flag here is what
          // makes the decision actually stick.
          //
          // KEEP IDENTICAL to VideoPreview.tsx.
          const hideImage = !!(scene.layoutProps as { hideImage?: boolean } | undefined)?.hideImage;
          const imageUrl = hideImage
            ? undefined
            : scene.images.length > 0
              ? staticFile(scene.images[0])
              : (scene.ogImageUrl || undefined);
          // Dataviz scenes render a bound chart/table, not an image/clip slot.
          //
          // A v1 CTA scene is replaced by the overlay below, so a clip behind it
          // would never be seen. A v2 outro renders its own layout like any
          // other scene, so it can carry a clip if its design supports one.
          const usesCtaOverlay = !!scene.ctaProps && (data.templateDesignVersion ?? 1) < 2;
          const canShowClip =
            !usesCtaOverlay &&
            scene.sceneType !== "dataviz_chart" &&
            scene.sceneType !== "dataviz_table";
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
          const sceneProps: GeneratedSceneProps = sanitizeSceneProps({
            // Keep the three text fields DISTINCT — see GeneratedSceneProps.
            // displayText fell back to `narration`, which is the on-screen field
            // mixed with the voiceover, so a scene without display_text rendered
            // its VOICEOVER SCRIPT as the headline. Fall back to the title (a
            // short label) instead of to a narration paragraph.
            // When displayText FALLS BACK to the title, the two fields carry the
            // same string — and a scene that renders an eyebrow above a headline
            // then paints that string twice, which is what the intro did. The
            // headline is the one that must survive, so drop the eyebrow rather
            // than shipping the duplicate. Scenes also guard this themselves
            // (see the intro/outro contracts), but the render path must not hand
            // them the duplicate in the first place.
            // PREFIX, not equality. Titles are routinely the opening clause of
            // the display text ("Smarter Conversations Start Here" against
            // "Smarter conversations start here. Discover AI that adapts to
            // you."), which the old exact-equality test let straight through —
            // so the frame painted the same sentence twice, once as the eyebrow
            // and once as the headline. KEEP IDENTICAL to VideoPreview.tsx.
            //
            // WHICH FIELD SURVIVES A COLLISION FLIPS WITH THE DESIGN VERSION.
            // v3 binds titleFontSize to sceneTitle and makes the title the
            // scene's main label, so the TITLE is what always paints and the
            // display text is what drops. v1/v2 scenes render displayText as
            // the headline with the title as a small eyebrow, so there it is
            // the other way round — dropping the headline would blank the
            // frame. KEEP IDENTICAL to VideoPreview.tsx.
            ...((data.templateDesignVersion ?? 1) >= 3
              ? {
                  sceneTitle: scene.title || scene.displayText || "",
                  displayText: eyebrowRepeatsHeadline(
                    scene.title || scene.displayText || "",
                    scene.displayText || "",
                  )
                    ? ""
                    : scene.displayText || "",
                }
              : {
                  sceneTitle: eyebrowRepeatsHeadline(
                    scene.title,
                    scene.displayText || scene.title,
                  )
                    ? ""
                    : scene.title || "",
                  displayText: scene.displayText || scene.title || "",
                }),
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
            // Type sizes, CLAMPED to the bands a USER may set.
            //
            // Which size drives which element depends on the design version and
            // is easy to get backwards, so it lives in one documented place:
            // see kit/typeBands.ts. In v3 titleFontSize sizes props.sceneTitle
            // and descriptionFontSize sizes everything else; in v1/v2
            // titleFontSize sized props.displayText and there was a third
            // eyebrow tier.
            //
            // The template's per-scene DEFAULTS are already merged UNDER
            // scene.layoutConfig by services/remotion.py before this data is
            // written — the CLI render has no API access, so it cannot look
            // them up itself. This clamp is the last step, and it uses the USER
            // bands: a stored size is one a person chose, and clamping it to
            // the generator's own ceiling is what made the sliders look dead
            // above 88.
            //
            // KEEP IDENTICAL to its twin — preview and export must not diverge
            // on type size. Both call the same function for that reason.
            ...resolveTypeSizes(
              scene.layoutConfig,
              (data.aspectRatio as "landscape" | "portrait") || "landscape",
              data.templateDesignVersion ?? 1,
            ),
            headingFont,
            bodyFont,
            // Per-layout props the layout declared and the user edited (P3).
            layoutProps: scene.layoutProps,
            // The closing CTA + socials. Only the final scene carries these, and
            // only a v2 outro renders them itself — a v1 outro is replaced by
            // GeneratedCtaOverlay below and would ignore them anyway.
            ctaProps: scene.ctaProps,
          // Structured content is model-generated and has shipped in shapes the
          // prop contract does not declare — quoteAuthor as {name,role}, bullets
          // as [{lead,detail}] — which crash correct scene code and, through the
          // error boundary, take down the whole composition. The generator is
          // fixed at the source; this repairs rows already stored.
          });

          // v1: the overlay REPLACES the generated outro — that template's outro
          // was built expecting it and renders no CTA or socials of its own, so
          // it must keep getting the overlay or its ending would be empty.
          // v2: the outro composes ctaProps itself (see GeneratedSceneProps), so
          // the scene renders normally and the template's own ending is what
          // ships. This is the fix for every custom template ending identically.
          const visual = usesCtaOverlay ? (
            <GeneratedCtaOverlay
              ctaProps={scene.ctaProps!}
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
              bodyFont={bodyFont}
              resolvedFontFamily={resolvedFontFamily}
              imageMode={scene.imageMode}
            />
          );

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={sequenceFrames[index]}
            >
              {/* Eyebrow size is provided ABOVE the scene rather than passed
                  into it: generated scene code builds its own SceneFrame
                  overrides and never forwards this, so an ambient provider is
                  what lets the slider reach already-generated templates. */}
              <EyebrowSizeProvider size={sceneProps.sceneTitleFontSize}>
                {/* Which of the two sizes THIS user set explicitly, and a
                    per-scene registry the body publishes its rendered size into
                    so the title can clear it. Provided the same way and for the
                    same reason as the two above: a stored scene will never
                    forward them, so existing templates get literal sizing and a
                    guaranteed hierarchy without being regenerated. Per SCENE,
                    not global: two scenes overlap during a transition, and a
                    title must never be floored against the body it is
                    dissolving into. KEEP IDENTICAL to VideoPreview.tsx. */}
                <TypeTierProvider
                  value={{
                    // Exactness is decided on the scene's own layoutConfig OR the
                    // size sceneProps actually resolved to (which includes the
                    // template's stored per-scene default, injected by
                    // services/remotion.py).
                    //
                    // Reading layoutConfig alone under-reported: the pipeline
                    // stores it as `{}` for a custom-template scene, so a template
                    // whose sliders were set to 125 rendered the title at
                    // whatever FitText auto-fitted to instead. A stored
                    // scene_font_defaults entry comes from the template editor's
                    // sliders and nothing else, so it is a person's choice and
                    // must render literally. KEEP IDENTICAL to VideoPreview.tsx.
                    ...resolveTypeExactness({
                      titleFontSize: sceneProps.titleFontSize,
                      descriptionFontSize: sceneProps.descriptionFontSize,
                      ...((scene.layoutConfig as Record<string, unknown> | undefined) ?? {}),
                    }),
                    // The two RESOLVED sizes, so a FitText can tell which tier it
                    // is. Generated code passes a bare number and cannot label
                    // itself without regenerating every stored template; these are
                    // what it is matched against.
                    titleSize: sceneProps.titleFontSize,
                    descriptionSize: sceneProps.descriptionFontSize,
                  }}
                >
                  <BodySizeScope>
                    {/* Structural variant, provided the same way and for the
                        same reason: a stored scene will never forward it, so
                        existing templates gain variety without being
                        regenerated. */}
                    <KitVariantProvider variant={kitVariant}>{visual}</KitVariantProvider>
                  </BodySizeScope>
                </TypeTierProvider>
              </EyebrowSizeProvider>
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

      {/* The corner watermark runs across EVERY scene, bookends included — one
        * logo treatment for the whole video. It sizes itself as a fraction of
        * the canvas (see LogoOverlay), so it scales with the frame rather than
        * being pinned to a fixed pixel size. */}
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
