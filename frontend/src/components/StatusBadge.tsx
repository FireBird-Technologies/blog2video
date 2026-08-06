const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "bg-gray-300" },
  scraped: { label: "Scraped", color: "bg-cyan-400" },
  scripted: { label: "Script Ready", color: "bg-purple-400" },
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

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.created;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}
