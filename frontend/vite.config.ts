import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const isCloudflare = !!process.env.CF_PAGES;
const isVercel = !!process.env.VERCEL;
const isCI = isCloudflare || isVercel;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@remotion-video/templates": isCI
          ? path.resolve(__dirname, "./src/components/remotion")
          : path.resolve(__dirname, "../remotion-video/src/templates"),
      // Local alias pulls sources from sibling `remotion-video/`; Rollup resolves peer
      // deps from that folder unless we pin them to the frontend install.
      recharts: path.resolve(__dirname, "node_modules/recharts"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
