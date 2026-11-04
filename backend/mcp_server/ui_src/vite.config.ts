import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

// Build a single self-contained HTML file per UI view. Output goes directly to
// ../ui/views/ (which the Python backend reads at runtime). Each entry produces
// its own HTML file with React + CSS + JS all inlined.
//
// vite-plugin-singlefile sets output.inlineDynamicImports, which rollup rejects
// with more than one input — so views are built ONE PER INVOCATION, selected by
// the B2V_VIEW env var. `npm run build` builds every view; use
// `npm run build:voice_gallery` (or build:template_gallery) to rebuild just one.
// Adding a view: add it here, add a build:<name> script, and register the
// filename in mcp_server/ui/resources.py UI_RESOURCES.
// setup_gallery uses the same MCP Apps ui/initialize handshake as the smaller
// views, while retaining ChatGPT's window.openai helpers for tool/file actions.
// It is built here so the handshake SDK and preview images are both inlined.
const VIEWS = ["template_gallery", "voice_gallery", "settings_panel", "setup_gallery"] as const;

const view = process.env["B2V_VIEW"] ?? VIEWS[0];
if (!VIEWS.includes(view as (typeof VIEWS)[number])) {
  throw new Error(`Unknown B2V_VIEW "${view}". Known: ${VIEWS.join(", ")}`);
}

// MCP app iframes cannot rely on Google Fonts being allowed by the host CSP.
// Reuse the self-contained Plus Jakarta Sans data URLs from the main setup view
// in the smaller Claude views as well, so every host renders the same typeface.
const setupHtml = readFileSync(resolve(__dirname, "setup_gallery.html"), "utf8");
const plusJakartaFontFaces = (setupHtml.match(/@font-face\s*\{[^}]+\}/g) ?? []).join("\n");
const embedAppFont = {
  name: "embed-plus-jakarta-font",
  transformIndexHtml(html: string) {
    if (view === "setup_gallery" || !plusJakartaFontFaces) return html;
    return html.replace("</head>", `<style>${plusJakartaFontFaces}</style></head>`);
  },
};

export default defineConfig({
  plugins: [react(), embedAppFont, viteSingleFile()],
  resolve: {
    alias: {
      // Re-use the user's existing Blog2Video template-preview React components.
      // These are pure React + inline styles for 8 of the 12 templates; the
      // remaining 4 use @remotion/player (we render a CSS fallback for those).
      "@previews": resolve(
        __dirname,
        "../../../frontend/src/components/templatePreviews"
      ),
    },
  },
  build: {
    outDir: resolve(__dirname, "../ui/views"),
    emptyOutDir: false,
    rollupOptions: {
      input: { [view]: resolve(__dirname, `${view}.html`) },
    },
  },
});
