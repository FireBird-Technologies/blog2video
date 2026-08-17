import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets =
  "C:/Users/arsla/.cursor/projects/c-Users-arsla-OneDrive-Desktop-projects-blog2video-seo/assets";

const targets = [
  {
    name: "blog2video",
    dir: path.join(root, "frontend/public/blog"),
    slugs: [
      "where-to-promote-your-writing-2026",
      "blog2video-august-2026-update",
      "best-ai-tools-for-substack-writers",
      "blogging-is-not-dead-authentic-writing-2026",
    ],
  },
  {
    name: "pdf2video",
    dir: path.join(root, "frontend-pdf2video/public/blog"),
    slugs: [
      "pdf-to-video-ai-what-it-does-and-what-it-fakes",
      "free-pdf-to-video-tools-where-free-stops",
      "embed-a-video-in-a-pdf-or-invert-the-problem",
      "video-to-pdf-or-pdf-to-video",
      "pdf-to-audio-or-pdf-to-video",
      "you-extracted-the-text-from-your-pdf-now-what",
    ],
  },
];

for (const t of targets) {
  fs.mkdirSync(t.dir, { recursive: true });
  for (const slug of t.slugs) {
    const name = `blog-cover-${slug}.png`;
    const src = path.join(assets, name);
    const dest = path.join(t.dir, name);
    if (!fs.existsSync(src)) {
      console.warn(`Missing asset: ${name}`);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`Copied ${name} -> ${t.name}`);
  }
}

// Ensure pdf2video has og fallback
const ogSrc = path.join(root, "frontend/public/og-image-v2.png");
const ogDest = path.join(root, "frontend-pdf2video/public/og-image-v2.png");
if (fs.existsSync(ogSrc) && !fs.existsSync(ogDest)) {
  fs.copyFileSync(ogSrc, ogDest);
  console.log("Copied og-image-v2.png to pdf2video");
}
