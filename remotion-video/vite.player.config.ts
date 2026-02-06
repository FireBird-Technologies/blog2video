import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist-player",
    rollupOptions: {
      input: path.resolve(__dirname, "player.html"),
    },
  },
  server: {
    // Port is set via CLI --port flag
    cors: true,
    open: false,
  },
  // Resolve the entry from player.html
  appType: "mpa",
});
