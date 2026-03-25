import { createFaq, createPage, templateBySlug } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

type AlternativeSeed = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryKeyword: string;
  keywordVariant: string;
  recommendedTemplate: string;
  proofPoints: string[];
  sections: { title: string; body: string[]; bullets?: string[] }[];
  relatedPaths: string[];
};

const seeds: AlternativeSeed[] = [
  {
    path: "/blog2video-vs-lumen5",
    title: "Blog2Video vs Lumen5",
    description:
      "Comparing Blog2Video and Lumen5 for turning blog posts and articles into videos. See which tool fits written-first content workflows better.",
    eyebrow: "Comparison",
    heroTitle: "Blog2Video vs Lumen5: which one actually fits a blog-first workflow",
    heroDescription:
      "Both tools turn written content into video. The difference is in how much the tool understands the source material and how much you still have to do manually.",
    primaryKeyword: "blog2video vs lumen5",
    keywordVariant: "lumen5 alternative",
    recommendedTemplate: "geometric-explainer",
    proofPoints: [
      "Blog2Video extracts content directly from a live URL — no copy-paste.",
      "ElevenLabs voice integration with per-voice preview before generation.",
      "Scene structure follows your article's actual headings, not a generic template.",
    ],
    sections: [
      {
        title: "How they handle source content differently",
        body: [
          "Lumen5 lets you paste text or a URL and then auto-suggests media from a stock library to pair with each line. The result often needs manual curation because the stock images rarely match the specific context of a technical or niche article.",
          "Blog2Video uses the source article's heading structure as the scene blueprint. Each subheading becomes a scene, key sentences become callouts, and the narration follows the original argument rather than a summarised version of it. The output stays closer to what you wrote.",
        ],
        bullets: [
          "Blog2Video: article structure → scene order (automated)",
          "Lumen5: text → stock media suggestions (manual curation required)",
          "Blog2Video narration follows the original article argument",
          "Blog2Video supports ElevenLabs voice cloning and custom voices",
        ],
      },
      {
        title: "When Lumen5 is the better fit",
        body: [
          "Lumen5 has a longer track record and a larger stock media library, which makes it a reasonable choice for marketing teams producing social clips that need visual variety and brand-kit consistency across a large team.",
          "If your primary output is short promotional clips with brand imagery rather than structured educational or informational video, Lumen5's visual-first approach may align better with that workflow.",
        ],
      },
      {
        title: "When Blog2Video is the better fit",
        body: [
          "Blog2Video is purpose-built for content that starts as writing. If you have blog posts, articles, or technical guides that need to become narrated explainer videos, Blog2Video preserves the original structure better and requires far less manual rework.",
          "The full flow — paste URL, pick template and voice, generate — takes under three minutes. No stock library browsing, no slide-by-slide adjustment, no re-scripting.",
        ],
        bullets: [
          "Better for: technical blogs, educational content, SEO-driven articles",
          "Better for: workflows where the writing quality is already high",
          "Better for: teams that want URL-in, video-out automation",
          "Better for: voice-first narration over stock-footage overlay",
        ],
      },
    ],
    relatedPaths: [
      "/blog-to-video",
      "/blog-to-youtube-video",
      "/for-technical-bloggers",
      "/pictory-alternative",
    ],
  },
  {
    path: "/blog2video-vs-pictory",
    title: "Blog2Video vs Pictory",
    description:
      "Comparing Blog2Video and Pictory for turning articles and written content into videos. Key differences in how each tool handles structure, voice, and output quality.",
    eyebrow: "Comparison",
    heroTitle: "Blog2Video vs Pictory: structured content vs stock-driven video",
    heroDescription:
      "Pictory is built around stock footage and AI highlights. Blog2Video is built around preserving the structure and argument of the original article.",
    primaryKeyword: "blog2video vs pictory",
    keywordVariant: "pictory alternative for bloggers",
    recommendedTemplate: "nightfall",
    proofPoints: [
      "No stock footage library needed — templates drive the visual language.",
      "Blog2Video uses the full article structure, not just highlighted sentences.",
      "ElevenLabs narration sounds natural and stays close to the original writing.",
    ],
    sections: [
      {
        title: "The core difference in approach",
        body: [
          "Pictory auto-selects stock footage clips to pair with sentences it extracts from your text. This works well for marketing content where visuals carry most of the message, but it breaks down quickly for technical, educational, or niche content where stock footage is irrelevant or misleading.",
          "Blog2Video generates video from the article's structure itself — no stock library, no irrelevant b-roll. Each scene is driven by your own content, which keeps technical and knowledge-heavy articles accurate and coherent.",
        ],
        bullets: [
          "Pictory: stock footage + highlighted sentences",
          "Blog2Video: article structure + AI narration + animated templates",
          "Blog2Video works better when visuals should reflect the writing, not replace it",
        ],
      },
      {
        title: "Voice and narration quality",
        body: [
          "Pictory offers text-to-speech with several voice options. Blog2Video integrates directly with ElevenLabs, which consistently produces more natural-sounding output, supports voice cloning from a short sample, and lets you preview any voice before committing to generation.",
        ],
      },
      {
        title: "Which one fits your workflow",
        body: [
          "Choose Pictory if you primarily produce lifestyle, marketing, or brand content where stock footage adds value and you want a visual-first editor with timeline control.",
          "Choose Blog2Video if your content is information-dense — technical tutorials, SEO articles, research explainers, educational posts — and you want a fast, structure-preserving path from article URL to finished video.",
        ],
      },
    ],
    relatedPaths: [
      "/blog-to-video",
      "/blog2video-vs-lumen5",
      "/for-technical-bloggers",
      "/lumen5-alternative",
    ],
  },
  {
    path: "/blog2video-vs-invideo",
    title: "Blog2Video vs InVideo",
    description:
      "Comparing Blog2Video and InVideo for AI video creation from written content. Which tool handles blog posts and articles with less manual work.",
    eyebrow: "Comparison",
    heroTitle: "Blog2Video vs InVideo: automation depth vs template flexibility",
    heroDescription:
      "InVideo has a broad template library and manual editor. Blog2Video is optimized for the specific case of turning written content into video with minimal intervention.",
    primaryKeyword: "blog2video vs invideo",
    keywordVariant: "invideo alternative for content creators",
    recommendedTemplate: "spotlight",
    proofPoints: [
      "Blog2Video requires no manual scene building — the article structure does it.",
      "Full automation from URL to video in under three minutes.",
      "No subscription to a stock media library required.",
    ],
    sections: [
      {
        title: "Manual editing vs automated generation",
        body: [
          "InVideo is a capable template-based editor with AI-assisted scene suggestions. But it still expects you to do meaningful manual work: selecting scenes, adjusting text, choosing media, trimming clips. For teams that want control over every frame, this is appropriate.",
          "Blog2Video trades manual control for speed of automation. The article structure drives scene creation automatically. You can adjust individual scenes after generation, but the starting point is already a coherent video, not a blank canvas.",
        ],
      },
      {
        title: "Content-type fit",
        body: [
          "InVideo works well for promotional videos, social content, and explainers where you want to pick a template and build out each slide. It is a general-purpose video tool that covers many use cases.",
          "Blog2Video is narrow by design. It is optimized for one flow: written content in, narrated video out. If that is your core use case, Blog2Video is faster and more automated than InVideo for this specific task.",
        ],
        bullets: [
          "InVideo: better for broad video production needs, team collaboration",
          "Blog2Video: better for high-volume blog-to-video conversion",
          "Blog2Video: faster time-to-video when source content already exists",
          "Blog2Video: no manual scene building required",
        ],
      },
    ],
    relatedPaths: [
      "/blog-to-video",
      "/url-to-video",
      "/blog2video-vs-lumen5",
      "/blog2video-vs-pictory",
    ],
  },
  {
    path: "/blog2video-vs-descript",
    title: "Blog2Video vs Descript",
    description:
      "Comparing Blog2Video and Descript for content creators. They solve different problems — here is how to know which one you actually need.",
    eyebrow: "Comparison",
    heroTitle: "Blog2Video vs Descript: they solve different problems",
    heroDescription:
      "Descript is a recorded-video editor that makes editing as easy as editing text. Blog2Video generates video from scratch using written content. If you already have video, Descript. If you start from writing, Blog2Video.",
    primaryKeyword: "blog2video vs descript",
    keywordVariant: "descript alternative for bloggers",
    recommendedTemplate: "geometric-explainer",
    proofPoints: [
      "No recording equipment or existing footage required.",
      "Start from a URL or document — no raw video file needed.",
      "Better for teams that produce content writing-first.",
    ],
    sections: [
      {
        title: "What each tool is actually for",
        body: [
          "Descript is a post-production tool. Its core strength is editing recorded audio and video by editing a transcript — you delete words in the transcript, and the corresponding audio/video is removed. It is excellent for podcasts, interview clips, recorded walkthroughs, and any workflow that starts with raw footage.",
          "Blog2Video is a generation tool. It creates video from written content. No recording required, no footage to trim. If you have a blog post or article, Blog2Video generates scenes, narration, and a structured video from it end-to-end.",
        ],
        bullets: [
          "Descript: start with recorded audio/video, edit like a doc",
          "Blog2Video: start with written content, generate video automatically",
          "These tools are complementary, not competing, for most teams",
        ],
      },
      {
        title: "When to choose Blog2Video over Descript",
        body: [
          "If your content pipeline is writing-first — you publish blog posts, guides, or articles first — and you want to expand into video without adding a recording and editing workflow, Blog2Video is the right tool. There is no footage to acquire, no script to re-record, and no timeline to edit manually.",
          "Descript becomes the right choice once you have recorded material that needs editing, or when you want to produce podcast-style video with an actual presenter.",
        ],
      },
    ],
    relatedPaths: [
      "/blog-to-video",
      "/for-technical-writers",
      "/blog2video-vs-invideo",
      "/ai-scene-editor",
    ],
  },
  {
    path: "/lumen5-alternative",
    title: "Lumen5 Alternative for Blog-to-Video",
    description:
      "Looking for a Lumen5 alternative that handles blog posts and technical articles better? See how Blog2Video compares on automation, voice quality, and content fidelity.",
    eyebrow: "Alternative",
    heroTitle: "The Lumen5 alternative built for writers who want less manual work",
    heroDescription:
      "Lumen5 requires choosing stock media and manually adjusting scenes. Blog2Video generates the full video from your article structure automatically — URL in, video out.",
    primaryKeyword: "lumen5 alternative",
    keywordVariant: "alternative to lumen5 for blog posts",
    recommendedTemplate: "geometric-explainer",
    proofPoints: [
      "No stock library browsing or slide-by-slide adjustment.",
      "Article headings drive scene structure automatically.",
      "ElevenLabs voice integration with preview before generation.",
    ],
    sections: [
      {
        title: "Why teams switch from Lumen5",
        body: [
          "The most common reason teams look for a Lumen5 alternative is the manual overhead. Lumen5 automates the initial suggestion layer, but you still spend significant time replacing suggested stock footage that does not match your content, adjusting text on each slide, and curating the visual pacing.",
          "For teams publishing two or more posts per week and wanting video for each one, that per-video time adds up fast. Blog2Video removes the stock media step entirely and drives scene creation from the article's own structure.",
        ],
        bullets: [
          "Lumen5 requires stock media selection per scene",
          "Blog2Video uses animated templates — no stock library needed",
          "Blog2Video preserves the original article argument in the narration",
          "Blog2Video total generation time: under 3 minutes per article",
        ],
      },
      {
        title: "Who Blog2Video works best for as a Lumen5 replacement",
        body: [
          "Blog2Video is the stronger Lumen5 alternative for technical bloggers, SEO-focused content teams, educators, and researchers — anyone whose content value comes from the writing itself rather than visual storytelling with stock footage.",
          "If you write posts that rely on precision, structure, and specific examples, Blog2Video's article-driven approach preserves that. Lumen5's stock-footage approach tends to flatten the specificity of technical content.",
        ],
      },
    ],
    relatedPaths: [
      "/blog2video-vs-lumen5",
      "/blog-to-video",
      "/for-technical-bloggers",
      "/pictory-alternative",
    ],
  },
  {
    path: "/pictory-alternative",
    title: "Pictory Alternative for Article-to-Video",
    description:
      "Looking for a Pictory alternative for turning articles and blog posts into videos? See how Blog2Video handles structured content, narration, and workflow automation differently.",
    eyebrow: "Alternative",
    heroTitle: "The Pictory alternative for content where accuracy matters more than b-roll",
    heroDescription:
      "Pictory matches stock footage to your sentences. Blog2Video builds the video from your article's own structure. For technical or educational content, the difference in output quality is significant.",
    primaryKeyword: "pictory alternative",
    keywordVariant: "alternative to pictory for bloggers",
    recommendedTemplate: "nightfall",
    proofPoints: [
      "No stock footage — templates make your content the visual.",
      "Scene structure follows your article headings, not AI-picked highlights.",
      "ElevenLabs voices sound more natural than standard TTS options.",
    ],
    sections: [
      {
        title: "The stock footage problem with Pictory",
        body: [
          "Pictory extracts highlights from your text and suggests stock footage for each one. For generic marketing content this works acceptably. For technical articles, niche topics, or any content where precision matters, the suggested stock footage is almost always irrelevant — and replacing it frame by frame is more work than the automation saved.",
          "Blog2Video sidesteps this entirely. There is no stock media library. The video is built from animated templates that work with any content type, and the structure comes from your article's headings and sections, not from a highlights extraction algorithm.",
        ],
      },
      {
        title: "Who should consider Blog2Video as a Pictory alternative",
        body: [
          "If you primarily produce lifestyle, promotional, or brand-awareness video where stock footage is a natural fit, Pictory does that job well. Stay with Pictory.",
          "If you write technical guides, SEO articles, educational content, or any post where the ideas in the writing should come through clearly in the video, Blog2Video is the better fit. The output stays true to what you wrote.",
        ],
        bullets: [
          "Technical and educational bloggers: Blog2Video preserves your structure",
          "SEO content teams: faster per-article turnaround with URL-first generation",
          "Researchers and writers: narration follows the original argument",
          "High-volume publishers: three minutes per article vs manual curation",
        ],
      },
    ],
    relatedPaths: [
      "/blog2video-vs-pictory",
      "/blog-to-video",
      "/for-technical-bloggers",
      "/lumen5-alternative",
    ],
  },
];

export const alternativePages: MarketingPage[] = seeds.map((seed) =>
  createPage({
    ...seed,
    category: "alternative",
    recommendedTemplateReason: templateBySlug[seed.recommendedTemplate].differentiator,
    faq: createFaq(
      seed.primaryKeyword,
      "Teams looking to switch from or compare another blog-to-video tool",
      "Blog2Video is strongest when the original content already has structure and depth — it preserves that structure in the output rather than replacing it with generic stock media."
    ),
  })
);
