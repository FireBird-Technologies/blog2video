import { useEffect, useRef, useState } from "react";
import type { PublishJob } from "../api/integrations";

interface Props {
  job: PublishJob;
  onRetry: () => void;
  /** Called once a succeeded banner has been shown long enough to register. */
  onDismiss: () => void;
}

/** Matches the modal's auto-close, so the two disappear together. */
const SUCCESS_VISIBLE_MS = 3000;
/**
 * Longer than a success: an error is a sentence to read, not a tick to glance
 * at. The failure is not lost when this hides — the job stays in publish-status
 * and the user also gets an email.
 */
const FAILURE_VISIBLE_MS = 10000;

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  x: "X",
};

/**
 * Inline upload status, shown under the video preview.
 *
 * Exists because the upload is a server-side job: the modal is not where it
 * lives, and closing the modal (or reloading the page) must not make an
 * in-flight upload invisible.
 *
 * Renders nothing for `pending_render` — that phase already has the render's
 * own progress UI on this page, and a second progress bar for the same action
 * would just compete with it.
 */
export default function PublishStatusBanner({ job, onRetry, onDismiss }: Props) {
  const label = PLATFORM_LABEL[job.platform] ?? job.platform;
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pointer over the banner holds it open, so it cannot vanish from under
  // someone reaching for "Try again".
  const [hovered, setHovered] = useState(false);

  // Hold a terminal state briefly, then hand dismissal back to the parent — it
  // owns the "already shown" set, since a finished job keeps its status forever
  // and would otherwise reappear on the next poll.
  //
  // Failures linger longer than successes: the message explains what went wrong
  // and what to do about it, which takes longer to read than a green tick.
  useEffect(() => {
    const visibleMs =
      job.status === "succeeded"
        ? SUCCESS_VISIBLE_MS
        : job.status === "failed"
          ? FAILURE_VISIBLE_MS
          : null;
    if (visibleMs === null || hovered) return;

    dismissRef.current = setTimeout(onDismiss, visibleMs);
    return () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = null;
    };
  }, [job.status, job.id, onDismiss, hovered]);

  if (job.status === "pending_render") return null;

  if (job.status === "succeeded") {
    return (
      <div role="status" className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[11px] text-green-700">
              Published to {label}
            </span>
            {job.post_url && (
              <a
                href={job.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-green-700 underline underline-offset-2 hover:text-green-900 flex-shrink-0"
              >
                View
              </a>
            )}
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-full bg-green-500" />
          </div>
        </div>
        <svg className="w-4 h-4 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div
        role="status"
        className="flex items-center gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            {/* Wraps rather than truncating: these messages explain what went
                wrong and what to do about it, and a clipped one is useless. */}
            <span className="text-[11px] text-red-600 leading-relaxed">
              {job.error_message || `Couldn't publish to ${label}.`}
            </span>
            <span className="flex items-baseline gap-2 flex-shrink-0">
              {job.retryable && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-[11px] font-medium text-red-600 underline underline-offset-2 hover:text-red-800"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="text-[11px] text-gray-400 hover:text-gray-600"
              >
                Dismiss
              </button>
            </span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full w-full bg-red-400" />
          </div>
        </div>
        <svg className="w-4 h-4 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  }

  // queued | running
  const pct = job.status === "running" ? Math.round((job.progress || 0) * 100) : 0;
  return (
    <div role="status" className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-[11px] text-gray-500">
            {job.status === "queued"
              ? `Waiting to upload to ${label}…`
              : `Uploading to ${label}`}
          </span>
          {job.status === "running" && (
            <span className="text-[11px] tabular-nums text-gray-400 flex-shrink-0">
              {pct}%
            </span>
          )}
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full bg-purple-500 ${
              job.status === "running"
                ? "transition-all duration-500"
                : "w-1/4 animate-pulse"
            }`}
            style={job.status === "running" ? { width: `${pct}%` } : undefined}
          />
        </div>
      </div>
      {/* Keeps the bar the same width as the succeeded state, so the layout
          doesn't shift when the tick appears at the end. */}
      <span className="w-4 flex-shrink-0" aria-hidden />
    </div>
  );
}
