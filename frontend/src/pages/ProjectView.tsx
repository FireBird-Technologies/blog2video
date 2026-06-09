import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
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
  deleteAsset,
  uploadProjectDocuments,
  reorderScenes,
  updateScene,
  updateSceneImage,
  assignExistingImageToScene,
  updateSceneImageFocus,
  deleteScene,
  getValidLayouts,
  updateProjectLogo,
  uploadLogo,
  Project,
  Scene,
  BACKEND_URL,
  bulkUpdateSceneTypography,
  submitProjectReview,
  updateProject,
  getMe,
  getTemplates,
  listCustomTemplates,
  changeProjectTemplateRegenerateLayouts,
  getProjectTemplateChangeStatus,
  regenerateScript,
  getRegenerateScriptStatus,
  getRegenerateScriptPreview,
  verifyRegenerateScript,
  rejectRegenerateScript,
  type ProjectRegenerateScriptJob,
  type RegenerateScriptPreviewScene,
  generateEmbedToken,
  type TemplateMeta,
  type CraftedTemplateItem,
  type CustomTemplateItem,
} from "../api/client";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "../hooks/useAuth";
import { useCraftedTemplates } from "../contexts/CraftedTemplatesContext";
import { useErrorModal, getErrorMessage, DEFAULT_ERROR_MESSAGE } from "../contexts/ErrorModalContext";
import { useNoticeModal } from "../contexts/NoticeModalContext";
import { trackGoogleAdsPurchaseConversion } from "../gtag";
import StatusBadge from "../components/StatusBadge";
import ScriptPanel from "../components/ScriptPanel";
import SceneEditModal, {
  SceneImageItem,
  resolveDefaultFontSizesForScene,
} from "../components/SceneEditModal";
import GenerateSceneImageModal from "../components/GenerateSceneImageModal";
import ChatPanel from "../components/ChatPanel";
import UpgradeModal from "../components/UpgradeModal";
import UpgradePlanModal from "../components/UpgradePlanModal";
import OutOfVideosOfferModal from "../components/OutOfVideosOfferModal";
import { useOutOfVideosOffer } from "../hooks/useOutOfVideosOffer";
import ProjectReviewPrompt from "../components/ProjectReviewPrompt";
import VideoPreview from "../components/VideoPreview";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import RegenerateScriptModal from "../components/RegenerateScriptModal";
import VerifyScriptModal from "../components/VerifyScriptModal";
import { TEMPLATE_PREVIEWS, TEMPLATE_DESCRIPTIONS, NewTemplateBadge } from "../components/templatePreviewRegistry";
import ProjectTemplateSettingsCard, { TemplateAssignPreview } from "../components/ProjectTemplateSettingsCard";
import ProjectVoiceSettingsCard from "../components/ProjectVoiceSettingsCard";
import VoiceOperationModal from "../components/VoiceOperationModal";
import ProjectTabs, { type ProjectTabId, type ProjectTabItem } from "../components/ProjectTabs";
import SceneListRow from "../components/SceneListRow";
import CustomPreviewLandscape from "../components/templatePreviews/CustomPreviewLandscape";
import CraftedTemplatePreview from "../components/templatePreviews/CraftedTemplatePreview";
import CraftYourTemplateCard from "../components/CraftYourTemplateCard";
import GetMoreTemplatesModal from "../components/GetMoreTemplatesModal";
import DesignerTemplateRequestModal from "../components/DesignerTemplateRequestModal";
import { normalizeVideoStyle } from "../constants/videoStyles";
import { getPendingUpload } from "../stores/pendingUpload";
import { FONT_REGISTRY, resolveFontFamily } from "../fonts/registry";
import { getSceneLayoutLabel } from "../utils/layoutLabels";
import { resolveCustomImageBoxAr } from "../utils/customImageBoxAr";
import { getTemplateConfig } from "../components/remotion/templateConfig";
import { getImageBoxAspectRatio, normalizeLayoutId } from "../components/remotion/imageBoxConfig";
import type { PlayerRef } from "@remotion/player";
import { exportScenesPptx, exportScenesPdf, exportScenesPng } from "../utils/sceneSlideExport";
import { getSceneExportGlobalFrame, SCENE_EXPORT_TIMELINE_FRACTION } from "../utils/sceneFrameSchedule";

type Tab = ProjectTabId;
type SlideExportWizardState = { format: "pptx" | "pdf" | "zip"; fractions: number[]; stepIndex: number };
type PlaybackSpeedOption = number;
const PLAYBACK_SPEED_OPTIONS: readonly number[] = [0.5, 1, 1.5, 2, 2.5] as const;

/** Image framing modal: uniform zoom only (no rectangular crop resize). */
const IMAGE_ADJUST_ZOOM_MIN = 0.1;
const IMAGE_ADJUST_ZOOM_MAX = 8;
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

function resolveCraftedTemplateLogoUrl(template?: CraftedTemplateItem | null): string | null {
  if (!template) return null;
  const directLogo = Array.isArray(template.logo_urls)
    ? template.logo_urls.find((url) => typeof url === "string" && url.trim())
    : null;
  if (directLogo) return directLogo;

  const publicAssets = template.public_asset_urls;
  if (publicAssets && typeof publicAssets === "object") {
    const preferredEntry = Object.entries(publicAssets).find(([key]) =>
      /(?:^|\/)(?:laduc-)?(?:brand-)?logo\.(?:png|jpe?g|webp|svg)$/i.test(key),
    );
    const fallbackEntry = Object.entries(publicAssets).find(([key]) =>
      /logo.*\.(?:png|jpe?g|webp|svg)$/i.test(key),
    );

    const resolved = preferredEntry?.[1] || fallbackEntry?.[1];
    if (resolved) return resolved;
  }

  if (template.id === "crafted_laduc_bundle" && typeof template.preview_image_url === "string") {
    return template.preview_image_url.replace(/\/assets\/preview\.[a-z0-9]+(?:\?.*)?$/i, "/public/templates/laduc/laduc-brand-logo.png");
  }

  if (template.id === "crafted_fj_market_brief_bundle" && typeof template.preview_image_url === "string") {
    return template.preview_image_url.replace(/\/assets\/preview\.[a-z0-9]+(?:\?.*)?$/i, "/public/templates/fj_market_brief/fj-brand-logo.png");
  }

  return null;
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
  const mediaBaseUrl =
    (BACKEND_URL && BACKEND_URL.trim()) ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "");

  if (asset.r2_url) return asset.r2_url;

  const subdir = asset.asset_type === "image" ? "images" : "audio";
  const localPath = `/media/projects/${projectId}/${subdir}/${asset.filename}`;

  return `${mediaBaseUrl}${localPath}`;
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
  const mediaBaseUrl =
    (BACKEND_URL && BACKEND_URL.trim()) ||
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "");
  const localPath = `/media/projects/${projectId}/audio/${audioFilename}`;
  return `${mediaBaseUrl}${localPath}`;
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

function normalizeProjectAspectRatio(ar: string | undefined | null): "landscape" | "portrait" {
  return ar === "portrait" ? "portrait" : "landscape";
}

// ─── Main Component ──────────────────────────────────────────

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const isPro = user?.plan === "pro" || user?.plan === "standard";
  const offer = useOutOfVideosOffer();

  const [project, setProject] = useState<Project | null>(null);
  const projectRef = useRef<Project | null>(null);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const hasStudioAccess = isPro || (project?.studio_unlocked ?? false);
  const [activeTab, setActiveTab] = useState<Tab>("scenes");
  const tabManuallyChanged = useRef(false);
  const handleTabChange = useCallback((tab: Tab) => {
    tabManuallyChanged.current = true;
    setActiveTab(tab);
  }, []);
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
  const savingPlaybackSpeedRef = useRef(false);
  const pendingPlaybackSpeedRef = useRef<number | null>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const [templateMetas, setTemplateMetas] = useState<TemplateMeta[]>([]);
  const [customTemplatesList, setCustomTemplatesList] = useState<CustomTemplateItem[]>([]);
  const [customTemplatesLoading, setCustomTemplatesLoading] = useState(true);
  const [showTemplateChangeModal, setShowTemplateChangeModal] = useState(false);
  const [showGetMoreTemplates, setShowGetMoreTemplates] = useState(false);
  const [showDesignerRequest, setShowDesignerRequest] = useState(false);
  const [templateChangePickerTab, setTemplateChangePickerTab] = useState<"builtin" | "custom" | "crafted">("builtin");
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
  const [regenerateScriptJob, setRegenerateScriptJob] = useState<ProjectRegenerateScriptJob | null>(null);
  const [showRegenerateScriptConfirm, setShowRegenerateScriptConfirm] = useState(false);
  // The "Regenerate" action at the verify step reuses the same modal, pre-filled with the
  // job's prior instruction; on confirm it re-runs stage A instead of creating a new job.
  const [showRegenerateScriptRetry, setShowRegenerateScriptRetry] = useState(false);
  const [regenerateScriptVerifying, setRegenerateScriptVerifying] = useState(false);
  // Previous (pre-regeneration) scenes for the verify popup's before/after comparison.
  // null = loading; [] = loaded with no previous scenes (treat all as new).
  const [regenScriptPreviousScenes, setRegenScriptPreviousScenes] =
    useState<RegenerateScriptPreviewScene[] | null>(null);
  const regenerateScriptPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // True once the user has clicked "Proceed". The DB write that flips the job from
  // "awaiting_review" to "running" may not be visible to the very next poll, so we ignore
  // any stale "awaiting_review" reads while this is set — otherwise the UI bounces back to
  // the verify step. Reset whenever a fresh stage-A run starts (initiate / regenerate).
  const regenerateScriptProceededRef = useRef(false);
  const { craftedTemplates, loading: craftedTemplatesLoading, ensureCraftedTemplateDetail } = useCraftedTemplates();

  useEffect(() => {
    if (!project?.template?.startsWith("crafted_")) return;
    const found = craftedTemplates.find((ct) => ct.id === project.template);
    if (!found?.frontend_files) {
      void ensureCraftedTemplateDetail(project.template);
    }
  }, [project?.template, craftedTemplates, ensureCraftedTemplateDetail]);

  const craftedTemplateLogoUrl = useMemo(() => {
    if (!project?.template?.startsWith("crafted_")) return null;
    const found = craftedTemplates.find((ct) => ct.id === project.template);
    return resolveCraftedTemplateLogoUrl(found);
  }, [project?.template, craftedTemplates]);

  const displayLogoUrl = project?.logo_r2_url || craftedTemplateLogoUrl;

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

  // Upload-based project detection
  const isUploadProject = project?.blog_url?.startsWith("upload://") ?? false;
  const PIPELINE_STEPS = isUploadProject ? PIPELINE_STEPS_UPLOAD : PIPELINE_STEPS_URL;

  // Page-level voiceover add/change/delete progress modal (survives tab switches
  // and page refresh — see VoiceOperationModal). Set to kick it off instantly.
  const [voiceOpKickstart, setVoiceOpKickstart] = useState<
    { kind: "voice_change" | "delete"; total: number } | null
  >(null);

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
  const [sceneExporting, setSceneExporting] = useState(false);
  const [showSlidesExportMenu, setShowSlidesExportMenu] = useState(false);
  const [slideExportWizard, setSlideExportWizard] = useState<SlideExportWizardState | null>(null);
  const previewPlayerRef = useRef<PlayerRef | null>(null);
  const modalPreviewPlayerRef = useRef<PlayerRef | null>(null);
  const slidesExportAnchorRef = useRef<HTMLDivElement | null>(null);
  const videoPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const slideExportWizardPrevRef = useRef<SlideExportWizardState | null>(null);
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
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedToken, setEmbedToken] = useState<string | null>(null);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showPreviewLinkModal, setShowPreviewLinkModal] = useState(false);
  const [previewLinkUrl, setPreviewLinkUrl] = useState<string | null>(null);
  const [previewLinkCopied, setPreviewLinkCopied] = useState(false);
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
  const [expandedScene, setExpandedScene] = useState<number | null>(
    project?.scenes?.[0]?.id ?? null
  );
  const firstSceneAutoExpandedRef = useRef(false);
  useEffect(() => {
    if (firstSceneAutoExpandedRef.current) return;
    const firstId = project?.scenes?.[0]?.id;
    if (firstId != null) {
      firstSceneAutoExpandedRef.current = true;
      setExpandedScene(firstId);
    }
  }, [project?.scenes?.[0]?.id]);
  const [sceneEditModal, setSceneEditModal] = useState<Scene | null>(null);
  const [imageAdjustSceneId, setImageAdjustSceneId] = useState<number | null>(null);
  const [imageAdjustSrc, setImageAdjustSrc] = useState<string | null>(null);
  const [imageAdjustAspectRatio, setImageAdjustAspectRatio] = useState("16 / 9");
  const [isAdjustDragging, setIsAdjustDragging] = useState(false);
  const [imageAdjustFocusX, setImageAdjustFocusX] = useState(50);
  const [imageAdjustFocusY, setImageAdjustFocusY] = useState(50);
  const [imageAdjustZoom, setImageAdjustZoom] = useState(1);
  const [savingImageAdjust, setSavingImageAdjust] = useState(false);
  const imageAdjustPreviewRef = useRef<HTMLDivElement>(null);
  const imageAdjustFocusRef = useRef({ x: 50, y: 50 });
  const imageAdjustPanRef = useRef<{
    startX: number;
    startY: number;
    startFx: number;
    startFy: number;
  } | null>(null);
  const [draggedSceneId, setDraggedSceneId] = useState<number | null>(null);
  const [dragOverSceneId, setDragOverSceneId] = useState<number | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState<Scene | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<number | null>(null);
  const [uploadingSceneId, setUploadingSceneId] = useState<number | null>(null);
  const [imageSourceChooserSceneId, setImageSourceChooserSceneId] = useState<number | null>(null);
  const [scrapedImagesPickerSceneId, setScrapedImagesPickerSceneId] = useState<number | null>(null);
  const [selectedExistingAssetId, setSelectedExistingAssetId] = useState<number | null>(null);
  const [localUploadTargetSceneId, setLocalUploadTargetSceneId] = useState<number | null>(null);
  const [assigningExistingImage, setAssigningExistingImage] = useState(false);
  const [imageGenModalSceneId, setImageGenModalSceneId] = useState<number | null>(null);
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
  const localSceneImageInputRef = useRef<HTMLInputElement>(null);
  const dismissTabsGuide = useCallback(() => {
    if (tourShownThisSessionRef.current && user) localStorage.setItem(tabsGuideSeenKey, "true");
    tourShownThisSessionRef.current = false;
    setRunProjectTour(false);
    navigate(`/project/${id}`, { replace: true });
  }, [navigate, id, user, tabsGuideSeenKey]);
  const projectTourSteps = buildProjectTourSteps(project);
  const scenesLoaded = (project?.scenes?.length ?? 0) > 0;
  const pipelineFinished = project?.status === "generated" || project?.status === "done";

  // Force back to scenes tab when video finishes generating, resetting the manual-change flag.
  useEffect(() => {
    if (pipelineFinished) {
      tabManuallyChanged.current = false;
      setActiveTab("scenes");
    }
  }, [pipelineFinished]);

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

  // Images tab: delete asset confirmation
  const [deletingImageAssetId, setDeletingImageAssetId] = useState<number | null>(null);
  const [imageAssetDeletePending, setImageAssetDeletePending] = useState<{
    id: number;
    filename: string;
  } | null>(null);

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
          setTemplateRelayoutJob(null);
          await loadProject();
          showError(
            job.error_message ||
              "We faced an unforeseen error while processing your request. Please retry — your video count has not been deducted.",
            { variant: "pipeline" }
          );
        }
      } catch {
        stopTemplateRelayoutPolling();
      }
    }, 2000);
  }, [loadProject, projectId, stopTemplateRelayoutPolling, showError]);

  const stopRegenerateScriptPolling = useCallback(() => {
    if (regenerateScriptPollRef.current) {
      clearInterval(regenerateScriptPollRef.current);
      regenerateScriptPollRef.current = null;
    }
  }, []);

  // Load the previous scenes for the verify popup. On error, fall back to [] so the popup
  // isn't stuck on a loading spinner (it then treats every scene as new, no comparison).
  const loadRegenerateScriptPreview = useCallback(async () => {
    try {
      const res = await getRegenerateScriptPreview(projectId);
      setRegenScriptPreviousScenes(res.data?.previous_scenes ?? []);
    } catch {
      setRegenScriptPreviousScenes([]);
    }
  }, [projectId]);

  const startRegenerateScriptPolling = useCallback(() => {
    stopRegenerateScriptPolling();
    regenerateScriptPollRef.current = setInterval(async () => {
      try {
        const res = await getRegenerateScriptStatus(projectId);
        const job = res.data;
        if (!job) return;
        // After the user proceeds, the persisted status may briefly still read
        // "awaiting_review" (DB write not yet visible to this read). Ignore those stale
        // reads so the UI doesn't bounce back to the verify step — keep polling until the
        // status catches up to running/completed/failed.
        if (job.status === "awaiting_review" && regenerateScriptProceededRef.current) {
          return;
        }
        setRegenerateScriptJob(job);
        if (job.status === "awaiting_review") {
          // Paused for verification — stop polling, load the new scenes, and fetch the previous
          // scenes so the verify popup can show the before/after comparison.
          stopRegenerateScriptPolling();
          await loadProject();
          setRegenerateScriptJob(job);
          loadRegenerateScriptPreview();
        } else if (job.status === "completed") {
          regenerateScriptProceededRef.current = false;
          setRegenScriptPreviousScenes(null);
          stopRegenerateScriptPolling();
          // Clear any pipeline state that may have been set by a spurious auto-start
          // (e.g. if the project was stuck in "scripted" on mount and kickOffGeneration fired).
          stopPolling();
          setPipelineRunning(false);
          await loadProject();
          setRegenerateScriptJob(null);
        } else if (job.status === "failed") {
          regenerateScriptProceededRef.current = false;
          setRegenScriptPreviousScenes(null);
          stopRegenerateScriptPolling();
          stopPolling();
          setPipelineRunning(false);
          setRegenerateScriptJob(null);
          await loadProject();
          showError(
            job.error_message
              ? `We're sorry — we couldn't regenerate your script. Your previous version has been restored and no video credit was deducted. (${job.error_message})`
              : "We're sorry — something went wrong while regenerating your script. Your previous version has been restored and no video credit was deducted. Please try again.",
            { variant: "pipeline" }
          );
        }
      } catch {
        stopRegenerateScriptPolling();
      }
    }, 2000);
  }, [loadProject, projectId, stopRegenerateScriptPolling, showError, loadRegenerateScriptPreview]);

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

  useEffect(() => {
    const refreshRegenerateScriptJob = async () => {
      try {
        const res = await getRegenerateScriptStatus(projectId);
        if (!res.data) return;
        setRegenerateScriptJob(res.data);
        if (res.data.status === "queued" || res.data.status === "running") {
          startRegenerateScriptPolling();
        } else if (res.data.status === "awaiting_review") {
          // Resume the verify popup on reload / navigating back into the project.
          loadRegenerateScriptPreview();
        }
      } catch {
        // ignore
      }
    };
    refreshRegenerateScriptJob();
  }, [projectId, startRegenerateScriptPolling, loadRegenerateScriptPreview]);

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
          // Trigger A: free user just finished their last available video → out-of-videos offer.
          // We re-fetch the user directly because refreshUser() updates context async
          // and the closure's `user` is still stale here.
          try {
            const me = await getMe();
            await refreshUser();
            if (me.data.plan === "free" && me.data.can_create_video === false) {
              offer.open();
            }
          } catch {
            // ignore — eligibility just won't fire this tick
          }
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
          const opened = user?.plan === "free" ? offer.open() : false;
          if (!opened) {
            showError(baseMsg, { showUpgrade: true });
          }
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

  const openSlideExportWizard = useCallback(
    (format: "pptx" | "pdf" | "zip") => {
      if (!project?.scenes?.length) return;
      if (missingCustomTemplate) {
        showError("This project cannot export slides because its custom template is missing.");
        return;
      }
      if (!previewPlayerRef.current) {
        showError("Wait until the preview has finished loading, then try again.");
        return;
      }
      setShowSlidesExportMenu(false);
      const defaultFractions = project.scenes.map(() => SCENE_EXPORT_TIMELINE_FRACTION);
      setSlideExportWizard({
        format,
        fractions: defaultFractions,
        stepIndex: 0,
      });
    },
    [project, missingCustomTemplate, showError]
  );

  const runSlideExportWithFractions = useCallback(
    async (format: "pptx" | "pdf" | "zip", fractions: number[]) => {
      if (!project) return;
      const exportPlayer = modalPreviewPlayerRef.current ?? previewPlayerRef.current;
      setSceneExporting(true);
      try {
        const player = exportPlayer;
        if (!player) { showError("Wait until the preview has finished loading, then try again."); return; }
        if (format === "pptx") await exportScenesPptx(player, project, fractions);
        else if (format === "pdf") await exportScenesPdf(player, project, fractions);
        else await exportScenesPng(player, project, fractions);
      } catch (err) {
        showError(getErrorMessage(err, "Could not export scenes."));
      } finally {
        setSceneExporting(false);
        setSlideExportWizard(null);
      }
    },
    [project, showError]
  );

  useEffect(() => {
    if (slideExportWizard && !slideExportWizardPrevRef.current) {
      queueMicrotask(() => {
        videoPreviewContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    slideExportWizardPrevRef.current = slideExportWizard;
  }, [slideExportWizard]);

  // No capture effect needed — modal uses a live VideoPreview with initialFrame.

  const handleGetEmbedLink = async () => {
    if (!project) return;
    setEmbedLoading(true);
    setShowShareDropdown(false);
    try {
      const res = await generateEmbedToken(project.id);
      setEmbedToken(res.data.embed_token);
      setShowEmbedModal(true);
    } catch {
      showError("Could not generate embed link. Please try again.");
    } finally {
      setEmbedLoading(false);
    }
  };

  const handleCopyPreviewLink = async () => {
    if (!project) return;
    setShowShareDropdown(false);
    setEmbedLoading(true);
    try {
      const res = await generateEmbedToken(project.id);
      const previewUrl = `${import.meta.env.VITE_APP_URL || window.location.origin}/preview/${res.data.embed_token}`;
      setPreviewLinkUrl(previewUrl);
      setPreviewLinkCopied(false);
      setShowPreviewLinkModal(true);
    } catch {
      showError("Could not generate preview link. Please try again.");
    } finally {
      setEmbedLoading(false);
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

  const handleRequestDeleteBlogImage = (asset: { id: number; filename: string }) => {
    if (!project) return;
    setImageAssetDeletePending({ id: asset.id, filename: asset.filename });
  };

  const handleConfirmDeleteBlogImage = async () => {
    if (!project || !imageAssetDeletePending) return;
    const id = imageAssetDeletePending.id;
    setDeletingImageAssetId(id);
    try {
      await deleteAsset(project.id, id);
      setImageAssetDeletePending(null);
      await loadProject();
    } catch (err) {
      showError(getErrorMessage(err, "Failed to delete image."));
    } finally {
      setDeletingImageAssetId(null);
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

  const applyRegenerateScript = async (instruction: string) => {
    if (!project) return;
    try {
      const res = await regenerateScript(project.id, { user_instruction: instruction });
      regenerateScriptProceededRef.current = false; // fresh run — the verify pause is expected
      setRegenerateScriptJob(res.data);
      startRegenerateScriptPolling();
    } catch (err) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      // 422 = out-of-context instruction; the modal already shows it inline, so don't also toast it.
      if (status !== 422) {
        showError(
          getErrorMessage(err, "Failed to start script regeneration."),
          status === 403 ? { showUpgrade: true } : undefined
        );
      }
      throw err; // let the modal surface the error inline
    }
  };

  // Verify step — "Proceed": approve the regenerated script and resume scene generation.
  const handleVerifyRegenerateScript = async () => {
    if (!project) return;
    setRegenerateScriptVerifying(true);
    regenerateScriptProceededRef.current = true; // ignore stale "awaiting_review" reads from now on
    try {
      const res = await verifyRegenerateScript(project.id);
      setRegenerateScriptJob(res.data);
      startRegenerateScriptPolling();
    } catch (err) {
      showError(getErrorMessage(err, "Failed to continue script generation."));
    } finally {
      setRegenerateScriptVerifying(false);
    }
  };

  // Verify step — "Regenerate" (modal confirm): discard and re-run stage A with the
  // (optionally edited) instruction. No credit is charged for re-runs.
  const applyRejectRegenerateScript = async (instruction: string) => {
    if (!project) return;
    try {
      const res = await rejectRegenerateScript(project.id, { user_instruction: instruction });
      regenerateScriptProceededRef.current = false; // re-run reaches the verify pause again
      setRegenerateScriptJob(res.data);
      startRegenerateScriptPolling();
    } catch (err) {
      const status = err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      // 422 = out-of-context instruction; the modal already shows it inline, so don't also toast it.
      if (status !== 422) {
        showError(getErrorMessage(err, "Failed to regenerate the script."));
      }
      throw err; // let the modal surface the error inline
    }
  };

  const assignedTemplateId = project?.template || "default";
  const readyCustomForPicker = customTemplatesList.filter((ct) => !!ct.intro_code);
  const readyCraftedForPicker = (craftedTemplates || []).filter((ct: CraftedTemplateItem) => !!ct.theme);

  useEffect(() => {
    imageAdjustFocusRef.current = { x: imageAdjustFocusX, y: imageAdjustFocusY };
  }, [imageAdjustFocusX, imageAdjustFocusY]);

  useEffect(() => {
    if (!isAdjustDragging || !imageAdjustSceneId || !imageAdjustSrc) return;
    const pan = imageAdjustPanRef.current;
    if (!pan) return;

    const clamp = (v: number) => Math.max(0, Math.min(100, v));

    const applyPan = (clientX: number, clientY: number) => {
      const el = imageAdjustPreviewRef.current;
      if (!el || !imageAdjustPanRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const { startX, startY, startFx, startFy } = imageAdjustPanRef.current;
      const dxPct = ((clientX - startX) / rect.width) * 100;
      const dyPct = ((clientY - startY) / rect.height) * 100;
      setImageAdjustFocusX(clamp(startFx - dxPct));
      setImageAdjustFocusY(clamp(startFy - dyPct));
    };

    const onMouseMove = (e: MouseEvent) => applyPan(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();
      applyPan(touch.clientX, touch.clientY);
    };
    const endPan = () => {
      setIsAdjustDragging(false);
      imageAdjustPanRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", endPan);
    window.addEventListener("touchend", endPan);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", endPan);
      window.removeEventListener("touchend", endPan);
    };
  }, [isAdjustDragging, imageAdjustSceneId, imageAdjustSrc]);

  useLayoutEffect(() => {
    if (imageAdjustSceneId === null || !imageAdjustSrc) return;
    const el = imageAdjustPreviewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY;
      setImageAdjustZoom((z) => {
        const factor = delta > 0 ? 0.97 : 1.03;
        const next = Math.min(
          IMAGE_ADJUST_ZOOM_MAX,
          Math.max(IMAGE_ADJUST_ZOOM_MIN, z * factor)
        );
        return Math.round(next * 100) / 100;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [imageAdjustSceneId, imageAdjustSrc]);

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

  const tabs: ProjectTabItem[] = [
    { id: "scenes", label: "Scenes" },
    { id: "script", label: "Script" },
    { id: "images", label: "Images" },
    ...(project.voice_gender !== "none" ? [{ id: "audio" as Tab, label: "Audio" }] : []),
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
  const scrapedImageOptions = imageAssets.map((asset) => ({
    asset,
    url: resolveAssetUrl(asset, project.id),
  }));
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

    // 1) Honor stored assignedImage (any filename); multiple scenes may share one file.
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
        return;
      }

      const assignedImage = layoutProps.assignedImage as string | undefined;
      if (assignedImage && filenameToAsset.has(assignedImage)) {
        const asset = filenameToAsset.get(assignedImage)!;
        const url = resolveAssetUrl(asset, project.id);
        sceneImageMap[idx] = [url];
        sceneImageAssetsMap[idx] = [{ url, asset }];
        usedGenericFiles.add(assignedImage);
      }
    });

    // 2) Orphan scene_<id>_ files on disk with no layoutProps — bind to matching scene only
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
    for (const { sceneId, url, asset } of sceneSpecific) {
      const sceneIdx = project.scenes.findIndex((s) => s.id === sceneId);
      if (sceneIdx < 0 || hideImageFlags[sceneIdx]) continue;
      let layoutProps: Record<string, unknown> = {};
      if (project.scenes[sceneIdx].remotion_code) {
        try {
          const descriptor = JSON.parse(project.scenes[sceneIdx].remotion_code!);
          layoutProps = (descriptor.layoutProps as Record<string, unknown>) || {};
        } catch {
          /* legacy */
        }
      }
      if (layoutProps.assignedImage || layoutProps.hideImage) continue;
      sceneImageMap[sceneIdx] = [url];
      sceneImageAssetsMap[sceneIdx] = [{ url, asset }];
      usedGenericFiles.add(asset.filename);
    }

    // 3) Auto-fill remaining scenes with unused generic images (match backend)
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

  const handleRemoveSceneImage = async (scene: Scene, assetId: number) => {
    setRemovingAssetId(assetId);
    try {
      let descriptor: Record<string, unknown> = {};
      if (scene.remotion_code) {
        try {
          descriptor = JSON.parse(scene.remotion_code);
        } catch {
          descriptor = {};
        }
      }
      const layoutProps: Record<string, unknown> = {
        ...((descriptor.layoutProps as Record<string, unknown>) || {}),
        hideImage: true,
      };
      delete layoutProps.assignedImage;
      delete layoutProps.imageFocusX;
      delete layoutProps.imageFocusY;
      delete layoutProps.imageZoom;
      descriptor.layoutProps = layoutProps;
      await updateScene(project.id, scene.id, {
        remotion_code: JSON.stringify(descriptor),
      });
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

  const handleOpenImageSourceChooser = (sceneId: number) => {
    setImageSourceChooserSceneId(sceneId);
    setSelectedExistingAssetId(null);
  };

  const handleChooseLocalUpload = () => {
    if (!imageSourceChooserSceneId) return;
    setLocalUploadTargetSceneId(imageSourceChooserSceneId);
    setImageSourceChooserSceneId(null);
    localSceneImageInputRef.current?.click();
  };

  const handleChooseScrapedImages = () => {
    if (!imageSourceChooserSceneId) return;
    setScrapedImagesPickerSceneId(imageSourceChooserSceneId);
    setImageSourceChooserSceneId(null);
    setSelectedExistingAssetId(null);
  };

  const handleLocalSceneFilePicked = (file: File | null) => {
    if (!file || !localUploadTargetSceneId) return;
    handleAddSceneImage(localUploadTargetSceneId, file).catch((err) =>
      showError(getErrorMessage(err) || DEFAULT_ERROR_MESSAGE)
    );
  };

  const handleAssignExistingImageToScene = async () => {
    if (!scrapedImagesPickerSceneId || !selectedExistingAssetId) return;
    setAssigningExistingImage(true);
    try {
      await assignExistingImageToScene(project.id, scrapedImagesPickerSceneId, selectedExistingAssetId);
      setScrapedImagesPickerSceneId(null);
      setSelectedExistingAssetId(null);
      await loadProject();
    } catch (err) {
      showError(getErrorMessage(err) || DEFAULT_ERROR_MESSAGE);
    } finally {
      setAssigningExistingImage(false);
    }
  };

  const clampFocus = (value: number) => Math.max(0, Math.min(100, value));

  const getSceneFocus = (scene: Scene): { x: number; y: number } => {
    try {
      if (!scene.remotion_code) return { x: 50, y: 50 };
      const parsed = JSON.parse(scene.remotion_code) as { layoutProps?: { imageFocusX?: unknown; imageFocusY?: unknown } };
      const xRaw = typeof parsed.layoutProps?.imageFocusX === "number" ? parsed.layoutProps.imageFocusX : 50;
      const yRaw = typeof parsed.layoutProps?.imageFocusY === "number" ? parsed.layoutProps.imageFocusY : 50;
      return { x: clampFocus(xRaw), y: clampFocus(yRaw) };
    } catch {
      return { x: 50, y: 50 };
    }
  };

  const getSceneImageZoom = (scene: Scene): number => {
    try {
      if (!scene.remotion_code) return 1;
      const parsed = JSON.parse(scene.remotion_code) as { layoutProps?: { imageZoom?: unknown } };
      const zoomRaw = typeof parsed.layoutProps?.imageZoom === "number" ? parsed.layoutProps.imageZoom : 1;
      return Math.max(IMAGE_ADJUST_ZOOM_MIN, zoomRaw);
    } catch {
      return 1;
    }
  };

  const openSceneImageAdjustModal = (scene: Scene, src: string) => {
    const focus = getSceneFocus(scene);
    const zoom = getSceneImageZoom(scene);

    // Compute the correct aspect ratio for the modal preview
    let ar: string;
    if (project?.template?.startsWith("custom_") && project) {
      ar = resolveCustomImageBoxAr(scene, project);
    } else {
      let layoutId: string | null = null;
      try {
        if (scene.remotion_code) {
          const desc = JSON.parse(scene.remotion_code) as { layout?: string; layoutConfig?: { arrangement?: string } };
          // Intentionally exclude sceneTypeOverride — "intro"/"content"/"outro" are not layout IDs
          // and would incorrectly map to built-in layout dims via the alias table.
          layoutId = desc.layoutConfig?.arrangement ?? desc.layout ?? null;
        }
      } catch { /* ignore */ }
      const templateCfg = getTemplateConfig(project?.template || "default");
      ar = getImageBoxAspectRatio(
        layoutId ? normalizeLayoutId(layoutId) : null,
        project?.aspect_ratio || "landscape",
        templateCfg.baseWidth,
        templateCfg.baseHeight,
      );
    }
    setImageAdjustAspectRatio(ar);

    setImageAdjustSceneId(scene.id);
    setImageAdjustSrc(src);
    setIsAdjustDragging(false);
    setImageAdjustFocusX(focus.x);
    setImageAdjustFocusY(focus.y);
    setImageAdjustZoom(Math.min(IMAGE_ADJUST_ZOOM_MAX, Math.max(IMAGE_ADJUST_ZOOM_MIN, zoom)));
    imageAdjustPanRef.current = null;
  };

  const closeSceneImageAdjustModal = () => {
    if (savingImageAdjust) return;
    setImageAdjustSceneId(null);
    setImageAdjustSrc(null);
    setIsAdjustDragging(false);
    imageAdjustPanRef.current = null;
  };

  const handleAdjustMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    imageAdjustPanRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFx: imageAdjustFocusRef.current.x,
      startFy: imageAdjustFocusRef.current.y,
    };
    setIsAdjustDragging(true);
  };

  const handleAdjustTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();
    imageAdjustPanRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startFx: imageAdjustFocusRef.current.x,
      startFy: imageAdjustFocusRef.current.y,
    };
    setIsAdjustDragging(true);
  };

  const saveSceneImageAdjust = async () => {
    if (!imageAdjustSceneId) return;
    setSavingImageAdjust(true);
    try {
      const zoomToSave = Math.max(IMAGE_ADJUST_ZOOM_MIN, Math.min(IMAGE_ADJUST_ZOOM_MAX, imageAdjustZoom));
      const targetScene = project.scenes.find((s) => s.id === imageAdjustSceneId);
      if (targetScene?.remotion_code) {
        const descriptor = JSON.parse(targetScene.remotion_code) as { layoutProps?: Record<string, unknown> };
        const layoutProps = { ...(descriptor.layoutProps || {}) };
        layoutProps.imageFocusX = clampFocus(imageAdjustFocusX);
        layoutProps.imageFocusY = clampFocus(imageAdjustFocusY);
        layoutProps.imageZoom = zoomToSave;
        layoutProps.hideImage = false;
        descriptor.layoutProps = layoutProps;
        await updateScene(project.id, imageAdjustSceneId, {
          remotion_code: JSON.stringify(descriptor),
        });
      } else {
        await updateSceneImageFocus(
          project.id,
          imageAdjustSceneId,
          clampFocus(imageAdjustFocusX),
          clampFocus(imageAdjustFocusY),
          zoomToSave
        );
      }
      await loadProject();
      setImageAdjustSceneId(null);
      setImageAdjustSrc(null);
      setIsAdjustDragging(false);
      imageAdjustPanRef.current = null;
    } catch (err) {
      showError(getErrorMessage(err) || DEFAULT_ERROR_MESSAGE);
    } finally {
      setSavingImageAdjust(false);
    }
  };

  const handleGenerateSceneImageClick = (sceneId: number) => {
    if (!isPro) {
      setShowAiImageUpgradeModal(true);
      return;
    }
    setGenerateImageError(null);
    setGenerateErrorSceneId(null);
    setImageGenModalSceneId(sceneId);
  };

  const handleSceneImageReady = (sceneId: number, imageBase64: string, refinedPrompt: string) => {
    setGeneratedImageBase64(imageBase64);
    setGeneratedPrompt(refinedPrompt);
    setGeneratedImageSceneId(sceneId);
    setGenerateImageError(null);
    setGenerateErrorSceneId(null);
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
  // Also treat the project's own "script_regenerating" status as running so the loader stays
  // visible during the brief window before the job poll loads (and on resume after reload).
  // "awaiting_review" must keep the loader up too: at the running→awaiting_review transition the
  // job poll sets the status before loadProject refreshes project.status, so without this the
  // loader would briefly drop out and flash the completed video.
  const regenerateScriptRunning =
    regenerateScriptJob?.status === "running" ||
    regenerateScriptJob?.status === "queued" ||
    regenerateScriptJob?.status === "awaiting_review" ||
    project.status === "script_regenerating";
  const statusForBadge = templateRelayoutRunning || regenerateScriptRunning ? "regenerating" : project.status;
  const renderGenerationLoader = (mode: "pipeline" | "template-relayout" | "regenerate-script" = "pipeline") => {
    const relayoutProgressRaw =
      templateRelayoutJob && templateRelayoutJob.total_scenes > 0
        ? (templateRelayoutJob.processed_scenes / templateRelayoutJob.total_scenes) * 100
        : templateRelayoutJob?.status === "queued"
        ? 8
        : 0;
    const relayoutProgress = Math.max(8, Math.min(98, Math.round(relayoutProgressRaw)));
    // Regenerate-script is shown as discrete backend phases instead of a percentage.
    // The "verify" step is a user-gated pause between the script and scene stages.
    const REGEN_SCRIPT_STEPS = [
      { id: "analyzing_instruction", label: "Analyzing instruction" },
      { id: "generating_script", label: "Generating script" },
      { id: "verify", label: "Verify script" },
      { id: "generating_scenes", label: "Generating scenes" },
    ] as const;
    const regenScriptAwaitingReview = regenerateScriptJob?.status === "awaiting_review";
    const regenScriptStepId =
      regenScriptAwaitingReview
        ? "verify"
        : regenerateScriptJob?.current_step ??
          (regenerateScriptJob && regenerateScriptJob.total_scenes > 0
            ? "generating_scenes"
            : regenerateScriptJob?.status === "queued"
            ? "analyzing_instruction"
            : "generating_script");
    const regenScriptCompleted = regenerateScriptJob?.status === "completed";
    const regenScriptStepIdx =
      regenScriptCompleted
        ? REGEN_SCRIPT_STEPS.length
        : Math.max(0, REGEN_SCRIPT_STEPS.findIndex((step) => step.id === regenScriptStepId));
    // Fill for the progress bar above the step circles. Each step maps to a fixed percentage
    // (the last step stays below 100% — it only completes when the run actually finishes).
    const REGEN_SCRIPT_PROGRESS = [15, 40, 60, 80];
    const regenScriptProgress = regenScriptCompleted
      ? 100
      : REGEN_SCRIPT_PROGRESS[Math.min(regenScriptStepIdx, REGEN_SCRIPT_PROGRESS.length - 1)];
    const stepLabels =
      mode === "template-relayout" || mode === "regenerate-script"
        ? []
        : PIPELINE_STEPS.map((s) => s.label);
    const currentStepIdx =
      mode === "template-relayout" || mode === "regenerate-script"
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
            {mode === "regenerate-script"
              ? "Regenerating script"
              : mode === "template-relayout"
              ? "Regenerating scene layouts"
              : "Generating your video"}
          </h2>
          <p className="text-xs text-gray-400 mb-8">{project.name}</p>

          {mode !== "regenerate-script" && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
              <div
                className="h-full bg-purple-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Regenerate-script: a standalone progress bar (fills purple as the run proceeds)
              above a row of independent step circles — the circles are NOT connected. */}
          {mode === "regenerate-script" && (
            <div className="mb-8 mt-2">
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${regenScriptProgress}%` }}
                />
              </div>
              <div className="flex items-start justify-between">
                {REGEN_SCRIPT_STEPS.map(({ id, label }, i) => {
                  const isDone = i < regenScriptStepIdx;
                  const isActive = i === regenScriptStepIdx;
                  return (
                    <div key={id} className="flex flex-col items-center gap-2 w-16 sm:w-20">
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span
                        className={`text-[11px] sm:text-xs font-medium text-center leading-tight ${
                          isDone ? "text-green-600" : isActive ? "text-purple-600" : "text-gray-400"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mode !== "template-relayout" && mode !== "regenerate-script" && (
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

          {mode === "regenerate-script" && regenScriptAwaitingReview ? (
            /* Verify step — paused for review. Actions live in the (non-closeable) verify popup. */
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-sm text-gray-700 font-medium">Verify the script</span>
              <span className="text-xs text-gray-400 max-w-xs">
                Review the changes in the popup, then proceed or regenerate.
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">
                {mode === "regenerate-script"
                  ? regenScriptCompleted
                    ? "Regeneration complete..."
                    : `${REGEN_SCRIPT_STEPS[regenScriptStepIdx]?.label ?? "Finishing up"}...`
                  : mode === "template-relayout"
                  ? `${progress}% complete`
                  : `${stepLabels[currentStepIdx] ?? "Finishing up"}...`}
              </span>
            </div>
          )}

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
                <div className="flex items-center shrink-0" data-action="aspect-ratio">
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

                {/* Download — MP4 plus slide exports (PowerPoint, PDF, PNG) in one menu */}
                <div className="relative" ref={slidesExportAnchorRef}>
                  <button
                    type="button"
                    data-action="render-button"
                    onClick={() => {
                      setShowShareDropdown(false);
                      setShowSlidesExportMenu((v) => !v);
                    }}
                    disabled={missingCustomTemplate || sceneExporting || downloading}
                    title="MP4 video, or slides — PowerPoint, PDF, or one PNG per scene (pick the frame per scene before export; default ~85%)."
                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                      missingCustomTemplate
                        ? "bg-gray-300 text-white cursor-not-allowed"
                        : !rendered
                        ? hasError
                          ? "bg-orange-500 hover:bg-orange-600 text-white"
                          : "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-100 disabled:text-gray-400"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {downloading ? (
                      <>
                        <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Downloading…
                      </>
                    ) : sceneExporting ? (
                      <>
                        <span className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Exporting…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download
                        <svg className="w-3 h-3 ml-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>

                {rendered && (
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
                )}

                {/* Share — purple; menu includes rendered-video options when MP4 exists */}
                {project?.scenes && project.scenes.length > 0 && (
                  <div className="relative" ref={shareAnchorRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSlidesExportMenu(false);
                        setShowShareDropdown((v) => !v);
                      }}
                      disabled={embedLoading}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      {embedLoading ? "Loading..." : "Share"}
                      <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
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
                      ref={videoPreviewContainerRef}
                      className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
                      style={{
                        position: "relative",
                        ...(project.aspect_ratio === "portrait" ? { minHeight: "70vh" } : {}),
                      }}
                    >
                      <VideoPreview
                        ref={previewPlayerRef}
                        project={project}
                        layoutPropSchema={layoutPropSchema !== null ? layoutPropSchema : undefined}
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

      <OutOfVideosOfferModal
        open={offer.isOpen}
        onClose={offer.dismiss}
        secondsRemaining={offer.secondsRemaining}
        isWindowLive={offer.isWindowLive}
        onExpand={offer.expand}
      />

      {/* Page-level voiceover add/change/delete progress — survives tab switches and
          page refresh (it re-detects an in-flight op from the server on mount). */}
      <VoiceOperationModal
        projectId={projectId}
        onComplete={async () => {
          await loadProject();
          setVoiceOpKickstart(null);
        }}
        onError={(msg) => {
          setVoiceOpKickstart(null);
          showError(msg);
        }}
        kickstart={voiceOpKickstart}
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
      {showEmbedModal && embedToken && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowEmbedModal(false); setEmbedCopied(false); }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-7 transition-all" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setShowEmbedModal(false); setEmbedCopied(false); }}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Embed this video</h3>
            <p className="text-sm text-gray-600 mb-5">Paste this snippet into your website to show the live preview — no rendering required.</p>
            <div className="relative">
              <textarea
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 pr-10 text-xs font-mono text-gray-700 resize-none focus:outline-none"
                rows={5}
                value={`<iframe\n  src="${(import.meta.env.VITE_APP_URL || window.location.origin)}/preview/${embedToken}"\n  width="800"\n  height="${project?.aspect_ratio === 'portrait' ? '711' : '450'}"\n  frameborder="0"\n  allowfullscreen\n  style="border:none;"\n  data-powered-by="https://blog2video.app"\n  data-creator="https://www.firebird-technologies.com/about"\n></iframe>`}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `<iframe\n  src="${(import.meta.env.VITE_APP_URL || window.location.origin)}/preview/${embedToken}"\n  width="800"\n  height="${project?.aspect_ratio === 'portrait' ? '711' : '450'}"\n  frameborder="0"\n  allowfullscreen\n  style="border:none;"\n  data-powered-by="https://blog2video.app"\n  data-creator="https://www.firebird-technologies.com/about"\n></iframe>`
                  );
                  setEmbedCopied(true);
                  setTimeout(() => setEmbedCopied(false), 2000);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                title="Copy to clipboard"
              >
                {embedCopied ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
    
          </div>
        </div>,
        document.body
      )}

      {showPreviewLinkModal && previewLinkUrl && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowPreviewLinkModal(false); setPreviewLinkCopied(false); }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-7 transition-all" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setShowPreviewLinkModal(false); setPreviewLinkCopied(false); }}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-purple-500/80 text-purple-600 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Link to Preview</h3>
            <p className="text-sm text-gray-600 mb-5">Share this link to let anyone view the video preview — no account required.</p>
            <div className="relative">
              <input
                readOnly
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-10 text-xs font-mono text-gray-700 focus:outline-none"
                value={previewLinkUrl}
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewLinkUrl).then(() => {
                    setPreviewLinkCopied(true);
                    setTimeout(() => setPreviewLinkCopied(false), 2000);
                  }).catch(() => {
                    // clipboard blocked — user can select and copy manually
                  });
                }}
                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                title="Copy to clipboard"
              >
                {previewLinkCopied ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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

      <GetMoreTemplatesModal
        open={showGetMoreTemplates}
        onClose={() => setShowGetMoreTemplates(false)}
        onChooseLink={() => {
          setShowGetMoreTemplates(false);
          openCraftCustomTemplateFromProjectSettings();
        }}
        onChooseDesigner={() => {
          setShowGetMoreTemplates(false);
          setShowDesignerRequest(true);
        }}
      />
      <DesignerTemplateRequestModal
        open={showDesignerRequest}
        onClose={() => setShowDesignerRequest(false)}
      />

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

      <RegenerateScriptModal
        open={showRegenerateScriptConfirm}
        projectName={project?.name}
        onClose={() => setShowRegenerateScriptConfirm(false)}
        onConfirm={async (instruction) => {
          await applyRegenerateScript(instruction);
        }}
      />

      {/* Verify-step "Regenerate": re-run the script (optionally with an edited instruction),
          pre-filled with the instruction the paused job used. */}
      <RegenerateScriptModal
        open={showRegenerateScriptRetry}
        projectName={project?.name}
        initialInstruction={regenerateScriptJob?.user_instruction ?? ""}
        confirmLabel="Regenerate"
        onClose={() => setShowRegenerateScriptRetry(false)}
        onConfirm={async (instruction) => {
          await applyRejectRegenerateScript(instruction);
        }}
      />

      {/* Non-closeable verify popup — walks the user through new-vs-old scene comparisons.
          Shown whenever the regeneration is paused awaiting review (persists across reloads). */}
      <VerifyScriptModal
        open={regenerateScriptJob?.status === "awaiting_review" && !showRegenerateScriptRetry}
        projectName={project?.name}
        newScenes={project?.scenes ?? []}
        previousScenes={regenScriptPreviousScenes}
        verifying={regenerateScriptVerifying}
        onProceed={handleVerifyRegenerateScript}
        onRegenerate={() => setShowRegenerateScriptRetry(true)}
      />

      <ConfirmDeleteModal
        open={imageAssetDeletePending != null}
        onClose={() => setImageAssetDeletePending(null)}
        title="Delete this image?"
        subtitle={imageAssetDeletePending?.filename}
        warningMessage="This removes the file from the project. Scenes that used it will hide their image. This cannot be undone."
        confirmLabel="Yes, delete"
        confirmLoadingLabel="Deleting…"
        onConfirm={handleConfirmDeleteBlogImage}
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
                  <button
                    type="button"
                    onClick={() => setTemplateChangePickerTab("crafted")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      templateChangePickerTab === "crafted"
                        ? "bg-white text-purple-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Designer Templates
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">Selected preview</p>
                  <div className="rounded-xl overflow-hidden border-2 border-purple-500 shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
                    <div className="relative max-h-[200px] overflow-hidden">
                      <TemplateAssignPreview
                        templateId={templateChangeDraft}
                        customTemplates={customTemplatesList}
                        craftedTemplates={readyCraftedForPicker}
                        projectCustomTheme={project.custom_theme ?? null}
                        projectName={project.name}
                        variant="large"
                        previewCompileScope={user?.id != null ? String(user.id) : undefined}
                      />
                    </div>
                    <div className="px-3 py-2 bg-purple-50/80 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {templateChangeDraft.startsWith("custom_")
                          ? customTemplatesList.find(
                              (c) => c.id === parseInt(templateChangeDraft.replace("custom_", ""), 10)
                            )?.name ?? "Custom"
                          : templateChangeDraft.startsWith("crafted_")
                            ? readyCraftedForPicker.find((c) => c.id === templateChangeDraft)?.name ?? "Designer"
                          : TEMPLATE_DESCRIPTIONS[templateChangeDraft]?.title ?? templateMetas.find((m) => m.id === templateChangeDraft)?.name ?? templateChangeDraft}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-2">
                    All {templateChangePickerTab === "builtin" ? "built-in" : templateChangePickerTab === "custom" ? "custom" : "designer"} templates
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
                    ) : templateChangePickerTab === "custom" ? (
                      <div className="grid grid-cols-3 gap-4">
                        <CraftYourTemplateCard
                          variant="default"
                          isPro={isPro}
                          onClick={() => {
                            if (!isPro) { setShowUpgrade(true); return; }
                            setShowGetMoreTemplates(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!isPro) { setShowUpgrade(true); return; }
                              setShowGetMoreTemplates(true);
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
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        {readyCraftedForPicker.map((ct) => {
                          const craftedId = ct.id;
                          const isSel = templateChangeDraft === craftedId;
                          return (
                            <button
                              key={craftedId}
                              type="button"
                              onClick={() => setTemplateChangeDraft(craftedId)}
                              className={`text-left rounded-lg overflow-hidden border-2 transition-all ${
                                isSel ? "border-purple-500 shadow-[0_0_0_2px_rgba(124,58,237,0.12)]" : "border-gray-200/60 hover:border-purple-300/60"
                              }`}
                            >
                              <div className="relative isolate overflow-hidden max-h-[70px] min-h-[56px]">
                                <div className="relative z-0 min-h-[56px] pointer-events-none">
                                  <CraftedTemplatePreview
                                    templateId={craftedId}
                                    compileCacheScope={user?.id != null ? String(user.id) : undefined}
                                    previewSource={ct.preview_file ?? null}
                                    previewImageUrl={ct.preview_image_url ?? null}
                                    name={ct.name}
                                    thumbnailMode
                                    showLoaderOnEmptyOrError
                                  />
                                </div>
                                <div className="pointer-events-none absolute top-1 left-1 z-20 px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500 text-white shadow-sm">
                                  Designer
                                </div>
                              </div>
                              <div className={`px-2 py-1 ${isSel ? "bg-purple-50/80" : "bg-white/80"}`}>
                                <div className="text-[10px] font-semibold text-gray-800 truncate">{ct.name}</div>
                              </div>
                            </button>
                          );
                        })}
                        {craftedTemplatesLoading && (
                          <div
                            className="rounded-lg border border-dashed border-gray-200/80 bg-white/70 flex flex-col items-center justify-center gap-2 min-h-[88px] px-2 py-3 text-center"
                            role="status"
                            aria-live="polite"
                          >
                            <span className="w-4 h-4 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin shrink-0" aria-hidden />
                            <p className="text-[10px] text-gray-500 leading-snug">
                              Loading designer templates, please wait.
                            </p>
                          </div>
                        )}
                        {!craftedTemplatesLoading && readyCraftedForPicker.length === 0 && (
                          <p className="col-span-2 text-xs text-gray-500 py-4 text-center flex items-center justify-center">
                            No designer templates available.
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

      {showShareDropdown &&
        project?.scenes &&
        project.scenes.length > 0 &&
        ReactDOM.createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowShareDropdown(false)} />
            <div
              className="fixed z-[9999] w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden"
              style={(() => {
                const el = shareAnchorRef.current;
                if (!el) return {};
                const rect = el.getBoundingClientRect();
                const panelW = 224;
                let left = rect.right - panelW;
                if (left < 8) left = 8;
                if (left + panelW > window.innerWidth - 8) {
                  left = Math.max(8, window.innerWidth - panelW - 8);
                }
                return { top: rect.bottom + 8, left };
              })()}
            >
              <button
                type="button"
                disabled={embedLoading}
                onClick={() => {
                  void handleCopyPreviewLink();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Share Preview Link
              </button>
              <button
                type="button"
                disabled={embedLoading}
                onClick={() => {
                  void handleGetEmbedLink();
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Embed
              </button>
              {project.r2_video_url && (
                <>
                  <div className="border-t border-gray-100 my-0.5" />
                  <p className="px-4 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    Rendered video
                  </p>
                  <div className="px-4 pb-2 flex gap-1 justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(project.r2_video_url!);
                        setShowShareDropdown(false);
                      }}
                      className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-black/5 flex items-center justify-center transition-colors"
                      title="Copy link for TikTok"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-1.59-.27 4.83 4.83 0 01-1.41-.82V6.69h3z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(project.r2_video_url!);
                        setShowShareDropdown(false);
                      }}
                      className="w-9 h-9 rounded-lg bg-gray-50 hover:bg-red-50 flex items-center justify-center transition-colors"
                      title="Copy link for YouTube"
                    >
                      <svg className="w-4 h-4 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(
                          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(project.r2_video_url!)}`,
                          "_blank"
                        );
                        setShowShareDropdown(false);
                      }}
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
            </div>
          </>,
          document.body
        )}

      {showSlidesExportMenu &&
        !missingCustomTemplate &&
        ReactDOM.createPortal(
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowSlidesExportMenu(false)}
            />
            <div
              className="fixed z-[9999] w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden"
              style={(() => {
                const el = slidesExportAnchorRef.current;
                if (!el) return {};
                const rect = el.getBoundingClientRect();
                const panelW = 224;
                let left = rect.right - panelW;
                if (left < 8) left = 8;
                if (left + panelW > window.innerWidth - 8) {
                  left = Math.max(8, window.innerWidth - panelW - 8);
                }
                return { top: rect.bottom + 8, left };
              })()}
            >
              <button
                type="button"
                data-action="render-button"
                data-action-download="download-video"
                disabled={downloading || sceneExporting}
                onClick={() => {
                  setShowSlidesExportMenu(false);
                  if (!rendered) {
                    setHasError(false);
                    setDownloadWarningMode("render");
                    setShowDownloadWarning(true);
                  } else {
                    setDownloadWarningMode("download");
                    setShowDownloadWarning(true);
                  }
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-800 transition-colors disabled:opacity-50"
              >
                {hasError && !rendered ? "Resume MP4 download" : "MP4 video"}
              </button>
              {project?.scenes && project.scenes.length > 0 && (
                <>
                  <div className="border-t border-gray-100 my-0.5" />
                  <button
                    type="button"
                    disabled={sceneExporting || downloading}
                    onClick={() => openSlideExportWizard("pptx")}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-800 transition-colors disabled:opacity-50"
                  >
                    PowerPoint (.pptx)
                  </button>
                  <button
                    type="button"
                    disabled={sceneExporting || downloading}
                    onClick={() => openSlideExportWizard("pdf")}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-800 transition-colors disabled:opacity-50"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={sceneExporting || downloading}
                    onClick={() => openSlideExportWizard("zip")}
                    className="w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-800 transition-colors disabled:opacity-50"
                  >
                    PNG images (one per scene)
                  </button>
                </>
              )}
            </div>
          </>,
          document.body
        )}


      {slideExportWizard &&
        project?.scenes?.length &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-6">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px] border-0 cursor-default"
              aria-label="Close"
              onClick={() => { setSlideExportWizard(null); }}
            />
            <div
              className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 p-5 sm:p-7"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="slide-export-wizard-title"
            >
              <h2 id="slide-export-wizard-title" className="text-sm font-semibold text-gray-900">
                Choose the frame for each slide
              </h2>
              <p className="mt-1 text-xs text-gray-500 leading-snug">
                The preview below updates while you adjust the slider. Go through each scene, then download — your choices are used for PowerPoint, PDF, and PNG export.
              </p>
              {(() => {
                const w = slideExportWizard;
                const scenes = project.scenes;
                const idx = w.stepIndex;
                const scene = scenes[idx]!;
                const title = scene.title?.trim() || `Scene ${idx + 1}`;
                const n = scenes.length;
                const rawFraction = w.fractions[idx];
                const safeFraction = Number.isFinite(rawFraction)
                  ? Math.max(0, Math.min(1, Number(rawFraction)))
                  : SCENE_EXPORT_TIMELINE_FRACTION;
                const pct = Math.round(safeFraction * 100);
                const downloadLabel =
                  w.format === "pptx"
                    ? "Download PowerPoint"
                    : w.format === "pdf"
                    ? "Download PDF"
                    : "Download PNGs";
                return (
                  <>
                    <div className="mt-3">
                      <div>
                        <p className="text-xs font-medium text-gray-800">
                          Scene {idx + 1} of {n}
                          <span className="font-normal text-gray-500"> · {title}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          Preview at <span className="font-medium text-gray-700">{pct}%</span> of this scene
                        </p>
                        {sceneExporting && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1.5">
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-300 border-t-purple-700 animate-spin" />
                            <span className="text-[11px] font-medium text-purple-800">
                              Download in progress...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Live Remotion player — pixel-perfect, no html2canvas needed.
                        Key includes frame so it remounts (and seeks) on every change. */}
                    <div className="mt-4 rounded-xl overflow-hidden w-full aspect-video bg-black">
                      <VideoPreview
                        key={`modal-preview-${idx}-${pct}`}
                        ref={modalPreviewPlayerRef}
                        project={project}
                        layoutPropSchema={layoutPropSchema !== null ? layoutPropSchema : undefined}
                        logoSizeOverride={logoSize}
                        logoOpacityOverride={logoOpacity}
                        logoPositionOverride={logoPosition}
                        initialFrame={getSceneExportGlobalFrame(project, idx, safeFraction)}
                        hideControls
                      />
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                        <span>Position in scene</span>
                        <span className="tabular-nums font-medium text-gray-700">{pct}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={pct}
                        onChange={(e) => {
                          const v = Number(e.target.value) / 100;
                          setSlideExportWizard((prev) => {
                            if (!prev) return prev;
                            const fractions = [...prev.fractions];
                            fractions[prev.stepIndex] = v;
                            return { ...prev, fractions };
                          });
                        }}
                        className="w-full h-2 accent-purple-600 cursor-pointer"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSlideExportWizard((prev) =>
                            prev && prev.stepIndex > 0 ? { ...prev, stepIndex: prev.stepIndex - 1 } : prev
                          )
                        }
                        disabled={idx <= 0 || sceneExporting}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSlideExportWizard((prev) =>
                            prev && prev.stepIndex < n - 1
                              ? { ...prev, stepIndex: prev.stepIndex + 1 }
                              : prev
                          )
                        }
                        disabled={idx >= n - 1 || sceneExporting}
                        className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void runSlideExportWithFractions(
                          w.format,
                          w.fractions.map((v) =>
                            Number.isFinite(v) ? Math.max(0, Math.min(1, Number(v))) : SCENE_EXPORT_TIMELINE_FRACTION
                          )
                        )
                      }
                      disabled={sceneExporting}
                      className="mt-4 w-full py-2.5 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                    >
                      {downloadLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSlideExportWizard(null); }}
                      className="mt-2 w-full py-2 text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

      {/* Upper area: loader when running, editor when complete */}
      {pipelineRunning || templateRelayoutRunning || regenerateScriptRunning ? (
        renderGenerationLoader(
          regenerateScriptRunning ? "regenerate-script"
          : templateRelayoutRunning ? "template-relayout"
          : "pipeline"
        )
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
      <ProjectTabs tabs={tabs} active={activeTab} onChange={handleTabChange} containerDataTour="tabs-container" />

      {/* Tab content */}
      <div>
        {activeTab === "script" && (
          <ScriptPanel
            scenes={project.scenes}
            projectName={project.name}
            projectId={project.id}
            onSceneUpdate={(updatedScene) => {
              setProject((prev) =>
                prev
                  ? {
                      ...prev,
                      scenes: prev.scenes.map((s) =>
                        s.id === updatedScene.id ? updatedScene : s
                      ),
                    }
                  : prev
              );
            }}
            onRegenerateScript={() => setShowRegenerateScriptConfirm(true)}
            isRegenerating={regenerateScriptRunning}
            disabled={!["generated", "done"].includes(project.status)}
          />
        )}

        {activeTab === "scenes" && (
          <div>
            {project.scenes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400">Scenes are being generated, please wait…</p>
              </div>
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
                      <SceneListRow
                        key={scene.id}
                        scene={scene}
                        index={idx}
                        expanded={isExpanded}
                        showAudio={project.voice_gender !== "none"}
                        isDragging={isDragging}
                        isDropTarget={isDropTarget}
                        onToggleExpand={() => setExpandedScene(isExpanded ? null : scene.id)}
                        onEdit={() => setSceneEditModal(scene)}
                        onDelete={() => setSceneToDelete(scene)}
                        onDragHandleStart={(e) => {
                          setDraggedSceneId(scene.id);
                          e.dataTransfer.setData("text/plain", String(scene.id));
                          e.dataTransfer.effectAllowed = "move";
                          const row = (e.currentTarget as HTMLElement).closest("[data-scene-row]");
                          if (row) {
                            const rect = row.getBoundingClientRect();
                            e.dataTransfer.setDragImage(row as Element, e.clientX - rect.left, e.clientY - rect.top);
                          }
                        }}
                        onDragHandleEnd={() => {
                          setDraggedSceneId(null);
                          setDragOverSceneId(null);
                        }}
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
                      >
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
                                    const craftedFrontendFiles =
                                      template.startsWith("crafted_")
                                        ? (craftedTemplates.find((ct) => ct.id === template)?.frontend_files as Record<string, string> | null) || null
                                        : null;
                                    const defaults = resolveDefaultFontSizesForScene({
                                      template,
                                      layoutId,
                                      aspectRatio,
                                      layoutPropSchema: layoutPropSchema ?? undefined,
                                      craftedFrontendFiles,
                                    });
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
                                                <span className="text-xs font-medium text-purple-600 tabular-nums">
                                                  {titleClamped}
                                                  {storedTitle == null && override?.title == null && (
                                                    <span className="ml-1 text-[10px] font-normal text-gray-300">(default)</span>
                                                  )}
                                                </span>
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
                                                <span className="text-xs font-medium text-purple-600 tabular-nums">
                                                  {descClamped}
                                                  {storedDesc == null && override?.desc == null && (
                                                    <span className="ml-1 text-[10px] font-normal text-gray-300">(default)</span>
                                                  )}
                                                </span>
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
                                  const isCustomTpl = (project.template || "").startsWith("custom_");
                                  const ctId = isCustomTpl ? parseInt((project.template || "").replace("custom_", ""), 10) : NaN;
                                  const ctOgImage = isCustomTpl
                                    ? (customTemplatesList.find((ct) => ct.id === ctId)?.og_image || "")
                                    : "";
                                  return (
                                    <div>
                                      <h4 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                                        Images ({sceneSupportsImage ? (sceneImageAssetsMap[idx] || []).length : 0})
                                      </h4>
                                      {sceneSupportsImage ? (
                                        <>
                                        <div className="flex flex-wrap gap-2 items-start">
                                          {isCustomTpl && !(sceneImageAssetsMap[idx] || []).length && ctOgImage && (
                                            <div className="relative group rounded-lg overflow-hidden border border-gray-200/40 flex-shrink-0">
                                              {(() => {
                                                let focusX = 50; let focusY = 50; let zoom = 1;
                                                try {
                                                  if (scene.remotion_code) {
                                                    const p = JSON.parse(scene.remotion_code) as { layoutProps?: { imageFocusX?: unknown; imageFocusY?: unknown; imageZoom?: unknown } };
                                                    if (typeof p.layoutProps?.imageFocusX === "number") focusX = p.layoutProps.imageFocusX;
                                                    if (typeof p.layoutProps?.imageFocusY === "number") focusY = p.layoutProps.imageFocusY;
                                                    if (typeof p.layoutProps?.imageZoom === "number") zoom = Math.max(IMAGE_ADJUST_ZOOM_MIN, p.layoutProps.imageZoom);
                                                  }
                                                } catch { /* ignore */ }
                                                return (
                                                  <img
                                                    src={ctOgImage}
                                                    alt=""
                                                    className="h-24 w-20 object-cover"
                                                    style={{ objectPosition: `${focusX}% ${focusY}%`, transform: `scale(${zoom})`, transformOrigin: "center center" }}
                                                    loading="lazy"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                  />
                                                );
                                              })()}
                                              <button
                                                type="button"
                                                onClick={() => openSceneImageAdjustModal(scene, ctOgImage)}
                                                className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                                                title="Adjust image"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16.5 3.964a2.5 2.5 0 113.536 3.536L7 20.5H3v-4L16.5 3.964z" />
                                                </svg>
                                              </button>
                                            </div>
                                          )}
                                          {(sceneImageAssetsMap[idx] || []).map(({ url, asset }) => (
                                            <div
                                              key={asset.id}
                                              className="relative group rounded-lg overflow-hidden border border-gray-200/40 flex-shrink-0"
                                            >
                                              {(() => {
                                                let focusX = 50;
                                                let focusY = 50;
                                                let zoom = 1;
                                                try {
                                                  if (scene.remotion_code) {
                                                    const parsed = JSON.parse(scene.remotion_code) as {
                                                      layoutProps?: { imageFocusX?: unknown; imageFocusY?: unknown; imageZoom?: unknown };
                                                    };
                                                    if (typeof parsed.layoutProps?.imageFocusX === "number") focusX = clampFocus(parsed.layoutProps.imageFocusX);
                                                    if (typeof parsed.layoutProps?.imageFocusY === "number") focusY = clampFocus(parsed.layoutProps.imageFocusY);
                                                    if (typeof parsed.layoutProps?.imageZoom === "number") zoom = Math.max(IMAGE_ADJUST_ZOOM_MIN, parsed.layoutProps.imageZoom);
                                                  }
                                                } catch {
                                                  /* ignore */
                                                }
                                                return (
                                              <img
                                                src={url}
                                                alt=""
                                                className="h-24 w-20 object-cover"
                                                style={{
                                                  objectPosition: `${focusX}% ${focusY}%`,
                                                  transform: `scale(${zoom})`,
                                                  transformOrigin: "center center",
                                                }}
                                                loading="lazy"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = "none";
                                                }}
                                              />
                                                );
                                              })()}
                                              <button
                                                type="button"
                                                onClick={() => openSceneImageAdjustModal(scene, url)}
                                                className="absolute top-1 right-8 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors"
                                                title="Adjust image"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M16.5 3.964a2.5 2.5 0 113.536 3.536L7 20.5H3v-4L16.5 3.964z" />
                                                </svg>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveSceneImage(scene, asset.id)}
                                                disabled={removingAssetId === asset.id}
                                                className="absolute top-1 right-1 z-10 w-6 h-6 flex items-center justify-center rounded-full border border-white/90 bg-white/95 text-purple-700 shadow-sm hover:bg-purple-600 hover:text-white hover:border-purple-600 disabled:opacity-50 transition-colors"
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
                                            className="group relative flex items-center justify-center w-20 h-24 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 transition-colors text-purple-700 flex-shrink-0"
                                            title="Generate image with AI"
                                          >
                                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                            </svg>
                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-medium text-white bg-gray-900 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[180px] text-center z-10">
                                              Generate image with AI
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenImageSourceChooser(scene.id)}
                                            disabled={uploadingSceneId === scene.id}
                                            className={`flex items-center justify-center w-20 h-24 border-2 border-dashed rounded-lg flex-shrink-0 transition-colors ${
                                              uploadingSceneId === scene.id && generatedImageSceneId !== scene.id
                                                ? "border-purple-300 bg-purple-50/50 cursor-wait"
                                                : "border-gray-300 bg-gray-50/50 hover:bg-gray-100/50"
                                            }`}
                                          >
                                            {uploadingSceneId === scene.id && generatedImageSceneId !== scene.id ? (
                                              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                              </svg>
                                            )}
                                          </button>
                                        </div>
                                        {(generateImageError && (generateErrorSceneId === scene.id || generatedImageSceneId === scene.id)) && (
                                          <p className="text-xs text-red-600 mt-1.5">{generateImageError}</p>
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
                      </SceneListRow>
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
                    availableImageItems={activeImageAssets.map((asset) => ({
                      asset,
                      url: resolveAssetUrl(asset, project.id),
                    }))}
                    onSaved={loadProject}
                  />
                )}

                <input
                  ref={localSceneImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleLocalSceneFilePicked(file);
                    e.target.value = "";
                    setLocalUploadTargetSceneId(null);
                  }}
                />

                {imageSourceChooserSceneId !== null && ReactDOM.createPortal(
                  <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                      onClick={() => setImageSourceChooserSceneId(null)}
                    />
                    <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-5">
                        <h3 className="text-lg font-semibold text-gray-900">Add scene image</h3>
                        <p className="text-xs text-gray-500 mt-1">Choose where to pick the image from.</p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={handleChooseScrapedImages}
                            className="w-full h-24 p-2 rounded-xl border p-3 rounded-xl border border-gray-300 text-gray-700 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/40 transition-colors text-sm flex flex-col items-center justify-center text-center gap-2"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                            </svg>
                            From existing scraped images
                          </button>
                          <button
                            type="button"
                            onClick={handleChooseLocalUpload}
                            className="w-full h-24 p-2 rounded-xl border p-3 rounded-xl border border-gray-300 text-gray-700 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/40 transition-colors text-sm flex flex-col items-center justify-center text-center gap-2"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 4v12m0 0l-4-4m4 4l4-4" />
                            </svg>
                            File upload
                          </button>
                        </div>
                      </div>
                  </div>,
                  document.body
                )}

                {scrapedImagesPickerSceneId !== null && ReactDOM.createPortal(
                  <div className="fixed inset-0 z-[126] flex items-center justify-center p-4">
                    <div
                      className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                      onClick={() => !assigningExistingImage && setScrapedImagesPickerSceneId(null)}
                    />
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Select scraped image</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Pick one image to assign to this scene.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setScrapedImagesPickerSceneId(null)}
                          disabled={assigningExistingImage}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-50"
                          title="Close"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-5 bg-gray-50 max-h-[60vh] overflow-auto">
                        {scrapedImageOptions.length === 0 ? (
                          <p className="text-sm text-gray-500">No images available.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {scrapedImageOptions.map(({ asset, url }) => {
                              const selected = selectedExistingAssetId === asset.id;
                              return (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => setSelectedExistingAssetId(asset.id)}
                                  className={`relative rounded-xl overflow-hidden border-2 transition-colors ${
                                    selected ? "border-purple-500" : "border-gray-200 hover:border-purple-300"
                                  }`}
                                >
                                  <img src={url} alt="" className="w-full h-24 object-cover" loading="lazy" />
                                  {selected && (
                                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2 bg-white">
                        <button
                          type="button"
                          onClick={() => setScrapedImagesPickerSceneId(null)}
                          disabled={assigningExistingImage}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAssignExistingImageToScene}
                          disabled={!selectedExistingAssetId || assigningExistingImage}
                          className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm disabled:opacity-60"
                        >
                          {assigningExistingImage ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

                {/* Scene image adjust modal (from expanded images section) */}
                {imageAdjustSceneId !== null && imageAdjustSrc && ReactDOM.createPortal(
                  <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 min-h-0">
                    <div
                      className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                      onClick={closeSceneImageAdjustModal}
                    />
                    <div
                      className="relative w-full max-w-3xl max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden min-h-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Adjust image framing</h3>
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                            Drag to pan when zoomed in. Use the slider or scroll wheel to zoom, then save.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeSceneImageAdjustModal}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                          title="Close"
                          disabled={savingImageAdjust}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-gray-50">
                        <div className="p-4 sm:p-5">
                        <div
                          ref={imageAdjustPreviewRef}
                          onMouseDown={handleAdjustMouseDown}
                          onTouchStart={handleAdjustTouchStart}
                          style={{
                            aspectRatio: imageAdjustAspectRatio,
                            maxHeight: "70vh",
                            maxWidth: `min(100%, 42rem, calc(70vh * ${imageAdjustAspectRatio.split(" / ")[0]} / ${imageAdjustAspectRatio.split(" / ")[1]}))`,
                          }}
                          className={`relative mx-auto rounded-xl overflow-hidden border-2 border-gray-200 select-none touch-none ${
                            isAdjustDragging ? "cursor-grabbing" : "cursor-grab"
                          }`}
                        >
                          <img
                            src={imageAdjustSrc}
                            alt="Adjust preview"
                            className="absolute inset-0 w-full h-full"
                            style={{
                              objectFit: imageAdjustZoom < 1 ? "contain" : "cover",
                              objectPosition: imageAdjustZoom < 1 ? "center" : `${imageAdjustFocusX}% ${imageAdjustFocusY}%`,
                              transform: `scale(${imageAdjustZoom})`,
                              transformOrigin: imageAdjustZoom < 1 ? "center center" : `${imageAdjustFocusX}% ${imageAdjustFocusY}%`,
                            }}
                            draggable={false}
                          />
                        </div>
                        <div className="mt-4 flex flex-col gap-2 max-w-2xl mx-auto w-full">
                          <label className="flex items-center gap-3 text-sm text-gray-700">
                            <span className="w-14 shrink-0 tabular-nums">Zoom</span>
                            <input
                              type="range"
                              min={IMAGE_ADJUST_ZOOM_MIN}
                              max={IMAGE_ADJUST_ZOOM_MAX}
                              step={0.05}
                              value={imageAdjustZoom}
                              onChange={(e) =>
                                setImageAdjustZoom(
                                  Math.min(
                                    IMAGE_ADJUST_ZOOM_MAX,
                                    Math.max(IMAGE_ADJUST_ZOOM_MIN, Number(e.target.value))
                                  )
                                )
                              }
                              className="flex-1 min-w-0 h-1 w-full cursor-pointer appearance-none accent-purple-600 [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-200 [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-gray-200 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-purple-600"
                            />
                            <span className="w-12 text-right text-xs text-gray-500 tabular-nums">
                              {imageAdjustZoom.toFixed(2)}×
                            </span>
                          </label>
                        </div>
                        <div className="mt-3 text-xs text-gray-500 text-center tabular-nums">
                          Position: X {Math.round(imageAdjustFocusX)}% · Y {Math.round(imageAdjustFocusY)}% · Zoom{" "}
                          {imageAdjustZoom.toFixed(2)}×
                        </div>
                        </div>
                      </div>
                      <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-4 border-t border-gray-200 flex justify-end gap-2 bg-white">
                        <button
                          type="button"
                          onClick={closeSceneImageAdjustModal}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
                          disabled={savingImageAdjust}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveSceneImageAdjust}
                          className="px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm disabled:opacity-60"
                          disabled={savingImageAdjust}
                        >
                          {savingImageAdjust ? "Saving..." : "Save framing"}
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body
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


                {project && imageGenModalSceneId !== null && (() => {
                  const imageGenScene = project.scenes?.find((s) => s.id === imageGenModalSceneId);
                  if (!imageGenScene) return null;
                  return (
                    <GenerateSceneImageModal
                      open
                      scene={imageGenScene}
                      project={project}
                      isPro={isPro}
                      onClose={() => setImageGenModalSceneId(null)}
                      onUpgrade={() => setShowAiImageUpgradeModal(true)}
                      onImageReady={(imageBase64, refinedPrompt) => {
                        handleSceneImageReady(imageGenModalSceneId, imageBase64, refinedPrompt);
                        setImageGenModalSceneId(null);
                      }}
                    />
                  );
                })()}

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
          {/* 1. Template */}
          <div data-tour="template-picker">
          <ProjectTemplateSettingsCard
            templateId={assignedTemplateId}
            customTemplates={customTemplatesList}
            craftedTemplates={readyCraftedForPicker}
            projectCustomTheme={project?.custom_theme ?? null}
            projectName={project?.name}
            templateMetas={templateMetas}
            previewCompileScope={user?.id != null ? String(user.id) : undefined}
            disabled={submittingTemplateRelayout || templateRelayoutRunning || missingCustomTemplate}
            onChangeTemplate={() => {
              setTemplateChangeDraft(assignedTemplateId);
              setTemplateChangePickerTab(
                assignedTemplateId.startsWith("custom_")
                  ? "custom"
                  : assignedTemplateId.startsWith("crafted_")
                    ? "crafted"
                    : "builtin"
              );
              setShowTemplateChangeModal(true);
            }}
          />
          </div>

          {/* 2. Voiceover — Add (when muted) / Change + Delete (when present) */}
          {(
            <>
              <ProjectVoiceSettingsCard
                projectId={project.id}
                voiceGender={project.voice_gender}
                voiceAccent={project.voice_accent}
                customVoiceId={project.custom_voice_id}
                isPro={isPro}
                onError={(msg) => showError(msg)}
                onUpgrade={() => setShowUpgrade(true)}
                onOperationStarted={(op) => setVoiceOpKickstart(op)}
              />

              {/* 3. Colors + Font family (with voiceover present) */}
          <div>
            <h2 className="text-base font-medium text-gray-900 mb-1">Colors &amp; Font</h2>
            <p className="text-xs text-gray-400 mb-5">Theme colors and font applied across all scenes.</p>
            <div className="glass-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 overflow-visible relative z-30">
              {/* Colors */}
              <div className="flex flex-col gap-5">
                <p className="text-xs font-semibold text-gray-900">Colors</p>
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
                <div className="flex justify-end">
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

              {/* Font family */}
              <div className="flex flex-col gap-4 sm:border-l sm:border-gray-100 sm:pl-6">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Font family</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Leave as Default to use the template’s built-in fonts.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div ref={fontDropdownRef} className="relative w-full max-w-sm">
                    <button
                      type="button"
                      onClick={() => setShowFontDropdown((v) => !v)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300 flex items-center justify-between"
                      data-action="font-selector"
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
                <div className="flex justify-end">
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
          </div>

              {/* 4. Font sizes (with voiceover present) */}
              <div>
                <h2 className="text-base font-medium text-gray-900 mb-1">Global Text Sizes</h2>
                <p className="text-xs text-gray-400 mb-3">Applied to all scenes at once.</p>
                <div className="glass-card p-4 flex flex-col gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 flex items-center justify-between">
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
                    <label className="text-xs text-gray-500 mb-1.5 flex items-center justify-between">
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
                  <div className="flex justify-end">
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
            </>
          )}

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
                    {imageAssets.length} image{imageAssets.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              {imageAssets.length === 0 ? (
                <p className="text-sm text-gray-400 py-8">
                  Images will appear here once scraped.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imageAssets.map((asset) => {
                    const url = resolveAssetUrl(asset, project.id);
                    const isDeleting = deletingImageAssetId === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className="relative group rounded-xl overflow-hidden border border-gray-200/40 hover:border-gray-300 transition-all"
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

                        {/* Info bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2 pt-6">
                          <p className="text-[10px] text-white/80 truncate">
                            {asset.filename}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRequestDeleteBlogImage(asset)}
                          disabled={isDeleting}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all border border-red-200/90 text-red-600 bg-white/90 hover:bg-red-600 hover:text-white hover:border-red-600 opacity-0 group-hover:opacity-100 disabled:opacity-60"
                          title="Delete this image from the project"
                        >
                          {isDeleting ? (
                            <span className="w-2.5 h-2.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                          ) : (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
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
              {displayLogoUrl ? (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={displayLogoUrl}
                        alt="Current logo"
                        className="h-14 w-14 object-contain rounded border border-gray-200"
                      />
                     
                    </div>
                    <button
                      type="button"
                      data-action="upload-logo"
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
