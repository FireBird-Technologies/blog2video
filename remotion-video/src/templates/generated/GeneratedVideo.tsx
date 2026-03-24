/**
 * GeneratedVideo — Remotion composition for AI-generated custom templates.
 *
 * Renders AI-generated React components written per-brand. The generated code
 * files are overwritten in the render workspace with actual generated code
 * before Remotion bundles.
 *
 * Scene type mapping:
 *   - Scene 0 (first scene)  → Intro component
 *   - Scene N (last scene)   → Outro component
 *   - Content scenes         → Cycle through N unique content variants
 *
 * The contentVariantIndex field on each scene (from data.json) assigns which
 * content variant to use. Scenes cycle through variants for visual variety.
 */
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  CalculateMetadataFunction,
  delayRender,
  continueRender,
} from "remotion";
import { LogoOverlay } from "../../components/LogoOverlay";
import { resolveFontFamily } from "../../fonts/registry";
import type { GeneratedVideoData, GeneratedSceneData, GeneratedSceneProps } from "./types";

// Static imports — these files are placeholder stubs in the repo but get
// overwritten with actual AI-generated code in the render workspace.
import IntroScene from "./SceneIntro";
import OutroScene from "./SceneOutro";

// Content variant registry — generated at render time by remotion.py
// In the repo this file exports an empty array; at render time it's overwritten
// with imports of SceneContent0, SceneContent1, etc.
import { CONTENT_VARIANTS } from "./contentRegistry";

// ─── Types ───────────────────────────────────────────────────

interface VideoProps extends Record<string, unknown> {
  dataUrl: string;
}

const FPS = 30;

// ─── Metadata ─────────────────────────────────────────────────

export const calculateGeneratedMetadata: CalculateMetadataFunction<VideoProps> =
  async ({ props }) => {
    try {
      const url = staticFile(props.dataUrl.replace(/^\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const data: GeneratedVideoData = await res.json();

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
      console.warn("calculateGeneratedMetadata fallback:", e);
      return {
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      };
    }
  };

// ─── Scene type resolution ────────────────────────────────────

function getSceneComponent(
  scene: GeneratedSceneData,
  index: number,
  totalScenes: number,
): React.FC<GeneratedSceneProps> {
  // Determine scene type
  const sceneType =
    scene.sceneType ||
    (index === 0
      ? "intro"
      : index === totalScenes - 1 && totalScenes > 1
        ? "outro"
        : "content");

  if (sceneType === "intro") return IntroScene;
  if (sceneType === "outro") return OutroScene;

  // Content scene — pick variant by contentVariantIndex (cycling through available variants)
  if (CONTENT_VARIANTS.length > 0) {
    const variantIdx =
      scene.contentVariantIndex !== undefined
        ? scene.contentVariantIndex % CONTENT_VARIANTS.length
        : index % CONTENT_VARIANTS.length;
    return CONTENT_VARIANTS[variantIdx];
  }

  // Fallback: no content variants available, use intro
  return IntroScene;
}

// ─── Composition ───────────────────────────────────────────────

export const GeneratedVideo: React.FC<VideoProps> = ({ dataUrl }) => {
  const [data, setData] = useState<GeneratedVideoData | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [fontHandle] = useState(() =>
    delayRender("Loading fonts for generated video", {
      timeoutInMilliseconds: 15_000,
    }),
  );

  useEffect(() => {
    setFontsReady(false);
    setData(null);

    const finishFontLoad = () => {
      setFontsReady(true);
      continueRender(fontHandle);
    };

    fetch(staticFile(dataUrl.replace(/^\//, "")))
      .then((res) => res.json())
      .then((d: GeneratedVideoData) => {
        setData(d);

        // Try project-level font first
        const resolvedProjectFont = resolveFontFamily(d.fontFamily ?? null);
        if (resolvedProjectFont) {
          Promise.all([
            document.fonts.load(`400 16px ${resolvedProjectFont}`),
            document.fonts.load(`700 16px ${resolvedProjectFont}`),
          ])
            .then(() => document.fonts.ready)
            .then(() => finishFontLoad())
            .catch(() => finishFontLoad());
          return;
        }

        // No custom font — just finish
        finishFontLoad();
      })
      .catch(() => {
        // Emergency fallback data
        setData({
          projectName: "Generated Preview",
          accentColor: "#7C3AED",
          bgColor: "#FFFFFF",
          textColor: "#1A1A2E",
          scenes: [
            {
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "Generated template preview.",
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            },
          ],
        });
        setFontsReady(true);
        continueRender(fontHandle);
      });
  }, [dataUrl, fontHandle]);

  const resolvedFontFamily = resolveFontFamily(data?.fontFamily ?? null);

  if (!data || !fontsReady) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p
          style={{
            color: "#666",
            fontSize: 28,
            fontFamily: resolvedFontFamily ?? "Inter, sans-serif",
          }}
        >
          Loading...
        </p>
      </AbsoluteFill>
    );
  }

  // Build brand colors from data
  const brandColors: GeneratedSceneProps["brandColors"] = data.brandColors || {
    primary: data.accentColor || "#7C3AED",
    secondary: "#F5F5F5",
    accent: data.accentColor || "#7C3AED",
    background: data.bgColor || "#FFFFFF",
    text: data.textColor || "#1A1A2E",
  };

  let currentFrame = 0;
  const totalScenes = data.scenes.length;

  console.log(
    `[GeneratedVideo] Rendering ${totalScenes} scenes with ${CONTENT_VARIANTS.length} content variants`,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brandColors.background,
        fontFamily: resolvedFontFamily || undefined,
      }}
    >
      {data.scenes.map((scene, index) => {
        const durationFrames = Math.max(
          1,
          Math.round((Number(scene.durationSeconds) || 5) * FPS),
        );
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const SceneComp = getSceneComponent(scene, index, totalScenes);
        const imageUrl =
          scene.images.length > 0 ? staticFile(scene.images[0]) : undefined;

        // Spread structured content (bullets, metrics, quotes, etc.) onto scene props
        const sc = (scene.structuredContent || {}) as Record<string, unknown>;
        const sceneProps: GeneratedSceneProps = {
          displayText: scene.displayText || scene.narration || scene.title,
          narrationText: scene.narrationText || scene.narration || "",
          imageUrl,
          sceneIndex: index,
          totalScenes,
          logoUrl: data.logo ? staticFile(data.logo) : undefined,
          brandImages: data.brandImages?.map((f) => staticFile(f)),
          brandColors,
          aspectRatio: (data.aspectRatio as "landscape" | "portrait") || "landscape",
          contentType: sc.contentType as GeneratedSceneProps["contentType"],
          bullets: sc.bullets as string[] | undefined,
          metrics: sc.metrics as GeneratedSceneProps["metrics"],
          codeLines: sc.codeLines as string[] | undefined,
          codeLanguage: sc.codeLanguage as string | undefined,
          quote: sc.quote as string | undefined,
          quoteAuthor: sc.quoteAuthor as string | undefined,
          comparisonLeft: sc.comparisonLeft as GeneratedSceneProps["comparisonLeft"],
          comparisonRight: sc.comparisonRight as GeneratedSceneProps["comparisonRight"],
          timelineItems: sc.timelineItems as GeneratedSceneProps["timelineItems"],
          steps: sc.steps as string[] | undefined,
          titleFontSize: scene.layoutConfig?.titleFontSize as number | undefined,
          descriptionFontSize: scene.layoutConfig?.descriptionFontSize as number | undefined,
        };

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={durationFrames}
            name={scene.title}
          >
            <SceneComp {...sceneProps} />
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
