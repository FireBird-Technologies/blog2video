import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL, type EmbedProjectResponse, type Project } from "../api/client";
import VideoPreview, { type CaptionSettings } from "../components/VideoPreview";

export default function EmbedPreviewPage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [embedExtras, setEmbedExtras] = useState<Pick<
    EmbedProjectResponse,
    "crafted_template" | "custom_template_code" | "layout_prop_schema"
  > | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    axios
      .get(`${BACKEND_URL}/api/embed/project/${token}`)
      .then((res) => {
        const data = res.data;
        // Fill in defaults for fields not returned by the embed endpoint
        const project: Project = {
          blog_url: null,
          blog_content: null,
          voice_gender: "female",
          voice_accent: "american",
          animation_instructions: null,
          studio_unlocked: false,
          studio_port: null,
          player_port: null,
          r2_video_key: null,
          custom_voice_id: null,
          custom_template_missing: false,
          review_state: null,
          created_at: data.updated_at,
          ...data,
        };
        setProject(project);
        setEmbedExtras({
          crafted_template: data.crafted_template ?? null,
          custom_template_code: data.custom_template_code ?? null,
          layout_prop_schema: data.layout_prop_schema ?? null,
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  /* The caption and speed buttons are viewer-side controls here.
     ProjectView persists them via updateProject, but that endpoint is
     owner-authenticated and this page is public + token-based — a viewer has no
     credentials and doesn't own the project. So apply the change to local state
     instead: VideoPreview derives both the caption settings and the playback
     speed straight from these project fields, so updating them live is all the
     player needs. The change lasts for this viewing session and never touches
     the owner's saved settings. */
  const handleCaptionSettingsChange = useCallback((settings: CaptionSettings) => {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            captions_enabled: settings.captionsEnabled,
            caption_font_family: settings.captionFontFamily,
            caption_font_size: String(settings.captionFontSize),
            caption_offset: settings.captionOffset,
          }
        : prev,
    );
  }, []);

  const handlePlaybackSpeedChange = useCallback((speed: number) => {
    const normalized = Math.min(2.5, Math.max(0.5, Math.round(speed * 10) / 10));
    setProject((prev) => (prev ? { ...prev, playback_speed: normalized } : prev));
  }, []);

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ height: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "sans-serif" }}>
        Video not found.
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100vw", background: "#000", overflow: "hidden" }}>
      <VideoPreview
        project={project}
        layoutPropSchema={embedExtras?.layout_prop_schema ?? {}}
        precompiledTemplateData={embedExtras?.custom_template_code ?? undefined}
        precompiledCraftedDetail={embedExtras?.crafted_template ?? undefined}
        onCaptionSettingsChange={handleCaptionSettingsChange}
        onPlaybackSpeedChange={handlePlaybackSpeedChange}
      />
    </div>
  );
}
