export type VideoStyleId = "auto" | "explainer" | "promotional" | "storytelling";

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
  const normalized = (style || "").trim().toLowerCase();
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
