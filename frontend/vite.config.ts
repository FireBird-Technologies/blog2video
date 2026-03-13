import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const isCloudflare = !!process.env.CF_PAGES;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@remotion-video": isCloudflare
        ? path.resolve(__dirname, "./src/components/remotion")
        : path.resolve(__dirname, "../remotion-video/src"),
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
