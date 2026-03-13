import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  CalculateMetadataFunction,
} from "remotion";
import { GRIDCRAFT_LAYOUT_REGISTRY } from "./layouts";
import {
  GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
} from "./constants";
import { resolveFontFamily } from "../../fonts/registry";
import type { GridcraftLayoutType, GridcraftLayoutProps } from "./types";
import { LogoOverlay } from "../../components/LogoOverlay";
import { Blobs } from "./components/Blobs";
import { COLORS } from "./utils/styles";

// ─── Types ───────────────────────────────────────────────────

interface SceneData {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: GridcraftLayoutType;
  layoutProps: Record<string, any>;
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
  logoSize?: string;
  aspectRatio?: string;
  fontFamily?: string | null;
  scenes: SceneData[];
}

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

// Modern slide-up wipe transition for gridcraft
const GridcraftTransition: React.FC<{ bgColor?: string }> = ({ bgColor }) => {
  const frame = useCurrentFrame();

  // Slide up from bottom with smooth easing
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

// ─── Metadata ─────────────────────────────────────────────────

export const calculateGridcraftMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    const FPS = 30;
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: VideoData = await res.json();

      const totalSeconds = data.scenes.reduce(
        (sum, s) => sum + (s.durationSeconds || 5),
        0
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
      console.warn("calculateGridcraftMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Composition ───────────────────────────────────────────────

export const GridcraftVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {
    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {
        setData({
          projectName: "Gridcraft Showcase",
          accentColor: COLORS.ACCENT,
          bgColor: COLORS.BG,
          textColor: COLORS.DARK,
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome to Gridcraft",
              narration: "A dynamic, glassmorphism-styled video template.",
              layout: "bento_hero",
              layoutProps: {
                version: "2.0",
                subtitle: "Template Showcase"
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 2,
              order: 2,
              title: "Smart Features",
              narration: "Layouts adapt automatically to your content.",
              layout: "bento_features",
              layoutProps: {
                features: [
                  { icon: "⚡️", label: "Fast", description: "Renders in seconds" },
                  { icon: "🎨", label: "Stylish", description: "Glassmorphism aesthetics" },
                  { icon: "📱", label: "Responsive", description: "Fits any aspect ratio" },
                ]
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 3,
              order: 3,
              title: "Highlight Key Points",
              narration: "Focus on what matters most with the Highlight layout.",
              layout: "bento_highlight",
              layoutProps: {
                mainPoint: "95% Faster",
                supportingFacts: ["Zero Latency", "Global Edge", "Instant Cache"]
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 4,
              order: 4,
              title: "Editorial Layout",
              narration: "Perfect for long-form text and storytelling.",
              layout: "editorial_body",
              layoutProps: {},
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 5,
              order: 5,
              title: "Data Visualization",
              narration: "Showcase your metrics with the KPI Grid.",
              layout: "kpi_grid",
              layoutProps: {
                 dataPoints: [
                    { label: "Active Users", value: "10k+", trend: "up" },
                    { label: "Retention", value: "95%", trend: "up" },
                    { label: "Churn", value: "<1%", trend: "down" }
                 ]
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 6,
              order: 6,
              title: "Comparison",
              narration: "Compare before and after scenarios effectively.",
              layout: "bento_compare",
              layoutProps: {
                leftLabel: "Before",
                rightLabel: "After",
                dataPoints: [
                    { label: "Old", title: "Slow & Static", description: "Manual updates required." },
                    { label: "New", title: "Dynamic & Fast", description: "Automated generation." }
                ],
                verdict: "10x Productivity Boost"
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 7,
              order: 7,
              title: "Code Snippets",
              narration: "Display syntax-highlighted code blocks.",
              layout: "bento_code",
              layoutProps: {
                 codeSnippet: `const grid = new Grid();\ngrid.render();\n// It's that simple!`,
                 codeLanguage: "TypeScript"
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 8,
              order: 8,
              title: "Pull Quotes",
              narration: "Emphasize powerful statements.",
              layout: "pull_quote",
              layoutProps: {
                  title: "Design is not just what it looks like and feels like. Design is how it works.",
                  subtitle: "Steve Jobs"
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
            {
              id: 9,
              order: 9,
              title: "Process Steps",
              narration: "Walk through complex workflows step-by-step.",
              layout: "bento_steps",
              layoutProps: {
                  dataPoints: [
                      { label: "Plan", description: "Define goals" },
                      { label: "Build", description: "Develop features" },
                      { label: "Launch", description: "Go live" }
                  ]
              },
              durationSeconds: 4,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
      });
  }, [dataUrl]);

  const resolvedFontFamily = data
    ? resolveFontFamily(data.fontFamily ?? null)
    : null;

  if (!data) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            color: COLORS.DARK,
            fontSize: 36,
            fontFamily:
              resolvedFontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
          }}
        >
          Loading...
        </p>
      </AbsoluteFill>
    );
  }

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: data.bgColor || COLORS.BG,
        fontFamily:
          resolvedFontFamily ?? GRIDCRAFT_DEFAULT_SANS_FONT_FAMILY,
      }}
    >
      <Blobs />
      
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const LayoutComponent =
          GRIDCRAFT_LAYOUT_REGISTRY[scene.layout] ||
          GRIDCRAFT_LAYOUT_REGISTRY.editorial_body;

        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        // IMPORTANT: Ensure computed imageUrl wins over any stale scene.layoutProps.imageUrl
        const layoutProps: GridcraftLayoutProps = {
          ...scene.layoutProps,
          title: scene.title,
          narration: scene.narration,
          accentColor: data.accentColor || COLORS.ACCENT,
          bgColor: data.bgColor || COLORS.BG,
          textColor: data.textColor || COLORS.DARK,
          aspectRatio: data.aspectRatio || "landscape",
          imageUrl,
          fontFamily: resolvedFontFamily || undefined,
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

            {scene.voiceoverFile && (
              <Audio src={staticFile(scene.voiceoverFile)} />
            )}

            {index < data.scenes.length - 1 && (
              <Sequence from={durationFrames - 15} durationInFrames={15}>
                <GridcraftTransition bgColor={data.bgColor || COLORS.BG} />
              </Sequence>
            )}
          </Sequence>
        );
      })}

      {data.logo && (
        <AbsoluteFill style={{ zIndex: 20, pointerEvents: "none" }}>
            <LogoOverlay
            src={staticFile(data.logo)}
            position={data.logoPosition || "bottom_right"}
            maxOpacity={data.logoOpacity ?? 0.9}
            size={data.logoSize || "default"}
            aspectRatio={data.aspectRatio || "landscape"}
            />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
