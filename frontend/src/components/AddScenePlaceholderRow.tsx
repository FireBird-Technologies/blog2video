/**
 * Placeholder row shown in the scene list while a new scene generates in the
 * background. Mirrors the real SceneListRow layout (drag-handle column + glass card)
 * but shows a spinner in place of the order badge and "Generating scene…" in place of
 * the title. Resolves to the real row when the add-scene job completes.
 */
export default function AddScenePlaceholderRow() {
  return (
    <div role="status" aria-live="polite">
      <div className="flex items-stretch gap-0">
        <div className="flex items-center justify-center w-10 flex-shrink-0 rounded-l-lg border border-r-0 border-purple-200 bg-purple-50 select-none">
          <svg className="w-5 h-5 text-purple-800" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="w-full text-left glass-card p-4 md:border-l-2 md:border-l-purple-200 transition-all rounded-r-lg border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-start sm:items-center gap-3 w-full">
                <span className="text-xs font-medium text-purple-600 bg-purple-50 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs md:text-sm font-medium text-gray-900 whitespace-normal leading-tight">
                    Generating scene…
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
