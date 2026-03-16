import { createFaq, createPage } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

export const coreCommercialPages: MarketingPage[] = [
  createPage({
    path: "/blog-to-video",
    title: "Blog to Video Converter | Turn Posts Into Videos | Blog2Video",
    description:
      "Turn blog posts into videos in minutes. Blog2Video converts articles to narrated videos with code, diagrams, and templates. No prompts needed.",
    eyebrow: "Commercial workflow",
    heroTitle: "Blog to Video: Turn Posts Into Videos Without Rebuilding",
    heroDescription:
      "Blog2Video is built for creators who already have long-form content and want a clean path to YouTube, Shorts, and social video without outsourcing every publish.",
    category: "commercial",
    primaryKeyword: "blog to video",
    keywordVariant: "convert blog post to video",
    badges: ["For bloggers", "Narrated explainers", "Preserves structure"],
    proofPoints: [
      "Starts from the URL of an existing article instead of a blank video timeline.",
      "Keeps code snippets, diagrams, bullets, and key arguments visible in the final edit.",
      "Supports templates, voice options, and AI scene editing for faster iteration.",
    ],
    sections: [
      {
        title: "Why this workflow converts",
        body: [
          "Most creators already know what they want to say. The problem is rebuilding the same thinking in a completely different medium. Blog2Video closes that gap by treating the article as the source of truth.",
          "Instead of generic stock footage and one-size-fits-all narration, the platform maps your original content into scenes, visuals, and voiceover that match the actual ideas in the post.",
        ],
        bullets: [
          "Paste a URL and generate the first draft from your real article.",
          "Review scene structure instead of editing from a blank canvas.",
          "Ship the output to YouTube, LinkedIn, Shorts, or newsletter embeds.",
        ],
      },
      {
        title: "Built for written-first creators",
        body: [
          "This is especially strong for technical blogs, product explainers, tutorials, and research commentary where the writing already contains the logic of the video.",
        ],
      },
    ],
    recommendedTemplate: "gridcraft",
    recommendedTemplateReason:
      "Gridcraft works especially well for blogs because it handles comparisons, structured ideas, and data-rich writing without flattening the narrative.",
    faq: [
      {
        question: "How do I convert a blog to video?",
        answer:
          "Paste your blog URL into Blog2Video. The tool reads the live page, extracts headings and content structure, and generates a scene-by-scene video outline. Pick a template and voice, then render. No prompts or manual scripting needed.",
      },
      {
        question: "What is the best blog to video converter?",
        answer:
          "Blog2Video is built for bloggers because it treats your article as the source of truth, not a loose prompt. It preserves code blocks, diagrams, and argument structure, and supports templates, AI voiceover, and scene editing.",
      },
      {
        question: "How do I use my blog for videos?",
        answer:
          "Use Blog2Video to turn every published post into a narrated video. Paste the URL, generate the video, and export to YouTube, Shorts, LinkedIn, or embed back into the original article. One blog post becomes multiple video assets.",
      },
      ...createFaq(
        "blog to video conversion",
        "Writers and founder-creators",
        "Blog2Video uses your real content structure and turns it into React-rendered scenes, diagrams, and code-aware layouts instead of vague stock footage."
      ),
    ],
    relatedPaths: [
      "/article-to-video",
      "/blog-to-youtube-video",
      "/for-technical-bloggers",
      "/blogs/how-to-turn-a-blog-post-into-a-video",
    ],
  }),
  createPage({
    path: "/article-to-video",
    title: "Article To Video Software for Tutorials and Essays",
    description:
      "Convert articles and long-form essays into video explainers with narration, structured scenes, and reusable templates.",
    eyebrow: "Commercial workflow",
    heroTitle: "Convert articles into video explainers that stay faithful to the original piece",
    heroDescription:
      "From essays to tutorials, Blog2Video helps you repurpose long-form text into a structured video without losing the nuance that made the article worth reading.",
    category: "commercial",
    primaryKeyword: "article to video",
    keywordVariant: "convert article to video",
    proofPoints: [
      "Works for thought-leadership essays, tutorials, and commentary pieces.",
      "Generates a script and visual structure from the article rather than summarizing it into fluff.",
      "Lets you refine scenes manually or through AI editing without starting over.",
    ],
    sections: [
      {
        title: "Useful when the article is the product",
        body: [
          "A lot of AI video tools assume the text is just prompt material. Blog2Video is different: it treats the article as the actual asset you are repurposing.",
          "That means the end result is better suited for creators who care about preserving argument quality, instructional detail, and examples.",
        ],
      },
    ],
    recommendedTemplate: "geometric-explainer",
    recommendedTemplateReason:
      "Geometric Explainer fits article-based content because it keeps the flow calm, readable, and easy to follow scene by scene.",
    faq: createFaq(
      "article to video conversion",
      "Essayists, technical writers, and educators",
      "Blog2Video is built around structured scenes, layouts, and narration that mirror the actual article instead of replacing it with stock B-roll."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/url-to-video",
      "/for-technical-writers",
      "/blogs/best-ai-tools-to-convert-articles-into-videos",
    ],
  }),
  createPage({
    path: "/url-to-video",
    title: "URL To Video Generator for Published Content",
    description:
      "Paste a public URL and turn the page into a narrated video with visuals, scenes, and shareable output formats.",
    eyebrow: "Commercial workflow",
    heroTitle: "Use any public URL as the starting point for a polished video",
    heroDescription:
      "If the content is already live, Blog2Video can scrape and structure it into a production-ready video workflow in minutes.",
    category: "commercial",
    primaryKeyword: "url to video",
    keywordVariant: "turn url into video",
    proofPoints: [
      "Useful for published blogs, landing pages, newsletters, and article archives.",
      "Pulls source structure and images directly from the page to accelerate the first draft.",
      "Works well when the goal is speed from existing published content.",
    ],
    sections: [
      {
        title: "A fast route to repurposing",
        body: [
          "When the page already exists, there is no need to copy-paste everything into a new system. URL-first generation shortens time to first draft and makes video repurposing feel lightweight enough to do every week.",
        ],
        bullets: [
          "Paste the live URL.",
          "Let Blog2Video extract the content structure and assets.",
          "Review the generated scenes before rendering.",
        ],
      },
    ],
    recommendedTemplate: "spotlight",
    recommendedTemplateReason:
      "Spotlight is a strong fit for URL-first repurposing because it quickly turns finished web copy into attention-grabbing, distribution-friendly cuts.",
    faq: createFaq(
      "URL to video creation",
      "Teams repurposing already-published content",
      "Instead of using the URL as a loose prompt, Blog2Video extracts structure and turns it into a scene-by-scene render pipeline."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/pdf-to-video",
      "/for-newsletters",
      "/blogs/how-to-distribute-one-article-across-blog-newsletter-youtube-and-shorts",
    ],
  }),
  createPage({
    path: "/pdf-to-video",
    title: "PDF To Video Converter for Educators and Researchers",
    description:
      "Turn PDFs into narrated videos with scenes, diagrams, and educational templates built for explainers.",
    eyebrow: "Document workflow",
    heroTitle: "Turn PDFs into video explainers without manually rebuilding the deck",
    heroDescription:
      "Blog2Video supports PDF-based workflows for educators, researchers, and teams who already publish structured material and want it in video format.",
    category: "commercial",
    primaryKeyword: "pdf to video",
    keywordVariant: "convert pdf to video",
    proofPoints: [
      "Useful for whitepapers, lesson notes, research summaries, and guides.",
      "Preserves educational structure better than generic AI video generation.",
      "Lets you repurpose static PDF content into YouTube-ready assets.",
    ],
    sections: [
      {
        title: "Strong fit for educational content",
        body: [
          "PDF workflows often break inside lightweight content tools because the original context disappears. Blog2Video keeps the educational arc intact and turns it into a readable scene sequence.",
        ],
      },
    ],
    recommendedTemplate: "whiteboard",
    recommendedTemplateReason:
      "Whiteboard is the best default for PDFs because it supports teaching-oriented structure, diagrams, and accessible pacing.",
    faq: createFaq(
      "PDF to video conversion",
      "Educators, consultants, and researchers",
      "Blog2Video is designed to keep the logic and readability of structured documents instead of flattening them into generic narration."
    ),
    relatedPaths: [
      "/docx-to-video",
      "/pptx-to-video",
      "/for-educators",
      "/blogs/pdf-to-video-fastest-workflow-for-educators",
    ],
  }),
  createPage({
    path: "/docx-to-video",
    title: "DOCX To Video Workflow for Documentation and Product Content",
    description:
      "Convert DOCX files into video walkthroughs, product explainers, and narrated educational assets.",
    eyebrow: "Document workflow",
    heroTitle: "Turn DOCX files into structured videos for product and documentation teams",
    heroDescription:
      "If your knowledge base starts in documents, Blog2Video gives you a workflow to turn those documents into clean, reusable video assets.",
    category: "commercial",
    primaryKeyword: "docx to video",
    keywordVariant: "convert docx to video",
    proofPoints: [
      "Useful for SOPs, product docs, how-to guides, and internal enablement.",
      "Helps technical writing teams extend the reach of documentation.",
      "Pairs especially well with code-aware and explainer-oriented templates.",
    ],
    sections: [
      {
        title: "Documentation becomes easier to distribute",
        body: [
          "Long-form docs are powerful, but many audiences engage faster through video. Turning DOCX content into explainers gives teams another format without redoing the work manually.",
        ],
      },
    ],
    recommendedTemplate: "geometric-explainer",
    recommendedTemplateReason:
      "Geometric Explainer gives DOCX-derived content a clean instructional structure that works well for documentation and walkthroughs.",
    faq: createFaq(
      "DOCX to video conversion",
      "Technical writing and product teams",
      "Blog2Video is designed for content with structure, instructions, and examples, which makes it stronger than generic prompt-based tools for documentation."
    ),
    relatedPaths: [
      "/pdf-to-video",
      "/code-snippet-to-video",
      "/for-technical-writers",
      "/blogs/how-to-turn-documentation-into-product-walkthrough-videos",
    ],
  }),
  createPage({
    path: "/pptx-to-video",
    title: "PPTX To Video Creator for Presentations and Lessons",
    description:
      "Convert slide decks and PPTX files into polished narrated videos for teams, educators, and explainers.",
    eyebrow: "Document workflow",
    heroTitle: "Turn presentation decks into publishable videos without re-recording every slide",
    heroDescription:
      "Blog2Video helps you take existing presentations and extend them into narrated content that works beyond the original meeting or classroom session.",
    category: "commercial",
    primaryKeyword: "pptx to video",
    keywordVariant: "convert powerpoint to video",
    proofPoints: [
      "Ideal for course content, webinar decks, workshop material, and internal enablement.",
      "Makes it easier to reuse presentation assets across asynchronous channels.",
      "Creates a consistent publishing pipeline for slide-first teams.",
    ],
    sections: [
      {
        title: "Useful beyond the meeting room",
        body: [
          "Slide decks hold a lot of insight, but they are usually trapped inside one presentation. Turning PPTX content into video lets teams publish the same thinking in a more scalable format.",
        ],
      },
    ],
    recommendedTemplate: "whiteboard",
    recommendedTemplateReason:
      "Whiteboard translates slide-first content into an easy-to-follow lesson flow while keeping the pacing clear.",
    faq: createFaq(
      "PPTX to video conversion",
      "Educators, workshop creators, and internal enablement teams",
      "Blog2Video keeps the structure of the deck intact and transforms it into a more flexible publishing format rather than simply recording slides as-is."
    ),
    relatedPaths: [
      "/pdf-to-video",
      "/for-educators",
      "/blogs/how-to-convert-research-papers-into-explainer-videos",
      "/templates/whiteboard",
    ],
  }),
  createPage({
    path: "/ai-video-generator-for-bloggers",
    title: "AI Video Generator for Bloggers",
    description:
      "An AI video generator designed for bloggers who want to repurpose articles into structured, voice-led video.",
    eyebrow: "Commercial workflow",
    heroTitle: "A better AI video generator for bloggers who already have great content",
    heroDescription:
      "The goal is not to invent a video from scratch. It is to help writers turn proven blog posts into videos that match the original thinking, structure, and brand.",
    category: "commercial",
    primaryKeyword: "ai video generator for bloggers",
    keywordVariant: "best ai video tool for bloggers",
    proofPoints: [
      "Built for existing long-form content rather than blank-prompt creation.",
      "Better suited to writers who publish tutorials, essays, and technical content.",
      "Turns content archives into repeatable video inventory.",
    ],
    sections: [
      {
        title: "Why bloggers need a different kind of AI video tool",
        body: [
          "Most bloggers do not need a cinematic prompt toy. They need a dependable workflow that makes their best posts reusable on search, social, and video channels.",
        ],
      },
    ],
    recommendedTemplate: "nightfall",
    recommendedTemplateReason:
      "Nightfall is a great high-conviction default for bloggers because it turns written arguments into premium-feeling videos that still feel authored.",
    faq: createFaq(
      "AI video generation for bloggers",
      "Writers who publish consistently and want more leverage from every post",
      "Blog2Video focuses on repurposing and fidelity, which is a better match for bloggers than stock-footage-first generators."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/for-technical-bloggers",
      "/for-medium-writers",
      "/blogs/content-repurposing-workflow-for-solo-founders",
    ],
  }),
  createPage({
    path: "/blog-to-youtube-video",
    title: "Turn Blog Posts Into YouTube Videos",
    description:
      "Create YouTube-ready explainers from blog posts using structured narration, scenes, templates, and voiceover.",
    eyebrow: "Distribution workflow",
    heroTitle: "Turn one blog post into a YouTube video you can actually publish",
    heroDescription:
      "Blog2Video helps written-first creators bridge the gap between search-first blogging and YouTube distribution without duplicating the entire creative process.",
    category: "commercial",
    primaryKeyword: "blog to YouTube video",
    keywordVariant: "turn blog into YouTube video",
    proofPoints: [
      "Built for longer educational and technical content, not just short hooks.",
      "Makes YouTube a natural second format for existing blog output.",
      "Helps founders and creators create a multi-channel content engine from the same source.",
    ],
    sections: [
      {
        title: "A practical bridge from SEO to YouTube",
        body: [
          "Blogging captures search demand. YouTube captures discovery and repeat audience. This workflow connects those channels by turning your article into a structured explainer you can publish quickly.",
        ],
      },
    ],
    recommendedTemplate: "gridcraft",
    recommendedTemplateReason:
      "Gridcraft is ideal for long-form YouTube explainers because it balances clarity, pacing, and modular structure.",
    faq: createFaq(
      "blog to YouTube conversion",
      "Bloggers, educators, and technical founders",
      "Blog2Video is optimized for structure-rich educational content and produces cleaner YouTube explainers than generic prompt-based generators."
    ),
    relatedPaths: [
      "/blog-to-shorts",
      "/blog-to-video",
      "/distribution-flywheel",
      "/blogs/how-technical-bloggers-can-repurpose-posts-into-youtube-videos",
    ],
  }),
  createPage({
    path: "/blog-to-shorts",
    title: "Turn Blog Posts Into Shorts and Vertical Video",
    description:
      "Convert blog content into vertical short-form videos for Shorts, Reels, and social distribution.",
    eyebrow: "Distribution workflow",
    heroTitle: "Turn written ideas into shorts, reels, and vertical clips",
    heroDescription:
      "Use Blog2Video to transform the strongest ideas inside a post into vertical assets for YouTube Shorts, LinkedIn clips, and social snippets.",
    category: "commercial",
    primaryKeyword: "blog to shorts",
    keywordVariant: "blog post to short video",
    proofPoints: [
      "Lets a single long-form article feed both search and social distribution.",
      "Useful for teasers, summaries, and audience-building clips.",
      "Pairs especially well with bold templates and strong narrative hooks.",
    ],
    sections: [
      {
        title: "One article, multiple attention surfaces",
        body: [
          "Short-form video does not replace long-form content. It helps more people discover it. This workflow turns a single article into fast-moving vertical assets that point back to the deeper piece.",
        ],
      },
    ],
    recommendedTemplate: "spotlight",
    recommendedTemplateReason:
      "Spotlight works well for Shorts because it favors bold claims, sharp pacing, and high-contrast motion.",
    faq: createFaq(
      "blog to short-form video repurposing",
      "Creators building both search and social distribution",
      "Blog2Video gives you a content-first short-form workflow rather than random highlight clips disconnected from the original article."
    ),
    relatedPaths: [
      "/blog-to-youtube-video",
      "/ai-video-generator-for-bloggers",
      "/distribution-flywheel",
      "/blogs/blog-to-youtube-shorts-strategy",
    ],
  }),
];
