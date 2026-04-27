import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BLOOMBERG_LAYOUT_REGISTRY } from "./layouts";
import type { BloombergLayoutProps, BloombergLayoutType } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";

// Frames for each transition half (enter OR exit). 40 frames = 1.33 s at 30 fps.
const HALF = 40;

export interface BloombergSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  voiceoverUrl?: string;
}

export interface BloombergVideoCompositionProps {
  scenes: BloombergSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
}

// A single wrapper that handles enter + content + exit in one continuous Sequence.
// The layout component inside gets a monotonically-increasing useCurrentFrame(),
// so its own fade-in animation (frame 0→20) plays once during the enter phase
// and never resets.
const SceneWithTransitions: React.FC<{
  bgColor: string;
  isFirst: boolean;
  isLast: boolean;
  styleIndex: number;
  enterFrames: number;
  contentFrames: number;
  exitFrames: number;
  children: React.ReactNode;
}> = ({ bgColor, isFirst, isLast, styleIndex, enterFrames, contentFrames, exitFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isInEnter = !isFirst && frame < enterFrames;
  const isInExit = !isLast && frame >= enterFrames + contentFrames;

  let tx = 0, ty = 0, scale = 1, opacity = 1, motionBlur = 0;

  if (isInEnter) {
    const sp = spring({ frame, fps, config: { stiffness: 55, damping: 14 } });
    // Opacity on the wrapper (includes bg) — starts at 0 so previous scene shows through
    opacity = interpolate(sp, [0, 0.25, 1], [0, 0.7, 1], { extrapolateRight: "clamp" });
    motionBlur = interpolate(sp, [0, 0.35, 1], [4, 4, 0]);
    const style = styleIndex % 3;
    if (style === 0) {
      ty = interpolate(sp, [0, 1], [40, 0]);
      scale = interpolate(sp, [0, 1], [0.96, 1.0]);
    } else if (style === 1) {
      tx = interpolate(sp, [0, 1], [90, 0]);
      scale = interpolate(sp, [0, 1], [0.97, 1.0]);
    } else {
      scale = interpolate(sp, [0, 1], [0.91, 1.0]);
      ty = interpolate(sp, [0, 1], [-18, 0]);
    }
  } else if (isInExit) {
    const exitFrame = frame - (enterFrames + contentFrames);
    const sp = spring({ frame: exitFrame, fps, config: { stiffness: 40, damping: 12 } });
    opacity = interpolate(sp, [0, 0.40, 1], [1, 1, 0], { extrapolateRight: "clamp" });
    motionBlur = interpolate(sp, [0, 0.35, 1], [0, 4, 0]);
    const style = styleIndex % 3;
    if (style === 0) {
      ty = interpolate(sp, [0, 1], [0, -40]);
      scale = interpolate(sp, [0, 1], [1.0, 0.96]);
    } else if (style === 1) {
      tx = interpolate(sp, [0, 1], [0, -90]);
      scale = interpolate(sp, [0, 1], [1.0, 0.97]);
    } else {
      scale = interpolate(sp, [0, 1], [1.0, 0.91]);
      ty = interpolate(sp, [0, 1], [0, 18]);
    }
  }
  // Content phase: identity transform, full opacity — no branch needed

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor,
      overflow: "hidden",
      opacity,
      transform: scale !== 1 || tx !== 0 || ty !== 0
        ? `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`
        : undefined,
      transformOrigin: "50% 50%",
      filter: motionBlur > 0.3 ? `blur(${motionBlur.toFixed(1)}px)` : undefined,
      willChange: "transform, opacity, filter",
    }}>
      {children}
    </AbsoluteFill>
  );
};

export const BloombergVideoComposition: React.FC<
  BloombergVideoCompositionProps
> = ({
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
  playbackSpeed,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  const bg = bgColor || "#000000";
  const accent = accentColor || "#5EA2FF";

  const contentFrames: number[] = scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, resolvedPlaybackSpeed),
  );

  // cursor advances by content frames only — each scene's Sequence starts exactly
  // when the previous scene's content ends (and begins its exit). This makes the
  // new scene's enter overlap the previous scene's exit.
  const startFrames: number[] = [];
  let cursor = 0;
  for (let i = 0; i < scenes.length; i++) {
    startFrames.push(cursor);
    cursor += contentFrames[i];
  }

  return (
    <AbsoluteFill style={{ backgroundColor: bg, fontFamily }}>
      {scenes.map((scene, index) => {
        const content = contentFrames[index];
        const isFirst = index === 0;
        const isLast = index === scenes.length - 1;

        const enterFrames = isFirst ? 0 : HALF;
        const exitFrames = isLast ? 0 : HALF;

        // Single Sequence — no sub-sequences — layout's useCurrentFrame() never resets
        const seqDuration = enterFrames + content + exitFrames;
        const seqStart = startFrames[index]; // NO subtraction — enter overlaps previous exit

        const LayoutComponent =
          BLOOMBERG_LAYOUT_REGISTRY[scene.layout] ??
          BLOOMBERG_LAYOUT_REGISTRY.terminal_narrative;

        const lp = (scene.layoutProps || {}) as Record<string, unknown>;
        const focusX = typeof lp.imageFocusX === "number" ? lp.imageFocusX : 50;
        const focusY = typeof lp.imageFocusY === "number" ? lp.imageFocusY : 50;
        const resolvedZoom = typeof lp.imageZoom === "number" ? lp.imageZoom : (scene.imageZoom ?? 1);

        const layoutProps: BloombergLayoutProps = {
          ...lp,
          title: scene.title,
          narration: scene.narration,
          accentColor: accent,
          bgColor: bg,
          textColor: textColor || "#FFB340",
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
          imageObjectPosition: scene.imageObjectPosition ?? `${focusX}% ${focusY}%`,
          imageZoom: resolvedZoom,
          layoutType: scene.layout,
          fontFamily,
        };

        return (
          <Sequence
            key={scene.id}
            from={seqStart}
            durationInFrames={seqDuration}
            name={scene.title}
          >
            <SceneWithTransitions
              bgColor={bg}
              isFirst={isFirst}
              isLast={isLast}
              styleIndex={index}
              enterFrames={enterFrames}
              contentFrames={content}
              exitFrames={exitFrames}
            >
              <LayoutComponent {...layoutProps} />
            </SceneWithTransitions>

            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
            )}
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
