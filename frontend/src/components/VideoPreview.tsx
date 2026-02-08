import { useMemo } from "react";
import { Player } from "@remotion/player";
import {
  VideoComposition,
  VideoCompositionProps,
  SceneInput,
} from "./remotion/VideoComposition";
import { BACKEND_URL, Project } from "../api/client";
import type { LayoutType } from "./remotion/layouts";

interface VideoPreviewProps {
  project: Project;
}

export default function VideoPreview({ project }: VideoPreviewProps) {
  const scenes: SceneInput[] = useMemo(() => {
    // Helper: resolve asset URL (R2 if available, else local)
    const resolveUrl = (asset: { r2_url: string | null; filename: string; asset_type: string }) => {
      if (asset.r2_url) return asset.r2_url;
      const subdir = asset.asset_type === "image" ? "images" : "audio";
      return `${BACKEND_URL}/media/projects/${project.id}/${subdir}/${asset.filename}`;
    };

    // Build image map (same logic as backend — hero to scene 0, rest round-robin)
    const imageAssets = project.assets.filter((a) => a.asset_type === "image" && !a.excluded);
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
      // Parse layout descriptor from remotion_code (JSON)
      let layout: LayoutType = "text_narration";
      let layoutProps: Record<string, any> = {};

      if (scene.remotion_code) {
        try {
          const descriptor = JSON.parse(scene.remotion_code);
          layout = descriptor.layout || "text_narration";
          layoutProps = descriptor.layoutProps || {};
        } catch {
          // Legacy TSX code — fallback to text_narration
        }
      }

      // Scene order 1 with no explicit layout → hero_image
      if (scene.order === 1 && !scene.remotion_code) {
        layout = "hero_image";
      }

      // Resolve audio URL from matching asset (R2 if available)
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
  }, [project]);

  const totalDurationFrames = useMemo(() => {
    const totalSeconds = project.scenes.reduce(
      (sum, s) => sum + (s.duration_seconds || 5),
      0
    );
    return Math.max(Math.ceil((totalSeconds + 2) * 30), 150);
  }, [project.scenes]);

  const inputProps: VideoCompositionProps = {
    scenes,
    accentColor: project.accent_color || "#7C3AED",
    bgColor: project.bg_color || "#FFFFFF",
    textColor: project.text_color || "#000000",
  };

  return (
    <Player
      component={VideoComposition as any}
      inputProps={inputProps}
      durationInFrames={totalDurationFrames}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={30}
      controls
      style={{
        width: "100%",
        maxHeight: "60vh",
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
