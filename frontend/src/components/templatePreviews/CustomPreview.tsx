import { lazy, Suspense, useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../api/client";
import { compileComponentCode, type SceneProps } from "../../utils/compileComponent";

const RemotionPreviewPlayer = lazy(() => import("../RemotionPreviewPlayer"));

interface CustomPreviewProps {
  theme: CustomTemplateTheme;
  name?: string;
  introCode?: string;
  outroCode?: string;
  contentCodes?: string[];
  previewImageUrl?: string | null;
  onRetry?: () => void;
}

export default function CustomPreview({
  theme,
  introCode,
  outroCode,
  contentCodes,
  previewImageUrl,
  onRetry,
}: CustomPreviewProps) {
  const [activeScene, setActiveScene] = useState(0);
  const [outgoingScene, setOutgoingScene] = useState<number | null>(null);
  const [compiledMap, setCompiledMap] = useState<Map<number, React.FC<SceneProps>>>(new Map());
  const [isCompiling, setIsCompiling] = useState(true);
  const [compileError, setCompileError] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const compileTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Build ordered list of scene codes: intro, content variants, outro
  const sceneCodes = useMemo(() => {
    const codes: { code: string; label: string }[] = [];
    if (introCode) codes.push({ code: introCode, label: "Intro" });
    if (contentCodes && contentCodes.length > 0) {
      contentCodes.forEach((c, i) => codes.push({ code: c, label: `Content ${i + 1}` }));
    }
    if (outroCode) codes.push({ code: outroCode, label: "Outro" });
    return codes;
  }, [introCode, outroCode, contentCodes]);

  const hasCode = sceneCodes.length > 0;
  const hasMultipleScenes = sceneCodes.length > 1;

  // Pre-compile ALL scene codes on mount (eliminates per-scene "Compiling preview..." flash)
  useEffect(() => {
    if (sceneCodes.length === 0) {
      setIsCompiling(false);
      return;
    }

    let cancelled = false;
    setIsCompiling(true);
    setCompileError(false);
    setActiveScene(0);
    setOutgoingScene(null);

    // 8s timeout — if Babel hangs, show error instead of infinite spinner
    compileTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        setIsCompiling(false);
        setCompileError(true);
        console.error("[F7-DEBUG] CustomPreview: compile timeout after 8s");
      }
    }, 8000);

    const compileAll = async () => {
      console.log(`[F7-DEBUG] CustomPreview: pre-compiling ${sceneCodes.length} scenes...`);
      const map = new Map<number, React.FC<SceneProps>>();
      for (let i = 0; i < sceneCodes.length; i++) {
        if (cancelled) return;
        const result = await compileComponentCode(sceneCodes[i].code);
        if (result.success) {
          map.set(i, result.component);
        } else {
          console.error(`[F7-DEBUG] CustomPreview: scene ${i} compile failed:`, result.error);
        }
      }
      if (!cancelled) {
        clearTimeout(compileTimeoutRef.current);
        console.log(`[F7-DEBUG] CustomPreview: all ${map.size}/${sceneCodes.length} scenes compiled`);
        setCompiledMap(map);
        setIsCompiling(false);
      }
    };

    compileAll();

    return () => {
      cancelled = true;
      clearTimeout(compileTimeoutRef.current);
    };
  }, [sceneCodes]);

  // Cleanup fade timer on unmount
  useEffect(() => {
    return () => clearTimeout(fadeTimerRef.current);
  }, []);

  // Scene transition with crossfade — both outgoing and incoming mounted during transition
  const switchScene = useCallback((getNext: (prev: number) => number) => {
    setActiveScene((prev) => {
      const next = getNext(prev);
      if (next === prev) return prev;
      setOutgoingScene(prev);
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setOutgoingScene(null), 400);
      return next;
    });
  }, []);

  const handleSceneEnded = useCallback(() => {
    if (hasMultipleScenes) {
      switchScene((prev) => (prev + 1) % sceneCodes.length);
    }
  }, [hasMultipleScenes, sceneCodes.length, switchScene]);

  const goToScene = useCallback((idx: number) => {
    switchScene(() => idx);
  }, [switchScene]);

  // ─── No code yet — show placeholder ─────────────────────────
  if (!hasCode) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: theme.colors.bg,
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div style={{ height: 6, background: theme.colors.accent, width: "100%" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "24px 32px", gap: 12 }}>
          <div
            style={{
              fontFamily: `${theme.fonts.heading}, sans-serif`,
              fontSize: 18,
              fontWeight: 700,
              color: theme.colors.text,
              textAlign: "center",
            }}
          >
            Your Brand Template
          </div>
          <div
            style={{
              fontFamily: `${theme.fonts.body}, sans-serif`,
              fontSize: 12,
              color: theme.colors.muted,
              textAlign: "center",
              maxWidth: 280,
              lineHeight: 1.5,
            }}
          >
            AI-generated video scenes will match your brand's colors, typography, and visual style.
          </div>
          <div
            style={{
              background: theme.colors.surface,
              borderRadius: theme.borderRadius,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 4,
            }}
          >
            <div style={{ width: 28, height: 28, borderRadius: theme.borderRadius / 2, background: theme.colors.accent, opacity: 0.15 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ width: 80, height: 8, borderRadius: 4, background: theme.colors.text, opacity: 0.2 }} />
              <div style={{ width: 120, height: 6, borderRadius: 3, background: theme.colors.muted, opacity: 0.3 }} />
            </div>
          </div>
          <div
            style={{
              fontFamily: `${theme.fonts.body}, sans-serif`,
              fontSize: 10,
              color: theme.colors.muted,
              opacity: 0.7,
              marginTop: 8,
            }}
          >
            Preview will appear after code generation
          </div>
        </div>
      </div>
    );
  }

  // ─── Still compiling all scenes — show once on initial load ───
  if (isCompiling) {
    return (
      <div style={{ width: "100%", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e", borderRadius: 8, color: "#9ca3af", fontSize: 14 }}>
        Compiling preview...
      </div>
    );
  }

  // ─── Compile error / timeout ────────────────────────────────
  if (compileError || compiledMap.size === 0) {
    return (
      <div style={{ width: "100%", aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e", border: "1px solid #ef4444", borderRadius: 8, padding: 16, gap: 8 }}>
        <span style={{ color: "#ef4444", fontSize: 13 }}>
          {compileError ? "Preview compilation timed out" : "Preview compilation failed"}
        </span>
        {onRetry && (
          <button onClick={onRetry} style={{ marginTop: 4, padding: "4px 12px", fontSize: 12, borderRadius: 4, border: "1px solid #6366f1", background: "transparent", color: "#6366f1", cursor: "pointer" }}>
            Regenerate
          </button>
        )}
      </div>
    );
  }

  const fallback = previewImageUrl ? (
    <img
      src={previewImageUrl}
      alt="Loading preview..."
      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 8, display: "block" }}
    />
  ) : (
    <div style={{ width: "100%", aspectRatio: "16/9", background: "#1a1a2e", borderRadius: 8 }} />
  );

  const currentScene = sceneCodes[activeScene] || sceneCodes[0];

  return (
    <div style={{ position: "relative" }}>
      {/* Scene layers — div wrappers always mounted so CSS transitions work on opacity */}
      <Suspense fallback={fallback}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden" }}>
          {sceneCodes.map((_, idx) => {
            const isActive = idx === activeScene;
            const isOutgoing = idx === outgoingScene;
            const compiled = compiledMap.get(idx);
            const shouldRenderPlayer = (isActive || isOutgoing) && compiled;

            return (
              <div
                key={`scene-${idx}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? "scale(1)" : isOutgoing ? "scale(1.02)" : "scale(0.98)",
                  transition: "opacity 300ms ease-out, transform 300ms ease-out",
                  zIndex: isActive ? 2 : 1,
                  pointerEvents: isActive ? "auto" : "none",
                }}
              >
                {shouldRenderPlayer && (
                  <RemotionPreviewPlayer
                    compiledComponent={compiled}
                    theme={theme}
                    sampleProps={previewImageUrl ? { imageUrl: previewImageUrl } : undefined}
                    durationSeconds={5}
                    loop={!hasMultipleScenes}
                    onRetry={onRetry}
                    onEnded={isActive ? handleSceneEnded : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Suspense>

      {/* Scene navigation dots + label */}
      {hasMultipleScenes && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: "#fff",
              background: "rgba(0,0,0,0.5)",
              padding: "2px 8px",
              borderRadius: 8,
              marginRight: 4,
            }}
          >
            {currentScene.label}
          </span>
          {sceneCodes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToScene(idx)}
              style={{
                width: idx === activeScene ? 16 : 6,
                height: 6,
                borderRadius: 3,
                background: idx === activeScene ? "#fff" : "rgba(255,255,255,0.4)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.2s",
              }}
              title={sceneCodes[idx].label}
            />
          ))}
        </div>
      )}
    </div>
  );
}
