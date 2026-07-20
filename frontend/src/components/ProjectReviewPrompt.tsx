import { useEffect, useMemo, useState } from "react";

const RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Poor",
  2: "Needs work",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

const ACTIVE_STAR_CLASSES = [
  "text-amber-300",
  "text-amber-400",
  "text-yellow-400",
  "text-yellow-500",
  "text-amber-500",
] as const;

interface ProjectReviewPromptProps {
  submitted: boolean;
  submitting: boolean;
  error: string | null;
  variant?: "inline" | "modal";
  onDismiss?: () => void;
  onSubmit: (payload: { rating: 1 | 2 | 3 | 4 | 5; suggestion?: string }) => Promise<void | boolean> | void;
  onStarClick?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  initialRating?: 1 | 2 | 3 | 4 | 5 | null;
}

function StarButton({
  active,
  label,
  starClassName,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  active: boolean;
  label: string;
  starClassName: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="transition-colors duration-150"
      aria-label={label}
      title={label}
    >
      <svg
        className={`h-5 w-5 ${active ? starClassName : "text-gray-300"}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M11.48 3.5a.75.75 0 011.04 0l2.45 4.96 5.48.8a.75.75 0 01.42 1.28l-3.96 3.86.94 5.46a.75.75 0 01-1.09.79L12 18.08l-4.9 2.57a.75.75 0 01-1.09-.79l.94-5.46-3.96-3.86a.75.75 0 01.42-1.28l5.48-.8 2.45-4.96z" />
      </svg>
    </button>
  );
}

export default function ProjectReviewPrompt({
  submitted,
  submitting,
  error,
  variant = "inline",
  onDismiss,
  onSubmit,
  onStarClick,
  initialRating,
}: ProjectReviewPromptProps) {
  const isModal = variant === "modal";
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(initialRating ?? null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (submitted) {
      setLocalError(null);
    }
  }, [submitted]);

  const activeLabel = useMemo(() => {
    const value = (hoveredRating ?? rating ?? null) as 1 | 2 | 3 | 4 | 5 | null;
    return value ? RATING_LABELS[value] : null;
  }, [hoveredRating, rating]);

  const displayError = localError || error;
  const hasSuggestion = suggestion.trim().length > 0;
  const showSubmit = Boolean(rating) || hasSuggestion;

  const handleSubmit = async () => {
    if (!rating) {
      setLocalError("Please select a rating.");
      return;
    }
    setLocalError(null);
    await onSubmit({
      rating,
      suggestion: suggestion.trim() || undefined,
    });
  };

  // Once submitted, hide the prompt entirely (no confirmation pill).
  if (submitted) {
    return null;
  }

  if (isModal) {
    return (
      <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500">
              Review
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-gray-900">Rate this preview</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your feedback helps us improve Blog2Video.
            </p>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close review popup"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => {
                const active = (hoveredRating ?? rating ?? 0) >= value;
                return (
                  <StarButton
                    key={value}
                    active={active}
                    label={`${value} ${RATING_LABELS[value as 1 | 2 | 3 | 4 | 5]}`}
                    starClassName={ACTIVE_STAR_CLASSES[value - 1]}
                    onMouseEnter={() => setHoveredRating(value)}
                    onMouseLeave={() => setHoveredRating(null)}
                    onClick={() => setRating(value as 1 | 2 | 3 | 4 | 5)}
                  />
                );
              })}
            </div>
            <span className="min-w-[96px] text-sm font-medium text-gray-500">
              {activeLabel ?? "Select a rating"}
            </span>
          </div>

          <textarea
            value={suggestion}
            onChange={(event) => setSuggestion(event.target.value)}
            rows={3}
            placeholder="Suggestion (optional)"
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-500/20"
          />

          {displayError ? <p className="text-sm text-red-600">{displayError}</p> : null}

          <div className="flex items-center justify-between gap-3">
            {/* Share B2V disabled
            <a
              href="/survey"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-medium text-purple-700 hover:bg-purple-100 hover:border-purple-400 transition-all relative"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
              Share B2V to get 5 videos free
            </a> */}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              >
                Close
              </button>
            ) : (
              <span />
            )}
            {showSubmit && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(124,58,237,0.28)] transition-all hover:from-violet-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
      <div className="flex w-full items-center justify-between gap-3 text-[11px] text-gray-500">
        <span className="font-medium text-gray-500">Rate this preview</span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((value) => {
            const active = (hoveredRating ?? rating ?? 0) >= value;
            return (
              <StarButton
                key={value}
                active={active}
                label={`${value} ${RATING_LABELS[value as 1 | 2 | 3 | 4 | 5]}`}
                starClassName={ACTIVE_STAR_CLASSES[value - 1]}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(null)}
                onClick={() => {
                  const next = value as 1 | 2 | 3 | 4 | 5;
                  setRating(next);
                  onStarClick?.(next);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
