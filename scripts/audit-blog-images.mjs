import fs from "fs";

const content = fs.readFileSync("frontend/src/content/blogPosts.ts", "utf8");
const existing = new Set(fs.readdirSync("frontend/public/blog"));
const posts = [];

for (const block of content.split(/\n  \{/)) {
  const slug = block.match(/slug:\s*"([^"]+)"/)?.[1];
  if (!slug) continue;
  const heroImage = block.match(/heroImage:\s*"([^"]+)"/)?.[1] ?? null;
  const title = block.match(/title:\s*"([^"]+)"/)?.[1];
  const category = block.match(/category:\s*"([^"]+)"/)?.[1];
  posts.push({ slug, title, category, heroImage });
}

const noHero = posts.filter((p) => !p.heroImage);
const missingFile = posts.filter(
  (p) => p.heroImage && !existing.has(p.heroImage.replace("/blog/", ""))
);

console.log("Total posts:", posts.length);
console.log("No heroImage:", noHero.length);
noHero.forEach((p) => console.log(`  - ${p.slug}`));

console.log("Missing image file:", missingFile.length);
missingFile.forEach((p) => console.log(`  - ${p.slug} -> ${p.heroImage}`));

// Posts that would fall back to og-image
const fallback = posts.filter(
  (p) => !p.heroImage || !existing.has((p.heroImage || "").replace("/blog/", ""))
);
console.log("Would use fallback:", fallback.length);
fallback.forEach((p) => console.log(`  - ${p.slug} | ${p.category}`));

// Posts without a slug-dedicated cover image file
const generic = posts.filter((p) => {
  const dedicated = `blog-cover-${p.slug}.png`;
  const hasDedicated = existing.has(dedicated);
  const usesDedicated = p.heroImage === `/blog/${dedicated}`;
  return !hasDedicated && !usesDedicated;
});
console.log("\nNo dedicated cover file (blog-cover-{slug}.png):", generic.length);
generic.forEach((p) => console.log(`  - ${p.slug} -> ${p.heroImage}`));

// Group by shared heroImage
const byImage = new Map();
for (const p of posts) {
  const key = p.heroImage || "NONE";
  if (!byImage.has(key)) byImage.set(key, []);
  byImage.get(key).push(p.slug);
}
console.log("\nShared cover usage:");
for (const [img, slugs] of [...byImage.entries()].sort((a, b) => b[1].length - a[1].length)) {
  if (slugs.length > 1) console.log(`  ${img} (${slugs.length}): ${slugs.join(", ")}`);
}

// Export JSON for automation
fs.writeFileSync(
  "scripts/blog-image-audit.json",
  JSON.stringify({ posts, noHero, missingFile, generic }, null, 2)
);
console.log("\nWrote scripts/blog-image-audit.json");
