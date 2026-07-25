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
  componentCode?: string;
  compiledComponent?: React.FC<SceneProps>;
  compiledComposition?: React.ComponentType<any>;
  theme: CustomTemplateTheme;
  width?: number;
  height?: number;
  /** Duration of this scene in seconds (default 5) */
  durationSeconds?: number;
  loop?: boolean;
  /** Override/extend the sample props passed to the compiled component */
  sampleProps?: Partial<SceneProps>;
  compositionProps?: Record<string, unknown>;
  compositionWidth?: number;
  compositionHeight?: number;
  fps?: number;
  durationInFrames?: number;
  onError?: (error: string) => void;
  onRetry?: () => void;
  onEnded?: () => void;
  /** Continuous-composition mode: report the player's current frame so the parent
   *  can highlight which scene is on-screen (the Edit-Template scene strip). */
  onFrameUpdate?: (frame: number) => void;
  thumbnailMode?: boolean;
  thumbnailFrame?: number;
}

const FPS = 30;

export default function RemotionPreviewPlayer({
  componentCode,
  compiledComponent,
  compiledComposition,
  theme,
  width,
  height,
  durationSeconds = 5,
  loop = true,
  sampleProps,
  compositionProps,
  compositionWidth = 1920,
  compositionHeight = 1080,
  fps = FPS,
  durationInFrames,
  onError,
  onRetry,
  onEnded,
  onFrameUpdate,
  thumbnailMode = false,
  thumbnailFrame = 100,
}: Props) {
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(true);
  const playerRef = useRef<PlayerRef>(null);

  // Listen for 'ended' event via Remotion's ref-based emitter
  useEffect(() => {
    if (thumbnailMode) return;
    const player = playerRef.current;
    if (!player || !onEnded) return;
    const handler = () => onEnded();
    player.addEventListener("ended", handler);
    return () => player.removeEventListener("ended", handler);
  }, [onEnded, compileResult, thumbnailMode]);

  // Report current frame to the parent (continuous-composition scene strip).
  useEffect(() => {
    if (thumbnailMode || !onFrameUpdate) return;
    const player = playerRef.current;
    if (!player) return;
    const onFrame = () => onFrameUpdate(player.getCurrentFrame());
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [thumbnailMode, onFrameUpdate, compileResult, compiledComposition]);

  const playerDurationInFrames =
    durationInFrames ?? Math.max(fps, Math.round(durationSeconds * fps));

  // Remotion requires 0 <= frame <= durationInFrames - 1, so a thumbnailFrame at
  // or past the composition length (e.g. 150 on a 150-frame preview) must be
  // clamped to the last real frame rather than throwing a render error.
  const clampedThumbnailFrame = Math.max(
    0,
    Math.min(thumbnailFrame, playerDurationInFrames - 1),
  );

  // In thumbnail mode, jump straight to the target frame and freeze there.
  //
  // We seek rather than letting playback run to `thumbnailFrame`: waiting for
  // real-time playback would take thumbnailFrame/fps seconds (5s at frame 150),
  // and the poster capture screenshots well before that — which made the frame
  // value effectively ignored. Seeking makes the frozen frame deterministic and
  // immediate. `window.__previewFrameSettled` lets the capture route wait for
  // this before signalling readiness.
  useEffect(() => {
    if (!thumbnailMode) return;
    const player = playerRef.current;
    if (!player) return;
    const w = window as unknown as { __previewFrameSettled?: boolean };
    w.__previewFrameSettled = false;
    let cancelled = false;
    // Seek on the next frames so the player has mounted its composition.
    const settle = () => {
      if (cancelled) return;
      try {
        player.pause();
        player.seekTo(clampedThumbnailFrame);
        w.__previewFrameSettled = true;
      } catch {
        // Player not ready yet — retry on the next animation frame.
        requestAnimationFrame(settle);
      }
    };
    const raf = requestAnimationFrame(() => requestAnimationFrame(settle));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [thumbnailMode, clampedThumbnailFrame, compileResult]);

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

  // Load Google Fonts for theme's heading and body fonts
  useEffect(() => {
    const fonts = new Set([theme.fonts.heading, theme.fonts.body].filter(Boolean));
    fonts.forEach((fontName) => {
      const id = `gfont-${fontName.replace(/\s+/g, "-")}`;
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700;800&display=swap`;
      document.head.appendChild(link);
    });
  }, [theme.fonts.heading, theme.fonts.body]);

  const compile = useCallback(async () => {
    if (!componentCode) return;
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
    if (compiledComposition) {
      setCompileResult(null);
      setIsCompiling(false);
      return;
    }
    if (compiledComponent) {
      console.log("[F7-DEBUG] RemotionPreviewPlayer: using pre-compiled component");
      setCompileResult({ success: true, component: compiledComponent });
      setIsCompiling(false);
      return;
    }
    compile();
  }, [compiledComponent, compiledComposition, compile]);

  // Build sample props for preview — only pass basics, no random contentType overrides.
  // The generated scene code has its own layout baked in; injecting random content types
  // (bullets, code, metrics) makes every preview look the same instead of showing the scene's design.
  const resolvedProps = useMemo<Omit<SceneProps, "brandColors">>(() => {
    return {
      displayText: "Transforming Ideas Into Impact",
      narrationText: "Discover how your brand can stand out with unique video content.",
      sceneIndex: 0,
      totalScenes: 3,
      aspectRatio: "landscape" as const,
      ...sampleProps,
    };
  }, [sampleProps]);

  if (!compiledComposition && isCompiling) {
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

  if (!compiledComposition && (!compileResult || !compileResult.success)) {
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

  const CompiledComponent = compileResult?.success ? compileResult.component : null;

  // Wrapper composition for the Player
  const Composition: React.FC = () => {
    if (compiledComposition) {
      const C = compiledComposition;
      return <C {...(compositionProps || {})} />;
    }
    if (!CompiledComponent) return null;
    return <CompiledComponent {...resolvedProps} brandColors={brandColors} />;
  };


  return (
    <PlayerErrorBoundary onRetry={onRetry} width={width}>
      <Player
        ref={playerRef}
        component={Composition}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        durationInFrames={playerDurationInFrames}
        fps={fps}
        style={{
          width: width || "100%",
          borderRadius: 8,
          overflow: "hidden",
        }}
        // Thumbnail mode starts parked on the target frame instead of playing to
        // it, so the frozen still is deterministic (see the seek effect above).
        initialFrame={thumbnailMode ? clampedThumbnailFrame : 0}
        autoPlay={!thumbnailMode}
        loop={thumbnailMode ? false : loop}
        controls={false}
      />
    </PlayerErrorBoundary>
  );
}
