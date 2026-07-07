import type { SupportDoc } from "./supportTypes";

export const userManual: SupportDoc = {
  id: "support:user-manual",
  title: "Blog2Video User Manual — Complete Editing Guide",
  description:
    "A complete guide to every editing option in Blog2Video: creating projects, editing scenes, changing fonts and colors, managing images, configuring audio, and exporting your video.",
  primaryKeyword: "blog2video editing guide",
  keywordVariant: "blog2video how to edit scenes templates fonts colors",
  route: "/help/user-manual",
  relatedPaths: ["/dashboard", "/projects", "/help"],
  headings: [
    "Creating a project from a URL",
    "Creating a project from a file upload",
    "Bulk video creation",
    "Choosing a template",
    "All available templates",
    "Video style options",
    "Voice and audio settings",
    "Branding and colors",
    "Scenes tab — overview",
    "Editing a scene manually",
    "Layout-specific fields",
    "Per-scene typography controls",
    "AI editing a scene",
    "AI editing usage limits",
    "Image management",
    "Image framing and focus",
    "Settings tab — fonts",
    "Settings tab — colors",
    "Settings tab — template change",
    "Logo settings",
    "Audio tab — playback and speed",
    "Render and export",
    "Download formats",
    "Embed and share",
    "Aspect ratio conversion",
    "AI Chat panel",
    "Script tab",
    "Reordering scenes",
  ],
  faq_questions: [
    "How do I create a project from a URL?",
    "How do I upload a file to create a video?",
    "How do I create multiple videos at once?",
    "What is bulk video creation?",
    "How do I use bulk links?",
    "How do I change the template?",
    "What templates are available?",
    "What is the difference between Explainer, Storytelling, and Promotional styles?",
    "How do I change the font for all scenes?",
    "How do I change the font size?",
    "How do I change the accent color?",
    "How do I change the background color?",
    "How do I edit a scene?",
    "How do I change the layout of a scene?",
    "How do I reorder scenes?",
    "How do I add or change an image in a scene?",
    "How do I generate an AI image for a scene?",
    "How do I adjust image framing or zoom?",
    "How do I upload a logo?",
    "How do I change the logo position?",
    "How do I change the logo size or opacity?",
    "How do I use AI to edit a scene?",
    "How many AI edits do I get on the free plan?",
    "How do I change the voiceover for a scene?",
    "How do I render the video?",
    "How do I download the video?",
    "How do I export slides as a PDF or PowerPoint?",
    "How do I share the video with a link?",
    "How do I embed the video on a website?",
    "How do I convert to portrait mode for TikTok or Reels?",
    "How do I change the playback speed?",
    "How do I view the narration script?",
    "How do I use the AI chat to edit my video?",
    "How do I create a voice clone?",
    "What video lengths are available?",
    "What languages are supported?",
  ],
  body: `
Blog2Video User Manual — Complete Editing Guide

== HOW TO CHANGE FONT (FONT FAMILY AND SIZE) ==

To change the font for your entire video:
1. Open your project and click the Settings tab.
2. Under "Font", open the Font Family dropdown and choose from 16+ options: Inter, Roboto Slab, Patrick Hand, Arimo, Archivo Black, Poppins, Montserrat, Merriweather, Playfair Display, Oswald, Lora, Fira Code, Righteous, and more.
3. Selecting a font immediately updates all scenes to use that typeface.

To change font size:
- Global title font size: slider from 20–200px. Sets the heading size for all scenes.
- Global display text size: slider from 12–80px. Sets the body text size for all scenes.
- Click "Apply to all scenes" to push these values to every scene at once.
- To change font size for one specific scene only: open the scene edit modal (Manual tab) and use the per-scene typography sliders there.

== HOW TO CHANGE COLORS (BACKGROUND, ACCENT, TEXT) ==

To change background color, accent color, or text color:
1. Open your project and click the Settings tab.
2. Under "Colors", you will see three color pickers:
   - Background color: The main background color shown behind all scenes.
   - Accent color: The primary highlight/brand color used for titles, underlines, and icons.
   - Text color: The color of body and description text.
3. Click any color swatch to open the color picker, or type a hex code directly (e.g. #1A1A2E).
4. Click "Save colors" to apply changes to all scenes.

You can also set colors during project creation (Step 3 — Branding).

== HOW TO CHANGE THE TEMPLATE ==

To switch the template on an existing project:
1. Open your project and click the Settings tab.
2. Find the Template section and open the template dropdown.
3. Choose any built-in template (Geometric Explainer, Nightfall, Gridcraft, Spotlight, Matrix, Stick Man, Newspaper, Newscast, Black Swan, Mosaic, Bloomberg, Chronicle) or a custom template you have created.
4. Click "Apply template". Blog2Video reassigns every scene to the closest matching layout in the new template.

Note: Switching templates may change scene layouts. Review all scenes after switching.

== ALL AVAILABLE TEMPLATES ==

Built-in templates: Geometric Explainer (default, clean purple/white), Nightfall (dark cinematic glass), Gridcraft (warm bento editorial), Spotlight (bold kinetic typography), Matrix (digital rain hacker), Stick Man / Whiteboard (hand-drawn storytelling), Newspaper (editorial news headlines), Newscast (broadcast news ticker), Black Swan (neon cinematic finance), Mosaic (tessellated tile data panels), Bloomberg (amber terminal finance dashboard), Chronicle (medieval parchment tome).

Custom templates: Created by you in the template builder. Appear in the Custom tab with a green "Custom" badge.
Expert templates (Crafted): Professionally crafted brand templates available on some accounts. Appear in the Expert tab.

== CREATING A PROJECT ==

From a URL: Go to Dashboard → New Project → URL tab. Paste any blog post, article, or web page URL. Blog2Video fetches and extracts content automatically.
From a file: New Project → Upload tab. Supported formats: PDF, DOCX, PPTX, .md, .txt, .vtt. Max 5 files, 5 MB each.
From bulk URLs: New Project → Bulk tab. Add up to 10 URLs, one per row, each with its own template, length, voice, and aspect ratio.

Project settings:
- Video style: Explainer (educational step-by-step), Storytelling (narrative emotional), Promotional (persuasive CTA).
- Video length: Short (~30s–1min), Medium (~1–3min), Detailed (~3–8min), More Detailed (8+ min).
- Language: 50+ languages supported (English, Spanish, French, Arabic, Hindi, Chinese, Japanese, Korean, etc.).
- Voice: Female, Male, or None. Choose a prebuilt ElevenLabs voice or a custom voice clone.
- Branding: Set accent color, background color, text color, and upload a logo during creation.

== VOICE SETTINGS ==

Choose voice gender (Female/Male/None) and pick from prebuilt ElevenLabs voices during project creation. To use a voice clone: go to Account → My Voices → Create Voice Clone, upload a 2-minute audio/video sample. Your clone appears in the voice picker.

Playback speed: In the video preview, use the speed control to choose 0.5×, 1×, 1.5×, 2×, or 2.5×.

== SCENES TAB — OVERVIEW ==

The Scenes tab shows all scenes as a vertical list of cards. Each card shows:
- Scene order number (purple badge, top-left)
- Scene title
- A preview of the narration text (2-line truncated)
- Edit button (pencil icon or "Edit Scene" label)
- Expand/collapse toggle to see more details inline

Inline expanded view shows:
- On-screen display text
- Visual description (the AI's image prompt for that scene)
- Layout name (human-readable)
- Per-scene typography sliders (title size, description size)
- Image management section (current image + controls)
- Scene audio player

== EDITING A SCENE MANUALLY ==

Click the Edit button on any scene card to open the scene edit modal. The modal has two tabs: Manual and AI.

In Manual mode:
- Scene title: Edit the heading shown on screen (also used in the Script tab).
- Display text: Edit the on-screen body text. This is the text your audience reads. It auto-expands as you type. If blank, the narration text is used as a fallback.
- Narration text: The voiceover script for the scene. Edit this to change what is read aloud.
- Layout: Open the layout picker to change the scene type (e.g. switch from bullet_list to metric). See "Layout-specific fields" section.
- Typography: Adjust the title font size (20–200px) and display text font size (12–80px) for this specific scene, overriding global Settings values.

Click "Save" (or the save button) to apply your changes. The preview will update.

== LAYOUT-SPECIFIC FIELDS ==

When you select or switch to a different layout, additional fields appear in the edit modal specific to that layout type:

text_narration / text block: A single text body field.

bullet_list: A bullet points editor — add, remove, or reorder items. Maximum 6 bullets. Each bullet is a short string.

flow_diagram: A steps editor — add up to 5 steps as short strings.

comparison: Left label + left description, right label + right description. Good for before/after or A vs. B content.

timeline: Add up to 4 timeline items, each with a title and description.

metric / stat layouts: Add up to 3 metric cards. Each card has a value (e.g. 42), a label (e.g. "Customers"), and an optional suffix (e.g. "k", "%", "+").

quote_callout: A quote text field and an author name field.

code_block: A code language selector (e.g. python, javascript) and a code text area.

data_visualization / chart: A table editor with headers and data rows. Select the chart display mode: pie, bar, line, or histogram.

ticker_table: A ticker-style data table. Columns and rows with numeric/text cells.

image_caption / hero_image: A caption or title field alongside the image area.

== PER-SCENE TYPOGRAPHY CONTROLS ==

Every scene has its own title font size and display text font size that override the global Settings values:
- Title font size: 20–200px slider. Defaults to the layout's built-in default (e.g. hero_image defaults to 40–54px; impact_title in Spotlight defaults to 64–100px).
- Display text size: 12–80px slider.

These controls appear inside the scene edit modal (Manual tab) and also in the expanded inline view on the Scenes tab card. Changes are per-scene and do not affect other scenes.

To apply a single font size to all scenes at once, use the Settings tab → "Apply to all scenes" button.

== AI EDITING A SCENE ==

Click the Edit button on a scene card and select the AI tab.

AI edit fields:
- Description (required): Describe what you want changed. For example: "Make this scene focus on the cost savings metric" or "Replace with a quote from a customer".
- Display text (optional): Type new on-screen text. Required if you enable the voiceover regeneration toggle.
- Regenerate voiceover: Toggle this on to rewrite the narration text based on your display text. The AI will rewrite what is read aloud for this scene.
- Layout: Choose "Auto" to let the AI pick the best layout, or manually select a specific layout from the dropdown.
- Image: Optionally upload an image (PNG, JPEG, WebP, JPG) to use as the scene's background/image. If left blank, the existing image is kept.

Click "Regenerate" to send your request to the AI. The scene will update with new content, narration, and layout as requested.

== AI EDITING USAGE LIMITS ==

Free plan: 3 AI-assisted scene edits total across all projects. An edit counter in the AI edit panel shows how many you have remaining.

Pro plan: Unlimited AI-assisted edits.

Note: Manual edits (typing directly into fields) do not count toward the AI edit limit. Only clicks on the "Regenerate" button in AI mode use a credit.

When you reach the free limit, the Regenerate button is replaced with an upgrade prompt. You can still edit any scene manually without limits.

== IMAGE MANAGEMENT ==

Each scene can have one image. Image controls appear in the expanded scene card view and inside the scene edit modal.

Available actions:
- Select from scraped: Click the image grid to pick from images Blog2Video automatically found from your source URL (blog post images, charts, etc.).
- Upload image: Click the upload button and select a local PNG, JPEG, WebP, or JPG file.
- AI-generate image (Pro feature): Click "Generate image" and enter a description. The AI creates an image using your description. This requires a Pro plan or per-video purchase.
- Hide/show image: A toggle to show or hide the image for that scene without deleting it.
- Remove image: Permanently removes the image from the scene.

== IMAGE FRAMING AND FOCUS ==

After an image is assigned to a scene, click the framing/focus button (or "Adjust framing") to open the image framing tool.

Controls:
- Zoom: A slider from 1× to 8× (step 0.05). Increase zoom to crop into a specific area of the image.
- Pan: Click and drag directly on the image preview to move the visible area.
- Focus X: The horizontal center of the visible area, 0–100% (0 = left edge, 50 = center, 100 = right edge).
- Focus Y: The vertical center of the visible area, 0–100% (0 = top, 50 = center, 100 = bottom).

The preview updates in real time. Click "Save" to apply the framing. The cropped view will appear in the final rendered video.

== SETTINGS TAB — FONTS ==

Open the Settings tab inside your project (the gear icon or "Settings" in the tab bar).

Font family: A dropdown with 16+ font options:
- Inter (modern sans-serif, default for most templates)
- Roboto Slab (serif, formal)
- Patrick Hand (handwritten, informal)
- Arimo (accessible sans-serif)
- Archivo Black (heavy display font)
- Poppins (geometric sans-serif)
- Montserrat (clean sans-serif)
- Merriweather (editorial serif)
- Playfair Display (elegant serif)
- Oswald (condensed sans-serif)
- Lora (literary serif)
- Fira Code (monospace, good for tech content)
- Righteous (retro display)
- And additional system fonts

Selecting a font updates all scenes to use that typeface globally. The preview refreshes immediately.

Global font size controls:
- Global title font size: A slider from 20–200px. Sets the default title size for all scenes.
- Global display text size: A slider from 12–80px. Sets the default body text size for all scenes.
- "Apply to all scenes" button: Pushes the current global slider values to every scene, overriding any per-scene customizations.

== SETTINGS TAB — COLORS ==

Three color pickers in the Settings tab:
- Accent color: The primary highlight/brand color.
- Text color: The main body text color.
- Background color: The scene background color.

Each has a color swatch (click to open the full picker) and a hex input. After adjusting, click "Save colors" to apply.

Color changes take effect on all scenes. If you want a single scene to have a different color scheme, use a custom layout that overrides the theme, or consider creating a separate project.

== SETTINGS TAB — TEMPLATE CHANGE ==

To switch the template for an existing project:
1. Go to the Settings tab.
2. Open the Template selector dropdown.
3. Choose a built-in template or one of your custom templates.
4. Click "Apply template". Blog2Video will attempt a "relayout" — it reassigns every scene to the closest matching layout in the new template and adjusts typography defaults.

Note: Template relayout may change scene layouts. Review all scenes after switching to verify the content still looks correct. If a scene's original layout does not exist in the new template, the AI picks the closest match.

If a custom template has been deleted, you must switch to a different template before you can render. The render button will show an error if the current template is missing.

== LOGO SETTINGS ==

Logo controls are in the Images tab (or the Logo section within Settings, depending on your project view).

Uploading a logo:
- Click "Upload logo" and select a PNG, JPEG, WebP, or SVG file.
- Maximum file size: 2 MB. If your logo exceeds 2 MB, compress it or reduce its resolution before uploading.

Logo configuration (after upload):
- Position: Choose from 4 corner positions — Top left, Top right, Bottom left, Bottom right. Click the desired corner button to move the logo.
- Size: A slider from 50 to 200 (percentage of the default logo size). 100 is the default. Increase to make the logo larger, decrease to make it smaller.
- Opacity: A slider from 0 to 100. 100 is fully opaque, 0 is invisible. Default is 90 (slightly transparent).

Click "Save" to apply logo changes. The logo will appear on every rendered scene at the configured position, size, and opacity.

To remove the logo: Click the delete/remove button next to the logo preview. This removes it from all scenes.

== AUDIO TAB — PLAYBACK AND SPEED ==

The Audio tab shows a list of every scene with its generated voiceover.

Per-scene controls:
- Play/pause button: Plays the narration audio for that scene.
- Progress bar: Seekable — click anywhere to jump to that point in the audio.
- Current time / total duration: Displayed as MM:SS.
- Status: A green indicator means the audio is ready. A gray/pending indicator means the audio is still being generated.

Note: Audio is generated once during project creation. Re-generating audio for individual scenes requires using the AI edit "Regenerate voiceover" toggle.

Playback speed (global, in video preview):
The speed control appears in the main video preview player above the scene list.
Options: 0.5×, 1× (default), 1.5×, 2×, 2.5×
This controls how fast the final video plays. At 2× speed, a 4-minute video becomes approximately 2 minutes. A warning message shows the estimated final duration before you render at a non-default speed.

== RENDER AND EXPORT ==

Rendering encodes all your scenes into a final MP4 video. Until you render, you can preview scenes but the downloadable video file is not yet produced.

To render and download:
- Click the "Download" button at the top right of the project view. There is no separate "Render" button — the Download button handles both rendering and downloading.
- If the video has not been rendered yet, clicking Download will start the rendering process first.
- If the video is already rendered, clicking Download opens a menu — choose "MP4" to download the video file.
- Rendering takes 1–10 minutes depending on video length and server load. A progress bar shows the current status (queued → rendering → complete).

Re-rendering:
- If you have already rendered and want to incorporate new edits, click Download again — it will offer to re-render. This counts as a new video against your plan's video limit.
- Free users get 3 total renders. Pro users get 100/month. Standard users get 30/month.

To cancel an in-progress render:
- Click "Cancel render". If the render has already finished or been cancelled, a brief error appears — refresh the page to see the current status.

== DOWNLOAD FORMATS ==

After rendering, click the Download button to choose a format:

- MP4 video: Downloads the full rendered video as an MP4 file.
- PowerPoint (.pptx): Exports one slide per scene as a .pptx file. Each slide captures the scene at the selected frame. Useful for repurposing video content as presentations.
- PDF: Same as PowerPoint but exported as a PDF.
- PNG images: Downloads one PNG image per scene, capturing the selected frame.

For slide/image exports, a frame picker wizard appears:
- A scrubber slider (0–100%) lets you choose which frame in the scene to capture as the slide image.
- A live preview shows the selected frame.
- Step through scenes using the "Next scene" button.
- Click "Download" to export all frames.

Note: The slide/image export requires the video preview to be fully loaded. If the scrubber is not yet active, wait a moment and try again.

== EMBED AND SHARE ==

After rendering, the Share button opens the sharing panel.

Embed video:
- Click "Embed" to generate an iframe code snippet.
- Copy the code and paste it into your website or CMS.
- The embed link remains active as long as your project exists.

Preview link:
- Click "Preview link" to generate a shareable URL.
- Anyone with the link can watch the video without needing a Blog2Video account.
- No login required for viewers.

Copy download link:
- Available while the render is in progress.
- Share this link so others can download the video directly once rendering completes.

== ASPECT RATIO CONVERSION ==

By default, Blog2Video creates landscape (16:9) videos. You can convert to portrait (9:16) for TikTok, Instagram Reels, and mobile-first content.

To convert:
- Click the "Portrait" button in the aspect ratio controls (usually displayed as a small landscape/portrait icon toggle near the render button or video preview).
- A confirmation dialog explains that converting will re-render the video.
- Click "Confirm" to proceed. The project re-renders in portrait format.

To switch back to landscape, click the "Landscape" button and confirm again. Each conversion counts as a render against your plan limit.

Note: Converting aspect ratio does not change the content — it adjusts how the layouts are composed within the new frame dimensions.

== AI CHAT PANEL ==

The AI Chat panel is a Pro-only feature that lets you make edits using natural language instructions instead of editing scenes one by one.

How to use:
- Open the AI Chat panel (the chat icon or "AI Chat" tab in the sidebar).
- Type a natural language instruction in the text field. Examples:
  - "Make scene 3 more concise"
  - "Add a scene about customer testimonials after scene 2"
  - "Change the tone of all scenes to be more casual"
  - "Remove any mention of pricing from scene 5"
- Click Send. The AI processes your instruction and applies edits across the relevant scenes.
- The chat history shows your previous instructions and their outcomes.

Gating: If you are on the free plan, the chat input is replaced by an upgrade prompt. Upgrade to Pro to unlock the AI Chat panel.

== SCRIPT TAB ==

The Script tab shows the full narration script for your video — useful for reviewing all voiceover text in one place before rendering.

What it shows:
- Project title
- Total scene count and estimated total duration (e.g. "12 scenes · ~4 min")
- Each scene listed in order with:
  - Scene number and title
  - Scene duration (scene_duration_seconds + extra_hold_seconds in seconds)
  - Narration text (the voiceover script — this is what the AI reads aloud, not the on-screen display text)
  - Visual description (the AI's image generation prompt, shown in italics)

The Script tab is read-only. To edit the narration text, go to the Scenes tab and edit the scene in the Manual edit mode.

== REORDERING SCENES ==

To change the order of scenes:
- In the Scenes tab, find the drag handle icon on the left side of each scene card.
- Click and drag a scene card up or down to a new position.
- A blue drop target indicator shows where the scene will land.
- Release to drop. Scene order numbers update automatically.
- The new order is saved automatically — no separate save action needed.

Alternatively, in the Manual edit modal, there is a scene order field (a number input from 1 to total scenes). Type the desired position number and save.
`.trim(),
};
