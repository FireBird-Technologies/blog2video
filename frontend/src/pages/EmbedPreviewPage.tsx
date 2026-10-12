import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_URL, type EmbedProjectResponse, type Project } from "../api/client";
import VideoPreview, { type CaptionSettings } from "../components/VideoPreview";

// Statuses in which the project's scenes are still being written. Not every
// pipeline stage broadcasts on the live socket, so the page also polls while
// the video is in one of these.
const IN_PROGRESS_STATUSES = new Set([
  "created",
  "scraped",
  "scripted",
  "regenerating",
  "script_regenerating",
  "voice_regenerating",
  "language_regenerating",
]);
const IN_PROGRESS_POLL_MS = 3000;
// A reload message asks for fresh state; batch bursts of them briefly.
const REFETCH_DEBOUNCE_MS = 150;
// After edits were applied locally, re-read the server copy once they settle so
// derived fields (durations, resolved URLs) are exact. The visible change has
// already happened by then.
const RECONCILE_AFTER_MS = 1500;

// Project fields whose value on the wire is not what the player needs, so an
// edit to them triggers a refetch instead of a local patch.
const REFETCH_FIELDS = new Set(["bgm_track_id", "template"]);

type ViewerOverrides = Partial<
  Pick<Project, "captions_enabled" | "caption_font_family" | "caption_font_size" | "caption_offset" | "playback_speed">
>;

type EmbedExtras = Pick<EmbedProjectResponse, "crafted_template" | "custom_template_code" | "layout_prop_schema">;

type LiveMessage =
  | { type: "edit"; scope: "project"; field: string; value: unknown }
  | { type: "edit"; scope: "scene"; scene_id: number; field: string; value: unknown }
  | { type: "project_reloaded" };

/**
 * Player controls the embedding site asked to hide, from `?hide=` on the iframe
 * src: a comma-separated list of speed, captions, volume, fullscreen, or
 * controls (all of them). Without the flag every control shows, as before.
 */
function hiddenControls(search: string): Set<string> {
  const raw = new URLSearchParams(search).get("hide") ?? "";
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

function liveSocketUrl(token: string): string {
  const base = BACKEND_URL || window.location.origin;
  return `${base.replace(/^http/, "ws")}/api/embed/project/${token}/live`;
}

function toProject(data: Record<string, unknown>): Project {
  // Fill in defaults for fields the embed endpoint does not return.
  return {
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
  } as Project;
}

/** Standalone public player. Rendered by src/embed/main.tsx, outside the web app. */
export default function EmbedPreviewPage({ token }: { token: string | null }) {
  const [serverProject, setServerProject] = useState<Project | null>(null);
  // Viewer-side caption/speed choices, kept apart from the server copy so a
  // live refetch never undoes them.
  const [overrides, setOverrides] = useState<ViewerOverrides>({});
  const [embedExtras, setEmbedExtras] = useState<EmbedExtras | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  // The template the loaded template code belongs to. A lite refetch that
  // reports a different one means the code must be fetched again.
  const templateRef = useRef<string | null>(null);
  const hidden = useMemo(() => hiddenControls(window.location.search), []);
  const hideAll = hidden.has("controls");

  /**
   * full: the project plus its template code (first load, template changes).
   * lite: the project only; the template code already loaded is kept.
   */
  const fetchProject = useCallback(
    async (mode: "full" | "lite", initial = false) => {
      if (!token) return;
      try {
        const res = await axios.get(`${BACKEND_URL}/api/embed/project/${token}`, {
          params: mode === "lite" ? { lite: 1 } : undefined,
        });
        const data = res.data as Record<string, unknown>;
        if (mode === "lite" && data.template !== templateRef.current) {
          await fetchProject("full");
          return;
        }
        setServerProject(toProject(data));
        if (mode === "full") {
          templateRef.current = (data.template as string | null) ?? null;
          setEmbedExtras({
            crafted_template: (data.crafted_template as EmbedExtras["crafted_template"]) ?? null,
            custom_template_code: (data.custom_template_code as EmbedExtras["custom_template_code"]) ?? null,
            layout_prop_schema: (data.layout_prop_schema as EmbedExtras["layout_prop_schema"]) ?? null,
          });
        }
      } catch {
        // A failed live refresh keeps showing the last good version.
        if (initial) setError(true);
      } finally {
        if (initial) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    fetchProject("full", true);
  }, [token, fetchProject]);

  /** Apply one edit to the local copy. Returns false if it needs a refetch instead. */
  const applyEdit = useCallback((msg: Extract<LiveMessage, { type: "edit" }>): boolean => {
    // Decided from the message alone: a state updater may run later, so it
    // can't report back whether it applied anything.
    const patchable =
      (msg.scope === "project" && !!msg.field && !REFETCH_FIELDS.has(msg.field)) ||
      (msg.scope === "scene" && msg.scene_id != null && !!msg.field);
    if (!patchable) return false;
    setServerProject((prev) => {
      if (!prev) return prev;
      if (msg.scope === "project") {
        return { ...prev, [msg.field]: msg.value } as Project;
      }
      return {
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === msg.scene_id ? ({ ...s, [msg.field]: msg.value } as typeof s) : s,
        ),
      };
    });
    return true;
  }, []);

  // Live updates: the backend pushes a message whenever the video is edited
  // (in the editor or through the API). Field edits are applied immediately;
  // bulk changes refetch the project without its template code.
  useEffect(() => {
    if (!token) return;
    let socket: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

    const refetchSoon = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchProject("lite"), REFETCH_DEBOUNCE_MS);
    };
    const reconcileLater = () => {
      clearTimeout(reconcileTimer);
      reconcileTimer = setTimeout(() => fetchProject("lite"), RECONCILE_AFTER_MS);
    };

    const connect = () => {
      socket = new WebSocket(liveSocketUrl(token));
      socket.onopen = () => {
        retry = 0;
      };
      socket.onmessage = (event) => {
        let msg: LiveMessage | null = null;
        try {
          msg = JSON.parse(event.data);
        } catch {
          msg = null;
        }
        if (msg?.type === "edit" && applyEdit(msg)) {
          reconcileLater();
          return;
        }
        refetchSoon();
      };
      socket.onclose = (event) => {
        if (closed || event.code === 4404) return;
        retry += 1;
        reconnectTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry));
        // Catch up on anything missed while disconnected.
        if (retry === 1) fetchProject("lite");
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(refetchTimer);
      clearTimeout(reconcileTimer);
      socket?.close();
    };
  }, [token, fetchProject, applyEdit]);

  const inProgress = !!serverProject && IN_PROGRESS_STATUSES.has(serverProject.status);
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => fetchProject("lite"), IN_PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }, [inProgress, fetchProject]);

  const project = useMemo(
    () => (serverProject ? { ...serverProject, ...overrides } : null),
    [serverProject, overrides],
  );

  /* The caption and speed buttons are viewer-side controls here.
     ProjectView persists them via updateProject, but that endpoint is
     owner-authenticated and this page is public + token-based — a viewer has no
     credentials and doesn't own the project. So apply the change to local state
     instead (as viewer overrides): VideoPreview derives both the caption settings and the playback
     speed straight from these project fields, so updating them live is all the
     player needs. The change lasts for this viewing session and never touches
     the owner's saved settings. */
  const handleCaptionSettingsChange = useCallback((settings: CaptionSettings) => {
    setOverrides((prev) => ({
      ...prev,
      captions_enabled: settings.captionsEnabled,
      caption_font_family: settings.captionFontFamily,
      caption_font_size: String(settings.captionFontSize),
      caption_offset: settings.captionOffset,
    }));
  }, []);

  const handlePlaybackSpeedChange = useCallback((speed: number) => {
    const normalized = Math.min(2.5, Math.max(0.5, Math.round(speed * 10) / 10));
    setOverrides((prev) => ({ ...prev, playback_speed: normalized }));
  }, []);

  const frame: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "#0f172a",
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div style={{ ...frame, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ ...frame, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "sans-serif" }}>
        Video not found.
      </div>
    );
  }

  return (
    <div style={frame}>
      <VideoPreview
        project={project}
        layoutPropSchema={embedExtras?.layout_prop_schema ?? {}}
        precompiledTemplateData={embedExtras?.custom_template_code ?? undefined}
        precompiledCraftedDetail={embedExtras?.crafted_template ?? undefined}
        onCaptionSettingsChange={handleCaptionSettingsChange}
        onPlaybackSpeedChange={handlePlaybackSpeedChange}
        hideControls={hideAll}
        hideOverlayControls={hideAll}
        hideSpeedControl={hidden.has("speed")}
        hideCaptionControl={hidden.has("captions")}
        hideVolumeControl={hidden.has("volume")}
        hideFullscreenControl={hidden.has("fullscreen")}
        fillContainer
      />
    </div>
  );
}
