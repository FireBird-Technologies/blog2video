/**
 * Human-readable labels for edit-history field names and JSON diff paths.
 *
 * Top-level fields are the DB column names (e.g. `remotion_code`,
 * `preferred_layout`). Diff paths are dotted keys from inside a JSON field's
 * descriptor (e.g. `title.fontSize`, `series.0.color`). Anything not explicitly
 * mapped falls back to a prettified version of the raw key.
 */

// Top-level DB field → label.
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  display_text: "On-screen text",
  narration_text: "Narration",
  visual_description: "Visual description",
  remotion_code: "Scene Props",
  duration_seconds: "Duration",
  extra_hold_seconds: "Hold time",
  bgm_volume: "Music volume",
  preferred_layout: "Layout",
  // Project-level
  name: "Project name",
  accent_color: "Accent color",
  bg_color: "Background color",
  text_color: "Text color",
  font_family: "Font",
  captions_enabled: "Captions",
  caption_position: "Caption position",
  caption_font_family: "Caption font",
  caption_font_size: "Caption size",
  caption_offset: "Caption offset position",
  bgm_track_id: "Music track",
  playback_speed: "Playback speed",
  logo_position: "Logo position",
  logo_opacity: "Logo opacity",
  logo_size: "Logo size",
};

// Common keys inside JSON descriptors (remotion_code) → label.
const PATH_KEY_LABELS: Record<string, string> = {
  title: "Title",
  subtitle: "Subtitle",
  body: "Body",
  content: "Content",
  heading: "Heading",
  caption: "Caption",
  source: "Source",
  footer: "Footer",
  label: "Label",
  value: "Value",
  fontSize: "Font size",
  titleFontSize: "Title size",
  subtitleFontSize: "Subtitle size",
  bodyFontSize: "Body size",
  contentFontSize: "Content size",
  headingFontSize: "Heading size",
  fontFamily: "Font",
  textColor: "Text color",
  bgColor: "Background color",
  accentColor: "Accent color",
  color: "Color",
  imageUrl: "Image",
  imageBox: "Image box",
  chartType: "Chart type",
  layout: "Layout",
};

/** camelCase / snake_case / kebab → "Title Case" words. */
function prettify(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase → camel Case
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Label for a top-level edit field name. */
export function fieldLabel(name: string | null): string {
  if (!name) return "Field";
  return FIELD_LABELS[name] ?? prettify(name);
}

/** Label for a dotted JSON diff path (each segment mapped; array indices → "#n"). */
export function pathLabel(path: string): string {
  if (!path) return "";
  return path
    .split(".")
    .map((seg) => {
      if (/^\d+$/.test(seg)) return `#${Number(seg) + 1}`; // array index → 1-based
      return PATH_KEY_LABELS[seg] ?? prettify(seg);
    })
    .join(" › ");
}
