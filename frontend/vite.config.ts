import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const remotionVideoPath = path.resolve(__dirname, "../remotion-video/src");
const isRemotionAvailable = fs.existsSync(remotionVideoPath);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@remotion-video": isRemotionAvailable
        ? remotionVideoPath
        : path.resolve(__dirname, "./src/components/remotion"),
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
