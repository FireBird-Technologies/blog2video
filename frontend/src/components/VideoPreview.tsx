import React, { useMemo, useEffect, useState, useCallback } from "react";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  Sequence,
  Audio,
} from "remotion";
import { BACKEND_URL, Project, getTemplateCode } from "../api/client";
import { getTemplateConfig } from "./remotion/templateConfig";
import { resolveFontFamily } from "../fonts/registry";
import {
  compileComponentCode,
  type SceneProps,
} from "../utils/compileComponent";

interface VideoPreviewProps {
  project: Project;
  logoSizeOverride?: number;
  logoOpacityOverride?: number;
  logoPositionOverride?: string;
}

interface SceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  layoutConfig?: Record<string, unknown>;
  structuredContent?: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

/** Map of scene type keys ("intro", "content_0", ..., "outro") to compiled React components. */
type CompiledSceneMap = Record<string, React.FC<SceneProps>>;

export default function VideoPreview({
  project,
  logoSizeOverride,
  logoOpacityOverride,
  logoPositionOverride,
}: VideoPreviewProps) {
  const config = getTemplateConfig(project.template);
  const resolvedFontFamily = resolveFontFamily(project.font_family ?? null);

  const isCustom = (project.template || "").startsWith("custom_");

  // ─── Custom template: fetch + JIT-compile AI-generated scene code ─────
  const [compiledScenes, setCompiledScenes] = useState<CompiledSceneMap | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const compileCustomTemplate = useCallback(async () => {
    if (!isCustom) return;
    const match = project.template?.match(/^custom_(\d+)$/);
    if (!match) return;
    const templateId = parseInt(match[1], 10);

    setIsCompiling(true);
    try {
      const { data } = await getTemplateCode(templateId);
      const map: CompiledSceneMap = {};

      // Compile intro
      if (data.intro_code) {
        const result = await compileComponentCode(data.intro_code);
        if (result.success) map["intro"] = result.component;
      }
      // Compile content variants
      if (data.content_codes && data.content_codes.length > 0) {
        for (let i = 0; i < data.content_codes.length; i++) {
          const result = await compileComponentCode(data.content_codes[i]);
          if (result.success) map[`content_${i}`] = result.component;
        }
      }
      // Compile outro
      if (data.outro_code) {
        const result = await compileComponentCode(data.outro_code);
        if (result.success) map["outro"] = result.component;
      }
      setCompiledScenes(Object.keys(map).length > 0 ? map : null);
    } catch (err) {
      console.error("[VideoPreview] Failed to compile custom template:", err);
      setCompiledScenes(null);
    } finally {
      setIsCompiling(false);
    }
  }, [isCustom, project.template]);

  useEffect(() => {
    compileCustomTemplate();
  }, [compileCustomTemplate]);

  const scenes = useMemo((): SceneInput[] => {
    const resolveUrl = (asset: {
      id?: number;
      r2_url: string | null;
      filename: string;
      asset_type: string;
    }, cacheBuster?: string) => {
      const subdir = asset.asset_type === "image" ? "images" : "audio";
      const localPath = `/media/projects/${project.id}/${subdir}/${asset.filename}`;
      
      // In local dev, prefer local media files over R2 URLs
      // R2 URLs may not be accessible or may have connection issues locally
      const isLocalDev = !BACKEND_URL || 
                         BACKEND_URL.includes('localhost') || 
                         BACKEND_URL.includes('127.0.0.1');
      
      let base: string;
      if (isLocalDev) {
        base = localPath;
      } else {
        base = asset.r2_url ? asset.r2_url : `${BACKEND_URL}${localPath}`;
      }
      // Cache-bust so regenerated voiceovers (new asset id) load fresh instead of browser cache
      const suffix = cacheBuster ? (base.includes("?") ? `&v=${cacheBuster}` : `?v=${cacheBuster}`) : "";
      return base + suffix;
    };

    const imageAssets = project.assets
      .filter((a) => a.asset_type === "image" && !a.excluded)
      .slice()
      // Keep ordering deterministic so 1:1 generic assignment is stable
      .sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (ad !== bd) return ad - bd;
        return (a.id ?? 0) - (b.id ?? 0);
      });
    const audioAssets = project.assets.filter((a) => a.asset_type === "audio");
    const sceneImageMap: Record<number, string> = {};
    const hideImageFlags: boolean[] = new Array(project.scenes.length).fill(false);
    const usedGenericFiles = new Set<string>();

    if (imageAssets.length > 0 && project.scenes.length > 0) {
      // Build filename -> asset lookup
      const filenameToAsset = new Map<string, typeof imageAssets[0]>();
      imageAssets.forEach((asset) => filenameToAsset.set(asset.filename, asset));

      // 1) First pass: Check for stored assignedImage + hideImage in each scene's layoutProps
      // This ensures images move with their scenes when reordered, and scenes explicitly
      // marked hideImage=true never get an auto-assigned generic image.
      project.scenes.forEach((scene, idx) => {
        let layoutProps: Record<string, unknown> = {};
        if (scene.remotion_code) {
          try {
            const descriptor = JSON.parse(scene.remotion_code);
            layoutProps = (descriptor.layoutProps as Record<string, unknown>) || {};
          } catch {
            /* legacy */
          }
        }

        const hideImage = Boolean((layoutProps as any).hideImage);
        hideImageFlags[idx] = hideImage;

        const assignedImage = layoutProps.assignedImage as string | undefined;
        if (!hideImage && assignedImage && filenameToAsset.has(assignedImage)) {
          const m = assignedImage.match(/^scene_(\d+)_/);
          if (m) {
            // Scene-specific assignment must match current scene id
            const assignedSceneId = parseInt(m[1], 10);
            if (assignedSceneId === scene.id) {
              sceneImageMap[idx] = resolveUrl(filenameToAsset.get(assignedImage)!);
            }
          } else {
            // Generic assignment: enforce 1 generic -> 1 scene in preview
            if (!usedGenericFiles.has(assignedImage)) {
              usedGenericFiles.add(assignedImage);
              sceneImageMap[idx] = resolveUrl(filenameToAsset.get(assignedImage)!);
            }
          }
        }
      });

      // 2) Second pass: Scene-specific images (overwrite stored assignments)
      // Scene-specific images: filename "scene_<sceneId>_<timestamp>.*" (from AI edit upload)
      const sceneSpecificAssets: { sceneId: number; url: string }[] = [];
      const genericAssets: typeof imageAssets = [];
      for (const asset of imageAssets) {
        const match = asset.filename.match(/^scene_(\d+)_/);
        if (match) {
          const sceneId = parseInt(match[1], 10);
          sceneSpecificAssets.push({ sceneId, url: resolveUrl(asset) });
        } else {
          genericAssets.push(asset);
        }
      }
      // Apply scene-specific images (later uploads overwrite by same scene_id)
      for (const { sceneId, url } of sceneSpecificAssets) {
        const sceneIdx = project.scenes.findIndex((s) => s.id === sceneId);
        if (sceneIdx >= 0 && !hideImageFlags[sceneIdx]) {
          sceneImageMap[sceneIdx] = url;
        }
      }

      // 3) Third pass: Assign generic images to scenes without one yet and not hideImage
      let genericIdx = 0;
      for (
        let sceneIdx = 0;
        sceneIdx < project.scenes.length && genericIdx < genericAssets.length;
        sceneIdx++
      ) {
        if (sceneImageMap[sceneIdx] == null && !hideImageFlags[sceneIdx]) {
          // Pick next unused generic asset (enforce 1:1)
          while (genericIdx < genericAssets.length) {
            const candidate = genericAssets[genericIdx];
            genericIdx++;
            if (usedGenericFiles.has(candidate.filename)) continue;
            usedGenericFiles.add(candidate.filename);
            sceneImageMap[sceneIdx] = resolveUrl(candidate);
            break;
          }
        }
      }
    }

    return project.scenes.map((scene, idx) => {
      let layout = config.fallbackLayout;
      let layoutProps: Record<string, unknown> = {};
      let layoutConfig: Record<string, unknown> | undefined;
      let structuredContent: Record<string, unknown> | undefined;

      if (scene.remotion_code) {
        try {
          const descriptor = JSON.parse(scene.remotion_code);
          if (descriptor.layoutConfig) {
            // Universal layout engine (custom templates)
            layoutConfig = descriptor.layoutConfig;
            layout = descriptor.layoutConfig.arrangement || "full-center";
            // Extract structured content for custom template scene components
            if (descriptor.structuredContent) {
              structuredContent = descriptor.structuredContent;
            }
            if (isCustom) {
              console.log(`[VideoPreview] scene ${idx} ✅: layoutConfig found, arrangement=${layout}, elements=${descriptor.layoutConfig.elements?.length}, contentType=${structuredContent?.contentType || 'none'}`);
            }
          } else {
            // Built-in templates: legacy layout + layoutProps
            layout = descriptor.layout || config.fallbackLayout;
            layoutProps = descriptor.layoutProps || {};
            if (isCustom) {
              console.error(`[VideoPreview] scene ${idx} ❌: custom template but NO layoutConfig in remotion_code! Keys: ${Object.keys(descriptor).join(", ")}. This means remotion.py overwrote it.`);
            }
          }
        } catch {
          if (isCustom) {
            console.error(`[VideoPreview] scene ${idx} ❌: failed to parse remotion_code: ${scene.remotion_code?.substring(0, 100)}`);
          }
        }
      } else if (isCustom) {
        console.error(`[VideoPreview] scene ${idx} ❌: no remotion_code at all — pipeline hasn't generated this scene yet`);
      }

      if (scene.order === 1 && !scene.remotion_code) {
        layout = config.heroLayout;
      }

      // For custom templates, arrangements are validated by the backend;
      // for built-in templates, validate against the template's layout set.
      if (!isCustom && !config.validLayouts.has(layout)) {
        layout = config.fallbackLayout;
      }

      // Extract audio filename from voiceover_path to ensure correct audio after reordering
      // voiceover_path format: ".../audio/scene_X.mp3" or "C:\...\audio\scene_X.mp3"
      // After reordering, voiceover_path still points to the original filename, so we use it directly
      let voiceoverUrl: string | undefined = undefined;
      
      if (scene.voiceover_path) {
        // Extract filename from voiceover_path (handles Windows paths with mixed separators)
        // Path format: "C:\...\audio\scene_X.mp3" or ".../audio/scene_X.mp3"
        const pathParts = scene.voiceover_path.split(/[/\\]/);
        const filename = pathParts.find(part => part.startsWith('scene_') && part.endsWith('.mp3'));
        
        if (filename) {
          // When a scene is regenerated, a new audio Asset is created (same filename). Pick the
          // latest by id so we use the new voiceover; cache-bust with ?v=assetId so the browser
          // doesn't serve cached old audio.
          const matchingAudios = audioAssets.filter((a) => a.filename === filename);
          const latestAudio = matchingAudios.length > 0
            ? matchingAudios.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
            : null;
          
          if (latestAudio) {
            voiceoverUrl = resolveUrl(latestAudio, String(latestAudio.id));
          } else {
            const isLocalDev = !BACKEND_URL || 
                               BACKEND_URL.includes('localhost') || 
                               BACKEND_URL.includes('127.0.0.1');
            const localPath = `/media/projects/${project.id}/audio/${filename}`;
            voiceoverUrl = isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
          }
        }
      }
      
      // If no voiceover_path, try matching by current order (backwards compatibility)
      if (!voiceoverUrl) {
        const byOrder = audioAssets.filter((a) => a.filename === `scene_${scene.order}.mp3`);
        const latest = byOrder.length > 0 ? byOrder.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] : null;
        if (latest) {
          voiceoverUrl = resolveUrl(latest, String(latest.id));
        }
      }

      const onScreenText = scene.display_text ?? scene.narration_text;

      return {
        id: scene.id,
        order: scene.order,
        title: scene.title,
        narration: onScreenText,
        layout,
        layoutProps,
        ...(layoutConfig ? { layoutConfig } : {}),
        ...(structuredContent ? { structuredContent } : {}),
        durationSeconds: (Number(scene.duration_seconds) || 5) + (Number(scene.extra_hold_seconds) || 0),
        imageUrl: sceneImageMap[idx],
        voiceoverUrl,
      };
    });
  }, [project, config]);

  const totalDurationFrames = useMemo(() => {
    const FPS = 30;
    const sceneFrames = project.scenes.map((s) => {
      const base = Number(s.duration_seconds) || 5;
      const extra = Number(s.extra_hold_seconds) || 0;
      return Math.max(1, Math.round((base + extra) * FPS));
    });
    const sum = sceneFrames.reduce((a, b) => a + b, 0);
    return Math.max(sum + 60, 150);
  }, [project.scenes]);

  // Preload images and voiceover so they're in browser cache when Remotion renders
  const [mediaReady, setMediaReady] = useState(false);
  useEffect(() => {
    setMediaReady(false);
    const imageUrls = scenes.map((s) => s.imageUrl).filter(Boolean) as string[];
    const audioUrls = scenes.map((s) => s.voiceoverUrl).filter(Boolean) as string[];

    const imagePromises = imageUrls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // don't block on error
          img.src = src;
        }),
    );

    const audioPromises = audioUrls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const audio = document.createElement("audio");
          audio.preload = "auto";
          const done = () => resolve();
          audio.addEventListener("canplaythrough", done, { once: true });
          audio.addEventListener("error", done, { once: true });
          audio.src = src;
          // Safety timeout — don't block forever
          setTimeout(done, 5000);
        }),
    );

    Promise.all([...imagePromises, ...audioPromises]).then(() =>
      setMediaReady(true),
    );
  }, [scenes]);

  const isPortrait = project.aspect_ratio === "portrait";

  const colors = config.defaultColors;

  const inputProps = {
    scenes,
    accentColor: project.accent_color || colors.accent,
    bgColor: project.bg_color || colors.bg,
    textColor: project.text_color || colors.text,
    logo: project.logo_r2_url || null,
    logoPosition: logoPositionOverride ?? project.logo_position ?? "bottom_right",
    logoOpacity: logoOpacityOverride ?? project.logo_opacity ?? 0.9,
    logoSize: logoSizeOverride ?? (typeof project.logo_size === "number" ? project.logo_size : 100),
    aspectRatio: project.aspect_ratio || "landscape",
    ...(resolvedFontFamily ? { fontFamily: resolvedFontFamily } : {}),
    ...(project.custom_theme ? { theme: project.custom_theme } : {}),
  };

  // ─── Build custom composition for AI-generated templates ─────────────
  const numContentVariants = compiledScenes
    ? Object.keys(compiledScenes).filter((k) => k.startsWith("content_")).length
    : 0;

  const CustomComposition: React.FC | null = useMemo(() => {
    if (!isCustom || !compiledScenes) return null;

    const brandColors: SceneProps["brandColors"] = project.custom_theme
      ? {
          primary: project.custom_theme.colors.accent,
          secondary: project.custom_theme.colors.surface,
          accent: project.custom_theme.colors.accent,
          background: project.custom_theme.colors.bg,
          text: project.custom_theme.colors.text,
        }
      : {
          primary: project.accent_color || "#7C3AED",
          secondary: "#F5F5F5",
          accent: project.accent_color || "#7C3AED",
          background: project.bg_color || "#FFFFFF",
          text: project.text_color || "#1A1A2E",
        };

    const aspectRatio = (project.aspect_ratio || "landscape") as "landscape" | "portrait";
    const totalScenes = scenes.length;
    const FPS = 30;

    // Determine scene type and variant for each scene
    // Backend now persists contentVariantIndex to DB via content-aware matching
    const sceneAssignments: { type: string; variantKey: string }[] = [];
    let contentIdx = 0;
    for (let i = 0; i < scenes.length; i++) {
      const scene = project.scenes[i];
      let sceneType = "content";
      let variantIdx = 0;

      if (scene?.remotion_code) {
        try {
          const desc = JSON.parse(scene.remotion_code);
          // Priority: sceneTypeOverride > position-based
          if (desc.sceneTypeOverride && ["intro", "content", "outro"].includes(desc.sceneTypeOverride)) {
            sceneType = desc.sceneTypeOverride;
          } else if (i === 0) {
            sceneType = "intro";
          } else if (i === totalScenes - 1 && totalScenes > 1) {
            sceneType = "outro";
          }
          // Read variant index directly — persisted by backend
          if (sceneType === "content" && typeof desc.contentVariantIndex === "number") {
            variantIdx = desc.contentVariantIndex;
          }
        } catch { /* ignore */ }
      } else {
        if (i === 0) sceneType = "intro";
        else if (i === totalScenes - 1 && totalScenes > 1) sceneType = "outro";
      }

      if (sceneType === "content") {
        // Legacy fallback: cycle evenly if no contentVariantIndex from DB
        if (variantIdx === 0 && !scene?.remotion_code?.includes("contentVariantIndex")) {
          variantIdx = numContentVariants > 0 ? contentIdx % numContentVariants : 0;
        }
        contentIdx++;
        sceneAssignments.push({ type: "content", variantKey: `content_${variantIdx}` });
      } else {
        sceneAssignments.push({ type: sceneType, variantKey: sceneType });
      }
    }

    // Pre-compute frame offsets for each scene
    const frameOffsets: number[] = [];
    const frameDurations: number[] = [];
    let offset = 0;
    for (const s of scenes) {
      frameOffsets.push(offset);
      const dur = Math.max(1, Math.round(s.durationSeconds * FPS));
      frameDurations.push(dur);
      offset += dur;
    }

    // Build the composition
    const Comp: React.FC = () => (
      <AbsoluteFill style={{ fontFamily: resolvedFontFamily || undefined }}>
        {scenes.map((s, i) => {
          const assignment = sceneAssignments[i];
          const SceneComp =
            compiledScenes[assignment.variantKey] ||
            compiledScenes["intro"] ||
            Object.values(compiledScenes)[0];

          if (!SceneComp) return null;

          const sc = (s.structuredContent || {}) as Record<string, unknown>;
          const sceneProps: SceneProps = {
            displayText: s.narration || s.title,
            narrationText: s.narration || "",
            imageUrl: s.imageUrl,
            sceneIndex: i,
            totalScenes,
            logoUrl: project.logo_r2_url || undefined,
            brandColors,
            aspectRatio,
            contentType: sc.contentType as SceneProps["contentType"],
            bullets: sc.bullets as string[] | undefined,
            metrics: sc.metrics as SceneProps["metrics"],
            codeLines: sc.codeLines as string[] | undefined,
            codeLanguage: sc.codeLanguage as string | undefined,
            quote: sc.quote as string | undefined,
            quoteAuthor: sc.quoteAuthor as string | undefined,
            comparisonLeft: sc.comparisonLeft as SceneProps["comparisonLeft"],
            comparisonRight: sc.comparisonRight as SceneProps["comparisonRight"],
            timelineItems: sc.timelineItems as SceneProps["timelineItems"],
            steps: sc.steps as string[] | undefined,
            titleFontSize: (s.layoutConfig as any)?.titleFontSize as number | undefined,
            descriptionFontSize: (s.layoutConfig as any)?.descriptionFontSize as number | undefined,
          };

          return (
            <Sequence key={s.id} from={frameOffsets[i]} durationInFrames={frameDurations[i]}>
              <SceneComp {...sceneProps} />
              {s.voiceoverUrl && <Audio src={s.voiceoverUrl} />}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );

    return Comp;
  }, [isCustom, compiledScenes, scenes, project, numContentVariants, resolvedFontFamily]);

  const Composition = (isCustom && CustomComposition) ? CustomComposition : config.component;

  // Show compiling / preloading state
  if ((isCustom && isCompiling) || !mediaReady) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1a1a2e",
          borderRadius: 8,
          color: "#9ca3af",
          fontSize: 14,
        }}
      >
        {isCustom && isCompiling
          ? "Compiling custom template..."
          : "Loading media..."}
      </div>
    );
  }

  // Responsive wrapper: up to 90% of viewport, centered, aspect ratio preserved
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "min(100%, 90vw)",
          maxHeight: "min(100%, 90vh)",
          width: isPortrait ? "auto" : "100%",
          // Portrait: use max(100%, 80vh) so we have an intrinsic height when parent
          // has no explicit height (flex chain), avoiding 0-height collapse
          height: isPortrait ? "max(100%, 80vh)" : "auto",
          aspectRatio: isPortrait ? "9/16" : "16/9",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Player
          key={`preview-${project.id}-${project.updated_at ?? ""}-${project.scenes.length}-${project.assets.length}`}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={totalDurationFrames}
          compositionWidth={isPortrait ? config.baseHeight : config.baseWidth}
          compositionHeight={isPortrait ? config.baseWidth : config.baseHeight}
          fps={30}
          controls
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            overflow: "hidden",
          }}
        />
      </div>
    </div>
  );
}
