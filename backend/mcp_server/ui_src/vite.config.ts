import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

// Build a single self-contained HTML file per UI view. Output goes directly to
// ../ui/views/ (which the Python backend reads at runtime). Each entry produces
// its own HTML file with React + CSS + JS all inlined.
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
      input: {
        template_gallery: resolve(__dirname, "template_gallery.html"),
      },
    },
  },
});
