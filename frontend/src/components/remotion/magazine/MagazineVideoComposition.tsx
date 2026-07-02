import React from "react";
import "../../../fonts/magazine-defaults";
import { AbsoluteFill, Audio, Sequence, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { MAGAZINE_LAYOUT_REGISTRY as LAYOUT_REGISTRY, MagazineLayoutType, SceneLayoutProps } from "./layouts";
import { signatureMoveFor, MagDimsContext, MAG_BACKDROP } from "./magazineStyle";
import { pickEnterTransition, pickExitTransition, type MagazineTransitionChoice } from "./transitions";
import type { MagazineCameraMove, MagazineTransitionName } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { resolveFontFamily } from "../../../fonts/registry";

export interface MagazineSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: MagazineLayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
  /** Per-scene background-music volume override (0..1). */
  bgmVolume?: number | null;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface MagazineVideoCompositionProps {
  scenes: MagazineSceneInput[];
  /** Publication name — drives the TIME-style cover masthead. */
  projectName?: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  bgmUrl?: string | null;
  bgmVolume?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: number;
  captionOffset?: number;
}

const FPS = 30;

// Pure-black beat length between a scene's exit and the next scene's entrance. This is the
// EXACT visible dead-black gap: the bridge is sized to exitFrames + enterFrames + BLACK_HOLD.
const BLACK_HOLD = 6;

// Cap the per-side transition overlap. The clamp below otherwise scales the overlap
// with scene length (perScene × 0.225), so on long narration-length scenes the enter
// reveal grows to ~76f and fully covers each layout's camera-move settle window
// (~68 real frames — settleEnd 50 × MAG_TEMPO 1.35 in useMagazineCamera). That's why
// the camera moves only showed on the SHORT curated preview scenes and vanished in
// Project View. Capping the overlap keeps the reveal shorter than the camera settle at
// ANY scene length, so the per-layout camera move always plays in view.
const TRANSITION_OVERLAP_CAP = 30;

export interface MagazineBoundary {
  exitChoice: MagazineTransitionChoice;
  enterChoice: MagazineTransitionChoice;
  blackFrames: number;
  exitFrames: number;
  enterFrames: number;
}

/**
 * Plan the black-bridged TransitionSeries: for each boundary between scene i and i+1,
 * resolve the exit (scene→black) and enter (black→scene) transitions and clamp them to
 * the surrounding sequence lengths. Returns the per-boundary frame budget AND the total
 * composition length, so the composition render loop and the Player's declared
 * `durationInFrames` are computed from the SAME math (no drift = scenes don't race/clip).
 *
 * A boundary lays out as: [scene] · exit · [BLACK bridge] · enter · [next scene]. A
 * TransitionSeries transition OVERLAPS its two neighbours by its own length, so the net
 * frames a boundary ADDS to the timeline is `blackFrames − exitFrames − enterFrames`.
 */
export const planMagazineBoundaries = (
  layoutKeys: MagazineLayoutType[],
  perSceneFrames: number[],
  accentColor: string,
  enterOverrides: (MagazineTransitionName | undefined)[] = [],
  exitOverrides: (MagazineTransitionName | undefined)[] = [],
): { boundaries: MagazineBoundary[]; totalFrames: number; startFrames: number[] } => {
  const accent = accentColor || "#D71921";
  const boundaries: MagazineBoundary[] = layoutKeys.slice(0, -1).map((layoutKey, i) => {
    const nextLayout = layoutKeys[i + 1];
    const exitChoice = pickExitTransition(layoutKey, accent, exitOverrides[i]);
    const enterChoice = pickEnterTransition(nextLayout, accent, enterOverrides[i + 1]);
    // A scene's visible-static window = its duration MINUS the enter overlap at its head
    // and the exit overlap at its tail. Reserve at least STATIC_CORE_FRAC of each scene
    // as that static window so every page has time to read/animate in before it leaves —
    // otherwise long transitions (e.g. zoom_blur 122f) on a short scene can eat the WHOLE
    // scene and it "moves away almost immediately". The overlap is also capped by
    // TRANSITION_OVERLAP_CAP so it never overruns the per-layout camera-move settle window.
    const STATIC_CORE_FRAC = 0.55; // ≥55% of every scene stays a held, static page
    const maxSidePerScene = Math.floor((perSceneFrames[i] * (1 - STATIC_CORE_FRAC)) / 2);
    const maxSideNextScene = Math.floor((perSceneFrames[i + 1] * (1 - STATIC_CORE_FRAC)) / 2);
    const exitFrames = Math.max(
      1,
      Math.min(exitChoice.frames, maxSidePerScene, TRANSITION_OVERLAP_CAP),
    );
    const enterFrames = Math.max(
      1,
      Math.min(enterChoice.frames, maxSideNextScene, TRANSITION_OVERLAP_CAP),
    );
    // The bridge is just the two page-clearing overlaps + a short pure-black beat, so the
    // visible dead-black gap between scenes is exactly BLACK_HOLD frames — NOT the full
    // transition length (which made the gap balloon to ~3s once the overlaps were capped).
    // exit+enter ≤ blackFrames holds by construction, so Remotion's overlap constraint is
    // always satisfied.
    const blackFrames = exitFrames + enterFrames + BLACK_HOLD;
    return { exitChoice, enterChoice, blackFrames, exitFrames, enterFrames };
  });

  const startFrames: number[] = [];
  let run = 0;
  perSceneFrames.forEach((dur, i) => {
    startFrames[i] = run;
    run += dur;
    const b = boundaries[i];
    if (b) {
      run -= b.exitFrames;
      run += b.blackFrames;
      run -= b.enterFrames;
    }
  });
  return { boundaries, totalFrames: run, startFrames };
};

export const resolveMagazineLayout = (raw: string): MagazineLayoutType =>
  (raw as MagazineLayoutType) in LAYOUT_REGISTRY
    ? (raw as MagazineLayoutType)
    : "text_narration";
const resolveLayout = resolveMagazineLayout;

export const MagazineVideoComposition: React.FC<MagazineVideoCompositionProps> = ({
  scenes,
  projectName,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  logoSize,
  aspectRatio,
  fontFamily,
  bgmUrl,
  bgmVolume,
  captionsEnabled,
  captionPosition,
  captionFontFamily,
  captionFontSize,
  captionOffset,
}) => {
  const isPortrait = aspectRatio === "portrait";
  const canvasW = isPortrait ? 1080 : 1920;
  const canvasH = isPortrait ? 1920 : 1080;
  // Real output size (the Player composition is already 1920×1080, so this is a
  // no-op there). Author every spread on the fixed design canvas and uniformly
  // scale it to fill the real output, then hand the design size to layout/
  // transition math via MagDimsContext — see useMagDims in magazineStyle.
  const { width: outW, height: outH } = useVideoConfig();
  const wrapCanvas = (children: React.ReactNode) => (
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
        {children}
      </MagDimsContext.Provider>
    </div>
  );

  const resolvedScenes = scenes.map((scene) => {
    const layoutKey = resolveLayout(String(scene.layout));
    const durationFrames = Math.max(1, Math.round((Number(scene.durationSeconds) || 5) * FPS));
    return { scene, layoutKey, durationFrames };
  });

  // BLACK-BRIDGED sequencing: a TransitionSeries where every boundary is
  //   [scene] · exitTransition · [BLACK bridge] · enterTransition · [next scene]
  // The leaving scene clears to a solid black/desk fill (exitTransition, scene→black),
  // then the entering scene flies in from that black with its layout's signature 3D
  // move (enterTransition, black→scene). Because one side of EVERY transition is a
  // cheap solid fill, only ONE heavy magazine page is ever painted per frame — so the
  // per-layout 3D entrances are back without the two-pages-per-frame stutter that the
  // old all-scene TransitionSeries had ([[magazine-preview-paint-cost]]).
  // Boundary planning is shared with the Player's duration calc via planMagazineBoundaries.
  const { boundaries, startFrames: sceneStartFrames } = planMagazineBoundaries(
    resolvedScenes.map((s) => s.layoutKey),
    resolvedScenes.map((s) => s.durationFrames),
    accentColor || "#D71921",
    resolvedScenes.map(
      (s) => (s.scene.layoutProps as Record<string, unknown>)?.enterTransition as MagazineTransitionName | undefined,
    ),
    resolvedScenes.map(
      (s) => (s.scene.layoutProps as Record<string, unknown>)?.exitTransition as MagazineTransitionName | undefined,
    ),
  );

  const buildLayoutProps = (
    scene: MagazineSceneInput,
    layoutKey: MagazineLayoutType,
    durationFrames: number,
    index: number,
  ): SceneLayoutProps => {
    const pageNum = index + 1;
    const rawProps = (scene.layoutProps as Record<string, unknown>) ?? {};
    const focusX = Math.max(0, Math.min(100, Number(rawProps?.imageFocusX ?? 50)));
    const focusY = Math.max(0, Math.min(100, Number(rawProps?.imageFocusY ?? 50)));
    // For a few layouts the pipeline writes the on-screen copy into layout_props_json
    // (as `title`/`narration`) rather than reusing the scene's main Title / Display-text.
    // For those, prefer the layout-prop value and only fall back to the main scene field
    // when the layout prop is empty. Every other layout keeps the main scene fields.
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
    return {
      ...rawProps,
      title: preferProps && lpTitle ? lpTitle : scene.title,
      narration: preferProps && lpNarr ? lpNarr : scene.narration,
      imageUrl: scene.imageUrl,
      imageObjectPosition: `${focusX}% ${focusY}%`,
      imageZoom: Math.max(0.1, Number(rawProps?.imageZoom ?? 1)),
      accentColor: accentColor || "#D71921",
      bgColor: bgColor || "#FFFFFF",
      textColor: textColor || "#111111",
      aspectRatio,
      sceneDurationInFrames: durationFrames,
      fontFamily,
      pageNumber: pageNum < 10 ? `0${pageNum}` : String(pageNum),
      brandName: projectName,
      establishingShot: index === 0,
      // First scene cranes in; otherwise use the per-layout signature move,
      // unless the scene explicitly sets its own cameraMove.
      cameraMove:
        (rawProps?.cameraMove as MagazineCameraMove | undefined) ??
        (index === 0 ? "crane_down" : signatureMoveFor(layoutKey, pageNum)),
    };
  };

  // On-screen captions for a scene, synced to its voiceover window. Lives at the
  // real-output level (outside the scaled design canvas) so it sizes/positions in
  // output pixels — matching how the newspaper composition renders captions.
  const captionSequence = (
    scene: MagazineSceneInput,
    index: number,
    startFrame: number,
    durationFrames: number,
  ) => {
    const text = scene.narrationText || scene.narration;
    if (!captionsEnabled || !text) return null;
    return (
      <Sequence
        key={`caption-${scene.id}-${index}`}
        from={startFrame}
        durationInFrames={durationFrames}
      >
        <CaptionTrack
          text={text}
          position={captionPosition || "bottom_center"}
          aspectRatio={aspectRatio || "landscape"}
          fontFamily={
            captionFontFamily
              ? resolveFontFamily(captionFontFamily) || captionFontFamily
              : fontFamily || undefined
          }
          fontSize={captionFontSize || undefined}
          offset={captionOffset ?? 0}
          speechDurationFrames={
            scene.speechDurationSeconds
              ? Math.round(scene.speechDurationSeconds * FPS)
              : undefined
          }
        />
      </Sequence>
    );
  };

  // Single scene — no transitions needed.
  if (resolvedScenes.length <= 1) {
    const only = resolvedScenes[0];
    return (
      <AbsoluteFill style={{ backgroundColor: bgColor || "#FFFFFF", fontFamily }}>
        {only && wrapCanvas((() => {
          const LayoutComponent = LAYOUT_REGISTRY[only.layoutKey] ?? LAYOUT_REGISTRY.text_narration;
          const layoutProps = buildLayoutProps(only.scene, only.layoutKey, only.durationFrames, 0);
          return (
            <Sequence from={0} durationInFrames={only.durationFrames} name={only.scene.title}>
              <LayoutComponent {...layoutProps} />
              {only.scene.voiceoverUrl && <Audio src={only.scene.voiceoverUrl} />}
            </Sequence>
          );
        })())}
        {only && captionSequence(only.scene, 0, 0, only.durationFrames)}
        {logo && (
          <LogoOverlay
            src={logo}
            position={logoPosition || "bottom_right"}
            maxOpacity={logoOpacity ?? 0.9}
            size={logoSize ?? 100}
            aspectRatio={aspectRatio || "landscape"}
          />
        )}
        {bgmUrl && (
          <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} scenes={scenes} />
        )}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FFFFFF", fontFamily }}>
      {/* Persistent desk behind everything so any transition gap reveals the dark
          desk rather than a flat flash. */}
      <AbsoluteFill style={{ backgroundColor: MAG_BACKDROP }} />
      {wrapCanvas(
        <TransitionSeries>
          {resolvedScenes.flatMap((s, index) => {
            const { scene, layoutKey } = s;
            const LayoutComponent = LAYOUT_REGISTRY[layoutKey] ?? LAYOUT_REGISTRY.text_narration;
            const layoutProps = buildLayoutProps(scene, layoutKey, s.durationFrames, index);
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
              // scene → BLACK : the leaving page clears with its exit signature.
              nodes.push(
                <TransitionSeries.Transition
                  key={`exit-${scene.id}-${index}`}
                  presentation={b.exitChoice.presentation}
                  timing={linearTiming({ durationInFrames: b.exitFrames })}
                />,
                // The pure black/desk bridge — only ONE heavy page is ever painted
                // because the other side of both transitions is this solid fill.
                <TransitionSeries.Sequence
                  key={`black-${scene.id}-${index}`}
                  durationInFrames={b.blackFrames}
                >
                  <AbsoluteFill style={{ backgroundColor: MAG_BACKDROP }} />
                </TransitionSeries.Sequence>,
                // BLACK → next scene : the entering page flies in with its layout's
                // signature 3D entrance.
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
      )}

      {resolvedScenes.map((s, index) => {
        if (!s.scene.voiceoverUrl) return null;
        return (
          <Sequence
            key={`audio-${s.scene.id}-${index}`}
            from={sceneStartFrames[index]}
            durationInFrames={s.durationFrames}
          >
            <Audio src={s.scene.voiceoverUrl} />
          </Sequence>
        );
      })}

      {resolvedScenes.map((s, index) =>
        captionSequence(s.scene, index, sceneStartFrames[index], s.durationFrames),
      )}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}

      {bgmUrl && (
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} scenes={scenes} />
      )}
    </AbsoluteFill>
  );
};
