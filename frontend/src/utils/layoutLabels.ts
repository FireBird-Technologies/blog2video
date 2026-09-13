const NEWSCAST_LAYOUT_LABELS: Record<string, string> = {
  opening: "Newscast Opening",
  anchor_narrative: "Anchor Narrative",
  live_metrics_board: "Live Metrics Board",
  briefing_code_panel: "Briefing Code Panel",
  headline_insight: "Headline Insight",
  story_stack: "Story Stack",
  side_by_side_brief: "Side-by-Side Brief",
  segment_break: "Segment Break",
  field_image_focus: "Field Image Focus",
  data_visualization: "Data Visualization",
  ending_socials: "Ending / Follow along",
};

const SAKURA_LAYOUT_LABELS: Record<string, string> = {
  sakura_intro__v2: "Sakura Intro — Blooming Tree",
  sakura_text_narration__v2: "Text Narration — Lantern Grove",
  ending_socials__v2: "Outro / Socials — Tsukimi Farewell",
};

const LEGACY_NEWSCAST_LAYOUT_ALIASES: Record<string, string> = {
  newscast_cinematic_title: "opening",
  newscast_glass_narrative: "anchor_narrative",
  newscast_glow_metric: "live_metrics_board",
  newscast_glass_code: "briefing_code_panel",
  newscast_kinetic_insight: "headline_insight",
  newscast_glass_stack: "story_stack",
  newscast_split_glass: "side_by_side_brief",
  newscast_chapter_break: "segment_break",
  newscast_glass_image: "field_image_focus",
};

function humanizeLayoutId(layoutId: string): string {
  return layoutId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isNewscastTemplate(templateId: string | null | undefined): boolean {
  const normalized = (templateId ?? "").trim().toLowerCase();
  return normalized === "newscast" || normalized === "newsreport";
}

function isSakuraTemplate(templateId: string | null | undefined): boolean {
  return (templateId ?? "").trim().toLowerCase() === "sakura";
}

/**
 * Returns a user-facing scene layout label.
 * For Newscast, prefer Template Studio labels from the hardcoded map.
 * For all others (or unknown IDs), preserve existing fallback behavior.
 */
export function getSceneLayoutLabel(
  templateId: string | null | undefined,
  layoutId: string | null | undefined,
  fallbackLabel?: string
): string {
  // No id means the scene's layout could not be resolved at all. "Current
  // layout" reads like the name of a real layout, which is how an unresolved
  // intro/outro looked like a deliberate choice rather than a lookup failure.
  if (!layoutId) return fallbackLabel ?? "Default layout";

  if (isNewscastTemplate(templateId)) {
    const canonicalId = LEGACY_NEWSCAST_LAYOUT_ALIASES[layoutId] ?? layoutId;
    return NEWSCAST_LAYOUT_LABELS[canonicalId] ?? fallbackLabel ?? humanizeLayoutId(layoutId);
  }

  if (isSakuraTemplate(templateId) && SAKURA_LAYOUT_LABELS[layoutId]) {
    return SAKURA_LAYOUT_LABELS[layoutId];
  }

  return fallbackLabel ?? humanizeLayoutId(layoutId);
}
