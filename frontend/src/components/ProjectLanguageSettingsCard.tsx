import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { changeProjectLanguage } from "../api/client";
import { SUPPORTED_CONTENT_LANGUAGES, getLanguageName } from "../constants/languages";

// The menu is portalled to <body> and positioned with `fixed`. It cannot be a plain
// absolutely-positioned child: `.glass-card` sets `backdrop-filter: blur(20px)`, and any
// non-`none` backdrop-filter creates a stacking context — which traps the menu's z-index
// inside its own card so it paints *behind* the sibling cards that follow it in the DOM.
// Same approach as BgmTrackDropdown, which lives in this very Settings tab.
const MENU_MAX_HEIGHT = 296; // ~12 rows
const MENU_GAP = 8;

interface Props {
  projectId: number;
  /** Current project content_language (ISO 639-1), or null when auto-detected. */
  contentLanguage: string | null | undefined;
  /**
   * The acting user's own remaining credits. Only meaningful when they ARE the owner —
   * a language change bills the owner, and the client has no visibility into another
   * user's quota. For collaborators this stays true and the backend's 403 (which names
   * whose limit was hit) is surfaced instead.
   */
  canCreateVideo: boolean;
  /** True when the acting user is not the project owner (affects the warning copy). */
  isCollaborator: boolean;
  /**
   * ``variant: "warning"`` renders the soft "Oops 😢" modal rather than a hard red
   * error — used for quota blocks, which aren't failures the user did anything wrong to
   * cause (and which a collaborator can't fix by upgrading their own plan).
   */
  onError: (message: string, options?: { variant?: "warning" }) => void;
  onOperationStarted: (op: { kind: "language_change"; total: number }) => void;
  /** Another long-running job is active — only one job per project at a time. */
  disabled?: boolean;
}

export default function ProjectLanguageSettingsCard({
  projectId,
  contentLanguage,
  canCreateVideo,
  isCollaborator,
  onError,
  onOperationStarted,
  disabled = false,
}: Props) {
  const current = (contentLanguage || "").toLowerCase();
  const [selected, setSelected] = useState<string>(current);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasChanges = selected !== "" && selected !== current;
  const blocked = disabled || changing || !canCreateVideo;
  // The button stays visually enabled at all times; it simply does nothing until a
  // different language is picked. Only a real block (another job, no credits) disables it.
  const canSubmit = hasChanges && !blocked;

  const currentLabel = useMemo(
    () => (current ? getLanguageName(current) : "Auto-detected from your source"),
    [current]
  );
  const selectedLabel = selected ? getLanguageName(selected) : "Select a language";

  // Anchor the portalled menu to the trigger, flipping up when there's no room below.
  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUp = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

    const margin = 8;
    const width = rect.width;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);

    const style: CSSProperties = {
      position: "fixed",
      left,
      width,
      zIndex: 9999,
      maxHeight: MENU_MAX_HEIGHT,
    };
    if (openUp) {
      style.bottom = window.innerHeight - rect.top + MENU_GAP;
    } else {
      style.top = rect.bottom + MENU_GAP;
    }
    setMenuStyle(style);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener("resize", onReposition);
    // Capture phase so scrolling any ancestor container repositions the menu too.
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuPosition]);

  // Close on outside click / Escape. The menu is portalled, so it is NOT a DOM
  // descendant of the trigger — both refs must be checked.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleChange = async () => {
    if (!canSubmit || changing) return;
    setChanging(true);
    try {
      const { data } = await changeProjectLanguage(projectId, selected);
      // The backend broadcasts `project_reloaded` to every other collaborator, whose
      // page reloads and re-opens the progress modal from /language-change-status.
      onOperationStarted({ kind: "language_change", total: data.total });
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { detail?: string } } })
        ?.response;
      const detail = response?.data?.detail;
      // 403 = the payer's video limit is exhausted (see video_limit_message on the
      // backend). That's a quota wall, not a failure — show the soft "Oops" warning.
      if (response?.status === 403 && detail) {
        onError(detail, { variant: "warning" });
      } else {
        onError(detail || "Failed to change the language. Please try again.");
      }
    } finally {
      setChanging(false);
    }
  };

  return (
    <div>
      <ConfirmDeleteModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={`Translate this video to ${getLanguageName(selected)}?`}
        subtitle="Every scene's text and voiceovers will be translated. "
        warningMessage={
          isCollaborator
            ? "This will deduct 1 video count from the project owner's quota. Do you want to continue?"
            : "This will deduct 1 video count from your quota. Do you want to continue?"
        }
        confirmLabel="Translate video"
        confirmLoadingLabel="Starting..."
        iconVariant="warning"
        onConfirm={async () => {
          setShowConfirm(false);
          await handleChange();
        }}
      />

      <h2 className="text-base font-medium text-gray-900 mb-1">Language</h2>
      <p className="text-xs text-gray-400 mb-5">
        Translate the video — titles, on-screen text, narration and voiceovers.
        Layouts and images preserved.
      </p>

      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-2">Current language</label>
            <p className="text-sm text-gray-900">{currentLabel}</p>
          </div>

          <div>
            <span className="block text-xs text-gray-500 mb-2">Translate to</span>
            <div>
              <button
                ref={triggerRef}
                type="button"
                disabled={blocked}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={selected ? "text-gray-700" : "text-gray-400"}>
                  {selectedLabel}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open &&
                createPortal(
                  <div
                    ref={menuRef}
                    role="listbox"
                    style={menuStyle}
                    className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
                  >
                    <div
                      className="overflow-y-auto py-1"
                      style={{ maxHeight: MENU_MAX_HEIGHT }}
                    >
                      {SUPPORTED_CONTENT_LANGUAGES.map((lang) => {
                        const isCurrent = lang.code === current;
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            role="option"
                            aria-selected={lang.code === selected}
                            disabled={isCurrent}
                            onClick={() => {
                              setSelected(lang.code);
                              setOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-purple-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed ${
                              lang.code === selected ? "bg-purple-50 text-purple-700" : "text-gray-700"
                            }`}
                          >
                            {lang.name}
                            {isCurrent ? " (current)" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          </div>
        </div>

        {!canCreateVideo && (
          <p className="text-xs text-amber-600">
            You have no video credits left. Upgrade your plan or buy more credits to
            translate this video.
          </p>
        )}

        {/* Always rendered in its enabled purple style; it just no-ops until a
            different language is selected (or while another job is running). */}
        <button
          type="button"
          aria-disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit) return;
            setShowConfirm(true);
          }}
          className={`self-end rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 ${
            canSubmit ? "cursor-pointer" : "cursor-not-allowed"
          }`}
        >
          {changing ? "Starting..." : "Change language"}
        </button>

        <p className="text-[11px] text-gray-400">
          Counts as a new video (1 credit
          {isCollaborator ? ", charged to the project owner" : ""}).
        </p>
      </div>
    </div>
  );
}
