import { useState } from "react";
import { AVATAR_PRESETS, MAIN_AVATAR_PRESET_IDS } from "../api/client";

/** Worked examples only show the presenters actually offered (Elena/Marcus) —
 *  the rest of AVATAR_PRESETS is kept valid for existing scenes but isn't a
 *  pickable option anywhere, so showing it here as a "good" example would be
 *  pointing at something the user can't actually choose. */
const EXAMPLE_PRESETS = AVATAR_PRESETS.filter((p) => MAIN_AVATAR_PRESET_IDS.includes(p.id));

/**
 * What makes a photo work as a talking-head source.
 *
 * Every rule maps to a way the render actually degrades — none is a style
 * preference. The render service animates the WHOLE frame from a single still,
 * so anything odd in the photo gets animated too. Stating the consequence is what
 * makes the rule stick: "no smiling" sounds arbitrary until you know the
 * expression is frozen for the entire scene.
 */
export const PHOTO_RULES: {
  do: string;
  dont: string;
  why: string;
  icon: React.ReactNode;
}[] = [
  {
    do: "Look straight at the camera",
    dont: "Head turned or in profile",
    why: "The pose is frozen — a turned head never faces your viewer.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"
      />
    ),
  },
  {
    do: "Hands down, out of frame",
    dont: "Waving, crossed arms, hand near face",
    why: "The model warps hands badly when it animates movement.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 11.5V7a1.5 1.5 0 013 0v4.5m0 0V5.5a1.5 1.5 0 013 0v6m0 0V7a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a6 6 0 01-6-6v-1.5a1.5 1.5 0 013 0"
      />
    ),
  },
  {
    do: "Relaxed, neutral expression",
    dont: "Big smile, laughing, teeth showing",
    why: "It holds for the whole scene, so a grin becomes a stare.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9.75h.008M15 9.75h.008M9 15h6m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  {
    do: "Plain, solid-coloured wall",
    dont: "Busy room, shelves, patterns",
    why: "Clutter distracts and makes a clean cut-out much harder.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75h16.5v16.5H3.75z"
      />
    ),
  },
  {
    do: "Head and shoulders, evenly lit",
    dont: "Full body, harsh shadows, blurry",
    why: "Matches how the built-in presenters are framed.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    ),
  },
];

/**
 * Photo requirements for a user-supplied presenter portrait.
 *
 * Deliberately visual rather than a bullet list: the five roster portraits ARE
 * the target framing (they were normalised to a common eye-line and head size),
 * so showing them as worked examples teaches faster than any prose. Each rule is
 * a do/don't pair because "what not to do" is where people actually go wrong.
 *
 * ``variant`` controls how much room it takes:
 *   "inline"   collapsed by default, for the Scene Edit modal where the picker is
 *              the main event and this is supporting detail.
 *   "expanded" always open, for the project Avatar tab where uploading is the
 *              point of the section.
 */
export default function AvatarPhotoGuide({
  variant = "inline",
}: {
  variant?: "inline" | "expanded";
}) {
  const [open, setOpen] = useState(variant === "expanded");

  const body = (
    <div className="space-y-3">
      {/* Worked examples first: "make it look like these" lands before any rule. */}
      <div>
        <p className="text-[10px] font-medium text-gray-500 mb-1.5">
          Aim for framing like this
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PRESETS.map((p) => (
            <div key={p.id} className="relative">
              <img
                src={`/avatars/${p.id}.jpg`}
                alt={`Good example: ${p.label}`}
                className="w-12 h-12 rounded-lg object-cover border border-green-200"
              />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center">
                <svg
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Do / don't pairs. The "why" is the part that makes each rule memorable. */}
      <ul className="space-y-2">
        {PHOTO_RULES.map((r) => (
          <li key={r.do} className="flex gap-2.5">
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0 mt-[1px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              {r.icon}
            </svg>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[11px] font-medium text-gray-700">
                  {r.do}
                </span>
                <span className="text-[10px] text-red-400 line-through decoration-red-300">
                  {r.dont}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">{r.why}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-gray-400 pt-0.5 border-t border-gray-200/60">
        PNG, JPEG or WebP · up to 8 MB · a square, front-facing headshot works best
      </p>
    </div>
  );

  if (variant === "expanded") {
    return (
      <div className="rounded-xl bg-gray-50/80 border border-gray-200/60 px-4 py-3.5">
        {body}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-50/80 border border-gray-200/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-gray-100/60 transition-colors"
      >
        <svg
          className="w-3.5 h-3.5 text-purple-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
        <span className="text-[11px] font-medium text-gray-600 flex-1">
          Using your own photo? Read this first
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="px-3.5 pb-3.5">{body}</div>}
    </div>
  );
}
