import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  "frontend/src/content/blogPosts.ts",
  "frontend-pdf2video/src/content/blog/pipelinePosts.ts",
  "frontend-pdf2video/src/content/blog/convergentPosts.ts",
  "frontend-pdf2video/src/content/blog/documentTypePosts.ts",
  "frontend-pdf2video/src/content/blog/distributionPosts.ts",
];

let total = 0;

for (const rel of targets) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, "utf8");
  const slugRe = /slug:\s*"([^"]+)"/g;
  const slugs = [];
  let m;
  while ((m = slugRe.exec(text))) {
    slugs.push({ slug: m[1], idx: m.index });
  }

  for (let i = slugs.length - 1; i >= 0; i--) {
    const start = slugs[i].idx;
    const end = slugs[i + 1]?.idx ?? text.length;
    const block = text.slice(start, end);
    if (/heroImage:\s*"/.test(block)) continue;

    const slug = slugs[i].slug;
    const descM = block.match(/description:\s*\n\s*"([^"]+)"/);
    const alt = descM?.[1] ?? `Cover illustration for ${slug.replace(/-/g, " ")}.`;
    const categoryM = block.match(/(category:\s*"[^"]+",\n)/);
    if (!categoryM) {
      console.warn(`No category for ${slug} in ${rel}`);
      continue;
    }

    const insert = `${categoryM[1]}    heroImage: "/blog/blog-cover-${slug}.png",\n    heroImageAlt:\n      "${alt.replace(/"/g, '\\"')}",\n`;
    const newBlock = block.replace(categoryM[0], insert);
    text = text.slice(0, start) + newBlock + text.slice(end);
    total++;
  }

  fs.writeFileSync(file, text);
  console.log(`Updated ${rel}`);
}

console.log(`Added heroImage to ${total} posts.`);
