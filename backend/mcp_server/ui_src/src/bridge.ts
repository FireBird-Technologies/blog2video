// Tiny iframe↔host postMessage bridge for MCP-UI / MCP Apps hosts (claude.ai,
// Claude Desktop, VS Code Copilot, Goose, MCPJam, etc.).
//
// Two delivery paths for the initial render data:
//   1. `ui-lifecycle-iframe-render-data` postMessage from the host
//      (the standard mcp-ui flow; works in Goose/MCPJam)
//   2. `?data=<base64 JSON>` query string fallback
//      (used when content type is externalUrl — the server builds the URL
//      with the data already encoded, so the iframe gets it even if the
//      host never delivers the lifecycle message)
//
// Either path resolves the same Promise. We use Promise.race so the iframe
// renders as soon as the FIRST source delivers data.

type RenderData = Record<string, unknown>;

const QUERY_DATA_PARAM = "data";

function _readQueryData(): RenderData | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get(QUERY_DATA_PARAM);
    if (!raw) return null;
    const json = atob(raw);
    return JSON.parse(json) as RenderData;
  } catch {
    return null;
  }
}

function _waitForPostMessageData(timeoutMs: number): Promise<RenderData | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ui-lifecycle-iframe-render-data") {
        const payload = (data.payload ?? {}) as { renderData?: RenderData };
        if (!resolved) {
          resolved = true;
          window.removeEventListener("message", handler);
          resolve(payload.renderData ?? {});
        }
      }
    };
    window.addEventListener("message", handler);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener("message", handler);
        resolve(null);
      }
    }, timeoutMs);
  });
}

async function _fetchTemplatesFromApi(): Promise<RenderData | null> {
  // When the iframe is opened directly in a browser (no ?data= param and no
  // host postMessage), fetch the templates from the backend API so the gallery
  // renders even outside of claude.ai. The origin of the iframe URL is the
  // same as the backend, so no CORS issue.
  try {
    const base = window.location.origin; // e.g. https://footrest-dweeb-silt.ngrok-free.dev
    const res = await fetch(`${base}/api/templates`);
    if (!res.ok) return null;
    const templates = await res.json();
    return {
      templates: templates.map((t: Record<string, unknown>) => ({
        id: t["id"],
        name: t["name"] || t["id"],
        description: t["description"] || "",
        genres: t["genres"] || [],
        marketing_url: `https://blog2video.app/templates/${t["id"]}`,
        preview_colors: t["preview_colors"] || {},
      })),
    };
  } catch {
    return null;
  }
}

export function onRenderData(callback: (data: RenderData) => void): void {
  // Source 1: window.__B2V_DATA__ injected server-side by the /mcp/ui/template_gallery
  // route. This is the most reliable path — the server fetches templates and inlines
  // them before serving the HTML, so no client-side fetch is needed. Works even
  // in sandboxed iframes (allow-scripts without allow-same-origin).
  const windowData = (window as unknown as { __B2V_DATA__?: RenderData }).__B2V_DATA__;
  if (windowData && Object.keys(windowData).length > 0) {
    callback(windowData);
    // Still listen for postMessage in case the host wants to update the data later.
    _waitForPostMessageData(1000).then((data) => {
      if (data && Object.keys(data).length > 0) callback(data);
    });
    try { window.parent.postMessage({ type: "ui-lifecycle-iframe-ready" }, "*"); } catch { /**/ }
    return;
  }

  // Source 2: ?data= query string (used by externalUrl content type)
  const queryData = _readQueryData();
  if (queryData) {
    callback(queryData);
  }

  // Source 3: postMessage from the MCP-UI host (used by Goose/MCPJam)
  _waitForPostMessageData(500).then(async (data) => {
    if (data && Object.keys(data).length > 0) {
      callback(data);
    } else if (!queryData) {
      // Source 4: direct API fetch (last resort; may be sandboxed-blocked in iframes)
      const apiData = await _fetchTemplatesFromApi();
      if (apiData) callback(apiData);
    }
  });

  // Signal readiness to MCP-UI hosts.
  try {
    window.parent.postMessage({ type: "ui-lifecycle-iframe-ready" }, "*");
  } catch {
    /* in a non-iframe preview, parent is self; harmless */
  }
}

/** Send a synthetic user-style prompt that the host injects into the chat. */
export function sendPrompt(prompt: string): void {
  window.parent.postMessage({ type: "prompt", payload: { prompt } }, "*");
}

/** Ask the host to open a URL in a new tab. */
export function openLink(url: string): void {
  window.parent.postMessage({ type: "link", payload: { url } }, "*");
}

/** Directly invoke another MCP tool. Use sparingly — usually `prompt` is
 *  preferable because the user sees their own request in chat history. */
export function callTool(toolName: string, params: Record<string, unknown>): void {
  window.parent.postMessage({ type: "tool", payload: { toolName, params } }, "*");
}
