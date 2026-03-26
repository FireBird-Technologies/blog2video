# Add the Before/After Blog Post to the Site

## What to do

### 1. Upload the video to YouTube
- Export `ShowcaseBeforeAfter` from Remotion Studio
- Upload to YouTube with the title and description from `prompt-showcase-video.md`
- Copy the YouTube video ID (e.g. `dQw4w9WgXcQ` from the URL)

### 2. Add a cover image
- Drop a 1200×630 PNG into `frontend/public/blog/`
- Suggested filename: `blog-cover-before-after.png`
- Simple design: red half (wall of text, "45 min") vs green half (video frame, "3 min")

### 3. Paste this entry into `frontend/src/content/blogPosts.ts`

Open the file and add this object to the `blogPosts` array (at the top, so it shows first):

```ts
{
  slug: "blog-to-video-before-after",
  title: "Blog to Video: Before vs After",
  description:
    "See exactly what changes when you stop manually turning blog posts into videos and use Blog2Video instead. 45 minutes down to 3.",
  category: "Workflow",
  heroImage: "/blog/blog-cover-before-after.png",
  heroImageAlt: "Split screen: wall of text on the left taking 45 minutes, polished video on the right in 3 minutes.",
  publishedAt: "2026-03-23",
  readTime: "4 min read",
  heroEyebrow: "Before & After",
  heroTitle: "What it actually looks like to turn a blog into a video in 3 minutes",
  heroDescription:
    "The manual workflow — read, script, record, edit — takes 45 minutes every time. Blog2Video replaces that with three steps: paste a URL, pick a template and voice, hit generate.",
  primaryKeyword: "blog to video",
  keywordVariant: "turn blog post into video",
  relatedPaths: [
    "/how-to-turn-a-blog-post-into-a-video",
    "/blog-to-video",
    "/blog-to-youtube-video",
  ],
  sections: [
    {
      heading: "The manual way costs you 45 minutes per post",
      paragraphs: [
        "Every blog-to-video workflow starts the same way: open the article, read it end to end, figure out which parts translate to narration, write a script from scratch, record yourself or hire someone, then spend time in an editor trimming pauses and syncing audio to slides.",
        "Add it up and you're looking at 8 minutes reading, 15 scripting, 10 recording, and 12 editing. That's 45 minutes of active work per post — before you've even thought about thumbnails, captions, or distribution.",
        "For a team publishing two or three posts a week, that's a part-time job just to produce the video layer. Most teams skip video entirely or outsource it at a cost that makes the whole exercise hard to justify.",
      ],
      bullets: [
        "Read article: ~8 min",
        "Write video script: ~15 min",
        "Record voiceover: ~10 min",
        "Edit & export: ~12 min",
        "Total: 45+ min per post",
      ],
    },
    {
      heading: "Three steps replace the entire workflow",
      paragraphs: [
        "Blog2Video compresses all of that into three interactions. Step one is pasting your blog URL — Firecrawl extracts the content automatically, no copy-paste or reformatting required. Step two is picking a template and a voice from the ElevenLabs library, with a live preview before you commit. Step three is hitting generate.",
        "The tool handles scripting, narration, scene structure, and timing. The editor opens when generation finishes, and you can adjust any scene, swap text, or change the voice before exporting. From URL to finished video takes under three minutes.",
      ],
      bullets: [
        "Step 1 — Paste URL (10 seconds)",
        "Step 2 — Select template & voice (20 seconds)",
        "Step 3 — Generate & export (~2 minutes)",
        "Total: under 3 minutes",
      ],
    },
    {
      heading: "Why the output quality holds up",
      paragraphs: [
        "The most common concern with automated video is that it will feel generic. Blog2Video avoids this because it uses the actual structure of your article as the scene blueprint. Each subheading becomes a scene, key points become on-screen callouts, and the narration follows the original argument rather than a summarised version of it.",
        "Template choices like Geometric Explainer, Nightfall, Matrix, and Newspaper are designed to match different content tones — technical, editorial, punchy, or clean. Choosing the right one takes a few seconds and makes the finished video feel intentional rather than auto-generated.",
      ],
      bullets: [
        "Article structure drives the scene order",
        "Narration follows your original argument",
        "Templates match the tone of the content",
        "ElevenLabs voices preview before you commit",
      ],
    },
    {
      heading: "Who this matters most for",
      paragraphs: [
        "The 15× speed improvement means different things depending on your publishing cadence. For a solo blogger it means you can add video to every post without it becoming a second job. For an SEO agency it means video becomes a standard deliverable, not an upsell. For a content team it means one person can handle the video layer across the whole editorial calendar.",
        "In every case the underlying math is the same: if the content is already written, the cost to produce the video drops from hours to minutes. That changes whether video is worth it at all.",
      ],
      bullets: [
        "Solo bloggers: add video to every post without extra hours",
        "SEO agencies: make video a standard deliverable",
        "Content teams: one person covers the whole calendar",
        "Technical writers: keep the detail, skip the production overhead",
      ],
    },
  ],
  faq: [
    {
      question: "Do I need to edit the blog post before pasting the URL?",
      answer:
        "No. Blog2Video uses Firecrawl to extract the content directly from the live URL. The article just needs to be publicly accessible.",
    },
    {
      question: "Can I use my own voice instead of an ElevenLabs preset?",
      answer:
        "Yes. You can clone your voice from a short audio sample or build a custom voice from the voice settings page before generating.",
    },
    {
      question: "How long does generation actually take?",
      answer:
        "Typically one to two minutes depending on article length and the template selected. You can watch the progress in real time on the generation screen.",
    },
    {
      question: "What video formats can I export?",
      answer:
        "16:9 for YouTube and LinkedIn, and 9:16 for TikTok and Instagram Reels. You pick the aspect ratio in step one before generation starts.",
    },
  ],
  distributionPlan: [
    {
      channel: "video",
      title: "Blog to Video in 3 Minutes (Before & After)",
      angle: "Before/after hook showing the 45-minute manual workflow vs the 3-step Blog2Video flow",
    },
    {
      channel: "site",
      title: "Blog to Video: Before vs After",
      angle: "SEO post targeting 'blog to video' with embedded YouTube video and step-by-step breakdown",
    },
    {
      channel: "substack",
      title: "I cut my blog-to-video time from 45 minutes to 3",
      angle: "First-person workflow story for content creator audience",
    },
    {
      channel: "medium",
      title: "The Before/After That Made Me Stop Manually Producing Videos",
      angle: "Relatable frustration-to-solution narrative for the content marketing audience",
    },
  ],
},
```

### 4. Embed the YouTube video (optional but recommended)

In `frontend/src/pages/BlogPostPage.tsx`, find the section that renders the `heroImage` and add an embed below it:

```tsx
{post.slug === "blog-to-video-before-after" && (
  <div style={{ margin: "32px 0", borderRadius: 12, overflow: "hidden", aspectRatio: "16/9" }}>
    <iframe
      width="100%"
      height="100%"
      src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
      title="Blog to Video Before After"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  </div>
)}
```

Replace `YOUR_VIDEO_ID` with the actual YouTube ID after upload.

---

That's it. The post will appear on `/blog/blog-to-video-before-after` automatically once the entry is saved.
