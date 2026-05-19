export type ProjectTabId = "script" | "scenes" | "images" | "audio" | "settings";

export interface ProjectTabItem {
  id: ProjectTabId;
  label: string;
}

type TabSize = "sm" | "lg";

interface Props {
  tabs: ProjectTabItem[];
  active: ProjectTabId;
  onChange: (next: ProjectTabId) => void;
  /** Forwarded to the tabs container; used by joyride targeting in ProjectView. */
  containerDataTour?: string;
  /** Visual size — "sm" (default, in-app) or "lg" (used by help videos / marketing renders). */
  size?: TabSize;
}

/** Pill-style tab strip used at the top of the project page. Shared between live UI and help videos. */
export default function ProjectTabs({ tabs, active, onChange, containerDataTour, size = "sm" }: Props) {
  const containerCls =
    size === "lg"
      ? "flex gap-1.5 p-1.5 bg-gray-100/60 rounded-2xl w-full sm:w-fit"
      : "flex gap-1 p-1 bg-gray-100/60 rounded-xl w-full sm:w-fit";
  const buttonBase =
    size === "lg"
      ? "flex-1 sm:flex-none px-5 sm:px-7 py-3 text-base font-semibold rounded-xl transition-all text-center"
      : "flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-xs font-medium rounded-lg transition-all text-center";

  return (
    <div className={containerCls} data-tour={containerDataTour}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-tour={`${tab.id}-tab`}
          onClick={() => onChange(tab.id)}
          className={`${buttonBase} ${
            active === tab.id
              ? "bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
