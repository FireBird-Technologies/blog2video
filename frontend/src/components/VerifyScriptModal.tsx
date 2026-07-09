import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Scene } from "../api/client";
import { RegenerateScriptPreviewScene } from "../api/types";

interface Props {
  open: boolean;
  projectName?: string | null;
  /** Newly regenerated scenes (live project.scenes). */
  newScenes: Scene[];
  /** Previous scenes from the job snapshot. `null` = still loading; `[]` = none (treat all as new). */
  previousScenes: RegenerateScriptPreviewScene[] | null;
  /** True while the Proceed request is in flight. */
  verifying?: boolean;
  /**
   * Whether the current user may act on the review (Proceed / Regenerate). Only the
   * collaborator who initiated the regen can; others see a read-only comparison and a
   * "waiting for the reviewer" note. Defaults to true.
   */
  canReview?: boolean;
  onProceed: () => void;
  onRegenerate: () => void;
}

// Minimal shape shared by new (Scene) and old (RegenerateScriptPreviewScene) scenes.
interface SceneLike {
  title: string;
  display_text?: string | null;
  narration_text: string;
  visual_description: string;
  remotion_code?: string | null;
  preferred_layout?: string | null;
}

function resolveLayout(scene: SceneLike): string | null {
  if (scene.remotion_code) {
    try {
      const parsed = JSON.parse(scene.remotion_code);
      const assigned = parsed.layout ?? parsed.layoutConfig?.arrangement ?? null;
      if (assigned) return assigned;
    } catch {
      /* ignore */
    }
  }
  return scene.preferred_layout ?? null;
}

/**
 * Non-closeable popup that walks the user through the regenerated script one scene at a time,
 * comparing the previous scene (left/top) against the new scene (right/bottom). Extra scenes
 * beyond the previous count are tagged "New scene" with no comparison. The user can step through
 * with Next, skip to the last scene, Regenerate, or Proceed (only on the last scene).
 */
export default function VerifyScriptModal({
  open,
  projectName,
  newScenes,
  previousScenes,
  verifying,
  canReview = true,
  onProceed,
  onRegenerate,
}: Props) {
  const [index, setIndex] = useState(0);

  // Reset to the first scene each time the popup (re)opens — e.g. after a Regenerate re-run.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open) return null;

  const total = newScenes.length;
  const loading = previousScenes === null;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const newScene = newScenes[safeIndex];
  const oldScene = previousScenes ? previousScenes[safeIndex] : undefined;
  const isAdditional = !!previousScenes && safeIndex >= previousScenes.length;
  const isLast = safeIndex >= total - 1;

  const field = (label: string, oldVal: string, newVal: string, italic = false) => {
    return { label, oldVal, newVal, italic };
  };

  const fields = newScene
    ? [
        field("Title", oldScene?.title ?? "", newScene.title),
        field("Display text", oldScene?.display_text ?? "", newScene.display_text ?? ""),
        field("Narration", oldScene?.narration_text ?? "", newScene.narration_text),
        field("Visual", oldScene?.visual_description ?? "", newScene.visual_description, true),
      ]
    : [];

  const renderPanel = (
    variant: "old" | "new",
    scene: SceneLike | undefined,
  ) => {
    const isNew = variant === "new";
    const layout = scene ? resolveLayout(scene) : null;
    return (
      <div
        className={`flex-1 rounded-xl border p-4 ${
          isNew ? "border-purple-200 bg-purple-50/40" : "border-gray-200 bg-gray-50/60"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              isNew ? "text-purple-600" : "text-gray-400"
            }`}
          >
            {isNew ? "New" : "Previous"}
          </span>
          {layout && (
            <span
              className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${
                isNew
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {layout}
            </span>
          )}
        </div>
        {!scene ? (
          <p className="text-xs text-gray-400 italic">No previous scene.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((f) => {
              const value = isNew ? f.newVal : f.oldVal;
              return (
                <div key={f.label}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">
                    {f.label}
                  </p>
                  <p
                    className={`text-sm whitespace-pre-wrap break-words ${
                      f.italic ? "italic text-gray-500" : "text-gray-800"
                    }`}
                  >
                    {value || <span className="text-gray-300">—</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const footerBtn =
    "px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center p-3 sm:p-4">
      {/* Non-dismissable backdrop — no onClick. */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />

      <div
        className="relative w-full min-w-0 max-w-2xl lg:max-w-4xl max-h-[75dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden bg-white rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header (no close button — the popup can only be resolved via Proceed/Regenerate) */}
        <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">Review the regenerated script</h3>
              {projectName && <p className="text-xs text-gray-500 truncate mt-0.5">{projectName}</p>}
            </div>
            <span className="text-xs font-medium text-gray-400 flex-shrink-0">
              Scene {Math.min(safeIndex + 1, total)} of {total}
            </span>
          </div>
          {newScene && (
            <div className="flex items-center gap-2 mt-2 min-w-0">
              <h4 className="text-sm font-medium text-gray-800 truncate">{newScene.title}</h4>
              {isAdditional && (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                  New scene
                </span>
              )}
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              Loading comparison…
            </div>
          ) : isAdditional ? (
            // Additional scene — no comparison, show only the new content.
            <div className="flex flex-col">{renderPanel("new", newScene)}</div>
          ) : (
            // Old first (left on lg / top on mobile), New second (right on lg / bottom on mobile).
            <div className="flex flex-col lg:flex-row gap-3">
              {renderPanel("old", oldScene)}
              {renderPanel("new", newScene)}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex-shrink-0">
          <div>
            {safeIndex > 0 && (
              <button
                type="button"
                onClick={() => setIndex(safeIndex - 1)}
                disabled={verifying}
                className={`${footerBtn} text-gray-600 hover:bg-gray-100`}
              >
                Previous
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Only the initiator can act; others just browse the comparison and wait. */}
            {!canReview && (
              <span className="text-xs text-gray-500 mr-1">
                Waiting for the collaborator who started this to review…
              </span>
            )}
            {canReview && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={verifying}
                className={`${footerBtn} border border-purple-200 text-purple-700 hover:bg-purple-50`}
              >
                Regenerate
              </button>
            )}
            {!isLast ? (
              <>
                <button
                  type="button"
                  onClick={() => setIndex(total - 1)}
                  disabled={verifying}
                  className={`${footerBtn} text-gray-600 hover:bg-gray-100`}
                >
                  Skip to last scene
                </button>
                <button
                  type="button"
                  onClick={() => setIndex(safeIndex + 1)}
                  disabled={verifying}
                  className={`${footerBtn} text-white bg-purple-600 hover:bg-purple-700`}
                >
                  Next
                </button>
              </>
            ) : (
              canReview && (
                <button
                  type="button"
                  onClick={onProceed}
                  disabled={verifying || loading}
                  className={`${footerBtn} text-white bg-purple-600 hover:bg-purple-700`}
                >
                  {verifying ? "Proceeding…" : "Proceed"}
                </button>
              )
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
