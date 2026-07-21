import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type ScenePositionDropdownProps = {
  /** Total number of active scenes; positions run 1..count+1 (the last = "End"). */
  activeCount: number;
  /** Currently selected 1-indexed position. */
  value: number;
  onChange: (position: number) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
};

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 8;

/** Label for a 1-indexed insert position (the last slot reads as "End"). */
function positionLabel(position: number, activeCount: number): string {
  return position === activeCount + 1
    ? `End (after scene ${activeCount})`
    : `Position ${position}`;
}

/**
 * Custom (non-native) dropdown for choosing where a new scene is inserted.
 * Mirrors BgmTrackDropdown's trigger + portal menu pattern (viewport-aware
 * positioning, outside-click close) so it renders consistently inside the modal.
 */
export function ScenePositionDropdown({
  activeCount,
  value,
  onChange,
  className = "",
  disabled = false,
  id,
}: ScenePositionDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const positions = Array.from({ length: activeCount + 1 }, (_, i) => i + 1);

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
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (evt: MouseEvent) => {
      const target = evt.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const pick = (position: number) => {
    onChange(position);
    setOpen(false);
  };

  return (
    <div className={className}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert at position"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg bg-purple-50 text-purple-700 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center justify-between gap-2 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-purple-200"
      >
        <span className="truncate text-left">{positionLabel(value, activeCount)}</span>
        <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Insert at position"
            style={menuStyle}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 overflow-y-auto"
          >
            <div className="grid grid-cols-1 gap-1">
              {positions.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="option"
                  aria-selected={value === p}
                  onClick={() => pick(p)}
                  className={`text-left px-2.5 py-2 text-sm rounded-lg transition-colors ${
                    value === p ? "bg-purple-50 text-purple-700" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {positionLabel(p, activeCount)}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
