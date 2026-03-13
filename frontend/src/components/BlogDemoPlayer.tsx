import { useMemo, useState, useEffect } from "react";
import { Player } from "@remotion/player";
import { getTemplateConfig } from "./remotion/templateConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DemoScene {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
}

interface SceneSet {
  template: string;
  scenes: DemoScene[];
}

const SCENE_SETS: Record<string, SceneSet> = {
  "blog-workflow": {
    template: "nightfall",
    scenes: [
      {
        id: 1, order: 1, title: "How Blog2Video converts a blog post", durationSeconds: 7,
        narration: "Blog2Video reads your published article directly from its URL. It extracts the full structure — headings, paragraphs, examples, and supporting points — and maps them into a scene-by-scene video outline without you writing a single prompt.",
        layout: "glass_narrative",
        layoutProps: { title: "How Blog2Video Converts a Blog Post" },
      },
      {
        id: 2, order: 2, title: "The three-step workflow", durationSeconds: 8,
        narration: "The entire process takes three steps, and each one preserves the structure of the original article so the video actually sounds like you wrote it.",
        layout: "glass_stack",
        layoutProps: {
          title: "The Blog-to-Video Workflow",
          items: [
            "Paste your blog URL — Blog2Video reads the live page and extracts headings, body text, and examples into an outline",
            "Pick a template — choose Nightfall for cinematic depth, Spotlight for bold YouTube energy, Whiteboard for calm educational pacing, or build your own brand theme",
            "Generate — Blog2Video produces a narrated, scene-by-scene video with transitions, titles, and AI voiceover ready for YouTube, LinkedIn, or embedding",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Why your article stays intact", durationSeconds: 7,
        narration: "Unlike prompt-first tools that flatten your writing into generic narration, Blog2Video treats the published article as the actual source of truth. The argument, examples, and proof points carry over into the video without drifting from the original.",
        layout: "glass_narrative",
        layoutProps: { title: "Your Article Stays Intact" },
      },
      {
        id: 4, order: 4, title: "Edit any scene individually", durationSeconds: 7,
        narration: "After generation, the AI scene editor lets you click into any individual scene to adjust the narration, visuals, display text, or pacing. Change one scene without rebuilding the rest of the project.",
        layout: "glass_narrative",
        layoutProps: { title: "Edit Any Scene Individually" },
      },
      {
        id: 5, order: 5, title: "What you can publish from one post", durationSeconds: 8,
        narration: "One blog post becomes multiple assets. Every template supports both landscape and portrait, so a single article can produce all of these without extra research or scripting.",
        layout: "glass_stack",
        layoutProps: {
          title: "Outputs from a Single Blog Post",
          items: [
            "Full YouTube explainer with narration and transitions",
            "Portrait Short or Reel for mobile-first discovery",
            "Embeddable video for the original blog post",
            "LinkedIn or social teaser clip",
          ],
        },
      },
    ],
  },

  "tool-comparison": {
    template: "spotlight",
    scenes: [
      {
        id: 1, order: 1, title: "Content-first vs prompt-first", durationSeconds: 7,
        narration: "Most AI video tools start from a blank prompt. Blog2Video starts from your published article. That difference changes everything about the quality of the output, because the structure already exists in your writing.",
        layout: "statement",
        layoutProps: { title: "Content-First vs Prompt-First", highlightWord: "article" },
      },
      {
        id: 2, order: 2, title: "Blog2Video vs generic tools", durationSeconds: 8,
        narration: "The evaluation comes down to one question: does the tool read your content, or does it need you to re-explain it from scratch?",
        layout: "versus",
        layoutProps: {
          title: "The Core Difference",
          leftLabel: "Blog2Video",
          rightLabel: "Prompt-First Tools",
          leftDescription: "Reads the published article. Preserves structure, argument, code blocks, and examples. Video matches the original because the original is the source.",
          rightDescription: "Starts from a blank prompt. You re-explain the topic from memory. Output drifts from the source. Formatting and nuance get lost.",
        },
      },
      {
        id: 3, order: 3, title: "What source fidelity means", durationSeconds: 7,
        narration: "Source fidelity means the video preserves your original argument, not just the topic. Blog2Video keeps every heading, supporting point, and example in the scene sequence so the viewer gets the same quality as the reader.",
        layout: "statement",
        layoutProps: { title: "Source Fidelity Matters", highlightWord: "fidelity" },
      },
      {
        id: 4, order: 4, title: "Features that matter for bloggers", durationSeconds: 8,
        narration: "When evaluating tools as a blogger, look for these capabilities. Each one determines whether the tool compounds your writing or replaces it with something generic.",
        layout: "cascade_list",
        layoutProps: {
          title: "What Bloggers Should Evaluate",
          items: [
            "URL input — paste a link, not a prompt",
            "Scene editor — adjust narration and visuals per scene",
            "Multiple templates — match your brand and audience",
            "AI voiceover — 100+ voices with preview before rendering",
            "Bulk processing — convert your archive, not just one post",
          ],
        },
      },
      {
        id: 5, order: 5, title: "Structure preservation", durationSeconds: 6,
        narration: "Blog2Video preserves one hundred percent of your original article structure in the generated video. No detail is lost because your writing is the script.",
        layout: "stat_stage",
        layoutProps: {
          title: "Structure Preservation",
          metrics: [{ value: "100", label: "of your original structure preserved", suffix: "%" }],
        },
      },
    ],
  },

  "document-education": {
    template: "whiteboard",
    scenes: [
      {
        id: 1, order: 1, title: "How document conversion works", durationSeconds: 7,
        narration: "Blog2Video reads the document structure — headings, paragraphs, and content blocks — and maps each section into a scene. The result is a narrated video that follows the same teaching flow as the original material.",
        layout: "marker_story",
        layoutProps: { title: "How Document Conversion Works" },
      },
      {
        id: 2, order: 2, title: "What happens after upload", durationSeconds: 7,
        narration: "Upload a PDF, DOCX, or paste a documentation URL. Blog2Video parses the structure, generates narration adapted for listening, and builds a scene-by-scene outline you can review before rendering.",
        layout: "stick_figure_scene",
        layoutProps: { title: "Upload, Parse, Review, Render" },
      },
      {
        id: 3, order: 3, title: "Before and after comparison", durationSeconds: 7,
        narration: "The difference is dramatic. Manual recording takes hours of setup, scripting, and editing. Blog2Video automates the structure so educators can focus on the content, not the production.",
        layout: "stats_chart",
        layoutProps: {
          title: "Time Spent Creating Lesson Videos",
          stats: [
            { label: "Manual recording", value: 180 },
            { label: "Slide-to-video tools", value: 60 },
            { label: "Blog2Video", value: 5 },
          ],
        },
      },
      {
        id: 4, order: 4, title: "Why whiteboard works for teaching", durationSeconds: 7,
        narration: "The Whiteboard template uses calm pacing, hand-drawn visuals, and clear typography that keeps attention on the lesson. It is designed for comprehension, not flash, which is exactly what students and learners need.",
        layout: "marker_story",
        layoutProps: { title: "Why Whiteboard Works for Teaching" },
      },
      {
        id: 5, order: 5, title: "Where to share the result", durationSeconds: 7,
        narration: "The finished video can go anywhere: your LMS, a course portal, YouTube for public access, a help center for onboarding, or embedded directly in the original document page for asynchronous learning.",
        layout: "stick_figure_scene",
        layoutProps: { title: "Share Anywhere Students Learn" },
      },
    ],
  },

  "code-tutorial": {
    template: "matrix",
    scenes: [
      {
        id: 1, order: 1, title: "How code blocks are preserved", durationSeconds: 8,
        narration: "When Blog2Video reads a technical article, it detects code blocks and preserves them as distinct visual elements. Syntax highlighting, indentation, and formatting carry over into dedicated code scenes rendered in the Matrix terminal style.",
        layout: "terminal_text",
        layoutProps: { title: "How Code Blocks Are Preserved", highlightWord: "preserves" },
      },
      {
        id: 2, order: 2, title: "The developer workflow", durationSeconds: 8,
        narration: "The workflow is built for technical writers. Paste the tutorial URL, and Blog2Video extracts the code, the explanation around it, and the logical flow of the article into a structured video.",
        layout: "data_stream",
        layoutProps: {
          title: "Developer Workflow",
          items: [
            "Paste tutorial URL — article structure is extracted automatically",
            "Code blocks detected — each gets its own scene with syntax highlighting",
            "Narration generated — explains the code in spoken context",
            "Scene editor — adjust any code scene or explanation individually",
            "Export — YouTube tutorial, Short, or embed in the original post",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Blog2Video vs recording screencasts", durationSeconds: 8,
        narration: "Recording a screencast means setting up your environment, scripting what to say, recording, and editing. Blog2Video reads the written tutorial and generates the video programmatically. The code is already in the article.",
        layout: "fork_choice",
        layoutProps: {
          title: "Two Approaches",
          leftLabel: "Blog2Video",
          rightLabel: "Screencasting",
          leftDescription: "Reads the tutorial. Code blocks become scenes. Narration is generated. Edit individual scenes after generation.",
          rightDescription: "Set up IDE. Write script. Record screen. Edit video. Re-record when code changes. Repeat per tutorial.",
        },
      },
      {
        id: 4, order: 4, title: "Narration follows the code", durationSeconds: 7,
        narration: "The AI narration walks through the code in context, explaining what each block does and why it matters. The spoken explanation supports the visual code rather than replacing it with vague summaries.",
        layout: "terminal_text",
        layoutProps: { title: "Narration follows the code. Explanation supports the visual.", highlightWord: "code" },
      },
      {
        id: 5, order: 5, title: "From tutorial to YouTube", durationSeconds: 8,
        narration: "The finished video turns your technical blog post into a YouTube tutorial that developers can watch, share, and subscribe to. The blog captures search traffic while YouTube builds your audience.",
        layout: "data_stream",
        layoutProps: {
          title: "Tutorial Outputs",
          items: [
            "YouTube tutorial with code scenes and narration",
            "Portrait Short highlighting the key code insight",
            "Embeddable video for the original blog post",
            "Consistent terminal aesthetic across all outputs",
          ],
        },
      },
    ],
  },

  "platform-distribution": {
    template: "spotlight",
    scenes: [
      {
        id: 1, order: 1, title: "One article, every platform", durationSeconds: 7,
        narration: "Blog2Video turns one published article into video assets for every channel. The same source content produces YouTube explainers, LinkedIn teasers, portrait Shorts, and embeddable clips without writing a separate script for each.",
        layout: "statement",
        layoutProps: { title: "One Article, Every Platform", highlightWord: "every" },
      },
      {
        id: 2, order: 2, title: "What you get from one blog post", durationSeconds: 8,
        narration: "Every template works in landscape and portrait, so a single blog post can produce all of these outputs from the same video project.",
        layout: "cascade_list",
        layoutProps: {
          title: "Outputs from One Blog Post",
          items: [
            "YouTube explainer — full landscape video with AI narration and transitions",
            "LinkedIn teaser — a 60-second highlight clip that drives traffic back to the article",
            "YouTube Short or Reel — portrait-optimized hook from the strongest insight",
            "Site embed — the video plays right inside the original blog post",
            "Medium and Substack — cross-post with the video linked back to the canonical article",
          ],
        },
      },
      {
        id: 3, order: 3, title: "How cross-posting works", durationSeconds: 7,
        narration: "Medium and Substack readers see your narrative. YouTube viewers watch the video. Both audiences link back to the canonical article on your site. The content compounds instead of competing across channels.",
        layout: "statement",
        layoutProps: { title: "Cross-Posting That Compounds", highlightWord: "compounds" },
      },
      {
        id: 4, order: 4, title: "Template and voice consistency", durationSeconds: 7,
        narration: "Every output from a single project uses the same template and voice. Switch between Nightfall, Spotlight, Whiteboard, or your custom brand theme, and every clip inherits the same visual identity automatically.",
        layout: "cascade_list",
        layoutProps: {
          title: "Consistent Brand Across Channels",
          items: [
            "Same template — every clip matches your visual identity",
            "Same voice — narration tone stays consistent across formats",
            "Same structure — the argument is preserved in every output",
          ],
        },
      },
    ],
  },

  "shorts-strategy": {
    template: "spotlight",
    scenes: [
      {
        id: 1, order: 1, title: "Turning blog posts into Shorts", durationSeconds: 7,
        narration: "Blog2Video creates portrait-optimized clips from your articles. Switch any template to 9:16 orientation and the layout adapts automatically for Shorts, Reels, and TikTok without cropping or manual resizing.",
        layout: "statement",
        layoutProps: { title: "Blog Posts Become Shorts", highlightWord: "portrait" },
      },
      {
        id: 2, order: 2, title: "Why Shorts from blogs work", durationSeconds: 8,
        narration: "The strongest Shorts start with an insight that already works. Blog posts that perform well in search have proven hooks, clear structure, and specific examples — exactly what short-form video needs.",
        layout: "rapid_points",
        layoutProps: {
          title: "Why Shorts from Blogs Work",
          phrases: [
            "Your best insight becomes the opening hook.",
            "Portrait mode adapts to mobile-first viewing.",
            "Each Short drives viewers back to the full article.",
            "One blog post can produce multiple Shorts from different sections.",
          ],
        },
      },
      {
        id: 3, order: 3, title: "The Shorts workflow", durationSeconds: 7,
        narration: "Paste your blog URL, switch to portrait mode, and Blog2Video generates a scene-by-scene Short that opens with the strongest hook and ends with a call to read the full post. Export and publish to YouTube Shorts, Instagram Reels, or TikTok.",
        layout: "cascade_list",
        layoutProps: {
          title: "The Blog-to-Shorts Workflow",
          items: [
            "Paste your blog URL into Blog2Video",
            "Toggle portrait mode for 9:16 output",
            "Generate scenes with the hook front-loaded",
            "Export and publish to Shorts, Reels, or TikTok",
          ],
        },
      },
      {
        id: 4, order: 4, title: "Shorts as a discovery engine", durationSeconds: 7,
        narration: "Shorts reach audiences who never search for your topic. The short clip creates discovery, the viewer clicks through to the full article, and the article earns a subscriber. The blog post does the depth work while the Short does the reach work.",
        layout: "statement",
        layoutProps: { title: "Shorts as a Discovery Engine", highlightWord: "discovery" },
      },
    ],
  },

  "voice-narration": {
    template: "nightfall",
    scenes: [
      {
        id: 1, order: 1, title: "How AI voiceover works", durationSeconds: 7,
        narration: "Blog2Video generates narration directly from your written content, adapting it for spoken delivery while keeping the original message and tone intact. The AI rewrites for listening without losing the argument.",
        layout: "glass_narrative",
        layoutProps: { title: "How AI Voiceover Works in Blog2Video" },
      },
      {
        id: 2, order: 2, title: "Choosing a voice", durationSeconds: 8,
        narration: "Browse over one hundred premium AI voices filtered by gender, accent, and tone. Preview each voice with your actual article content before committing, so you know exactly how the final video will sound.",
        layout: "glass_stack",
        layoutProps: {
          title: "Choosing the Right Voice",
          items: [
            "Browse by gender, accent, and tone — American, British, Australian, and more",
            "Preview voices with your actual content, not generic sample text",
            "Clone your own voice for fully branded narration across every video",
            "Change the voice later without regenerating the scenes",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Voice follows the writing", durationSeconds: 7,
        narration: "The voice follows the writing, not the other way around. Blog2Video adapts your written paragraphs into spoken narration that respects the original structure, pacing, and emphasis.",
        layout: "kinetic_insight",
        layoutProps: {
          quote: "The voice follows the writing. Not the other way around.",
          highlightWord: "writing",
        },
      },
      {
        id: 4, order: 4, title: "Editing narration per scene", durationSeconds: 7,
        narration: "The scene editor lets you adjust the spoken narration for any individual scene. Change the wording, shorten a sentence, or emphasize a different point without rebuilding the entire video.",
        layout: "glass_narrative",
        layoutProps: { title: "Edit Narration Scene by Scene" },
      },
      {
        id: 5, order: 5, title: "Consistent brand voice", durationSeconds: 7,
        narration: "Once you select a voice, every future video can use the same one. This creates a consistent listening experience across your entire library — subscribers recognize your content by sound, not just by sight.",
        layout: "glass_narrative",
        layoutProps: { title: "Build a Consistent Brand Voice" },
      },
    ],
  },

  "repurposing-system": {
    template: "gridcraft",
    scenes: [
      {
        id: 1, order: 1, title: "The repurposing pipeline", durationSeconds: 8,
        narration: "Blog2Video turns your existing content into a repeatable production pipeline. Start with a proven blog post, generate a video, distribute to every channel, and let each piece of content compound the reach of the next.",
        layout: "bento_steps",
        layoutProps: {
          title: "The Repurposing Pipeline",
          steps: [
            { label: "Source", description: "Start with a blog post that already has search traction or reader engagement" },
            { label: "Generate", description: "Blog2Video reads the article and builds a narrated video scene by scene" },
            { label: "Distribute", description: "Export to YouTube, Shorts, LinkedIn, embed on your site, and cross-post" },
            { label: "Compound", description: "Every published asset links back and feeds the next round of discovery" },
          ],
        },
      },
      {
        id: 2, order: 2, title: "Why existing content is the best starting point", durationSeconds: 7,
        narration: "The best video topics are articles that already work. Posts with steady search traffic, strong engagement, or evergreen relevance have proven that the idea resonates. Blog2Video lets you extend that proof into a second format.",
        layout: "editorial_body",
        layoutProps: { title: "Start with Content That Already Works" },
      },
      {
        id: 3, order: 3, title: "Consistent quality across formats", durationSeconds: 7,
        narration: "Every output from Blog2Video uses the same template, voice, and brand system. Whether you publish a YouTube explainer, a LinkedIn clip, or an embedded video, the quality and identity stay consistent.",
        layout: "editorial_body",
        layoutProps: { title: "Consistent Quality Across Formats" },
      },
      {
        id: 4, order: 4, title: "Scale without extra research", durationSeconds: 7,
        narration: "The key advantage of repurposing is that you never start from zero. The research, the examples, and the argument already exist in the article. Blog2Video structures them into video so you multiply output without multiplying effort.",
        layout: "pull_quote",
        layoutProps: {
          quote: "Multiply output without multiplying effort.",
          attribution: "The Blog2Video Approach",
        },
      },
    ],
  },

  "template-showcase": {
    template: "spotlight",
    scenes: [
      {
        id: 1, order: 1, title: "Templates designed for written content", durationSeconds: 7,
        narration: "Blog2Video includes built-in templates designed specifically for turning written content into video. Each template handles typography, pacing, and transitions differently to match the tone and audience of the article.",
        layout: "statement",
        layoutProps: { title: "Templates Designed for Written Content", highlightWord: "written" },
      },
      {
        id: 2, order: 2, title: "The built-in templates", durationSeconds: 9,
        narration: "Each template is built for a different kind of content. Nightfall works best for deep technical articles. Spotlight brings energy and impact for YouTube. Whiteboard keeps pacing calm for education. Gridcraft uses editorial grids for marketing. Matrix brings a cyberpunk terminal aesthetic for developer content. Newspaper gives a classic newsprint editorial feel.",
        layout: "cascade_list",
        layoutProps: {
          title: "All Built-In Templates",
          items: [
            "Nightfall — cinematic dark theme with glass cards, great for technical deep dives",
            "Spotlight — bold typography and high-energy pacing, designed for YouTube and social",
            "Whiteboard — hand-drawn style with calm transitions, ideal for education",
            "Gridcraft — editorial bento grids, strong for marketing and product content",
            "Matrix — cyberpunk terminal aesthetic with typewriter text, built for developer content",
            "Newspaper — classic newsprint editorial with headlines and timelines, perfect for news and newsletters",
            "Custom — define your own colors, fonts, and animation style for full brand control",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Switch templates without losing work", durationSeconds: 7,
        narration: "You can switch templates at any time without losing your scene edits. The same content renders differently depending on the template, so you can preview multiple looks before publishing.",
        layout: "statement",
        layoutProps: { title: "Switch Templates Without Losing Work", highlightWord: "switch" },
      },
      {
        id: 4, order: 4, title: "Custom branded templates", durationSeconds: 7,
        narration: "The custom template builder lets you define brand colors, heading and body fonts, border radius, animation presets, and layout patterns. Every future video inherits the same identity automatically.",
        layout: "cascade_list",
        layoutProps: {
          title: "Build Your Own Brand Template",
          items: [
            "Define accent color, background, text, and surface colors",
            "Choose heading, body, and monospace fonts",
            "Set border radius and animation style",
            "Preview across different scene types before saving",
          ],
        },
      },
    ],
  },

  "url-automation": {
    template: "gridcraft",
    scenes: [
      {
        id: 1, order: 1, title: "How URL-to-video works", durationSeconds: 7,
        narration: "Blog2Video fetches the live page from any URL, reads its content, and builds a scene-by-scene video outline from the structure it finds. No copying, no reformatting, no prompts. The published page is the source.",
        layout: "editorial_body",
        layoutProps: { title: "How URL-to-Video Works" },
      },
      {
        id: 2, order: 2, title: "What happens when you paste a URL", durationSeconds: 8,
        narration: "The moment you paste a URL, Blog2Video fetches the page, extracts headings, body paragraphs, and structural elements, then maps each section into a video scene with narration adapted for listening.",
        layout: "bento_features",
        layoutProps: {
          title: "What Happens When You Paste a URL",
          features: [
            { icon: "🔗", label: "Fetch", description: "Reads the live page content directly from the URL" },
            { icon: "📐", label: "Structure", description: "Maps headings and sections into video scenes" },
            { icon: "🎙️", label: "Narrate", description: "Generates spoken narration from the written text" },
          ],
        },
      },
      {
        id: 3, order: 3, title: "URL-first vs manual workflow", durationSeconds: 8,
        narration: "The difference between URL-first and manual workflow is the starting point. Blog2Video starts from the published page. Manual workflows start from a blank script and require you to re-explain everything.",
        layout: "bento_compare",
        layoutProps: {
          title: "URL-First vs Manual Workflow",
          leftLabel: "Blog2Video",
          rightLabel: "Manual Process",
          leftDescription: "Paste the URL. Review the generated outline. Edit individual scenes. Render. The article is the script.",
          rightDescription: "Copy the text. Rewrite as a script. Lay out each scene manually. Record or generate narration. Repeat for every post.",
          verdict: "URL-first saves hours per video and scales to your entire archive",
        },
      },
      {
        id: 4, order: 4, title: "Batch processing your archive", durationSeconds: 7,
        narration: "Blog2Video supports bulk URL input so you can queue ten, fifty, or a hundred blog posts at once. Every video in the batch uses the same template and voice for consistent quality across your entire library.",
        layout: "editorial_body",
        layoutProps: { title: "Batch Process Your Entire Archive" },
      },
      {
        id: 5, order: 5, title: "Review and refine before publishing", durationSeconds: 7,
        narration: "After generation, the scene editor lets you review and adjust any scene individually. Change narration wording, swap a visual, or reorder scenes. Then export the final video for YouTube, your site, or social channels.",
        layout: "editorial_body",
        layoutProps: { title: "Review and Refine Before Publishing" },
      },
    ],
  },

  "scene-editor": {
    template: "matrix",
    scenes: [
      {
        id: 1, order: 1, title: "What the scene editor does", durationSeconds: 8,
        narration: "The AI scene editor gives you editorial control inside a programmatic pipeline. After Blog2Video generates a video from your content, you can click into any scene to adjust the narration, visuals, display text, or pacing.",
        layout: "terminal_text",
        layoutProps: { title: "The AI scene editor gives you editorial control inside a programmatic pipeline.", highlightWord: "editorial" },
      },
      {
        id: 2, order: 2, title: "What you can adjust per scene", durationSeconds: 8,
        narration: "Every scene in a Blog2Video project exposes controls for the narration script, the on-screen display text, the visual description that drives the image, and the scene duration.",
        layout: "data_stream",
        layoutProps: {
          title: "Scene Controls",
          items: [
            "Narration script — change the spoken words for any scene",
            "Display text — edit what appears on screen independently",
            "Visual description — adjust the image generation prompt",
            "Duration — lengthen or shorten individual scenes",
            "Order — drag scenes to rearrange the flow",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Edit one scene, keep the rest", durationSeconds: 7,
        narration: "The key advantage is selective editing. Change one scene without rebuilding the whole project. If scene four needs different narration or a new visual, edit just that scene and re-render only what changed.",
        layout: "terminal_text",
        layoutProps: { title: "Change one scene without rebuilding the whole project. Edit just what needs fixing.", highlightWord: "one" },
      },
      {
        id: 4, order: 4, title: "Programmatic meets editorial", durationSeconds: 7,
        narration: "Blog2Video generates the first draft programmatically from your article. The scene editor turns that draft into a polished final cut.",
        layout: "transmission",
        layoutProps: {
          title: "Precision Editing",
          phrases: [
            "Automation handles the structure",
            "You handle the nuance",
            "Programmatic generation meets editorial control",
          ],
        },
      },
      {
        id: 5, order: 5, title: "When to use the editor", durationSeconds: 7,
        narration: "Use the scene editor when a generated video is ninety percent right but one scene needs a tighter explanation, a different emphasis, or a removed tangent. The editor exists for precision, not for starting over.",
        layout: "terminal_text",
        layoutProps: { title: "The editor exists for precision. Not for starting over.", highlightWord: "precision" },
      },
    ],
  },

  "bulk-archive": {
    template: "nightfall",
    scenes: [
      {
        id: 1, order: 1, title: "Converting your blog archive", durationSeconds: 7,
        narration: "Blog2Video supports bulk URL input so you can process your entire blog archive instead of converting posts one at a time. Queue multiple URLs, apply one template, and get a consistent video library.",
        layout: "glass_narrative",
        layoutProps: { title: "Convert Your Entire Blog Archive" },
      },
      {
        id: 2, order: 2, title: "The bulk workflow", durationSeconds: 8,
        narration: "The bulk workflow scales the same three-step process across your entire content library. Every video in the batch inherits the same brand system.",
        layout: "glass_stack",
        layoutProps: {
          title: "The Bulk Conversion Workflow",
          items: [
            "Queue ten, fifty, or a hundred blog post URLs at once",
            "Select one template and voice — applied consistently to every video",
            "Blog2Video processes each post and generates a full scene outline",
            "Use the scene editor to spot-check individual videos before batch export",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Consistency at scale", durationSeconds: 7,
        narration: "The hardest part of creating a video library manually is keeping quality and branding consistent across every piece. Blog2Video enforces the same template, typography, pacing, and voice automatically.",
        layout: "glass_narrative",
        layoutProps: { title: "Consistent Quality at Any Scale" },
      },
      {
        id: 4, order: 4, title: "Which posts to prioritize", durationSeconds: 7,
        narration: "Start with posts that already have search traction, email engagement, or steady readership. These proven articles make the strongest videos because the content has already been validated by real readers.",
        layout: "glass_stack",
        layoutProps: {
          title: "Which Posts to Convert First",
          items: [
            "Posts with steady organic search traffic",
            "Evergreen tutorials and how-to guides",
            "High-engagement articles from newsletters",
            "Pillar content that anchors your topic authority",
          ],
        },
      },
    ],
  },

  "diagram-explainer": {
    template: "whiteboard",
    scenes: [
      {
        id: 1, order: 1, title: "Why diagrams need narration", durationSeconds: 7,
        narration: "Static diagrams force the reader to decode relationships on their own. A narrated video walks through each connection one step at a time, making complex systems, architectures, and flows accessible to broader audiences.",
        layout: "marker_story",
        layoutProps: { title: "Why Diagrams Need Narration" },
      },
      {
        id: 2, order: 2, title: "The before and after", durationSeconds: 7,
        narration: "The difference between a static diagram and a narrated explainer is the difference between handing someone a map and walking them through the route personally.",
        layout: "speech_bubble_dialogue",
        layoutProps: {
          title: "Before and After Blog2Video",
          leftThought: "This architecture diagram is hard to follow on its own...",
          rightThought: "The narrated video walked me through it step by step!",
          stats: [{ label: "Reader" }, { label: "Viewer" }],
        },
      },
      {
        id: 3, order: 3, title: "Why Whiteboard works for diagrams", durationSeconds: 7,
        narration: "The Whiteboard template uses a hand-drawn visual style that matches the informal, explanatory tone of diagram walkthroughs. The calm pacing gives viewers time to absorb each relationship before moving to the next.",
        layout: "stick_figure_scene",
        layoutProps: { title: "Whiteboard Matches the Explanatory Tone" },
      },
      {
        id: 4, order: 4, title: "Comprehension impact of video", durationSeconds: 7,
        narration: "Research consistently shows that narrated visual explanations improve comprehension compared to static images alone. The combination of voice, pacing, and sequential reveal reduces cognitive load.",
        layout: "stats_figures",
        layoutProps: {
          title: "Comprehension: Static vs Narrated",
          stats: [
            { label: "Static diagram", value: 40 },
            { label: "Narrated explainer", value: 85 },
          ],
        },
      },
    ],
  },

  "presentation-workflow": {
    template: "gridcraft",
    scenes: [
      {
        id: 1, order: 1, title: "The PPTX-to-video workflow", durationSeconds: 8,
        narration: "Blog2Video reads each slide in your PowerPoint, extracts the key content, and maps it into a scene-by-scene video outline. The result is a narrated video that stands on its own without a presenter.",
        layout: "bento_steps",
        layoutProps: {
          title: "PowerPoint to Video Workflow",
          steps: [
            { label: "Upload", description: "Drop your PPTX file into Blog2Video" },
            { label: "Extract", description: "Each slide's content becomes a video scene" },
            { label: "Narrate", description: "AI voiceover explains each slide clearly" },
            { label: "Share", description: "Publish to LMS, YouTube, or internal wiki" },
          ],
        },
      },
      {
        id: 2, order: 2, title: "Why decks need video adaptation", durationSeconds: 7,
        narration: "Most slide decks were designed to support a live presenter. Without the speaker, the deck loses context. Blog2Video replaces the presenter with AI narration so the video communicates the full message independently.",
        layout: "editorial_body",
        layoutProps: { title: "Why Decks Need Video Adaptation" },
      },
      {
        id: 3, order: 3, title: "Asynchronous viewing", durationSeconds: 7,
        narration: "The biggest advantage of deck-to-video conversion is asynchronous access. Team members, students, or customers can watch the presentation at their own pace, on any device, without scheduling a meeting or webinar.",
        layout: "editorial_body",
        layoutProps: { title: "Enable Asynchronous Viewing" },
      },
      {
        id: 4, order: 4, title: "The template replaces the speaker", durationSeconds: 7,
        narration: "The template replaces the speaker, not just the slides. Typography, pacing, and transitions are designed for self-guided viewing so the video is a complete standalone asset.",
        layout: "pull_quote",
        layoutProps: {
          quote: "The template replaces the speaker, not just the slides.",
          attribution: "Asynchronous-first design",
        },
      },
    ],
  },

  "newsletter-workflow": {
    template: "newspaper",
    scenes: [
      {
        id: 1, order: 1, title: "Newsletter to video", durationSeconds: 8,
        narration: "Blog2Video reads your Substack or newsletter archive directly from the published web URL. It extracts the issue structure, generates narration, and builds a scene-by-scene video you can share with audiences who never open email.",
        layout: "article_lead",
        layoutProps: {
          title: "Newsletter → Video",
          stats: [{ value: "72%", label: "of newsletter content never gets reused" }],
        },
      },
      {
        id: 2, order: 2, title: "The newsletter repurposing workflow", durationSeconds: 8,
        narration: "Paste the issue URL. Blog2Video reads the archive page, parses the content structure, and builds a narrated video. Choose a template that matches your newsletter voice and export for YouTube, social, or your site.",
        layout: "news_timeline",
        layoutProps: {
          title: "The Repurposing Workflow",
          stats: [
            { value: "Step 1", label: "Paste the Substack or newsletter archive URL" },
            { value: "Step 2", label: "Blog2Video extracts the issue structure into scenes" },
            { value: "Step 3", label: "Choose a template and voice that match your brand" },
            { value: "Step 4", label: "Export for YouTube, social, or embed on your site" },
          ],
        },
      },
      {
        id: 3, order: 3, title: "Unlocking the archive", durationSeconds: 7,
        narration: "Most newsletter archives sit untouched after the send. Blog2Video gives those issues a second life by turning them into discoverable video content that earns views long after the email was opened.",
        layout: "fact_check",
        layoutProps: {
          title: "The Archive Problem",
          leftThought: "Once an issue is sent, the content sits in the archive unused.",
          rightThought: "Blog2Video turns every past issue into a discoverable video asset with its own search and social reach.",
          stats: [{ label: "THE PROBLEM" }, { label: "THE SOLUTION" }],
        },
      },
      {
        id: 4, order: 4, title: "Reach new audiences", durationSeconds: 7,
        narration: "Subscribers read. Viewers watch. The content is the same, but the audience is different. Blog2Video bridges the gap between email-first and video-first audiences without duplicating the research.",
        layout: "data_snapshot",
        layoutProps: {
          title: "Two Audiences, One Source",
          stats: [
            { value: "Email", label: "Subscribers who open and read" },
            { value: "Video", label: "Viewers who watch and share" },
            { value: "Blog", label: "Readers who search and discover" },
          ],
        },
      },
    ],
  },

  "youtube-strategy": {
    template: "newspaper",
    scenes: [
      {
        id: 1, order: 1, title: "Blog plus YouTube as one system", durationSeconds: 8,
        narration: "The strongest system is not blog or YouTube — it is blog and YouTube working together. The article captures search intent, the video builds audience familiarity, and both link back to each other for compounding discovery.",
        layout: "news_headline",
        layoutProps: {
          title: "Blog + YouTube = Compounding Discovery",
          category: "Content Strategy",
          highlightWords: ["Blog", "YouTube", "Compounding"],
        },
      },
      {
        id: 2, order: 2, title: "YouTube-ready output from Blog2Video", durationSeconds: 8,
        narration: "Blog2Video structures your article for YouTube retention. The strongest insight moves to the hook, transitions are built between sections, and narration is adapted for listening instead of scanning.",
        layout: "article_lead",
        layoutProps: {
          title: "YouTube-Ready Output",
          stats: [{ value: "5x", label: "more retention with structured scenes vs raw narration" }],
        },
      },
      {
        id: 3, order: 3, title: "How the two channels reinforce each other", durationSeconds: 8,
        narration: "The blog post embeds the video. The YouTube description links back to the article. Both assets earn traffic independently and feed each other. This two-way relationship turns a one-off tutorial into a real content engine.",
        layout: "fact_check",
        layoutProps: {
          title: "Two-Channel Reinforcement",
          leftThought: "Blog post captures search traffic, earns backlinks, and embeds the video for on-page engagement. Readers discover the channel.",
          rightThought: "YouTube video builds audience familiarity, earns subscribers, and links back to the article. Viewers discover the blog.",
          stats: [{ label: "BLOG" }, { label: "YOUTUBE" }],
        },
      },
      {
        id: 4, order: 4, title: "A repeatable publishing workflow", durationSeconds: 8,
        narration: "With Blog2Video, every published blog post can become a YouTube video in minutes. The workflow is repeatable: write the article, paste the URL, generate the video, publish both. Your backlog of written content becomes a video library.",
        layout: "news_timeline",
        layoutProps: {
          title: "The Publishing Workflow",
          stats: [
            { value: "Write", label: "Publish the blog post on your site" },
            { value: "Paste", label: "Drop the URL into Blog2Video" },
            { value: "Generate", label: "AI builds scenes, narration, and transitions" },
            { value: "Publish", label: "Upload to YouTube with article link in description" },
          ],
        },
      },
    ],
  },
};

const TEMPLATE_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  nightfall: { accent: "#818CF8", bg: "#0A0A1A", text: "#E2E8F0" },
  spotlight: { accent: "#EF4444", bg: "#000000", text: "#FFFFFF" },
  whiteboard: { accent: "#1F2937", bg: "#F7F3E8", text: "#111827" },
  gridcraft: { accent: "#F97316", bg: "#FAFAFA", text: "#171717" },
  matrix: { accent: "#00FF41", bg: "#000000", text: "#00FF41" },
  newspaper: { accent: "#FFE34D", bg: "#FAFAF8", text: "#111111" },
};

const TEMPLATE_LABELS: Record<string, string> = {
  nightfall: "Nightfall",
  spotlight: "Spotlight",
  whiteboard: "Whiteboard",
  gridcraft: "Gridcraft",
  matrix: "Matrix",
  newspaper: "Newspaper",
};

interface BlogDemoPlayerProps {
  sceneKey: string;
}

export default function BlogDemoPlayer({ sceneKey }: BlogDemoPlayerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const set = SCENE_SETS[sceneKey] ?? SCENE_SETS["blog-workflow"];
  const templateId = set.template;
  const scenes = set.scenes;
  const colors = TEMPLATE_COLORS[templateId];
  const label = TEMPLATE_LABELS[templateId] || "Nightfall";
  const config = getTemplateConfig(templateId);
  const Composition = config.component as React.ComponentType<any>;

  const totalFrames = useMemo(() => {
    const fps = 30;
    return scenes.reduce((sum, s) => sum + Math.round(s.durationSeconds * fps), 0) + 60;
  }, [scenes]);

  const inputProps: any = {
    scenes,
    accentColor: colors.accent,
    bgColor: colors.bg,
    textColor: colors.text,
    logo: null,
    logoPosition: "bottom_right",
    logoOpacity: 0,
    logoSize: 0,
    aspectRatio: "landscape",
  };

  return (
    <div className="my-8">
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
        <div style={{ aspectRatio: "16/9", width: "100%", background: colors.bg }}>
          {mounted ? (
            <Player
              component={Composition}
              inputProps={inputProps}
              durationInFrames={totalFrames}
              compositionWidth={1920}
              compositionHeight={1080}
              fps={30}
              controls
              autoPlay
              loop
              acknowledgeRemotionLicense
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: colors.bg }}
            >
              <p style={{ color: colors.text, opacity: 0.5 }} className="text-sm">
                Loading {label} preview…
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs italic text-gray-400">
        Made using{" "}
        <a
          href="https://blog2video.app"
          className="text-purple-500 underline hover:text-purple-600"
        >
          blog2video.app
        </a>
      </p>
    </div>
  );
}
