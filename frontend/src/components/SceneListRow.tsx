import type { ReactNode } from "react";
import type { Scene } from "../api/client";

interface Props {
  scene: Scene;
  /** Zero-based row index (used for tour targeting on the first row). */
  index: number;
  expanded: boolean;
  /** Show the "Audio" status pill — false when project has no voiceover. */
  showAudio: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  /** Highlight the row's Edit button (used by help videos to draw the eye). */
  highlightEdit?: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Drag handle handlers — pass undefined to disable reordering (e.g. inside help videos). */
  onDragHandleStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragHandleEnd?: () => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Expanded body slot rendered below the header when `expanded` is true. */
  children?: ReactNode;
}

/** Scene list row used in the project Scenes tab. Renders a drag handle + clickable header. */
export default function SceneListRow({
  scene,
  index,
  expanded,
  showAudio,
  isDragging = false,
  isDropTarget = false,
  highlightEdit = false,
  onToggleExpand,
  onEdit,
  onDelete,
  onDragHandleStart,
  onDragHandleEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: Props) {
  const draggable = !!onDragHandleStart;

  return (
    <div
      data-scene-row
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`transition-all duration-150 ${isDragging ? "opacity-40 scale-[0.98]" : ""} ${isDropTarget ? "ring-2 ring-purple-400 ring-inset rounded-lg" : ""}`}
    >
      <div className="flex items-stretch gap-0">
        <div
          draggable={draggable}
          onDragStart={onDragHandleStart}
          onDragEnd={onDragHandleEnd}
          onMouseDown={(e) => e.stopPropagation()}
          className={`flex items-center justify-center w-10 flex-shrink-0 rounded-l-lg border border-r-0 border-purple-200 bg-purple-50 ${
            draggable ? "cursor-grab active:cursor-grabbing hover:bg-purple-100" : "cursor-default"
          } select-none touch-none`}
          title={draggable ? "Drag to reorder" : undefined}
        >
          <svg className="w-5 h-5 text-purple-800 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div
            role="button"
            tabIndex={0}
            onClick={onToggleExpand}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggleExpand();
              }
            }}
            className="w-full text-left glass-card p-4 md:border-l-2 md:border-l-purple-200 md:hover:border-l-purple-400 transition-all rounded-r-lg border cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-start sm:items-center gap-3 w-full">
                <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                  {scene.order}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs md:text-sm font-medium text-gray-900 whitespace-normal leading-tight">
                    {scene.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors flex-shrink-0 ${
                      highlightEdit ? "ring-2 ring-purple-400 bg-purple-50" : ""
                    }`}
                    title="Edit scene"
                    data-tour={index === 0 ? "scene-edit-first" : undefined}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="hidden sm:inline-block text-xs font-medium">Edit</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        scene.remotion_code ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-300"
                      }`}
                    >
                      Scene
                    </span>
                    {showAudio && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          scene.voiceover_path ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-300"
                        }`}
                      >
                        Audio
                      </span>
                    )}
                    <span className="text-[11px] text-gray-300 ml-1">
                      {(scene.duration_seconds ?? 0) + (scene.extra_hold_seconds ?? 0)}s
                    </span>

                    <svg
                      className={`w-4 h-4 text-gray-300 transition-transform ml-1 ${expanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0 ml-2 sm:ml-4"
                  title="Delete scene"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="hidden sm:inline-block text-xs font-medium">Delete</span>
                </button>
              </div>
            </div>
          </div>

          {expanded && children}
        </div>
      </div>
    </div>
  );
}
