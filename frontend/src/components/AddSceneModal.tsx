import { useEffect, useState } from "react";
import { addScene, type Project, type Scene } from "../api/client";

/** Adding a scene costs this many AI-edit credits (mirrors the backend). */
export const ADD_SCENE_CREDIT_COST = 5;

export interface AddSceneModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** AI-edit credits available to spend (the owner's pool on a shared project). */
  creditsRemaining: number;
  /** Whether the paying owner is on an unlimited (Pro/Standard) plan. */
  isPro: boolean;
  /** The scene the new one will be inserted AFTER; null = append at the end. */
  anchorScene?: Scene | null;
  /** Called after the add-scene job is enqueued (parent starts polling). */
  onAdded: (position?: number) => void;
  /** Surface an API failure (e.g. the 403 credit / 409 busy error) in the global "Oops" modal. */
  onError: (err: unknown) => void;
}

/**
 * Modal to generate and insert a new AI scene. The user describes the scene; it's
 * inserted right after `anchorScene` (or appended when none). On submit the backend
 * ENQUEUES a background generation job and this closes immediately — the parent shows
 * a placeholder row and polls for completion.
 */
export default function AddSceneModal({
  open,
  onClose,
  project,
  creditsRemaining,
  isPro,
  anchorScene,
  onAdded,
  onError,
}: AddSceneModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Insert position: right after the anchor row, else append (undefined).
  const insertPosition = anchorScene ? anchorScene.order + 1 : undefined;

  // Reset the form whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setPrompt("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const canAfford = isPro || creditsRemaining >= ADD_SCENE_CREDIT_COST;

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Please describe the scene you want to add.");
      return;
    }
    if (!canAfford) return;
    setLoading(true);
    setError(null);
    try {
      await addScene(project.id, trimmed, insertPosition);
      // Job enqueued — hand the target position to the parent (for the placeholder)
      // and close. Generation continues in the background.
      onAdded(insertPosition);
      onClose();
    } catch (err: unknown) {
      // Surface API failures (403 credits / 409 busy) in the global "Oops" modal.
      // Close first so the error modal isn't hidden behind this dialog.
      onClose();
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-scene-title"
      >
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h3 id="add-scene-title" className="text-lg font-semibold text-gray-900">
            Add a scene
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Describe the scene — it's generated from your prompt and the rest of the video.
          </p>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {error && (
            <p className="w-full text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="add-scene-prompt" className="block text-xs font-medium text-gray-700 mb-1.5">
              What should this scene be about?
            </label>
            <textarea
              id="add-scene-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              autoFocus
              placeholder="e.g. A summary of the key takeaways with an upbeat closing line."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Position is auto-determined from where the user clicked "Add scene". */}
          <p className="text-xs text-gray-500">
            {anchorScene
              ? <>The new scene will be added below scene {anchorScene.order}.</>
              : <>The new scene will be added at the end.</>}
          </p>

          {!isPro && (
            <p className="text-xs text-gray-500">
              Adding a scene costs{" "}
              <span className="font-semibold text-gray-700">{ADD_SCENE_CREDIT_COST} AI edits</span>.
              You have {creditsRemaining > 100 ? "100+" : creditsRemaining} remaining.
            </p>
          )}

          {!canAfford && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="text-xs font-medium text-amber-800">
                Not enough AI edits — adding a scene costs {ADD_SCENE_CREDIT_COST}.
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Buy a video for +20 AI edits, or upgrade to Pro/Standard for unlimited.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading || !prompt.trim() || !canAfford}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding…" : "Add scene"}
          </button>
        </div>
      </div>
    </div>
  );
}
