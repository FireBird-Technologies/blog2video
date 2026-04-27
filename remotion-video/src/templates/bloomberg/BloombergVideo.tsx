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

// Each transition half is 40 frames (1.33 s at 30 fps).
const HALF = 40;

// Single wrapper that handles enter + content + exit in one continuous Sequence.
// The layout component inside gets a monotonically-increasing useCurrentFrame(),
// so its own fade-in animation (frame 0→20) plays once during the enter phase
// and never resets — this eliminates the "appears → disappears → reappears" flicker.
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

// Legacy — kept but no longer used in BloombergVideo (SceneWithTransitions replaced them)
const ExitScene: React.FC<{
  bgColor: string;
  children: React.ReactNode;
  styleIndex: number;
}> = ({ bgColor, children, styleIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow, nearly-critically-damped spring — same as newspaper NewsTimeline exit
  const sp = spring({ frame, fps, config: { stiffness: 40, damping: 12 } });

  const opacity = interpolate(sp, [0, 0.40, 1], [1, 1, 0], { extrapolateRight: "clamp" });
  const motionBlur = interpolate(sp, [0, 0.35, 1], [0, 5, 0]);

  const style = styleIndex % 3;
  let tx = 0, ty = 0, scale = 1;
  if (style === 0) {
    // CRANE UP
    ty = interpolate(sp, [0, 1], [0, -40]);
    scale = interpolate(sp, [0, 1], [1.0, 0.96]);
  } else if (style === 1) {
    // PAN LEFT
    tx = interpolate(sp, [0, 1], [0, -90]);
    scale = interpolate(sp, [0, 1], [1.0, 0.97]);
  } else {
    // DOLLY OUT
    scale = interpolate(sp, [0, 1], [1.0, 0.91]);
    ty = interpolate(sp, [0, 1], [0, 18]);
  }

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor,
      overflow: "hidden",
      // opacity on outer wrapper — bg color and content fade together, no black flash
      opacity,
      transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
      transformOrigin: "50% 50%",
      filter: motionBlur > 0.3 ? `blur(${motionBlur.toFixed(1)}px)` : undefined,
      willChange: "transform, opacity, filter",
    }}>
      {children}
    </AbsoluteFill>
  );
};

// Matching enter styles — camera settles in from the complementary direction.
const EnterScene: React.FC<{
  bgColor: string;
  children: React.ReactNode;
  styleIndex: number;
}> = ({ bgColor, children, styleIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({ frame, fps, config: { stiffness: 55, damping: 14 } });

  // Opacity on outer wrapper — starts transparent so previous scene shows through cleanly
  const opacity = interpolate(sp, [0, 0.25, 1], [0, 0.7, 1], { extrapolateRight: "clamp" });
  const motionBlur = interpolate(sp, [0, 0.35, 1], [4, 4, 0]);

  const style = styleIndex % 3;
  let tx = 0, ty = 0, scale = 1;
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

  return (
    <AbsoluteFill style={{
      backgroundColor: bgColor,
      overflow: "hidden",
      // opacity on outer wrapper — starts transparent, previous scene shows through
      opacity,
      transform: `scale(${scale}) translateX(${tx}px) translateY(${ty}px)`,
      transformOrigin: "50% 50%",
      filter: motionBlur > 0.3 ? `blur(${motionBlur.toFixed(1)}px)` : undefined,
      willChange: "transform, opacity, filter",
    }}>
      {children}
    </AbsoluteFill>
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
    return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }

  const FPS = 30;
  const playbackSpeed = getPlaybackSpeed(data.playbackSpeed);
  const bg = data.bgColor || "#000000";
  const accent = data.accentColor || "#5EA2FF";

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
        const exitFrames = isLast ? 0 : HALF;

        // Single Sequence — no sub-sequences — layout's useCurrentFrame() never resets
        const seqDuration = enterFrames + content + exitFrames;
        const seqStart = startFrames[index]; // NO subtraction — enter overlaps prev exit

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
          aspectRatio: data.aspectRatio || "landscape",
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
            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} playbackRate={playbackSpeed} />
            )}
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
    </AbsoluteFill>
  );
};
