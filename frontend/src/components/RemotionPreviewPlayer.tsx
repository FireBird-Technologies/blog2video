/**
 * Live preview of AI-generated Remotion component code.
 * Compiles the code string with Babel and renders it in a Remotion Player.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { CustomTemplateTheme } from "../api/client";
import {
  compileComponentCode,
  type CompileResult,
  type SceneProps,
} from "../utils/compileComponent";

class PlayerErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void; width?: number | string },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: this.props.width || "100%", aspectRatio: "16/9", display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e", border: "1px solid #ef4444", borderRadius: 8, padding: 16, gap: 8 }}>
          <span style={{ color: "#ef4444", fontSize: 13 }}>Preview render error</span>
          <span style={{ color: "#9ca3af", fontSize: 11, maxWidth: "90%", textAlign: "center" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{this.state.error}</span>
          {this.props.onRetry && (
            <button onClick={() => { this.setState({ hasError: false, error: "" }); this.props.onRetry?.(); }} style={{ marginTop: 4, padding: "4px 12px", fontSize: 12, borderRadius: 4, border: "1px solid #6366f1", background: "transparent", color: "#6366f1", cursor: "pointer" }}>
              Retry
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  componentCode: string;
  theme: CustomTemplateTheme;
  width?: number;
  height?: number;
  /** Duration of this scene in seconds (default 5) */
  durationSeconds?: number;
  loop?: boolean;
  /** Override/extend the sample props passed to the compiled component */
  sampleProps?: Partial<SceneProps>;
  onError?: (error: string) => void;
  onRetry?: () => void;
  onEnded?: () => void;
}

// Minimal sample data per content type — rotated across preview instances
const CONTENT_TYPE_SAMPLES: Partial<SceneProps>[] = [
  { contentType: "bullets", bullets: ["Engaging visuals", "Brand consistency", "Professional quality"] },
  { contentType: "metrics", metrics: [{ value: "4.8M", label: "Views", suffix: "+" }, { value: "99.9", label: "Uptime", suffix: "%" }, { value: "150", label: "Countries" }] },
  { contentType: "quote", quote: "This platform transformed our content workflow.", quoteAuthor: "Sarah Chen, Head of Marketing" },
  { contentType: "timeline", timelineItems: [{ label: "2021", description: "Founded" }, { label: "2023", description: "1M users" }, { label: "2025", description: "Global expansion" }] },
  { contentType: "steps", steps: ["Paste your URL", "Choose a template", "Customize", "Export"] },
  { contentType: "code", codeLines: ["const video = await client.create({", "  url: 'https://blog.com/post',", "  template: 'modern'", "});"], codeLanguage: "typescript" },
  { contentType: "comparison", comparisonLeft: { label: "Before", description: "Manual editing, hours of work" }, comparisonRight: { label: "After", description: "AI-powered, minutes to create" } },
];

let _rotationIdx = 0;

const FPS = 30;

export default function RemotionPreviewPlayer({
  componentCode,
  theme,
  width,
  height,
  durationSeconds = 5,
  loop = true,
  sampleProps,
  onError,
  onRetry,
  onEnded,
}: Props) {
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(true);
  const playerRef = useRef<PlayerRef>(null);

  // Listen for 'ended' event via Remotion's ref-based emitter
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !onEnded) return;
    const handler = () => onEnded();
    player.addEventListener("ended", handler);
    return () => player.removeEventListener("ended", handler);
  }, [onEnded, compileResult]);

  const brandColors = useMemo(
    () => ({
      primary: theme.colors.accent,
      secondary: theme.colors.surface,
      accent: theme.colors.accent,
      background: theme.colors.bg,
      text: theme.colors.text,
    }),
    [theme.colors]
  );

  const compile = useCallback(async () => {
    console.log(`[F7-DEBUG] RemotionPreviewPlayer: compiling code (${componentCode.length} chars)...`);
    setIsCompiling(true);
    const result = await compileComponentCode(componentCode);
    setCompileResult(result);
    setIsCompiling(false);
    if (result.success) {
      console.log("[F7-DEBUG] RemotionPreviewPlayer: compilation SUCCESS");
    } else {
      console.error(`[F7-DEBUG] RemotionPreviewPlayer: compilation FAILED: ${result.error}`);
      if (onError) onError(result.error);
    }
  }, [componentCode, onError]);

  useEffect(() => {
    compile();
  }, [compile]);

  // Pick a rotating content type sample, merge with any parent-provided overrides
  // Must be before early returns to keep hook order stable
  const resolvedProps = useMemo<Omit<SceneProps, "brandColors">>(() => {
    const rotated = CONTENT_TYPE_SAMPLES[_rotationIdx++ % CONTENT_TYPE_SAMPLES.length];
    return {
      displayText: "Your Brand Story Comes to Life",
      narrationText: "Discover how your brand can stand out with unique video content.",
      // imageUrl left undefined so AI-generated code shows decorative elements;
      // parent can override via sampleProps.imageUrl with a real preview image.
      sceneIndex: 0,
      totalScenes: 3,
      aspectRatio: "landscape" as const,
      ...rotated,
      ...sampleProps,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isCompiling) {
    return (
      <div
        style={{
          width: width || "100%",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          borderRadius: 8,
          color: "#9ca3af",
          fontSize: 14,
        }}
      >
        Compiling preview...
      </div>
    );
  }

  if (!compileResult || !compileResult.success) {
    return (
      <div
        style={{
          width: width || "100%",
          aspectRatio: "16/9",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          border: "1px solid #ef4444",
          borderRadius: 8,
          padding: 16,
          gap: 8,
        }}
      >
        <span style={{ color: "#ef4444", fontSize: 13 }}>
          Preview compilation failed
        </span>
        <span
          style={{
            color: "#9ca3af",
            fontSize: 11,
            maxWidth: "90%",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {compileResult && !compileResult.success ? compileResult.error : "Unknown error"}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 4,
              padding: "4px 12px",
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid #6366f1",
              background: "transparent",
              color: "#6366f1",
              cursor: "pointer",
            }}
          >
            Regenerate
          </button>
        )}
      </div>
    );
  }

  const CompiledComponent = compileResult.component;

  // Wrapper composition for the Player
  const Composition: React.FC = () => (
    <CompiledComponent {...resolvedProps} brandColors={brandColors} />
  );

  return (
    <PlayerErrorBoundary onRetry={onRetry} width={width}>
      <Player
        ref={playerRef}
        component={Composition}
        compositionWidth={1920}
        compositionHeight={1080}
        durationInFrames={Math.max(FPS, Math.round(durationSeconds * FPS))}
        fps={FPS}
        style={{
          width: width || "100%",
          borderRadius: 8,
          overflow: "hidden",
        }}
        autoPlay
        loop={loop}
        controls={false}
      />
    </PlayerErrorBoundary>
  );
}
