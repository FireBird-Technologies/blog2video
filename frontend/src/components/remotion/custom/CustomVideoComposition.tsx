import { AbsoluteFill, Audio, Sequence } from "remotion";
import { UniversalScene } from "./UniversalScene";
import type { CustomTheme, SceneLayoutConfig } from "./types";
import { LogoOverlay } from "../LogoOverlay";

/** Default theme used when data.json has no theme object. */
const FALLBACK_THEME: CustomTheme = {
  colors: {
    accent: "#7C3AED",
    bg: "#FFFFFF",
    text: "#1A1A2E",
    surface: "#F5F5F5",
    muted: "#9CA3AF",
  },
  fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
  borderRadius: 12,
  style: "minimal",
  animationPreset: "slide",
  category: "general",
  patterns: {
    cards: { corners: "rounded", shadowDepth: "subtle", borderStyle: "thin" },
    spacing: { density: "balanced", gridGap: 20 },
    images: { treatment: "rounded", overlay: "none", captionStyle: "below" },
    layout: { direction: "centered", decorativeElements: ["none"] },
  },
};

/**
 * EMERGENCY fallback — should NEVER be used in production.
 * If you see "MISSING layoutConfig" warnings in console, the pipeline
 * failed to generate or preserve layoutConfig for this scene.
 */
const EMERGENCY_FALLBACK_CONFIG: SceneLayoutConfig = {
  arrangement: "full-center",
  elements: [
    { type: "heading", content: {}, emphasis: "primary" },
    { type: "body-text", content: {}, emphasis: "secondary" },
  ],
  decorations: ["accent-bar-bottom"],
};

export interface CustomSceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layoutConfig?: SceneLayoutConfig;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export interface CustomVideoCompositionProps {
  scenes: CustomSceneInput[];
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
  theme?: CustomTheme;
}

export const CustomVideoComposition: React.FC<CustomVideoCompositionProps> = ({
  scenes,
  accentColor,
  bgColor,
  textColor,
  logo,
  logoPosition,
  logoOpacity,
  aspectRatio,
  theme: rawTheme,
}) => {
  const FPS = 30;
  let currentFrame = 0;

  const theme: CustomTheme = rawTheme
    ? rawTheme
    : {
        ...FALLBACK_THEME,
        colors: {
          ...FALLBACK_THEME.colors,
          accent: accentColor || FALLBACK_THEME.colors.accent,
          bg: bgColor || FALLBACK_THEME.colors.bg,
          text: textColor || FALLBACK_THEME.colors.text,
        },
      };

  // Debug: trace theme + scene data flowing into the composition
  const scenesWithConfig = scenes.filter(s => s.layoutConfig).length;
  const scenesWithout = scenes.length - scenesWithConfig;
  console.log(`[CustomVideoComposition] theme source: ${rawTheme ? "from data.json ✅" : "⚠️ FALLBACK_THEME (no theme in data)"}`);
  console.log("[CustomVideoComposition] theme:", { style: theme.style, colors: theme.colors, fonts: theme.fonts, density: theme.patterns?.spacing?.density, gridGap: theme.patterns?.spacing?.gridGap });
  console.log(`[CustomVideoComposition] scenes: ${scenes.length} total | ${scenesWithConfig} with layoutConfig | ${scenesWithout} WITHOUT layoutConfig`);
  if (scenesWithout > 0) {
    console.error(`[CustomVideoComposition] ❌ ${scenesWithout} scenes are MISSING layoutConfig — they will use emergency fallback. This is a pipeline bug.`);
  }
  scenes.forEach((s, i) => {
    const lc = s.layoutConfig;
    if (lc) {
      console.log(`[CustomVideoComposition] scene ${i} ✅: arrangement=${lc.arrangement}, elements=${lc.elements?.length}, decorations=${JSON.stringify(lc.decorations)}, titleFontSize=${lc.titleFontSize ?? "default"}, descFontSize=${lc.descriptionFontSize ?? "default"}`);
    } else {
      console.error(`[CustomVideoComposition] scene ${i} ❌: NO layoutConfig — title="${s.title}", has imageUrl=${!!s.imageUrl}`);
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      {scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        if (!scene.layoutConfig) {
          console.error(`[CustomVideoComposition] ❌ MISSING layoutConfig for scene ${scene.id} ("${scene.title}") — pipeline bug! Using emergency fallback.`);
        }
        const config = scene.layoutConfig || EMERGENCY_FALLBACK_CONFIG;

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <UniversalScene
              config={config}
              theme={theme}
              title={scene.title}
              narration={scene.narration}
              imageUrl={scene.imageUrl}
              aspectRatio={aspectRatio || "landscape"}
            />
            {scene.voiceoverUrl && <Audio src={scene.voiceoverUrl} />}
          </Sequence>
        );
      })}

      {logo && (
        <LogoOverlay
          src={logo}
          position={logoPosition || "bottom_right"}
          maxOpacity={logoOpacity ?? 0.9}
          aspectRatio={aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
