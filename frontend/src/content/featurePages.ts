import { createFaq, createPage } from "./marketingBase";
import type { MarketingPage } from "./seoTypes";

export const featurePages: MarketingPage[] = [
  createPage({
    path: "/ai-scene-editor",
    title: "AI Scene Editor for Blog2Video",
    description:
      "Edit generated scenes with AI or manual controls to improve video structure without regenerating the entire project.",
    eyebrow: "Feature",
    heroTitle: "Refine scenes without starting the whole video over",
    heroDescription:
      "The AI scene editor makes it easier to sharpen tone, restructure a section, or change emphasis inside a draft that is already close.",
    category: "feature",
    primaryKeyword: "ai scene editor",
    keywordVariant: "edit ai generated video scenes",
    proofPoints: [
      "Useful when the first draft is close but needs editorial refinement.",
      "Supports both manual edits and AI-assisted restructuring.",
      "Makes iterative publishing faster for teams and solo creators alike.",
    ],
    sections: [
      {
        title: "Why this matters for production speed",
        body: [
          "The biggest frustration with many AI tools is that small changes trigger a full do-over. Blog2Video's editing workflow is designed to keep your progress intact while letting you tighten the outcome.",
        ],
      },
    ],
    recommendedTemplate: "spotlight",
    recommendedTemplateReason:
      "Spotlight benefits especially from iterative editing because strong hooks, punchier sections, and revised pacing can materially improve performance.",
    faq: createFaq(
      "AI scene editing",
      "Creators who need a fast path from first draft to publishable video",
      "Blog2Video focuses on editing the scene structure you already have rather than forcing a complete regeneration every time you want to improve a section."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/custom-branded-video-templates",
      "/blogs/how-to-preserve-code-snippets-in-ai-generated-videos",
      "/pricing",
    ],
  }),
  createPage({
    path: "/code-snippet-to-video",
    title: "Code Snippet To Video Explainers",
    description:
      "Turn tutorials and technical posts with code snippets into videos that keep the examples readable.",
    eyebrow: "Feature",
    heroTitle: "Keep code examples readable when written tutorials become video",
    heroDescription:
      "Technical creators should not have to choose between readable code and useful video. Blog2Video helps preserve examples, structure, and explanation flow.",
    category: "feature",
    primaryKeyword: "code snippet to video",
    keywordVariant: "code tutorial to video",
    proofPoints: [
      "Fits developer tutorials, architecture explainers, and API walkthroughs.",
      "Works well for technical blogs that rely on code for credibility.",
      "Helps written tutorials travel better on YouTube and social.",
    ],
    sections: [
      {
        title: "Built for technical fidelity",
        body: [
          "One of the hardest parts of turning technical writing into video is keeping code blocks legible and useful. Blog2Video is built around layouts that support that use case.",
        ],
      },
    ],
    recommendedTemplate: "matrix",
    recommendedTemplateReason:
      "Matrix is a natural fit for code-heavy tutorials because it feels native to technical content while preserving clarity.",
    faq: createFaq(
      "code snippet video generation",
      "Technical writers, dev educators, and engineering teams",
      "Blog2Video is a better fit than generic AI video tools because it explicitly supports structured technical scenes and readable examples."
    ),
    relatedPaths: [
      "/for-technical-bloggers",
      "/for-technical-writers",
      "/blogs/how-to-preserve-code-snippets-in-ai-generated-videos",
      "/templates/matrix",
    ],
  }),
  createPage({
    path: "/diagram-to-video",
    title: "Diagram To Video Workflow for Architecture and Process Content",
    description:
      "Turn architecture diagrams, process flows, and visual explanations into narrated video scenes.",
    eyebrow: "Feature",
    heroTitle: "Use visual structure, not just narration, to explain complex ideas",
    heroDescription:
      "Architecture posts and process-heavy explainers are easier to understand when diagrams survive the move into video. Blog2Video is built for that transition.",
    category: "feature",
    primaryKeyword: "diagram to video",
    keywordVariant: "architecture diagram to video",
    proofPoints: [
      "Useful for systems thinking, workflows, architecture posts, and education.",
      "Helps preserve explanatory visuals that are central to technical understanding.",
      "Makes complex topics more approachable for broader audiences.",
    ],
    sections: [
      {
        title: "Important when visuals carry the insight",
        body: [
          "In many explainers, the diagram is not decoration. It is the thing that makes the concept understandable. Blog2Video is designed to carry that structure into the video format.",
        ],
      },
    ],
    recommendedTemplate: "geometric-explainer",
    recommendedTemplateReason:
      "Geometric Explainer is strong for diagram-heavy content because it emphasizes structure, flow, and clarity over spectacle.",
    faq: createFaq(
      "diagram-led video explanation",
      "Technical educators, researchers, and product teams",
      "Blog2Video uses structured scenes and layouts to keep diagrams useful instead of treating them as incidental supporting visuals."
    ),
    relatedPaths: [
      "/code-snippet-to-video",
      "/for-researchers",
      "/blogs/programmatic-video-generation-for-content-marketers",
      "/templates/geometric-explainer",
    ],
  }),
  createPage({
    path: "/bulk-blog-to-video",
    title: "Bulk Blog To Video Workflow",
    description:
      "Turn multiple blog posts or links into a repeatable video pipeline for content teams and solo creators.",
    eyebrow: "Feature",
    heroTitle: "Repurpose a backlog of articles instead of publishing one video at a time",
    heroDescription:
      "If you already have an archive, the fastest growth move is often operational: create a repeatable workflow that converts that archive into video inventory.",
    category: "feature",
    primaryKeyword: "bulk blog to video",
    keywordVariant: "batch convert blogs to video",
    proofPoints: [
      "Useful for back catalogs, editorial calendars, and content teams.",
      "Turns an archive into a real publishing engine instead of dead inventory.",
      "Pairs naturally with Medium, Substack, and YouTube distribution loops.",
    ],
    sections: [
      {
        title: "The archive is the opportunity",
        body: [
          "Many creators already have months or years of content. A batch workflow makes it possible to turn that existing archive into a pipeline of publishable assets with far less manual effort.",
        ],
      },
    ],
    recommendedTemplate: "gridcraft",
    recommendedTemplateReason:
      "Gridcraft is a strong default for bulk workflows because it handles a wide range of structured post types consistently.",
    faq: createFaq(
      "batch blog-to-video production",
      "Creators and teams with meaningful archives of published content",
      "Blog2Video helps operationalize backlog repurposing rather than treating every video as a brand-new creation project."
    ),
    relatedPaths: [
      "/blog-to-video",
      "/distribution-flywheel",
      "/blogs/content-repurposing-workflow-for-solo-founders",
      "/for-newsletters",
    ],
  }),
  createPage({
    path: "/custom-branded-video-templates",
    title: "Custom Branded Video Templates",
    description:
      "Create custom branded templates for consistent video output across product, content, and education teams.",
    eyebrow: "Feature",
    heroTitle: "Create a branded video system instead of re-styling every piece of content",
    heroDescription:
      "Blog2Video supports template-driven production so teams can turn content into video while keeping a consistent look and feel across channels.",
    category: "feature",
    primaryKeyword: "custom branded video templates",
    keywordVariant: "custom video templates for content teams",
    proofPoints: [
      "Helps teams keep a recognizable visual identity across repeated publishing.",
      "Useful for agencies, content teams, and founder-led brands.",
      "Supports faster production because brand decisions do not restart every time.",
    ],
    sections: [
      {
        title: "Brand consistency at production speed",
        body: [
          "As the volume of publishing increases, a template system matters more. It becomes the layer that protects consistency while still letting the content do the talking.",
        ],
      },
    ],
    recommendedTemplate: "nightfall",
    recommendedTemplateReason:
      "Nightfall is a strong base reference for premium branded systems because it carries a distinct visual identity while staying flexible.",
    faq: createFaq(
      "custom branded video templating",
      "Teams that care about consistent visual identity across content",
      "Blog2Video pairs a content-first generation workflow with reusable template systems, which is more scalable than styling every asset from scratch."
    ),
    relatedPaths: [
      "/ai-scene-editor",
      "/pricing",
      "/contact",
      "/blogs/best-templates-for-explainer-videos",
    ],
  }),
  createPage({
    path: "/multilingual-video-generation",
    title: "Multilingual Video Generation — Blog to Video in Any Language",
    description:
      "Turn any blog post into a video in 39 languages. Auto-detect the source language or manually select the output language to reach global audiences without a separate translation workflow.",
    eyebrow: "Feature",
    heroTitle: "One blog post. Any language. No separate translation step.",
    heroDescription:
      "Blog2Video detects the language of your content automatically and generates the entire video — script, narration, and on-screen text — in that language. Or override it manually to produce a Spanish, Hindi, Arabic, or Japanese video from an English source.",
    category: "feature",
    primaryKeyword: "multilingual video generation",
    keywordVariant: "translate blog to video in any language",
    proofPoints: [
      "39 supported languages including Arabic, Hindi, Chinese, Spanish, French, German, Japanese, Urdu, and more.",
      "Auto-detection uses FastText to identify the source language before a single scene is generated.",
      "Override auto to manually select any supported language — effectively a one-step blog translation into video.",
      "All output — title, scene text, narration, and captions — is generated in the target language, not just dubbed over.",
      "Works in single and bulk mode, so you can generate the same post in multiple languages in one session.",
    ],
    sections: [
      {
        title: "Auto-detection: the language follows the content",
        body: [
          "When you paste a URL or upload a document, Blog2Video reads the content and identifies the language before generation starts. The script, scene titles, narration, and visual text are all produced in that language — no post-processing, no secondary translation API, no extra step.",
          "Auto-detection uses a high-accuracy FastText model with a minimum confidence threshold. For short or code-heavy content, a Unicode script heuristic handles Arabic, Urdu, Persian, and other right-to-left scripts accurately. If confidence is too low, the system defaults to English rather than guessing wrong.",
        ],
      },
      {
        title: "Manual override: translate any blog into any language",
        body: [
          "The language dropdown in Step 3 lets you override the auto-detected language at any point before generation. Select Spanish, Hindi, Vietnamese, or any of the 39 supported languages and the entire video output will be produced in that language — even if the source article is in English.",
          "This makes Blog2Video a practical blog-to-video translation tool. A single English post can become a Spanish video for a Latin American audience, a Hindi video for South Asian distribution, and an Arabic video for MENA — each generated in the same session from the same URL.",
        ],
        bullets: [
          "Select the target language from the Language dropdown in the Voice step",
          "The full video — script, narration, on-screen text — switches to that language",
          "Voiceover is also generated in the selected language via ElevenLabs",
          "Combine with bulk mode to generate multiple language versions simultaneously",
        ],
      },
      {
        title: "39 languages supported",
        body: [
          "Blog2Video supports Arabic, Bengali, Chinese (Simplified), Chinese (Traditional), Czech, Danish, Dutch, Finnish, French, German, Greek, Gujarati, Hebrew, Hindi, Hungarian, Indonesian, Italian, Japanese, Kannada, Korean, Malay, Malayalam, Marathi, Norwegian, Persian (Farsi), Polish, Portuguese, Punjabi, Romanian, Russian, Spanish, Swahili, Swedish, Tamil, Telugu, Thai, Turkish, Ukrainian, Urdu, Vietnamese, and more.",
          "Right-to-left languages including Arabic, Urdu, Hebrew, and Persian are handled with proper text rendering. East Asian scripts including Japanese, Korean, Chinese Simplified, and Traditional are fully supported.",
        ],
      },
      {
        title: "Bulk multilingual publishing",
        body: [
          "The bulk submission mode lets you queue multiple URLs with different language settings. Submit the same post four times with four different language overrides and get four language-specific videos back — ready for four different regional audiences or platforms.",
          "This is the fastest path to multilingual content distribution for teams that already have an English publishing workflow and want to extend reach without rebuilding their process.",
        ],
        bullets: [
          "Queue the same URL multiple times with different language selections",
          "Each version generates independently with the correct language output",
          "No separate translation service, editor, or voiceover contractor needed",
          "ElevenLabs voice selection works per language version",
        ],
      },
    ],
    recommendedTemplate: "spotlight",
    recommendedTemplateReason:
      "Spotlight's bold typography holds readability across scripts and character sets, making it the most reliable choice when publishing video in languages with different writing systems.",
    faq: createFaq(
      "multilingual video generation",
      "Content teams, SEO agencies, and international publishers",
      "Blog2Video generates the full video — script, narration, display text — in the target language natively, rather than translating a finished English video or dubbing audio over an English-text template."
    ),
    relatedPaths: [
      "/bulk-blog-to-video",
      "/blog-to-video",
      "/ai-scene-editor",
      "/blogs/translate-blog-to-video-in-any-language",
      "/pricing",
    ],
  }),
];
