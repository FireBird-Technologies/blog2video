import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogPostsFile = path.join(__dirname, "../src/content/blogPosts.ts");
let text = fs.readFileSync(blogPostsFile, "utf8");

const slugRe = /slug:\s*"([^"]+)"/g;
const slugs = [];
let m;
while ((m = slugRe.exec(text))) {
  slugs.push({ slug: m[1], idx: m.index });
}

let updated = 0;
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
    console.warn(`Could not find category for ${slug}`);
    continue;
  }

  const insert = `${categoryM[1]}    heroImage: "/blog/blog-cover-${slug}.png",\n    heroImageAlt:\n      "${alt.replace(/"/g, '\\"')}",\n`;
  const newBlock = block.replace(categoryM[0], insert);
  text = text.slice(0, start) + newBlock + text.slice(end);
  updated++;
}

fs.writeFileSync(blogPostsFile, text);
console.log(`Updated ${updated} posts with heroImage fields.`);
