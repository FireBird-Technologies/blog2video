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

  "preview-nightfall": {
    template: "nightfall",
    scenes: [
      {
        id: 1, order: 1, title: "Cinematic Title", durationSeconds: 7,
        narration: "The Cinematic Title layout opens with a full-frame headline that fades in with glass-morphism depth. It sets the tone for the entire video and works best as the opening scene for any technical deep dive or product story.",
        layout: "cinematic_title",
        layoutProps: { title: "Nightfall: Cinematic Dark Template" },
      },
      {
        id: 2, order: 2, title: "Glass Narrative", durationSeconds: 8,
        narration: "Glass Narrative presents body text on a translucent card with soft indigo glow behind it. The layout is designed for longer explanations where the viewer needs to absorb a full paragraph of context before moving to the next idea.",
        layout: "glass_narrative",
        layoutProps: { title: "Glass Narrative for Long-Form Explanation" },
      },
      {
        id: 3, order: 3, title: "Glass Code", durationSeconds: 8,
        narration: "Glass Code renders syntax-highlighted code on a dark glass card. Each line appears with monospace formatting, making it perfect for API examples, configuration snippets, and technical walkthroughs that need code to stay readable.",
        layout: "glass_code",
        layoutProps: {
          title: "Code Scene: API Example",
          codeLanguage: "typescript",
          codeLines: [
            "const video = await Blog2Video.create({",
            "  url: 'https://your-blog.com/post',",
            "  template: 'nightfall',",
            "  voice: 'rachel',",
            "});",
            "",
            "await video.render();",
          ],
        },
      },
      {
        id: 4, order: 4, title: "Glass Stack", durationSeconds: 8,
        narration: "Glass Stack presents a list of items on stacked glass cards. Each card animates in sequence, making it ideal for step-by-step processes, feature lists, and structured arguments that benefit from visual separation.",
        layout: "glass_stack",
        layoutProps: {
          title: "Nightfall Layouts",
          items: [
            "Cinematic Title — full-frame headline with glass depth and glow",
            "Glass Narrative — translucent card for body text and explanations",
            "Glass Code — syntax-highlighted code block on dark glass",
            "Kinetic Insight — animated quote with highlighted keyword",
            "Chapter Break — numbered section divider with subtitle",
          ],
        },
      },
      {
        id: 5, order: 5, title: "Kinetic Insight", durationSeconds: 7,
        narration: "Kinetic Insight animates a key quote or insight with one highlighted word that glows brighter than the rest. Use it for the defining statement of the video — the line viewers remember.",
        layout: "kinetic_insight",
        layoutProps: {
          quote: "Premium visuals from your existing content. No stock footage needed.",
          highlightWord: "Premium",
        },
      },
    ],
  },

  "preview-spotlight": {
    template: "spotlight",
    scenes: [
      {
        id: 1, order: 1, title: "Impact Title", durationSeconds: 7,
        narration: "Impact Title fills the frame with a bold headline against a black background. The typography is designed for maximum contrast and immediate attention, making it the ideal opening for any high-energy video.",
        layout: "statement",
        layoutProps: { title: "Spotlight: Bold Kinetic Template", highlightWord: "Bold" },
      },
      {
        id: 2, order: 2, title: "Versus Comparison", durationSeconds: 8,
        narration: "The Versus layout splits the screen into two halves with contrasting descriptions. It is built for direct comparisons — tool evaluations, before-and-after analyses, or any argument that benefits from a clear side-by-side format.",
        layout: "versus",
        layoutProps: {
          title: "Side-by-Side Comparison",
          leftLabel: "Blog2Video",
          rightLabel: "Manual Video",
          leftDescription: "Paste a URL. AI generates scenes, narration, and structure. Edit individual scenes. Render in minutes.",
          rightDescription: "Write a script from scratch. Record or generate footage. Edit timeline manually. Repeat for every post.",
        },
      },
      {
        id: 3, order: 3, title: "Cascade List", durationSeconds: 8,
        narration: "Cascade List reveals items one at a time in a cascading animation. Each item slides in from the side, creating a dynamic reveal that keeps viewers engaged through longer lists of features, steps, or benefits.",
        layout: "cascade_list",
        layoutProps: {
          title: "Spotlight Layouts",
          items: [
            "Impact Title — full-frame bold headline",
            "Statement — centered claim with highlighted keyword",
            "Versus — side-by-side comparison layout",
            "Cascade List — animated sequential item reveal",
            "Rapid Points — fast-paced phrase sequence",
            "Word Punch — single giant word that fills the frame",
          ],
        },
      },
      {
        id: 4, order: 4, title: "Rapid Points", durationSeconds: 7,
        narration: "Rapid Points displays short phrases one after another with hard cuts between each. The fast pacing creates urgency and momentum, ideal for hooks, social clips, and short-form content where every second counts.",
        layout: "rapid_points",
        layoutProps: {
          title: "Why Spotlight Works",
          phrases: [
            "Bold typography grabs attention instantly.",
            "High-contrast black and red design.",
            "Pacing built for viewer retention.",
            "Every layout earns the next second.",
          ],
        },
      },
      {
        id: 5, order: 5, title: "Statement", durationSeconds: 7,
        narration: "Statement centers a single powerful claim on screen with one word highlighted in the accent color. Use it for the thesis of the video — the one idea that anchors everything else.",
        layout: "statement",
        layoutProps: { title: "Built for YouTube. Designed for Attention.", highlightWord: "Attention" },
      },
    ],
  },

  "preview-whiteboard": {
    template: "whiteboard",
    scenes: [
      {
        id: 1, order: 1, title: "Drawn Title", durationSeconds: 7,
        narration: "The Drawn Title layout opens the whiteboard with a hand-drawn style headline on a warm paper background. The informal, approachable tone signals to viewers that this is educational content designed for learning, not just marketing.",
        layout: "marker_story",
        layoutProps: { title: "Whiteboard: Classroom-Friendly Template" },
      },
      {
        id: 2, order: 2, title: "Stick Figure Scene", durationSeconds: 7,
        narration: "Stick Figure Scene uses simple hand-drawn characters and scenarios to illustrate concepts. The deliberately informal visual style keeps focus on the explanation rather than the production, making complex ideas feel accessible.",
        layout: "stick_figure_scene",
        layoutProps: { title: "Visual Storytelling with Stick Figures" },
      },
      {
        id: 3, order: 3, title: "Stats Chart", durationSeconds: 8,
        narration: "Stats Chart displays comparative data as hand-drawn bar charts on the whiteboard. The animated bars reveal in sequence, making data comparisons easy to follow and remember in an educational context.",
        layout: "stats_chart",
        layoutProps: {
          title: "Teaching with Data",
          stats: [
            { label: "Manual video creation", value: 180 },
            { label: "Slide-to-video tools", value: 60 },
            { label: "Blog2Video", value: 5 },
          ],
        },
      },
      {
        id: 4, order: 4, title: "Speech Bubble Dialogue", durationSeconds: 8,
        narration: "Speech Bubble Dialogue shows two perspectives side by side in comic-style speech bubbles. It works well for before-and-after comparisons, student-teacher interactions, and contrasting viewpoints that benefit from a conversational format.",
        layout: "speech_bubble_dialogue",
        layoutProps: {
          title: "Before and After",
          leftThought: "This concept is hard to explain in text alone...",
          rightThought: "The narrated whiteboard video made it click in seconds!",
          stats: [{ label: "Student" }, { label: "Viewer" }],
        },
      },
      {
        id: 5, order: 5, title: "Marker Story", durationSeconds: 7,
        narration: "Marker Story presents a narrative on the whiteboard with marker-style text. The layout works for longer explanations that need the warmth and clarity of a real classroom presentation.",
        layout: "marker_story",
        layoutProps: { title: "Calm Pacing for Real Comprehension" },
      },
    ],
  },

  "preview-gridcraft": {
    template: "gridcraft",
    scenes: [
      {
        id: 1, order: 1, title: "Editorial Body", durationSeconds: 7,
        narration: "Editorial Body presents structured body text in a warm editorial grid. The layout brings magazine-quality typography and spacing to article content, making data-rich and list-heavy writing feel intentionally designed rather than generically rendered.",
        layout: "editorial_body",
        layoutProps: { title: "Gridcraft: Editorial Bento Template" },
      },
      {
        id: 2, order: 2, title: "Bento Steps", durationSeconds: 8,
        narration: "Bento Steps lays out a multi-step process in a structured grid where each step gets its own card. The layout is built for workflows, onboarding sequences, and any content that follows a clear progression from start to finish.",
        layout: "bento_steps",
        layoutProps: {
          title: "Workflow in Steps",
          steps: [
            { label: "Source", description: "Start with a published blog post or article" },
            { label: "Generate", description: "Blog2Video builds scenes from the content" },
            { label: "Review", description: "Edit individual scenes with the scene editor" },
            { label: "Publish", description: "Export to YouTube, Shorts, or embed" },
          ],
        },
      },
      {
        id: 3, order: 3, title: "Bento Compare", durationSeconds: 8,
        narration: "Bento Compare shows two approaches side by side in editorial cards with a verdict below. It is designed for product comparisons, workflow evaluations, and any content that asks the viewer to weigh two options.",
        layout: "bento_compare",
        layoutProps: {
          title: "Compare Two Approaches",
          leftLabel: "Content-First",
          rightLabel: "Prompt-First",
          leftDescription: "Start from the article. Structure preserved. Narration matches the writing.",
          rightDescription: "Start from a blank prompt. Re-explain everything. Output drifts.",
          verdict: "Content-first produces higher-fidelity video",
        },
      },
      {
        id: 4, order: 4, title: "Bento Features", durationSeconds: 8,
        narration: "Bento Features presents a feature grid with icons, labels, and short descriptions in a structured bento layout. Each feature card animates in sequence, creating a clean, scannable overview of capabilities or benefits.",
        layout: "bento_features",
        layoutProps: {
          title: "Gridcraft Layouts",
          features: [
            { icon: "📐", label: "Bento Steps", description: "Multi-step workflow progression" },
            { icon: "⚖️", label: "Bento Compare", description: "Side-by-side evaluation with verdict" },
            { icon: "📝", label: "Editorial Body", description: "Magazine-quality body text" },
          ],
        },
      },
      {
        id: 5, order: 5, title: "Pull Quote", durationSeconds: 7,
        narration: "Pull Quote highlights a key statement with editorial styling and attribution. Use it for the defining insight of the section — the quote that viewers screenshot or remember.",
        layout: "pull_quote",
        layoutProps: {
          quote: "Structure your content like a magazine. Render it like a video.",
          attribution: "The Gridcraft Approach",
        },
      },
    ],
  },

  "preview-matrix": {
    template: "matrix",
    scenes: [
      {
        id: 1, order: 1, title: "Terminal Text", durationSeconds: 8,
        narration: "Terminal Text types out content character by character in green monospace font on a black background with a blinking cursor. The typewriter effect creates the feeling of a live terminal session, perfect for developer audiences who think in code.",
        layout: "terminal_text",
        layoutProps: { title: "Matrix: a cyberpunk terminal template for developer content and technical explainers.", highlightWord: "cyberpunk" },
      },
      {
        id: 2, order: 2, title: "Data Stream", durationSeconds: 8,
        narration: "Data Stream reveals items one at a time with terminal prompt prefixes and index numbers. Each item slides in like an incoming data packet, creating a sequential reveal that feels like watching a log stream in real time.",
        layout: "data_stream",
        layoutProps: {
          title: "Matrix Layouts",
          items: [
            "Terminal Text — character-by-character typewriter with blinking cursor",
            "Data Stream — incoming items with terminal prompt prefixes",
            "Fork Choice — red pill / blue pill split comparison",
            "Cipher Metric — number decoded from cipher noise with roll-up",
            "Transmission — intercepted signal phrases with hard cuts",
          ],
        },
      },
      {
        id: 3, order: 3, title: "Fork Choice", durationSeconds: 8,
        narration: "Fork Choice splits the screen into a red-tinted left half and blue-tinted right half with a green neon divider. The layout is built for binary decisions, tool comparisons, and any content that presents two contrasting paths.",
        layout: "fork_choice",
        layoutProps: {
          title: "Choose Your Approach",
          leftLabel: "Automated",
          rightLabel: "Manual",
          leftDescription: "Paste URL. AI generates structured video. Edit scenes individually.",
          rightDescription: "Write script. Record screen. Edit timeline. Repeat per post.",
        },
      },
      {
        id: 4, order: 4, title: "Transmission", durationSeconds: 7,
        narration: "Transmission displays short phrases sequentially like intercepted signals. Each phrase appears centered with a signal-intercepted prefix and hard cuts between messages, creating urgency and a cinematic hacker aesthetic.",
        layout: "transmission",
        layoutProps: {
          title: "Signal Phrases",
          phrases: [
            "Content structure extracted",
            "Scenes generated from source",
            "Narration synthesized",
            "Video rendered and ready",
          ],
        },
      },
      {
        id: 5, order: 5, title: "Glitch Punch", durationSeconds: 7,
        narration: "Glitch Punch fills the frame with a single word that decodes from cipher characters and slams into place with a neon glow pulse. Maximum impact for the single most important word or number in the video.",
        layout: "glitch_punch",
        layoutProps: { word: "MATRIX" },
      },
    ],
  },

  "preview-newspaper": {
    template: "newspaper",
    scenes: [
      {
        id: 1, order: 1, title: "News Headline", durationSeconds: 8,
        narration: "News Headline opens with a large serif title on vintage newsprint texture with shattering paper shards that assemble into the final layout. Highlighted words in yellow create emphasis, and the 3D camera movement adds cinematic depth to the editorial format.",
        layout: "news_headline",
        layoutProps: {
          title: "Newspaper: Editorial Video Template",
          category: "Template Showcase",
          highlightWords: ["Newspaper", "Editorial", "Template"],
        },
      },
      {
        id: 2, order: 2, title: "Article Lead", durationSeconds: 8,
        narration: "Article Lead presents body text with a typeset drop-cap opening and a bold stat pull-quote on the side. The layout brings the classic newspaper above-the-fold experience to video, making newsletters and long-form commentary feel authoritative.",
        layout: "article_lead",
        layoutProps: {
          title: "The Story",
          stats: [{ value: "6", label: "built-in layouts for editorial content" }],
        },
      },
      {
        id: 3, order: 3, title: "Fact Check", durationSeconds: 8,
        narration: "Fact Check places two perspectives side by side — a claim on the left and the facts on the right — with labeled badges and a verdict below. The layout is designed for analysis, myth-busting, and any content that contrasts perception with reality.",
        layout: "fact_check",
        layoutProps: {
          title: "Fact Check",
          leftThought: "AI video tools produce generic, low-quality output from any article.",
          rightThought: "Blog2Video preserves article structure, code blocks, and arguments in the generated video because the article is the source.",
          stats: [{ label: "THE CLAIM" }, { label: "THE FACTS" }],
        },
      },
      {
        id: 4, order: 4, title: "News Timeline", durationSeconds: 8,
        narration: "News Timeline presents a sequence of events along a vertical spine with animated entry and a colored progress indicator. Each event has a bold value and description, making it ideal for chronological narratives, release histories, and workflow progressions.",
        layout: "news_timeline",
        layoutProps: {
          title: "How It Works",
          stats: [
            { value: "Step 1", label: "Paste the article or newsletter URL" },
            { value: "Step 2", label: "Blog2Video extracts structure into scenes" },
            { value: "Step 3", label: "Pick a voice and review the outline" },
            { value: "Step 4", label: "Render and publish across channels" },
          ],
        },
      },
      {
        id: 5, order: 5, title: "Data Snapshot", durationSeconds: 7,
        narration: "Data Snapshot displays metrics in animated cards with large numbers, yellow accent underlines, and label text. The layout brings the data-forward aesthetic of a newspaper infographic to video, making statistics and KPIs visually memorable.",
        layout: "data_snapshot",
        layoutProps: {
          title: "By the Numbers",
          stats: [
            { value: "6", label: "Newspaper layouts" },
            { value: "3D", label: "Camera movement" },
            { value: "100+", label: "AI voices" },
          ],
        },
      },
    ],
  },

  "preview-newscast": {
    template: "newscast",
    scenes: [
      {
        id: 1,
        order: 1,
        title: "Cinematic Title",
        durationSeconds: 7,
        narration:
          "The Cinematic Title opens the Newscast template on a deep navy field with optional globe, scan line, and breaking headline treatment — the same on-air opener pattern used for briefings and lead stories.",
        layout: "cinematic_title",
        layoutProps: {
          title: "Newscast Broadcast Desk",
          tickerItems: ["BREAKING", "LIVE COVERAGE", "WORLD DESK", "UPDATES"],
          lowerThirdTag: "LIVE",
          lowerThirdHeadline: "Template preview",
          lowerThirdSub: "Cinematic opener with globe, chrome, and glass stack",
        },
      },
      {
        id: 2,
        order: 2,
        title: "Glass Narrative",
        durationSeconds: 8,
        narration:
          "Glass Narrative places your story on a frosted navy card with red top accent and category tag. It is built for the main explanatory paragraph of a briefing — readable, authoritative, and broadcast-paced.",
        layout: "glass_narrative",
        layoutProps: {
          title: "Glass Narrative for briefings",
          category: "WORLD AFFAIRS",
          tickerItems: ["CONTEXT", "ANALYSIS", "ON THE RECORD"],
          lowerThirdTag: "BRIEFING",
          lowerThirdHeadline: "Main story beat",
          lowerThirdSub: "Narrative glass card with editorial pacing",
        },
      },
      {
        id: 3,
        order: 3,
        title: "Glow Metric",
        durationSeconds: 7,
        narration:
          "Glow Metric surfaces one to three key numbers with animated rings and steel labels — ideal for KPIs, poll results, and hard stats that need to anchor the segment.",
        layout: "glow_metric",
        layoutProps: {
          metrics: [
            { value: "48", label: "Markets up", suffix: "%" },
            { value: "12", label: "Nations signed", suffix: "" },
          ],
          tickerItems: ["DATA", "MARKETS", "NUMBERS"],
          lowerThirdTag: "DATA",
          lowerThirdHeadline: "Key figures",
          lowerThirdSub: "On-air metrics with glow treatment",
        },
      },
      {
        id: 4,
        order: 4,
        title: "Kinetic Insight",
        durationSeconds: 7,
        narration:
          "Kinetic Insight animates a single quote with one highlighted word in crimson — the soundbite viewers remember from the segment.",
        layout: "kinetic_insight",
        layoutProps: {
          quote: "The story is not the headline — it is the verification behind it.",
          highlightWord: "verification",
          attribution: "— Editor in Chief · March 2026",
          tickerItems: ["QUOTE", "INSIGHT"],
          lowerThirdTag: "TAKEAWAY",
          lowerThirdHeadline: "Key line",
          lowerThirdSub: "Pull quote with kinetic emphasis",
        },
      },
      {
        id: 5,
        order: 5,
        title: "Data Visualization",
        durationSeconds: 8,
        narration:
          "Data Visualization renders bar, line, or pie data from your scene with grid, neon accents, and ticker rail — so charts feel like part of the broadcast, not a pasted slide.",
        layout: "data_visualization",
        layoutProps: {
          title: "Segment share",
          barChartRows: [
            { label: "North", value: "40" },
            { label: "South", value: "35" },
            { label: "East", value: "25" },
          ],
          tickerItems: ["CHARTS", "LIVE DATA", "ON AIR"],
          lowerThirdTag: "DATA",
          lowerThirdHeadline: "Chart overview",
          lowerThirdSub: "Bars update with extracted numbers",
        },
      },
    ],
  },

  "preview-default": {
    template: "default",
    scenes: [
      {
        id: 1, order: 1, title: "Structured Explainer Opening", durationSeconds: 7,
        narration: "The Geometric Explainer template opens with a clean hero layout on a white background. The structured hierarchy and deliberate spacing establish an educational tone from the first frame, signaling that this video prioritizes clarity over flash.",
        layout: "hero_image",
        layoutProps: { title: "Geometric Explainer: Clarity-First Template" },
      },
      {
        id: 2, order: 2, title: "Text Narration", durationSeconds: 8,
        narration: "Text Narration presents body text in a structured, readable format. The layout is designed for tutorials and walkthroughs where the viewer needs to follow a line of reasoning step by step without distraction.",
        layout: "text_narration",
        layoutProps: { title: "Body Text for Tutorials and Walkthroughs" },
      },
      {
        id: 3, order: 3, title: "Code Block", durationSeconds: 8,
        narration: "Code Block renders syntax-highlighted code in a clean monospace layout. Indentation, line spacing, and formatting carry over from the original article, making it ideal for technical tutorials that teach by example.",
        layout: "code_block",
        layoutProps: {
          title: "Code Block: Technical Tutorial",
          codeLanguage: "typescript",
          codeLines: [
            "import { Blog2Video } from 'blog2video';",
            "",
            "const video = await Blog2Video.fromUrl(",
            "  'https://your-blog.com/tutorial'",
            ");",
            "",
            "await video.selectTemplate('default');",
            "await video.render({ format: '1080p' });",
          ],
        },
      },
      {
        id: 4, order: 4, title: "Flow Diagram", durationSeconds: 8,
        narration: "Flow Diagram visualizes a process as connected steps. The layout maps directly from the article's workflow sections, turning linear instructions into a visual sequence that is easier to follow and remember.",
        layout: "bullet_list",
        layoutProps: {
          title: "How a Blog Becomes a Video",
          items: [
            "Paste the article URL into Blog2Video",
            "AI extracts headings, paragraphs, and code blocks",
            "Each section becomes a scene with the right layout",
            "Review narration and edit individual scenes",
            "Render and export to YouTube, Shorts, or embed",
          ],
        },
      },
      {
        id: 5, order: 5, title: "Comparison View", durationSeconds: 7,
        narration: "The Comparison layout presents two approaches side by side. It is built for articles that evaluate tools, compare methods, or contrast before-and-after states — common patterns in technical writing.",
        layout: "comparison",
        layoutProps: {
          title: "Content-First vs Prompt-First",
          leftLabel: "Geometric Explainer",
          rightLabel: "Generic AI Video",
          leftDescription: "Reads article structure. Preserves code and lists. Educational pacing.",
          rightDescription: "Starts from a prompt. Structure is guessed. Details are lost.",
        },
      },
    ],
  },
};

const TEMPLATE_COLORS: Record<string, { accent: string; bg: string; text: string }> = {
  default: { accent: "#7C3AED", bg: "#FFFFFF", text: "#000000" },
  nightfall: { accent: "#818CF8", bg: "#0A0A1A", text: "#E2E8F0" },
  spotlight: { accent: "#EF4444", bg: "#000000", text: "#FFFFFF" },
  whiteboard: { accent: "#1F2937", bg: "#F7F3E8", text: "#111827" },
  gridcraft: { accent: "#F97316", bg: "#FAFAFA", text: "#171717" },
  matrix: { accent: "#00FF41", bg: "#000000", text: "#00FF41" },
  newspaper: { accent: "#FFE34D", bg: "#FAFAF8", text: "#111111" },
  newscast: { accent: "#E82020", bg: "#060614", text: "#B8C8E0" },
};

const TEMPLATE_LABELS: Record<string, string> = {
  default: "Geometric Explainer",
  nightfall: "Nightfall",
  spotlight: "Spotlight",
  whiteboard: "Whiteboard",
  gridcraft: "Gridcraft",
  matrix: "Matrix",
  newspaper: "Newspaper",
  newscast: "Newscast",
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
