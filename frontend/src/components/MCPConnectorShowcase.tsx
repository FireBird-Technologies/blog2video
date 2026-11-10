import { useState } from "react";
import MCPHubDiagram from "./MCPHubDiagram";
import { MCP_SERVER_URL } from "../lib/mcp";

export default function MCPConnectorShowcase({ onExplore }: { onExplore?: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyServerUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_SERVER_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard access may be unavailable in some browsers. */
    }
  };

  return (
    <div className="reveal">
      {/* Header — matches the other landing showcases */}
      <div className="inline-flex items-center gap-2 mb-4 w-full justify-center">
        <p className="text-xs font-medium text-purple-600 tracking-widest uppercase">
          Model Context Protocol
        </p>
      </div>
      <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 text-center mb-3">
        Make videos right from your AI assistant
      </h2>
      <div className="mb-5 flex justify-center">
        <button
          type="button"
          onClick={copyServerUrl}
          className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-100 hover:shadow"
          aria-label="Copy MCP connect URL"
          title="Copy MCP connect URL"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
            MCP URL
          </span>
          <code className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium sm:text-sm">
            {MCP_SERVER_URL}
          </code>
          {copied ? (
            <svg className="h-3.5 w-3.5 shrink-0 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
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
