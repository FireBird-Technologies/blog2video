import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ConfirmRender, PublishProgress } from "./PublishToSocialModal";
import NewsletterSnippetPanel from "./NewsletterSnippetPanel";
import { MAINTENANCE_MESSAGE, isMaintenanceError, useErrorModal } from "../contexts/ErrorModalContext";
import {
  isPublishJobActive,
  publishProject,
  retryPublishJob,
  type PublishJob,
  type SourceDelivery,
  type SourceTargetMode,
} from "../api/integrations";
import {
  INTEGRATION_LABELS,
  INTEGRATION_LOGOS,
  getPublishCheck,
  listSourcePosts,
  sourceErrorCode,
  sourceErrorMessage,
  supportsPublishCheck,
  type ContentSourceConnection,
  type IntegrationPlatform,
  type PublishCheck,
  type SourceFallback,
  type SourcePost,
} from "../api/sources";

interface Props {
  open: boolean;
  platform: IntegrationPlatform;
  projectId: number;
  projectName: string;
  /** Set when the project was imported from this platform: the default target post. */
  sourcePostId?: string | null;
  hasRenderedVideo: boolean;
  connection: ContentSourceConnection | null;
  /** Latest job for this platform, polled by the parent. */
  job?: PublishJob | null;
  /** Live render percentage while a render-first publish is rendering. */
  renderProgress?: number | null;
  onClose: () => void;
  onJobChanged?: () => void;
  onRenderStarted?: (renderRunId: string | null) => void;
  /** Start a plain render (no publish job). Ghost uses it so the user can pick
   *  video vs. embed once the video exists and its size is known. */
  onRenderOnly?: () => void;
}

type Destination = "new_draft" | "existing";
type Step = "form" | "confirm-render" | "rendering" | "progress" | "snippet";

const MIB = 1024 * 1024;

/**
 * Bytes per "MB" for this plan's cap: MiB for Ghost's free trial (5242880), or
 * decimal if a plan's cap is only round that way — so it reads as the plan's
 * own "100 MB", and the video's size is shown in the same unit. Display only.
 */
const mbUnit = (limitBytes: number | null | undefined) =>
  limitBytes && limitBytes % MIB !== 0 && limitBytes % 1_000_000 === 0 ? 1_000_000 : MIB;

const formatMb = (bytes: number, unit: number, digits = 0) => `${(bytes / unit).toFixed(digits)} MB`;

/** Posts shown at once in the "Add to an existing post" list. */
const POSTS_PER_VIEW = 4;

/** How long the success view stays before the modal closes itself (Close works sooner). */
const SUCCESS_AUTO_CLOSE_MS = 3000;

/** What each fallback is called in copy and on the Oops modal's button. */
const FALLBACK_COPY: Record<SourceFallback, { phrase: string; action: string }> = {
  embed: { phrase: "the embedded player", action: "Use embed" },
  link: { phrase: "a click-to-watch thumbnail", action: "Use thumbnail" },
};

/** Ghost caps uploads by plan; WordPress by the site's server. */
const tooLargeMessage = (platform: IntegrationPlatform, check: PublishCheck) => {
  if (platform === "ghost" && check.limit_bytes && check.video_bytes) {
    const unit = mbUnit(check.limit_bytes);
    return `Your video is ${formatMb(check.video_bytes, unit, 1)}, larger than your Ghost plan's ${formatMb(check.limit_bytes, unit)} limit. Use embedding instead.`;
  }
  const what = platform === "ghost" ? "Ghost plan" : "WordPress site";
  const instead = `Use ${FALLBACK_COPY[check.fallback].phrase} instead?`;
  return check.limit_bytes && check.video_bytes
    ? `Your ${what} allows uploads up to ${formatMb(check.limit_bytes, mbUnit(check.limit_bytes))}, and this video is ${formatMb(check.video_bytes, mbUnit(check.limit_bytes), 1)}. ${instead}`
    : `This video is too large for your ${what}. ${instead}`;
};

/** Failures that mean "the video can't go in as a file", which the fallback fixes. */
const FALLBACK_ERROR_CODES = new Set(["video_too_large", "video_not_supported", "storage_full"]);

// Beehiiv below Max/Enterprise: the API refuses to create or edit posts.
// API errors that mean the stored credential or publication no longer works.
const RECONNECT_ERROR_CODES = new Set([
  "invalid_key",
  "reauth_required",
  "not_connected",
  "insufficient_scope",
  "publication_not_found",
]);

const PLAN_REQUIRED_COPY = "Adding videos to Beehiiv posts requires a Beehiiv Max or Enterprise plan.";

/** Header naming what is happening now, same wording as the YouTube/LinkedIn modal. */
function progressTitle(job: PublishJob | null, label: string): string {
  switch (job?.status) {
    case "pending_render":
      return "Rendering your video";
    case "queued":
      return `Waiting to add to ${label}`;
    case "running":
      return `Adding to ${label}`;
    case "succeeded":
      return `Added to ${label}`;
    case "failed":
      return "Publishing failed";
    case "cancelled":
      return "Publishing cancelled";
    default:
      return `Publishing to ${label}`;
  }
}

/**
 * Add a video to a content-source platform:
 *  - Ghost: uploads the MP4 as a native video card, or embeds our player when
 *    the site's Ghost plan caps uploads below the video's size — always on the
 *    5 MB free-trial/Starter plans, and after asking on bigger plans.
 *  - WordPress: uploads the MP4 as a video block when the site and role allow
 *    it; otherwise our player in an HTML block (needs embed rights), else a
 *    click-to-watch thumbnail. Over a known upload cap it asks first.
 *  - Beehiiv: a click-to-watch image block — Max/Enterprise plans only, with
 *    the copy-paste newsletter block as the fallback.
 *
 * Same flow as the YouTube/LinkedIn modal: not connected → a link to that tab of
 * the Integrations page; an unrendered video → "render first?"; a job in flight
 * → the render → upload status view, including when reopened mid-publish.
 */
export default function PublishToSourceModal({
  open,
  platform,
  projectId,
  projectName,
  sourcePostId,
  hasRenderedVideo,
  connection,
  job,
  renderProgress = null,
  onClose,
  onJobChanged,
  onRenderStarted,
  onRenderOnly,
}: Props) {
  const label = INTEGRATION_LABELS[platform];
  const { showError } = useErrorModal();
  const navigate = useNavigate();
  const isBeehiiv = platform === "beehiiv";
  const [destination, setDestination] = useState<Destination>("new_draft");
  const [position, setPosition] = useState<Exclude<SourceTargetMode, "new_draft">>("top");
  const [title, setTitle] = useState(projectName);
  // Existing-post list: loaded a server page (20) at a time, shown POSTS_PER_VIEW
  // at a time behind ‹ › arrows, like the create form's Connect tab.
  const [posts, setPosts] = useState<SourcePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsTotal, setPostsTotal] = useState<number | null>(null);
  const [postsView, setPostsView] = useState(0);
  const [search, setSearch] = useState("");
  const [targetPostId, setTargetPostId] = useState<string | null>(sourcePostId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("form");
  // The job this modal just created, shown until the parent's poll reports it
  // (otherwise the view would briefly show the previous, finished job).
  const [startedJob, setStartedJob] = useState<PublishJob | null>(null);
  // Ghost/WordPress: how the video can go in (plan, role, upload cap vs. this
  // video), fetched each time the modal opens.
  const [uploadCheck, setUploadCheck] = useState<PublishCheck | null>(null);
  const [checkingUpload, setCheckingUpload] = useState(false);
  // Beehiiv: only Max/Enterprise plans may add to posts through the API; checked
  // each time the modal opens. On other plans publishing is off (snippet only).
  const [beehiivPlanRequired, setBeehiivPlanRequired] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(false);

  // Any failed API call: the app's "Oops" modal with the server's own reason
  // (bad key, rate limit, outage…), offering Reconnect when the credential is
  // the problem. A server we can't reach at all gets the maintenance copy.
  const showApiError = (err: unknown, fallback: string) => {
    const code = sourceErrorCode(err);
    if (!code && isMaintenanceError(err)) {
      showError(MAINTENANCE_MESSAGE, { variant: "maintenance" });
      return;
    }
    showError(sourceErrorMessage(err, fallback), {
      variant: "pipeline",
      ...(code && RECONNECT_ERROR_CODES.has(code)
        ? {
            action: {
              label: "Reconnect",
              onClick: () => {
                onClose();
                navigate(`/dashboard?tab=integrations&source=${platform}`);
              },
            },
          }
        : {}),
    });
  };

  const connected = !!connection?.connected && connection.status === "active";
  const needsReconnect = !!connection?.connected && !connected;
  const hasCheck = supportsPublishCheck(platform);
  // The site can't take the file at all (a 5 MB Ghost plan; a WordPress plan or
  // role without uploads): use the embed/thumbnail straight away, without asking.
  const directDelivery: SourceDelivery | null =
    hasCheck && (uploadCheck?.recommended === "embed" || uploadCheck?.recommended === "link")
      ? uploadCheck.recommended
      : null;
  const fallback: SourceFallback = uploadCheck?.fallback ?? (platform === "ghost" ? "embed" : "link");
  // Ghost paid plans (or self-hosted, no visible cap): a rendered video that fits
  // can go in either way, so the user picks. Unrendered, it's rendered first
  // (no publish job) and the choice comes once its size is known.
  const isGhost = platform === "ghost";
  const ghostChoosesAfterRender = isGhost && !directDelivery && !!onRenderOnly;
  const chooseDelivery = isGhost && hasRenderedVideo && uploadCheck?.recommended === "video";
  const [ghostDelivery, setGhostDelivery] = useState<"video" | "embed">("video");

  const activeJob = useMemo(() => {
    const polled = job && job.platform === platform ? job : null;
    if (!startedJob) return polled;
    if (polled && polled.id === startedJob.id) return polled;
    return startedJob;
  }, [job, platform, startedJob]);
  const inFlight = !!activeJob && isPublishJobActive(activeJob);

  // Opening mid-publish lands on the status view; closing resets to the form.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Reopened while a Ghost render-only is still going: back to its progress.
      setStep(
        inFlight
          ? "progress"
          : ghostChoosesAfterRender && !hasRenderedVideo && renderProgress !== null
            ? "rendering"
            : "form"
      );
    }
    if (!open) setStartedJob(null);
    wasOpenRef.current = open;
    // Only on open/close transitions; job changes are followed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !hasCheck || !connected) return;
    let cancelled = false;
    setCheckingUpload(true);
    getPublishCheck(platform as "ghost" | "wordpress", projectId)
      .then(({ data }) => {
        if (!cancelled) setUploadCheck(data);
      })
      .catch(() => {
        // Unknown limit: upload as usual; the publish reports a real cap.
        if (!cancelled) setUploadCheck(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingUpload(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, hasCheck, connected, platform, projectId, hasRenderedVideo]);

  useEffect(() => {
    if (!open || !isBeehiiv || !connected) return;
    let cancelled = false;
    setCheckingPlan(true);
    getPublishCheck("beehiiv", projectId)
      .then(({ data }) => {
        if (!cancelled) setBeehiivPlanRequired(!!data.plan_required);
      })
      .catch((err) => {
        // The button stays on: the publish re-checks and reports it again.
        if (cancelled) return;
        setBeehiivPlanRequired(false);
        showApiError(err, `Unable to check your ${label} plan. Please try again.`);
      })
      .finally(() => {
        if (!cancelled) setCheckingPlan(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isBeehiiv, connected, projectId]);

  // "rendering" step (Ghost render-only): when the video exists and the check has
  // re-run on it, go back to the form — with the choice if it fits, or the
  // too-big Oops if it doesn't. A render that never starts or fails returns too.
  const sawRenderingRef = useRef(false);
  useEffect(() => {
    if (!open || step !== "rendering") {
      sawRenderingRef.current = false;
      return;
    }
    if (renderProgress !== null) sawRenderingRef.current = true;
    if (hasRenderedVideo) {
      if (checkingUpload) return;
      setStep("form");
      if (uploadCheck?.recommended === "ask") offerFallback(tooLargeMessage(platform, uploadCheck));
      return;
    }
    if (renderProgress === null) {
      if (sawRenderingRef.current) {
        setStep("form");
        return;
      }
      // handleRender refused (another job running, template missing): it shows
      // its own error; don't sit on the progress view.
      const t = window.setTimeout(() => setStep("form"), 2500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, hasRenderedVideo, renderProgress, checkingUpload, uploadCheck]);

  // Too big for the plan/site: the app's "Oops" modal, offering the fallback.
  // The ref always holds the latest publish(), which is defined further down.
  const publishRef = useRef<(delivery: SourceDelivery) => Promise<void>>(async () => {});
  const offerFallback = (message: string, kind: SourceFallback = fallback) =>
    showError(message, {
      variant: "warning",
      action: { label: FALLBACK_COPY[kind].action, onClick: () => void publishRef.current(kind) },
    });

  // A publish this modal started whose video the site refused (too big, file
  // type, storage — often only known after a render-first publish rendered it):
  // show the app's "Oops" modal offering the fallback, once per job, back on the form.
  const oopsShownFor = useRef<number | null>(null);
  useEffect(() => {
    if (!open || !hasCheck || !activeJob || activeJob.id !== startedJob?.id) return;
    if (activeJob.status !== "failed" || !FALLBACK_ERROR_CODES.has(activeJob.error_code ?? "")) return;
    if (oopsShownFor.current === activeJob.id) return;
    oopsShownFor.current = activeJob.id;
    setStartedJob(null);
    setStep("form");
    offerFallback(
      activeJob.error_message ||
        `This video can't be uploaded to ${label}. Use ${FALLBACK_COPY[fallback].phrase} instead?`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasCheck, activeJob, startedJob]);

  // Close on success after a beat, like the YouTube/LinkedIn modal: long enough
  // to see the tick and the "Open in Ghost" link; the Close button works sooner.
  useEffect(() => {
    if (!open || step !== "progress" || activeJob?.status !== "succeeded") return;
    const t = window.setTimeout(onClose, SUCCESS_AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, step, activeJob?.status, onClose]);

  // Follow a job that starts while the modal is open (e.g. from another tab).
  useEffect(() => {
    if (open && inFlight && step !== "progress") setStep("progress");
  }, [open, inFlight, step]);

  useEffect(() => {
    if (!open || destination !== "existing" || !connected) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setPostsLoading(true);
      try {
        const { data } = await listSourcePosts(platform, { search: search.trim() });
        if (!cancelled) {
          setPosts(data.posts);
          setPostsPage(data.page);
          setPostsHasMore(data.has_more);
          setPostsTotal(data.total);
          setPostsView(0);
        }
      } catch (err) {
        if (!cancelled) showApiError(err, `Unable to load your ${label} posts. Please try again.`);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    }, search ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, destination, connected, platform, label, search]);

  if (!open) return null;

  const visiblePosts = posts.slice(postsView * POSTS_PER_VIEW, (postsView + 1) * POSTS_PER_VIEW);
  const canPrevPosts = postsView > 0;
  const canNextPosts = (postsView + 1) * POSTS_PER_VIEW < posts.length || postsHasMore;
  const nextPosts = async () => {
    if (!canNextPosts || postsLoading) return;
    if ((postsView + 1) * POSTS_PER_VIEW >= posts.length) {
      // Past what's loaded: fetch the next server page first.
      setPostsLoading(true);
      try {
        const { data } = await listSourcePosts(platform, { page: postsPage + 1, search: search.trim() });
        setPosts((prev) => [...prev, ...data.posts]);
        setPostsPage(data.page);
        setPostsHasMore(data.has_more);
        setPostsTotal(data.total);
        if (data.posts.length === 0) return;
      } catch (err) {
        showApiError(err, `Unable to load your ${label} posts. Please try again.`);
        return;
      } finally {
        setPostsLoading(false);
      }
    }
    setPostsView((v) => v + 1);
  };
  const postsRangeStart = posts.length === 0 ? 0 : postsView * POSTS_PER_VIEW + 1;
  const postsRangeEnd = postsView * POSTS_PER_VIEW + visiblePosts.length;
  const arrowClass =
    "inline-flex items-center justify-center min-w-[32px] px-2 py-1.5 text-purple-600 border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:pointer-events-none";

  const targetPost = posts.find((p) => p.id === targetPostId) ?? null;
  const canSubmit =
    connected &&
    !inFlight &&
    !submitting &&
    !checkingUpload &&
    !checkingPlan &&
    !beehiivPlanRequired &&
    (destination === "new_draft" ? title.trim().length > 0 : !!targetPostId);

  const publish = async (delivery: SourceDelivery = directDelivery ?? "video") => {
    setSubmitting(true);
    try {
      const { data } = await publishProject(projectId, {
        platform,
        title: (destination === "new_draft" ? title : projectName).trim() || "Video",
        target_mode: destination === "new_draft" ? "new_draft" : position,
        ...(destination === "existing" && targetPostId ? { target_post_id: targetPostId } : {}),
        source: "auto",
        ...(hasCheck ? { delivery } : {}),
      });
      if (data.render_started) onRenderStarted?.(data.render_run_id);
      setStartedJob(data.job);
      setStep("progress");
      onJobChanged?.();
    } catch (err) {
      setStep("form");
      if (sourceErrorCode(err) === "plan_required") {
        // The server refused on plan grounds (the check missed it, or the
        // plan changed): lock the form and say so in the app's modal.
        setBeehiivPlanRequired(true);
        showError(sourceErrorMessage(err, PLAN_REQUIRED_COPY), {
          variant: "warning",
          ...(hasRenderedVideo
            ? { action: { label: "Copy block", onClick: () => setStep("snippet") } }
            : {}),
        });
      } else {
        showApiError(err, `Unable to start publishing to ${label}. Please try again.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  publishRef.current = publish;

  // Like YouTube/LinkedIn: an unrendered video asks before starting a render.
  const submit = () => {
    if (!canSubmit) return;
    // The embed player plays the project live, so it never needs a render. The
    // thumbnail is a frame of the rendered video, so it does.
    if (directDelivery === "embed") void publish("embed");
    else if (hasCheck && uploadCheck?.recommended === "ask") offerFallback(tooLargeMessage(platform, uploadCheck));
    else if (!hasRenderedVideo) setStep("confirm-render");
    else if (chooseDelivery) void publish(ghostDelivery);
    else void publish();
  };

  const retry = async () => {
    if (!activeJob) return;
    setSubmitting(true);
    try {
      await retryPublishJob(projectId, activeJob.id);
      onJobChanged?.();
      setStep("progress");
    } catch (err) {
      showApiError(err, `Unable to retry publishing to ${label}. Please try again.`);
      setStep("form");
    } finally {
      setSubmitting(false);
    }
  };

  const integrationsHref = `/dashboard?tab=integrations&source=${platform}`;
  const planBlocked = isBeehiiv && activeJob?.status === "failed" && activeJob.error_code === "plan_required";
  const deliveredAs =
    hasCheck && activeJob?.status === "succeeded" && activeJob.delivery && activeJob.delivery !== "video"
      ? activeJob.delivery
      : null;
  const reconnectCopy =
    platform === "wordpress"
      ? connection?.auth_kind === "wpcom_oauth"
        ? "Your WordPress.com connection stopped working. Reconnect it to add videos to your posts."
        : "Your WordPress application password stopped working. Reconnect it to add videos to your posts."
      : `Your ${label} key stopped working. Reconnect it to add videos to your posts.`;

  const headerTitle =
    step === "progress"
      ? progressTitle(activeJob, label)
      : step === "confirm-render"
        ? "Render before publishing?"
        : step === "rendering"
          ? "Rendering your video"
        : step === "snippet"
          ? "Copy the newsletter block"
          : `Add video to ${label}`;

  const optionClass = (active: boolean) =>
    `flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
      active ? "border-purple-400 bg-purple-50/50" : "border-gray-200 hover:border-gray-300"
    }`;

  const snippetLink = (text: string) =>
    hasRenderedVideo ? (
      <button
        type="button"
        onClick={() => setStep("snippet")}
        className="text-xs font-medium text-purple-600 hover:text-purple-700 underline underline-offset-2"
      >
        {text}
      </button>
    ) : null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} aria-hidden />
      <div
        className="relative bg-white border border-gray-200 shadow-2xl rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-publish-title"
      >
        <div className="flex items-center gap-3 mb-4">
          <img src={INTEGRATION_LOGOS[platform]} alt="" width={32} height={32} className="w-8 h-8 object-contain shrink-0" />
          <div className="min-w-0">
            <h3 id="source-publish-title" className="text-base font-semibold text-gray-900">
              {headerTitle}
            </h3>
            {connected && connection?.account_name && (
              <p className="text-xs text-gray-500 truncate">{connection.account_name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "progress" ? (
          <div className="space-y-4">
            <PublishProgress
              job={activeJob}
              label={label}
              form={{}}
              renderProgress={renderProgress}
              submitting={submitting}
              onRetry={() => void retry()}
              onReconnect={() => setStep("form")}
              onRepublish={() => {
                setStartedJob(null);
                setStep("form");
              }}
              onClose={onClose}
            />
            {planBlocked && (
              <p className="text-xs text-gray-500">
                You can still add it by hand: {snippetLink("copy the newsletter block")}
              </p>
            )}
            {deliveredAs && (
              <p className="text-xs text-gray-500">
                Added as {deliveredAs === "embed" ? "an embedded player" : "a click-to-watch thumbnail"}.
                {platform === "wordpress" && " If the post is open in the editor, reload it before saving."}
              </p>
            )}
          </div>
        ) : step === "confirm-render" ? (
          <ConfirmRender
            label={label}
            isRerender={false}
            submitting={submitting}
            onCancel={() => setStep("form")}
            onProceed={() => {
              if (ghostChoosesAfterRender) {
                // Render only; the upload-vs-embed choice comes when it's done.
                setStep("rendering");
                onRenderOnly?.();
              } else {
                void publish();
              }
            }}
          />
        ) : step === "rendering" ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Your video is rendering. When it's done you can choose how to add it to {label}.
            </p>
            <div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all"
                  style={{ width: `${Math.max(2, renderProgress ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1 tabular-nums">
                {hasRenderedVideo ? "Checking the video size…" : `${renderProgress ?? 0}%`}
              </p>
            </div>
            <p className="text-[11px] text-gray-400">
              You can close this window. The render keeps going.
            </p>
          </div>
        ) : step === "snippet" ? (
          <div className="space-y-4">
            <NewsletterSnippetPanel projectId={projectId} />
            <button
              type="button"
              onClick={() => setStep("form")}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
        ) : !connected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {needsReconnect
                ? reconnectCopy
                : `Connect your ${label} account to add this video to your posts.`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <Link
                to={integrationsHref}
                onClick={onClose}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
              >
                {needsReconnect ? `Reconnect ${label}` : `Connect ${label}`}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className={optionClass(destination === "new_draft")}>
                <input
                  type="radio"
                  name="source-destination"
                  checked={destination === "new_draft"}
                  onChange={() => setDestination("new_draft")}
                  className="mt-0.5 accent-purple-600"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Create a new draft</span>
                  <span className="block text-xs text-gray-500">
                    A draft holding the video. Your live posts aren't touched.
                  </span>
                </span>
              </label>
              <label className={optionClass(destination === "existing")}>
                <input
                  type="radio"
                  name="source-destination"
                  checked={destination === "existing"}
                  onChange={() => setDestination("existing")}
                  className="mt-0.5 accent-purple-600"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">Add to an existing post</span>
                  <span className="block text-xs text-gray-500">
                    {sourcePostId
                      ? "Defaults to the post this video was made from."
                      : "Insert the video into a post you choose."}
                  </span>
                </span>
              </label>
            </div>

            {destination === "new_draft" ? (
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Draft title</span>
                <input
                  type="text"
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </label>
            ) : (
              <div className="space-y-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search posts…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {visiblePosts.map((post) => (
                    <label
                      key={post.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs ${
                        targetPostId === post.id ? "bg-purple-50/60" : "hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="source-target-post"
                        checked={targetPostId === post.id}
                        onChange={() => setTargetPostId(post.id)}
                        className="accent-purple-600"
                      />
                      <span className="truncate flex-1 min-w-0 text-gray-900" title={post.title}>{post.title}</span>
                      {post.id === sourcePostId && (
                        <span className="text-[10px] text-purple-600 shrink-0">Source</span>
                      )}
                      <span className="text-[10px] text-gray-400 capitalize shrink-0">{post.status}</span>
                    </label>
                  ))}
                  {postsLoading && visiblePosts.length === 0 && (
                    <div className="text-xs text-gray-400 py-3 text-center">Loading…</div>
                  )}
                  {!postsLoading && posts.length === 0 && (
                    <div className="text-xs text-gray-400 py-3 text-center">No posts found.</div>
                  )}
                </div>
                {(canPrevPosts || canNextPosts) && (
                  <nav className="flex items-center justify-center gap-2" aria-label="Post pages">
                    <button
                      type="button"
                      onClick={() => setPostsView((v) => Math.max(0, v - 1))}
                      disabled={!canPrevPosts}
                      aria-label="Previous posts"
                      title="Previous posts"
                      className={arrowClass}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="min-w-[64px] text-center text-[11px] text-gray-400 tabular-nums">
                      {postsRangeStart}–{postsRangeEnd}
                      {postsTotal != null ? ` of ${postsTotal}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => void nextPosts()}
                      disabled={!canNextPosts || postsLoading}
                      aria-label="Next posts"
                      title="Next posts"
                      className={arrowClass}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </nav>
                )}
                {targetPostId && !targetPost && targetPostId === sourcePostId && (
                  <p className="text-xs text-gray-500">Using the post this video was made from.</p>
                )}
                {/* Where in the post: two radio options at either end of one bordered box. */}
                <div>
                  <span className="block text-xs font-medium text-gray-700 mb-1">Position</span>
                  <div className="grid grid-cols-2 rounded-lg border border-gray-200 py-2">
                    {(["top", "bottom"] as const).map((p) => (
                      <label key={p} className="flex items-center justify-center gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="source-target-position"
                          checked={position === p}
                          onChange={() => setPosition(p)}
                          className="accent-purple-600"
                        />
                        <span className="text-gray-900">{p === "top" ? "Top of post" : "Bottom of post"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isBeehiiv &&
              (beehiivPlanRequired ? (
                <div role="alert" className="text-xs text-amber-600 leading-relaxed">
                  {PLAN_REQUIRED_COPY}{" "}
                  {hasRenderedVideo
                    ? snippetLink("Copy the newsletter block instead.")
                    : "Render the video to copy the newsletter block instead."}
                </div>
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Beehiiv can't host or play videos, and emails can't play them either, so the video is added as a
                  click-to-watch thumbnail image.
                </p>
              ))}
            {chooseDelivery && (
              <div>
                <span className="block text-xs font-medium text-gray-700 mb-1">How to add it</span>
                <div className="grid grid-cols-2 rounded-lg border border-gray-200 py-2">
                  {(
                    [
                      ["video", "Upload the video", "Hosted by Ghost"],
                      ["embed", "Embedded player", "No upload limit"],
                    ] as const
                  ).map(([value, text, hint]) => (
                    <label key={value} className="flex items-center justify-center gap-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="ghost-delivery"
                        checked={ghostDelivery === value}
                        onChange={() => setGhostDelivery(value)}
                        className="accent-purple-600"
                      />
                      <span className="text-gray-900">
                        {text}
                        <span className="block text-[10px] text-gray-400">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {directDelivery && (
              <p className="text-xs text-amber-600 leading-relaxed">
                {platform === "ghost" ? (
                  <>
                    Your {label} plan allows media uploads up to{" "}
                    {uploadCheck?.limit_bytes ? formatMb(uploadCheck.limit_bytes, mbUnit(uploadCheck.limit_bytes)) : "5 MB"}, so the video will be added
                    as an embedded player instead.
                  </>
                ) : (
                  <>
                    {uploadCheck?.reason ? `${uploadCheck.reason} ` : ""}
                    The video will be added as{" "}
                    {directDelivery === "embed" ? "an embedded player" : "a click-to-watch thumbnail linked to the video"}.
                  </>
                )}
              </p>
            )}
            {inFlight && (
              <p className="text-xs text-gray-500">A {label} publish is already in progress for this video.</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg"
              >
                {submitting
                  ? "Starting…"
                  : checkingUpload || checkingPlan
                    ? "Checking…"
                    : directDelivery === "embed" || (chooseDelivery && ghostDelivery === "embed")
                      ? "Embed"
                      : hasRenderedVideo
                        ? "Add video"
                        : ghostChoosesAfterRender
                          ? "Render"
                          : "Render & add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
