import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir =
  "C:/Users/arsla/.cursor/projects/c-Users-arsla-OneDrive-Desktop-projects-blog2video-seo/assets";
const blogDir = path.join(__dirname, "../public/blog");
const publicDir = path.join(__dirname, "../public");
const contentDir = path.join(__dirname, "../src/content");

function resolveHero(hero) {
  if (hero.startsWith("/blog/")) {
    return path.join(blogDir, hero.replace(/^\/blog\//, ""));
  }
  if (hero.startsWith("/")) {
    return path.join(publicDir, hero.replace(/^\//, ""));
  }
  return path.join(publicDir, hero);
}

const missing = [];
for (const basename of ["blogPosts.ts", "helpPosts.ts"]) {
  const file = path.join(contentDir, basename);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const slugRe = /slug:\s*"([^"]+)"/g;
  const slugs = [];
  let m;
  while ((m = slugRe.exec(text))) slugs.push({ slug: m[1], idx: m.index });
  for (let i = 0; i < slugs.length; i++) {
    const block = text.slice(slugs[i].idx, slugs[i + 1]?.idx ?? text.length);
    const heroM = block.match(/heroImage:\s*"([^"]+)"/);
    if (!heroM) continue;
    const fp = resolveHero(heroM[1]);
    if (!fs.existsSync(fp)) {
      missing.push({ slug: slugs[i].slug, heroImage: heroM[1], dest: fp });
    }
  }
}

let copied = 0;
for (const item of missing) {
  const filename = path.basename(item.dest);
  const src = path.join(assetsDir, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, item.dest);
    copied++;
  }
}

const stillMissing = missing.filter((item) => !fs.existsSync(item.dest));
console.log(JSON.stringify({ copied, stillMissingCount: stillMissing.length, stillMissing }, null, 2));
