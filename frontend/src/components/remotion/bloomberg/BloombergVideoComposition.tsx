import { resolveFontFamily } from "../../../fonts/registry";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BLOOMBERG_LAYOUT_REGISTRY } from "./layouts";
import type { BloombergLayoutProps, BloombergLayoutType } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { BackgroundMusic } from "../BackgroundMusic";
import { CaptionTrack } from "../CaptionTrack";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { BLOOMBERG_COLORS, derivePalette } from "./constants";

// 70 frames ≈ 2.3 s at 30 fps — slow enough to feel deliberate.
const HALF = 70;

// Exact bar heights per orientation (max across all layouts).
// Landscape: topH=56 (TerminalBoot), botH=40. Portrait: topH=64, botH=48.
const TOP_L = 56;
const BOT_L = 40;
const TOP_P = 64;
const BOT_P = 48;

export interface BloombergSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  /** Spoken narration text — used for captions (may differ from on-screen narration). */
  narrationText?: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  /** Spoken-audio length in seconds — for caption timing. */
  speechDurationSeconds?: number;
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
  bgmUrl?: string | null;
  bgmVolume?: number;
  aspectRatio?: string;
  fontFamily?: string;
  playbackSpeed?: number;
  captionsEnabled?: boolean;
  captionPosition?: string;
  captionFontFamily?: string;
  captionFontSize?: number;
  captionOffset?: number;
}

// Non-repeating enter style sequence — never the same style twice in a row.
// 4 styles: 0=pan-right, 1=iris-zoom, 2=pan-left, 3=crossfade-scale
// Arranged so index i and i+1 always differ.
const ENTER_SEQUENCE = [0, 2, 1, 3, 0, 3, 2, 1, 3, 0, 1, 2];

// Bottom bar technique sequence — 3 styles, also non-repeating adjacent.
const BOT_SEQUENCE = [0, 1, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2];

const SceneBody: React.FC<{
  bgColor: string;
  isFirst: boolean;
  isLast: boolean;
  styleIndex: number;
  enterFrames: number;
  contentFrames: number;
  exitFrames: number;
  topBarH: number;
  botBarH: number;
  children: React.ReactNode;
}> = ({ bgColor, isFirst, isLast, styleIndex, enterFrames, contentFrames, exitFrames, topBarH, botBarH, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isInEnter = !isFirst && frame < enterFrames;
  const isInExit  = !isLast  && frame >= enterFrames + contentFrames;
  const isTransitioning = isInEnter || isInExit;

  // Lazy spring — settles slowly, no bounce
  let t = 0;
  if (isInEnter) {
    const sp = spring({ frame, fps, config: { stiffness: 28, damping: 22 } });
    t = interpolate(sp, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  } else if (isInExit) {
    const exitFrame = frame - (enterFrames + contentFrames);
    const sp = spring({ frame: exitFrame, fps, config: { stiffness: 40, damping: 18 } });
    t = interpolate(sp, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  }

  // Pick enter style from non-repeating sequence
  const enterStyle = ENTER_SEQUENCE[styleIndex % ENTER_SEQUENCE.length];
  let bodyTx = 0, bodyRotY = 0, bodyAlpha = 1, bodyScale = 1;

  if (isInExit) {
    // Exit: always slides left + rotates away
    bodyTx    = interpolate(t, [0, 1], [0, -width],  { extrapolateRight: "clamp" });
    bodyRotY  = interpolate(t, [0, 1], [0, 10],      { extrapolateRight: "clamp" });
    bodyAlpha = interpolate(t, [0, 0.5, 1], [1, 0.7, 0], { extrapolateRight: "clamp" });
    bodyScale = interpolate(t, [0, 1], [1, 0.93],    { extrapolateRight: "clamp" });
  } else if (isInEnter) {
    if (enterStyle === 0) {
      // Pan from right + rotateY
      bodyTx    = interpolate(t, [0, 1], [width, 0],  { extrapolateRight: "clamp" });
      bodyRotY  = interpolate(t, [0, 1], [-10, 0],    { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.3, 1], [0, 0.6, 1], { extrapolateRight: "clamp" });
      bodyScale = interpolate(t, [0, 1], [0.95, 1],   { extrapolateRight: "clamp" });
    } else if (enterStyle === 1) {
      // Iris zoom in from centre
      bodyScale = interpolate(t, [0, 1], [0.55, 1],                   { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.2, 0.7, 1], [0, 0.4, 0.9, 1], { extrapolateRight: "clamp" });
    } else if (enterStyle === 2) {
      // Pan from left + rotateY (mirror of 0)
      bodyTx    = interpolate(t, [0, 1], [-width, 0], { extrapolateRight: "clamp" });
      bodyRotY  = interpolate(t, [0, 1], [10, 0],     { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.3, 1], [0, 0.6, 1], { extrapolateRight: "clamp" });
      bodyScale = interpolate(t, [0, 1], [0.95, 1],   { extrapolateRight: "clamp" });
    } else {
      // Crossfade + gentle scale (no translation, purely atmospheric)
      bodyScale = interpolate(t, [0, 1], [0.9, 1],                    { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.5, 1], [0, 0.75, 1],           { extrapolateRight: "clamp" });
    }
  }

  // Bottom bar content: non-repeating technique sequence
  // Exit always: slide down. Enter: 0=slide-up, 1=wipe-left, 2=crossfade-scale
  const technique = BOT_SEQUENCE[styleIndex % BOT_SEQUENCE.length];
  let botTy = 0, botAlpha = 1, botScale = 1;
  let botClipRight = "0%";

  if (isInExit) {
    botTy    = interpolate(t, [0, 0.5, 1], [0, botBarH, botBarH], { extrapolateRight: "clamp" });
    botAlpha = interpolate(t, [0, 0.4], [1, 0], { extrapolateRight: "clamp" });
  } else if (isInEnter) {
    if (technique === 0) {
      botTy    = interpolate(t, [0, 1], [botBarH, 0], { extrapolateRight: "clamp" });
      botAlpha = interpolate(t, [0, 0.3, 1], [0, 0.7, 1], { extrapolateRight: "clamp" });
    } else if (technique === 1) {
      const pct = interpolate(t, [0, 1], [0, 100], { extrapolateRight: "clamp" });
      botClipRight = `${100 - pct}%`;
      botAlpha = interpolate(t, [0, 0.15, 1], [0, 1, 1], { extrapolateRight: "clamp" });
    } else {
      botScale = interpolate(t, [0, 1], [0.85, 1], { extrapolateRight: "clamp" });
      botAlpha = interpolate(t, [0, 0.6, 1], [0, 0.8, 1], { extrapolateRight: "clamp" });
    }
  }

  const bodyTransform = isTransitioning
    ? `translateX(${bodyTx}px) rotateY(${bodyRotY}deg) scale(${bodyScale})`
    : undefined;

  const botTransform = (botTy !== 0 || botScale !== 1)
    ? `translateY(${botTy}px) scale(${botScale})`
    : undefined;

  // Body zone height in px — used to anchor transformOrigin correctly
  const bodyZoneH = height - topBarH - botBarH;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>

      {/* ── BODY ZONE — only this region is transformed / animated ── */}
      <div style={{
        position: "absolute",
        top: topBarH, left: 0, right: 0, bottom: botBarH,
        overflow: "hidden",
        perspective: `${width * 2.5}px`,
        perspectiveOrigin: `50% ${bodyZoneH / 2}px`,
      }}>
        <div style={{
          position: "absolute",
          top: -topBarH, left: 0,
          width, height,
          opacity: bodyAlpha,
          transform: bodyTransform,
          transformOrigin: `50% ${topBarH + bodyZoneH / 2}px`,
          transformStyle: "preserve-3d",
          willChange: isTransitioning ? "transform, opacity" : "auto",
        }}>
          {children}
        </div>
      </div>

      {/* Top-zone scene content (titles/tags/etc.) sits above global rails. */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, width, height: topBarH,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1101,
        opacity: isInEnter
          ? interpolate(frame, [0, Math.max(1, enterFrames)], [0, 1], { extrapolateRight: "clamp" })
          : isInExit
            ? interpolate(t, [0, 0.45, 1], [1, 0, 0], { extrapolateRight: "clamp" })
            : bodyAlpha,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, width, height }}>
          {children}
        </div>
      </div>

      {/* ── BOTTOM BAR CONTENT ZONE ── */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: botBarH,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 2,
      }}>
        <div style={{
          position: "absolute",
          top: -(height - botBarH), left: 0,
          width, height,
          opacity: botAlpha,
          transform: botTransform,
          transformOrigin: "50% 50%",
          clipPath: technique === 1 && isInEnter
            ? `inset(0 ${botClipRight} 0 0)`
            : undefined,
          willChange: isTransitioning ? "transform, opacity" : "auto",
        }}>
          {children}
        </div>
      </div>

    </AbsoluteFill>
  );
};

// Permanent line overlay — only the border lines, no background fill.
// The layout's own headerBg and text render underneath and show through.
// This purely enforces that the amber top line and dim bottom line never
// flicker or move during transitions.
const BarOverlay: React.FC<{
  bgColor: string;
  textColor: string;
  aspectRatio: string;
}> = ({ bgColor, textColor, aspectRatio }) => {
  const { width } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const topH = isPortrait ? TOP_P : TOP_L;
  const botH = isPortrait ? BOT_P : BOT_L;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const { headerBg, border } = derivePalette(bgColor, amber);

  return (
    <>
      {/* Persistent top bar background */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, width, height: topH,
        backgroundColor: headerBg,
        zIndex: 999,
        pointerEvents: "none",
      }} />
      {/* Thin top accent rails */}
      <div style={{
        position: "absolute",
        top: 1, left: 0, width, height: 1,
        backgroundColor: `${amber}66`,
        zIndex: 1000,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: 3, left: 0, width, height: 1,
        background: `linear-gradient(90deg, ${amber}00, ${amber}55, ${amber}00)`,
        zIndex: 1000,
        pointerEvents: "none",
      }} />
      {/* Main text-color divider under the top bar */}
      <div style={{
        position: "absolute",
        top: topH - 2, left: 0, width, height: 2,
        backgroundColor: amber,
        zIndex: 1200,
        pointerEvents: "none",
      }} />
      {/* Bottom bar background */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, width, height: botH,
        backgroundColor: headerBg,
        zIndex: 999,
        pointerEvents: "none",
      }} />
      {/* Dim line at the top edge of the bottom bar */}
      <div style={{
        position: "absolute",
        bottom: botH - 1, left: 0, width, height: 1,
        backgroundColor: border,
        zIndex: 1000,
        pointerEvents: "none",
      }} />
    </>
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
  bgmUrl,
  bgmVolume,
  aspectRatio,
  fontFamily,
  playbackSpeed,
  captionsEnabled,
  captionPosition,
  captionFontFamily,
  captionFontSize,
  captionOffset,
}) => {
  const FPS = 30;
  const resolvedPlaybackSpeed = getPlaybackSpeed(playbackSpeed);
  const bg = bgColor || "#000000";
  const accent = accentColor || "#5EA2FF";
  const ratio = aspectRatio || "landscape";
  const isPortrait = ratio === "portrait";
  const topBarH = isPortrait ? TOP_P : TOP_L;
  const botBarH = isPortrait ? BOT_P : BOT_L;

  const contentFrames: number[] = scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, resolvedPlaybackSpeed),
  );

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
        const exitFrames  = isLast  ? 0 : HALF;
        const seqDuration = enterFrames + content + exitFrames;
        const seqStart    = startFrames[index];

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
          aspectRatio: ratio,
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
            <SceneBody
              bgColor={bg}
              isFirst={isFirst}
              isLast={isLast}
              styleIndex={index}
              enterFrames={enterFrames}
              contentFrames={content}
              exitFrames={exitFrames}
              topBarH={topBarH}
              botBarH={botBarH}
            >
              <LayoutComponent {...layoutProps} />
            </SceneBody>

            {scene.voiceoverUrl && (
              <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
            )}
            {captionsEnabled && (scene.narrationText || scene.narration) && (
              <CaptionTrack
                text={scene.narrationText || scene.narration}
                position={captionPosition || "bottom_center"}
                aspectRatio={aspectRatio || "landscape"}
                fontFamily={captionFontFamily ? (resolveFontFamily(captionFontFamily) || captionFontFamily) : (fontFamily || undefined)}
                fontSize={captionFontSize || undefined}
                offset={captionOffset ?? 0}
                speechDurationFrames={
                  scene.speechDurationSeconds
                    ? getSceneDurationFrames(scene.speechDurationSeconds, FPS, resolvedPlaybackSpeed)
                    : undefined
                }
              />
            )}
          </Sequence>
        );
      })}

      {/* Single permanent bar overlay — sits above all scenes, never moves */}
      <BarOverlay bgColor={bg} textColor={textColor || "#FFB340"} aspectRatio={ratio} />

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          size={logoSize ?? 100}
          aspectRatio={ratio}
        />
      )}

      {bgmUrl && (
        <BackgroundMusic src={bgmUrl} volume={bgmVolume ?? 0.10} scenes={scenes} />
      )}
    </AbsoluteFill>
  );
};
