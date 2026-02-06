const statusConfig: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "bg-gray-600 text-gray-200" },
  scraped: { label: "Scraped", color: "bg-cyan-900 text-cyan-300" },
  scripted: { label: "Script Ready", color: "bg-blue-900 text-blue-300" },
  generated: { label: "Generated", color: "bg-purple-900 text-purple-300" },
  rendering: { label: "Rendering...", color: "bg-yellow-900 text-yellow-300" },
  done: { label: "Complete", color: "bg-green-900 text-green-300" },
  error: { label: "Error", color: "bg-red-900 text-red-300" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.created;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
    >
      {status === "rendering" && (
        <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
