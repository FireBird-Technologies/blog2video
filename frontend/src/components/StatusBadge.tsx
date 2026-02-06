const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "bg-gray-300" },
  scraped: { label: "Scraped", color: "bg-cyan-400" },
  scripted: { label: "Script Ready", color: "bg-purple-400" },
  generated: { label: "Generated", color: "bg-purple-500" },
  rendering: { label: "Rendering", color: "bg-amber-400" },
  done: { label: "Complete", color: "bg-green-400" },
  error: { label: "Error", color: "bg-red-400" },
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
