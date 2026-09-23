/** Pill background/text pairs, keyed by the dot colour each status already uses,
 *  so a new status picks up a matching pill without a second lookup table. */
const pillTone: Record<string, string> = {
  "bg-gray-300": "bg-gray-100 text-gray-600",
  "bg-cyan-400": "bg-cyan-50 text-cyan-700",
  "bg-purple-400": "bg-purple-50 text-purple-700",
  "bg-purple-500": "bg-purple-50 text-purple-700",
  "bg-amber-400": "bg-amber-50 text-amber-700",
  "bg-green-400": "bg-green-50 text-green-700",
  "bg-red-400": "bg-red-50 text-red-700",
  "bg-yellow-700": "bg-yellow-50 text-yellow-800",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "bg-gray-300" },
  scraped: { label: "Scraped", color: "bg-cyan-400" },
  scripted: { label: "Script Ready", color: "bg-purple-400" },
  awaiting_script_review: { label: "Needs script review", color: "bg-amber-400" },
  // Generation finished; parked at the post-generation review gate — the user
  // must approve/change/reject the auto-picked clips. Amber (not red):
  // waiting on the user, not an error.
  awaiting_stock_footage_review: { label: "Needs footage review", color: "bg-amber-400" },
  // Legacy: the old pre-scene-gen gate. Kept only for any project still
  // parked here from before this status was retired.
  // TODO(cleanup): remove once no rows remain at this status.
  awaiting_footage: { label: "Needs footage review", color: "bg-amber-400" },
  generated: { label: "Generated", color: "bg-purple-500" },
  rendering: { label: "Rendering", color: "bg-amber-400" },
  done: { label: "Complete", color: "bg-green-400" },
  error: { label: "Error", color: "bg-red-400" },
  regenerating: { label: "Regenerating", color: "bg-yellow-700" },
  script_regenerating: { label: "Regenerating Script", color: "bg-yellow-700" },
  voice_regenerating: { label: "Regenerating Voiceover", color: "bg-yellow-700" },
  language_regenerating: { label: "Translating the project", color: "bg-yellow-700" },
};

export default function StatusBadge({
  status,
  variant = "plain",
}: {
  status: string;
  /** "pill" gives the label a tinted rounded background — used where the badge
   *  sits in a row of buttons and needs the same visual weight as they have. */
  variant?: "plain" | "pill";
}) {
  const config = statusConfig[status] || statusConfig.created;
  if (variant === "pill") {
    const tone = pillTone[config.color] || pillTone["bg-gray-300"];
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium whitespace-nowrap ${tone}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.color}`} />
        {config.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}
