import "../../../fonts/chronicle-defaults";
import { CHRONICLE_BODY_FONT } from "../../../fonts/chronicle-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { CHRONICLE_LAYOUT_REGISTRY } from "./layouts";
import type { ChronicleLayoutType, ChronicleLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { getPlaybackSpeed, getSceneDurationFrames } from "../playbackSpeed";
import { ChronicleChrome } from "./components/ChronicleChrome";

export interface ChronicleSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface ChronicleVideoCompositionProps {
  scenes: ChronicleSceneInput[];
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

// book_open owns its own dramatic opening animation; every other layout
// just gets a subtle chrome fade-in. No per-scene rotation.
const LAYOUTS_WITHOUT_CHROME_FADE = new Set<ChronicleLayoutType>(["book_open"]);

export const ChronicleVideoComposition: React.FC<ChronicleVideoCompositionProps> = ({
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
  const fallbackFontFamily = fontFamily || CHRONICLE_BODY_FONT;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || "#F1E4C9",
        fontFamily: fallbackFontFamily,
      }}
    >
      {scenes.map((scene, index) => {
        const startFrame = scenes
          .slice(0, index)
          .reduce(
            (acc, s) =>
              acc +
              getSceneDurationFrames(s.durationSeconds, FPS, resolvedPlaybackSpeed),
            0,
          );
        const durationFrames = getSceneDurationFrames(
          scene.durationSeconds,
          FPS,
          resolvedPlaybackSpeed,
        );

        const layoutKey = (scene.layout as ChronicleLayoutType) in CHRONICLE_LAYOUT_REGISTRY
          ? (scene.layout as ChronicleLayoutType)
          : "parchment_scroll";
        const LayoutComponent = CHRONICLE_LAYOUT_REGISTRY[layoutKey];

        const rawProps = (scene.layoutProps ?? {}) as Record<string, unknown>;
        const focusX = Math.max(0, Math.min(100, Number(rawProps.imageFocusX ?? 50)));
        const focusY = Math.max(0, Math.min(100, Number(rawProps.imageFocusY ?? 50)));

        const layoutProps: ChronicleLayoutProps = {
          ...(rawProps as Partial<ChronicleLayoutProps>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          imageObjectPosition: `${focusX}% ${focusY}%`,
          imageZoom: Math.max(1, Number(rawProps.imageZoom ?? 1)),
          accentColor: accentColor || "#B8860B",
          bgColor: bgColor || "#F1E4C9",
          textColor: textColor || "#2A1810",
          aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
          fontFamily,
        };

        const skipFade = LAYOUTS_WITHOUT_CHROME_FADE.has(layoutKey);

        return (
          <Sequence
            key={`${scene.id}-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <AbsoluteFill>
              <ChronicleChrome
                bgColor={bgColor || "#F1E4C9"}
                accentColor={accentColor || "#B8860B"}
                textColor={textColor || "#2A1810"}
                disablePageTurn={skipFade}
              >
                <LayoutComponent {...layoutProps} />
              </ChronicleChrome>
              {scene.voiceoverUrl && (
                <Audio src={scene.voiceoverUrl} playbackRate={resolvedPlaybackSpeed} />
              )}
            </AbsoluteFill>
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
