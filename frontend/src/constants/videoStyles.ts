export type VideoStyleId = "explainer" | "promotional" | "storytelling";

export const VIDEO_STYLE_OPTIONS: ReadonlyArray<{
  id: VideoStyleId;
  label: string;
  subtitle: string;
}> = [
  { id: "explainer", label: "Explainer", subtitle: "Educational, clear, step-by-step" },
  { id: "promotional", label: "Promotional", subtitle: "Persuasive, benefit-focused, CTA" },
  { id: "storytelling", label: "Storytelling", subtitle: "Narrative arc, emotional, story-driven" },
];

export function normalizeVideoStyle(style?: string | null): VideoStyleId {
  const normalized = (style || "").trim().toLowerCase();
  if (normalized === "explainer" || normalized === "promotional" || normalized === "storytelling") {
    return normalized;
  }
  return "explainer";
}
