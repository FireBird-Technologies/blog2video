import { lazy, Suspense, useState, useCallback, useMemo } from "react";
import type { CustomTemplateTheme } from "../../api/client";

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

  // Advance to next scene when current one finishes playing
  const handleSceneEnded = useCallback(() => {
    if (hasMultipleScenes) {
      setActiveScene((prev) => (prev + 1) % sceneCodes.length);
    }
  }, [hasMultipleScenes, sceneCodes.length]);

  const goToScene = useCallback((idx: number) => {
    setActiveScene(idx);
  }, []);

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
        {/* Accent stripe */}
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
      <Suspense fallback={fallback}>
        <RemotionPreviewPlayer
          key={activeScene}
          componentCode={currentScene.code}
          theme={theme}
          sampleProps={previewImageUrl ? { imageUrl: previewImageUrl } : undefined}
          durationSeconds={5}
          loop={!hasMultipleScenes}
          onRetry={onRetry}
          onEnded={handleSceneEnded}
        />
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
          {/* Scene label */}
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

          {/* Dots */}
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
