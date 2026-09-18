import { blogPosts } from "./blogPosts";
import type { BlogPost } from "./seoTypes";

// Topic clusters give every blog post a guaranteed place in the internal-link
// graph: each post links to its cluster hub and to the previous and next post in
// its cluster (wrapping around), so no post is left without inbound links.
// Clusters match on slug; a post belongs to the first cluster that matches.

interface TopicCluster {
  id: string;
  name: string;
  hubPath: string;
  hubLabel: string;
  match: RegExp;
}

const clusters: TopicCluster[] = [
  {
    id: "stickman",
    name: "Stickman films & explainers",
    hubPath: "/templates/stickman_2",
    hubLabel: "Make your own stickman animation",
    match: /stickman|stick-figure/,
  },
  {
    id: "assistants",
    name: "ChatGPT, Claude & AI assistants",
    hubPath: "/blogs/can-chatgpt-make-videos",
    hubLabel: "Can ChatGPT make videos?",
    match: /mcp-server|chatgpt|claude|gemini-chat|notebooklm/,
  },
  {
    id: "meetings",
    name: "Meeting recordings to video",
    hubPath: "/blogs/zoom-recording-to-summary-video",
    hubLabel: "Turn a meeting recording into a summary video",
    match: /recording-to/,
  },
  {
    id: "updates",
    name: "Product updates",
    hubPath: "/blogs/four-new-tricks",
    hubLabel: "The latest Blog2Video update",
    match: /update|just-shipped|whats-new|new-template|four-new-tricks|biggest-update|now-lets|end-of-video|duration-control|50-languages|custom-templates-for-brands|free-stock-visualizer/,
  },
  {
    id: "finance",
    name: "Finance creators",
    hubPath: "/for-finance-publishers",
    hubLabel: "Blog2Video for finance publishers",
    match: /finance|bloomberg|market-breakdown/,
  },
  {
    id: "newsletters",
    name: "Substack, Medium & newsletters",
    hubPath: "/for-newsletters",
    hubLabel: "Blog2Video for newsletters",
    match: /substack|newsletter|medium/,
  },
  {
    id: "authors",
    name: "Video for authors",
    hubPath: "/blogs/author-video-without-camera",
    hubLabel: "The author's guide to video without a camera",
    match: /author|book/,
  },
  {
    id: "agencies",
    name: "Agencies & templates",
    hubPath: "/custom-branded-video-templates",
    hubLabel: "Custom branded video templates",
    match: /agency|template|branded|video-editor/,
  },
  {
    id: "comparisons",
    name: "Tool comparisons",
    hubPath: "/blogs/blog-to-video-tools-compared",
    hubLabel: "Blog to video tools compared",
    match: /-vs-|compared|comparison|alternative|official-site|ai-video-generator/,
  },
  {
    id: "documents",
    name: "PDFs, slides & documents",
    hubPath: "/pdf-to-video",
    hubLabel: "PDF to video",
    match: /pdf|ppt|powerpoint|docx|research-papers|documentation|devrel|diagrams|link-into/,
  },
  {
    id: "growth",
    name: "YouTube, SEO & distribution",
    hubPath: "/blog-to-youtube-video",
    hubLabel: "Turn a blog post into a YouTube video",
    match: /youtube|seo|backlink|headline|title|thumbnail|description|runtime|carousel|linkedin|promote|bloghub|blogging|faceless|video-length/,
  },
  {
    id: "guides",
    name: "Blog to video guides",
    hubPath: "/blog-to-video",
    hubLabel: "Blog to video",
    match: /.*/,
  },
];

export interface ClusterNav {
  name: string;
  hubPath: string;
  hubLabel: string;
  previous: BlogPost;
  next: BlogPost;
}

const membersByCluster = new Map<string, BlogPost[]>();
const clusterBySlug = new Map<string, TopicCluster>();
for (const post of blogPosts) {
  const cluster = clusters.find((entry) => entry.match.test(post.slug))!;
  clusterBySlug.set(post.slug, cluster);
  const members = membersByCluster.get(cluster.id) ?? [];
  members.push(post);
  membersByCluster.set(cluster.id, members);
}
// Oldest first so "next" reads forward in time; slug breaks same-day ties.
for (const members of membersByCluster.values()) {
  members.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.slug.localeCompare(b.slug));
}

export function getClusterNav(post: BlogPost): ClusterNav | null {
  const cluster = clusterBySlug.get(post.slug);
  if (!cluster) return null;
  const members = membersByCluster.get(cluster.id)!;
  if (members.length < 2) return null;
  const index = members.findIndex((entry) => entry.slug === post.slug);
  return {
    name: cluster.name,
    hubPath: cluster.hubPath === `/blogs/${post.slug}` ? "/blogs" : cluster.hubPath,
    hubLabel: cluster.hubPath === `/blogs/${post.slug}` ? "All articles" : cluster.hubLabel,
    previous: members[(index - 1 + members.length) % members.length],
    next: members[(index + 1) % members.length],
  };
}
