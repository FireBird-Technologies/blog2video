import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  disconnectSocialAccount,
  getSocialConnectUrl,
  getSocialConnections,
  oauthMessageOrigin,
  publishProject,
  retryPublishJob,
  type PublishJob,
  type PublishRequest,
  type SocialConnection,
  type SocialPlatform,
} from "../api/integrations";

interface Props {
  open: boolean;
  platform: SocialPlatform;
  projectId: number;
  projectName: string;
  /** Truthy when a rendered MP4 already exists — drives the source choice. */
  hasRenderedVideo: boolean;
  /** The live job for this platform, polled by the parent. */
  job?: PublishJob | null;
  /** Recent jobs for this project, newest first — used to find past uploads. */
  jobs?: PublishJob[];
  /** Live render percentage (0-100) while a render is running, else null. */
  renderProgress?: number | null;
  onClose: () => void;
  /** Called after a publish that started a render, so the page can poll it. */
  onRenderStarted?: (renderRunId: string | null) => void;
  /** Called whenever a job is created/changed so the parent can refresh. */
  onJobChanged?: () => void;
  zIndexClass?: string;
}

type Step =
  | "loading"
  | "not-connected"
  | "choose-source"
  | "form"
  | "confirm-render"
  | "progress"
  | "error";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  x: "X",
};

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 5000;
const X_TEXT_MAX = 280;
/** Long enough to register the green tick, short enough not to need dismissing. */
const SUCCESS_AUTO_CLOSE_MS = 3000;

/** YouTube rejects these outright with an opaque 400. */
const stripAngleBrackets = (value: string) => value.replace(/[<>]/g, "");

/** Header that names what is actually happening right now. */
function headerTitle(
  step: Step,
  job: PublishJob | null,
  label: string,
  isReupload: boolean
): string {
  // Only let the job name the header while the status view is actually showing.
  // Otherwise a finished job would title the metadata form "Published to
  // YouTube" — describing the past instead of what the user is doing now.
  if (job && step === "progress") {
    switch (job.status) {
      case "pending_render":
        return "Rendering your video";
      case "queued":
        return `Waiting to upload to ${label}`;
      case "running":
        return `Uploading to ${label}`;
      case "succeeded":
        return `Published to ${label}`;
      case "failed":
        return "Publishing failed";
      case "cancelled":
        return "Publishing cancelled";
    }
  }
  if (step === "confirm-render") return "Render before publishing?";
  if (step === "progress") return `Publishing to ${label}`;
  return isReupload ? `Re-upload to ${label}` : `Publish to ${label}`;
}

function errorCopy(job: PublishJob): { message: string; action?: string } {
  switch (job.error_code) {
    case "reauth_required":
      return {
        message:
          job.error_message ||
          "Your account is no longer connected. Reconnect it to publish.",
        action: "reconnect",
      };
    case "quota_exceeded":
      return {
        message:
          "The daily upload limit has been reached. Your video will publish automatically once it resets.",
      };
    case "video_superseded":
      return {
        message:
          "This version of the video is no longer available — it may have been re-rendered. Publish again to upload the current version.",
        action: "republish",
      };
    case "render_did_not_complete":
      return { message: "The render didn't finish, so nothing was published." };
    default:
      return {
        message: job.error_message || "Something went wrong while publishing.",
        action: job.retryable ? "retry" : "republish",
      };
  }
}

export default function PublishToSocialModal({
  open,
  platform,
  projectId,
  projectName,
  hasRenderedVideo,
  job,
  jobs = [],
  renderProgress = null,
  onClose,
  onRenderStarted,
  onJobChanged,
  zIndexClass = "z-[9998]",
}: Props) {
  const label = PLATFORM_LABEL[platform];
  const isYouTube = platform === "youtube";

  const [step, setStep] = useState<Step>("loading");
  const [connection, setConnection] = useState<SocialConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "unlisted" | "private">(
    "public"
  );
  const [madeForKids, setMadeForKids] = useState(false);
  const [source, setSource] = useState<"existing" | "rerender">("existing");
  /**
   * The job this modal just created, held until the parent's poll reports it.
   *
   * Without it there is a gap between "publish accepted" and "poll returns the
   * new row" in which the newest known job is still the previous, succeeded
   * one — so the modal flashed the already-published screen right after
   * starting a re-upload.
   */
  const [startedJob, setStartedJob] = useState<PublishJob | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  const activeJob = useMemo(() => {
    const polled = job && job.platform === platform ? job : null;
    if (!startedJob) return polled;
    // Hand over to the polled row as soon as it reports the job we started
    // (by then it carries live progress); until then the local copy wins.
    if (polled && polled.id === startedJob.id) return polled;
    return startedJob;
  }, [job, platform, startedJob]);

  // Latest values for the open-effect to read without depending on them — see
  // the note on that effect for why depending on them is wrong.
  const activeJobRef = useRef(activeJob);
  const hasRenderedVideoRef = useRef(hasRenderedVideo);
  const lastPublishedRef = useRef<PublishJob | null>(null);
  const isBusyRef = useRef(false);
  useEffect(() => {
    activeJobRef.current = activeJob;
    hasRenderedVideoRef.current = hasRenderedVideo;
  }, [activeJob, hasRenderedVideo]);

  /**
   * The last successful upload of this project to this platform, if any.
   *
   * Its presence turns the whole flow into a RE-upload: YouTube's API cannot
   * replace an existing video's file, so publishing again always creates a new
   * video. The copy says "upload again" rather than "update" so nobody expects
   * the old link to change.
   */
  const lastPublished = useMemo(
    () =>
      jobs.find((j) => j.platform === platform && j.status === "succeeded") ??
      null,
    [jobs, platform]
  );

  /** Whether publishing will trigger a render before it can upload. */
  const willRender = !hasRenderedVideo || source === "rerender";

  /** Anything in flight — the modal switches to a status-only view for these. */
  const isBusy =
    activeJob != null &&
    (activeJob.status === "pending_render" ||
      activeJob.status === "queued" ||
      activeJob.status === "running");

  useEffect(() => {
    lastPublishedRef.current = lastPublished;
    isBusyRef.current = isBusy;
  }, [lastPublished, isBusy]);

  // ─── Load connection state on open ──────────────────────

  const loadConnections = useCallback(async () => {
    const res = await getSocialConnections();
    const found =
      res.data.connections.find((c) => c.platform === platform) || null;
    setConnection(found);
    return found;
  }, [platform]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setFatalError(null);
    setPopupBlockedUrl(null);
    setStep("loading");
    // Prefill from the previous upload when there is one, so a re-upload after
    // an edit does not mean retyping the title and description.
    const previous = lastPublishedRef.current;
    setTitle(
      stripAngleBrackets(previous?.title || projectName || "").slice(0, TITLE_MAX)
    );
    setDescription(previous?.description ?? "");
    setTagsText((previous?.tags ?? []).join(", "));
    setPrivacy("public");
    setMadeForKids(false);
    // "existing" is meaningless without an MP4, and that option renders
    // disabled, so default to rendering first in that case.
    setSource(hasRenderedVideoRef.current ? "existing" : "rerender");
    setSubmitting(false);
    setStartedJob(null);

    (async () => {
      try {
        const found = await loadConnections();
        if (cancelled) return;
        // A YouTube connection with no channel cannot upload at all —
        // videos.insert rejects it — so treat it like a missing scope and send
        // the user back to connect, rather than letting them fill in a form and
        // wait through a render for a failure that was knowable up front.
        const noChannel =
          found?.platform === "youtube" && found.connected && !found.account_name;
        if (!found || !found.connected || !found.scopes_ok || noChannel) {
          setStep("not-connected");
        } else if (activeJobRef.current && isBusyRef.current) {
          // Only a job still in flight opens onto the status view. A finished
          // one opens onto the source choice instead — the menu item that got
          // us here says "Re-upload", so showing the old result first would be
          // an extra click before doing the thing that was asked for.
          setStep("progress");
        } else if (hasRenderedVideoRef.current || lastPublishedRef.current) {
          // Already published, or there is an MP4 to choose from: ask which
          // bytes to send before showing the form.
          setStep("choose-source");
        } else {
          setStep("form");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load social connections:", err);
        setFatalError("Couldn't check your connected accounts. Please try again.");
        setStep("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-runs when the modal is actually (re)opened for a platform.
    // `activeJob` and `hasRenderedVideo` are read through refs on purpose: both
    // change WHILE the modal is open — hasRenderedVideo flips the moment a
    // render lands — and having them here would re-run this effect mid-flight,
    // throwing the user back to the first step and wiping what they typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, platform, projectName, loadConnections]);

  // Follow a job that starts while the modal is open.
  //
  // Gated on isBusy, NOT on "a job exists". A succeeded job stays in the list
  // forever, so keying off its mere existence pinned the modal to the success
  // screen permanently and made re-uploading impossible — the bug this fixes.
  useEffect(() => {
    if (!open) return;
    if (isBusy && step !== "progress" && step !== "not-connected") {
      setStep("progress");
    }
  }, [isBusy, open, step]);

  // Close on success after a beat, so the green tick is seen but the modal does
  // not sit there needing to be dismissed. Skipped when YouTube forced the video
  // private — that carries a Studio link the user has to act on.
  //
  // The timer lives in a ref and is cleared on unmount: the plain setTimeout
  // calls elsewhere in ProjectView leak if the component goes away first.
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open || step !== "progress") return;
    if (activeJob?.status !== "succeeded" || activeJob.forced_private) return;

    autoCloseRef.current = setTimeout(onClose, SUCCESS_AUTO_CLOSE_MS);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    };
  }, [open, step, activeJob?.status, activeJob?.forced_private, onClose]);

  // ─── OAuth popup ────────────────────────────────────────

  const cleanUpPopupWatch = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => cleanUpPopupWatch, [cleanUpPopupWatch]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setPopupBlockedUrl(null);
    try {
      const res = await getSocialConnectUrl(platform);
      const url = res.data.authorize_url;
      const popup = window.open(
        url,
        "b2v-connect",
        "width=600,height=760,menubar=no,toolbar=no"
      );
      if (!popup) {
        // Blocked. Offer the link so the flow is still completable.
        setPopupBlockedUrl(url);
        setConnecting(false);
        return;
      }
      popupRef.current = popup;

      // Also watch for a popup the user simply closes: without this the modal
      // would sit on "Connecting…" forever.
      cleanUpPopupWatch();
      pollRef.current = window.setInterval(async () => {
        if (popupRef.current && popupRef.current.closed) {
          cleanUpPopupWatch();
          popupRef.current = null;
          try {
            const found = await loadConnections();
            if (found?.connected && found.scopes_ok) {
              setStep(hasRenderedVideo ? "choose-source" : "form");
            }
          } catch {
            /* leave the user on the connect step */
          } finally {
            setConnecting(false);
          }
        }
      }, 1000);
    } catch (err) {
      console.error("Failed to start the connection flow:", err);
      setFatalError(
        `Couldn't start connecting to ${label}. It may not be configured on this server.`
      );
      setStep("error");
      setConnecting(false);
    }
  }, [platform, label, hasRenderedVideo, loadConnections, cleanUpPopupWatch]);

  // The popup posts its result from the BACKEND origin; anything else is not ours.
  useEffect(() => {
    if (!open) return;
    const expectedOrigin = oauthMessageOrigin();

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) return;
      const data = event.data as
        | { source?: string; platform?: string; ok?: boolean; error?: string }
        | undefined;
      if (!data || data.source !== "b2v-social-oauth") return;
      if (data.platform !== platform) return;

      cleanUpPopupWatch();
      popupRef.current = null;
      setConnecting(false);

      if (!data.ok) {
        setFatalError(data.error || `Couldn't connect your ${label} account.`);
        setStep("error");
        return;
      }
      try {
        const found = await loadConnections();
        if (found?.connected && found.scopes_ok) {
          setStep(hasRenderedVideo ? "choose-source" : "form");
        } else {
          setStep("not-connected");
        }
      } catch {
        setStep("not-connected");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, platform, label, hasRenderedVideo, loadConnections, cleanUpPopupWatch]);

  // ─── Actions ────────────────────────────────────────────

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectSocialAccount(platform);
      setConnection(null);
      setStep("not-connected");
    } catch (err) {
      console.error("Disconnect failed:", err);
    }
  }, [platform]);

  const handlePublish = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload: PublishRequest = {
        platform,
        title: stripAngleBrackets(title).trim() || projectName || "Untitled video",
        description: stripAngleBrackets(description).trim() || undefined,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source: hasRenderedVideo ? source : "auto",
      };
      if (isYouTube) {
        payload.privacy_status = privacy;
        payload.made_for_kids = madeForKids;
      }

      const res = await publishProject(projectId, payload);
      if (res.data.render_started) {
        onRenderStarted?.(res.data.render_run_id);
      }
      // Show the job the server just created, immediately. onJobChanged only
      // kicks off a refetch, and until that lands the `job` prop still holds
      // the PREVIOUS succeeded upload — which rendered as "your video is on
      // YouTube" the instant a re-upload was started.
      setStartedJob(res.data.job);
      onJobChanged?.();
      setStep("progress");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : (detail as { message?: string })?.message ||
            "Couldn't start publishing. Please try again.";
      setFatalError(message);
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }, [
    platform, title, description, tagsText, privacy, madeForKids, source,
    hasRenderedVideo, isYouTube, projectId, projectName, onRenderStarted, onJobChanged,
  ]);

  const handleRetry = useCallback(async () => {
    if (!activeJob) return;
    setSubmitting(true);
    try {
      await retryPublishJob(projectId, activeJob.id);
      onJobChanged?.();
      setStep("progress");
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [activeJob, projectId, onJobChanged]);

  if (!open) return null;

  // account_name only: account_handle now doubles as the Google email for a
  // connection with no channel, and "Publishing as you@gmail.com" would imply
  // an upload target that does not exist.
  const accountName = connection?.account_name;

  return ReactDOM.createPortal(
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}>
      {/* Always dismissable. The work is server-side and survives this modal —
          and once it has started there is nothing here left to interrupt, so
          trapping the user behind it would be a lie about what closing costs. */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-7 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <PlatformIcon platform={platform} />
          <div className="min-w-0 flex-1">
            <h3
              id="publish-modal-title"
              className="text-lg font-semibold text-gray-900 leading-tight"
            >
              {headerTitle(step, activeJob, label, lastPublished != null)}
            </h3>
            {/* Shown whenever an account is connected — NOT gated on having a
                channel name. A connection whose account has no YouTube channel
                stores no name, and gating on the name hid Disconnect in exactly
                the case where switching accounts is the only way forward.
                While something is in flight this is noise, so it hides then. */}
            {connection?.connected && !isBusy && step !== "not-connected" && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {accountName ? (
                  <>
                    Publishing as <span className="font-medium">{accountName}</span>
                  </>
                ) : (
                  <span className="text-amber-600">
                    No YouTube channel on
                    {connection?.account_handle
                      ? ` ${connection.account_handle}`
                      : " this account"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="ml-2 text-purple-600 hover:text-purple-700 underline underline-offset-2"
                >
                  Disconnect
                </button>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 -mt-1 -mr-1 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "loading" && (
          <p className="text-sm text-gray-600 py-6 text-center">Checking your account…</p>
        )}

        {step === "not-connected" && (
          <NotConnected
            label={label}
            connecting={connecting}
            popupBlockedUrl={popupBlockedUrl}
            needsReconnect={Boolean(connection?.connected)}
            noChannelAccount={
              connection?.connected && !connection.account_name
                ? connection.account_handle || "this account"
                : null
            }
            onDisconnect={handleDisconnect}
            onConnect={handleConnect}
            onClose={onClose}
          />
        )}

        {/* A live job outranks whatever step we were on: once work is underway
            the form is stale, and showing it invites a second publish. */}
        {step === "choose-source" && !isBusy && (
          <ChooseSource
            source={source}
            setSource={setSource}
            lastPublished={lastPublished}
            label={label}
            hasRenderedVideo={hasRenderedVideo}
            onBack={onClose}
            onNext={() => setStep("form")}
          />
        )}

        {step === "form" && !isBusy && (
          <MetadataForm
            isYouTube={isYouTube}
            label={label}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            tagsText={tagsText}
            setTagsText={setTagsText}
            privacy={privacy}
            setPrivacy={setPrivacy}
            madeForKids={madeForKids}
            setMadeForKids={setMadeForKids}
            willRender={willRender}
            isReupload={lastPublished != null}
            submitting={submitting}
            onBack={hasRenderedVideo ? () => setStep("choose-source") : onClose}
            // Rendering costs real time (and, on a re-render, a video from the
            // plan), so it gets an explicit confirmation rather than starting
            // off the same click that submits the metadata.
            onSubmit={() =>
              willRender ? setStep("confirm-render") : void handlePublish()
            }
          />
        )}

        {step === "confirm-render" && !isBusy && (
          <ConfirmRender
            label={label}
            isRerender={hasRenderedVideo && source === "rerender"}
            submitting={submitting}
            onCancel={onClose}
            onProceed={() => void handlePublish()}
          />
        )}

        {(step === "progress" || isBusy) && (
          <Progress
            job={activeJob}
            label={label}
            renderProgress={renderProgress}
            submitting={submitting}
            onRetry={handleRetry}
            onReconnect={() => setStep("not-connected")}
            onRepublish={() =>
              setStep(
                hasRenderedVideo || lastPublished ? "choose-source" : "form"
              )
            }
            onClose={onClose}
          />
        )}

        {step === "error" && (
          <div>
            <p className="text-sm text-gray-700 mb-6">{fatalError}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setStep(hasRenderedVideo ? "choose-source" : "form")}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Steps ────────────────────────────────────────────────

function NotConnected({
  label, connecting, popupBlockedUrl, needsReconnect, noChannelAccount,
  onConnect, onClose, onDisconnect,
}: {
  label: string;
  connecting: boolean;
  popupBlockedUrl: string | null;
  needsReconnect: boolean;
  /** Email of a connected account that has no channel, else null. */
  noChannelAccount: string | null;
  onConnect: () => void;
  onClose: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div>
      <p className={`text-sm text-gray-600 ${noChannelAccount ? "mb-4" : "mb-6"}`}>
        {noChannelAccount ? (
          <>
            <span className="font-medium">{noChannelAccount}</span> doesn't have a{" "}
            {label} channel, so it can't upload videos. Connect a different
            account, or create a channel at{" "}
            <a
              href="https://www.youtube.com/create_channel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700 underline underline-offset-2"
            >
              youtube.com
            </a>{" "}
            and reconnect.
          </>
        ) : needsReconnect ? (
          `Your ${label} connection is missing permission to upload. Reconnect and allow uploads to continue.`
        ) : (
          `Connect your ${label} account to publish videos straight from here.`
        )}
      </p>
      {noChannelAccount && (
        <p className="text-xs text-gray-500 mb-6">
          Already connected as {noChannelAccount}.{" "}
          <button
            type="button"
            onClick={onDisconnect}
            className="text-purple-600 hover:text-purple-700 underline underline-offset-2"
          >
            Disconnect
          </button>{" "}
          to pick another account.
        </p>
      )}
      {popupBlockedUrl && (
        <p className="text-xs text-amber-600 mb-4">
          Your browser blocked the popup.{" "}
          <a
            href={popupBlockedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Open the {label} connection page
          </a>{" "}
          instead.
        </p>
      )}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={connecting}
          onClick={onConnect}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {connecting ? "Connecting…" : `${needsReconnect ? "Reconnect" : "Connect"} ${label}`}
        </button>
      </div>
    </div>
  );
}

function ChooseSource({
  source, setSource, lastPublished, label, hasRenderedVideo, onBack, onNext,
}: {
  source: "existing" | "rerender";
  setSource: (s: "existing" | "rerender") => void;
  lastPublished: PublishJob | null;
  label: string;
  hasRenderedVideo: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const isReupload = lastPublished != null;
  return (
    <div>
      <p className="text-sm text-gray-600 mb-1">
        {isReupload
          ? `This video is already on ${label}. What would you like to upload?`
          : "You've already rendered this video. What would you like to publish?"}
      </p>
      {isReupload && (
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          {lastPublished.post_url && (
            <>
              <a
                href={lastPublished.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-700 underline underline-offset-2"
              >
                View the current version
              </a>
              {" · "}
            </>
          )}
          {/* Setting expectations: the Data API cannot swap an existing
              video's file, so this genuinely publishes a second video. */}
          Uploading again creates a new video on {label} — it won't replace the
          existing one.
        </p>
      )}
      <div className={`space-y-2 mb-6${isReupload ? "" : " mt-3"}`}>
        <SourceOption
          selected={source === "existing"}
          onSelect={() => setSource("existing")}
          disabled={!hasRenderedVideo}
          title={isReupload ? "Re-upload the existing video" : "Publish the rendered video"}
          subtitle={
            hasRenderedVideo
              ? "Uploads the MP4 you already have. Fastest."
              : "Not available — this video hasn't been rendered yet."
          }
        />
        <SourceOption
          selected={source === "rerender"}
          onSelect={() => setSource("rerender")}
          title={
            hasRenderedVideo
              ? "Re-render with my latest changes, then upload"
              : "Render, then upload"
          }
          subtitle={
            hasRenderedVideo
              ? "Picks up edits made since the last render. Uses one video from your plan."
              : "Renders the video first, then uploads it automatically."
          }
        />
      </div>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SourceOption({
  selected, onSelect, title, subtitle, disabled = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
        disabled
          ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
          : selected
            ? "border-purple-400 bg-purple-50"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="flex items-start gap-3">
        <span
          className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
            selected ? "border-purple-600" : "border-gray-300"
          }`}
        >
          {selected && <span className="w-2 h-2 rounded-full bg-purple-600" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900">{title}</span>
          <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>
        </span>
      </span>
    </button>
  );
}

function MetadataForm({
  isYouTube, label, title, setTitle, description, setDescription,
  tagsText, setTagsText, privacy, setPrivacy, madeForKids, setMadeForKids,
  willRender, isReupload, submitting, onBack, onSubmit,
}: {
  isYouTube: boolean;
  label: string;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  tagsText: string;
  setTagsText: (v: string) => void;
  privacy: "public" | "unlisted" | "private";
  setPrivacy: (v: "public" | "unlisted" | "private") => void;
  madeForKids: boolean;
  setMadeForKids: (v: boolean) => void;
  willRender: boolean;
  isReupload: boolean;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const textMax = isYouTube ? TITLE_MAX : X_TEXT_MAX;

  return (
    <div>
      <label className="block mb-4">
        <span className="block text-xs font-medium text-gray-700 mb-1.5">
          {isYouTube ? "Title" : "Post text"}
        </span>
        <input
          type="text"
          value={title}
          maxLength={textMax}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
          placeholder={isYouTube ? "My video" : "What's this video about?"}
        />
        <span className="block text-[10px] text-gray-400 mt-1 text-right">
          {title.length}/{textMax}
        </span>
      </label>

      {isYouTube && (
        <>
          <label className="block mb-4">
            <span className="block text-xs font-medium text-gray-700 mb-1.5">
              Description
            </span>
            <textarea
              value={description}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 resize-y"
              placeholder="Tell viewers about your video"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-xs font-medium text-gray-700 mb-1.5">
              Tags <span className="text-gray-400 font-normal">(comma separated)</span>
            </span>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              placeholder="marketing, explainer"
            />
          </label>

          <div className="mb-4">
            <span className="block text-xs font-medium text-gray-700 mb-1.5">
              Visibility
            </span>
            <div className="flex gap-2">
              {(["public", "unlisted", "private"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPrivacy(value)}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border capitalize transition-colors ${
                    privacy === value
                      ? "border-purple-400 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-amber-600 mt-2 leading-relaxed">
              YouTube may force new uploads to Private until our app finishes
              their API review. If that happens we'll show you a link to switch
              it in YouTube Studio.
            </p>
          </div>

          {/* accent-purple-600 is what actually colours the tick: this project
              has no @tailwindcss/forms, so `text-purple-600` alone leaves the
              browser default blue. Matches the checkboxes in BlogUrlForm. */}
          <label className="flex items-start gap-2 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={madeForKids}
              onChange={(e) => setMadeForKids(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-purple-600 cursor-pointer focus:ring-purple-500/30"
            />
            <span className="text-xs text-gray-600">
              This video is made for kids
            </span>
          </label>
        </>
      )}

      <div className="flex gap-3 justify-end mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !title.trim()}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting
            ? "Initiating…"
            : willRender
              ? `Render & ${isReupload ? "re-upload" : "publish"} to ${label}`
              : isReupload
                ? `Re-upload to ${label}`
                : `Publish to ${label}`}
        </button>
      </div>

    </div>
  );
}

function ConfirmRender({
  label, isRerender, submitting, onCancel, onProceed,
}: {
  label: string;
  isRerender: boolean;
  submitting: boolean;
  onCancel: () => void;
  onProceed: () => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-700 mb-2 leading-relaxed">
        {isRerender
          ? `This video will be re-rendered with your latest changes before it goes to ${label}. Do you want to render it first and then upload?`
          : `This video isn't rendered yet. Do you want to render it first and then upload it to ${label}?`}
      </p>
      <p
        className={`text-xs text-gray-500 leading-relaxed ${
          isRerender ? "mb-3" : "mb-6"
        }`}
      >
        Rendering can take a few minutes. The upload starts automatically as soon
        as it finishes — you can close this window and come back.
      </p>
      {/* Its own line, in amber: this is the only step here that spends
          something, so it should not be the tail of a grey paragraph. */}
      {isRerender && (
        <p className="text-xs text-amber-600 mb-6 leading-relaxed">
          Re-rendering counts as another video and will use one more from your
          plan's video allowance.
        </p>
      )}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
        >
          Cancel upload
        </button>
        <button
          type="button"
          onClick={onProceed}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? "Initiating…" : "Proceed with rendering first"}
        </button>
      </div>
    </div>
  );
}

function Progress({
  job, label, renderProgress, submitting, onRetry, onReconnect, onRepublish, onClose,
}: {
  job: PublishJob | null;
  label: string;
  renderProgress: number | null;
  submitting: boolean;
  onRetry: () => void;
  onReconnect: () => void;
  onRepublish: () => void;
  onClose: () => void;
}) {
  if (!job) {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-6">Getting things started…</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (job.status === "succeeded") {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-700">Your video is on {label}.</p>
        </div>
        {job.forced_private && (
          <p className="text-xs text-amber-600 mb-4 leading-relaxed">
            {label} published it as <strong>Private</strong> because our app is
            still under API review.{" "}
            {job.post_id && (
              <a
                href={`https://studio.youtube.com/video/${job.post_id}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Change the visibility in YouTube Studio
              </a>
            )}
          </p>
        )}
        {/* No "upload again" here: the Share menu already reads "Re-upload to
            YouTube" once a video is published, so this would be a second route
            to the same flow on a screen that is about the result. */}
        <div className="flex gap-3 justify-end items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
          {job.post_url && (
            <a
              href={job.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              View on {label}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (job.status === "failed" || job.status === "cancelled") {
    const { message, action } = errorCopy(job);
    return (
      <div>
        <p className="text-sm text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
          {action === "reconnect" && (
            <button
              type="button"
              onClick={onReconnect}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Reconnect
            </button>
          )}
          {action === "retry" && (
            <button
              type="button"
              disabled={submitting}
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? "Retrying…" : "Try again"}
            </button>
          )}
          {action === "republish" && (
            <button
              type="button"
              onClick={onRepublish}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Publish again
            </button>
          )}
        </div>
      </div>
    );
  }

  // The render step only exists when this job actually renders something.
  // Publishing an MP4 that already exists goes straight to uploading, and
  // showing a ticked "Rendering" step for a render that never ran would claim
  // work that did not happen.
  const willRender = job.source === "rerender";
  const rendering = job.status === "pending_render";
  const pct = job.status === "running" ? Math.round((job.progress || 0) * 100) : 0;

  return (
    <div>
      {/* Centred as one unit. When a render is involved, each label hangs off
          the inner edge of its own dot and the connector fills green as the
          render completes, so the handoff reads as one sequence. A plain upload
          has no first step, so it shows a single centred node instead. */}
      <div className="flex items-start justify-center gap-2 mb-5">
        {willRender && (
          <>
            <Stage
              state={rendering ? "active" : "done"}
              title={
                rendering && renderProgress != null && renderProgress > 0
                  ? `Rendering — ${Math.round(renderProgress)}%`
                  : "Rendering"
              }
              alignEnd
            />
            {/* Capped rather than flex-1: a connector stretched across the whole
                modal reads as two unrelated indicators instead of one sequence. */}
            <div className="w-12 sm:w-16 flex-shrink-0 h-0.5 mt-3.5 rounded-full overflow-hidden bg-gray-200">
              <div
                className={`h-full bg-green-500 transition-all duration-700 ${
                  rendering ? "w-0" : "w-full"
                }`}
              />
            </div>
          </>
        )}
        <Stage
          state={rendering ? "waiting" : "active"}
          title={
            job.status === "running" ? `Uploading — ${pct}%` : "Uploading"
          }
          detail={job.status === "queued" ? "Waiting for a slot" : undefined}
          // Alone in the row, so centre it under its own dot rather than
          // hanging it off an edge that no longer has a connector beside it.
          center={!willRender}
        />
      </div>

      {job.status === "running" && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <p className="text-xs text-gray-500 mb-6 leading-relaxed">
        This keeps running on our servers —{" "}
        <span className="font-medium text-gray-700">
          you can close this window or the whole tab
        </span>
        . We'll keep the status here when you come back.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/**
 * One node of the render -> upload stepper: icon above its label.
 *
 * ``alignEnd`` puts the dot and its text against the node's right edge, for the
 * step that sits to the LEFT of the connector — so both labels hang off the
 * inner edge of their own dot and point at the line between them.
 */
function Stage({
  state, title, detail, alignEnd = false, center = false,
}: {
  state: "done" | "active" | "waiting";
  title: string;
  detail?: string;
  alignEnd?: boolean;
  /** Centre the node under its dot — for when it is the only step shown. */
  center?: boolean;
}) {
  const alignment = center
    ? "items-center text-center"
    : alignEnd
      ? "items-end text-right"
      : "items-start text-left";
  return (
    <div className={`flex flex-col gap-1 flex-shrink-0 max-w-[45%] ${alignment}`}>
      <span className="w-7 h-7 rounded-full flex items-center justify-center bg-white">
        {state === "done" && (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {state === "active" && (
          <svg className="w-5 h-5 text-purple-600 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {state === "waiting" && (
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
        )}
      </span>
      <span
        className={`text-xs leading-tight ${
          state === "waiting"
            ? "text-gray-400"
            : state === "active"
              ? "text-gray-900 font-medium"
              : "text-gray-600"
        }`}
      >
        {title}
      </span>
      {detail && (
        <span className="text-[10px] text-gray-400 leading-tight">{detail}</span>
      )}
    </div>
  );
}

function PlatformIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "youtube") {
    return (
      <svg
        className="w-7 h-7 text-[#FF0000] flex-shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  return (
    <svg
      className="w-6 h-6 text-black flex-shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
