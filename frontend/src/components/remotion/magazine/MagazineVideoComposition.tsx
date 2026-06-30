import React from "react";
import "../../../fonts/magazine-defaults";
import { AbsoluteFill, Audio, Easing, Sequence, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { MAGAZINE_LAYOUT_REGISTRY as LAYOUT_REGISTRY, MagazineLayoutType, SceneLayoutProps } from "./layouts";
import { pickMagazineTransition } from "./transitions";
import { signatureMoveFor, MagDimsContext } from "./magazineStyle";
import type { MagazineCameraMove, MagazineTransitionName } from "./types";
import { LogoOverlay } from "../LogoOverlay";

export interface MagazineSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: MagazineLayoutType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layoutProps: Record<string, any>;
  durationSeconds: number;
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
}

const FPS = 30;

const resolveLayout = (raw: string): MagazineLayoutType =>
  (raw as MagazineLayoutType) in LAYOUT_REGISTRY
    ? (raw as MagazineLayoutType)
    : "text_narration";

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

  // One transition per boundary (null for the last scene). Reused for the hold,
  // safeFrames and the rendered presentation so pickMagazineTransition runs once.
  const transitionChoices = resolvedScenes.map((s, i, arr) => {
    if (i === arr.length - 1) return null;
    const nextLayout = arr[i + 1].layoutKey;
    const fromExit = s.scene.layoutProps?.exitTransition as MagazineTransitionName | undefined;
    const toEnter = arr[i + 1].scene.layoutProps?.enterTransition as MagazineTransitionName | undefined;
    return pickMagazineTransition(i, s.layoutKey, nextLayout, canvasW, accentColor || "#D71921", toEnter, fromExit);
  });

  // Hold each scene for exactly its own outgoing transition so the page-turn
  // overlaps the hold (not the narration) and the next scene's voiceover begins
  // the instant this one ends — no dead air. (A fixed max-length hold padded
  // every scene by the longest transition, leaving silence on shorter boundaries.)
  const sequenceFrames = resolvedScenes.map(
    (s, i) => s.durationFrames + (transitionChoices[i]?.frames ?? 0),
  );

  // Scene start frames for audio sync (accounting for transition overlap).
  let runningFrame = 0;
  const sceneStartFrames: number[] = [];
  resolvedScenes.forEach((s, i) => {
    sceneStartFrames[i] = runningFrame;
    runningFrame += sequenceFrames[i];
    if (i < resolvedScenes.length - 1) {
      const rawFrames = transitionChoices[i]!.frames;
      const safeFrames = Math.max(1, Math.min(rawFrames, Math.floor(sequenceFrames[i] / 2), Math.floor(sequenceFrames[i + 1] / 2)));
      runningFrame -= safeFrames;
    }
  });

  const buildLayoutProps = (
    scene: MagazineSceneInput,
    layoutKey: MagazineLayoutType,
    durationFrames: number,
    index: number,
  ): SceneLayoutProps => {
    const pageNum = index + 1;
    const focusX = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusX ?? 50)));
    const focusY = Math.max(0, Math.min(100, Number((scene.layoutProps as Record<string, unknown>)?.imageFocusY ?? 50)));
    return {
      ...(scene.layoutProps as Record<string, unknown>),
      title: scene.title,
      narration: scene.narration,
      imageUrl: scene.imageUrl,
      imageObjectPosition: `${focusX}% ${focusY}%`,
      imageZoom: Math.max(0.1, Number((scene.layoutProps as Record<string, unknown>)?.imageZoom ?? 1)),
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
        ((scene.layoutProps as Record<string, unknown>)?.cameraMove as MagazineCameraMove | undefined) ??
        (index === 0 ? "crane_down" : signatureMoveFor(layoutKey, pageNum)),
    };
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
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FFFFFF", fontFamily }}>
      {wrapCanvas(
      <TransitionSeries>
        {resolvedScenes.map((s, index) => {
          const { scene, layoutKey } = s;
          const seqFrames = sequenceFrames[index];
          const LayoutComponent = LAYOUT_REGISTRY[layoutKey] ?? LAYOUT_REGISTRY.text_narration;
          const layoutProps = buildLayoutProps(scene, layoutKey, s.durationFrames, index);

          const sequence = (
            <TransitionSeries.Sequence
              key={`seq-${scene.id}-${index}`}
              durationInFrames={seqFrames}
            >
              <LayoutComponent {...layoutProps} />
            </TransitionSeries.Sequence>
          );

          if (index === resolvedScenes.length - 1) {
            return sequence;
          }

          const choice = transitionChoices[index]!;
          // Clamp so the transition never exceeds either adjacent sequence length.
          // Remotion throws a hard error if it does.
          const safeFrames = Math.max(1, Math.min(
            choice.frames,
            Math.floor(seqFrames / 2),
            Math.floor(sequenceFrames[index + 1] / 2),
          ));

          return (
            <React.Fragment key={`scene-${scene.id}-${index}`}>
              {sequence}
              <TransitionSeries.Transition
                presentation={choice.presentation}
                timing={linearTiming({
                  durationInFrames: safeFrames,
                  easing: Easing.inOut(Easing.cubic),
                })}
              />
            </React.Fragment>
          );
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
