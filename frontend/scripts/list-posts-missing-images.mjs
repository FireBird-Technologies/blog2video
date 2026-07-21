import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogPostsFile = path.join(__dirname, "../src/content/blogPosts.ts");
const text = fs.readFileSync(blogPostsFile, "utf8");

const slugRe = /slug:\s*"([^"]+)"/g;
const slugs = [];
let m;
while ((m = slugRe.exec(text))) {
  slugs.push({ slug: m[1], idx: m.index });
}

const posts = [];
for (let i = 0; i < slugs.length; i++) {
  const start = slugs[i].idx;
  const end = slugs[i + 1]?.idx ?? text.length;
  const block = text.slice(start, end);
  const heroM = block.match(/heroImage:\s*"([^"]+)"/);
  if (heroM) continue;

  const slug = slugs[i].slug;
  const titleM = block.match(/title:\s*"([^"]+)"/);
  const descM = block.match(/description:\s*\n\s*"([^"]+)"/);
  posts.push({
    slug,
    title: titleM?.[1] ?? slug,
    description: descM?.[1] ?? "",
    heroImage: `/blog/blog-cover-${slug}.png`,
  });
}

console.log(JSON.stringify(posts, null, 2));
