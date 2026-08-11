import { useState } from "react";
import { submitAvatarReview } from "../api/client";
import type { AvatarReview } from "../api/types";
import TemplateStarRating from "./TemplateStarRating";

interface AvatarReviewCardProps {
  projectId: number;
  /** This user's saved rating from the project payload; null/undefined = unrated. */
  existing?: AvatarReview | null;
  /** Called after a successful save so the parent can refresh the project. */
  onSaved?: () => void | Promise<void>;
}

/**
 * Star rating + message box for the project's avatars, shown in the Avatar tab
 * once at least one avatar exists.
 *
 * Once rated, the form is replaced by a compact read-only summary with an Edit
 * link — the endpoint upserts, so a rating stays correctable. The saved value is
 * seeded from the project payload rather than fetched here: the Avatar tab
 * unmounts on every tab switch, so a fetch-on-mount would re-flash the empty
 * form each time before the saved rating arrived.
 */
export default function AvatarReviewCard({
  projectId,
  existing,
  onSaved,
}: AvatarReviewCardProps) {
  const [saved, setSaved] = useState<AvatarReview | null>(existing ?? null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRate = async (rating: 1 | 2 | 3 | 4 | 5, comment?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitAvatarReview(projectId, {
        rating,
        suggestion: comment,
      });
      setSaved(res.data);
      setEditing(false);
      onSaved?.();
    } catch {
      setError("Couldn't save your rating. Please try again.");
      // Rethrow so TemplateStarRating skips its "Saved" flash.
      throw new Error("submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = !saved || editing;

  return (
    <div className="rounded-xl bg-gray-50/60 border border-gray-100 px-4 py-3">
      {showForm ? (
        <>
          <p className="text-xs font-semibold text-gray-700">
            How are the avatars?
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 mb-2">
            Your rating helps us improve avatar quality. This feature is in beta.
          </p>
          <TemplateStarRating
            value={saved?.rating}
            comment={saved?.suggestion}
            onRate={handleRate}
            disabled={submitting}
            allowComment
            ariaLabel="Rate the avatar"
          />
        </>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Your avatar rating
            </p>
            <TemplateStarRating
              value={saved.rating}
              onRate={handleRate}
              disabled
              ariaLabel="Your avatar rating"
            />
            {saved.suggestion && (
              <p className="text-[11px] text-gray-600 mt-1.5 break-words">
                “{saved.suggestion}”
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600 shrink-0"
          >
            Edit
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
    </div>
  );
}
