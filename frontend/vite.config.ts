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
    // Array form required so RegExp entries can co-exist with string entries.
    // The sibling `remotion-video/` workspace is pulled in via the
    // `@remotion-video/templates` alias in local dev. Its source files may
    // import packages that live only in `remotion-video/node_modules` (or that
    // Rollup/Vite cannot find from there because the project root is
    // `frontend/`). The aliases below redirect those imports to the frontend's
    // own `node_modules` where the packages are installed.
    alias: [
      {
        find: "@remotion-video/templates",
        replacement: isCI
          ? path.resolve(__dirname, "./src/components/remotion")
          : path.resolve(__dirname, "../remotion-video/src/templates"),
      },
      // All `@fontsource/*` CSS imports from remotion-video source files.
      {
        find: /^@fontsource\/(.*)/,
        replacement: path.resolve(__dirname, "node_modules/@fontsource/$1"),
      },
      // recharts is used by newscast / bloomberg compositions in remotion-video.
      {
        find: "recharts",
        replacement: path.resolve(__dirname, "node_modules/recharts"),
      },
      // @remotion/transitions: alias ONLY the bare package root to frontend's
      // node_modules so remotion-video source files can find it. Subpaths
      // (/fade, /slide, /iris, /clock-wipe, …) are intentionally NOT rewritten
      // to a filesystem path — doing so bypasses the package `exports` map, and
      // some presentations (e.g. `iris`) have no root-level file and live only
      // behind that map (dist/esm/iris.mjs). Letting Vite resolve the subpath
      // via exports keeps every presentation working.
      {
        find: /^@remotion\/transitions$/,
        replacement: path.resolve(__dirname, "node_modules/@remotion/transitions"),
      },
    ],
  },
  server: {
    port: 5173,
    fs: {
      allow: [
        path.resolve(__dirname, ".."),
      ],
    },
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
