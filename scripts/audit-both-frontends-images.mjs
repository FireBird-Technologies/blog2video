import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const frontends = [
  {
    name: "blog2video",
    contentFiles: [
      "frontend/src/content/blogPosts.ts",
      "frontend/src/content/helpPosts.ts",
    ],
    publicDir: "frontend/public",
  },
  {
    name: "pdf2video",
    contentFiles: [
      "frontend-pdf2video/src/content/blogPosts.ts",
      "frontend-pdf2video/src/content/blog/pipelinePosts.ts",
      "frontend-pdf2video/src/content/blog/convergentPosts.ts",
      "frontend-pdf2video/src/content/blog/documentTypePosts.ts",
      "frontend-pdf2video/src/content/blog/distributionPosts.ts",
    ],
    publicDir: "frontend-pdf2video/public",
  },
];

function resolveHero(publicDir, hero) {
  if (hero.startsWith("/blog/")) {
    return path.join(publicDir, "blog", hero.replace(/^\/blog\//, ""));
  }
  if (hero.startsWith("/")) {
    return path.join(publicDir, hero.replace(/^\//, ""));
  }
  return path.join(publicDir, hero);
}

function extractPosts(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const slugRe = /slug:\s*"([^"]+)"/g;
  const slugs = [];
  let m;
  while ((m = slugRe.exec(text))) {
    slugs.push({ slug: m[1], idx: m.index });
  }
  const posts = [];
  for (let i = 0; i < slugs.length; i++) {
    const block = text.slice(slugs[i].idx, slugs[i + 1]?.idx ?? text.length);
    const heroM = block.match(/heroImage:\s*"([^"]+)"/);
    const titleM = block.match(/title:\s*"([^"]+)"/);
    const descM = block.match(/description:\s*\n\s*"([^"]+)"/);
    posts.push({
      slug: slugs[i].slug,
      title: titleM?.[1] ?? slugs[i].slug,
      description: descM?.[1] ?? "",
      heroImage: heroM?.[1] ?? null,
      source: path.basename(filePath),
    });
  }
  return posts;
}

for (const fe of frontends) {
  const publicDir = path.join(root, fe.publicDir);
  const blogDir = path.join(publicDir, "blog");
  if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });

  const seen = new Set();
  const noHero = [];
  const missing = [];

  for (const rel of fe.contentFiles) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const post of extractPosts(file)) {
      if (seen.has(post.slug)) continue;
      seen.add(post.slug);
      if (!post.heroImage) {
        noHero.push({ ...post, heroImage: `/blog/blog-cover-${post.slug}.png` });
        continue;
      }
      const fp = resolveHero(publicDir, post.heroImage);
      if (!fs.existsSync(fp)) {
        missing.push({ ...post, dest: fp });
      }
    }
  }

  console.log(`\n=== ${fe.name} ===`);
  console.log(`Posts without heroImage: ${noHero.length}`);
  noHero.forEach((p) => console.log(`  ${p.slug} (${p.source})`));
  console.log(`Posts with missing file: ${missing.length}`);
  missing.forEach((p) => console.log(`  ${p.slug} -> ${p.heroImage}`));

  fs.writeFileSync(
    path.join(root, `scripts/audit-${fe.name}-missing-images.json`),
    JSON.stringify({ noHero, missing }, null, 2),
  );
}
