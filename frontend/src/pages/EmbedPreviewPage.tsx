import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BACKEND_URL, type Project } from "../api/client";
import VideoPreview from "../components/VideoPreview";

export default function EmbedPreviewPage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<Project | null>(null);
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
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

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
      <VideoPreview project={project} />
    </div>
  );
}
