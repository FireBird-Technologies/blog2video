import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 8;

/**
 * Plain custom (non-native) dropdown — a trigger button plus a portal-rendered
 * listbox with viewport-aware positioning and outside-click close. Mirrors the
 * pattern used by BgmTrackDropdown / ScenePositionDropdown so selects render
 * consistently inside scrollable modals.
 */
export function CustomSelect({
  options,
  value,
  onChange,
  className = "",
  disabled = false,
  ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? value;

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

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center justify-between gap-2 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200"
      >
        <span className="truncate text-left">{label}</span>
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 overflow-y-auto"
          >
            <div className="grid grid-cols-1 gap-1">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  onClick={() => pick(o.value)}
                  className={`text-left px-2.5 py-2 text-sm rounded-lg transition-colors ${
                    value === o.value ? "bg-gray-100 text-gray-900 font-medium" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
