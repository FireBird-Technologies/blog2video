import type { KeyboardEvent } from "react";
import { Player } from "@remotion/player";
import { SceneSequence } from "./CustomBackground";

const BG_FPS = 30;
const BG_DURATION_FRAMES = 270;

const BG_INPUT_PROPS = {
  displayText: "Your brand in motion",
  narrationText: "Extract. Generate. Publish.",
  brandColors: { primary: "#7c3aed", text: "#374151" },
} as const;

type Props = {
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  isPro: boolean;
  variant?: "default" | "compact";
};

export default function CraftYourTemplateCard({
  onClick,
  onKeyDown,
  isPro,
  variant = "default",
}: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="relative overflow-hidden rounded-lg border-2 border-dashed border-gray-200/60 hover:border-purple-400/60 cursor-pointer transition-all group min-h-[88px]"
    >
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[inherit]">
        <div
          className="absolute left-1/2 top-1/2 h-[145%] w-[145%] -translate-x-1/2 -translate-y-1/2 opacity-[0.8]"
          style={{ filter: "blur(1px)" }}
        >
          <Player
            component={SceneSequence}
            durationInFrames={BG_DURATION_FRAMES}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={BG_FPS}
            inputProps={BG_INPUT_PROPS}
            controls={false}
            autoPlay
            loop
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>

        {/* DARK OVERLAY */}
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.5))",
          }}
        />
      </div>

      {/* CONTENT LAYOUT */}
      <div className="relative z-10 w-full h-full flex flex-col">
        
        {/* CENTER AREA (icon centered) */}
        <div className="flex-1 flex items-center justify-center">
          <div className="rounded-full bg-white shadow-md ring-2 ring-purple-300 flex items-center justify-center w-7 h-7 transition-all group-hover:scale-110">
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
        </div>

        {/* BOTTOM WHITE BAR (10% height) */}
        <div className="w-full h-[25%] min-h-[22px] bg-white border-t border-gray-200/60 flex items-center justify-center">
          <span
            className="font-semibold text-gray-800 text-[10px]"
            style={{ letterSpacing: "0.02em" }}
          >
            Craft Your Template
          </span>
        </div>
      </div>
    </div>
  );
}