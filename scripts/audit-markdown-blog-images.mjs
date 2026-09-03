import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(root, "frontend/public/blog");
const mdDir = path.join(root, "blogs");
const existing = new Set(fs.existsSync(blogDir) ? fs.readdirSync(blogDir) : []);

const missing = [];
for (const f of fs.readdirSync(mdDir).filter((x) => x.endsWith(".md"))) {
  const slug = f.replace(/\.md$/, "");
  const c = fs.readFileSync(path.join(mdDir, f), "utf8");
  const hero = c.match(/hero_image:\s*"([^"]+)"/)?.[1];
  const dedicated = `blog-cover-${slug}.png`;
  const heroFile = hero?.replace(/^\/blog\//, "").replace(/^blog\//, "");
  const ok =
    existing.has(dedicated) || (heroFile && existing.has(heroFile));
  if (!ok) missing.push({ slug, hero: hero ?? "NONE" });
}

console.log(JSON.stringify({ markdownTotal: fs.readdirSync(mdDir).filter((x) => x.endsWith(".md")).length, missing }, null, 2));
