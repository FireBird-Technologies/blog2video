import type { ReactNode } from "react";

/**
 * Shared progress / action callout for the two avatar background jobs
 * (render, matte). Both are minutes-scale server jobs polled from the
 * client, so they share one look: a spinner line while running, and an
 * idle line with an optional action button when something is needed.
 *
 * tone="progress" is the purple render-in-flight look; tone="warning" is
 * the amber "this needs an extra step" look (matte / matte-all).
 */
export default function AvatarJobCallout({
  tone,
  running,
  runningLabel,
  runningDetail,
  idleLabel,
  actionLabel,
  onAction,
  disabled = false,
}: {
  tone: "progress" | "warning";
  running: boolean;
  runningLabel?: ReactNode;
  runningDetail?: ReactNode;
  idleLabel?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  const palette =
    tone === "warning"
      ? {
          bg: "bg-amber-50/60",
          border: "border-amber-100",
          spinner: "border-amber-200 border-t-amber-600",
          btn: "bg-amber-600 hover:bg-amber-700",
        }
      : {
          bg: "bg-purple-50/60",
          border: "border-purple-100",
          spinner: "border-purple-200 border-t-purple-600",
          btn: "bg-purple-600 hover:bg-purple-700",
        };

  return (
    <div className={`rounded-xl ${palette.bg} border ${palette.border} px-4 py-3`}>
      {running ? (
        <div className="flex items-center gap-3">
          <div
            className={`w-4 h-4 border-2 ${palette.spinner} rounded-full animate-spin shrink-0`}
          />
          <p className="text-[11px] text-gray-600">
            {runningLabel}
            {runningDetail && (
              <span className="block text-[10px] text-gray-400 mt-0.5">
                {runningDetail}
              </span>
            )}
          </p>
        </div>
      ) : (
        <>
          {idleLabel && (
            <p className="text-[11px] text-gray-600 leading-relaxed">{idleLabel}</p>
          )}
          {actionLabel && (
            <button
              type="button"
              disabled={disabled}
              onClick={onAction}
              className={`mt-2.5 px-3 py-1.5 ${palette.btn} disabled:bg-gray-200 disabled:text-gray-400 text-white text-[11px] font-semibold rounded-lg transition-all`}
            >
              {actionLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
