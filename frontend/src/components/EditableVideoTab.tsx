import { useEffect, useRef, useState } from "react";

interface Props {
  /** Custom name, or "" to show `defaultLabel`. */
  label: string;
  defaultLabel: string;
  active: boolean;
  onSelect: () => void;
  /** "" means use the default name. */
  onRename: (label: string) => void;
  title?: string;
}

const MAX_LABEL = 24;

/**
 * A "Video #n" tab in the multi-video form. The selected tab's text is an
 * input: clicking it selects the whole name so typing (or Backspace) replaces
 * it. The name is only a reminder while filling in the form — it isn't saved
 * with the project.
 */
export default function EditableVideoTab({ label, defaultLabel, active, onSelect, onRename, title }: Props) {
  const shown = label || defaultLabel;
  const inputRef = useRef<HTMLInputElement>(null);
  // While focused the input edits a draft, so clearing it doesn't snap back to the default mid-edit.
  const [draft, setDraft] = useState<string | null>(null);
  // Set when a tab is clicked while unselected, so it opens ready to type.
  const [focusWhenActive, setFocusWhenActive] = useState(false);
  // The click that focuses the input would otherwise collapse the selection on mouseup.
  const keepSelection = useRef(false);

  useEffect(() => {
    if (active && focusWhenActive) {
      setFocusWhenActive(false);
      inputRef.current?.focus();
    }
  }, [active, focusWhenActive]);

  const base = "rounded-lg text-[11px] font-medium transition-all";

  if (active) {
    const value = draft ?? shown;
    // The invisible copy of the text sets the width, so the box hugs the name
    // exactly like an unselected tab (an input can't size to its content itself).
    return (
      <span className="relative inline-block">
        <span
          aria-hidden
          className={`${base} block invisible whitespace-pre px-3 py-1.5`}
        >
          {value || " "}
        </span>
        <input
          ref={inputRef}
          value={value}
          maxLength={MAX_LABEL}
          onMouseDown={() => {
            keepSelection.current = document.activeElement !== inputRef.current;
          }}
          onMouseUp={(e) => {
            if (keepSelection.current) {
              e.preventDefault();
              keepSelection.current = false;
            }
          }}
          onFocus={(e) => {
            setDraft(shown);
            e.target.select();
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            const next = e.target.value.trim();
            onRename(next === defaultLabel ? "" : next);
          }}
          onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label="Tab name"
        title={title}
        className={`${base} absolute inset-0 w-full min-w-0 px-3 py-1.5 bg-white text-purple-600 shadow-sm outline-none cursor-text`}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setFocusWhenActive(true);
        onSelect();
      }}
      title={title}
      className={`${base} px-3 py-1.5 max-w-[10rem] truncate text-gray-400 hover:text-gray-600`}
    >
      {shown}
    </button>
  );
}
