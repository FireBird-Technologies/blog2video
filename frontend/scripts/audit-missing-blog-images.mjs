import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.join(__dirname, "../public/blog");
const publicDir = path.join(__dirname, "../public");
const contentDir = path.join(__dirname, "../src/content");
const files = ["blogPosts.ts", "helpPosts.ts"];

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
const noHero = [];

for (const basename of files) {
  const file = path.join(contentDir, basename);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const slugRe = /slug:\s*"([^"]+)"/g;
  const slugs = [];
  let m;
  while ((m = slugRe.exec(text))) {
    slugs.push({ slug: m[1], idx: m.index });
  }
  for (let i = 0; i < slugs.length; i++) {
    const start = slugs[i].idx;
    const end = slugs[i + 1]?.idx ?? text.length;
    const block = text.slice(start, end);
    const heroM = block.match(/heroImage:\s*"([^"]+)"/);
    const slug = slugs[i].slug;
    if (!heroM) {
      noHero.push({ slug, file: basename });
      continue;
    }
    const hero = heroM[1];
    const fp = resolveHero(hero);
    if (!fs.existsSync(fp)) {
      missing.push({ slug, heroImage: hero, file: basename });
    }
  }
}

console.log(JSON.stringify({ missing, noHero }, null, 2));
