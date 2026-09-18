import { blogPosts } from "./blogPosts";
import type { BlogPost } from "./seoTypes";

// Lightweight relevance engine used to interlink every blog post with its most
// relevant siblings. This powers both the prerendered SEO HTML (build-seo.ts)
// and the hydrated React sidebar so the crawlable internal-link graph matches
// what users see. See [[project-seo-page-architecture]].

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "for", "in", "on", "at",
  "by", "with", "from", "into", "your", "you", "our", "we", "it", "its", "is",
  "are", "was", "were", "be", "been", "how", "what", "why", "when", "who",
  "that", "this", "these", "those", "as", "if", "so", "than", "then", "not",
  "no", "can", "will", "just", "about", "using", "use", "make", "made",
  "get", "getting", "guide", "post", "posts", "video", "videos", "blog", "blogs",
]);

function tokenize(post: BlogPost): Set<string> {
  const text = [
    post.title,
    post.heroTitle,
    post.primaryKeyword,
    post.keywordVariant,
    post.category,
  ]
    .join(" ")
    .toLowerCase();
  const words = text.match(/[a-z0-9]+/g) ?? [];
  return new Set(words.filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

const tokenCache = new Map<string, Set<string>>();
function getTokens(post: BlogPost): Set<string> {
  let tokens = tokenCache.get(post.slug);
  if (!tokens) {
    tokens = tokenize(post);
    tokenCache.set(post.slug, tokens);
  }
  return tokens;
}

/**
 * Returns the blog posts most relevant to `post`, ranked by:
 *   1. editorially curated links in `relatedPaths` (highest priority),
 *   2. posts that curate a link to `post` (so curated links run both ways),
 *   3. shared category,
 *   4. keyword/title token overlap.
 * Deterministic: ties break on a stable per-pair hash, so prerender output is
 * stable without funnelling every tie to the alphabetically first slugs.
 */
function pairHash(a: string, b: string): number {
  let hash = 2166136261;
  const key = `${a}|${b}`;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getRelatedBlogPosts(post: BlogPost, limit = 4): BlogPost[] {
  const ownPath = `/blogs/${post.slug}`;
  const baseTokens = getTokens(post);
  const curatedSlugs = new Set(
    post.relatedPaths
      .filter((path) => path.startsWith("/blogs/"))
      .map((path) => path.replace("/blogs/", ""))
  );
  const baseCategory = post.category.toLowerCase();

  return blogPosts
    .filter((entry) => entry.slug !== post.slug)
    .map((entry) => {
      const entryTokens = getTokens(entry);
      let overlap = 0;
      for (const token of entryTokens) {
        if (baseTokens.has(token)) overlap += 1;
      }
      const sameCategory = entry.category.toLowerCase() === baseCategory ? 3 : 0;
      const curated = curatedSlugs.has(entry.slug) ? 100 : 0;
      const reciprocal = entry.relatedPaths.includes(ownPath) ? 50 : 0;
      return { entry, score: curated + reciprocal + sameCategory + overlap, tie: pairHash(post.slug, entry.slug) };
    })
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .slice(0, limit)
    .map((scored) => scored.entry);
}
