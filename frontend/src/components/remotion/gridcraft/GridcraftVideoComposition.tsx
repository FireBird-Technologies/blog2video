import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import { GRIDCRAFT_LAYOUT_REGISTRY } from "./layouts";
import type { GridcraftLayoutType, GridcraftLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";
import { Blobs } from "./components/Blobs";
import { COLORS } from "./utils/styles";

// Modern slide-up wipe transition for gridcraft
const GridcraftTransition: React.FC<{ bgColor?: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();

  const slideY = interpolate(frame, [0, 12], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor || COLORS.BG,
        opacity,
        transform: `translateY(${slideY}%)`,
        zIndex: 10,
      }}
    />
  );
};

export interface GridcraftSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: GridcraftLayoutType;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface GridcraftVideoCompositionProps {
  scenes: GridcraftSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  logoSize?: number;
  aspectRatio?: string;
}

export const GridcraftVideoComposition: React.FC<
  GridcraftVideoCompositionProps
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
}) => {
  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || COLORS.BG }}>
      <Blobs />

      {scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          GRIDCRAFT_LAYOUT_REGISTRY[scene.layout] ||
          GRIDCRAFT_LAYOUT_REGISTRY.editorial_body;

        const layoutProps: GridcraftLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: accentColor || COLORS.ACCENT,
          bgColor: bgColor || COLORS.BG,
          textColor: textColor || COLORS.DARK,
          aspectRatio: aspectRatio || "landscape",
          imageUrl: scene.imageUrl,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            {/* Layout Container with Z-Index to sit above Blobs */}
            <AbsoluteFill style={{ zIndex: 1 }}>
              <LayoutComponent {...layoutProps} />
            </AbsoluteFill>
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
            {index < scenes.length - 1 && (
              <Sequence from={durationFrames - 15} durationInFrames={15}>
                <GridcraftTransition bgColor={bgColor || COLORS.BG} />
              </Sequence>
            )}
          </Sequence>
        );
      })}

      {logo && (
        <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
          <LogoOverlay
            src={logo}
            position={logoPosition || "bottom_right"}
            maxOpacity={logoOpacity ?? 0.9}
            size={logoSize ?? 100}
            aspectRatio={aspectRatio || "landscape"}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
