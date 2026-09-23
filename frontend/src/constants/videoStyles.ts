export type BuiltinVideoStyleId = "auto" | "explainer" | "promotional" | "storytelling" | "your_style";
export type CustomVideoStyleId = `custom:${number}`;
export type VideoStyleId = BuiltinVideoStyleId | CustomVideoStyleId;

export const VIDEO_STYLE_OPTIONS: ReadonlyArray<{
  id: VideoStyleId;
  label: string;
  subtitle: string;
}> = [
  { id: "auto", label: "Auto", subtitle: "AI picks based on the article" },
  { id: "your_style", label: "Your Style", subtitle: "Your saved tone, pacing, and narrative style" },
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
    || normalized === "your_style"
  ) {
    return normalized;
  }
  if (/^custom:\d+$/.test(normalized)) return normalized as CustomVideoStyleId;
  return "auto";
}
