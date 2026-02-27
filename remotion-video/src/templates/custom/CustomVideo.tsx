import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
} from "remotion";
import { UniversalScene } from "./UniversalScene";
import type { CustomTheme, SceneLayoutConfig } from "./types";
import { getFontUrl } from "./utils/styleEngine";
import { LogoOverlay } from "../../components/LogoOverlay";
import { delayRender, continueRender } from "remotion";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layoutConfig?: SceneLayoutConfig;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}

interface VideoData {
  projectName: string;
  heroImage?: string | null;
  accentColor: string;
  bgColor: string;
  textColor: string;
  logo?: string | null;
  logoPosition?: string;
  logoOpacity?: number;
  aspectRatio?: string;
  scenes: SceneData[];
  theme?: CustomTheme;
}

interface VideoProps {
  dataUrl: string;
}

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

// ─── Metadata ─────────────────────────────────────────────────

export const calculateCustomMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const totalSeconds = data.scenes.reduce(
        (sum, s) => sum + (s.durationSeconds || 5),
        0,
      );
      const totalFrames = Math.ceil((totalSeconds + 2) * FPS);
      const isPortrait = data.aspectRatio === "portrait";

      return {
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: isPortrait ? 1080 : 1920,
        height: isPortrait ? 1920 : 1080,
      };
    } catch (e) {
      console.warn("calculateCustomMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const CustomVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);
  const [fontHandle] = useState(() =>
    delayRender("Loading custom fonts", { timeoutInMilliseconds: 15_000 }),
  );

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((d: VideoData) => {
        setData(d);

        const theme = d.theme || FALLBACK_THEME;
        const fontUrl = getFontUrl(theme);
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = fontUrl;
        link.onload = () => {
          const faces = [
            `700 16px '${theme.fonts.heading}'`,
            `400 16px '${theme.fonts.body}'`,
            `400 16px '${theme.fonts.mono}'`,
          ];
          Promise.all(faces.map((f) => document.fonts.load(f)))
            .then(() => document.fonts.ready)
            .then(() => continueRender(fontHandle))
            .catch(() => continueRender(fontHandle));
        };
        link.onerror = () => continueRender(fontHandle);
        document.head.appendChild(link);
      })
      .catch(() => {
        setData({
          projectName: "Custom Preview",
          accentColor: "#7C3AED",
          bgColor: "#FFFFFF",
          textColor: "#1A1A2E",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "Custom template preview.",
              layoutConfig: EMERGENCY_FALLBACK_CONFIG,
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
        continueRender(fontHandle);
      });
  }, [dataUrl, fontHandle]);

  if (!data) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#666", fontSize: 28, fontFamily: "Inter, sans-serif" }}>
          Loading...
        </p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  let currentFrame = 0;

  const theme: CustomTheme = data.theme
    ? data.theme
    : {
        ...FALLBACK_THEME,
        colors: {
          ...FALLBACK_THEME.colors,
          accent: data.accentColor || FALLBACK_THEME.colors.accent,
          bg: data.bgColor || FALLBACK_THEME.colors.bg,
          text: data.textColor || FALLBACK_THEME.colors.text,
        },
      };

  // Debug: trace theme and scene config during render
  const scenesWithConfig = data.scenes.filter(s => s.layoutConfig).length;
  const scenesWithout = data.scenes.length - scenesWithConfig;
  console.log(`[CustomVideo] theme source: ${data.theme ? "from data.json ✅" : "⚠️ FALLBACK_THEME"}`);
  console.log("[CustomVideo] theme:", { style: theme.style, colors: theme.colors, fonts: theme.fonts, density: theme.patterns?.spacing?.density, gridGap: theme.patterns?.spacing?.gridGap });
  console.log(`[CustomVideo] scenes: ${data.scenes.length} total | ${scenesWithConfig} with layoutConfig | ${scenesWithout} WITHOUT`);
  if (scenesWithout > 0) {
    console.error(`[CustomVideo] ❌ ${scenesWithout} scenes MISSING layoutConfig — pipeline bug!`);
  }
  data.scenes.forEach((s, i) => {
    const lc = s.layoutConfig;
    if (lc) {
      console.log(`[CustomVideo] scene ${i} ✅: arrangement=${lc.arrangement}, elements=${lc.elements?.length}, decorations=${JSON.stringify(lc.decorations)}`);
    } else {
      console.error(`[CustomVideo] scene ${i} ❌: NO layoutConfig — title="${s.title}"`);
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      {data.scenes.map((scene) => {
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        if (!scene.layoutConfig) {
          console.error(`[CustomVideo] ❌ MISSING layoutConfig for scene ${scene.id} — pipeline bug!`);
        }
        const config = scene.layoutConfig || EMERGENCY_FALLBACK_CONFIG;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

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
              imageUrl={imageUrl}
              aspectRatio={data.aspectRatio || "landscape"}
            />
            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} />
            )}
          </Sequence>
        );
      })}

      {data.logo && (
        <LogoOverlay
          src={staticFile(data.logo)}
          position={data.logoPosition || "bottom_right"}
          maxOpacity={data.logoOpacity ?? 0.9}
          aspectRatio={data.aspectRatio || "landscape"}
        />
      )}
    </AbsoluteFill>
  );
};
