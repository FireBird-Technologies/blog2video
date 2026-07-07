import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { BgmTrack } from "../api/client";

type BgmTrackDropdownProps = {
  tracks: BgmTrack[];
  value: string | null;
  onChange: (trackId: string | null) => void;
  className?: string;
  triggerSize?: "sm" | "md";
  disabled?: boolean;
};

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 8;

export function BgmTrackDropdown({
  tracks,
  value,
  onChange,
  className = "",
  triggerSize = "sm",
  disabled = false,
}: BgmTrackDropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const selected = tracks.find((t) => t.track_id === value);
  const label = selected ? `${selected.display_name} — ${selected.mood}` : "None";
  const triggerText = triggerSize === "md" ? "text-sm" : "text-xs";

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

  const pick = (trackId: string | null) => {
    onChange(trackId);
    setOpen(false);
  };

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label="Background music track"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`w-full px-3 py-2 ${triggerText} border border-gray-200 rounded-lg bg-white hover:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300 flex items-center justify-between gap-2 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200`}
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
            aria-label="Background music tracks"
            style={menuStyle}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 overflow-y-auto"
          >
            <div className="grid grid-cols-1 gap-1">
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => pick(null)}
                className={`text-left px-2.5 py-2 text-xs rounded-lg transition-colors ${
                  !value ? "bg-purple-50 text-purple-700" : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                None
              </button>
              {tracks.map((track) => (
                <button
                  key={track.track_id}
                  type="button"
                  role="option"
                  aria-selected={value === track.track_id}
                  onClick={() => pick(track.track_id)}
                  className={`text-left px-2.5 py-2 text-xs rounded-lg transition-colors ${
                    value === track.track_id
                      ? "bg-purple-50 text-purple-700"
                      : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className="block font-medium text-gray-900">{track.display_name}</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">{track.mood}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
