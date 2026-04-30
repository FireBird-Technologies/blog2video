import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BLOOMBERG_LAYOUT_REGISTRY } from "./layouts";
import type { BloombergLayoutProps, BloombergLayoutType } from "./types";
import { resolveFontFamily } from "../../fonts/registry";
import { LogoOverlay } from "../../components/LogoOverlay";
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

const ENTER_SEQUENCE = [0, 2, 1, 3, 0, 3, 2, 1, 3, 0, 1, 2];
const BOT_SEQUENCE   = [0, 1, 2, 1, 0, 2, 1, 0, 2, 0, 1, 2];

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

  let t = 0;
  if (isInEnter) {
    const sp = spring({ frame, fps, config: { stiffness: 28, damping: 22 } });
    t = interpolate(sp, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  } else if (isInExit) {
    const exitFrameOff = frame - (enterFrames + contentFrames);
    const sp = spring({ frame: exitFrameOff, fps, config: { stiffness: 40, damping: 18 } });
    t = interpolate(sp, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  }

  const enterStyle = ENTER_SEQUENCE[styleIndex % ENTER_SEQUENCE.length];
  let bodyTx = 0, bodyRotY = 0, bodyAlpha = 1, bodyScale = 1;

  if (isInExit) {
    bodyTx    = interpolate(t, [0, 1], [0, -width],  { extrapolateRight: "clamp" });
    bodyRotY  = interpolate(t, [0, 1], [0, 10],      { extrapolateRight: "clamp" });
    bodyAlpha = interpolate(t, [0, 0.5, 1], [1, 0.7, 0], { extrapolateRight: "clamp" });
    bodyScale = interpolate(t, [0, 1], [1, 0.93],    { extrapolateRight: "clamp" });
  } else if (isInEnter) {
    if (enterStyle === 0) {
      bodyTx    = interpolate(t, [0, 1], [width, 0],  { extrapolateRight: "clamp" });
      bodyRotY  = interpolate(t, [0, 1], [-10, 0],    { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.3, 1], [0, 0.6, 1], { extrapolateRight: "clamp" });
      bodyScale = interpolate(t, [0, 1], [0.95, 1],   { extrapolateRight: "clamp" });
    } else if (enterStyle === 1) {
      bodyScale = interpolate(t, [0, 1], [0.55, 1],                   { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.2, 0.7, 1], [0, 0.4, 0.9, 1], { extrapolateRight: "clamp" });
    } else if (enterStyle === 2) {
      bodyTx    = interpolate(t, [0, 1], [-width, 0], { extrapolateRight: "clamp" });
      bodyRotY  = interpolate(t, [0, 1], [10, 0],     { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.3, 1], [0, 0.6, 1], { extrapolateRight: "clamp" });
      bodyScale = interpolate(t, [0, 1], [0.95, 1],   { extrapolateRight: "clamp" });
    } else {
      bodyScale = interpolate(t, [0, 1], [0.9, 1],             { extrapolateRight: "clamp" });
      bodyAlpha = interpolate(t, [0, 0.5, 1], [0, 0.75, 1],   { extrapolateRight: "clamp" });
    }
  }

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

  const bodyZoneH = height - topBarH - botBarH;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>

      {/* ── BODY ZONE ── */}
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

const BarOverlay: React.FC<{ bgColor: string; textColor: string; aspectRatio: string }> = ({ bgColor, textColor, aspectRatio }) => {
  const { width } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const topH = isPortrait ? TOP_P : TOP_L;
  const botH = isPortrait ? BOT_P : BOT_L;
  const amber = textColor || BLOOMBERG_COLORS.amber;
  const { headerBg, border } = derivePalette(bgColor, amber);
  return (
    <>
      <div style={{
        position: "absolute",
        top: 0, left: 0, width, height: topH,
        backgroundColor: headerBg,
        zIndex: 999, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: 1, left: 0, width, height: 1,
        backgroundColor: `${amber}66`,
        zIndex: 1000, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: 3, left: 0, width, height: 1,
        background: `linear-gradient(90deg, ${amber}00, ${amber}55, ${amber}00)`,
        zIndex: 1000, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        top: topH - 2, left: 0, width, height: 2,
        backgroundColor: amber,
        zIndex: 1200, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, width, height: botH,
        backgroundColor: headerBg,
        zIndex: 999, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: botH - 1, left: 0, width, height: 1,
        backgroundColor: border,
        zIndex: 1000, pointerEvents: "none",
      }} />
    </>
  );
};

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: BloombergLayoutType;
  layoutProps: Record<string, any>;
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
  logoSize?: string;
  aspectRatio?: string;
  playbackSpeed?: number;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

export const calculateBloombergMetadata: CalculateMetadataFunction<VideoProps> =
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
      // Total = sum of content frames (transitions are overlapping, not additive)
      const totalFrames = sceneFrames.reduce((sum, f) => sum + f, 0);
      const isPortrait = data.aspectRatio === "portrait";
      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch {
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

const BLOOMBERG_PREVIEW_FALLBACK: VideoData = {
  projectName: "Bloomberg Terminal Preview",
  accentColor: "#5EA2FF",
  bgColor: "#000000",
  textColor: "#FFB340",
  scenes: [
    {
      id: 1,
      order: 1,
      title: "> System Ready",
      narration: "Bloomberg terminal session initialized.",
      layout: "terminal_boot",
      layoutProps: {},
      durationSeconds: 5,
      voiceoverFile: null,
      images: [],
    },
  ],
};

export const BloombergVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    const handle = delayRender("bloomberg-video-data");
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
    };

    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((json) => {
        setData(json as VideoData);
      })
      .catch(() => {
        setData(BLOOMBERG_PREVIEW_FALLBACK);
      })
      .finally(done);

    return () => {
      done();
    };
  }, [dataUrl]);

  const resolvedFontFamily = resolveFontFamily(data?.fontFamily ?? null);

  if (!data) {
    return <AbsoluteFill style={{ backgroundColor: BLOOMBERG_COLORS.bg }} />;
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const bg = data.bgColor || "#000000";
  const accent = data.accentColor || "#5EA2FF";
  const ratio = data.aspectRatio || "landscape";
  const isPortrait = ratio === "portrait";
  const topBarH = isPortrait ? TOP_P : TOP_L;
  const botBarH = isPortrait ? BOT_P : BOT_L;

  const contentFrames = data.scenes.map((s) =>
    getSceneDurationFrames(s.durationSeconds, FPS, playbackSpeed),
  );
  const startFrames: number[] = [];
  let cursor = 0;
  for (let i = 0; i < data.scenes.length; i++) {
    startFrames.push(cursor);
    cursor += contentFrames[i];
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {data.scenes.map((scene, index) => {
        const content = contentFrames[index];
        const isFirst = index === 0;
        const isLast = index === data.scenes.length - 1;

        const enterFrames = isFirst ? 0 : HALF;
        const exitFrames  = isLast  ? 0 : HALF;
        const seqDuration = enterFrames + content + exitFrames;
        const seqStart    = startFrames[index];

        const LayoutComponent =
          BLOOMBERG_LAYOUT_REGISTRY[scene.layout] ??
          BLOOMBERG_LAYOUT_REGISTRY.terminal_narrative;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        const lp = scene.layoutProps || {};
        const focusX = typeof lp.imageFocusX === "number" ? lp.imageFocusX : 50;
        const focusY = typeof lp.imageFocusY === "number" ? lp.imageFocusY : 50;
        const resolvedZoom = typeof lp.imageZoom === "number" ? Math.max(1, lp.imageZoom) : 1;

        const layoutProps: BloombergLayoutProps = {
          ...lp,
          title: scene.title,
          narration: scene.narration,
          accentColor: accent,
          bgColor: bg,
          textColor: data.textColor || "#FFB340",
          aspectRatio: ratio,
          imageUrl,
          imageObjectPosition: `${focusX}% ${focusY}%`,
          imageZoom: resolvedZoom,
          layoutType: scene.layout,
          fontFamily: resolvedFontFamily || undefined,
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
            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
            )}
          </Sequence>
        );
      })}

      {/* Single permanent bar overlay — outside every Sequence, never moves */}
      <BarOverlay bgColor={bg} textColor={data.textColor || "#FFB340"} aspectRatio={ratio} />

      {data.logo && (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          size={data.logoSize || "default"}
          aspectRatio={ratio}
        />
      )}
    </AbsoluteFill>
  );
};
