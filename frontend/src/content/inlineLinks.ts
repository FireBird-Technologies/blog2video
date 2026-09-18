import type { BlogPost } from "./seoTypes";

// Contextual in-body links for every blog post. Each rule maps anchor phrases to
// one destination; the first phrase occurrence in a post's paragraphs becomes a
// link. Shared by BlogPostPage and build-seo.ts so the crawlable HTML matches
// what readers see. See [[project-seo-page-architecture]].

interface InlineLinkRule {
  path: string;
  phrases: string[];
}

export interface TextSegment {
  text: string;
  href?: string;
}

const MAX_LINKS_PER_POST = 8;

const rules: InlineLinkRule[] = [
  // Core product workflows
  { path: "/pdf-to-video", phrases: ["pdf to video", "pdf into a video", "pdf into video", "turn a pdf", "convert a pdf"] },
  { path: "/url-to-video", phrases: ["url to video", "url into a video", "paste a url", "paste the url", "public url"] },
  { path: "/pptx-to-video", phrases: ["powerpoint to video", "pptx to video", "slide deck into a video", "turn a powerpoint"] },
  { path: "/docx-to-video", phrases: ["docx to video", "word document into a video", "word doc"] },
  { path: "/article-to-video", phrases: ["article to video", "article into a video", "articles into videos"] },
  { path: "/blog-to-youtube-video", phrases: ["blog to youtube", "blog post into a youtube video", "youtube channel"] },
  { path: "/blog-to-shorts", phrases: ["youtube shorts", "shorts, reels", "short-form video", "vertical video"] },
  { path: "/code-snippet-to-video", phrases: ["code snippets", "code blocks"] },
  { path: "/diagram-to-video", phrases: ["diagrams into video", "turn diagrams"] },
  { path: "/bulk-blog-to-video", phrases: ["whole archive", "entire archive", "in bulk", "back catalogue", "back catalog"] },
  { path: "/multilingual-video-generation", phrases: ["other languages", "multiple languages", "50+ languages", "any language"] },
  { path: "/ai-scene-editor", phrases: ["scene editor"] },
  { path: "/custom-branded-video-templates", phrases: ["custom templates", "custom template", "branded templates", "brand colours", "brand colors"] },
  { path: "/mcp-connector", phrases: ["mcp server", "mcp connector", "model context protocol"] },

  // Audiences
  { path: "/for-finance-publishers", phrases: ["finance publishers", "finance writers", "finance newsletter"] },
  { path: "/for-substack-writers", phrases: ["substack writers", "substack writer"] },
  { path: "/for-newsletters", phrases: ["newsletter writers", "newsletter operators"] },
  { path: "/for-educators", phrases: ["educators", "teachers", "course creators"] },
  { path: "/for-technical-writers", phrases: ["technical writers", "documentation teams"] },
  { path: "/for-researchers", phrases: ["researchers", "research papers"] },

  // Guides and pillar posts
  { path: "/blogs/how-to-turn-a-blog-post-into-a-video", phrases: ["turn a blog post into a video", "blog post into a video", "blog posts into videos"] },
  { path: "/blogs/how-to-repurpose-blog-content-into-videos", phrases: ["repurpose blog content", "repurposing blog content", "repurpose your blog"] },
  { path: "/blogs/content-repurposing-workflow-for-solo-founders", phrases: ["content repurposing", "repurposing workflow"] },
  { path: "/blogs/how-to-write-a-video-script-from-a-blog-post", phrases: ["video script", "write the script", "script from a blog"] },
  { path: "/blogs/how-to-use-ai-voiceover-for-blog-content", phrases: ["ai voiceover", "ai voice", "voiceover", "voice-over"] },
  { path: "/blogs/how-to-create-a-narrated-video-from-a-blog-post", phrases: ["narrated video", "narrated videos"] },
  { path: "/blogs/faceless-videos-for-writers-and-marketers", phrases: ["faceless video", "faceless videos", "without a camera", "without going on camera", "without being on camera"] },
  { path: "/blogs/ai-video-generators-that-are-not-slop", phrases: ["ai slop", "slop"] },
  { path: "/blogs/best-templates-for-explainer-videos", phrases: ["explainer videos", "explainer video", "templates for explainer"] },
  { path: "/blogs/blog-to-video-tools-compared", phrases: ["lumen5", "pictory", "invideo", "blog to video tools"] },
  { path: "/blogs/blog2video-vs-heygen", phrases: ["heygen"] },
  { path: "/blogs/blog2video-vs-veed", phrases: ["veed"] },
  { path: "/blogs/blog2video-vs-notebooklm", phrases: ["notebooklm"] },
  { path: "/blogs/blog2video-vs-seedance", phrases: ["seedance"] },
  { path: "/blogs/can-chatgpt-make-videos", phrases: ["sora", "veo", "generative video"] },
  { path: "/blogs/chatgpt-conversation-to-video", phrases: ["chatgpt conversation", "chatgpt chat"] },
  { path: "/blogs/claude-chat-to-video", phrases: ["claude chat", "claude conversation"] },
  { path: "/blogs/youtube-backlink", phrases: ["backlink", "backlinks"] },
  { path: "/blogs/video-seo-ranking-traffic-blog2video", phrases: ["video seo", "video results in google", "videos tab"] },
  { path: "/blogs/blogs-with-videos", phrases: ["embed the video", "embedded video", "add video to your blog", "video to your blog"] },
  { path: "/blogs/what-is-a-blog-video", phrases: ["blog video", "video blog"] },
  { path: "/blogs/blog-to-youtube-strategy-for-written-first-creators", phrases: ["written-first creators", "written-first creator"] },
  { path: "/blogs/how-to-write-an-seo-youtube-description", phrases: ["youtube description", "video description"] },
  { path: "/blogs/how-to-write-thumbnail-text-that-gets-clicks", phrases: ["thumbnail text", "thumbnail"] },
  { path: "/blogs/how-long-will-my-video-be-estimate-runtime-from-a-script", phrases: ["video length", "runtime", "words per minute"] },
  { path: "/blogs/headline-score", phrases: ["headline score", "headline analyzer", "headlines"] },
  { path: "/blogs/youtube-title-score-checker", phrases: ["youtube title", "video title"] },
  { path: "/blogs/linkedin-carousel-creator", phrases: ["linkedin carousel", "carousels"] },
  { path: "/blogs/how-to-increase-your-audience-on-linkedin", phrases: ["linkedin audience", "grow on linkedin", "linkedin followers", "linkedin reach"] },
  { path: "/blogs/ai-ppt-maker-from-pdf", phrases: ["ai ppt", "presentation from a pdf", "slides from a pdf"] },
  { path: "/blogs/how-to-turn-a-powerpoint-into-a-video", phrases: ["powerpoint", "slide deck", "slide decks"] },
  { path: "/blogs/how-to-convert-research-papers-into-explainer-videos", phrases: ["research paper", "whitepaper", "whitepapers"] },
  { path: "/blogs/how-devrel-teams-can-turn-docs-into-videos", phrases: ["devrel", "developer relations", "product docs"] },
  { path: "/blogs/how-to-turn-documentation-into-product-walkthrough-videos", phrases: ["walkthrough video", "product walkthrough", "documentation into video"] },
  { path: "/blogs/how-to-convert-a-blog-archive-into-videos", phrases: ["blog archive", "old posts", "archive of posts"] },
  { path: "/blogs/content-with-no-second-life", phrases: ["second life", "disappears after", "half life"] },
  { path: "/blogs/blogging-is-not-dead-authentic-writing-2026", phrases: ["blogging is dead", "authentic writing"] },
  { path: "/blogs/where-to-promote-your-writing-2026", phrases: ["promote your writing", "where to promote", "distribution channels"] },
  { path: "/blogs/bloghub-product-hunt-for-blogs", phrases: ["bloghub"] },
  { path: "/blogs/programmatic-video-generation-for-content-marketers", phrases: ["programmatic video", "content marketers", "content marketing"] },
  { path: "/blogs/agency-video-deliverable", phrases: ["agencies", "retainer", "client work"] },
  { path: "/blogs/blog2video-vs-video-editor", phrases: ["video editor", "hiring an editor", "freelance editor"] },
  { path: "/blogs/how-to-use-an-ai-scene-editor", phrases: ["edit a scene", "edit individual scenes", "scene by scene"] },
  { path: "/blogs/how-we-make-custom-branded-video-templates", phrases: ["template designers", "design system", "how templates are made"] },
  { path: "/blogs/video-editors-generate-branded-templates-instantly", phrases: ["video editors", "motion designers"] },
  { path: "/blogs/translate-blog-to-video-in-any-language", phrases: ["translate your", "translated video", "translate a blog"] },
  { path: "/blogs/video-duration-control", phrases: ["video duration", "control the length", "how long the video"] },
  { path: "/blogs/automatic-call-to-action-end-of-video", phrases: ["call to action"] },
  { path: "/blogs/blog2video-embed-preview-no-render-needed", phrases: ["preview link", "shareable preview", "without rendering"] },
  { path: "/blogs/zoom-recording-to-summary-video", phrases: ["zoom recording", "zoom call", "meeting recording"] },
  { path: "/blogs/loom-recording-to-summary-video", phrases: ["loom"] },
  { path: "/blogs/blog2video-official-site-vs-copycats", phrases: ["official site", "copycat", "copycats"] },

  // Substack, Medium and newsletters
  { path: "/blogs/how-to-grow-your-substack-newsletter", phrases: ["grow your substack", "grow a substack", "substack growth", "subscriber growth"] },
  { path: "/blogs/substack-video-70-percent-more-subscribers", phrases: ["new subscribers", "more subscribers", "paid subscribers"] },
  { path: "/blogs/how-much-is-my-substack-newsletter-worth", phrases: ["substack worth", "newsletter worth", "valuation"] },
  { path: "/blogs/newsletter-valuation-multiples-explained", phrases: ["revenue multiple", "valuation multiple", "multiples"] },
  { path: "/blogs/newsletter-substack-algorithm", phrases: ["substack algorithm", "substack notes", "recommendations"] },
  { path: "/blogs/substack-newsletter-to-video-workflow", phrases: ["substack post", "substack newsletter", "substack posts", "substack issue"] },
  { path: "/blogs/how-are-medium-earnings-calculated", phrases: ["medium partner program", "medium earnings", "medium members"] },
  { path: "/blogs/medium-post-to-video-workflow", phrases: ["medium post", "medium article", "on medium"] },
  { path: "/blogs/newsletter-best-newsletter-is-a-video", phrases: ["newsletter into a video", "newsletter as a video", "best newsletter"] },
  { path: "/blogs/why-finance-newsletters-are-switching-to-blog2video", phrases: ["finance newsletters", "market commentary", "investment research"] },
  { path: "/blogs/newsletter-bloomberg-aesthetic", phrases: ["bloomberg"] },

  // Authors
  { path: "/blogs/author-video-without-camera", phrases: ["nonfiction authors", "your book", "nonfiction"] },
  { path: "/blogs/author-book-launch-video", phrases: ["book launch", "launch video"] },

  // Stickman films and explainers
  { path: "/blogs/sisyphus-stickman-animation", phrases: ["sisyphus", "the boulder"] },
  { path: "/blogs/ship-of-theseus-stickman-animation", phrases: ["ship of theseus", "every plank"] },
  { path: "/blogs/prometheus-stickman-animation", phrases: ["prometheus"] },
  { path: "/blogs/icarus-stickman-animation", phrases: ["icarus"] },
  { path: "/blogs/pandoras-box-stickman-animation", phrases: ["pandora"] },
  { path: "/blogs/narcissus-stickman-animation", phrases: ["narcissus"] },
  { path: "/blogs/trojan-horse-stickman-animation", phrases: ["trojan horse", "troy"] },
  { path: "/blogs/persephone-stick-figure-animation", phrases: ["persephone", "hades"] },
  { path: "/blogs/robin-hood-stickman-animation", phrases: ["robin hood"] },
  { path: "/blogs/sword-in-the-stone-stickman-animation", phrases: ["excalibur", "sword in the stone"] },
  { path: "/blogs/matrix-red-dress-stickman", phrases: ["red dress", "agent smith"] },
  { path: "/blogs/neo-first-dodge-stickman", phrases: ["bullet-time", "bullet time"] },
  { path: "/blogs/neo-stops-ai-slop-stickman", phrases: ["ai slop duel", "neo vs"] },
  { path: "/blogs/star-wars-stickman-parody", phrases: ["star wars", "lightsaber"] },
  { path: "/blogs/american-psycho-stickman-parody", phrases: ["american psycho", "business card"] },
  { path: "/blogs/reservoir-dogs-stickman-parody", phrases: ["reservoir dogs"] },
  { path: "/blogs/pulp-fiction-stickman-parody", phrases: ["pulp fiction", "briefcase"] },
  { path: "/blogs/breaking-bad-stickman-parody", phrases: ["breaking bad"] },
  { path: "/blogs/drive-title-sequence-stickman", phrases: ["title sequence"] },
  { path: "/blogs/2008-financial-crisis-stickman-explainer", phrases: ["2008 crash", "financial crisis", "subprime"] },
  { path: "/blogs/the-grind-stickman-animation", phrases: ["the grind"] },
  { path: "/blogs/stickman-v4-jetpack-update", phrases: ["jetpack"] },
  { path: "/templates/stickman_2", phrases: ["stickman template", "stick figure animation", "stickman animation"] },
  { path: "/blogs/how-we-make-custom-branded-video-templates", phrases: ["remotion"] },
];

interface CompiledRule {
  path: string;
  pattern: RegExp;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest phrase first so "custom templates" beats "templates" within a rule.
const compiledRules: CompiledRule[] = rules.map((rule) => {
  const alternatives = [...rule.phrases]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  return { path: rule.path, pattern: new RegExp(`(?<![\\w-])(${alternatives})(?![\\w-])`, "i") };
});

export interface LinkedSection {
  paragraphs: TextSegment[][];
}

/**
 * Splits each paragraph of the post into text and link segments. Each
 * destination is linked at most once per post, a paragraph gets at most one
 * inline link, the post's own URL and the section's own CTA are skipped, and
 * the total is capped so paragraphs never read like a link farm. Deterministic
 * so the prerendered HTML is stable between builds.
 */
export function getLinkedSections(post: BlogPost): LinkedSection[] {
  const ownPath = `/blogs/${post.slug}`;
  const used = new Set<string>([ownPath]);
  let total = 0;

  return post.sections.map((section) => ({
    paragraphs: section.paragraphs.map((paragraph) => {
      if (total >= MAX_LINKS_PER_POST) return [{ text: paragraph }];

      let best: { index: number; length: number; path: string } | null = null;
      for (const rule of compiledRules) {
        if (used.has(rule.path) || rule.path === section.ctaPath) continue;
        const match = rule.pattern.exec(paragraph);
        if (match && (!best || match.index < best.index)) {
          best = { index: match.index, length: match[0].length, path: rule.path };
        }
      }
      if (!best) return [{ text: paragraph }];

      used.add(best.path);
      total += 1;
      const segments: TextSegment[] = [];
      if (best.index > 0) segments.push({ text: paragraph.slice(0, best.index) });
      segments.push({ text: paragraph.slice(best.index, best.index + best.length), href: best.path });
      if (best.index + best.length < paragraph.length) {
        segments.push({ text: paragraph.slice(best.index + best.length) });
      }
      return segments;
    }),
  }));
}
