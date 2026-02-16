import { useMemo } from "react";
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
  durationSeconds: number;
  imageUrl?: string;
  voiceoverUrl?: string;
}

export default function VideoPreview({ project }: VideoPreviewProps) {
  const config = getTemplateConfig(project.template);

  const scenes = useMemo((): SceneInput[] => {
    const resolveUrl = (asset: {
      r2_url: string | null;
      filename: string;
      asset_type: string;
    }) => {
      if (asset.r2_url) return asset.r2_url;
      const subdir = asset.asset_type === "image" ? "images" : "audio";
      return `${BACKEND_URL}/media/projects/${project.id}/${subdir}/${asset.filename}`;
    };

    const imageAssets = project.assets.filter(
      (a) => a.asset_type === "image" && !a.excluded
    );
    const audioAssets = project.assets.filter((a) => a.asset_type === "audio");
    const sceneImageMap: Record<number, string> = {};

    if (imageAssets.length > 0 && project.scenes.length > 0) {
      sceneImageMap[0] = resolveUrl(imageAssets[0]);
      const remaining = imageAssets.slice(1);
      remaining.forEach((asset, i) => {
        const sceneIdx = i % project.scenes.length;
        if (!sceneImageMap[sceneIdx]) {
          sceneImageMap[sceneIdx] = resolveUrl(asset);
        }
      });
    }

    return project.scenes.map((scene, idx) => {
      let layout = config.fallbackLayout;
      let layoutProps: Record<string, unknown> = {};

      if (scene.remotion_code) {
        try {
          const descriptor = JSON.parse(scene.remotion_code);
          layout = descriptor.layout || config.fallbackLayout;
          layoutProps = descriptor.layoutProps || {};
        } catch {
          /* legacy */
        }
      }

      if (scene.order === 1 && !scene.remotion_code) {
        layout = config.heroLayout;
      }

      if (!config.validLayouts.has(layout)) {
        layout = config.fallbackLayout;
      }

      const matchingAudio = audioAssets.find(
        (a) => a.filename === `scene_${scene.order}.mp3`
      );
      const voiceoverUrl = matchingAudio
        ? resolveUrl(matchingAudio)
        : scene.voiceover_path
          ? `${BACKEND_URL}/media/projects/${project.id}/audio/scene_${scene.order}.mp3`
          : undefined;

      return {
        id: scene.id,
        order: scene.order,
        title: scene.title,
        narration: scene.narration_text,
        layout,
        layoutProps,
        durationSeconds: scene.duration_seconds,
        imageUrl: sceneImageMap[idx],
        voiceoverUrl,
      };
    });
  }, [project, config]);

  const totalDurationFrames = useMemo(() => {
    const totalSeconds = project.scenes.reduce(
      (sum, s) => sum + (s.duration_seconds || 5),
      0
    );
    return Math.max(Math.ceil((totalSeconds + 2) * 30), 150);
  }, [project.scenes]);

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
    aspectRatio: project.aspect_ratio || "landscape",
  };

  const Composition = config.component;

  return (
    <Player
      component={Composition}
      inputProps={inputProps}
      durationInFrames={totalDurationFrames}
      compositionWidth={isPortrait ? 1080 : 1920}
      compositionHeight={isPortrait ? 1920 : 1080}
      fps={30}
      controls
      style={{
        width: "100%",
        maxHeight: isPortrait ? "70vh" : "60vh",
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
