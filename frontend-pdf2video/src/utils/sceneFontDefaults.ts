/**
 * Extracted from ../components/SceneEditModal.tsx so VideoPreview.tsx (needed
 * by the public EmbedPreviewPage — see App.tsx) doesn't drag in the entire
 * 2000+ line scene-editing UI, and transitively every custom crafted
 * composition (laduc/, fj_research/, fj_market_brief/, wealth_your_way/)
 * template rendering code, just for this one pure font-size lookup.
 *
 * This deployment has no project editor (no Dashboard, no ProjectView, no
 * SceneEditModal UI) — only the public embed preview needs this. Keep this
 * file's logic identical to the corresponding block in
 * ../frontend/src/components/SceneEditModal.tsx if that ever changes.
 */

const LAYOUT_FONT_DEFAULTS: Record<
  string,
  Record<string, { title: number | [number, number]; desc?: number | [number, number] }>
> = {
  default: {
    text_narration: { title: [100, 72], desc: [40, 30] },
    hero_image: { title: [40, 54] },
    image_caption: { title: [26, 32], desc: [17, 20] },
    bullet_list: { title: [30, 40], desc: [18, 22] },
    flow_diagram: { title: [30, 38], desc: [16, 20] },
    comparison: { title: [30, 38], desc: [16, 20] },
    metric: { title: [18, 22], desc: [16, 20] },
    code_block: { title: [26, 36] },
    timeline: { title: [30, 38], desc: [14, 16] },
    quote_callout: { title: [30, 38], desc: [16, 20] },
    data_visualization: { title: [52, 44], desc: [28, 26] },
  },
  nightfall: {
    cinematic_title: { title: [88, 140], desc: [26, 36] },
    glass_narrative: { title: [40, 52], desc: 25 },
    glass_image: { title: [48, 64], desc: 28 },
    glass_code: { title: [18, 22], desc: 22 },
    split_glass: { title: [34, 46], desc: [20, 24] },
    chapter_break: { title: [36, 46], desc: [18, 24] },
    data_visualization: { title: [34, 46], desc: 25 },
    glow_metric: { title: [28, 36], desc: [18, 20] },
    glass_stack: { title: [34, 42], desc: [16, 18] },
    kinetic_insight: { title: [80, 120], desc: [60, 72] },
  },
  newscast: {
    opening: { title: [88, 140], desc: [26, 36] },
    anchor_narrative: { title: [40, 52], desc: 25 },
    field_image_focus: { title: [48, 64], desc: 28 },
    briefing_code_panel: { title: [18, 22], desc: 22 },
    side_by_side_brief: { title: [34, 46], desc: [20, 24] },
    segment_break: { title: [36, 46], desc: [18, 24] },
    live_metrics_board: { title: [28, 36], desc: [18, 20] },
    data_visualization: { title: [34, 46], desc: 25 },
    story_stack: { title: [34, 42], desc: [16, 18] },
    headline_insight: { title: [80, 120], desc: [60, 72] },
  },
  spotlight: {
    impact_title: { title: [64, 100], desc: [18, 22] },
    word_punch: { title: [96, 140] },
    stat_stage: { title: [80, 120], desc: [11, 14] },
    cascade_list: { title: [18, 28], desc: [20, 30] },
    rapid_points: { title: [32, 52] },
    spotlight_image: { title: [52, 72], desc: [18, 24] },
    versus: { title: [28, 40], desc: [12, 16] },
    closer: { title: [28, 42], desc: [12, 16] },
  },
  gridcraft: {
    editorial: { title: 36, desc: 18 },
    bento_hero: { title: 72, desc: 18 },
    bento_features: { title: 24, desc: 14 },
    bento_compare: { title: 24, desc: 16 },
    bento_highlight: { title: 32, desc: 18 },
    bento_code: { title: 24, desc: 16 },
    bento_steps: { title: 18, desc: 13 },
    pull_quote: { title: 42, desc: 16 },
  },
  whiteboard: {
    drawn_title: { title: [82, 118], desc: [30, 36] },
    marker_story: { title: [68, 92], desc: [30, 40] },
    stick_figure_scene: { title: [66, 84], desc: [30, 38] },
    stats_figures: { title: [58, 72], desc: [26, 30] },
    stats_chart: { title: [52, 64], desc: [24, 28] },
    comparison: { title: [52, 64], desc: [24, 28] },
  },
  newspaper: {
    news_headline: { title: [48, 64], desc: [19, 23] },
    article_lead: { title: [14, 16], desc: [20, 24] },
    pull_quote: { title: [30, 38], desc: [16, 19] },
    data_snapshot: { title: [38, 50], desc: [14, 16] },
    fact_check: { title: [36, 48], desc: [22, 24] },
    news_timeline: { title: [36, 48], desc: [15, 18] },
    expert_profile: { title: [55, 58], desc: [32, 26] },
    perspective_split: { title: [68, 63], desc: [30, 25] },
    data_visualisation: { title: [64, 51], desc: [33, 27] },
    ticker_table: { title: [64, 51], desc: [33, 27] },
    ending_socials: { title: [88, 72], desc: [35, 27] },
  },
  mosaic: {
    mosaic_title: { title: [150, 100], desc: [64, 44] },
    mosaic_text: { title: [86, 56], desc: [50, 32] },
    mosaic_punch: { title: [200, 130], desc: [34, 22] },
    mosaic_stream: { title: [76, 50], desc: [42, 28] },
    mosaic_metric: { title: [162, 106], desc: [34, 24] },
    mosaic_phrases: { title: [90, 62], desc: [40, 26] },
    mosaic_close: { title: [104, 72], desc: [52, 34] },
  },
  magazine: {
    magazine_cover: { title: [92, 62], desc: [16, 19] },
    editorial_quote: { title: [56, 72], desc: [18, 24] },
    by_the_numbers: { title: [56, 72], desc: [20, 26] },
    interview_qa: { title: [40, 52], desc: [16, 20] },
    magazine_data_visualization: { title: [56, 52], desc: [28, 26] },
    timeline_journey: { title: [40, 52], desc: [16, 20] },
    text_narration: { title: [100, 72], desc: [72, 30] },
    ending_socials: { title: [88, 72], desc: [35, 27] },
    magazine_ticker: { title: [52, 42], desc: [28, 22] },
    comparison: { title: [92, 93], desc: [52, 30] },
  },
  stickman_football: {
    football_data_viz: { title: [72, 64], desc: [38, 30] },
    football_ticker: { title: [68, 60], desc: [34, 28] },
  },
  custom: {
    // Custom template arrangements (font sizes are approximate)
    "full-center": { title: [36, 48], desc: [18, 22] },
    "split-left": { title: [32, 42], desc: [16, 20] },
    "split-right": { title: [32, 42], desc: [16, 20] },
    "top-bottom": { title: [34, 44], desc: [18, 22] },
    "grid-2x2": { title: [24, 32], desc: [14, 16] },
    "grid-3": { title: [22, 28], desc: [13, 15] },
    "asymmetric-left": { title: [32, 42], desc: [16, 20] },
    "asymmetric-right": { title: [32, 42], desc: [16, 20] },
    stacked: { title: [34, 44], desc: [18, 22] },
  },
};

const LEGACY_NEWSCAST_LAYOUT_ID_ALIASES: Record<string, string> = {
  newscast_cinematic_title: "opening",
  newscast_glass_narrative: "anchor_narrative",
  newscast_glass_image: "field_image_focus",
  newscast_glass_code: "briefing_code_panel",
  newscast_split_glass: "side_by_side_brief",
  newscast_chapter_break: "segment_break",
  newscast_glow_metric: "live_metrics_board",
  newscast_glass_stack: "story_stack",
  newscast_kinetic_insight: "headline_insight",
};

function normalizeLegacyNewscastLayoutId(template: string, layoutId: string): string {
  const normalizedTemplate = (template || "").toLowerCase();
  if (normalizedTemplate !== "newscast" && normalizedTemplate !== "newsreport") return layoutId;
  return LEGACY_NEWSCAST_LAYOUT_ID_ALIASES[layoutId] ?? layoutId;
}

export function getDefaultFontSizes(
  template: string,
  layoutId: string | null,
  aspectRatio: string
): { title: number; desc: number } {
  const p = aspectRatio === "portrait";
  const raw = (template || "default").toLowerCase();
  const t = raw.startsWith("custom_") ? "custom" : raw;
  const layout = layoutId ? normalizeLegacyNewscastLayoutId(t, layoutId) : "text_narration";
  const defs = LAYOUT_FONT_DEFAULTS[t]?.[layout] ?? LAYOUT_FONT_DEFAULTS.default?.text_narration ?? { title: [34, 44], desc: [20, 23] };
  const titleVal = defs.title;
  const descVal = defs.desc;
  const title = Array.isArray(titleVal) ? (p ? titleVal[0] : titleVal[1]) : (titleVal as number);
  const desc = descVal !== undefined
    ? (Array.isArray(descVal) ? (p ? descVal[0] : descVal[1]) : descVal)
    : 20;
  return { title, desc };
}

/** Get default font sizes from layout_prop_schema (meta.json) when available. */
export function getDefaultFontSizesFromSchema(
  layoutPropSchema: Record<string, { defaults?: Record<string, unknown> }> | undefined,
  layoutId: string | null,
  aspectRatio: string
): { title: number; desc: number } | null {
  if (!layoutId || !layoutPropSchema) return null;
  const canonicalLayoutId = LEGACY_NEWSCAST_LAYOUT_ID_ALIASES[layoutId] ?? layoutId;
  const schema = layoutPropSchema[canonicalLayoutId];
  const defaults = schema?.defaults;
  if (!defaults) return null;
  const isPortrait = aspectRatio === "portrait";
  const resolve = (val: unknown): number | null => {
    if (typeof val === "number" && !isNaN(val)) return val;
    if (val && typeof val === "object" && !Array.isArray(val) && "portrait" in val && "landscape" in val) {
      const v = val as { portrait: unknown; landscape: unknown };
      const n = isPortrait ? v.portrait : v.landscape;
      return typeof n === "number" && !isNaN(n) ? n : null;
    }
    return null;
  };
  const title = resolve(defaults.titleFontSize);
  const desc = resolve(defaults.descriptionFontSize);
  if (title == null && desc == null) return null;
  const hardcoded = getDefaultFontSizes("", canonicalLayoutId, aspectRatio);
  return {
    title: title ?? hardcoded.title,
    desc: desc ?? hardcoded.desc,
  };
}
