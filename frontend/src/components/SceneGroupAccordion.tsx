/**
 * Shared accordion shell: chunks an ordered list of scene-indexed items into
 * fixed-size groups (e.g. "Scenes 1-5", "Scenes 6-10"), shows one collapsed
 * header per group, and expands exactly one group at a time into a scrolled
 * body. Extracted from the Scenes tab so Audio/Script/Images can look and
 * behave identically instead of each rolling a flat, unbounded list.
 */
import { ReactNode } from "react";

export const SCENE_GROUP_SIZE = 5;

export interface SceneGroupAccordionProps<T> {
  /** Items in scene order. Each must expose the scene's display order for the range label. */
  items: T[];
  getOrder: (item: T) => number;
  groupSize?: number;
  expandedGroupIndex: number | null;
  onToggleGroup: (groupIdx: number, groupItems: T[]) => void;
  /** Renders the contents of one expanded group (scroll container is provided by this component). */
  renderGroupBody: (groupItems: T[], groupIdx: number) => ReactNode;
  emptyState?: ReactNode;
  /** Max height of the expanded group's scroll container. Defaults to the Scenes-tab value. */
  maxHeightClassName?: string;
}

export default function SceneGroupAccordion<T>({
  items,
  getOrder,
  groupSize = SCENE_GROUP_SIZE,
  expandedGroupIndex,
  onToggleGroup,
  renderGroupBody,
  emptyState,
  maxHeightClassName = "max-h-[70vh]",
}: SceneGroupAccordionProps<T>) {
  if (items.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  const groups: T[][] = [];
  items.forEach((item, idx) => {
    const groupIdx = Math.floor(idx / groupSize);
    if (!groups[groupIdx]) groups[groupIdx] = [];
    groups[groupIdx].push(item);
  });

  return (
    <>
      {groups.map((groupItems, groupIdx) => {
        const isGroupExpanded = expandedGroupIndex === groupIdx;
        const rangeStart = getOrder(groupItems[0]);
        const rangeEnd = getOrder(groupItems[groupItems.length - 1]);
        return (
          <div key={groupIdx} className="mb-2">
            <div
              role="button"
              tabIndex={0}
              onClick={() => onToggleGroup(groupIdx, groupItems)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }}
              className="w-full flex items-center justify-between gap-2 glass-card px-4 py-3 border-l-2 border-l-purple-300 hover:border-l-purple-500 transition-all rounded-lg border cursor-pointer select-none"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900">
                  Scenes {rangeStart}–{rangeEnd}
                </span>
                {!isGroupExpanded && (
                  <span className="text-xs text-gray-400">Expand to view scenes</span>
                )}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isGroupExpanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {isGroupExpanded && (
              <div className={`space-y-2 mt-2 ml-4 ${maxHeightClassName} overflow-y-auto pr-1`}>
                {renderGroupBody(groupItems, groupIdx)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
