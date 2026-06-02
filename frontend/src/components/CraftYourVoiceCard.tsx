import type { KeyboardEvent } from "react";

type Props = {
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  isPro: boolean;
};

/**
 * Full-width row that mirrors a VoiceItem but acts as an entry point to the
 * "Create custom voice" flow — themed to match CraftYourTemplateCard (Step 2).
 */
export default function CraftYourVoiceCard({ onClick, onKeyDown }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="relative overflow-hidden flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200/60 hover:border-purple-400/60 cursor-pointer transition-all group p-3"
    >
      {/* SUBTLE PURPLE FILL */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            "linear-gradient(135deg, rgba(124,58,237,0.06), rgba(124,58,237,0.02))",
        }}
      />

      {/* PLUS ICON (matches VoiceItem play button footprint) */}
      <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-white shadow-md ring-2 ring-purple-300 flex items-center justify-center transition-all group-hover:scale-110">
        <svg
          className="text-purple-600 w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </div>

      {/* TEXT */}
      <div className="relative z-10 flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">
          Create a custom voice
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
          Design, clone, or generate your own narration voice.
        </p>
      </div>
    </div>
  );
}
