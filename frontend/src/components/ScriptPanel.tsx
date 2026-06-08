import { useState } from "react";
import { Scene } from "../api/client";
import { updateScene } from "../api/projects";

interface Props {
  scenes: Scene[];
  projectName: string;
  projectId: number;
  onSceneUpdate: (scene: Scene) => void;
  onRegenerateScript: () => void;
  isRegenerating?: boolean;
  /** Disable all interactive buttons (editing, regeneration) when pipeline/render is in progress. */
  disabled?: boolean;
}

// Resolve the layout to display, distinguishing the planned hint (preferred_layout, set
// when the script is ready) from the final assigned layout (remotion_code, set once scenes
// are fully generated). "final" wins whenever remotion_code carries a layout.
function resolveLayout(scene: Scene): { value: string; stage: "planned" | "final" } | null {
  if (scene.remotion_code) {
    try {
      const parsed = JSON.parse(scene.remotion_code);
      const assigned = parsed.layout ?? parsed.layoutConfig?.arrangement ?? null;
      if (assigned) return { value: assigned, stage: "final" };
    } catch {}
  }
  if (scene.preferred_layout) return { value: scene.preferred_layout, stage: "planned" };
  return null;
}

export default function ScriptPanel({
  scenes,
  projectName,
  projectId,
  onSceneUpdate,
  onRegenerateScript,
  isRegenerating,
  disabled,
}: Props) {
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; display_text: string }>({
    title: "",
    display_text: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const isDisabled = disabled || isRegenerating;

  function openEdit(scene: Scene) {
    if (isDisabled) return;
    setEditingSceneId(scene.id);
    setEditDraft({ title: scene.title, display_text: scene.display_text ?? "" });
  }

  function cancelEdit() {
    setEditingSceneId(null);
  }

  async function saveEdit(scene: Scene) {
    setIsSaving(true);
    try {
      const res = await updateScene(projectId, scene.id, {
        title: editDraft.title,
        display_text: editDraft.display_text || null,
      });
      onSceneUpdate(res.data);
      setEditingSceneId(null);
    } catch {
      // keep edit mode open so user can retry
    } finally {
      setIsSaving(false);
    }
  }

  if (scenes.length === 0) {
    return (
      <p className="text-center py-16 text-xs text-gray-400">
        Script is generating.
      </p>
    );
  }

  const totalDuration = scenes.reduce(
    (sum, s) => sum + s.duration_seconds + (s.extra_hold_seconds ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-2">
        <div className="flex items-baseline gap-4 min-w-0">
          <h2 className="text-base font-medium text-gray-900 truncate">{projectName}</h2>
          <span className="text-xs text-gray-400 shrink-0">
            {scenes.length} scenes — ~{Math.ceil(totalDuration / 60)} min
          </span>
        </div>

        {isRegenerating ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-3 h-3 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            Regenerating…
          </div>
        ) : (
          <button
            onClick={onRegenerateScript}
            disabled={isDisabled}
            title="Regenerate with AI"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 4H7a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-4M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
              />
            </svg>
            Regenerate with AI
          </button>
        )}
      </div>

      {/* Scene cards */}
      <div className="space-y-2">
        {scenes.map((scene) => {
          const layout = resolveLayout(scene);
          const isEditing = editingSceneId === scene.id;

          return (
            <div
              key={scene.id}
              className="glass-card p-5 border-l-2 border-l-purple-200"
            >
              {isEditing ? (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Title</label>
                    <input
                      className="w-full text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Display text</label>
                    <textarea
                      className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                      rows={3}
                      value={editDraft.display_text}
                      onChange={(e) => setEditDraft((d) => ({ ...d, display_text: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveEdit(scene)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      {isSaving ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <>
                  {/* Title row + Edit button */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h3 className="text-sm font-medium text-gray-900">{scene.title}</h3>
                      <span className="text-[11px] text-gray-300">
                        {(scene.duration_seconds ?? 0) + (scene.extra_hold_seconds ?? 0)}s
                      </span>
                    </div>
                    <button
                      onClick={() => openEdit(scene)}
                      disabled={isDisabled}
                      className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors flex-shrink-0 text-xs font-medium disabled:opacity-40 disabled:pointer-events-none"
                      title="Edit title and display text"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>

                  {/* Display text */}
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">
                    {scene.display_text ?? scene.narration_text}
                  </p>

                  {/* Visual description */}
                  <p className="text-xs text-gray-400 leading-relaxed italic mb-3">
                    {scene.visual_description}
                  </p>

                  {/* Layout pill — planned (muted, pre-generation) vs final assigned. */}
                  {layout && (
                    <span
                      className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${
                        layout.stage === "planned"
                          ? "bg-gray-50 text-gray-500 border border-gray-200"
                          : "bg-purple-50 text-purple-600"
                      }`}
                      title={
                        layout.stage === "planned"
                          ? "Planned layout — final layout is assigned once scenes are generated"
                          : "Assigned layout"
                      }
                    >
                      {/* {layout.stage === "planned" ? " " : ""} */}
                      {layout.value}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
