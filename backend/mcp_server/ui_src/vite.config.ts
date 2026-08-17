import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

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
// setup_gallery is the CHATGPT-only panel: it deliberately has NO ui/initialize
// handshake (Claude never renders it) and submits via window.openai.callTool.
// It is built here only so its preview images inline as data URIs instead of
// being fetched from R2 at runtime.
const VIEWS = ["template_gallery", "voice_gallery", "settings_panel", "setup_gallery"] as const;

const view = process.env["B2V_VIEW"] ?? VIEWS[0];
if (!VIEWS.includes(view as (typeof VIEWS)[number])) {
  throw new Error(`Unknown B2V_VIEW "${view}". Known: ${VIEWS.join(", ")}`);
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
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
