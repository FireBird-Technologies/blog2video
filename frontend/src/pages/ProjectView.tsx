import { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { LinkIcon } from "@heroicons/react/24/outline";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  getProject,
  listProjects,
  startGeneration,
  getPipelineStatus,
  renderVideo,
  cancelRender,
  getRenderStatus,
  downloadVideo,
  fetchVideoBlob,
  downloadStudioZip,
  launchStudio,
  toggleAssetExclusion,
  uploadProjectDocuments,
  reorderScenes,
  updateScene,
  updateSceneImage,
  generateSceneImage,
  deleteScene,
  deleteAsset,
  getValidLayouts,
  updateProjectLogo,
  uploadLogo,
  Project,
  Scene,
  BACKEND_URL,
  bulkUpdateSceneTypography,
  submitProjectReview,
  updateProject,
  getTemplates,
  listCustomTemplates,
  changeProjectTemplateRegenerateLayouts,
  getProjectTemplateChangeStatus,
  type TemplateMeta,
  type CustomTemplateItem,
  getBgmTracks,
  type BgmTrack,
} from "../api/client";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "../hooks/useAuth";
import { useErrorModal, getErrorMessage, DEFAULT_ERROR_MESSAGE } from "../contexts/ErrorModalContext";
import { useNoticeModal } from "../contexts/NoticeModalContext";
import { trackGoogleAdsPurchaseConversion } from "../gtag";
import StatusBadge from "../components/StatusBadge";
import ScriptPanel from "../components/ScriptPanel";
import SceneEditModal, { SceneImageItem, getDefaultFontSizes, getDefaultFontSizesFromSchema } from "../components/SceneEditModal";
import ChatPanel from "../components/ChatPanel";
import UpgradeModal from "../components/UpgradeModal";
import UpgradePlanModal from "../components/UpgradePlanModal";
import ProjectReviewPrompt from "../components/ProjectReviewPrompt";
import VideoPreview from "../components/VideoPreview";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { TEMPLATE_PREVIEWS, TEMPLATE_DESCRIPTIONS, NewTemplateBadge } from "../components/templatePreviewRegistry";
import CustomPreview from "../components/templatePreviews/CustomPreview";
import CustomPreviewLandscape from "../components/templatePreviews/CustomPreviewLandscape";
import CraftYourTemplateCard from "../components/CraftYourTemplateCard";
import { normalizeVideoStyle } from "../constants/videoStyles";
import { getPendingUpload } from "../stores/pendingUpload";
import { FONT_REGISTRY, resolveFontFamily } from "../fonts/registry";
import { getSceneLayoutLabel } from "../utils/layoutLabels";

type Tab = "script" | "scenes" | "images" | "audio" | "settings";
type PlaybackSpeedOption = number;
const PLAYBACK_SPEED_OPTIONS: readonly number[] = [0.5, 1, 1.5, 2, 2.5] as const;

const TABS_GUIDE_SEEN_KEY = "blog2video_tabs_guide_seen";
const TABS_CONTAINER_STEP: Step = {
  target: '[data-tour="tabs-container"]',
  content: "Use these tabs to work on your video: Script shows the full narration, Images manages your visuals and logo, Audio lets you preview voiceover for each scene, and Scenes lets you edit each scene’s text and layout.",
  disableBeacon: true,
  placement: "bottom",
};
const SCENE_EDIT_FIRST_STEP: Step = {
  target: '[data-tour="scene-edit-first"]',
  content: "Click Edit to open the scene editor: change the title and on-screen text, pick a layout, assign or replace the image, adjust font sizes, or use AI-assisted editing to regenerate the scene from a description.",
  disableBeacon: true,
  placement: "right",
};
const PROJECT_JOYRIDE_STYLES = {
  options: { primaryColor: "#7c3aed", width: 280 },
  tooltip: { fontSize: 13 },
  tooltipContent: { fontSize: 13, padding: "12px 8px" },
  buttonNext: { fontSize: 12 },
  buttonBack: { fontSize: 12 },
};

function buildProjectTourSteps(project: Project | null): Step[] {
  const steps: Step[] = [TABS_CONTAINER_STEP];
  if (project?.scenes?.length) steps.push(SCENE_EDIT_FIRST_STEP);
  return steps;
}

/** Display string for ETA from total seconds (smoothed server/client estimate). */
function formatEtaSecondsRounded(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `~${h}h ${mm}m`;
  }
  if (m > 0) return `~${m}m ${rs}s`;
  return `~${rs}s`;
}

const PIPELINE_STEPS_URL = [
  { id: 1, label: "Scraping" },
  { id: 2, label: "Script" },
  { id: 3, label: "Scenes" },
] as const;

const PIPELINE_STEPS_UPLOAD = [
  { id: 1, label: "Uploading" },
  { id: 2, label: "Script" },
  { id: 3, label: "Scenes" },
] as const;

// ─── URL Helpers ─────────────────────────────────────────────

/**
 * Resolve the best URL for an asset: R2 URL if available, else local media path.
 */
function resolveAssetUrl(asset: { r2_url: string | null; filename: string; asset_type: string }, projectId: number): string {
  // In local dev, prefer local media files over R2 URLs
  const isLocalDev = !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');
  
  if (!isLocalDev && asset.r2_url) return asset.r2_url;
  
  const subdir = asset.asset_type === "image" ? "images" : "audio";
  const localPath = `/media/projects/${projectId}/${subdir}/${asset.filename}`;
  
  // Use relative URL in local dev (goes through Vite proxy), absolute in production
  return isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
}

/**
 * Resolve the video URL: R2 URL if available, else local media path.
 */
function resolveVideoUrl(project: Project): string | null {
  if (project.status !== "done") return null;
  if (project.r2_video_url) return project.r2_video_url;
  return `${BACKEND_URL}/media/projects/${project.id}/output/video.mp4`;
}

/**
 * Extract audio filename from voiceover_path to handle reordering correctly.
 * Returns filename like "scene_1.mp3" or null if not found.
 * Handles Windows paths with mixed separators like "C:\...\projects/6/audio\scene_3.mp3"
 */
function extractAudioFilename(voiceoverPath: string | null): string | null {
  if (!voiceoverPath) return null;
  
  // Split by both forward and backward slashes, find the part that matches scene_X.mp3
  const pathParts = voiceoverPath.split(/[/\\]/);
  const filename = pathParts.find(part => part.startsWith('scene_') && part.endsWith('.mp3'));
  
  return filename || null;
}

const FIRST_PROJECT_REVIEW_POPUP_DELAY_MS = 2 * 60 * 1000;
const getFirstProjectReviewPopupDismissedKey = (projectId: number) =>
  `b2v_first_project_review_popup_dismissed_${projectId}`;

/**
 * Resolve voiceover URL for a scene. When a scene is regenerated, a new audio Asset is created
 * (same filename); we pick the latest by id and append ?v=assetId so the browser loads the new
 * voiceover instead of serving cached old audio.
 */
function resolveVoiceoverUrl(
  projectId: number,
  audioFilename: string,
  audioAssets: import("../api/client").Asset[]
): string | null {
  const matching = audioAssets.filter((a) => a.filename === audioFilename);
  const latest = matching.length > 0 ? matching.sort((a, b) => b.id - a.id)[0] : null;
  if (latest) {
    const base = resolveAssetUrl(latest, projectId);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}v=${latest.id}`;
  }
  const isLocalDev = !BACKEND_URL || BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1");
  const localPath = `/media/projects/${projectId}/audio/${audioFilename}`;
  return isLocalDev ? localPath : `${BACKEND_URL}${localPath}`;
}

// ─── Audio Player Row ────────────────────────────────────────
function AudioRow({
  scene,
  projectId,
  audioAssets,
}: {
  scene: Scene;
  projectId: number;
  audioAssets: import("../api/client").Asset[];
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Extract audio filename; use latest asset by id (regenerated scene = new asset) and cache-bust URL
  const audioFilename = extractAudioFilename(scene.voiceover_path) || `scene_${scene.order}.mp3`;
  const audioUrl = scene.voiceover_path
    ? resolveVoiceoverUrl(projectId, audioFilename, audioAssets)
    : null;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setProgress(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * duration);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="glass-card p-4 flex items-center gap-4">
      {/* Scene number */}
      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-purple-600">
          {scene.order}
        </span>
      </div>

      {/* Play button */}
      <button
        onClick={togglePlay}
        disabled={!audioUrl}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-gray-900 hover:bg-gray-800 text-white"
      >
        {playing ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-900 truncate">
            {scene.title}
          </span>
          <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">
            {duration > 0
              ? `${formatTime(progress)} / ${formatTime(duration)}`
              : audioUrl
              ? "—"
              : "No audio"}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 bg-gray-100 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex-shrink-0">
        {audioUrl ? (
          <span className="w-2 h-2 rounded-full bg-green-400 block" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-gray-200 block" />
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}
    </div>
  );
}

/** Built-in or custom template preview for settings / picker (matches BlogUrlForm step 2 styling). */
function TemplateAssignPreview({
  templateId,
  customTemplates,
  projectCustomTheme,
  projectName,
  variant,
}: {
  templateId: string;
  customTemplates: CustomTemplateItem[];
  projectCustomTheme: Project["custom_theme"];
  projectName?: string;
  variant: "large" | "thumb";
}) {
  if (templateId.startsWith("custom_")) {
    const cid = parseInt(templateId.replace("custom_", ""), 10);
    const ct = customTemplates.find((c) => c.id === cid);
    if (ct) {
      return variant === "large" ? (
        <CustomPreview
          theme={ct.theme}
          name={ct.name}
          previewImageUrl={ct.preview_image_url}
          introCode={ct.intro_code || undefined}
          outroCode={ct.outro_code || undefined}
          contentCodes={ct.content_codes || undefined}
          contentArchetypeIds={ct.content_archetype_ids || undefined}
          logoUrls={ct.logo_urls}
          ogImage={ct.og_image}
        />
      ) : (
        <CustomPreviewLandscape
          theme={ct.theme}
          name={ct.name}
          introCode={ct.intro_code || undefined}
          outroCode={ct.outro_code || undefined}
          contentCodes={ct.content_codes || undefined}
          contentArchetypeIds={ct.content_archetype_ids || undefined}
          previewImageUrl={ct.preview_image_url}
          logoUrls={ct.logo_urls}
          ogImage={ct.og_image}
        />
      );
    }
    if (projectCustomTheme) {
      const fallback = (
        <CustomPreview
          theme={projectCustomTheme}
          name={projectName || "Custom"}
          previewImageUrl={null}
          introCode={undefined}
          outroCode={undefined}
          contentCodes={undefined}
          contentArchetypeIds={undefined}
          logoUrls={undefined}
          ogImage={undefined}
        />
      );
      if (variant === "thumb") {
        return (
          <div className="relative w-full overflow-hidden max-h-[80px] min-h-[64px] bg-gray-50">{fallback}</div>
        );
      }
      return fallback;
    }
    return (
      <div
        className={`flex w-full items-center justify-center bg-gray-100 text-center text-xs text-gray-400 ${
          variant === "thumb" ? "min-h-[64px] max-h-[80px] p-2" : "aspect-video p-4"
        }`}
      >
        Custom template preview unavailable
      </div>
    );
  }

  const Comp = TEMPLATE_PREVIEWS[templateId];
  if (Comp) {
    if (variant === "thumb") {
      return (
        <div className="relative w-full overflow-hidden max-h-[80px] min-h-[64px] bg-gray-50">
          <Comp key={templateId} />
        </div>
      );
    }
    return <Comp key={templateId} />;
  }
  return (
    <div
      className={`flex w-full items-center justify-center bg-gray-100 text-gray-300 ${
        variant === "thumb" ? "min-h-[64px] max-h-[80px] text-[10px] px-1" : "aspect-video text-sm"
      }`}
    >
      {templateId}
    </div>
  );
}

function normalizeProjectAspectRatio(ar: string | undefined | null): "landscape" | "portrait" {
  return ar === "portrait" ? "portrait" : "landscape";
}

// ─── Main Component ──────────────────────────────────────────

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isPro = user?.plan === "pro" || user?.plan === "standard";

  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef<Project | null>(null);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const hasStudioAccess = isPro || (project?.studio_unlocked ?? false);
  const [activeTab, setActiveTab] = useState<Tab>("script");
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { showError } = useErrorModal();
  const { showNotice } = useNoticeModal();
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [logoPosition, setLogoPosition] = useState<string>("bottom_right");
  const [logoSize, setLogoSize] = useState<number>(100);
  const [logoOpacity, setLogoOpacity] = useState<number>(0.9);

  const [globalTitleSize, setGlobalTitleSize] = useState(60);
  const [globalDescSize, setGlobalDescSize] = useState(32);
  const [savingGlobalTypography, setSavingGlobalTypography] = useState(false);

  const [settingsAccentColor, setSettingsAccentColor] = useState("#7C3AED");
  const [settingsBgColor, setSettingsBgColor] = useState("#FFFFFF");
  const [settingsTextColor, setSettingsTextColor] = useState("#000000");
  const [savingColors, setSavingColors] = useState(false);
  const [settingsFontId, setSettingsFontId] = useState<string | null>(null);
  const [savingFontFamily, setSavingFontFamily] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [playbackSpeedDraft, setPlaybackSpeedDraft] = useState<number>(1);
  const [savingPlaybackSpeed, setSavingPlaybackSpeed] = useState(false);
  // Background music
  const [bgmTracks, setBgmTracks] = useState<import("../api/client").BgmTrack[]>([]);
  const [bgmTrackDraft, setBgmTrackDraft] = useState<string | null>(null);
  const [bgmVolumeDraft, setBgmVolumeDraft] = useState<number>(0.10);
  const [savingBgm, setSavingBgm] = useState(false);
  const [bgmPlayingId, setBgmPlayingId] = useState<string | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const savingPlaybackSpeedRef = useRef(false);
  const pendingPlaybackSpeedRef = useRef<number | null>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const [templateMetas, setTemplateMetas] = useState<TemplateMeta[]>([]);
  const [customTemplatesList, setCustomTemplatesList] = useState<CustomTemplateItem[]>([]);
  const [customTemplatesLoading, setCustomTemplatesLoading] = useState(true);
  const [showTemplateChangeModal, setShowTemplateChangeModal] = useState(false);
  const [templateChangePickerTab, setTemplateChangePickerTab] = useState<"builtin" | "custom">("builtin");
  const [templateChangeDraft, setTemplateChangeDraft] = useState<string>("default");
  const [templateRelayoutPendingId, setTemplateRelayoutPendingId] = useState<string | null>(null);
  const [templateRelayoutJob, setTemplateRelayoutJob] = useState<{
    id: number;
    status: string;
    processed_scenes: number;
    total_scenes: number;
    error_message: string | null;
  } | null>(null);
  const [submittingTemplateRelayout, setSubmittingTemplateRelayout] = useState(false);
  const templateRelayoutPollRef = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => {
    if (project) {
      setLogoPosition(project.logo_position || "bottom_right");
      setLogoSize(typeof project.logo_size === "number" ? project.logo_size : 100);
      setLogoOpacity(project.logo_opacity ?? 0.9);
      // ADD THESE:
      setSettingsAccentColor(project.accent_color || "#7C3AED");
      setSettingsBgColor(project.bg_color || "#FFFFFF");
      setSettingsTextColor(project.text_color || "#000000");
      setSettingsFontId(project.font_family ?? null);
      const current = Number(project.playback_speed ?? 1);
      setPlaybackSpeedDraft(Math.min(2.5, Math.max(0.5, Number.isFinite(current) ? current : 1)));
      setBgmTrackDraft(project.bgm_track_id ?? null);
      setBgmVolumeDraft(project.bgm_volume ?? 0.10);
      // Seed global typography sliders from the first scene that has stored values.
      // This avoids the slider defaulting to 60 when e.g. mosaic_metric scenes have 131.
      if (project.scenes && project.scenes.length > 0) {
        for (const s of project.scenes) {
          if (!s.remotion_code) continue;
          try {
            const d = JSON.parse(s.remotion_code);
            const lp = d.layoutProps ?? d.layoutConfig ?? {};
            if (typeof lp.titleFontSize === "number") {
              setGlobalTitleSize(Math.min(200, Math.max(20, lp.titleFontSize)));
            }
            if (typeof lp.descriptionFontSize === "number") {
              setGlobalDescSize(Math.min(80, Math.max(12, lp.descriptionFontSize)));
            }
            break;
          } catch { /* ignore */ }
        }
      }
    }
  }, [project?.id, project?.logo_position, project?.logo_size, project?.logo_opacity,
      project?.accent_color, project?.bg_color, project?.text_color, project?.font_family, project?.playback_speed]);

  useEffect(() => {
    if (project) {
      setLogoPosition(project.logo_position || "bottom_right");
      setLogoSize(typeof project.logo_size === "number" ? project.logo_size : 100);
      setLogoOpacity(project.logo_opacity ?? 0.9);
    }
  }, [project?.id, project?.logo_position, project?.logo_size, project?.logo_opacity]);

  // Fetch BGM tracks once
  useEffect(() => {
    getBgmTracks().then((r) => setBgmTracks(r.data)).catch(() => {});
  }, []);

  // Upload-based project detection
  const isUploadProject = project?.blog_url?.startsWith("upload://") ?? false;
  const PIPELINE_STEPS = isUploadProject ? PIPELINE_STEPS_UPLOAD : PIPELINE_STEPS_URL;

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationStarted = useRef(false);
  /** One pipeline terminal failure per poll session; also suppresses duplicate "load project" 404 modal after rollback. */
  const pipelineTerminalFailureHandledRef = useRef(false);

  useEffect(() => {
    pipelineTerminalFailureHandledRef.current = false;
  }, [projectId]);

  // Render state
  const [rendering, setRendering] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [saving, setSaving] = useState(false); // "Saving to cloud" after render completes
  const [rendered, setRendered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingStudio, setDownloadingStudio] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderFrames, setRenderFrames] = useState({ rendered: 0, total: 0 });
  const [renderEtaLabel, setRenderEtaLabel] = useState<string | null>(null);
  const [cancellingRender, setCancellingRender] = useState(false);
  const renderPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderRetryCountRef = useRef(0); // how many times we've auto-retried render
  const MAX_RENDER_RETRIES = 20;

  // Auto-download trigger (only when render finishes during this session)
  const autoDownloadRef = useRef(false);

  // Smooth pipeline progress: gradually fills between discrete step updates
  const [smoothProgress, setSmoothProgress] = useState(0);
  const smoothProgressRef = useRef(0);

  useEffect(() => {
    if (!pipelineRunning) {
      setSmoothProgress(0);
      smoothProgressRef.current = 0;
      return;
    }

    // Target progress based on step (evenly spaced across 0-95%)
    const stepTargets: Record<number, number> = { 0: 3, 1: 20, 2: 48, 3: 72, 4: 100 };
    const target = stepTargets[pipelineStep] ?? 100;

    // Animate towards target in small increments
    const timer = setInterval(() => {
      smoothProgressRef.current = Math.min(
        smoothProgressRef.current + 0.4,
        target
      );
      setSmoothProgress(Math.round(smoothProgressRef.current));
    }, 150);

    return () => clearInterval(timer);
  }, [pipelineRunning, pipelineStep]);

  // Upgrade modal
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [downloadWarningMode, setDownloadWarningMode] = useState<"render" | "download">("download");
  const [showReRenderWarning, setShowReRenderWarning] = useState(false);
  const [showCancelRenderWarning, setShowCancelRenderWarning] = useState(false);
  const [showTemplateRelayoutWarning, setShowTemplateRelayoutWarning] = useState(false);
  const [renderConfirmLoading, setRenderConfirmLoading] = useState(false);
  const [showAspectFormatConfirm, setShowAspectFormatConfirm] = useState(false);
  const [aspectFormatPending, setAspectFormatPending] = useState<"landscape" | "portrait" | null>(null);
  const [aspectFormatSaving, setAspectFormatSaving] = useState(false);
  const shareAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      const target = evt.target as Node;
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setShowFontDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Scenes tab: expanded scene detail, edit modal, drag reorder
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  const [sceneEditModal, setSceneEditModal] = useState<Scene | null>(null);
  const [draggedSceneId, setDraggedSceneId] = useState<number | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<number | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<Scene | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [uploadingSceneId, setUploadingSceneId] = useState<number | null>(null);
  const [generatingImageSceneId, setGeneratingImageSceneId] = useState<number | null>(null);
  const [generatedImageSceneId, setGeneratedImageSceneId] = useState<number | null>(null);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [generateImageError, setGenerateImageError] = useState<string | null>(null);
  const [generateErrorSceneId, setGenerateErrorSceneId] = useState<number | null>(null);
  const [showAiImageUpgradeModal, setShowAiImageUpgradeModal] = useState(false);
  const [layoutsWithoutImage, setLayoutsWithoutImage] = useState<Set<string>>(new Set());
  const [layoutPropSchema, setLayoutPropSchema] = useState<Record<string, { defaults?: Record<string, unknown> }> | null>(null);
  const navigate = useNavigate();
  const missingCustomTemplate = Boolean(
    project?.custom_template_missing ||
    ((project?.template || "").startsWith("custom_") && !project?.custom_theme)
  );
  const tabsGuideSeenKey = user ? `${TABS_GUIDE_SEEN_KEY}_${user.id}` : TABS_GUIDE_SEEN_KEY;
  const [runProjectTour, setRunProjectTour] = useState(false);
  const [tabsTourStepIndex, setTabsTourStepIndex] = useState(0);
  const tourAutoStartedRef = useRef(false);
  const tourShownThisSessionRef = useRef(false);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [inlineReviewSubmitted, setInlineReviewSubmitted] = useState(false);
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [firstProjectPopupDismissed, setFirstProjectPopupDismissed] = useState(false);
  const reviewPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTabsGuide = useCallback(() => {
    if (tourShownThisSessionRef.current && user) localStorage.setItem(tabsGuideSeenKey, "true");
    tourShownThisSessionRef.current = false;
    setRunProjectTour(false);
    navigate(`/project/${id}`, { replace: true });
  }, [navigate, id, user, tabsGuideSeenKey]);
  const projectTourSteps = buildProjectTourSteps(project);
  const scenesLoaded = (project?.scenes?.length ?? 0) > 0;
  const pipelineFinished = project?.status === "generated" || project?.status === "done";
  const reviewState = project?.review_state ?? null;
  const isFirstProject = reviewState?.project_sequence === 1;
  const clearReviewPopupTimer = useCallback(() => {
    if (reviewPopupTimerRef.current) {
      clearTimeout(reviewPopupTimerRef.current);
      reviewPopupTimerRef.current = null;
    }
  }, []);
  // Pre-fetch project count when guide not seen so we can start tour when pipeline is done
  useEffect(() => {
    if (localStorage.getItem(tabsGuideSeenKey) || !user) return;
    listProjects()
      .then((res) => setProjectCount(res.data.length))
      .catch(() => setProjectCount(0));
  }, [tabsGuideSeenKey, user?.id]);
  // Start guide ONLY when: pipeline finished (all 3 stages done, status generated/done), polling stopped, 1 project, guide not seen
  useEffect(() => {
    if (localStorage.getItem(tabsGuideSeenKey) || !scenesLoaded || !project || tourAutoStartedRef.current) return;
    if (projectCount !== 1) return;
    if (!pipelineFinished || pipelineRunning) return;
    tourAutoStartedRef.current = true;
    tourShownThisSessionRef.current = true;
    setActiveTab("scenes");
    setTabsTourStepIndex(0);
    setRunProjectTour(true);
  }, [tabsGuideSeenKey, scenesLoaded, project?.id, project?.status, projectCount, pipelineFinished, pipelineRunning]);
  const handleProjectTourCallback = useCallback(
    (data: CallBackProps) => {
      if ((data as { action?: string }).action === "close" || data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
        if (tourShownThisSessionRef.current && user) localStorage.setItem(tabsGuideSeenKey, "true");
        tourShownThisSessionRef.current = false;
        setRunProjectTour(false);
        navigate(`/project/${id}`, { replace: true });
        return;
      }
      const type = (data as { type?: string }).type;
      const action = data.action;
      const index = data.index ?? 0;
      const stepsCount = projectTourSteps.length;
      const isLastStep = index === stepsCount - 1;
      if (type === "step:after" && action === "next" && isLastStep) {
        if (tourShownThisSessionRef.current && user) localStorage.setItem(tabsGuideSeenKey, "true");
        tourShownThisSessionRef.current = false;
        setRunProjectTour(false);
        navigate(`/project/${id}`, { replace: true });
        return;
      }
      if (type === "step:after" && (action === "next" || action === "prev")) {
        if (action === "next" && index === 0) setActiveTab("scenes");
        const targetIndex = action === "next" ? Math.min(index + 1, stepsCount - 1) : Math.max(index - 1, 0);
        setTabsTourStepIndex(targetIndex);
      }
    },
    [navigate, id, user, tabsGuideSeenKey, projectTourSteps.length]
  );
  useEffect(() => {
    if (runProjectTour) setTabsTourStepIndex(0);
  }, [runProjectTour]);

  useEffect(() => {
    clearReviewPopupTimer();
    setReviewSubmitting(false);
    setReviewError(null);
    setInlineReviewSubmitted(false);
    setShowReviewPopup(false);
    if (!project?.id) {
      setFirstProjectPopupDismissed(false);
      return;
    }
    try {
      setFirstProjectPopupDismissed(
        window.localStorage.getItem(getFirstProjectReviewPopupDismissedKey(project.id)) === "1"
      );
    } catch {
      setFirstProjectPopupDismissed(false);
    }
  }, [project?.id, clearReviewPopupTimer]);

  useEffect(() => {
    if (reviewState?.has_review_for_project) {
      clearReviewPopupTimer();
      setShowReviewPopup(false);
    }
  }, [reviewState?.has_review_for_project, clearReviewPopupTimer]);

  useEffect(() => {
    clearReviewPopupTimer();
    if (
      !project?.id ||
      !reviewState ||
      reviewState.has_review_for_project ||
      !pipelineFinished ||
      !isFirstProject ||
      firstProjectPopupDismissed
    ) {
      setShowReviewPopup(false);
      return;
    }
    reviewPopupTimerRef.current = setTimeout(() => {
      setShowReviewPopup(true);
    }, FIRST_PROJECT_REVIEW_POPUP_DELAY_MS);

    return clearReviewPopupTimer;
  }, [
    project?.id,
    reviewState?.has_review_for_project,
    pipelineFinished,
    isFirstProject,
    firstProjectPopupDismissed,
    clearReviewPopupTimer,
  ]);

  useEffect(() => {
    return clearReviewPopupTimer;
  }, [clearReviewPopupTimer]);

  const submitReview = useCallback(async ({
    rating,
    suggestion,
    source,
    triggerEvent,
    surface,
  }: {
    rating: 1 | 2 | 3 | 4 | 5;
    suggestion?: string;
    source: "first_project_popup" | "inline_row";
    triggerEvent: "delayed_popup" | "manual";
    surface: "inline" | "popup";
  }) => {
    if (!project) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const response = await submitProjectReview(project.id, {
        rating,
        suggestion,
        source,
        trigger_event: triggerEvent,
      });
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          review_state: response.data.review_state,
        };
      });
      if (surface === "inline") {
        setInlineReviewSubmitted(true);
      } else {
        setShowReviewPopup(false);
        setInlineReviewSubmitted(false);
      }
    } catch (err) {
      setReviewError(getErrorMessage(err, "Failed to save your review."));
    } finally {
      setReviewSubmitting(false);
    }
  }, [project]);
  const handleInlineSubmitReview = useCallback(({
    rating,
    suggestion,
  }: {
    rating: 1 | 2 | 3 | 4 | 5;
    suggestion?: string;
  }) => submitReview({
    rating,
    suggestion,
    source: "inline_row",
    triggerEvent: "manual",
    surface: "inline",
  }), [submitReview]);
  const handlePopupSubmitReview = useCallback(({
    rating,
    suggestion,
  }: {
    rating: 1 | 2 | 3 | 4 | 5;
    suggestion?: string;
  }) => submitReview({
    rating,
    suggestion,
    source: "first_project_popup",
    triggerEvent: "delayed_popup",
    surface: "popup",
  }), [submitReview]);
  const handleDismissReviewPopup = useCallback(() => {
    if (!project) return;
    clearReviewPopupTimer();
    setShowReviewPopup(false);
    setFirstProjectPopupDismissed(true);
    try {
      window.localStorage.setItem(getFirstProjectReviewPopupDismissedKey(project.id), "1");
    } catch {
      // Ignore storage failures and fall back to in-memory dismissal for this page.
    }
  }, [project, clearReviewPopupTimer]);
  const [sceneFontOverrides, setSceneFontOverrides] = useState<Record<number, { title: number; desc: number }>>({});
  const [savingFontSizes, setSavingFontSizes] = useState<number | null>(null);
  const fontSaveTimeoutRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const fontPendingRef = useRef<Record<number, { title: number; desc: number }>>({});

  // Images tab: toggling exclusion
  const [togglingAsset, setTogglingAsset] = useState<number | null>(null);

  // Video blob URL for playback (fetched via backend to avoid CORS, loads completely)
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  // Fetch video as blob when project is done — ensures full load, no CORS
  // useEffect(() => {
  //   if (project?.status !== "done" || !projectId) {
  //     if (videoBlobUrl) {
  //       window.URL.revokeObjectURL(videoBlobUrl);
  //       setVideoBlobUrl(null);
  //     }
  //     return;
  //   }
  //   let revoked = false;
  //   setVideoLoading(true);
  //   fetchVideoBlob(projectId)
  //     .then((url) => {
  //       if (!revoked) {
  //         setVideoBlobUrl(url);
  //       } else {
  //         window.URL.revokeObjectURL(url);
  //       }
  //     })
  //     .catch(() => {
  //       if (!revoked) setVideoBlobUrl(null);
  //     })
  //     .finally(() => {
  //       if (!revoked) setVideoLoading(false);
  //     });
  //   return () => {
  //     revoked = true;
  //   };
  // }, [project?.status, projectId]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoBlobUrl) {
        window.URL.revokeObjectURL(videoBlobUrl);
      }
    };
  }, [videoBlobUrl]);

 // Auto-download once render finishes
// useEffect(() => {
//   // 1. Only run if rendered is true and we haven't auto-downloaded yet
//   if (!autoDownloadRef.current || !rendered || !project) return;

//   console.log("autoDownload triggered", autoDownloadRef.current);

//   const tryAutoDownload = async () => {

//     console.log("Function called!")
//     let currentProject = project;
//     let attempts = 0;
//     const maxAttempts = 6;

//     while (attempts < maxAttempts) {
//       // 2. Check if we actually have the URL yet
//       if (currentProject.r2_video_url) {
//         try {
//           // IMPORTANT: Use the native link method, NOT the axios-based downloadVideo
//           const safeName = currentProject.name?.replace(/\s+/g, "_").slice(0, 50) || "video";
//           const cacheBuster = `?v=${new Date().getTime()}`;
//           const finalUrl = currentProject.r2_video_url + cacheBuster;

//           const link = document.createElement("a");
//           link.href = finalUrl;
//           link.setAttribute("download", `${safeName}.mp4`);
//           // Use target _blank to handle cases where download attribute is ignored
//           link.target = "_blank"; 
          
//           document.body.appendChild(link);
//           link.click();
//           document.body.removeChild(link);

//           autoDownloadRef.current = false;
//           return;
//         } catch (err) {
//           console.error("Auto-download trigger failed", err);
//         }
//       }

//       attempts++;
//       if (attempts < maxAttempts) {
//         await new Promise((r) => setTimeout(r, 2000));
//         const updated = await loadProject(); 
//         if (updated) currentProject = updated;
//       }
//     }

//     autoDownloadRef.current = false; 
//   };

//   // tryAutoDownload();
// }, [rendered, project?.r2_video_url]); 

  const loadProject = useCallback(
    async (opts?: { silent404?: boolean }) => {
      try {
        const res = await getProject(projectId);
        setProject(res.data);
        setHasError(false); // clear any previous load errors on success
        if (res.data.status === "done" || (res.data.status === "rendering" && res.data.r2_video_url)) {
          setRendered(true);
        }
        // Fetch layout image-support info (non-blocking)
        getValidLayouts(projectId).then((lr) => {
          setLayoutsWithoutImage(new Set(lr.data.layouts_without_image ?? []));
          setLayoutPropSchema(lr.data.layout_prop_schema ?? null);
        }).catch(() => {/* ignore */});
        return res.data;
      } catch (err: unknown) {
        const status =
          err &&
          typeof err === "object" &&
          "response" in err &&
          typeof (err as { response?: { status?: number } }).response?.status === "number"
            ? (err as { response: { status: number } }).response.status
            : undefined;
        // Poller can call loadProject right after the worker deletes the row (race with stale `running: true`).
        if (status === 404 && opts?.silent404) {
          return null;
        }
        // After scrape/pipeline rollback the project row is gone; polling may still call loadProject once.
        if (status === 404 && pipelineTerminalFailureHandledRef.current) {
          setHasError(true);
          return null;
        }
        showError("Failed to load project"); setHasError(true);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [projectId, showError],
  );

  const handlePreviewPlaybackSpeedChange = useCallback(
    async (speed: number) => {
      if (!project) return;
      const normalized = Math.min(2.5, Math.max(0.5, Math.round(speed * 10) / 10));
      setPlaybackSpeedDraft(normalized);
      pendingPlaybackSpeedRef.current = normalized;
      if (savingPlaybackSpeedRef.current) return;

      setSavingPlaybackSpeed(true);
      savingPlaybackSpeedRef.current = true;
      try {
        while (pendingPlaybackSpeedRef.current !== null) {
          const nextSpeed = pendingPlaybackSpeedRef.current;
          pendingPlaybackSpeedRef.current = null;
          await updateProject(project.id, { playback_speed: nextSpeed });
          await loadProject();
        }
      } catch (err) {
        showError(getErrorMessage(err, "Failed to save playback speed."));
      } finally {
        setSavingPlaybackSpeed(false);
        savingPlaybackSpeedRef.current = false;
      }
    },
    [project, loadProject, showError],
  );

  const stopTemplateRelayoutPolling = useCallback(() => {
    if (templateRelayoutPollRef.current) {
      clearInterval(templateRelayoutPollRef.current);
      templateRelayoutPollRef.current = null;
    }
  }, []);

  const startTemplateRelayoutPolling = useCallback(() => {
    stopTemplateRelayoutPolling();
    templateRelayoutPollRef.current = setInterval(async () => {
      try {
        const res = await getProjectTemplateChangeStatus(projectId);
        const job = res.data;
        if (!job) return;
        setTemplateRelayoutJob(job);
        if (job.status === "completed") {
          stopTemplateRelayoutPolling();
          setTemplateRelayoutJob({
            ...job,
            processed_scenes: 0,
            total_scenes: 0,
          });
          await loadProject();
        } else if (job.status === "failed") {
          stopTemplateRelayoutPolling();
        }
      } catch {
        stopTemplateRelayoutPolling();
      }
    }, 2000);
  }, [loadProject, projectId, stopTemplateRelayoutPolling]);

  useEffect(() => {
    let cancelled = false;
    setCustomTemplatesLoading(true);
    getTemplates()
      .then((r) => {
        if (!cancelled) setTemplateMetas(r.data || []);
      })
      .catch(() => {});
    listCustomTemplates()
      .then((r) => {
        if (!cancelled) setCustomTemplatesList(r.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCustomTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
      stopTemplateRelayoutPolling();
    };
  }, [stopTemplateRelayoutPolling]);

  useEffect(() => {
    const refreshTemplateJob = async () => {
      try {
        const res = await getProjectTemplateChangeStatus(projectId);
        if (!res.data) return;
        setTemplateRelayoutJob(res.data);
        if (res.data.status === "queued" || res.data.status === "running") {
          startTemplateRelayoutPolling();
        }
      } catch {
        // ignore
      }
    };
    refreshTemplateJob();
  }, [projectId, startTemplateRelayoutPolling]);

  // Handle ?purchased=true redirect from Stripe per-video checkout
  useEffect(() => {
    if (searchParams.get("purchased") === "true") {
      trackGoogleAdsPurchaseConversion(searchParams.get("session_id"));
      // Clear the query param and refresh project to pick up studio_unlocked
      setSearchParams({}, { replace: true });
      loadProject();
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start generation when project loads and isn't complete
  useEffect(() => {
    const init = async () => {
      // silent404: scrape can delete the row before this GET returns; avoid "Failed to load" before tombstone.
      const proj = await loadProject({ silent404: true });
      if (!proj || generationStarted.current) {
        if (!proj && !generationStarted.current) {
          try {
            const st = await getPipelineStatus(projectId);
            const d = st.data;
            const tombstoneMsg =
              typeof d.error === "string" && d.error.trim() ? d.error.trim() : null;
            const rolledBack =
              Boolean(d.project_removed) || d.status === "failed";
            if (tombstoneMsg || rolledBack) {
              if (!pipelineTerminalFailureHandledRef.current) {
                pipelineTerminalFailureHandledRef.current = true;
                showError(
                  tombstoneMsg ||
                    "Something went wrong while creating your video. Please try again.",
                  { variant: "pipeline" },
                );
              }
              setHasError(true);
              setPipelineRunning(false);
              if (rolledBack) {
                navigate("/dashboard", { replace: true });
              }
              return;
            }
          } catch {
            // ignore — fall through to generic not-found handling
          }
          showError("Failed to load project");
          setHasError(true);
        }
        return;
      }

      // Check for pending document upload (from Dashboard upload flow)
      const pendingFiles = getPendingUpload(projectId);
      if (pendingFiles && pendingFiles.length > 0 && proj.status === "created") {
        generationStarted.current = true;
        setPipelineRunning(true);
        setPipelineStep(1); // "Uploading" step
        setHasError(false);
        try {
          await uploadProjectDocuments(projectId, pendingFiles);
          // Reload project (status is now SCRAPED)
          await loadProject();
          // Now kick off the generation pipeline (starts at script step)
          await startGeneration(projectId);
          startPolling();
        } catch (err: any) {
          showError(getErrorMessage(err, "Failed to upload documents."), {
            variant: "pipeline",
          });
          setHasError(true);
          setPipelineRunning(false);
        }
        return;
      }

      const needsGeneration = ["created", "scraped", "scripted"].includes(
        proj.status
      );
      if (needsGeneration) {
        generationStarted.current = true;
        kickOffGeneration();
      }
    };
    init();
    return () => {
      stopPolling();
      stopRenderPolling();
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kickOffGeneration = async () => {
    setPipelineRunning(true);
    setPipelineStep(0);
    setHasError(false);
    pipelineTerminalFailureHandledRef.current = false;

    try {
      await startGeneration(projectId);
      startPolling();
    } catch (err: any) {
      showError(getErrorMessage(err, "Failed to start generation. Please try again or contact support, if the issue persist.")); setHasError(true);
      setPipelineRunning(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    pipelineTerminalFailureHandledRef.current = false;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await getPipelineStatus(projectId);
        const { step, running, error: pipelineError, status, notice } = res.data;
        const rolledBackProject =
          Boolean(res.data.project_removed) || status === "failed";
        const pipelineErrMsg =
          typeof pipelineError === "string" && pipelineError.trim()
            ? pipelineError.trim()
            : null;

        setPipelineStep(step);

        // Terminal generation failure (scrape/script/scene rollback, or tombstone after delete).
        // Treat `status === "failed"` like an error even if `error` is missing briefly — avoids
        // falling through to `loadProject()` and showing a second "Failed to load project" modal.
        if (pipelineErrMsg || rolledBackProject) {
          if (!pipelineTerminalFailureHandledRef.current) {
            pipelineTerminalFailureHandledRef.current = true;
            const message =
              pipelineErrMsg ||
              "Something went wrong while creating your video. Please try again.";
            console.error("Pipeline error while generating video:", message);
            showError(message, { variant: "pipeline" });
          }
          setHasError(true);
          setPipelineRunning(false);
          stopPolling();
          if (rolledBackProject) {
            navigate("/dashboard", { replace: true });
          } else {
            try {
              await loadProject({ silent404: true });
            } finally {
              pipelineTerminalFailureHandledRef.current = false;
            }
          }
          return;
        }

        // Backend says pipeline is done — but verify the project status.
        // On Cloud Run, the in-memory progress dict can be lost if a new
        // container handles the poll.  If the project is still mid-generation,
        // keep the loader visible and keep polling.
        if (!running) {
          const stillGenerating = ["created", "scraped", "scripted"].includes(
            status
          );
          if (stillGenerating) {
            // Progress was lost (container restart / cold start).
            // Keep polling — the pipeline task is still running on the
            // original instance or will be retried.
            await loadProject({ silent404: true });
            return;
          }
          setPipelineRunning(false);
          stopPolling();
          if (notice?.code === "video_shortened") {
            showNotice(
              notice.message ||
                "We shortened the video because the scraped/uploaded content was too short for your selected length.",
              { title: "Video shortened" }
            );
          }
          await loadProject({ silent404: true });
          return;
        }

        await loadProject({ silent404: true });
      } catch {
        // Network hiccup -- keep polling
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const stopRenderPolling = () => {
    if (renderPollingRef.current) {
      clearInterval(renderPollingRef.current);
      clearTimeout(renderPollingRef.current);
      renderPollingRef.current = null;
    }
  };

  // Track highest-seen render progress so we never go backward (also persisted while rendering)
  const renderHighWaterRef = useRef(0);
  const renderResumeInitRef = useRef(false);
  /** Wall time when we first saw rendered_frames > 0 (client ETA fallback only). */
  const renderStartWallRef = useRef<number | null>(null);
  // Monotonic ETA: once it has decreased at least once, never allow it to increase again.
  const renderEtaLastSecRef = useRef<number | null>(null);
  const renderEtaWentDownRef = useRef(false);
  const lastRenderAttemptRef = useRef(1);
  const renderKickoffPendingRef = useRef(false);
  const renderCancelRequestedRef = useRef(false);
  const expectedRenderRunIdRef = useRef<string | null>(null);
  const handleRenderRef = useRef<(force: boolean, onStart?: () => void) => Promise<void>>();

  const handleRender = async (
    forceReRender = false,
    onRenderStarted?: () => void
  ) => {
    if (missingCustomTemplate) {
      onRenderStarted?.();
      showError(
        "You can't render this video because its custom template has been deleted."
      );
      setRendering(false);
      return;
    }

    // Re-render while already rendering — skip API call, take user to status page instead
    if (forceReRender && project?.status === "rendering") {
      renderCancelRequestedRef.current = false;
      renderKickoffPendingRef.current = false;
      onRenderStarted?.();
      setRendered(false);
      setRendering(true);
      setHasError(false);
      setRenderEtaLabel(null);
      renderEtaLastSecRef.current = null;
      renderEtaWentDownRef.current = false;
      const key = `render_hw_${projectId}`;
      const hw = sessionStorage.getItem(key);
      if (hw) {
        const n = parseInt(hw, 10);
        if (!Number.isNaN(n)) {
          renderHighWaterRef.current = n;
          setRenderProgress(n);
        }
      }
      renderStartWallRef.current = null;
      startRenderPollingLoop({ isResume: true });
      return;
    }

    // If already rendered and available in R2, skip straight to download (unless forcing re-render)
    if (!forceReRender && project?.r2_video_url) {
      setRendered(true);
      setRendering(false);
      onRenderStarted?.();
      return;
    }

    // Reset render state so auto-download triggers when we flip rendered -> true again
    renderCancelRequestedRef.current = false;
    expectedRenderRunIdRef.current = null;
    setRendered(false);
    autoDownloadRef.current = false;
    setRendering(true);
    setRenderProgress(0);
    setRenderFrames({ rendered: 0, total: 0 });
    setRenderEtaLabel(null);
    renderEtaLastSecRef.current = null;
    renderEtaWentDownRef.current = false;
    setHasError(false);
    renderHighWaterRef.current = 0;
    renderRetryCountRef.current = 0;
    sessionStorage.removeItem(`render_hw_${projectId}`);
    renderStartWallRef.current = null;
    lastRenderAttemptRef.current = 1;

    const startRenderAndPoll = async () => {
      // Start polling immediately so users can see "preparing" phases while
      // the /render call is still doing backend setup work.
      renderKickoffPendingRef.current = true;
      startRenderPollingLoop({ isResume: false });
      // Close confirmation modal immediately; render startup continues in background.
      onRenderStarted?.();
      try {
        console.log("rendering started")
        const startRes = await renderVideo(projectId, forceReRender);
        const runId = startRes?.data?.render_run_id;
        if (runId != null && String(runId).trim()) {
          expectedRenderRunIdRef.current = String(runId);
        }
        renderKickoffPendingRef.current = false;
      } catch (err: any) {
        renderKickoffPendingRef.current = false;
        const message = getErrorMessage(err, "");
        if (
          err?.response?.status === 409 &&
          message.toLowerCase().includes("deleted custom template")
        ) {
          showError(message);
          setHasError(true);
          setRendering(false);
          stopRenderPolling();
          return;
        }
        // Video limit reached (403) — show upgrade modal + mention download option
        if (err?.response?.status === 403) {
          const baseMsg = message || "Video limit reached. Re-render counts as a video. Upgrade your plan or buy more credits to continue.";
          const hasExisting = Boolean(project?.r2_video_url);
          showError(baseMsg, { showUpgrade: true });
          setHasError(true);
          setRendering(false);
          if (hasExisting) setRendered(true);
          stopRenderPolling();
          return;
        }
        // If this is a retry, keep going; otherwise show error
        if (renderRetryCountRef.current >= MAX_RENDER_RETRIES) {
          showError(getErrorMessage(err, "Render failed after multiple attempts. Please try again, or contact support, if the issue persist.")); setHasError(true);
          setRendering(false);
          return;
        }
      }
    };

    startRenderAndPoll();
  };
  handleRenderRef.current = handleRender;

  const handleCancelRender = useCallback(async () => {
    if (!projectId || cancellingRender) return;
    try {
      setCancellingRender(true);
      renderCancelRequestedRef.current = true;
      await cancelRender(projectId);
      renderKickoffPendingRef.current = false;
      expectedRenderRunIdRef.current = null;
      sessionStorage.removeItem(`render_hw_${projectId}`);
      renderHighWaterRef.current = 0;
      stopRenderPolling();
      setSaving(false);
      setRenderEtaLabel("Render cancelled");
      setHasError(false);
      showNotice("Render cancelled.", {
        onClose: () => {
          setRendering(false);
          setRenderFrames({ rendered: 0, total: 0 });
          setRenderProgress(0);
          renderCancelRequestedRef.current = false;
          void loadProject();
        },
      });
    } catch (err) {
      renderCancelRequestedRef.current = false;
      showError(getErrorMessage(err, "Failed to cancel render."));
    } finally {
      setCancellingRender(false);
    }
  }, [projectId, cancellingRender, loadProject, showNotice, showError]);

  /** Start polling render status. When isResume=true, we're resuming (no retry on error). */
  const startRenderPollingLoop = useCallback(
    (opts?: { isResume?: boolean }) => {
      const isResume = opts?.isResume ?? false;
      const poll = async () => {
        try {
          const status = await getRenderStatus(projectId);
          const {
            progress,
            rendered_frames,
            total_frames,
            done,
            error: renderErr,
            time_remaining: timeRemaining,
            eta_seconds: etaSecondsApi,
            progress_unknown: progressUnknown,
            render_attempt: renderAttempt,
            render_run_id: renderRunId,
          } = status.data;

          if (
            renderKickoffPendingRef.current &&
            (done || Boolean(renderErr) || progress > 0 || rendered_frames > 0)
          ) {
            // Ignore terminal/progress-bearing stale snapshots while /render is still in-flight.
            return;
          }

          const expectedRunId = expectedRenderRunIdRef.current;
          if (expectedRunId) {
            const incomingRunId =
              renderRunId != null && String(renderRunId).trim()
                ? String(renderRunId)
                : null;
            const hasTerminalOrProgressSignal =
              Boolean(done) ||
              Boolean(renderErr) ||
              (Number(progress) > 0) ||
              (Number(rendered_frames) > 0);
            if (incomingRunId && incomingRunId !== expectedRunId) {
              return; // stale snapshot from an older run
            }
            if (!incomingRunId && hasTerminalOrProgressSignal) {
              return; // legacy/stale payload without run id while waiting for current run
            }
          }

          // During re-render kickoff, ignore stale "done=100%" snapshots from
          // the previous render until /render acknowledges the new run.
          if (renderKickoffPendingRef.current && done && !renderErr) {
            return;
          }

          const attempt = renderAttempt ?? 1;
          if (attempt > lastRenderAttemptRef.current) {
            lastRenderAttemptRef.current = attempt;
            renderHighWaterRef.current = 0;
            setRenderProgress(0);
            setRenderFrames({ rendered: 0, total: 0 });
            sessionStorage.removeItem(`render_hw_${projectId}`);
            renderStartWallRef.current = null;
            renderEtaLastSecRef.current = null;
            renderEtaWentDownRef.current = false;
          }

          if (rendered_frames > 0 && renderStartWallRef.current === null) {
            renderStartWallRef.current = Date.now();
          }

          if (progress >= renderHighWaterRef.current) {
            renderHighWaterRef.current = progress;
            setRenderProgress(progress);
            if (progress > 0) {
              sessionStorage.setItem(`render_hw_${projectId}`, String(progress));
            }
          }
          if (rendered_frames > 0) {
            setRenderFrames({ rendered: rendered_frames, total: total_frames });
          }

          const hasStartupStatus =
            !done &&
            !renderErr &&
            rendered_frames === 0 &&
            total_frames === 0 &&
            progress === 0 &&
            typeof timeRemaining === "string" &&
            timeRemaining.trim().length > 0;
          if (!done && !renderErr && rendered_frames === 0 && total_frames === 0 && progress === 0) {
            const prep = hasStartupStatus ? timeRemaining.trim() : "Preparing render...";
            setRenderEtaLabel(prep);
          }

          // ETA: server uses seconds/frame from consecutive lines (linear in work left).
          // Fallback: (remaining_frames / rendered_frames) × elapsed since first frame — not %, which mixed startup into elapsed.
          if (!progressUnknown || progress > 0 || rendered_frames > 0) {
            if (
              etaSecondsApi != null &&
              Number.isFinite(etaSecondsApi) &&
              etaSecondsApi >= 1
            ) {
              let nextSec = etaSecondsApi;
              const lastSec = renderEtaLastSecRef.current;
              if (lastSec != null) {
                if (nextSec < lastSec) renderEtaWentDownRef.current = true;
                if (renderEtaWentDownRef.current && nextSec > lastSec) {
                  nextSec = lastSec;
                }
              }
              renderEtaLastSecRef.current = nextSec;
              setRenderEtaLabel(formatEtaSecondsRounded(nextSec));
            } else if (
              rendered_frames > 0 &&
              total_frames > 0 &&
              rendered_frames < total_frames &&
              renderStartWallRef.current != null
            ) {
              const elapsed = (Date.now() - renderStartWallRef.current) / 1000;
              const rawEta =
                (elapsed * (total_frames - rendered_frames)) / rendered_frames;
              if (Number.isFinite(rawEta) && rawEta >= 1) {
                let nextSec = rawEta;
                const lastSec = renderEtaLastSecRef.current;
                if (lastSec != null) {
                  if (nextSec < lastSec) renderEtaWentDownRef.current = true;
                  if (renderEtaWentDownRef.current && nextSec > lastSec) {
                    nextSec = lastSec;
                  }
                }
                renderEtaLastSecRef.current = nextSec;
                setRenderEtaLabel(formatEtaSecondsRounded(nextSec));
              } else {
                // Avoid showing a misleading early "0s".
                setRenderEtaLabel(null);
              }
            } else if (progress >= 100) {
              setRenderEtaLabel("Almost done");
            } else if (
              progress >= 100 ||
              (total_frames > 0 && rendered_frames >= total_frames)
            ) {
              setRenderEtaLabel("Almost done");
            } else if (total_frames === 0 && progress === 0) {
              // Keep explicit backend startup phase text (e.g. "Preparing workspace...").
              if (!hasStartupStatus) setRenderEtaLabel(null);
            } else {
              // No meaningful ETA yet; don't keep an old "0s" value.
              if (progress > 0 || rendered_frames > 0) setRenderEtaLabel(null);
            }
          }

          if (renderErr) {
            const msg =
              typeof renderErr === "string" && renderErr.trim()
                ? renderErr
                : "Render failed after multiple attempts. Please try re-rendering.";
            if (
              renderKickoffPendingRef.current &&
              /cancel|cancelled|canceled|no longer rendering|project was deleted/i.test(msg)
            ) {
              return;
            }
            const isExpectedCancel =
              renderCancelRequestedRef.current &&
              /cancel|cancelled|canceled|no longer rendering|project was deleted/i.test(msg);
            if (isExpectedCancel) {
              stopRenderPolling();
              setRendering(false);
              setSaving(false);
              setHasError(false);
              return;
            }
            showError(msg);
            setHasError(true);
            setRendering(false);
            stopRenderPolling();
            return;
          }

          const allFramesRendered =
            progress >= 100 && total_frames > 0 && rendered_frames >= total_frames;

          if (done || allFramesRendered) {
            setRenderProgress(100);
            stopRenderPolling();
            setRendering(false);
            setSaving(true);

            const maxWait = 120;
            for (let i = 0; i < maxWait; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const [statusRes, fresh] = await Promise.all([
                getRenderStatus(projectId),
                loadProject(),
              ]);
              const renderDone = statusRes?.data?.done === true && !statusRes?.data?.error;
              const hasVideoUrl = Boolean(fresh?.r2_video_url);
              const localDone = fresh?.status === "done" && !fresh?.r2_video_url && i >= 2;
              if (renderDone && (hasVideoUrl || localDone)) break;
            }

            setSaving(false);
            setRendered(true);
            autoDownloadRef.current = true;
            const freshProject = await loadProject();
            const directUrl = freshProject?.r2_video_url;
            if (directUrl) {
              window.open(directUrl, "_blank", "noopener,noreferrer");
            }
          }
        } catch {
          /* keep polling */
        }
      };

      stopRenderPolling();
      const pollStartedAt = Date.now();
      let currentIntervalMs = 2000;

      const schedule = () => {
        renderPollingRef.current = setTimeout(async () => {
          await poll();
          const stillInWarmup = Date.now() - pollStartedAt < 60000;
          const desiredMs = stillInWarmup ? 2000 : 10000;
          currentIntervalMs = desiredMs;
          if (renderPollingRef.current) schedule();
        }, currentIntervalMs);
      };

      poll(); // immediate first poll
      schedule();
    },
    [projectId]
  );

  // Resume render progress after refresh/navigation when the project is still rendering
  useEffect(() => {
    renderResumeInitRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!project || project.status !== "rendering" || project.r2_video_url) return;
    if (renderPollingRef.current) return;
    if (renderResumeInitRef.current) return;
    renderResumeInitRef.current = true;
    const key = `render_hw_${projectId}`;
    const hw = sessionStorage.getItem(key);
    if (hw) {
      const n = parseInt(hw, 10);
      if (!Number.isNaN(n)) {
        renderHighWaterRef.current = Math.max(renderHighWaterRef.current, n);
        setRenderProgress(renderHighWaterRef.current);
      }
    }
    renderStartWallRef.current = null;
    setRendering(true);
    setRenderEtaLabel(null);
    renderEtaLastSecRef.current = null;
    renderEtaWentDownRef.current = false;
    startRenderPollingLoop({ isResume: true });
  }, [projectId, project?.status, project?.r2_video_url, startRenderPollingLoop]);

  const handleDownload = async () => {
    if (!project || !project.r2_video_url) {
      showError("Video URL not found. Please wait for rendering to finish.");
      return;
    }

    setDownloading(true);
    setHasError(false);

    try {
      // 1. Generate the filename
      const safeName = project.name?.replace(/\s+/g, "_").slice(0, 50) || "video";
      
      // 2. Use the R2 URL from your project object
      // We add a timestamp to ensure the browser doesn't serve a cached old version
      const cacheBuster = `?v=${new Date(project.updated_at).getTime()}`;
      const finalUrl = project.r2_video_url + cacheBuster;

      // 3. Trigger a Native Browser Download
      // This bypasses Axios/Fetch and avoids the "Network Error" CORS block
      const link = document.createElement("a");
      link.href = finalUrl;
      link.setAttribute("download", `${safeName}.mp4`);
      
      // For cross-origin downloads to work correctly with the 'download' attribute,
      // the R2 bucket must have the correct CORS headers (see below).
      link.target = "_blank"; 
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloading(false);
    } catch (err: any) {
      console.error("Download trigger failed:", err);
      showError("Could not start download. Try right-clicking the video and 'Save As'.");
      setHasError(true);
      setDownloading(false);
    }
  };


  const handleCopyDownloadLink = async () => {
    try {
      if (!project?.r2_video_url) {
        setCopyStatus("error");
        return;
      }

      await navigator.clipboard.writeText(project.r2_video_url);
      setCopyStatus("success");

      setTimeout(() => {
        setCopyStatus("idle");
      }, 2500);
    } catch (err) {
      console.error("Copy failed", err);
      setCopyStatus("error");

      setTimeout(() => {
        setCopyStatus("idle");
      }, 2500);
    }
  };

  const handleOpenStudio = async () => {
    if (!project) return;
    setDownloadingStudio(true);
    setHasError(false);
    try {
      const res = await launchStudio(projectId);
      const url = res.data.studio_url;
      if (url) {
        window.open(url, "_blank");
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgrade(true);
      } else {
        showError(getErrorMessage(err, "Failed to launch Studio.")); setHasError(true);
      }
    } finally {
      setDownloadingStudio(false);
    }
  };

  const handleDownloadStudio = async () => {
    if (!project) return;
    setDownloadingStudio(true);
    try {
      const safeName =
        project.name?.replace(/\s+/g, "_").slice(0, 50) || "project";
      await downloadStudioZip(projectId, `${safeName}_studio.zip`);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setShowUpgrade(true);
      } else {
        showError(getErrorMessage(err, "Studio download failed.")); setHasError(true);
      }
    } finally {
      setDownloadingStudio(false);
    }
  };

  const handleToggleExclusion = async (assetId: number) => {
    if (!project || !isPro) return;
    setTogglingAsset(assetId);
    try {
      const res = await toggleAssetExclusion(projectId, assetId);
      // Update local state
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          assets: prev.assets.map((a) =>
            a.id === assetId ? { ...a, excluded: res.data.excluded } : a
          ),
        };
      });
    } catch {
      // Silently fail
    } finally {
      setTogglingAsset(null);
    }
  };

  const applyTemplateRelayout = async () => {
    if (!project || !templateRelayoutPendingId) return;
    const targetId = templateRelayoutPendingId;
    setSubmittingTemplateRelayout(true);
    try {
      const res = await changeProjectTemplateRegenerateLayouts(project.id, targetId);
      setTemplateRelayoutJob(res.data);
      startTemplateRelayoutPolling();
    } catch (err) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      showError(
        getErrorMessage(err, "Failed to start template relayout."),
        status === 403 ? { showUpgrade: true } : undefined
      );
    } finally {
      setSubmittingTemplateRelayout(false);
    }
  };

  const assignedTemplateId = project?.template || "default";
  const readyCustomForPicker = customTemplatesList.filter((ct) => !!ct.intro_code);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        Project not found.
      </div>
    );
  }

  const openCraftCustomTemplateFromProjectSettings = () => {
    if (!isPro) {
      setShowUpgrade(true);
      return;
    }
    const style = normalizeVideoStyle(project.video_style);
    setShowTemplateChangeModal(false);
    const params = new URLSearchParams();
    params.set("tab", "templates");
    params.set("openCustomCreator", "1");
    params.set("videoStyle", style);
    navigate(`/dashboard?${params.toString()}`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "script", label: "Script" },
    { id: "images", label: "Images" },
    ...(project.voice_gender !== "none" ? [{ id: "audio" as Tab, label: "Audio" }] : []),
    { id: "scenes", label: "Scenes" },
    { id: "settings", label: "Settings" },
  ];

  const pipelineComplete = ["generated", "rendering", "done"].includes(
    project.status
  );
  const showInlineReviewPrompt = Boolean(
    inlineReviewSubmitted ||
      (
        !reviewState?.has_review_for_project &&
        (
          reviewState?.should_show_inline ||
          (isFirstProject && firstProjectPopupDismissed)
        )
      )
  );

  // ─── Distribute blog images across scenes (match VideoPreview logic) ────────────────
  const imageAssets = project.assets.filter((a) => a.asset_type === "image");
  const activeImageAssets = imageAssets
    .filter((a) => !a.excluded)
    .slice()
    .sort((a, b) => {
      const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ad !== bd) return ad - bd;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  const sceneImageMap: Record<number, string[]> = {};
  const sceneImageAssetsMap: Record<number, SceneImageItem[]> = {};
  const hideImageFlags: boolean[] = new Array(project.scenes.length).fill(false);
  if (project.scenes.length > 0 && activeImageAssets.length > 0) {
    project.scenes.forEach((_, idx) => {
      sceneImageMap[idx] = [];
      sceneImageAssetsMap[idx] = [];
    });

    // Build filename -> asset lookup
    const filenameToAsset = new Map<string, typeof activeImageAssets[0]>();
    activeImageAssets.forEach((asset) => filenameToAsset.set(asset.filename, asset));

    const usedGenericFiles = new Set<string>();

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
      if (hideImage) {
        // Skip auto-assignment for scenes with hideImage=true
        return;
      }

      const assignedImage = layoutProps.assignedImage as string | undefined;
      if (assignedImage && filenameToAsset.has(assignedImage)) {
        const m = assignedImage.match(/^scene_(\d+)_/);
        if (m) {
          // Scene-specific assignment must match current scene id (one image per scene)
          const assignedSceneId = parseInt(m[1], 10);
          if (assignedSceneId === scene.id) {
            const asset = filenameToAsset.get(assignedImage)!;
            const url = resolveAssetUrl(asset, project.id);
            sceneImageMap[idx] = [url];
            sceneImageAssetsMap[idx] = [{ url, asset }];
            usedGenericFiles.add(assignedImage);
          }
        } else {
          // Generic assignment: enforce 1 generic -> 1 scene (one image per scene)
          if (!usedGenericFiles.has(assignedImage)) {
            const asset = filenameToAsset.get(assignedImage)!;
            const url = resolveAssetUrl(asset, project.id);
            sceneImageMap[idx] = [url];
            sceneImageAssetsMap[idx] = [{ url, asset }];
            usedGenericFiles.add(assignedImage);
          }
        }
      }
    });

    // 2) Second pass: Scene-specific images (overwrite stored assignments)
    // Scene-specific images: filename "scene_<sceneId>_<timestamp>.*" (from AI edit upload)
    const sceneSpecific: { sceneId: number; url: string; asset: (typeof activeImageAssets)[0] }[] = [];
    const genericAssets: typeof activeImageAssets = [];
    for (const asset of activeImageAssets) {
      const match = asset.filename.match(/^scene_(\d+)_/);
      if (match) {
        const sceneId = parseInt(match[1], 10);
        sceneSpecific.push({
          sceneId,
          url: resolveAssetUrl(asset, project.id),
          asset,
        });
      } else {
        genericAssets.push(asset);
      }
    }
    // Apply scene-specific images (later uploads overwrite by same scene_id)
    for (const { sceneId, url, asset } of sceneSpecific) {
      const sceneIdx = project.scenes.findIndex((s) => s.id === sceneId);
      if (sceneIdx >= 0 && !hideImageFlags[sceneIdx]) {
        // Overwrite any existing assignment; scene-specific re-enables images
        sceneImageMap[sceneIdx] = [url];
        sceneImageAssetsMap[sceneIdx] = [{ url, asset }];
      }
    }

    // 3) Third pass: Generic images: assign in order to scenes that don't have one yet
    // IMPORTANT: Skip scenes with hideImage=true. Find next unused generic per scene (match backend).
    let genericIdx = 0;
    for (let sceneIdx = 0; sceneIdx < project.scenes.length; sceneIdx++) {
      if (sceneImageMap[sceneIdx].length > 0 || hideImageFlags[sceneIdx]) continue;
      while (genericIdx < genericAssets.length) {
        const candidate = genericAssets[genericIdx];
        genericIdx++;
        if (usedGenericFiles.has(candidate.filename)) continue;
        const url = resolveAssetUrl(candidate, project.id);
        sceneImageMap[sceneIdx] = [url];
        sceneImageAssetsMap[sceneIdx] = [{ url, asset: candidate }];
        usedGenericFiles.add(candidate.filename);
        break;
      }
    }
  }

  const handleRemoveSceneImage = async (assetId: number) => {
    setRemovingAssetId(assetId);
    try {
      await deleteAsset(project.id, assetId);
      await loadProject();
    } finally {
      setRemovingAssetId(null);
    }
  };

  const handleAddSceneImage = async (sceneId: number, file: File) => {
    setUploadingSceneId(sceneId);
    try {
      await updateSceneImage(project.id, sceneId, file);
      await loadProject();
    } finally {
      setUploadingSceneId(null);
    }
  };

  const handleGenerateSceneImageClick = (sceneId: number) => {
    if (!isPro) {
      setShowAiImageUpgradeModal(true);
      return;
    }
    handleGenerateSceneImage(sceneId);
  };

  const handleGenerateSceneImage = async (sceneId: number) => {
    setGenerateImageError(null);
    setGenerateErrorSceneId(null);
    setGeneratingImageSceneId(sceneId);
    try {
      const res = await generateSceneImage(project.id, sceneId);
      setGeneratedImageBase64(res.data.image_base64);
      setGeneratedPrompt(res.data.refined_prompt);
      setGeneratedImageSceneId(sceneId);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : 0;
      if (status === 403) {
        setShowAiImageUpgradeModal(true);
      } else {
        const msg =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : "Image generation failed";
        setGenerateImageError(String(msg));
        setGenerateErrorSceneId(sceneId);
      }
      setGeneratedImageSceneId(null);
    } finally {
      setGeneratingImageSceneId(null);
    }
  };

  const handleKeepGeneratedSceneImage = (sceneId: number) => {
    if (!generatedImageBase64) return;
    const dataUrl = `data:image/png;base64,${generatedImageBase64}`;
    setGenerateImageError(null);
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => new File([blob], "generated.png", { type: "image/png" }))
      .then((file) =>
        handleAddSceneImage(sceneId, file)
          .then(() => {
            setGeneratedImageBase64(null);
            setGeneratedPrompt(null);
            setGenerateImageError(null);
            setGenerateErrorSceneId(null);
            setGeneratedImageSceneId(null);
          })
          .catch(() => setGenerateImageError("Failed to use generated image"))
      )
      .catch(() => setGenerateImageError("Failed to use generated image"));
  };

  const handleDiscardGeneratedSceneImage = () => {
    setGeneratedImageBase64(null);
    setGeneratedPrompt(null);
    setGenerateImageError(null);
    setGenerateErrorSceneId(null);
    setGeneratedImageSceneId(null);
  };

  const handleSaveLogo = async () => {
    if (!project) return;
    setLogoSaving(true);
    try {
      await updateProjectLogo(project.id, {
        logo_position: logoPosition,
        logo_size: logoSize,
        logo_opacity: logoOpacity,
      });
      await loadProject();
    } catch (err) {
      showError(getErrorMessage(err, "Failed to save logo settings."));
    } finally {
      setLogoSaving(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    if (file.size > 2 * 1024 * 1024) {
      showError("Logo must be under 2 MB.");
      e.target.value = "";
      return;
    }
    setLogoUploading(true);
    try {
      await uploadLogo(project.id, file);
      await loadProject();
      if (logoFileInputRef.current) logoFileInputRef.current.value = "";
    } catch (err) {
      showError(getErrorMessage(err, "Failed to upload logo."));
    } finally {
      setLogoUploading(false);
    }
  };

  // Audio assets for R2 URL resolution
  const audioAssets = project.assets.filter((a) => a.asset_type === "audio");

  // Count audio scenes
  const audioScenes = project.scenes.filter((s) => s.voiceover_path);
  const totalAudioDuration = project.scenes.reduce(
    (sum, s) => sum + (s.duration_seconds ?? 0) + (s.extra_hold_seconds ?? 0),
    0
  );

  // ─── Generation loader ────────────────────────────────────
  const templateRelayoutRunning =
    templateRelayoutJob?.status === "running" || templateRelayoutJob?.status === "queued";
  const statusForBadge = templateRelayoutRunning ? "regenerating" : project.status;
  const renderGenerationLoader = (mode: "pipeline" | "template-relayout" = "pipeline") => {
    const relayoutProgressRaw =
      templateRelayoutJob && templateRelayoutJob.total_scenes > 0
        ? (templateRelayoutJob.processed_scenes / templateRelayoutJob.total_scenes) * 100
        : templateRelayoutJob?.status === "queued"
        ? 8
        : 0;
    const relayoutProgress = Math.max(8, Math.min(98, Math.round(relayoutProgressRaw)));
    const stepLabels =
      mode === "template-relayout"
        ? []
        : PIPELINE_STEPS.map((s) => s.label);
    const currentStepIdx =
      mode === "template-relayout"
        ? 0
        : Math.max(0, pipelineStep - 1);
    const progress = mode === "template-relayout" ? relayoutProgress : smoothProgress;

    return (
      <div
        className="glass-card flex items-center justify-center"
        style={{ minHeight: "60vh" }}
      >
          <div className="w-full max-w-md text-center px-4 sm:px-6 py-10 sm:py-12">
          <div className="w-12 h-12 mx-auto mb-6 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xs animate-pulse">
            B2V
          </div>

          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {mode === "template-relayout" ? "Regenerating scene layouts" : "Generating your video"}
          </h2>
          <p className="text-xs text-gray-400 mb-8">{project.name}</p>

          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
            <div
              className="h-full bg-purple-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {mode !== "template-relayout" && (
            <div className="flex items-center justify-between mb-8">
              {stepLabels.map((label, i) => {
                const isActive = i === currentStepIdx;
                const isDone =
                  i < currentStepIdx ||
                  pipelineStep > PIPELINE_STEPS.length;
                return (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                        isDone
                          ? "bg-green-100 text-green-600"
                          : isActive
                          ? "bg-purple-100 text-purple-600 ring-2 ring-purple-200"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isDone ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isDone
                          ? "text-green-600"
                          : isActive
                          ? "text-purple-600"
                          : "text-gray-400"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-400">
              {mode === "template-relayout"
                ? `${progress}% complete`
                : `${stepLabels[currentStepIdx] ?? "Finishing up"}...`}
            </span>
          </div>

          {hasError && (
            <div className="mt-6">
              <button
                onClick={kickOffGeneration}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Completed view (video preview + actions + chat) ──────
  const renderCompleted = () => {
    return (
      <div className="space-y-4">
        {/* ── Phase 1: Rendering progress ── */}
        {rendering && (
          <div
            className="glass-card flex items-center justify-center"
            style={{ minHeight: "60vh" }}
          >
            <div className="w-full max-w-md text-center px-4 sm:px-6 py-10 sm:py-12">
              <div className="w-14 h-14 mx-auto mb-6 bg-purple-600 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Creating your video
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                {renderFrames.total > 0
                  ? `Frame ${renderFrames.rendered.toLocaleString()} of ${renderFrames.total.toLocaleString()}`
                  : "Preparing..."}
              </p>

              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{renderProgress}%</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  {renderEtaLabel
                    ? renderEtaLabel.startsWith("~")
                      ? `${renderEtaLabel} remaining`
                      : renderEtaLabel
                    : renderProgress > 0
                      ? "Estimating…"
                      : renderFrames.total > 0
                        ? "Rendering…"
                        : "Preparing…"}
                </span>
              </div>

              <p className="mt-6 text-sm text-gray-400">
                Feel free to browse other tabs — just don't close this one.
              </p>

              {hasError && (
                <div className="mt-4">
                  <button
                    onClick={() => handleRender()}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!hasError && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowCancelRenderWarning(true)}
                    disabled={cancellingRender}
                    className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-60 text-gray-800 text-xs font-medium rounded-lg transition-colors"
                  >
                    {cancellingRender ? "Cancelling..." : "Cancel render"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Phase 2: Saving to cloud ── */}
        {saving && !rendering && (
          <div
            className="glass-card flex items-center justify-center"
            style={{ minHeight: "60vh" }}
          >
            <div className="w-full max-w-sm text-center px-4 sm:px-6 py-10 sm:py-12">
              <div className="w-14 h-14 mx-auto mb-6 bg-green-600 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Finalizing your video
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                Encoding &amp; uploading to cloud...
              </p>

              <div className="w-full bg-gray-100 rounded-full h-2 mb-3 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: "100%" }} />
              </div>

              <div className="flex items-center justify-center text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                  Almost done
                </span>
              </div>

              <p className="mt-6 text-sm text-gray-400">
                Hang tight — your download will start automatically.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                If your download doesn't start, allow popups for this site.
              </p>
            </div>
          </div>
        )}

        {/* Main content (hidden while rendering or saving to cloud) */}
        {!rendering && !saving && (
          <div className="glass-card overflow-hidden flex flex-col">
            {/* Header bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-200/30 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-sm font-medium text-gray-900 truncate">
                  {project.name}
                </h2>
                <StatusBadge status={statusForBadge} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Video format (landscape / portrait) — left of download */}
                <div className="flex items-center shrink-0">
                  <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl">
                    <button
                      type="button"
                      title="Landscape for desktop / YouTube"
                      disabled={
                        !project ||
                        rendering ||
                        saving ||
                        missingCustomTemplate ||
                        aspectFormatSaving ||
                        templateRelayoutRunning ||
                        submittingTemplateRelayout
                      }
                      onClick={() => {
                        if (!project) return;
                        const cur = normalizeProjectAspectRatio(project.aspect_ratio);
                        if (cur === "landscape") return;
                        setAspectFormatPending("landscape");
                        setShowAspectFormatConfirm(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg flex items-center transition-all disabled:opacity-40 disabled:pointer-events-none ${
                        project && normalizeProjectAspectRatio(project.aspect_ratio) === "landscape"
                          ? "bg-white text-purple-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <rect x="3" y="4" width="18" height="12" rx="2" />
                        <path d="M8 20h8M12 16v4" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Portrait for TikTok / Reels / mobile"
                      disabled={
                        !project ||
                        rendering ||
                        saving ||
                        missingCustomTemplate ||
                        aspectFormatSaving ||
                        templateRelayoutRunning ||
                        submittingTemplateRelayout
                      }
                      onClick={() => {
                        if (!project) return;
                        const cur = normalizeProjectAspectRatio(project.aspect_ratio);
                        if (cur === "portrait") return;
                        setAspectFormatPending("portrait");
                        setShowAspectFormatConfirm(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg flex items-center transition-all disabled:opacity-40 disabled:pointer-events-none ${
                        project && normalizeProjectAspectRatio(project.aspect_ratio) === "portrait"
                          ? "bg-white text-purple-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <rect x="7" y="2" width="10" height="20" rx="2" />
                        <circle cx="12" cy="18" r="1" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Open Studio — Pro or per-video paid (download workspace zip) */}
                {/* {hasStudioAccess ? (
                  <button
                    onClick={handleOpenStudio}
                    disabled={downloadingStudio}
                    className="px-3 py-1.5 border border-purple-200 text-purple-600 hover:bg-purple-50 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {downloadingStudio ? (
                      <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    )}
                    Open Studio
                  </button>
                ) : (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-400 hover:border-purple-200 hover:text-purple-500 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Unlock Studio with per-video or Pro plan"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Studio
                  </button>
                )} */}

                {/* Download MP4 */}
                {!rendered ? (
                  <button
                    onClick={() => {
                      if (missingCustomTemplate) {
                        showError("You can't render this video because its custom template has been deleted.");
                        return;
                      }
                      setHasError(false);
                      setDownloadWarningMode("render");
                      setShowDownloadWarning(true);
                    }}
                    disabled={missingCustomTemplate}
                    className={`px-4 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      missingCustomTemplate
                        ? "bg-gray-300 cursor-not-allowed"
                        : hasError
                        ? "bg-orange-500 hover:bg-orange-600"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={hasError
                          ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          : "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        }
                      />
                    </svg>
                    {hasError ? "Resume Download" : "Download MP4"}
                  </button>
                ) : (
                  <>
                    {/* Download MP4 */}
                    <button
                      onClick={() => {
                        setDownloadWarningMode("download");
                        setShowDownloadWarning(true);
                      }}
                      disabled={downloading}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {downloading ? (
                        <>
                          <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download MP4
                        </>
                      )}
                    </button>

                    {/* Re-render — re-create video with latest changes (deducts video count) */}
                    <button
                      onClick={() => {
                        if (missingCustomTemplate) {
                          showError("You can't re-render this video because its custom template has been deleted.");
                          return;
                        }
                        setShowReRenderWarning(true);
                      }}
                      disabled={rendering || missingCustomTemplate}
                      className="px-4 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Re-render
                    </button>

                    {/* Share button — inline next to Download */}
                    {project.r2_video_url && (
                      <div className="relative" ref={shareAnchorRef}>
                        <button
                          onClick={() => setShowShareMenu((v) => !v)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>

                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Video player area + Chat */}
            <div className="flex flex-1 min-h-0">
              {/* Video preview — always shows live preview when scenes exist */}
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {missingCustomTemplate && (
                  <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    This project's custom template has been deleted. You can't render or re-render this video because the template no longer exists.
                  </div>
                )}
                {project.scenes.length > 0 ? (
                  <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
                    {(project.template ?? "default") === "gridcraft" &&
                      project.aspect_ratio === "portrait" && (
                        <div
                          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-950 leading-snug"
                          role="status"
                        >
                          <span className="font-semibold">Portrait Gridcraft:</span> Layout is
                          sensitive to text length and per-scene font overrides. Preview{" "}
                          <span className="font-medium">each scene</span> and adjust titles, body
                          copy, or scene font sizes if anything clips.
                        </div>
                      )}
                    <div
                      className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
                      style={
                        project.aspect_ratio === "portrait"
                          ? { minHeight: "70vh" }
                          : undefined
                      }
                    >
                      <VideoPreview
                        project={project}
                        logoSizeOverride={logoSize}
                        logoOpacityOverride={logoOpacity}
                        logoPositionOverride={logoPosition}
                        onPlaybackSpeedChange={handlePreviewPlaybackSpeedChange}
                        playbackSpeedSaving={savingPlaybackSpeed}
                      />
                    </div>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                      <p className="text-[11px] text-gray-400 flex-shrink-0">
                        Preview · {project.scenes.length} scenes
                        {totalAudioDuration > 0 &&
                          ` · ${Math.round(totalAudioDuration)}s`}
                      </p>
                      {showInlineReviewPrompt && (
                        <ProjectReviewPrompt
                          submitted={inlineReviewSubmitted}
                          submitting={reviewSubmitting}
                          error={reviewError}
                          onSubmit={handleInlineSubmitReview}
                        />
                      )}
                    </div>
                    {imageAssets.some((a) => /\.gif(\?.*)?$/i.test(a.filename)) && (
                      <p className="text-[10px] text-amber-500 flex items-center gap-1">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        GIF images detected — animation may vary in the final render
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-full max-w-lg aspect-video bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-gray-900/80" />
                      <div className="relative text-center">
                        <div className="w-6 h-6 mx-auto mb-2 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                        <p className="text-xs text-white/40">
                          Generating scenes...
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <UpgradePlanModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        projectId={projectId}
        title="Upgrade to use your crafted templates"
        subtitle="Custom templates and the template builder require a paid plan. Pick a plan to continue."
      />

      {showReviewPopup && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9997] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={handleDismissReviewPopup}
          />
          <div className="relative w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <ProjectReviewPrompt
              variant="modal"
              submitted={false}
              submitting={reviewSubmitting}
              error={reviewError}
              onDismiss={handleDismissReviewPopup}
              onSubmit={handlePopupSubmitReview}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Video format change confirmation */}
      {showAspectFormatConfirm && project && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !aspectFormatSaving && setShowAspectFormatConfirm(false)}
            aria-hidden
          />
          <div
            className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aspect-format-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="aspect-format-confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
              Change video format?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to change the format?
              {aspectFormatPending &&
                (aspectFormatPending === "portrait"
                  ? " Preview will use vertical (9:16)."
                  : " Preview will use horizontal (16:9).")}
              {project.r2_video_url ? (
                <span className="block mt-2 text-amber-800/90">
                 You will need to re render to get the video downloaded in the new format.
                </span>
              ) : null}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={aspectFormatSaving}
                onClick={() => {
                  if (!aspectFormatSaving) {
                    setShowAspectFormatConfirm(false);
                    setAspectFormatPending(null);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={aspectFormatSaving || aspectFormatPending === null}
                onClick={async () => {
                  if (!project || aspectFormatPending === null) return;
                  setAspectFormatSaving(true);
                  try {
                    await updateProject(project.id, { aspect_ratio: aspectFormatPending });
                    await loadProject();
                    setShowAspectFormatConfirm(false);
                    setAspectFormatPending(null);
                  } catch (err) {
                    showError(getErrorMessage(err, "Failed to update video format."));
                  } finally {
                    setAspectFormatSaving(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
              >
                {aspectFormatSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Proceed"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Download warning — show before starting download when video is already rendered */}
      {showDownloadWarning && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDownloadWarning(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-7 transition-all" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {downloadWarningMode === "download" ? "Before you download" : "Before you render"}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {downloadWarningMode === "download" ? (
                "If you have made changes/edits after your last render, you need to re-render to get them in the downloaded video."
              ) : (
                <>
                  <span>
                    Make sure you have made all the changes/edits before rendering. Re-rendering of video later will result in deduction of a video count.
                  </span>
                  {playbackSpeedDraft !== 1 && (() => {
                    const renderedSecs = totalAudioDuration / playbackSpeedDraft;
                    const mins = Math.floor(renderedSecs / 60);
                    const secs = Math.round(renderedSecs % 60);
                    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                    return <><br /><br /><span className="text-xs text-yellow-600">Your video will be rendered at <strong>{playbackSpeedDraft}×</strong> speed — approximately <strong>{timeStr}</strong> long.</span></>;
                  })()}
                </>
              )}
            </p>


            {downloadWarningMode === "download" && (
              <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Having trouble downloading? Copy the link and paste it into a new browser tab.
                  </p>

                  <button
                    type="button"
                    onClick={handleCopyDownloadLink}
                    className={`flex items-center gap-1 text-xs font-medium transition ${
                      copyStatus === "success"
                        ? "text-green-600"
                        : copyStatus === "error"
                        ? "text-red-600"
                        : "text-blue-600 hover:text-blue-700"
                    }`}
                  >
                    {copyStatus === "success" ? (
                      <>
                        ✓ Copied
                      </>
                    ) : copyStatus === "error" ? (
                      <>
                        ⚠ Failed
                      </>
                    ) : (
                      <>
                        🔗 Copy 
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}


            <div className="flex gap-3">
              <button
                type="button"
                disabled={downloadWarningMode === "render" && renderConfirmLoading}
                onClick={() => {
                  if (downloadWarningMode === "render") {
                    setHasError(false);
                    setRenderConfirmLoading(true);
                    handleRender(false, () => {
                      setShowDownloadWarning(false);
                      setRenderConfirmLoading(false);
                    });
                  } else {
                    setShowDownloadWarning(false);
                    handleDownload();
                  }
                }}
                className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
              >
                {downloadWarningMode === "render" && renderConfirmLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting…
                  </>
                ) : downloadWarningMode === "render" ? (
                  "Render & download"
                ) : (
                  "Download"
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowDownloadWarning(false); setRenderConfirmLoading(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Re-render warning — deducts video count; continue only if user has new changes */}
      {showReRenderWarning && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowReRenderWarning(false); setRenderConfirmLoading(false); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Re-render video</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will deduct your video count. Continue only if you have new changes in your video.
            </p>
            {playbackSpeedDraft !== 1 && (() => {
              const renderedSecs = totalAudioDuration / playbackSpeedDraft;
              const mins = Math.floor(renderedSecs / 60);
              const secs = Math.round(renderedSecs % 60);
              const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
              return <p className="text-xs text-yellow-600 mb-6">Your video will be re-rendered at <strong>{playbackSpeedDraft}×</strong> speed — approximately <strong>{timeStr}</strong> long.</p>;
            })()}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={renderConfirmLoading}
                onClick={() => {
                  setHasError(false);
                  setRenderConfirmLoading(true);
                  handleRender(true, () => {
                    setShowReRenderWarning(false);
                    setRenderConfirmLoading(false);
                  });
                }}
                className="flex-1 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
              >
                {renderConfirmLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Re-render"
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowReRenderWarning(false); setRenderConfirmLoading(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cancel render warning */}
      {showCancelRenderWarning && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!cancellingRender) setShowCancelRenderWarning(false);
            }}
          />
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel rendering?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will stop your current render process. You can start rendering again anytime.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={cancellingRender}
                onClick={async () => {
                  await handleCancelRender();
                  setShowCancelRenderWarning(false);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
              >
                {cancellingRender ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  "Yes, cancel render"
                )}
              </button>
              <button
                type="button"
                disabled={cancellingRender}
                onClick={() => setShowCancelRenderWarning(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-60"
              >
                Keep rendering
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDeleteModal
        open={showTemplateRelayoutWarning}
        onClose={() => {
          setShowTemplateRelayoutWarning(false);
          setTemplateRelayoutPendingId(null);
        }}
        title="Proceed with video regeneration?"
        subtitle={project?.name}
        warningMessage="This will deduct 1 video count from your quota. Do you want to continue?"
        confirmLabel="Proceed"
        confirmLoadingLabel="Starting..."
        iconVariant="warning"
        onConfirm={applyTemplateRelayout}
      />

      {showTemplateChangeModal &&
        project &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => !submittingTemplateRelayout && setShowTemplateChangeModal(false)}
              aria-hidden
            />
            <div
              className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-gray-200/80 bg-white shadow-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="template-change-title"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 id="template-change-title" className="text-base font-semibold text-gray-900">
                  Change template
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTemplateChangeModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-4">
                <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setTemplateChangePickerTab("builtin")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      templateChangePickerTab === "builtin"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Built-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateChangePickerTab("custom")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      templateChangePickerTab === "custom"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">Selected preview</p>
                  <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
                    <div className="relative max-h-[200px] overflow-hidden">
                      <TemplateAssignPreview
                        templateId={templateChangeDraft}
                        customTemplates={customTemplatesList}
                        projectCustomTheme={project.custom_theme ?? null}
                        projectName={project.name}
                        variant="large"
                      />
                    </div>
                    <div className="px-3 py-2 bg-purple-50/80 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {templateChangeDraft.startsWith("custom_")
                          ? customTemplatesList.find(
                              (c) => c.id === parseInt(templateChangeDraft.replace("custom_", ""), 10)
                            )?.name ?? "Custom"
                          : TEMPLATE_DESCRIPTIONS[templateChangeDraft]?.title ?? templateMetas.find((m) => m.id === templateChangeDraft)?.name ?? templateChangeDraft}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">
                    All {templateChangePickerTab === "builtin" ? "built-in" : "custom"} templates
                  </p>
                  <div className="border border-gray-200/60 rounded-xl p-4 max-h-[240px] overflow-y-auto bg-gray-50/40">
                    {templateChangePickerTab === "builtin" ? (
                      templateMetas.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                          {templateMetas.map((t) => {
                            const PreviewComp = TEMPLATE_PREVIEWS[t.id];
                            const desc = TEMPLATE_DESCRIPTIONS[t.id];
                            const isSel = templateChangeDraft === t.id;
                            const isNew = t.new_template === true;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setTemplateChangeDraft(t.id)}
                                className={`text-left rounded-lg overflow-hidden transition-all ${
                                  isSel
                                    ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-gray-50"
                                    : isNew
                                    ? "ring-1 ring-purple-400/60 hover:ring-purple-500"
                                    : "ring-1 ring-gray-200/60 hover:ring-purple-300/60"
                                }`}
                              >
                                <div className="relative overflow-hidden max-h-[70px] min-h-[56px]">
                                  {PreviewComp ? (
                                    <PreviewComp key={`pick-${t.id}`} />
                                  ) : (
                                    <div className="w-full min-h-[56px] bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 px-1">
                                      {t.name}
                                    </div>
                                  )}
                                  {isNew && (
                                    <div className="absolute top-0.5 left-0.5 z-[1]">
                                      <NewTemplateBadge />
                                    </div>
                                  )}
                                </div>
                                <div className={`px-2 py-1 ${isSel ? "bg-purple-50/90" : "bg-white/90"}`}>
                                  <div className="text-[10px] font-semibold text-gray-800 truncate">{desc?.title ?? t.name}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 py-6 text-center">No built-in templates loaded.</p>
                      )
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <CraftYourTemplateCard
                          variant="default"
                          isPro={isPro}
                          onClick={openCraftCustomTemplateFromProjectSettings}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openCraftCustomTemplateFromProjectSettings();
                            }
                          }}
                        />
                        {readyCustomForPicker.map((ct) => {
                          const cid = `custom_${ct.id}`;
                          const isSel = templateChangeDraft === cid;
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => {
                                if (!isPro) {
                                  setShowUpgrade(true);
                                  return;
                                }
                                setTemplateChangeDraft(cid);
                              }}
                              className={`text-left rounded-lg overflow-hidden border-2 transition-all ${
                                isSel ? "border-purple-500 shadow-[0_0_0_2px_rgba(124,58,237,0.12)]" : "border-gray-200/60 hover:border-purple-300/60"
                              }`}
                            >
                              <div className="relative isolate overflow-hidden max-h-[70px] min-h-[56px]">
                                {/* Previews use canvas/Remotion; without pointer-events-none clicks never reach the button. */}
                                <div className="relative z-0 min-h-[56px] pointer-events-none">
                                  <CustomPreviewLandscape
                                    theme={ct.theme}
                                    name={ct.name}
                                    introCode={ct.intro_code || undefined}
                                    outroCode={ct.outro_code || undefined}
                                    contentCodes={ct.content_codes || undefined}
                                    contentArchetypeIds={ct.content_archetype_ids || undefined}
                                    previewImageUrl={ct.preview_image_url}
                                    logoUrls={ct.logo_urls}
                                    ogImage={ct.og_image}
                                  />
                                </div>
                                {!isPro && (
                                  <div
                                    className="pointer-events-none absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-600 text-white shadow-sm"
                                    aria-hidden
                                  >
                                    Pro
                                  </div>
                                )}
                              </div>
                              <div className={`px-2 py-1 ${isSel ? "bg-purple-50/80" : "bg-white/80"}`}>
                                <div className="text-[10px] font-semibold text-gray-800 truncate">{ct.name}</div>
                              </div>
                            </button>
                          );
                        })}
                        {customTemplatesLoading && (
                          <div
                            className="rounded-lg border border-dashed border-gray-200/80 bg-white/70 flex flex-col items-center justify-center gap-2 min-h-[88px] px-2 py-3 text-center"
                            role="status"
                            aria-live="polite"
                          >
                            <span className="w-4 h-4 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" aria-hidden />
                            <p className="text-[10px] text-gray-500 leading-snug">
                              Loading custom templates, please wait.
                            </p>
                          </div>
                        )}
                        {!customTemplatesLoading && readyCustomForPicker.length === 0 && (
                          <p className="col-span-2 text-xs text-gray-500 py-4 text-center flex items-center justify-center">
                            No custom templates ready yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setShowTemplateChangeModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={templateChangeDraft === assignedTemplateId || templateRelayoutRunning}
                  onClick={() => {
                    if (templateChangeDraft === assignedTemplateId) return;
                    if (!isPro && templateChangeDraft.startsWith("custom_")) {
                      setShowUpgrade(true);
                      return;
                    }
                    setTemplateRelayoutPendingId(templateChangeDraft);
                    setShowTemplateChangeModal(false);
                    setShowTemplateRelayoutWarning(true);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed rounded-xl"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Share dropdown — rendered outside glass-card to avoid overflow/backdrop-filter clipping */}
      {showShareMenu && project?.r2_video_url && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setShowShareMenu(false)} />
          <div
            className="fixed z-[9999] bg-white rounded-xl shadow-lg border border-gray-200/60 p-1.5 flex gap-1"
            style={(() => {
              const rect = shareAnchorRef.current?.getBoundingClientRect();
              if (!rect) return {};
              return { top: rect.top - 48, left: rect.right - 130 };
            })()}
          >
            {/* TikTok */}
            <button
              onClick={() => { navigator.clipboard.writeText(project.r2_video_url!); setShowShareMenu(false); }}
              className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-black/5 flex items-center justify-center transition-colors"
              title="Copy link for TikTok"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-1.59-.27 4.83 4.83 0 01-1.41-.82V6.69h3z" />
              </svg>
            </button>
            {/* YouTube */}
            <button
              onClick={() => { navigator.clipboard.writeText(project.r2_video_url!); setShowShareMenu(false); }}
              className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-red-50 flex items-center justify-center transition-colors"
              title="Copy link for YouTube"
            >
              <svg className="w-4 h-4 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </button>
            {/* Facebook */}
            <button
              onClick={() => { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(project.r2_video_url!)}`, "_blank"); setShowShareMenu(false); }}
              className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-blue-50 flex items-center justify-center transition-colors"
              title="Share on Facebook"
            >
              <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Upper area: loader when running, editor when complete */}
      {pipelineRunning || templateRelayoutRunning ? (
        renderGenerationLoader(templateRelayoutRunning ? "template-relayout" : "pipeline")
      ) : pipelineComplete && project.scenes.length > 0 ? (
        renderCompleted()
      ) : (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-semibold text-gray-900">
                  {project.name}
                </h1>
                <StatusBadge status={statusForBadge} />
              </div>
              {project.blog_url && !project.blog_url.startsWith("upload://") ? (
                <a
                  href={project.blog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-purple-600 transition-colors"
                >
                  {project.blog_url}
                </a>
              ) : (
                <span className="text-xs text-gray-400">
                  {project.blog_url?.startsWith("upload://")
                    ? "Created from uploaded documents"
                    : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasError && (
                <button
                  onClick={kickOffGeneration}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {runProjectTour && (
        <Joyride
          steps={projectTourSteps}
          run={true}
          stepIndex={tabsTourStepIndex}
          continuous
          showSkipButton={true}
          callback={handleProjectTourCallback}
          scrollToFirstStep={true}
          disableScrolling={false}
          spotlightClicks={false}
          styles={PROJECT_JOYRIDE_STYLES}
          locale={{ back: "Back", close: "Close", last: "Done", next: "Next", skip: "Skip" }}
        />
      )}
      {/* Pill tabs */}
      <div className="flex gap-1 p-1 bg-gray-100/60 rounded-xl w-full sm:w-fit" data-tour="tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-center ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "script" && (
          <ScriptPanel
            scenes={project.scenes}
            projectName={project.name}
          />
        )}

        {activeTab === "scenes" && (
          <div>
            {project.scenes.length === 0 ? (
              <p className="text-center py-16 text-xs text-gray-400">
                Scenes will appear here once generated.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-base font-medium text-gray-900">
                      {project.name}
                    </h2>
                    <span className="text-xs text-gray-400">
                      {project.scenes.length} scenes — {imageAssets.length} images. Drag to reorder.
                    </span>
                  </div>
                </div>

                <div className="relative">
                  {reorderSaving && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                      <div className="w-10 h-10 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                      <p className="mt-3 text-sm font-medium text-gray-700">Saving order…</p>
                    </div>
                  )}
                  <div className="space-y-2">
                  {project.scenes.map((scene, idx) => {
                    const isExpanded = expandedScene === scene.id;
                    const sceneImages = sceneImageMap[idx] || [];
                    // Use latest audio asset by id (regenerated scene = new asset) and cache-bust so new voiceover loads
                    const audioFilename = extractAudioFilename(scene.voiceover_path) || `scene_${scene.order}.mp3`;
                    const audioUrl = scene.voiceover_path
                      ? resolveVoiceoverUrl(project.id, audioFilename, audioAssets)
                      : null;
                    const isDragging = draggedSceneId === scene.id;
                    const isDropTarget = dragOverSceneId === scene.id && !isDragging;

                    return (
                      <div
                        key={scene.id}
                        data-scene-row
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverSceneId(scene.id);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverSceneId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSceneId(null);
                          const sourceId = Number(e.dataTransfer.getData("text/plain"));
                          if (!sourceId || sourceId === scene.id) return;
                          const fromIdx = project.scenes.findIndex((s) => s.id === sourceId);
                          const toIdx = project.scenes.findIndex((s) => s.id === scene.id);
                          if (fromIdx < 0 || toIdx < 0) return;
                          const reordered = [...project.scenes];
                          const [removed] = reordered.splice(fromIdx, 1);
                          reordered.splice(toIdx, 0, removed);
                          setReorderSaving(true);
                          reorderScenes(
                            project.id,
                            reordered.map((s, i) => ({ scene_id: s.id, order: i + 1 }))
                          )
                            .then(() => loadProject())
                            .finally(() => setReorderSaving(false));
                        }}
                        className={`transition-all duration-150 ${isDragging ? "opacity-40 scale-[0.98]" : ""} ${isDropTarget ? "ring-2 ring-purple-400 ring-inset rounded-lg" : ""}`}
                      >
                        <div className="flex items-stretch gap-0">
                          {/* Drag handle — only this area starts the drag */}
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDraggedSceneId(scene.id);
                              e.dataTransfer.setData("text/plain", String(scene.id));
                              e.dataTransfer.effectAllowed = "move";
                              const row = (e.currentTarget as HTMLElement).closest("[data-scene-row]");
                              if (row) {
                                const rect = row.getBoundingClientRect();
                                e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedSceneId(null);
                              setDragOverSceneId(null);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-10 flex-shrink-0 rounded-l-lg border border-r-0 border-purple-200 bg-purple-50 cursor-grab active:cursor-grabbing hover:bg-purple-100 select-none touch-none"
                            title="Drag to reorder"
                          >
                            <svg className="w-5 h-5 text-purple-800 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Clickable scene header */}
                              <button
                              type="button"
                              onClick={() =>
                                setExpandedScene(isExpanded ? null : scene.id)
                              }
                              className="w-full text-left glass-card p-4 md:border-l-2 md:border-l-purple-200 md:hover:border-l-purple-400 transition-all rounded-r-lg border"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex items-start sm:items-center gap-3 w-full">
                                  <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                                    {scene.order}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-xs md:text-sm font-medium text-gray-900 whitespace-normal leading-tight">
                                      {scene.title}
                                    </h3>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSceneEditModal(scene);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
                                      title="Edit scene"
                                      data-tour={idx === 0 ? "scene-edit-first" : undefined}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      <span className="hidden sm:inline-block text-xs font-medium">Edit</span>
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                          scene.remotion_code ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-300"
                                        }`}
                                      >
                                        Scene
                                      </span>
                                      {project.voice_gender !== "none" && (
                                        <span
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                            scene.voiceover_path ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-300"
                                          }`}
                                        >
                                          Audio
                                        </span>
                                      )}
                                      <span className="text-[11px] text-gray-300 ml-1">
                                        {(scene.duration_seconds ?? 0) + (scene.extra_hold_seconds ?? 0)}s
                                      </span>

                                      <svg
                                        className={`w-4 h-4 text-gray-300 transition-transform ml-1 ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSceneToDelete(scene);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0 ml-2 sm:ml-4"
                                    title="Delete scene"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    <span className="hidden sm:inline-block text-xs font-medium">Delete</span>
                                  </button>
                                </div>
                              </div>
                            </button>

                            {/* Expanded scene detail */}
                            {isExpanded && (
                              <div className="ml-4 mt-1 glass-card p-5 border-l-2 border-l-purple-100 space-y-4 rounded-r-lg border border-t-0">
                                {/* Narration */}
                                <div>
                              <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                    Display text
                                  </h4>
                                  <p className="text-sm text-gray-700 leading-relaxed">
                                    {/* Prefer dedicated display_text when available; otherwise fall back to narration_text */}
                                    {(scene.display_text ?? scene.narration_text) || (
                                      <span className="italic text-gray-300">
                                        No narration
                                      </span>
                                    )}
                                  </p>
                                </div>

                                {/* Visual Description */}
                                <div>
                                  <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                    Visual Description
                                  </h4>
                                  <p className="text-xs text-gray-500 italic leading-relaxed">
                                    {scene.visual_description || "—"}
                                  </p>
                                </div>

                                {/* Layout (from remotion_code JSON) */}
                                {scene.remotion_code && (() => {
                                  try {
                                    const desc = JSON.parse(scene.remotion_code);
                                    const layoutId =
                                      desc.layout ||
                                      desc.contentArchetype ||
                                      desc.layoutConfig?.arrangement ||
                                      null;
                                    return (
                                      <div>
                                        <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                          Layout
                                        </h4>
                                        <span className="inline-block px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium">
                                          {getSceneLayoutLabel(project.template, layoutId, layoutId?.replace(/_/g, " ")) || "text narration"}
                                        </span>
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}

                                {/* Typography — font size sliders with live preview and debounced save */}
                                {scene.remotion_code && project && (() => {
                                  try {
                                    const desc = JSON.parse(scene.remotion_code) as {
                                      layout?: string;
                                      layoutConfig?: {
                                        arrangement?: string;
                                        titleFontSize?: number;
                                        descriptionFontSize?: number;
                                      };
                                      layoutProps?: { titleFontSize?: number; descriptionFontSize?: number };
                                    };
                                    const layoutId = desc.layoutConfig?.arrangement ?? desc.layout ?? "text_narration";
                                    const template = project.template ?? "default";
                                    const aspectRatio = project.aspect_ratio ?? "landscape";
                                    const schemaDefaults = getDefaultFontSizesFromSchema(layoutPropSchema ?? undefined, layoutId, aspectRatio);
                                    const defaults = schemaDefaults ?? getDefaultFontSizes(template, layoutId, aspectRatio);
                                    const override = sceneFontOverrides[scene.id];
                                    const isCustomTpl = (template).startsWith("custom_");
                                    const storedTitle = isCustomTpl ? desc.layoutConfig?.titleFontSize : desc.layoutProps?.titleFontSize;
                                    const storedDesc = isCustomTpl ? desc.layoutConfig?.descriptionFontSize : desc.layoutProps?.descriptionFontSize;
                                    const titleFontSize = override?.title ?? storedTitle ?? defaults.title;
                                    const descFontSize = override?.desc ?? storedDesc ?? defaults.desc;
                                    const titleClamped = Math.min(200, Math.max(20, Number(titleFontSize) || defaults.title));
                                    const descClamped = Math.min(80, Math.max(12, Number(descFontSize) || defaults.desc));

                                    const scheduleFontSave = () => {
                                      const sceneId = scene.id;
                                      const tid = fontSaveTimeoutRef.current[sceneId];
                                      if (tid) clearTimeout(tid);
                                      fontSaveTimeoutRef.current[sceneId] = setTimeout(() => {
                                        const proj = projectRef.current;
                                        const pending = fontPendingRef.current[sceneId];
                                        if (!proj || !pending) return;
                                        const sc = proj.scenes?.find((s) => s.id === sceneId);
                                        if (!sc?.remotion_code) return;
                                        setSavingFontSizes(sceneId);
                                        try {
                                          const d = JSON.parse(sc.remotion_code) as { layout?: string; layoutProps?: Record<string, unknown>; layoutConfig?: Record<string, unknown> };
                                          const isCustom = (proj.template || "").startsWith("custom_");
                                          const next = isCustom
                                            ? { ...d, layoutConfig: { ...(d.layoutConfig ?? {}), titleFontSize: pending.title, descriptionFontSize: pending.desc } }
                                            : { ...d, layoutProps: { ...(d.layoutProps ?? {}), titleFontSize: pending.title, descriptionFontSize: pending.desc } };
                                          updateScene(proj.id, sceneId, { remotion_code: JSON.stringify(next) }).then(() => {
                                            loadProject();
                                            setSceneFontOverrides((prev) => {
                                              const u = { ...prev };
                                              delete u[sceneId];
                                              return u;
                                            });
                                            setSavingFontSizes((prev) => prev === sceneId ? null : prev);
                                          }).catch(() => {
                                            setSavingFontSizes((prev) => prev === sceneId ? null : prev);
                                          });
                                        } catch {
                                          setSavingFontSizes((prev) => prev === sceneId ? null : prev);
                                        }
                                        delete fontSaveTimeoutRef.current[sceneId];
                                        delete fontPendingRef.current[sceneId];
                                      }, 400);
                                    };

                                    return (
                                      <div>
                                        <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                                          Typography
                                        </h4>
                                        <div className="space-y-3">
                                          <div>
                                            <label className="text-xs text-gray-400 mb-1 block">{layoutId === "mosaic_metric" ? "Metric size" : layoutId === "mosaic_punch" ? "Punch size" : "Title font size"}</label>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="range"
                                                min={20}
                                                max={200}
                                                step={1}
                                                value={titleClamped}
                                                onChange={(e) => {
                                                  const v = Number(e.target.value);
                                                  fontPendingRef.current[scene.id] = { title: v, desc: descClamped };
                                                  setSceneFontOverrides((prev) => ({ ...prev, [scene.id]: { ...(prev[scene.id] ?? { title: titleClamped, desc: descClamped }), title: v } }));
                                                  scheduleFontSave();
                                                }}
                                                className="w-64 h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                                              />
                                              <div className="flex items-center gap-1.5">
                                                {savingFontSizes === scene.id ? (
                                                  <svg className="animate-spin h-3 w-3 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                  </svg>
                                                ) : null}
                                                <span className="text-xs font-medium text-purple-600 tabular-nums">{titleClamped}</span>
                                              </div>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-400 mb-1 block">{layoutId === "mosaic_metric" ? "Label size" : "Display text font size"}</label>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="range"
                                                min={12}
                                                max={80}
                                                step={1}
                                                value={descClamped}
                                                onChange={(e) => {
                                                  const v = Number(e.target.value);
                                                  fontPendingRef.current[scene.id] = { title: titleClamped, desc: v };
                                                  setSceneFontOverrides((prev) => ({ ...prev, [scene.id]: { ...(prev[scene.id] ?? { title: titleClamped, desc: descClamped }), desc: v } }));
                                                  scheduleFontSave();
                                                }}
                                                className="w-64 h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                                              />
                                              <div className="flex items-center gap-1.5">
                                                {savingFontSizes === scene.id ? (
                                                  <svg className="animate-spin h-3 w-3 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                  </svg>
                                                ) : null}
                                                <span className="text-xs font-medium text-purple-600 tabular-nums">{descClamped}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}

                                {/* Audio player (inline) — hidden when no voiceover */}
                                {project.voice_gender !== "none" && audioUrl && (
                                  <div>
                                    <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                      Audio
                                    </h4>
                                    <audio
                                      controls
                                      src={audioUrl}
                                      preload="metadata"
                                      className="w-full h-8"
                                      style={{ maxWidth: 400 }}
                                    />
                                  </div>
                                )}

                                {/* Scene images — same add/remove as manual edit in modal */}
                                {(() => {
                                  const sceneLayout = (() => {
                                    try {
                                      return scene.remotion_code ? JSON.parse(scene.remotion_code).layout : null;
                                    } catch { return null; }
                                  })();
                                  const sceneSupportsImage = !sceneLayout || !layoutsWithoutImage.has(sceneLayout);
                                  return (
                                    <div>
                                      <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                        Images ({sceneSupportsImage ? (sceneImageAssetsMap[idx] || []).length : 0})
                                      </h4>
                                      {sceneSupportsImage ? (
                                        <>
                                        <div className="flex flex-wrap gap-2 items-start">
                                          {(sceneImageAssetsMap[idx] || []).map(({ url, asset }) => (
                                            <div
                                              key={asset.id}
                                              className="relative group rounded-lg overflow-hidden border border-gray-200/40 flex-shrink-0"
                                            >
                                              <img
                                                src={url}
                                                alt=""
                                                className="h-24 w-auto object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveSceneImage(asset.id)}
                                                disabled={removingAssetId === asset.id}
                                                className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 disabled:opacity-50 transition-colors"
                                              >
                                                {removingAssetId === asset.id ? (
                                                  <span className="text-[10px]">…</span>
                                                ) : (
                                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                  </svg>
                                                )}
                                              </button>
                                            </div>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() => handleGenerateSceneImageClick(scene.id)}
                                            disabled={
                                              !(scene.title || "").trim() && !(scene.narration_text || "").trim()
                                                || generatingImageSceneId === scene.id
                                            }
                                            className="group relative flex items-center justify-center w-20 h-24 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-purple-700 flex-shrink-0"
                                          >
                                            {generatingImageSceneId === scene.id ? (
                                              <span className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                            ) : (
                                              <>
                                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                </svg>
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-medium text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[180px] text-center z-10">
                                                  {(scene.title || "").trim() || (scene.narration_text || "").trim()
                                                    ? "Generate Image with AI"
                                                    : "Add title or narration to generate an image"}
                                                </span>
                                              </>
                                            )}
                                          </button>
                                          <label
                                            className={`flex items-center justify-center w-20 h-24 border-2 border-dashed rounded-lg flex-shrink-0 transition-colors ${
                                              uploadingSceneId === scene.id && generatedImageSceneId !== scene.id
                                                ? "border-purple-300 bg-purple-50/50 cursor-wait"
                                                : "border-gray-300 bg-gray-50/50 hover:bg-gray-100/50 cursor-pointer"
                                            }`}
                                          >
                                            <input
                                              type="file"
                                              accept="image/png,image/jpeg,image/webp,image/jpg"
                                              className="hidden"
                                              disabled={uploadingSceneId === scene.id}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  handleAddSceneImage(scene.id, file);
                                                  e.target.value = "";
                                                }
                                              }}
                                            />
                                            {uploadingSceneId === scene.id && generatedImageSceneId !== scene.id ? (
                                              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                              </svg>
                                            )}
                                          </label>
                                        </div>
                                        {(generateImageError && (generateErrorSceneId === scene.id || generatedImageSceneId === scene.id)) && (
                                          <p className="text-xs text-red-600 mt-1.5">{generateImageError}</p>
                                        )}
                                        {!(scene.title || "").trim() && !(scene.narration_text || "").trim() && (
                                          <p className="text-xs text-gray-400 mt-1.5">Add title or narration to use AI image generation.</p>
                                        )}
                                        </>
                                      ) : (
                                        <p className="text-xs text-gray-400 italic">
                                          This layout does not support images. You can change the layout through AI assisted editing to an image supporting layout.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>

                {/* Scene edit modal */}
                {sceneEditModal && (
                  <SceneEditModal
                    open={!!sceneEditModal}
                    onClose={() => setSceneEditModal(null)}
                    scene={sceneEditModal}
                    project={project}
                    imageItems={sceneImageAssetsMap[project.scenes.findIndex((s) => s.id === sceneEditModal.id)] || []}
                    onSaved={loadProject}
                  />
                )}

                {/* Delete scene confirmation modal */}
                <ConfirmDeleteModal
                  open={sceneToDelete != null}
                  onClose={() => setSceneToDelete(null)}
                  title="Delete this scene?"
                  subtitle={sceneToDelete?.title}
                  warningMessage="This cannot be undone."
                  onConfirm={async () => {
                    if (!sceneToDelete) return;
                    try {
                      await deleteScene(project.id, sceneToDelete.id);
                      if (sceneEditModal?.id === sceneToDelete.id) setSceneEditModal(null);
                      if (expandedScene === sceneToDelete.id) setExpandedScene(null);
                      await loadProject();
                    } catch (err) {
                      showError(getErrorMessage(err) || DEFAULT_ERROR_MESSAGE);
                      throw err;
                    }
                  }}
                />


                {/* AI generated image preview modal */}
                {generatedImageSceneId !== null && generatedImageBase64 && ReactDOM.createPortal(
                  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                      onClick={handleDiscardGeneratedSceneImage}
                    />
                    <div
                      className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900">AI generated image</h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => generatedImageSceneId !== null && handleKeepGeneratedSceneImage(generatedImageSceneId)}
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                            title="Use this image"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardGeneratedSceneImage}
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                            title="Discard"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-gray-50 min-h-0 relative">
                        <img
                          src={`data:image/png;base64,${generatedImageBase64}`}
                          alt="AI generated"
                          className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-lg shadow-inner"
                        />
                        {uploadingSceneId === generatedImageSceneId && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-lg">
                            <span className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {/* AI image upgrade modal (scenes tab) */}
                <UpgradePlanModal
                  open={showAiImageUpgradeModal}
                  onClose={() => setShowAiImageUpgradeModal(false)}
                  projectId={project?.id}
                />
              </div>
            )}
          </div>
        )}

       {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-visible">
          <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Font family</h2>
            <p className="text-xs text-gray-400 mb-5">
            Leave as Default to use the template’s built-in fonts.
            </p>
            <div className="glass-card p-6 flex flex-col gap-4 overflow-visible relative z-30">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700">
                  Font family
                </label>
                <div ref={fontDropdownRef} className="relative w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() => setShowFontDropdown((v) => !v)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300 flex items-center justify-between"
                  >
                    <span>
                      {settingsFontId
                        ? FONT_REGISTRY[settingsFontId as keyof typeof FONT_REGISTRY]?.label || settingsFontId
                        : "Default (template)"}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showFontDropdown && (
                    <div className="absolute z-40 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-2 max-h-72 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsFontId(null);
                            setShowFontDropdown(false);
                          }}
                          className={`text-left px-2.5 py-2 text-xs rounded-lg transition-colors ${
                            !settingsFontId ? "bg-purple-50 text-purple-700" : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          Default
                        </button>
                        {Object.values(FONT_REGISTRY)
                          .filter((opt) => opt.id !== "fira_code")
                          .map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setSettingsFontId(opt.id);
                                setShowFontDropdown(false);
                              }}
                              className={`text-left px-2.5 py-2 text-xs rounded-lg transition-colors ${
                                settingsFontId === opt.id
                                  ? "bg-purple-50 text-purple-700"
                                  : "hover:bg-gray-50 text-gray-700"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {settingsFontId && (
                <div className="mt-2">
                  <p className="text-[11px] text-gray-500 mb-1">Preview</p>
                  <div
                    className="px-3 py-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-800"
                    style={{
                      fontFamily:
                        resolveFontFamily(settingsFontId) ??
                        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    }}
                  >
                    The quick brown fox jumps over the lazy dog.
                  </div>
                </div>
              )}
              <div className="flex justify-end mt-auto">
                <button
                  type="button"
                  disabled={savingFontFamily}
                  onClick={async () => {
                    setSavingFontFamily(true);
                    try {
                      await updateProject(project.id, {
                        font_family: settingsFontId || null,
                      });
                      await loadProject();
                    } catch (err) {
                      showError(getErrorMessage(err, "Failed to save font family."));
                    } finally {
                      setSavingFontFamily(false);
                    }
                  }}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {savingFontFamily ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save font"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Project Template</h2>
            <p className="text-xs text-gray-400 mb-5">
              Rebuild scene layouts for a new template while preserving narration, display text, voiceovers.
            </p>
            <div className="glass-card p-6 overflow-visible relative z-20">
              {(() => {
                const tid = assignedTemplateId;
                const selectedCustom =
                  tid.startsWith("custom_") && project
                    ? customTemplatesList.find((ct) => ct.id === parseInt(tid.replace("custom_", ""), 10))
                    : null;
                const selectedDesc = TEMPLATE_DESCRIPTIONS[tid];
                const assignedBuiltinNew =
                  !tid.startsWith("custom_") && templateMetas.some((t) => t.id === tid && t.new_template === true);
                return (
                  <div className="flex flex-row items-stretch gap-4">
                    <div className="shrink-0 self-start w-[9.5rem] sm:w-40 rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
                      <TemplateAssignPreview
                        templateId={tid}
                        customTemplates={customTemplatesList}
                        projectCustomTheme={project?.custom_theme ?? null}
                        projectName={project?.name}
                        variant="thumb"
                      />
                      <div className="px-2 py-1.5 bg-purple-50/80 flex items-center justify-center gap-1">
                        <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between items-end text-right gap-2 min-h-0">
                      <div className="flex flex-col items-end gap-1">
                        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                          Current template
                        </label>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="text-sm font-semibold text-gray-800">
                            {selectedCustom ? selectedCustom.name : selectedDesc?.title ?? tid}
                          </span>
                          {assignedBuiltinNew && <NewTemplateBadge className="shrink-0" />}
                          {selectedCustom && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: selectedCustom.preview_colors.accent }}
                            >
                              Custom
                            </span>
                          )}
                        </div>
                        {selectedCustom ? (
                          <div className="text-[11px] text-gray-400">Custom template</div>
                        ) : selectedDesc?.subtitle ? (
                          <div className="text-[11px] text-gray-400">{selectedDesc.subtitle}</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={submittingTemplateRelayout || templateRelayoutRunning || missingCustomTemplate}
                        onClick={() => {
                          setTemplateChangeDraft(assignedTemplateId);
                          setTemplateChangePickerTab(assignedTemplateId.startsWith("custom_") ? "custom" : "builtin");
                          setShowTemplateChangeModal(true);
                        }}
                        className="shrink-0 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        Change template
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Global Text Sizes</h2>
            <p className="text-xs text-gray-400 mb-5">Applied to all scenes at once.</p>
            <div className="glass-card p-6 flex flex-col gap-6">
              <div>
                <label className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                  <span>Title font size</span>
                  <span className="text-purple-600 font-semibold tabular-nums">{globalTitleSize}</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={1}
                  value={globalTitleSize}
                  onChange={(e) => setGlobalTitleSize(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                  <span>Display text size</span>
                  <span className="text-purple-600 font-semibold tabular-nums">{globalDescSize}</span>
                </label>
                <input
                  type="range"
                  min={12}
                  max={80}
                  step={1}
                  value={globalDescSize}
                  onChange={(e) => setGlobalDescSize(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                />
              </div>
              <div className="flex justify-end mt-auto">
                <button
                  type="button"
                  disabled={savingGlobalTypography}
                  onClick={async () => {
                    setSavingGlobalTypography(true);
                    try {
                      await bulkUpdateSceneTypography(project.id, {
                        title_font_size: globalTitleSize,
                        description_font_size: globalDescSize,
                      });
                      await loadProject();
                    } catch (err) {
                      showError(getErrorMessage(err, "Failed to update typography."));
                    } finally {
                      setSavingGlobalTypography(false);
                    }
                  }}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {savingGlobalTypography ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Applying…
                    </>
                  ) : (
                    "Apply to all Scenes"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Colors</h2>
            <p className="text-xs text-gray-400 mb-5">Theme colors applied across all scenes.</p>
            <div className="glass-card p-6 flex flex-col gap-5">
              {(
                [
                  { label: "Accent color", value: settingsAccentColor, setter: setSettingsAccentColor, hint: "Buttons, highlights, and brand color" },
                  { label: "Text color", value: settingsTextColor, setter: setSettingsTextColor, hint: "Primary on-screen text" },
                  { label: "Background color", value: settingsBgColor, setter: setSettingsBgColor, hint: "Scene background" },
                ] as const
              ).map(({ label, value, setter, hint }) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700">{label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm cursor-pointer overflow-hidden"
                      style={{ backgroundColor: value }}
                      onClick={() => (document.getElementById(`color-input-${label}`) as HTMLInputElement)?.click()}
                    >
                      <input
                        id={`color-input-${label}`}
                        type="color"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setter(v);
                      }}
                      className="w-24 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-300 bg-white"
                      placeholder="#000000"
                      maxLength={7}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-end mt-auto">
                <button
                  type="button"
                  disabled={savingColors}
                  onClick={async () => {
                    setSavingColors(true);
                    try {
                      await updateProject(project.id, {
                        accent_color: settingsAccentColor,
                        bg_color: settingsBgColor,
                        text_color: settingsTextColor,
                      });
                      await loadProject();
                    } catch (err) {
                      showError(getErrorMessage(err, "Failed to save colors."));
                    } finally {
                      setSavingColors(false);
                    }
                  }}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {savingColors ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save colors"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Playback Speed</h2>
            <p className="text-xs text-gray-400 mb-5">
              Applies to preview and final rendered video (including voiceover).
            </p>
            <div className="glass-card p-6 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {PLAYBACK_SPEED_OPTIONS.map((speed) => {
                  const active = playbackSpeedDraft === speed;
                  return (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaybackSpeedDraft(speed)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? "bg-purple-50 text-purple-700 border-purple-300"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {speed}x
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                  <span>Custom speed</span>
                  <span className="text-purple-600 font-semibold tabular-nums">
                    {playbackSpeedDraft.toFixed(1)}x
                  </span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={playbackSpeedDraft}
                  onChange={(e) => setPlaybackSpeedDraft(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                />
              </div>
              {project.r2_video_url && project.playback_speed !== playbackSpeedDraft ? (
                <p className="text-[11px] text-amber-600">
                  Changing speed makes the current downloaded MP4 outdated. Save this and re-render to update it.
                </p>
              ) : null}
              <div className="flex justify-end mt-auto">
                <button
                  type="button"
                  disabled={savingPlaybackSpeed}
                  onClick={async () => {
                    setSavingPlaybackSpeed(true);
                    try {
                      const normalized = Math.min(2.5, Math.max(0.5, Math.round(playbackSpeedDraft * 10) / 10));
                      await updateProject(project.id, { playback_speed: normalized });
                      await loadProject();
                    } catch (err) {
                      showError(getErrorMessage(err, "Failed to save playback speed."));
                    } finally {
                      setSavingPlaybackSpeed(false);
                    }
                  }}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {savingPlaybackSpeed ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save speed"
                  )}
                </button>
              </div>
            </div>
          </div> */}

          {/* Background Music */}
          <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Background Music</h2>
            <p className="text-xs text-gray-400 mb-5">
              Ambient music behind voiceover narration.
            </p>
            <div className="glass-card p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Track</label>
                <select
                  value={bgmTrackDraft ?? ""}
                  onChange={(e) => setBgmTrackDraft(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none"
                >
                  <option value="">None</option>
                  {bgmTracks.map((t) => (
                    <option key={t.track_id} value={t.track_id}>
                      {t.display_name} — {t.mood}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              {bgmTrackDraft && (() => {
                const track = bgmTracks.find((t) => t.track_id === bgmTrackDraft);
                if (!track) return null;
                const isPlaying = bgmPlayingId === track.track_id;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        bgmAudioRef.current?.pause();
                        setBgmPlayingId(null);
                      } else {
                        bgmAudioRef.current?.pause();
                        const audio = new Audio(track.r2_url);
                        audio.onended = () => setBgmPlayingId(null);
                        audio.play().catch(() => {});
                        bgmAudioRef.current = audio;
                        setBgmPlayingId(track.track_id);
                      }
                    }}
                    className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    {isPlaying ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16" rx="1" />
                          <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                        Pause preview
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Preview track
                      </>
                    )}
                  </button>
                );
              })()}

              <div>
                <label className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                  <span>Volume</span>
                  <span className="text-purple-600 font-semibold tabular-nums">
                    {Math.round(bgmVolumeDraft * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(bgmVolumeDraft * 100)}
                  onChange={(e) => setBgmVolumeDraft(Number(e.target.value) / 100)}
                  className="w-full h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                />
              </div>

              {project.r2_video_url && (project.bgm_track_id !== bgmTrackDraft || project.bgm_volume !== bgmVolumeDraft) ? (
                <p className="text-[11px] text-amber-600">
                  Changing BGM makes the current MP4 outdated. Save and re-render to update.
                </p>
              ) : null}

              <div className="flex justify-end mt-auto">
                <button
                  type="button"
                  disabled={savingBgm}
                  onClick={async () => {
                    setSavingBgm(true);
                    try {
                      await updateProject(project.id, {
                        bgm_track_id: bgmTrackDraft,
                        bgm_volume: Math.round(bgmVolumeDraft * 100) / 100,
                      });
                      await loadProject();
                    } catch (err) {
                      showError(getErrorMessage(err, "Failed to save background music."));
                    } finally {
                      setSavingBgm(false);
                    }
                  }}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  {savingBgm ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save music"
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

        {activeTab === "images" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Blog Images section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-4">
                  <h2 className="text-base font-medium text-gray-900">
                    Blog Images
                  </h2>
                  <span className="text-xs text-gray-400">
                    {imageAssets.filter((a) => !a.excluded).length} active
                    {imageAssets.some((a) => a.excluded) &&
                      ` / ${imageAssets.filter((a) => a.excluded).length} excluded`}
                  </span>
                </div>
                {!isPro && (
                  <span className="text-[10px] text-gray-300 flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Pro — exclude images
                  </span>
                )}
              </div>
              {imageAssets.length === 0 ? (
                <p className="text-sm text-gray-400 py-8">
                  Images will appear here once scraped.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imageAssets.map((asset) => {
                    const url = resolveAssetUrl(asset, project.id);
                    const isToggling = togglingAsset === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className={`relative group rounded-xl overflow-hidden border transition-all ${
                          asset.excluded
                            ? "border-red-200 opacity-50"
                            : "border-gray-200/40 hover:border-gray-300"
                        }`}
                      >
                        <img
                          src={url}
                          alt={asset.filename}
                          className="w-full aspect-[4/3] object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'><rect fill='%23f3f4f6' width='200' height='150'/><text x='50%25' y='50%25' fill='%239ca3af' font-size='12' text-anchor='middle' dy='.3em'>No preview</text></svg>";
                          }}
                        />

                        {/* Excluded overlay */}
                        {asset.excluded && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-red-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </div>
                          </div>
                        )}

                        {/* Info bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 pt-6">
                          <p className="text-[10px] text-white/80 truncate">
                            {asset.filename}
                          </p>
                        </div>

                        {/* Toggle exclude button (Pro only) */}
                        {isPro && (
                          <button
                            onClick={() => handleToggleExclusion(asset.id)}
                            disabled={isToggling}
                            className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all border ${
                              asset.excluded
                                ? "border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600"
                                : "border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 opacity-0 group-hover:opacity-100"
                            } ${isToggling ? "animate-pulse" : ""}`}
                            title={
                              asset.excluded
                                ? "Include this image"
                                : "Exclude this image"
                            }
                          >
                            {isToggling ? (
                              <span className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            ) : asset.excluded ? (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            ) : (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logo section */}
            <div className="space-y-4">
              <h2 className="text-base font-medium text-gray-900">Logo</h2>
              <input
                type="file"
                ref={logoFileInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleUploadLogo}
              />
              {project.logo_r2_url ? (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={project.logo_r2_url}
                        alt="Current logo"
                        className="h-14 w-14 object-contain rounded border border-gray-200"
                      />
                     
                    </div>
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60 transition-all disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {logoUploading ? "Uploading…" : "Replace logo"}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Position</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "top_left", label: "Top left" },
                        { value: "top_right", label: "Top right" },
                        { value: "bottom_left", label: "Bottom left" },
                        { value: "bottom_right", label: "Bottom right" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLogoPosition(opt.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            logoPosition === opt.value
                              ? "bg-purple-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Opacity</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(logoOpacity * 100)}
                        onChange={(e) => setLogoOpacity(parseInt(e.target.value, 10) / 100)}
                        className="w-64 h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                      />
                      <span className="text-xs font-medium text-purple-600 tabular-nums w-10 text-right">{Math.round(logoOpacity * 100)}%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={50}
                        max={200}
                        step={1}
                        value={logoSize}
                        onChange={(e) => setLogoSize(parseFloat(e.target.value))}
                        className="w-64 h-1 rounded-full appearance-none bg-gray-200 accent-purple-600"
                      />
                      <span className="text-xs font-medium text-purple-600 tabular-nums w-10 text-right">{Math.round(logoSize)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveLogo}
                    disabled={logoSaving}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {logoSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 mb-2 uppercase tracking-wider">
                    Logo <span className="text-gray-300 font-normal">(optional · max 2 MB)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200/60 transition-all disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {logoUploading ? "Uploading…" : "Choose file"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "audio" && (
          <div>
            {project.scenes.length === 0 ? (
              <p className="text-center py-16 text-xs text-gray-400">
                Audio will appear here once generated.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-4">
                    <h2 className="text-base font-medium text-gray-900">
                      Voiceovers
                    </h2>
                    <span className="text-xs text-gray-400">
                      {audioScenes.length} / {project.scenes.length} scenes
                      {totalAudioDuration > 0 &&
                        ` -- ${Math.round(totalAudioDuration)}s total`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      Ready
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-200" />
                      Pending
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {project.scenes.map((scene) => (
                    <AudioRow
                      key={scene.id}
                      scene={scene}
                      projectId={projectId}
                      audioAssets={audioAssets}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
