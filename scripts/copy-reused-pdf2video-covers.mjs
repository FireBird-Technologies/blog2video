import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const b2vBlog = path.join(root, "frontend/public/blog");
const pdfBlog = path.join(root, "frontend-pdf2video/public/blog");

fs.mkdirSync(pdfBlog, { recursive: true });

/** Reuse blog2video covers where topic is close enough for pdf2video posts */
const reuseMap = {
  "how-to-convert-a-pdf-into-a-video": "blog-cover-how-to-convert-pdf-into-video.png",
  "how-to-save-a-powerpoint-as-a-video": "blog-cover-how-to-pptx-to-video.png",
  "pdf-to-powerpoint-or-pdf-to-video": "blog-cover-ai-ppt-maker-from-pdf.png",
  "batch-converting-a-document-library-into-video": "blog-cover-how-to-bulk-blog-to-video.png",
  "research-paper-to-video-without-losing-the-nuance": "blog-cover-research-explainers.png",
  "pdf-summarizer-or-pdf-video-summary": "blog-cover-how-to-article-to-video.png",
  "technical-documentation-to-video-without-a-screen-recording": "blog-cover-documentation-walkthroughs.png",
  "pdf-to-youtube-the-upload-checklist": "blog-cover-youtube-shorts-strategy.png",
  "screen-recording-your-deck-versus-rendering-it": "blog-cover-how-to-pptx-to-video.png",
  "turn-a-pdf-into-a-video-slideshow": "blog-cover-how-to-make-a-pdf-into-a-video.png",
  "pdf-to-linkedin-video-that-survives-the-feed": "blog-cover-how-to-increase-your-audience-on-linkedin.png",
  "document-video-seo-what-actually-gets-indexed": "blog-cover-video-seo-ranking-traffic-blog2video.png",
  "captions-and-accessibility-for-document-video": "blog-cover-ai-voiceover-blog-content.png",
  "whitepaper-to-video-for-demand-generation": "blog-cover-programmatic-video-generation.png",
  "annual-report-to-video-for-stakeholders": "blog-cover-template-showcase-finance.png",
  "case-study-to-video-that-a-buyer-will-finish": "blog-cover-agency-video-deliverable.png",
  "ebook-to-video-series": "blog-cover-author-chapter-to-6-months-video.png",
  "lecture-notes-to-video-for-students-who-skip-lectures": "blog-cover-pdf-educators.png",
  "investor-deck-to-video-for-the-meetings-you-did-not-get": "blog-cover-newscast-template-for-students.png",
  "how-long-should-a-document-video-be": "blog-cover-how-long-will-my-video-be-estimate-runtime-from-a-script.png",
  "the-document-to-video-pipeline-end-to-end": "blog-cover-automated-video-from-url.png",
  "writing-narration-from-written-prose": "blog-cover-how-to-write-a-video-script-from-a-blog-post.png",
  "what-goes-on-the-slide-and-what-goes-in-the-voiceover": "blog-cover-narrated-video-blog-post.png",
  "measuring-whether-the-video-beat-the-pdf": "blog-cover-video-duration-control.png",
};

const audit = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/audit-pdf2video-missing-images.json"), "utf8"),
);

let copied = 0;
const stillNeed = [];

for (const post of audit.noHero) {
  const dest = path.join(pdfBlog, `blog-cover-${post.slug}.png`);
  const reuse = reuseMap[post.slug];
  if (reuse) {
    const src = path.join(b2vBlog, reuse);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      copied++;
      continue;
    }
  }
  stillNeed.push(post);
}

console.log(`Copied ${copied} reused covers to pdf2video`);
console.log(`Still need generation: ${stillNeed.length}`);
stillNeed.forEach((p) => console.log(" ", p.slug));

fs.writeFileSync(
  path.join(root, "scripts/pdf2video-still-need-images.json"),
  JSON.stringify(stillNeed, null, 2),
);
