import { useEffect, useState } from "react";
import { addScene, type Project } from "../api/client";

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
  /** Called after a scene is successfully added (parent reloads the project). */
  onAdded: () => void;
  /** Surface an API failure (e.g. the 403 credit error) in the global "Oops" modal. */
  onError: (err: unknown) => void;
}

/**
 * Modal to generate and insert a new AI scene. The user describes the scene and
 * picks where it goes; on submit the backend writes narration/visuals/layout (and
 * voiceover when the project has audio enabled) and inserts it at the chosen slot.
 */
export default function AddSceneModal({
  open,
  onClose,
  project,
  creditsRemaining,
  isPro,
  onAdded,
  onError,
}: AddSceneModalProps) {
  const activeCount = project.scenes?.length ?? 0;
  const [prompt, setPrompt] = useState("");
  // 1-indexed position among active scenes; default = append at the end.
  const [position, setPosition] = useState(activeCount + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setPrompt("");
      setPosition(activeCount + 1);
      setError(null);
      setLoading(false);
    }
  }, [open, activeCount]);

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
      await addScene(project.id, trimmed, position);
      onAdded();
      onClose();
    } catch (err: unknown) {
      // Surface API failures (e.g. the 403 credit error) in the global "Oops" modal.
      // Close first so the error modal isn't hidden behind this dialog.
      onClose();
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  // Position options: 1..activeCount+1 ("End" for the last slot).
  const positionOptions = Array.from({ length: activeCount + 1 }, (_, i) => i + 1);

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

        {loading ? (
          // Generating card — keep the modal open and tell the user it's working.
          <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-gray-800">Generating your scene…</p>
              <p className="mt-1 text-xs text-gray-500">
                Writing the narration, {project.voice_gender !== "none" ? "visuals and voiceover" : "and visuals"} —
                this can take up to a minute. Please keep this open.
              </p>
            </div>
          </div>
        ) : (
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

          <div>
            <label htmlFor="add-scene-position" className="block text-xs font-medium text-gray-700 mb-1.5">
              Insert at position
            </label>
            <select
              id="add-scene-position"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-purple-200 bg-purple-50 text-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {positionOptions.map((p) => (
                <option key={p} value={p}>
                  {p === activeCount + 1 ? `End (after scene ${activeCount})` : `Position ${p}`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Everything at or after this position shifts down by one.
            </p>
          </div>

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
        )}

        {!loading && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!prompt.trim() || !canAfford}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add scene
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
