import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { submitAvatarReview } from "../api/client";
import type { AvatarReview } from "../api/types";

type Rating = 1 | 2 | 3 | 4 | 5;

const RATINGS: Rating[] = [1, 2, 3, 4, 5];
const RATING_LABELS: Record<Rating, string> = {
  1: "Poor",
  2: "Needs work",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

interface AvatarReviewCardProps {
  projectId: number;
  existing?: AvatarReview | null;
  onSaved?: () => void | Promise<void>;
}

function Stars({
  value,
  hover,
  onHover,
  onSelect,
  disabled = false,
  size = 18,
  ariaLabel,
}: {
  value: number;
  hover: number;
  onHover: (value: number) => void;
  onSelect: (value: Rating) => void;
  disabled?: boolean;
  size?: number;
  ariaLabel: string;
}) {
  const shown = hover || value;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => onHover(0)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {RATINGS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onMouseEnter={() => !disabled && onHover(star)}
          onClick={() => onSelect(star)}
          className="rounded-sm transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-default"
          aria-label={`${RATING_LABELS[star]} (${star} star${star === 1 ? "" : "s"})`}
          aria-checked={value === star}
          role="radio"
        >
          <svg
            className={star <= shown ? "text-amber-400" : "text-gray-300"}
            style={{ width: size, height: size }}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M11.48 3.5a.75.75 0 011.04 0l2.45 4.96 5.48.8a.75.75 0 01.42 1.28l-3.96 3.86.94 5.46a.75.75 0 01-1.09.79L12 18.08l-4.9 2.57a.75.75 0 01-1.09-.79l.94-5.46-3.96-3.86a.75.75 0 01.42-1.28l5.48-.8 2.45-4.96z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** A star click opens a review modal; rating and message save together. */
export default function AvatarReviewCard({
  projectId,
  existing,
  onSaved,
}: AvatarReviewCardProps) {
  const [saved, setSaved] = useState<AvatarReview | null>(existing ?? null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [cardHover, setCardHover] = useState(0);
  const [modalHover, setModalHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSaved(existing ?? null), [existing]);

  const activeLabel = useMemo(() => {
    const shown = (modalHover || rating) as Rating | null;
    return shown ? RATING_LABELS[shown] : "Select a rating";
  }, [modalHover, rating]);

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setError(null);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        setModalOpen(false);
        setError(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, submitting]);

  const openModal = (selected?: Rating) => {
    setRating(selected ?? (saved?.rating as Rating | undefined) ?? null);
    setSuggestion(saved?.suggestion ?? "");
    setModalHover(0);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitAvatarReview(projectId, {
        rating,
        suggestion: suggestion.trim() || undefined,
      });
      setSaved(res.data);
      setModalOpen(false);
      onSaved?.();
    } catch {
      setError("Couldn't save your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const savedRating = saved?.rating ?? 0;

  return (
    <>
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700">
              {saved ? "Your avatar rating" : "How are the avatars?"}
            </p>
            {!saved && (
              <p className="mt-0.5 mb-2 text-[11px] text-gray-500">
                Your rating helps us improve avatar quality. This feature is in beta.
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Stars
                value={savedRating}
                hover={cardHover}
                onHover={setCardHover}
                onSelect={openModal}
                ariaLabel="Rate the avatar"
              />
              {saved && (
                <span className="text-[11px] text-gray-500">
                  {RATING_LABELS[saved.rating as Rating]}
                </span>
              )}
            </div>
            {saved?.suggestion && (
              <p className="mt-1.5 break-words text-[11px] text-gray-600">
                “{saved.suggestion}”
              </p>
            )}
          </div>
          {saved && (
            <button
              type="button"
              onClick={() => openModal()}
              className="shrink-0 text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {modalOpen &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={closeModal}
              aria-hidden="true"
            />
            <div
              className="relative w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="avatar-review-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500">
                    Review
                  </p>
                  <h3 id="avatar-review-title" className="mt-3 text-2xl font-semibold text-gray-900">
                    Rate this avatar
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Your feedback helps us improve avatar quality.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Close avatar review popup"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Stars
                    value={rating ?? 0}
                    hover={modalHover}
                    onHover={setModalHover}
                    onSelect={setRating}
                    disabled={submitting}
                    size={20}
                    ariaLabel="Choose an avatar rating"
                  />
                  <span className="min-w-[96px] text-sm font-medium text-gray-500">
                    {activeLabel}
                  </span>
                </div>

                <textarea
                  value={suggestion}
                  onChange={(event) => setSuggestion(event.target.value)}
                  rows={3}
                  placeholder="Suggestion (optional)"
                  disabled={submitting}
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-purple-300 focus:ring-2 focus:ring-purple-500/20 disabled:bg-gray-50"
                />

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!rating || submitting}
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(124,58,237,0.28)] transition-all hover:from-violet-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
