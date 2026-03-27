import { lazy, Suspense, useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../api/client";
import { compileComponentCode, type SceneProps } from "../../utils/compileComponent";

const RemotionPreviewPlayer = lazy(() => import("../RemotionPreviewPlayer"));

type ContentSampleData = Partial<SceneProps> & { displayText: string; narrationText: string };

/** Map archetype best_for tags to rich sample data so previews look realistic */
function buildArchetypeSampleData(
  brandName: string,
  bestFor?: string[],
): ContentSampleData {
  const n = brandName || "Our Brand";
  const tag = bestFor?.[0] || "plain";

  switch (tag) {
    case "metrics":
      return {
        displayText: `${n} by the Numbers`,
        narrationText: `Here's a look at the key metrics that define ${n}'s success and growth trajectory.`,
        contentType: "metrics",
        metrics: [
          { value: "3.2M", label: "Active Users", suffix: "+12%" },
          { value: "99.9%", label: "Uptime SLA" },
          { value: "4.8", label: "Rating", suffix: "/5" },
          { value: "150+", label: "Countries" },
        ],
      };
    case "bullets":
      return {
        displayText: `What Makes ${n} Different`,
        narrationText: `From cutting-edge technology to world-class support, here's what sets ${n} apart from the competition.`,
        contentType: "bullets",
        bullets: [
          "Enterprise-grade security and compliance built in",
          "Real-time collaboration across distributed teams",
          "AI-powered insights and automated workflows",
          "24/7 dedicated customer success support",
        ],
      };
    case "quote":
      return {
        displayText: `What People Say About ${n}`,
        narrationText: `Industry leaders share their experience working with ${n} and the impact it has had.`,
        contentType: "quote",
        quote: `${n} completely transformed how we approach our workflow. The results speak for themselves.`,
        quoteAuthor: "Industry Leader",
      };
    case "comparison":
      return {
        displayText: `${n} vs Traditional`,
        narrationText: `See how ${n} stacks up against the traditional approach across key dimensions.`,
        contentType: "comparison",
        comparisonLeft: { label: "Traditional", description: "Manual processes, slow iteration, limited visibility" },
        comparisonRight: { label: n, description: "Automated workflows, real-time insights, full transparency" },
      };
    case "timeline":
      return {
        displayText: `The ${n} Journey`,
        narrationText: `From inception to industry leadership, here's how ${n} has evolved over the years.`,
        contentType: "timeline",
        timelineItems: [
          { label: "Founded", description: "Started with a vision to transform the industry" },
          { label: "First Launch", description: "Released our flagship product to early adopters" },
          { label: "Scale", description: "Expanded to serve enterprise customers globally" },
          { label: "Today", description: "Industry-leading platform trusted by millions" },
        ],
      };
    case "steps":
      return {
        displayText: `How ${n} Works`,
        narrationText: `Getting started with ${n} is simple. Follow these steps to unlock the full potential.`,
        contentType: "steps",
        steps: [
          "Connect your existing tools and data sources",
          "Configure your workspace and invite your team",
          "Let AI analyze patterns and surface insights",
          "Take action on recommendations and track results",
        ],
      };
    case "code":
      return {
        displayText: `Get Started with ${n}`,
        narrationText: `Integrating ${n} into your workflow takes just a few lines of code.`,
        contentType: "code",
        codeLines: [
          `import { ${n.replace(/\s/g, "")} } from '${n.toLowerCase().replace(/\s/g, "-")}';`,
          "",
          `const client = new ${n.replace(/\s/g, "")}({ apiKey: "..." });`,
          `const result = await client.analyze(data);`,
          `console.log(result.insights);`,
        ],
        codeLanguage: "typescript",
      };
    default:
      return {
        displayText: `The ${n} Experience`,
        narrationText: `Discover what makes ${n} a trusted choice for teams and organizations worldwide. Built with quality and innovation at its core.`,
        contentType: "plain",
      };
  }
}

function buildFallbackSamples(brandName: string): ContentSampleData[] {
  const n = brandName || "Our Brand";
  return [
    { displayText: `Why ${n} Stands Out`, narrationText: `Here's what makes ${n} different from the rest.` },
    { displayText: `The ${n} Experience`, narrationText: `Discover what sets ${n} apart in the industry.` },
    { displayText: `Built for You by ${n}`, narrationText: `Everything at ${n} is designed with our customers in mind.` },
    { displayText: `${n} at a Glance`, narrationText: `A closer look at what ${n} has to offer.` },
    { displayText: `The Future of ${n}`, narrationText: `See where ${n} is headed next.` },
  ];
}

interface CustomPreviewProps {
  theme: CustomTemplateTheme;
  name?: string;
  introCode?: string;
  outroCode?: string;
  contentCodes?: string[];
  contentArchetypeIds?: (string | { id: string; best_for?: string[] })[];
  previewImageUrl?: string | null;
  logoUrls?: string[];
  ogImage?: string;
  onRetry?: () => void;
}

export default function CustomPreview({
  theme,
  name,
  introCode,
  outroCode,
  contentCodes,
  contentArchetypeIds,
  previewImageUrl,
  logoUrls,
  ogImage,
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
      contentCodes.forEach((c, i) => {
        const rawArch = contentArchetypeIds?.[i];
        const archId = typeof rawArch === "string" ? rawArch : rawArch?.id;
        const archetypeLabel = archId
          ?.replace(/_/g, " ")
          ?.replace(/\b\w/g, (ch: string) => ch.toUpperCase());
        codes.push({ code: c, label: archetypeLabel || `Content ${i + 1}` });
      });
    }
    if (outroCode) codes.push({ code: outroCode, label: "Outro" });
    return codes;
  }, [introCode, outroCode, contentCodes, contentArchetypeIds]);

  const hasCode = sceneCodes.length > 0;
  const hasMultipleScenes = sceneCodes.length > 1;

  // Pre-compute stable sampleProps for each scene so object references don't change
  // between re-renders (avoids Remotion Player restarting animation mid-playback)
  const fallbackSamples = useMemo(() => buildFallbackSamples(name || ""), [name]);

  const sceneSampleProps = useMemo(() => {
    const imageProps = ogImage ? { imageUrl: ogImage } : previewImageUrl ? { imageUrl: previewImageUrl } : {};
    const logoProps = logoUrls && logoUrls.length > 0 ? { logoUrl: logoUrls[0] } : {};
    const brandImageProps = logoUrls && logoUrls.length > 0 ? { brandImages: logoUrls } : ogImage ? { brandImages: [ogImage] } : {};
    const fontProps = { titleFontSize: 88, descriptionFontSize: 44 };

    return sceneCodes.map((sc, idx) => {
      const base = { sceneIndex: idx, totalScenes: sceneCodes.length, ...imageProps, ...logoProps, ...brandImageProps, ...fontProps };
      const n = name || "Our Brand";

      if (sc.label === "Intro") {
        return { displayText: n, narrationText: `Discover what makes ${n} special.`, ...base };
      }
      if (sc.label === "Outro") {
        return { displayText: n, narrationText: `Learn more at ${n}. Thank you for watching.`, ...base };
      }
      // Use archetype-aware sample data when available
      const contentIdx = idx - (introCode ? 1 : 0);
      const rawArch = contentArchetypeIds?.[contentIdx];
      const bestFor = typeof rawArch === "object" ? rawArch?.best_for : undefined;
      if (bestFor && bestFor.length > 0) {
        const sample = buildArchetypeSampleData(n, bestFor);
        return { ...sample, ...base };
      }
      const fallback = fallbackSamples[contentIdx % fallbackSamples.length];
      return { ...fallback, ...base };
    });
  }, [sceneCodes, name, ogImage, previewImageUrl, logoUrls, introCode, contentArchetypeIds, fallbackSamples]);

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

  // ─── No code yet — show blank placeholder ─────────────────────
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
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: `${theme.fonts.heading}, sans-serif`,
            fontSize: 34,
            fontWeight: 700,
            color: theme.colors.text,
            textAlign: "center",
          }}
        >
          {name || "Your Template"}
        </div>
        <div
          style={{
            fontFamily: `${theme.fonts.body}, sans-serif`,
            fontSize: 20,
            color: theme.colors.muted,
            textAlign: "center",
          }}
        >
          Preview will appear after generation
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
                    sampleProps={sceneSampleProps[idx]}
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
              fontSize: 11,
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
