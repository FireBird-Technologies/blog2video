import "../../../fonts/newspaper-defaults";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { NEWSPAPER_LAYOUT_REGISTRY } from "./layouts";
import type { NewspaperLayoutType, BlogLayoutProps } from "./types";
import { LogoOverlay } from "../LogoOverlay";

export interface NewspaperSceneInput {
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

export interface NewspaperVideoCompositionProps {
  scenes: NewspaperSceneInput[];
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

export const NewspaperVideoComposition: React.FC<
  NewspaperVideoCompositionProps
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
}) => {
  const FPS = 30;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor || "#FAFAF8", fontFamily }}>
      {scenes.map((scene, index) => {
        // --- STABLE FRAME CALCULATION ---
        // Calculate the start frame by summing durations of all previous scenes
        const startFrame = scenes
          .slice(0, index)
          .reduce((acc, s) => acc + Math.max(1, Math.round(s.durationSeconds * FPS)), 0);

        const durationFrames = Math.max(
          1,
          Math.round(scene.durationSeconds * FPS)
        );

        const LayoutComponent =
          NEWSPAPER_LAYOUT_REGISTRY[scene.layout as NewspaperLayoutType] ||
          NEWSPAPER_LAYOUT_REGISTRY.article_lead;

        const layoutProps: BlogLayoutProps = {
          ...(scene.layoutProps as Partial<BlogLayoutProps>),
          title: scene.title,
          narration: scene.narration,
          imageUrl: scene.imageUrl,
          accentColor: accentColor || "#FFE34D",
          bgColor: bgColor || "#FAFAF8",
          textColor: textColor || "#111111",
          aspectRatio: (aspectRatio as "landscape" | "portrait") || "landscape",
          fontFamily,
        };

        return (
          <Sequence
            // Use a stable key + index to prevent remounting
            key={`${scene.id}-${index}`} 
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            {/* IMPORTANT: Wrap in a div to ensure the LayoutComponent 
               receives a fresh coordinate system from the Sequence 
            */}
            <AbsoluteFill>
               <LayoutComponent {...layoutProps} />
               {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
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