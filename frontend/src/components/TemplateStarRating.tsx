import { useState } from "react";

const RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Poor",
  2: "Needs work",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

// Mirrors the per-star colors used by ProjectReviewPrompt so the look matches.
const ACTIVE_STAR_CLASSES = [
  "text-amber-300",
  "text-amber-400",
  "text-yellow-400",
  "text-yellow-500",
  "text-amber-500",
] as const;

interface TemplateStarRatingProps {
  /** Current saved rating (1-5), or null/undefined when unrated. */
  value?: number | null;
  /** Current saved comment, used to prefill the feedback box. */
  comment?: string | null;
  /**
   * Called when the user rates. Fires immediately on star click (stars are
   * instant), and again on Submit when a comment is attached. May return a
   * promise so the control can show a "saved" confirmation when it resolves.
   */
  onRate: (rating: 1 | 2 | 3 | 4 | 5, comment?: string) => void | Promise<void>;
  /** Disable interaction (e.g. while a submit is in flight). */
  disabled?: boolean;
  /** Star size in px. */
  size?: number;
  /** Show the "Rating" section label above the stars. */
  showLabel?: boolean;
  /** Render the optional-feedback toggle + comment box. */
  allowComment?: boolean;
  className?: string;
}

/**
 * Compact, re-ratable 5-star control for custom templates. Reused on the
 * template card and in the Edit modal. Stars save instantly; an optional
 * "Add feedback" box lets the user attach a comment (mirrors the video review).
 */
export default function TemplateStarRating({
  value,
  comment,
  onRate,
  disabled = false,
  size = 18,
  showLabel = false,
  allowComment = false,
  className = "",
}: TemplateStarRatingProps) {
  const [hover, setHover] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [draft, setDraft] = useState(comment ?? "");
  const [saved, setSaved] = useState(false);
  const current = value ?? 0;
  const shown = hover || current;
  const activeLabel = shown ? RATING_LABELS[shown as 1 | 2 | 3 | 4 | 5] : null;

  // Briefly flash a "saved" confirmation after a successful rate/submit.
  const flashSaved = async (p: void | Promise<void>) => {
    try {
      await p;
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      /* parent handles error + rollback */
    }
  };

  const handleStar = (star: 1 | 2 | 3 | 4 | 5) => {
    if (disabled) return;
    // Stars are instant — persist with whatever comment is already saved/typed.
    flashSaved(onRate(star, (draft.trim() || comment?.trim() || undefined)));
  };

  const handleSubmitComment = () => {
    if (disabled || !current) return;
    flashSaved(onRate(current as 1 | 2 | 3 | 4 | 5, draft.trim() || undefined));
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {showLabel && (
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Rating
        </span>
      )}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
          aria-label="Rate this template"
        >
          {([1, 2, 3, 4, 5] as const).map((star) => {
            const active = star <= shown;
            const label = `${RATING_LABELS[star]} (${star} star${star === 1 ? "" : "s"})`;
            return (
              <button
                key={star}
                type="button"
                disabled={disabled}
                onMouseEnter={() => !disabled && setHover(star)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStar(star);
                }}
                className="transition-colors duration-150 disabled:cursor-not-allowed"
                aria-label={label}
                aria-checked={current === star}
                role="radio"
                title={label}
              >
                <svg
                  className={active ? ACTIVE_STAR_CLASSES[star - 1] : "text-gray-300"}
                  style={{ width: size, height: size }}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M11.48 3.5a.75.75 0 011.04 0l2.45 4.96 5.48.8a.75.75 0 01.42 1.28l-3.96 3.86.94 5.46a.75.75 0 01-1.09.79L12 18.08l-4.9 2.57a.75.75 0 01-1.09-.79l.94-5.46-3.96-3.86a.75.75 0 01.42-1.28l5.48-.8 2.45-4.96z" />
                </svg>
              </button>
            );
          })}
        </div>
        {allowComment && (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setShowComposer((c) => !c);
            }}
            className="text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed"
          >
            {showComposer ? "Hide feedback" : (comment ? "Edit feedback" : "Add feedback")}
          </button>
        )}
        {!allowComment && activeLabel && (
          <span className="text-[11px] text-gray-400">{activeLabel}</span>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {allowComment && showComposer && (
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Optional feedback"
            disabled={disabled}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-500/20"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400">
              {saved
                ? "Feedback submitted"
                : current
                ? ""
                : "Pick a rating to save feedback"}
            </span>
            <button
              type="button"
              disabled={disabled || !current}
              onClick={handleSubmitComment}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:from-violet-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disabled ? "Saving..." : "Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
