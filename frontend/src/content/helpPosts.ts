import type { HelpPost } from "./seoTypes";

const helpFaq = (topic: string) => [
  {
    question: `Is this ${topic} walkthrough for new users?`,
    answer:
      "Yes. The steps are written for someone using Blog2Video for the first time, with the exact product areas called out before each action.",
  },
  {
    question: "Can I follow the written steps without watching the video?",
    answer:
      "Yes. The embedded explainer is there for quick visual orientation, but every action is also explained in the numbered steps.",
  },
];

export const helpPosts: HelpPost[] = [
  {
    slug: "how-to-create-a-project",
    title: "How to Create a Project in Blog2Video",
    description:
      "Create a new Blog2Video project from a URL or uploaded document, choose a template and voice, then generate your first video.",
    category: "Getting started",
    heroImage: "/og-image-v2.png",
    heroImageAlt: "Blog2Video help guide for creating a new video project.",
    publishedAt: "2026-05-05",
    readTime: "5 min read",
    heroEyebrow: "Help / How-to",
    heroTitle: "How to create a project",
    heroDescription:
      "Use this step-by-step guide to turn a blog post, article, PDF, or document into a new Blog2Video project.",
    primaryKeyword: "how to create a Blog2Video project",
    keywordVariant: "create a project in Blog2Video, turn an article into a video, turn a blog post into a video",
    relatedPaths: ["/blog-to-video", "/url-to-video", "/templates/geometric-explainer", "/help/how-to-edit-a-scene"],
    steps: [
      {
        title: "Step 1: Open the dashboard and click New",
        body: [
          "After signing in, go to the dashboard. Click the New button to open the project creation flow.",
          "The project wizard is split into three parts: Project, Template, and Voice. You can move through them in order without needing to write a video script manually.",
        ],
        videoKey: "create-project",
      },
      {
        title: "Step 2: Add your source content",
        body: [
          "Paste a published blog URL, article URL, or upload a supported document. Blog2Video uses this source as the script foundation for the generated scenes.",
          "If you are creating multiple videos, use the bulk option so several URLs can share the same template and voice settings.",
        ],
        bullets: [
          "Use a live URL when the post is already published.",
          "Use upload when the source is a PDF, DOCX, slide deck, or internal document.",
          "Give the project a recognizable name if the title is not obvious from the source.",
        ],
      },
      {
        title: "Step 3: Choose a template",
        body: [
          "Pick the visual style that matches the content. Educational guides usually work well with Whiteboard or Geometric Explainer, while product or YouTube-style posts often work well with Spotlight, Gridcraft, or Nightfall.",
          "You can preview templates before continuing, so choose based on pacing and readability rather than only the thumbnail.",
        ],
      },
      {
        title: "Step 4: Choose a voice",
        body: [
          "Select a voice gender, accent, or saved custom voice. If you do not want narration, choose the no voiceover option.",
          "Voice settings are applied when the project is created, so preview the voice before generating if the audio tone matters for your brand.",
        ],
      },
      {
        title: "Step 5: Generate the project",
        body: [
          "Click the create or generate action to start processing. Blog2Video extracts the source structure, creates scenes, writes narration, and prepares a project page where you can review the result.",
          "When the project opens, use the Scenes tab to inspect each scene before rendering or exporting.",
        ],
        bullets: [
          "Wait for generation to finish before editing scenes.",
          "Review the first scene and the closing scene first because they shape the viewer's first and last impression.",
        ],
      },
    ],
    faq: helpFaq("project creation"),
  },
  {
    slug: "how-to-edit-a-scene",
    title: "How to Edit a Scene in Blog2Video",
    description:
      "Open a generated scene, adjust narration, on-screen text, layout, and visuals, then save or regenerate only that scene.",
    category: "Editing",
    heroImage: "/og-image-v2.png",
    heroImageAlt: "Blog2Video help guide for editing an individual scene.",
    publishedAt: "2026-05-05",
    readTime: "6 min read",
    heroEyebrow: "Help / How-to",
    heroTitle: "How to edit a scene",
    heroDescription:
      "Fine-tune one scene without rebuilding the entire video. Use this guide when the draft is close but one moment needs more control.",
    primaryKeyword: "how to edit a Blog2Video scene",
    keywordVariant: "edit a scene in Blog2Video",
    relatedPaths: ["/scene-editor", "/blog-to-video", "/help/how-to-change-voiceover", "/help/how-to-change-template-post-creation"],
    steps: [
      {
        title: "Step 1: Open the project",
        body: [
          "From the dashboard, open the project you want to improve. Wait until the generated scenes are visible before editing.",
          "If the video is still processing, let generation finish first so every scene has text, layout, and timing data.",
        ],
        videoKey: "edit-scene",
      },
      {
        title: "Step 2: Go to the Scenes tab",
        body: [
          "Select the Scenes tab in the project page. This shows each generated scene in order, including the title, narration, and visual preview.",
          "Find the scene that needs a change. You can usually identify it by the title or the on-screen text.",
        ],
      },
      {
        title: "Step 3: Open the scene editor",
        body: [
          "Click the edit action on the scene card. The scene editor opens as a modal with controls for manual edits and AI-assisted regeneration.",
          "Use manual editing when you know exactly what to change. Use AI editing when you want Blog2Video to rewrite or regenerate part of the scene from instructions.",
        ],
      },
      {
        title: "Step 4: Adjust text, narration, layout, or visuals",
        body: [
          "Edit the title, display text, narration script, layout, image prompt, or image framing. Keep the change focused so the scene still fits the surrounding sequence.",
          "If you change narration, check whether the voiceover should be regenerated for that scene.",
        ],
        bullets: [
          "Display text controls what viewers read on screen.",
          "Narration controls what the voice says.",
          "Layout controls how the scene is arranged visually.",
          "Image controls help fix framing or replace the visual direction.",
        ],
      },
      {
        title: "Step 5: Save and review the scene",
        body: [
          "Save the scene and return to the project preview. Play through the edited moment in context to make sure the pacing still feels natural.",
          "If the edit changes the meaning of the scene, check the next scene too so the transition still makes sense.",
        ],
      },
    ],
    faq: helpFaq("scene editing"),
  },
  {
    slug: "how-to-change-voiceover",
    title: "How to Change Voiceover in Blog2Video",
    description:
      "Choose a voice during project creation, or update one scene's narration and regenerate its voiceover after generation.",
    category: "Voiceover",
    heroImage: "/og-image-v2.png",
    heroImageAlt: "Blog2Video help guide for changing voiceover.",
    publishedAt: "2026-05-05",
    readTime: "5 min read",
    heroEyebrow: "Help / How-to",
    heroTitle: "How to change voiceover",
    heroDescription:
      "Learn where voice settings live, what can be changed during project creation, and how to regenerate voiceover for an edited scene.",
    primaryKeyword: "how to change voiceover in Blog2Video",
    keywordVariant: "Blog2Video voiceover settings",
    relatedPaths: ["/ai-voiceover-for-blog-videos", "/blog-to-video", "/help/how-to-create-a-project", "/help/how-to-edit-a-scene"],
    steps: [
      {
        title: "Step 1: Choose the main voice when creating the project",
        body: [
          "The main voice is selected in the Voice step of the project wizard. Pick the gender, accent, or saved custom voice before you generate the project.",
          "This is the best time to set the overall sound of the video because the project is built with that voice choice.",
        ],
        videoKey: "change-voiceover",
      },
      {
        title: "Step 2: Preview the voice before generating",
        body: [
          "Use voice preview when available so you know how the narration will sound before the project is created.",
          "Choose no voiceover if you plan to add audio elsewhere or only need visual slides.",
        ],
      },
      {
        title: "Step 3: Open a scene when narration needs a fix",
        body: [
          "After generation, open the project, go to Scenes, and edit the scene with narration that needs to change.",
          "Blog2Video supports per-scene narration edits, which is useful when one line sounds too long, too generic, or slightly off-topic.",
        ],
      },
      {
        title: "Step 4: Edit the narration text",
        body: [
          "In the scene editor, update the narration script. Write it the way you want the voice to say it, not just the way it would read in a blog paragraph.",
          "Shorter sentences usually sound better in generated voiceover because the pacing is easier to follow.",
        ],
      },
      {
        title: "Step 5: Turn on regenerate voiceover and save",
        body: [
          "Enable the regenerate voiceover option for that scene, then save or regenerate. Blog2Video updates the spoken audio for the edited scene while keeping the rest of the project intact.",
          "Play the scene afterward to confirm that the new narration matches the on-screen text and timing.",
        ],
        bullets: [
          "Use this for scene-level voiceover fixes.",
          "For a completely different voice across the whole project, choose the voice carefully during project creation.",
        ],
      },
    ],
    faq: [
      ...helpFaq("voiceover"),
      {
        question: "Can I swap the entire project voice after creation?",
        answer:
          "The current product flow selects the main voice during project creation. After generation, the supported edit path is changing narration for a scene and regenerating that scene's voiceover.",
      },
    ],
  },
  {
    slug: "how-to-create-a-custom-template",
    title: "How to Create a Custom Template in Blog2Video",
    description:
      "Create a branded custom template from a reference URL, adjust its theme, and save it for future videos.",
    category: "Templates",
    heroImage: "/og-image-v2.png",
    heroImageAlt: "Blog2Video help guide for creating a custom template.",
    publishedAt: "2026-05-05",
    readTime: "6 min read",
    heroEyebrow: "Help / How-to",
    heroTitle: "How to create a custom template",
    heroDescription:
      "Use your website or brand system as the starting point for a reusable Blog2Video template.",
    primaryKeyword: "how to create a custom Blog2Video template",
    keywordVariant: "Blog2Video custom template",
    relatedPaths: ["/custom-branded-video-templates", "/templates/geometric-explainer", "/help/how-to-change-template-post-creation"],
    steps: [
      {
        title: "Step 1: Open the Templates area",
        body: [
          "Go to the dashboard and open the Templates area. This is where saved custom templates are listed and where new ones can be created.",
          "If you are starting from the project wizard, use the custom template path from the template selection step.",
        ],
        videoKey: "custom-template",
      },
      {
        title: "Step 2: Start the custom template creator",
        body: [
          "Click the action to create or craft a custom template. The creator asks for a reference source that Blog2Video can use to understand your brand style.",
          "A website URL is usually the fastest input because it gives the system colors, typography, spacing, and visual direction.",
        ],
      },
      {
        title: "Step 3: Enter a reference URL and extract the theme",
        body: [
          "Paste your website or landing page URL, then run theme extraction. Blog2Video analyzes the page and creates a starting theme from the brand it finds.",
          "Use the extraction as a draft, not a final decision. You can still adjust the theme before saving.",
        ],
      },
      {
        title: "Step 4: Adjust the brand settings",
        body: [
          "Review the accent color, background color, text color, font direction, border radius, and supported video style. Tune anything that does not match your brand.",
          "Preview the template across a few scene types so you know it works beyond the opening frame.",
        ],
        bullets: [
          "Accent color should be strong enough for buttons, highlights, and progress states.",
          "Text color should remain readable against the chosen background.",
          "Choose a video style that matches how your team explains ideas.",
        ],
      },
      {
        title: "Step 5: Create and reuse the template",
        body: [
          "Save the custom template. Generating a custom template takes around 5–10 minutes; once it is generated and available, select it during project creation or apply it to an existing project through the template change flow.",
          "Use the same custom template across related videos to make your content library feel consistent.",
        ],
      },
    ],
    faq: [
      ...helpFaq("custom template"),
      {
        question: "How long does it take to create a custom template?",
        answer:
          "Generating a custom template takes around 5–10 minutes. Once it's ready, it appears in the Templates area with a green Custom badge.",
      },
    ],
  },
  {
    slug: "how-to-change-template-post-creation",
    title: "How to Change Template After Project Creation in Blog2Video",
    description:
      "Switch a generated project to a new built-in or custom template while preserving narration, display text, and voiceovers.",
    category: "Templates",
    heroImage: "/og-image-v2.png",
    heroImageAlt: "Blog2Video help guide for changing a project template after creation.",
    publishedAt: "2026-05-05",
    readTime: "5 min read",
    heroEyebrow: "Help / How-to",
    heroTitle: "How to change template after project creation",
    heroDescription:
      "If the content is right but the visual style is not, rebuild the scene layouts around a different template.",
    primaryKeyword: "change Blog2Video template after project creation",
    keywordVariant: "switch project template in Blog2Video",
    relatedPaths: ["/templates/geometric-explainer", "/custom-branded-video-templates", "/help/how-to-create-a-custom-template", "/help/how-to-edit-a-scene"],
    steps: [
      {
        title: "Step 1: Open the generated project",
        body: [
          "Go to the dashboard and open the project whose template you want to change. This works best after scenes have already been generated.",
          "You do not need to recreate the project just because the visual style needs to change.",
        ],
        videoKey: "change-template",
      },
      {
        title: "Step 2: Go to project settings",
        body: [
          "Open the project settings area and find the current template preview. This shows the template currently assigned to the project.",
          "Click Change template to open the template picker.",
        ],
      },
      {
        title: "Step 3: Pick a built-in or custom template",
        body: [
          "Use the Built-in tab for standard Blog2Video templates, or the Custom tab for templates your workspace has created.",
          "Preview the new style before applying it. A high-energy template can change the feel of the same script dramatically.",
        ],
      },
      {
        title: "Step 4: Confirm the relayout",
        body: [
          "Confirm the template change when prompted. Blog2Video rebuilds scene layouts for the new template while preserving the important project content.",
          "The goal is to keep narration, display text, and voiceovers while adapting the visuals to the new template system.",
        ],
        bullets: [
          "Narration is preserved.",
          "Display text is preserved.",
          "Voiceovers are preserved.",
          "Scene layouts are regenerated for the selected template.",
        ],
      },
      {
        title: "Step 5: Review the updated scenes",
        body: [
          "After the relayout finishes, play through the project again. Check scenes with long text first because different templates handle space differently.",
          "If one scene needs adjustment, use the scene editor rather than changing the whole template again.",
        ],
      },
    ],
    faq: helpFaq("template switching"),
  },
];

export function getHelpPost(slug: string): HelpPost | undefined {
  return helpPosts.find((post) => post.slug === slug);
}
