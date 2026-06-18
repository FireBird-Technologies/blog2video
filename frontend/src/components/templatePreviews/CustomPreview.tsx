import { lazy, Suspense, useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { CustomTemplateTheme } from "../../api/client";
import { compileComponentCode, compileModuleGraphEntry, type SceneProps } from "../../utils/compileComponent";
import { DataChartScene, DataTableScene } from "../remotion/generated/kit";
import { CtaOverlay } from "../remotion/CtaOverlay";

const RemotionPreviewPlayer = lazy(() => import("../RemotionPreviewPlayer"));

type ContentSampleData = Partial<SceneProps> & { displayText: string; narrationText: string };

/** One scene in the preview carousel. Code scenes (intro/content) compile from AI
 *  source; data-viz scenes render the kit chart/table; the outro renders the same
 *  CTA overlay the final video composites (so preview === render). */
type PreviewScene =
  | { kind: "code"; code: string; label: string }
  | { kind: "dataviz_chart" | "dataviz_table"; label: string }
  | { kind: "cta_outro"; label: string };

/** Representative CTA/socials so the preview outro shows the same overlay the
 *  pipeline injects into every custom video's last scene at render time. */
const SAMPLE_CTA_PROPS = {
  socials: {
    linkedin: { enabled: true, label: "LinkedIn" },
    instagram: { enabled: true, label: "Instagram" },
    youtube: { enabled: true, label: "YouTube" },
  },
  showWebsiteButton: true,
  websiteLink: "yourbrand.com",
  ctaButtonText: "Get started",
};

/** Outro = the deterministic CTA overlay (mirrors GeneratedVideo's outro). Reads
 *  brand colors/fonts/logo from the standard scene props injected by the player. */
const OutroCtaScene: React.FC<SceneProps> = (props) => (
  <CtaOverlay
    ctaProps={SAMPLE_CTA_PROPS}
    brandColors={props.brandColors}
    aspectRatio={props.aspectRatio}
    headingFont={props.headingFont}
    bodyFont={props.bodyFont}
    title={props.displayText}
    logoUrl={props.logoUrl}
  />
);

/** Mirror of backend `_CUSTOM_DATAVIZ_SEED` (pipeline.py) — sample data so the
 *  preview's chart/table scenes look realistic before a real table is bound. */
const SAMPLE_CHART_TABLE: { headers: string[]; rows: (string | number)[][] } = {
  headers: ["Quarter", "Revenue", "Growth %"],
  rows: [
    ["Q1", "120", "8"],
    ["Q2", "145", "12"],
    ["Q3", "170", "17"],
    ["Q4", "210", "24"],
  ],
};

/** Mirror of the GeneratedTransition default family (remotion-video). The preview
 *  approximates these brand exit flourishes in CSS so transitions are visible
 *  before render — the real video uses the Remotion GeneratedTransition. */
const DEFAULT_TRANSITION_FAMILY = ["fade", "accent_wash", "rule_sweep", "ink_wash", "whip_blur"] as const;

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
    case "dataviz":
      // Defensive only — content archetypes no longer use "dataviz" (charts/tables are
      // dedicated kit scenes). Keep a sensible fallback so a legacy archetype id that
      // still says "dataviz" never renders a blank scene.
      return {
        displayText: `${n} by the Numbers`,
        narrationText: `The data behind ${n}'s momentum, at a glance.`,
        contentType: "plain",
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
  validLayouts?: string[] | null;
  frontendFiles?: Record<string, string> | null;
  frontendEntryRel?: string | null;
  /** Crafted template: URLs for bundled `public/` paths (Remotion staticFile keys). */
  publicAssetUrls?: Record<string, string> | null;
  previewImageUrl?: string | null;
  logoUrls?: string[];
  ogImage?: string;
  showLoaderOnEmptyOrError?: boolean;
  thumbnailFrame?: number;
  onRetry?: () => void;
  onAllScenesEnded?: () => void;
  thumbnailMode?: boolean;
}

export default function CustomPreview({
  theme,
  name,
  introCode,
  outroCode,
  contentCodes,
  contentArchetypeIds,
  validLayouts,
  frontendFiles,
  frontendEntryRel,
  publicAssetUrls,
  previewImageUrl,
  logoUrls,
  ogImage,
  showLoaderOnEmptyOrError = false,
  thumbnailFrame = 135,
  onRetry,
  onAllScenesEnded,
  thumbnailMode = false,
}: CustomPreviewProps) {
  const [activeScene, setActiveScene] = useState(0);
  const [outgoingScene, setOutgoingScene] = useState<number | null>(null);
  const [compiledMap, setCompiledMap] = useState<Map<number, React.FC<SceneProps>>>(new Map());
  const [compiledComposition, setCompiledComposition] = useState<React.ComponentType<any> | null>(null);
  const [isCompiling, setIsCompiling] = useState(true);
  const [compileError, setCompileError] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const compileTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Build ordered carousel: intro → content variants → data chart, data table → outro.
  // The 2 data-viz scenes mirror what the pipeline always injects into custom videos
  // at render time, so the template preview matches the final video.
  const sceneCodes = useMemo<PreviewScene[]>(() => {
    const codes: PreviewScene[] = [];
    if (introCode) codes.push({ kind: "code", code: introCode, label: "Intro" });
    if (contentCodes && contentCodes.length > 0) {
      contentCodes.forEach((c, i) => {
        const rawArch = contentArchetypeIds?.[i];
        const archId = typeof rawArch === "string" ? rawArch : rawArch?.id;
        const archetypeLabel = archId
          ?.replace(/_/g, " ")
          ?.replace(/\b\w/g, (ch: string) => ch.toUpperCase());
        codes.push({ kind: "code", code: c, label: archetypeLabel || `Content ${i + 1}` });
      });
    }
    // Only show the data-viz pair when there's a real generated template (at least one
    // code scene) — they sit just before the outro, matching pipeline insertion order.
    if (codes.length > 0) {
      codes.push({ kind: "dataviz_chart", label: "Data Chart" });
      codes.push({ kind: "dataviz_table", label: "Data Table" });
    }
    // Outro renders the CTA overlay (matching the final video), not the AI outro code.
    if (outroCode) codes.push({ kind: "cta_outro", label: "Outro" });
    return codes;
  }, [introCode, outroCode, contentCodes, contentArchetypeIds]);

  const hasCode = sceneCodes.length > 0;
  const hasMultipleScenes = sceneCodes.length > 1;
  const hasFrontendRuntime = !!(
    frontendFiles &&
    Object.keys(frontendFiles).length > 0 &&
    frontendEntryRel
  );

  // Pre-compute stable sampleProps for each scene so object references don't change
  // between re-renders (avoids Remotion Player restarting animation mid-playback)
  const fallbackSamples = useMemo(() => buildFallbackSamples(name || ""), [name]);

  const sceneSampleProps = useMemo(() => {
    // Only pass ogImage. Never use previewImageUrl as an image prop, as that is the template's
    // own thumbnail and will cause a broken recursive image load, resulting in empty space.
    const imageProps = ogImage ? { imageUrl: ogImage } : {};
    const logoProps = logoUrls && logoUrls.length > 0 ? { logoUrl: logoUrls[0] } : {};
    const brandImageProps = logoUrls && logoUrls.length > 0 ? { brandImages: logoUrls } : ogImage ? { brandImages: [ogImage] } : {};
    const fontProps = { titleFontSize: 88, descriptionFontSize: 44 };

    return sceneCodes.map((sc, idx) => {
      const base = { sceneIndex: idx, totalScenes: sceneCodes.length, ...imageProps, ...logoProps, ...brandImageProps, ...fontProps };
      const n = name || "Our Brand";

      // Data-viz scenes: feed the deterministic kit chart/table sample data + brand fonts.
      if (sc.kind === "dataviz_chart") {
        return {
          displayText: "By the Numbers",
          narrationText: `The data behind ${n}'s momentum.`,
          chartTable: SAMPLE_CHART_TABLE,
          chartType: "line",
          headingFont: theme.fonts.heading,
          bodyFont: theme.fonts.body,
          ...base,
        };
      }
      if (sc.kind === "dataviz_table") {
        return {
          displayText: "The Full Breakdown",
          narrationText: `${n}'s figures in full.`,
          chartTable: SAMPLE_CHART_TABLE,
          headingFont: theme.fonts.heading,
          bodyFont: theme.fonts.body,
          ...base,
        };
      }
      // Outro CTA overlay: brand name as the title + brand fonts.
      if (sc.kind === "cta_outro") {
        return {
          displayText: n,
          narrationText: `Learn more about ${n}.`,
          headingFont: theme.fonts.heading,
          bodyFont: theme.fonts.body,
          ...base,
        };
      }

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
  }, [sceneCodes, name, ogImage, previewImageUrl, logoUrls, introCode, contentArchetypeIds, fallbackSamples, theme.fonts.heading, theme.fonts.body]);

  const compositionSampleProps = useMemo(() => {
    const layoutList =
      Array.isArray(validLayouts) && validLayouts.length > 0
        ? validLayouts
        : ["text_narration", "hero_image", "ending_socials"];
    const sceneCount = Math.max(3, Math.min(6, layoutList.length));
    const sampleScenes = new Array(sceneCount).fill(0).map((_, idx) => ({
      id: idx + 1,
      order: idx,
      title: idx === 0 ? (name || "Your Template") : `Scene ${idx + 1}`,
      narration:
        idx === 0
          ? `Discover what makes ${name || "this template"} special.`
          : `This is sample narration for scene ${idx + 1}.`,
      layout: layoutList[idx % layoutList.length],
      layoutProps: {},
      durationSeconds: 4,
      imageUrl: ogImage || undefined,
    }));
    return {
      scenes: sampleScenes,
      accentColor: theme.colors.accent,
      bgColor: theme.colors.bg,
      textColor: theme.colors.text,
      logo: logoUrls?.[0] || undefined,
      aspectRatio: "landscape",
      fontFamily: theme.fonts.body,
      playbackSpeed: 1,
    };
  }, [validLayouts, name, ogImage, theme, logoUrls]);

  // Pre-compile ALL scene codes on mount (eliminates per-scene "Compiling preview..." flash)
  useEffect(() => {
    if (sceneCodes.length === 0) {
      if (!hasFrontendRuntime) {
        setCompiledComposition(null);
        setIsCompiling(false);
        return;
      }
      let cancelled = false;
      setIsCompiling(true);
      setCompileError(false);
      setCompiledComposition(null);

      compileTimeoutRef.current = setTimeout(() => {
        if (!cancelled) {
          setIsCompiling(false);
          setCompileError(true);
          console.error("[F7-DEBUG] CustomPreview: module compile timeout after 8s");
        }
      }, 8000);

      const compileModule = async () => {
        const result = await compileModuleGraphEntry(
          frontendFiles || {},
          frontendEntryRel || "",
          publicAssetUrls,
        );
        if (cancelled) return;
        clearTimeout(compileTimeoutRef.current);
        if (result.success) {
          setCompiledComposition(() => result.component);
          setCompileError(false);
        } else {
          console.error("[F7-DEBUG] CustomPreview: module compile failed:", result.error);
          setCompileError(true);
        }
        setIsCompiling(false);
      };
      compileModule();
      return () => {
        cancelled = true;
        clearTimeout(compileTimeoutRef.current);
      };
    }

    setCompiledComposition(null);
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
        const sc = sceneCodes[i];
        if (sc.kind !== "code") continue; // data-viz scenes render via the kit, no compile
        const result = await compileComponentCode(sc.code);
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
  }, [sceneCodes, hasFrontendRuntime, frontendFiles, frontendEntryRel, publicAssetUrls]);

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
    if (thumbnailMode) return;
    if (hasMultipleScenes) {
      switchScene((prev) => {
        const isLast = prev === sceneCodes.length - 1;
        if (isLast && onAllScenesEnded) onAllScenesEnded();
        return (prev + 1) % sceneCodes.length;
      });
    }
  }, [hasMultipleScenes, sceneCodes.length, switchScene, onAllScenesEnded, thumbnailMode]);

  const goToScene = useCallback((idx: number) => {
    switchScene(() => idx);
  }, [switchScene]);

  // ─── No code yet — show blank placeholder ─────────────────────
  if (!hasCode && !hasFrontendRuntime) {
    if (previewImageUrl) {
      return (
        <img
          src={previewImageUrl}
          alt={`${name || "Template"} preview`}
          style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 8, display: "block" }}
          loading="lazy"
          decoding="async"
        />
      );
    }
    if (showLoaderOnEmptyOrError) {
      return (
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a2e",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: "2px solid rgba(156, 163, 175, 0.35)",
              borderTopColor: "#8b5cf6",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
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
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2px solid rgba(156, 163, 175, 0.35)",
            borderTopColor: "#8b5cf6",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Compile error / timeout ────────────────────────────────
  if (compileError || (!compiledComposition && !isCompiling && compiledMap.size === 0)) {
    if (showLoaderOnEmptyOrError) {
      return (
        <div
          style={{
            width: "100%",
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a2e",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: "2px solid rgba(156, 163, 175, 0.35)",
              borderTopColor: "#8b5cf6",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
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

  if (compiledComposition) {
    return (
      <div style={{ position: "relative" }}>
        <Suspense fallback={fallback}>
          <RemotionPreviewPlayer
            compiledComposition={compiledComposition}
            theme={theme}
            compositionProps={compositionSampleProps}
            durationInFrames={30 * 16}
            fps={30}
            compositionWidth={1920}
            compositionHeight={1080}
            loop={!thumbnailMode}
            thumbnailMode={thumbnailMode}
            thumbnailFrame={thumbnailFrame}
            onRetry={onRetry}
          />
        </Suspense>
      </div>
    );
  }

  // E — brand transitions in preview: approximate the Remotion GeneratedTransition
  // exit flourishes in CSS, choosing a style per scene index from the brand's
  // motion.transitionFamily (falls back to the default family). `active` is the
  // settled state; the inactive state is the "from" each family animates out of.
  const transitionFamily =
    (theme as unknown as { motion?: { transitionFamily?: string[] } }).motion?.transitionFamily;
  const familyPool =
    Array.isArray(transitionFamily) && transitionFamily.length > 0
      ? transitionFamily
      : (DEFAULT_TRANSITION_FAMILY as unknown as string[]);
  const transitionStyleFor = (idx: number, active: boolean): React.CSSProperties => {
    switch (familyPool[Math.abs(idx) % familyPool.length]) {
      case "accent_wash":
        return { opacity: active ? 1 : 0, transform: active ? "translateX(0)" : "translateX(7%)" };
      case "whip_blur":
        return {
          opacity: active ? 1 : 0,
          transform: active ? "translateX(0)" : "translateX(-5%)",
          filter: active ? "blur(0px)" : "blur(10px)",
        };
      case "rule_sweep":
        return { opacity: 1, clipPath: active ? "inset(0 0 0 0)" : "inset(0 100% 0 0)" };
      case "ink_wash":
        return { opacity: active ? 1 : 0, transform: active ? "scale(1)" : "scale(0.96)" };
      case "fade":
      default:
        return { opacity: active ? 1 : 0 };
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Scene layers — div wrappers always mounted so CSS transitions work on opacity */}
      <Suspense fallback={fallback}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden" }}>
          {sceneCodes.map((sc, idx) => {
            const isActive = idx === activeScene;
            const isOutgoing = idx === outgoingScene;
            // Data-viz scenes render the deterministic kit components; code scenes
            // use the JIT-compiled AI component from compiledMap.
            const kitComp =
              sc.kind === "dataviz_chart"
                ? (DataChartScene as unknown as React.FC<SceneProps>)
                : sc.kind === "dataviz_table"
                  ? (DataTableScene as unknown as React.FC<SceneProps>)
                  : sc.kind === "cta_outro"
                    ? OutroCtaScene
                    : undefined;
            const compiled = kitComp ?? compiledMap.get(idx);
            const shouldRenderPlayer = (isActive || isOutgoing) && !!compiled;

            return (
              <div
                key={`scene-${idx}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  ...transitionStyleFor(idx, isActive),
                  transition:
                    "opacity 320ms ease-out, transform 320ms ease-out, filter 320ms ease-out, clip-path 360ms ease-out",
                  zIndex: isActive ? 2 : 1,
                  pointerEvents: isActive ? "auto" : "none",
                }}
              >
                {shouldRenderPlayer && compiled && (
                  <RemotionPreviewPlayer
                    compiledComponent={compiled}
                    theme={theme}
                    sampleProps={sceneSampleProps[idx]}
                    durationSeconds={5}
                    loop={!thumbnailMode && !hasMultipleScenes}
                    thumbnailMode={thumbnailMode}
                    thumbnailFrame={thumbnailFrame}
                    onRetry={onRetry}
                    onEnded={!thumbnailMode && isActive ? handleSceneEnded : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Suspense>

      {/* Scene navigation — control bar BELOW the video (prev/next + counter + dots) */}
      {hasMultipleScenes && !thumbnailMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 8,
            padding: "0 10px 8px",
          }}
        >
          {([
            { label: "Previous scene", glyph: "‹", delta: -1 },
            { label: "Next scene", glyph: "›", delta: 1 },
          ] as const).map(({ label, glyph, delta }) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                goToScene((activeScene + delta + sceneCodes.length) % sceneCodes.length)
              }
              aria-label={label}
              style={{
                order: delta < 0 ? 0 : 2,
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                fontSize: 17,
                lineHeight: 1,
                paddingBottom: 2,
                flexShrink: 0,
              }}
            >
              {glyph}
            </button>
          ))}

          <div style={{ order: 1, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "#4b5563",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {sceneCodes[activeScene]?.label}
              </span>
              <span style={{ color: "#9ca3af" }}>
                {activeScene + 1} / {sceneCodes.length}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {sceneCodes.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToScene(idx)}
                  type="button"
                  style={{
                    width: idx === activeScene ? 16 : 7,
                    height: 7,
                    borderRadius: 4,
                    background: idx === activeScene ? "#6b7280" : "#d1d5db",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "all 0.2s",
                  }}
                  aria-label={`Preview scene ${idx + 1} of ${sceneCodes.length}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
