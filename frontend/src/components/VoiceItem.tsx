import type { ReactNode } from "react";

/** Format subtitle as: Gender • Accent — Descriptive qualities */
export function formatVoiceSubtitle(
  gender?: string | null,
  accent?: string | null,
  description?: string | null
): string {
  const parts: string[] = [];
  if (gender) parts.push(gender.trim());
  if (accent) parts.push(accent.trim());
  const left = parts.length ? parts.join(" • ") : "";
  const desc = (description ?? "").trim();
  if (left && desc) return `${left} — ${desc}`;
  if (desc) return desc;
  if (left) return left;
  return "";
}

/** Capitalize first letter for display (e.g. "female" → "Female") */
function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Strip " - personality description" from my-voice name; return display name and optional description part */
export function getMyVoiceDisplayName(name: string): { displayName: string; descriptionFromName: string | null } {
  const idx = name.indexOf(" - ");
  if (idx === -1) return { displayName: name.trim(), descriptionFromName: null };
  const displayName = name.slice(0, idx).trim();
  const descriptionFromName = name.slice(idx + 3).trim() || null;
  return { displayName: displayName || name.trim(), descriptionFromName };
}

/** Build subtitle for a saved (my) voice: same structure as main voices (Gender • Accent — description) or "Custom — ..." */
export function subtitleForSavedVoice(saved: {
  name: string;
  gender?: string | null;
  accent?: string | null;
  description?: string | null;
}): string {
  const { descriptionFromName } = getMyVoiceDisplayName(saved.name);
  const desc = (saved.description ?? descriptionFromName ?? "").trim();
  if (saved.gender || saved.accent) {
    return formatVoiceSubtitle(saved.gender, saved.accent, desc || "My voice");
  }
  if (desc) return `Custom — ${desc}`;
  return "Custom — My voice";
}

export interface VoiceItemProps {
  /** Voice display name */
  name: string;
  /** Subtitle line: "Gender • Accent — Descriptive qualities". Use formatVoiceSubtitle() or pass a string. */
  subtitle: string;
  /** Whether this voice has a playable preview */
  hasPreview: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  /** Optional right-side actions (e.g. add/remove button, checkmark) */
  actions?: ReactNode;
  /** Optional wrapper className (e.g. for list item) */
  className?: string;
  /** If true, card shows selected state (purple border) */
  isSelected?: boolean;
  /** Optional click on the whole row (e.g. for selection) */
  onClick?: () => void;
  /** Disable play and row interaction */
  disabled?: boolean;
  /** Optional badge (e.g. "Pro") */
  badge?: ReactNode;
}

export default function VoiceItem({
  name,
  subtitle,
  hasPreview,
  isPlaying,
  onPlay,
  actions,
  className = "",
  isSelected = false,
  onClick,
  disabled = false,
  badge,
}: VoiceItemProps) {
  const base =
    "flex items-center gap-3 rounded-xl border-2 p-3 transition-all " +
    (disabled ? "cursor-not-allowed " : onClick ? "cursor-pointer " : "");
  const variant = isSelected
    ? "border-purple-500 bg-purple-50/60 shadow-[0_0_0_4px_rgba(124,58,237,0.08)]"
    : "border-gray-200/60 bg-white/60 hover:border-purple-300/60 hover:bg-purple-50/20";
  const disabledVariant = disabled ? "opacity-60 hover:border-gray-200/60 hover:bg-white/60" : "";

  const Wrapper = onClick ? "div" : "div";
  return (
    <Wrapper
      role={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      className={`${base} ${variant} ${disabledVariant} ${className}`.trim()}
    >
      {hasPreview ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onPlay();
          }}
          disabled={disabled}
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            disabled
              ? "bg-gray-50 text-gray-300 cursor-not-allowed"
              : isPlaying
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700"
          }`}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      ) : (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-300" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{name}</div>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
      {badge}
      {actions}
    </Wrapper>
  );
}

/** Build subtitle from ElevenLabs voice labels + description */
export function subtitleFromElevenLabs(voice: {
  labels?: Record<string, string> | null;
  description?: string | null;
}): string {
  const labels = voice.labels ?? {};
  const gender = labels.gender ? cap(labels.gender) : "";
  const accent = labels.accent ? cap(labels.accent) : "";
  const desc = (voice.description ?? "").trim() || "Prebuilt voice";
  return formatVoiceSubtitle(gender, accent, desc);
}
