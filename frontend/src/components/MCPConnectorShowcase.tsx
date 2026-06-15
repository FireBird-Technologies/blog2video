import MCPHubDiagram from "./MCPHubDiagram";

export default function MCPConnectorShowcase({ onExplore }: { onExplore?: () => void }) {
  return (
    <div className="reveal">
      {/* Header — matches the other landing showcases */}
      <div className="inline-flex items-center gap-2 mb-4 w-full justify-center">
        <p className="text-xs font-medium text-purple-600 tracking-widest uppercase">
          Model Context Protocol
        </p>
      </div>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-4">
        Make videos right from your AI assistant
      </h2>
      <p className="text-sm text-gray-500 text-center max-w-lg mx-auto mb-8 leading-relaxed">
        Connect Blog2Video to Claude, ChatGPT, Gemini or n8n — then just ask, in plain language,
        to pick templates, create projects and render videos.
      </p>

      <MCPHubDiagram />

      {/* CTA */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onExplore}
          className="group inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700"
        >
          Explore the MCP connector
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}
