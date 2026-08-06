import fs from "fs";
import path from "path";

const blogDir = "frontend/public/blog";
const existing = new Set(fs.readdirSync(blogDir));
const content = fs.readFileSync("frontend/src/content/blogPosts.ts", "utf8");

const posts = [];
for (const block of content.split(/\n  \{/)) {
  const slug = block.match(/slug:\s*"([^"]+)"/)?.[1];
  if (!slug) continue;
  const hero = block.match(/heroImage:\s*"([^"]+)"/)?.[1] ?? null;
  const title = block.match(/title:\s*"([^"]+)"/)?.[1] ?? slug;
  posts.push({ slug, hero, title });
}

const needCover = posts.filter((p) => {
  const dedicated = `blog-cover-${p.slug}.png`;
  const heroFile = p.hero?.replace("/blog/", "");
  const hasDedicated = existing.has(dedicated);
  const hasHero = heroFile && existing.has(heroFile);
  return !hasDedicated && !hasHero;
});

console.log("blogPosts.ts total:", posts.length);
console.log("Need cover image:", needCover.length);
needCover.forEach((p) => console.log(" ", p.slug));

const mdDir = "blogs";
if (fs.existsSync(mdDir)) {
  const mdMissing = [];
  for (const f of fs.readdirSync(mdDir).filter((x) => x.endsWith(".md"))) {
    const slug = f.replace(".md", "");
    const c = fs.readFileSync(path.join(mdDir, f), "utf8");
    const hero = c.match(/hero_image:\s*"([^"]+)"/)?.[1];
    const dedicated = `blog-cover-${slug}.png`;
    const heroFile = hero?.replace(/^\/blog\//, "").replace(/^blog\//, "");
    const ok =
      existing.has(dedicated) || (heroFile && existing.has(heroFile));
    if (!ok) mdMissing.push({ slug, hero: hero ?? "NONE" });
  }
  console.log("\nMarkdown blogs missing cover:", mdMissing.length);
  mdMissing.forEach((m) => console.log(" ", m.slug, m.hero));
}

fs.writeFileSync(
  "scripts/blog-image-audit.json",
  JSON.stringify({ needCover, generatedAt: new Date().toISOString() }, null, 2),
);
