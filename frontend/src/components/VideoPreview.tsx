import { useMemo, useEffect } from "react";
import { Player } from "@remotion/player";
import { BACKEND_URL, Project } from "../api/client";
import { getTemplateConfig } from "./remotion/templateConfig";

interface VideoPreviewProps {
  project: Project;
}

interface SceneInput {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  layoutConfig?: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export default function VideoPreview({ project }: VideoPreviewProps) {
  const config = getTemplateConfig(project.template);

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
        if (sceneIdx >= 0) {
          sceneImageMap[sceneIdx] = url;
          hideImageFlags[sceneIdx] = false;
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

    const isCustom = (project.template || "").startsWith("custom_");

    return project.scenes.map((scene, idx) => {
      let layout = config.fallbackLayout;
      let layoutProps: Record<string, unknown> = {};
      let layoutConfig: Record<string, unknown> | undefined;

      if (scene.remotion_code) {
        try {
          const descriptor = JSON.parse(scene.remotion_code);
          if (descriptor.layoutConfig) {
            // Universal layout engine (custom templates)
            layoutConfig = descriptor.layoutConfig;
            layout = descriptor.layoutConfig.arrangement || "full-center";
            if (isCustom) {
              console.log(`[VideoPreview] scene ${idx} ✅: layoutConfig found, arrangement=${layout}, elements=${descriptor.layoutConfig.elements?.length}`);
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
        durationSeconds: Number(scene.duration_seconds) || 5,
        imageUrl: sceneImageMap[idx],
        voiceoverUrl,
      };
    });
  }, [project, config]);

  const totalDurationFrames = useMemo(() => {
    const FPS = 30;
    const sceneFrames = project.scenes.map((s) =>
      Math.max(1, Math.round((Number(s.duration_seconds) || 5) * FPS))
    );
    const sum = sceneFrames.reduce((a, b) => a + b, 0);
    return Math.max(sum + 60, 150);
  }, [project.scenes]);

  // Preload images and voiceover so they're in browser cache when Remotion renders (avoids intermittent "not loaded")
  useEffect(() => {
    const imageUrls = scenes.map((s) => s.imageUrl).filter(Boolean) as string[];
    const audioUrls = scenes.map((s) => s.voiceoverUrl).filter(Boolean) as string[];
    imageUrls.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    audioUrls.forEach((src) => {
      const audio = document.createElement("audio");
      audio.preload = "auto";
      audio.src = src;
    });
  }, [scenes]);

  const isPortrait = project.aspect_ratio === "portrait";

  const colors = config.defaultColors;

  const inputProps = {
    scenes,
    accentColor: project.accent_color || colors.accent,
    bgColor: project.bg_color || colors.bg,
    textColor: project.text_color || colors.text,
    logo: project.logo_r2_url || null,
    logoPosition: project.logo_position || "bottom_right",
    logoOpacity: project.logo_opacity ?? 0.9,
    logoSize: typeof project.logo_size === "number" ? project.logo_size : 100,
    aspectRatio: project.aspect_ratio || "landscape",
    ...(project.custom_theme ? { theme: project.custom_theme } : {}),
  };

  const Composition = config.component;

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
          key={`preview-${project.id}-${project.updated_at ?? ""}`}
          component={Composition}
          inputProps={inputProps}
          durationInFrames={totalDurationFrames}
          compositionWidth={isPortrait ? 1080 : 1920}
          compositionHeight={isPortrait ? 1920 : 1080}
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
