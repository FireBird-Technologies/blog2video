import type { BlogPost } from "./seoTypes";

/**
 * PDF2Video's own blog — for SEO/marketing on this domain specifically.
 *
 * Deliberately empty for now, and deliberately NOT a copy of any
 * blog2video.app article: the whole reason this deployment exists as a
 * separate build is to avoid serving duplicate content across two indexable
 * domains. New posts here should be written fresh, about document/PDF-to-video
 * workflows, in PDF2Video's own voice — see ../../frontend/src/content/blogPosts.ts
 * for the shape/schema to follow, not the content to copy.
 */
export const blogPosts: BlogPost[] = [];
