/** A saved style preference selected in the style row, encoded as manual_guide_<preference_id>. */
export type ManualGuideStyleId = `manual_guide_${number}`;

export type VideoStyleId =
  | "auto"
  | "explainer"
  | "promotional"
  | "storytelling"
  | ManualGuideStyleId;

export function isManualGuideStyle(style?: string | null): style is ManualGuideStyleId {
  return /^manual_guide_\d+$/.test((style || "").trim());
}

export const VIDEO_STYLE_OPTIONS: ReadonlyArray<{
  id: VideoStyleId;
  label: string;
  subtitle: string;
}> = [
  { id: "auto", label: "Auto", subtitle: "AI picks based on the article" },
  { id: "explainer", label: "Explainer", subtitle: "Educational, clear, step-by-step" },
  { id: "storytelling", label: "Storytelling", subtitle: "Narrative arc, emotional, story-driven" },
  { id: "promotional", label: "Promotional", subtitle: "Persuasive, benefit-focused, CTA" },
];

export function normalizeVideoStyle(style?: string | null): VideoStyleId {
  const raw = (style || "").trim();
  if (isManualGuideStyle(raw)) {
    return raw as ManualGuideStyleId;
  }
  const normalized = raw.toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "explainer" ||
    normalized === "promotional" ||
    normalized === "storytelling"
  ) {
    return normalized;
  }
  return "auto";
}
