import { convergentPosts } from "./blog/convergentPosts";
import { distributionPosts } from "./blog/distributionPosts";
import { documentTypePosts } from "./blog/documentTypePosts";
import { pipelinePosts } from "./blog/pipelinePosts";
import type { BlogPost } from "./seoTypes";

/**
 * PDF2Video's own blog — for SEO/marketing on this domain specifically.
 *
 * Deliberately NOT a copy of any blog2video.app article: the whole reason this
 * deployment exists as a separate build is to avoid serving duplicate content
 * across two indexable domains. Everything here is written fresh, about
 * document and PDF-to-video workflows, in PDF2Video's own voice. See
 * ../../frontend/src/content/blogPosts.ts for the shape/schema to follow, not
 * the content to copy.
 *
 * Four clusters, split by what each is for rather than by topic:
 *
 *   pipelinePosts     — the "convert pdf to video" family. Exact intent, thin
 *                       SERP, small volume. The conversion floor.
 *   convergentPosts   — much larger adjacent queries (pdf to powerpoint, pdf
 *                       summarizer, pdf to audio, embed video in pdf, video to
 *                       pdf). Each answers the question actually asked before
 *                       repositioning. The traffic ceiling.
 *   documentTypePosts — one post per shape a document arrives in. Long tail,
 *                       high intent, names an audience.
 *   distributionPosts — craft and distribution. Earns links, and forms the
 *                       interior of the internal-link graph.
 *
 * Ordering here does not matter — Blog.tsx and the prerenderer both sort by
 * publishedAt.
 */
export const blogPosts: BlogPost[] = [
  ...pipelinePosts,
  ...convergentPosts,
  ...documentTypePosts,
  ...distributionPosts,
];
