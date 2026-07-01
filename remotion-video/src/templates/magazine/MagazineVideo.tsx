import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
  CalculateMetadataFunction,
  delayRender,
  continueRender,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { MAGAZINE_LAYOUT_REGISTRY as LAYOUT_REGISTRY, MagazineLayoutType, SceneLayoutProps } from "./layouts";
import { signatureMoveFor, MagDimsContext, MAG_BACKDROP } from "./magazineStyle";
import { pickEnterTransition, pickExitTransition } from "./transitions";
import type { MagazineCameraMove, MagazineTransitionName } from "./types";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
import { BackgroundMusic } from "../../components/BackgroundMusic";
import { CaptionTrack } from "../../components/CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen `narration`/displayText). */
  narrationText?: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  /** Spoken-audio length in seconds (scene duration minus trailing pad) — for caption timing. */
  speechDurationSeconds?: number;
  voiceoverFile: string | null;
  images: string[];
}

interface VideoData {
  projectName: string;
  heroImage?: string | null;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number | string;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  bgmFile?: string | null;
  bgmVolume?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: string;
  captionOffset?: number;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

const resolveLayoutKey = (raw: string): MagazineLayoutType =>
  (raw as MagazineLayoutType) in LAYOUT_REGISTRY
    ? (raw as MagazineLayoutType)
    : "text_narration";

// Pure-black beat between a scene's exit and the next scene's entrance.
const BLACK_HOLD = 12;
// Minimum fraction of every scene held as a static, readable page (the rest is split
// between the enter overlap at its head and the exit overlap at its tail).
const STATIC_CORE_FRAC = 0.55;

/** Per-boundary frame budget for the black-bridged TransitionSeries. Mirrors the math in
 *  the render loop AND the frontend planMagazineBoundaries — keep all three in sync. */
const magazineBoundaryFrames = (
  fromLayout: MagazineLayoutType,
  toLayout: MagazineLayoutType,
  fromSceneFrames: number,
  toSceneFrames: number,
  accent: string,
) => {
  const exitChoice = pickExitTransition(fromLayout, accent);
  const enterChoice = pickEnterTransition(toLayout, accent);
  const blackFrames = Math.max(BLACK_HOLD, exitChoice.frames, enterChoice.frames);
  const exitFrames = Math.max(
    1,
    Math.min(exitChoice.frames, Math.floor((fromSceneFrames * (1 - STATIC_CORE_FRAC)) / 2), Math.floor(blackFrames / 2)),
  );
  const enterFrames = Math.max(
    1,
    Math.min(enterChoice.frames, Math.floor((toSceneFrames * (1 - STATIC_CORE_FRAC)) / 2), Math.floor(blackFrames / 2)),
  );
  return { blackFrames, exitFrames, enterFrames };
};

/** Total composition length = Σ scene frames + Σ (blackFrames − exitFrames − enterFrames). */
const computeMagazineTotalFrames = (
  layoutKeys: MagazineLayoutType[],
  sceneFrames: number[],
  accent: string,
): number => {
  let run = 0;
  sceneFrames.forEach((dur, i) => {
    run += dur;
    if (i < sceneFrames.length - 1) {
      const b = magazineBoundaryFrames(layoutKeys[i], layoutKeys[i + 1], dur, sceneFrames[i + 1], accent);
      run += b.blackFrames - b.exitFrames - b.enterFrames;
    }
  });
  return run;
};

export const calculateMagazineMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
      const sceneFrames = data.scenes.map((s) =>
        getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
      );
      // Black-bridged TransitionSeries: each boundary ADDS a black bridge and removes the
      // transition overlaps, so the total is the sum of scene lengths PLUS the per-boundary
      // net (blackFrames − exitFrames − enterFrames). Mirror the exact boundary math used
      // in the render loop below so the declared duration matches the composition.
      const totalFrames = computeMagazineTotalFrames(
        data.scenes.map((s) => resolveLayoutKey(s.layout)),
        sceneFrames,
        data.accentColor || "#D71921",
      );

      const isPortrait = data.aspectRatio === "portrait";
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch {
      return { durationInFrames: FPS * 300, fps: FPS, width: 1920, height: 1080 };
    }
  };

export const MagazineVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);
  // Gate headless frame capture until data.json is loaded. useState initialiser
  // runs synchronously on the very first render — before React commits to the
  // DOM — so Remotion's renderer sees the delayRender handle before it attempts
  // any frame capture. A ref stores the handle so re-renders don't create new ones.
  const [drHandle] = useState(() => delayRender("magazine-data-load"));

  // Real output size — may be forced smaller than the 1080p design canvas at
  // render time (e.g. 1280×720 via --width/--height).
  const { width: outW, height: outH } = useVideoConfig();

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((d: VideoData) => {
        setData(d);
        continueRender(drHandle);
      })
      .catch(() => {
        setData({
          projectName: "Preview",
          accentColor: "#E63946",
          bgColor: "#FDFCFB",
          textColor: "#1A1A1A",
          scenes: [],
        });
        continueRender(drHandle);
      });
  // drHandle is stable (useState initialiser runs once) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl]);

  if (!data) {
    return <AbsoluteFill style={{ backgroundColor: "#FDFCFB" }} />;
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const resolvedFontFamily = resolveFontFamily(data.fontFamily ?? null);
  const isPortrait = data.aspectRatio === "portrait";
  const canvasW = isPortrait ? 1080 : 1920;
  const canvasH = isPortrait ? 1920 : 1080;

  const sceneFrames = data.scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
  );
  const layoutKeys = data.scenes.map((s) => resolveLayoutKey(s.layout));

  const resolvedScenes = data.scenes.map((scene, idx) => ({
    scene,
    layoutKey: layoutKeys[idx],
    durationFrames: sceneFrames[idx],
  }));

  // BLACK-BRIDGED sequencing: a TransitionSeries where every boundary is
  //   [scene] · exitTransition · [BLACK bridge] · enterTransition · [next scene]
  // The leaving scene clears to a solid black/desk fill (exitTransition, scene→black),
  // then the entering scene flies in from that black with its layout's signature 3D
  // move (enterTransition, black→scene). Because one side of EVERY transition is a
  // cheap solid fill, only ONE heavy magazine page is ever painted per frame — so the
  // per-layout 3D entrances are back without the two-pages-per-frame stutter that the
  // old all-scene TransitionSeries had ([[magazine-preview-paint-cost]]).

  // Resolve + clamp each boundary's exit and enter transition (see the frontend
  // MagazineVideoComposition for the matching logic — these two trees must stay in sync).
  // BLACK_HOLD / STATIC_CORE_FRAC are module-level so calculateMagazineMetadata reuses them.
  const boundaries = resolvedScenes.slice(0, -1).map((s, i) => {
    const next = resolvedScenes[i + 1];
    const fromExit = (s.scene.layoutProps as Record<string, unknown>)?.exitTransition as
      | MagazineTransitionName
      | undefined;
    const toEnter = (next.scene.layoutProps as Record<string, unknown>)?.enterTransition as
      | MagazineTransitionName
      | undefined;
    const exitChoice = pickExitTransition(s.layoutKey, data.accentColor || "#D71921", fromExit);
    const enterChoice = pickEnterTransition(next.layoutKey, data.accentColor || "#D71921", toEnter);
    const blackFrames = Math.max(BLACK_HOLD, exitChoice.frames, enterChoice.frames);
    // Reserve ≥STATIC_CORE_FRAC of every scene as a held, static page so each page has
    // time to read/animate in before it leaves (otherwise a long transition eats the
    // whole short scene).
    const maxSidePerScene = Math.floor((s.durationFrames * (1 - STATIC_CORE_FRAC)) / 2);
    const maxSideNextScene = Math.floor((next.durationFrames * (1 - STATIC_CORE_FRAC)) / 2);
    const exitFrames = Math.max(
      1,
      Math.min(exitChoice.frames, maxSidePerScene, Math.floor(blackFrames / 2)),
    );
    const enterFrames = Math.max(
      1,
      Math.min(enterChoice.frames, maxSideNextScene, Math.floor(blackFrames / 2)),
    );
    return { exitChoice, enterChoice, blackFrames, exitFrames, enterFrames };
  });

  // Scene start frames for audio sync — walk the same layout the series builds:
  // scene → (−exitOverlap) exit → black → (−enterOverlap) enter → next scene.
  const sceneStartFrames: number[] = [];
  {
    let run = 0;
    resolvedScenes.forEach((s, i) => {
      sceneStartFrames[i] = run;
      run += s.durationFrames;
      const b = boundaries[i];
      if (b) {
        run -= b.exitFrames;
        run += b.blackFrames;
        run -= b.enterFrames;
      }
    });
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || "#FDFCFB",
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {/* Persistent desk behind everything so any transition gap reveals the dark
          desk rather than a flat flash. */}
      <AbsoluteFill style={{ backgroundColor: MAG_BACKDROP }} />
      {/* Design canvas: author every spread at a fixed 1080p size, then uniformly
          scale it to fill the real output so 720p/480p renders are identical to
          1080p (no clipped bands, deterministic auto-fit). Provider hands the
          design size to layout/transition math via useMagDims. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: canvasW,
          height: canvasH,
          transform: `scale(${outW / canvasW}, ${outH / canvasH})`,
          transformOrigin: "top left",
        }}
      >
        <MagDimsContext.Provider value={{ width: canvasW, height: canvasH }}>
          <TransitionSeries>
            {resolvedScenes.flatMap((s, index) => {
              const { scene, layoutKey } = s;
              const LayoutComponent = LAYOUT_REGISTRY[layoutKey];
              const imageUrl =
                scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

              const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
              const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
              const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));
              // For a few layouts the pipeline writes the on-screen copy into
              // layout_props_json (as `title`/`narration`) rather than reusing the scene's
              // main Title / Display-text. For those, prefer the layout-prop value and only
              // fall back to the main scene field when it's empty. Other layouts are unchanged.
              const preferProps = layoutKey === "editorial_quote" || layoutKey === "text_narration";
              // These layouts carry their own on-screen copy in layout_props_json. The key is
              // named per-layout (`quoteText` / `headline`) so it never collides with the scene's
              // main Title field; `title` is accepted only as a backward-compatible fallback.
              const lpOwnCopy =
                layoutKey === "editorial_quote"
                  ? (rawProps.quoteText as string | undefined)
                  : layoutKey === "text_narration"
                    ? (rawProps.headline as string | undefined)
                    : undefined;
              const lpTitle = (lpOwnCopy ?? (rawProps.title as string | undefined))?.trim();
              const lpNarr = (rawProps.narration as string | undefined)?.trim();

              const layoutProps: SceneLayoutProps = {
                ...(rawProps as Partial<SceneLayoutProps>),
                title: preferProps && lpTitle ? lpTitle : scene.title,
                narration: preferProps && lpNarr ? lpNarr : scene.narration,
                accentColor: data.accentColor || "#D71921",
                bgColor: data.bgColor || "#FFFFFF",
                textColor: data.textColor || "#111111",
                aspectRatio: data.aspectRatio || "landscape",
                sceneDurationInFrames: s.durationFrames,
                imageUrl,
                imageObjectPosition: `${focusX}% ${focusY}%`,
                imageZoom: Math.max(0.1, Number(rawProps.imageZoom ?? 1)),
                fontFamily: resolvedFontFamily || undefined,
                pageNumber: index + 1 < 10 ? `0${index + 1}` : String(index + 1),
                establishingShot: index === 0,
                brandName: data.projectName,
                // First scene cranes in; otherwise the per-layout signature move,
                // unless the scene explicitly sets its own cameraMove.
                cameraMove:
                  (rawProps.cameraMove as MagazineCameraMove | undefined) ??
                  (index === 0 ? "crane_down" : signatureMoveFor(layoutKey, index + 1)),
              };

              const b = boundaries[index];
              const nodes: React.ReactNode[] = [
                <TransitionSeries.Sequence
                  key={`seq-${scene.id}-${index}`}
                  durationInFrames={s.durationFrames}
                >
                  <LayoutComponent {...layoutProps} />
                </TransitionSeries.Sequence>,
              ];
              if (b) {
                nodes.push(
                  // scene → BLACK : the leaving page clears with its exit signature.
                  <TransitionSeries.Transition
                    key={`exit-${scene.id}-${index}`}
                    presentation={b.exitChoice.presentation}
                    timing={linearTiming({ durationInFrames: b.exitFrames })}
                  />,
                  // The pure black/desk bridge — only ONE heavy page is ever painted.
                  <TransitionSeries.Sequence
                    key={`black-${scene.id}-${index}`}
                    durationInFrames={b.blackFrames}
                  >
                    <AbsoluteFill style={{ backgroundColor: MAG_BACKDROP }} />
                  </TransitionSeries.Sequence>,
                  // BLACK → next scene : the entering page flies in with its signature.
                  <TransitionSeries.Transition
                    key={`enter-${scene.id}-${index}`}
                    presentation={b.enterChoice.presentation}
                    timing={linearTiming({ durationInFrames: b.enterFrames })}
                  />,
                );
              }
              return nodes;
            })}
          </TransitionSeries>
        </MagDimsContext.Provider>
      </div>

      {resolvedScenes.map((s, index) => {
        if (!s.scene.voiceoverFile) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={staticFile(s.scene.voiceoverFile)} playbackRate={playbackSpeed} />
          </Sequence>
        );
      })}

      {/* Captions — narration text, synced to each scene's voiceover window. Rendered
          at the real-output level (outside the scaled design canvas) so they size and
          position in output pixels, matching the newspaper composition. */}
      {data.captionsEnabled &&
        resolvedScenes.map((s, index) => {
          const text = s.scene.narrationText || s.scene.narration;
          if (!text) return null;
          return (
            <Sequence
              key={`caption-${s.scene.id}-${index}`}
              from={sceneStartFrames[index]}
              durationInFrames={s.durationFrames}
            >
              <CaptionTrack
                text={text}
                position={data.captionPosition || "bottom_center"}
                aspectRatio={data.aspectRatio || "landscape"}
                fontFamily={
                  data.captionFontFamily
                    ? resolveFontFamily(data.captionFontFamily) || data.captionFontFamily
                    : resolvedFontFamily || undefined
                }
                fontSize={data.captionFontSize ? Number(data.captionFontSize) : undefined}
                offset={data.captionOffset ?? 0}
                speechDurationFrames={
                  s.scene.speechDurationSeconds
                    ? getSceneDurationFrames(s.scene.speechDurationSeconds, FPS, playbackSpeed)
                    : undefined
                }
              />
            </Sequence>
          );
        })}

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
