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
  if (!layoutId) return fallbackLabel ?? "Current layout";

  if (isNewscastTemplate(templateId)) {
    const canonicalId = LEGACY_NEWSCAST_LAYOUT_ALIASES[layoutId] ?? layoutId;
    return NEWSCAST_LAYOUT_LABELS[canonicalId] ?? fallbackLabel ?? humanizeLayoutId(layoutId);
  }

  return fallbackLabel ?? humanizeLayoutId(layoutId);
}
