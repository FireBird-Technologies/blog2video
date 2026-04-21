/**
 * Maps legacy / alias layout IDs to the canonical key used in LAYOUT_IMAGE_BOX_DIMS.
 * Add any new aliases here when templates rename layouts.
 */
const LAYOUT_ID_ALIASES: Record<string, string> = {
  // nightfall legacy names
  cinematic_title:              "cinematic_title",
  glass_narrative:              "glass_narrative",
  glow_metric:                  "glow_metric",
  glass_code:                   "glass_code",
  kinetic_insight:              "kinetic_insight",
  kinetix_insight:              "kinetic_insight",
  glass_stack:                  "glass_stack",
  split_glass:                  "split_glass",
  chapter_break:                "chapter_break",
  glass_image:                  "glass_image",

  // newscast legacy → normalized
  newscast_cinematic_title:     "opening",
  newscast_glass_narrative:     "anchor_narrative",
  newscast_glass_image:         "field_image_focus",
  newscast_glass_code:          "briefing_code_panel",
  newscast_split_glass:         "side_by_side_brief",
  newscast_chapter_break:       "segment_break",
  newscast_glow_metric:         "live_metrics_board",
  newscast_glass_stack:         "story_stack",
  newscast_kinetic_insight:     "headline_insight",
  newscast_glass_stack2:        "story_stack",

  // older multi-word aliases
  opening:                      "opening",
  anchor_narrative:             "anchor_narrative",
  field_image_focus:            "field_image_focus",
  briefing_code_panel:          "briefing_code_panel",
  side_by_side_brief:           "side_by_side_brief",
  segment_break:                "segment_break",
  live_metrics_board:           "live_metrics_board",
  story_stack:                  "story_stack",
  headline_insight:             "headline_insight",
  ending_socials:               "ending_socials",

  // gridcraft backward-compat alias
  intro:                        "bento_hero",
};

/**
 * Normalize a raw layout ID (which may be a legacy alias) to the canonical key
 * used in LAYOUT_IMAGE_BOX_DIMS.  Returns the input unchanged if no alias matches.
 */
export function normalizeLayoutId(layoutId: string): string {
  return LAYOUT_ID_ALIASES[layoutId] ?? layoutId;
}

export interface ImageBoxDims {
  landscape: { w: number; h: number };
  portrait:  { w: number; h: number };
}

/**
 * Image box dimensions for every layout that renders an image, expressed as
 * fractions of the template canvas (imageBoxWidth / canvasWidth, imageBoxHeight / canvasHeight).
 *
 * Canvas base sizes (landscape):
 *   default, nightfall, gridcraft, spotlight, matrix, mosaic, blackswan → 1920 × 1080
 *   whiteboard, newspaper, newscast → 1280 × 720
 *
 * In portrait mode the canvas is rotated (e.g. 1080 × 1920), and the fractions
 * are applied to those swapped dimensions by getImageBoxAspectRatio().
 *
 * Layouts with no image support are not listed — they fall back to full-canvas (w:1, h:1).
 */
export const LAYOUT_IMAGE_BOX_DIMS: Record<string, ImageBoxDims> = {

  // ─────────────────────────────────────────────────────────────────────────
  // DEFAULT template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // flexRow: image is the right flex:1 cell → 50% width, full height
  // portrait flexColumn: bottom flex:1 cell → full width, 50% height
  hero_image: {
    landscape: { w: 0.5,  h: 1.0  }, // 960 × 1080
    portrait:  { w: 1.0,  h: 0.5  }, // 1080 × 960
  },

  // Use a landscape-oriented preview box for landscape projects to avoid portrait-looking framing.
  // Portrait keeps the tall 45% height treatment from the layout.
  image_caption: {
    landscape: { w: 0.50,  h: 0.6 }, // ~960 × 304 (landscape ratio)
    portrait:  { w: 0.907, h: 0.45  }, // ~980 × 864 on 1080×1920
  },

  // flexRow: right flex:1 cell — image is half the canvas width
  // portrait flexColumn: image takes flex:1 portion (~50% height)
  bullet_list: {
    landscape: { w: 0.5,  h: 1.0  }, // 960 × 1080
    portrait:  { w: 1.0,  h: 0.5  }, // 1080 × 960
  },

  // flexRow: image flex:1, portrait flex:0.6 (roughly 37% of height)
  timeline: {
    landscape: { w: 0.5,  h: 1.0  }, // 960 × 1080
    portrait:  { w: 1.0,  h: 0.40 }, // 1080 × 768
  },

  // legacy default image layout id still used in some scene payloads
  animated_image: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NIGHTFALL template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed background — same as canvas
  cinematic_title: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed Ken-Burns image — same as canvas
  glass_image: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Landscape: image lives inside a centered card (max-width 1400) at flex 42%, fixed 380 px height.
  // Portrait: image is full-width inside padded card content, fixed 400 px height.
  glass_narrative: {
    landscape: { w: 0.274, h: 0.352 }, // ~527 × 380 on 1920×1080
    portrait:  { w: 0.751, h: 0.208 }, // ~811 × 400 on 1080×1920
  },

  // Landscape: image sits in the left panel and should stay landscape-oriented in adjust modal.
  // Portrait: split-screen card, image section is the top flex:1 half.
  glow_metric: {
    landscape: { w: 0.40, h: 0.50 }, // landscape image box (avoid portrait-looking preview)
    portrait:  { w: 1.0,  h: 0.5  }, // 1080 × 960
  },

  // flex "0 0 40%", height 400 px landscape / full width, height 50% portrait
  glass_stack: {
    landscape: { w: 0.40, h: 0.370 }, // 768 × 400
    portrait:  { w: 1.0,  h: 0.5   }, // 1080 × 960
  },

  // top-right media card in split layout
  split_glass: {
    landscape: { w: 0.40, h: 0.370 },
    portrait:  { w: 1.0,  h: 0.5   },
  },

  // image-forward title stack (full canvas treatment)
  kinetic_insight: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GRIDCRAFT template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Landscape: right-top grid cell in a 2fr/1fr x 1fr/1fr grid inside a 90%×80% container.
  // Portrait: bottom-left grid cell in a 1fr/1fr x 2fr/1fr grid inside same container.
  bento_hero: {
    landscape: { w: 0.30,  h: 0.40  }, // ~576 × 432
    portrait:  { w: 0.45,  h: 0.267 }, // ~486 × 512
  },

  // flex "0 0 38%", height 320 px landscape / width 80%, height 220 px portrait
  bento_compare: {
    landscape: { w: 0.38, h: 0.296 }, // 730 × 320
    portrait:  { w: 0.8,  h: 0.115 }, // 864 × 220
  },

  // identical card style to bento_compare
  bento_features: {
    landscape: { w: 0.38, h: 0.296 },
    portrait:  { w: 0.8,  h: 0.115 },
  },

  // identical card style to bento_compare
  bento_steps: {
    landscape: { w: 0.38, h: 0.296 },
    portrait:  { w: 0.8,  h: 0.115 },
  },

  // grid 1.8fr/1fr rows; main box spans full container width (90% canvas).
  // In landscape flexRow: image=left flex:1 = 45% of canvas × 50% of canvas height
  // In portrait flexCol: image=top flex:1 = 90% × 24% (main box ≈60% of 80%-height container)
  bento_highlight: {
    landscape: { w: 0.45, h: 0.50 }, // 864 × 540
    portrait:  { w: 0.90, h: 0.24 }, // 972 × 461
  },

  // Editorial split card: image is one flex half of a 90%×80% container.
  editorial_body: {
    landscape: { w: 0.45, h: 0.80  }, // ~864 × 864
    portrait:  { w: 0.90, h: 0.40  }, // ~972 × 768
  },

  // flex "0 0 38%", height 320 px landscape / width 100%, height 180 px portrait
  kpi_grid: {
    landscape: { w: 0.38, h: 0.296 }, // 730 × 320
    portrait:  { w: 1.0,  h: 0.094 }, // 1080 × 180
  },

  // side media pane in a split code layout
  bento_code: {
    landscape: { w: 0.42, h: 1.0 },
    portrait:  { w: 1.0,  h: 0.34 },
  },

  // PullQuote image card inside padded quote panel.
  pull_quote: {
    landscape: { w: 0.308, h: 0.259 }, // ~592 × 280
    portrait:  { w: 0.63,  h: 0.104 }, // ~680 × 200
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SPOTLIGHT template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed with vignette overlay
  spotlight_image: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed background under text
  cascade_list: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // flex "0 0 38%", height 360 px landscape / width 70%, height 220 px portrait
  impact_title: {
    landscape: { w: 0.38, h: 0.333 }, // 730 × 360
    portrait:  { w: 0.70, h: 0.115 }, // 756 × 220
  },

  // flex "0 0 38%", height 400 px landscape / width 80%, height 240 px portrait
  statement: {
    landscape: { w: 0.38, h: 0.370 }, // 730 × 400
    portrait:  { w: 0.80, h: 0.125 }, // 864 × 240
  },

  // flex "0 0 35%", height 350 px landscape / width 70%, height 200 px portrait
  stat_stage: {
    landscape: { w: 0.35, h: 0.324 }, // 672 × 350
    portrait:  { w: 0.70, h: 0.104 }, // 756 × 200
  },

  // Optional image card below headline: width 42% / height 32% landscape, 72% / 26% portrait
  word_punch: {
    landscape: { w: 0.42, h: 0.32  }, // ~806 × 346
    portrait:  { w: 0.72, h: 0.26  }, // ~778 × 499
  },

  // flex "0 0 38%", full height landscape / full width, height 280 px portrait
  versus: {
    landscape: { w: 0.38, h: 1.0  }, // 730 × 1080
    portrait:  { w: 1.0,  h: 0.146 }, // 1080 × 280
  },

  // flex "0 0 38%" of padded container (outer pad 8% right), inner pad 8% top/bottom/left
  // → image area ~672 × 972 landscape (tall portrait box); 76% × 44% portrait
  rapid_points: {
    landscape: { w: 0.35, h: 0.90 }, // ~672 × 972
    portrait:  { w: 0.64, h: 0.44 }, // ~691 × 845
  },

  // Optional image card: width 38% / height 320 px landscape, 70% / 220 px portrait
  closer: {
    landscape: { w: 0.38, h: 0.396 }, // ~730 × 320
    portrait:  { w: 0.70, h: 0.115 }, // 756 × 220
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MATRIX template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed with clip-path horizontal reveal
  matrix_image: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Left 50% panel, full height landscape / full width, 280 px portrait
  fork_choice: {
    landscape: { w: 0.5,  h: 1.0  }, // 960 × 1080
    portrait:  { w: 1.0,  h: 0.146 }, // 1080 × 280
  },

  // flex "0 0 38%", height 360 px landscape / width 70%, height 220 px portrait
  matrix_title: {
    landscape: { w: 0.38, h: 0.333 }, // 730 × 360
    portrait:  { w: 0.70, h: 0.115 }, // 756 × 220
  },

  // width 35%, height auto (approx 300 px) landscape / width 60%, height auto portrait
  data_stream: {
    landscape: { w: 0.35, h: 0.278 }, // 672 × 300 (estimated — height is "auto")
    portrait:  { w: 0.60, h: 0.182 }, // 648 × 350 (estimated)
  },

  // flex "0 0 38%", fixed 400 px height landscape / width 80%, fixed 240 px portrait
  terminal_text: {
    landscape: { w: 0.38, h: 0.370 }, // ~730 × 400
    portrait:  { w: 0.80, h: 0.125 }, // 864 × 240
  },

  glitch_punch: {
    landscape: { w: 0.38, h: 0.333 }, // ~730 × 360
    portrait:  { w: 0.70, h: 0.115 }, // 756 × 220
  },

  cipher_metric: {
    landscape: { w: 0.35, h: 0.324 }, // ~672 × 350
    portrait:  { w: 0.70, h: 0.104 }, // 756 × 200
  },

  transmission: {
    // same image rail geometry as rapid_points in landscape
    landscape: { w: 0.35, h: 0.90 }, // ~672 × 972
    portrait:  { w: 1.0, h: 1.0 },   // portrait branch currently stacks content; keep full-canvas fallback
  },

  awakening: {
    landscape: { w: 0.38, h: 0.296 }, // ~730 × 320
    portrait:  { w: 0.70, h: 0.115 }, // 756 × 220
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BLACKSWAN template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed with fade-in at end of scene
  droplet_intro: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed background at 0.18 opacity
  neon_narrative: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // flex:1 with CSS aspectRatio "16/9" landscape / width 88%, height 36% portrait
  arc_features: {
    landscape: { w: 0.5,  h: 0.5  }, // ~960 × 540 (16/9 box in flex:1 column)
    portrait:  { w: 0.88, h: 0.36 }, // 950 × 691
  },

  // absolute positioned: left/right 18%, height 45% landscape / left/right 10%, height 35% portrait
  dive_insight: {
    landscape: { w: 0.64, h: 0.45 }, // 1229 × 486
    portrait:  { w: 0.80, h: 0.35 }, // 864 × 672
  },

  pulse_metric: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  signal_split: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  reactor_code: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  flight_path: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MOSAIC template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed tile-by-tile reveal
  mosaic_title: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed tile reveal (same component as mosaic_title)
  mosaic_punch: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Absolute-pinned left panel: width 46%, full height in both landscape and portrait
  mosaic_text: {
    landscape: { w: 0.46, h: 1.0  }, // 883 × 1080
    portrait:  { w: 0.46, h: 1.0  }, // 331 × 720 on 720×1280 canvas
  },

  mosaic_stream: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  mosaic_metric: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  mosaic_phrases: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  mosaic_close: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NEWSCAST template  (canvas 1280 × 720)
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed under hero chrome
  opening: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed with zoom+shift animation
  field_image_focus: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed background under split panels
  side_by_side_brief: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed background (NewsCastLayoutImageBackground)
  live_metrics_board: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  // Full-bleed background
  story_stack: {
    landscape: { w: 1.0,  h: 1.0  },
    portrait:  { w: 1.0,  h: 1.0  },
  },

  headline_insight: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // flex "0 0 40%", full height landscape / no image panel in portrait → full canvas fallback
  anchor_narrative: {
    landscape: { w: 0.40, h: 1.0  }, // 512 × 720
    portrait:  { w: 1.0,  h: 1.0  }, // no image panel in portrait — full canvas
  },

  briefing_code_panel: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  segment_break: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NEWSPAPER template  (canvas 1280 × 720)
  // ─────────────────────────────────────────────────────────────────────────

  // Polaroid-style card: absolute positioned 40% × 50% landscape / 80% × 35% portrait
  news_headline: {
    landscape: { w: 0.40, h: 0.5   }, // 512 × 360
    portrait:  { w: 0.80, h: 0.35  }, // 576 × 448
  },

  // Tilted photo card: 38% × 60% landscape / 88% × 38% portrait
  article_lead: {
    landscape: { w: 0.38, h: 0.6   }, // 486 × 432
    portrait:  { w: 0.88, h: 0.38  }, // 634 × 486
  },

  // Portrait-oriented card (aspect-ratio 3/4): flex 0.8 landscape / width 100%, height 300 px portrait
  fact_check: {
    landscape: { w: 0.44, h: 1.0   }, // ~563 × 720 (3/4 portrait card, clipped at canvas height)
    portrait:  { w: 1.0,  h: 0.234 }, // 720 × 300
  },

  // Landscape photo card: 45% × 300 px landscape / 100% × 400 px portrait
  news_timeline: {
    landscape: { w: 0.45, h: 0.417 }, // 576 × 300
    portrait:  { w: 1.0,  h: 0.313 }, // 720 × 400
  },

  data_snapshot: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WHITEBOARD template  (canvas 1280 × 720)
  // ─────────────────────────────────────────────────────────────────────────

  // flex "0 0 36%" of inner row (with 7% side padding), stretched to row height (~88% canvas)
  // portrait uses width 100% with fixed 500 px height
  marker_story: {
    landscape: { w: 0.309, h: 0.88 }, // ~396 × 634 on 1280×720
    portrait:  { w: 1.0,  h: 0.391 }, // 720 × 500
  },
};

/**
 * Compute the CSS `aspect-ratio` string for the image adjustment modal preview box.
 * Returns e.g. "960 / 1080", "1920 / 1080", "1080 / 1920".
 *
 * @param layoutId       The scene's layout registry key (e.g. "hero_image"). Pass null for unknown.
 * @param aspectRatioStr Project aspect ratio — "portrait" or "landscape".
 * @param baseWidth      Template base canvas width in landscape (from templateConfig.baseWidth).
 * @param baseHeight     Template base canvas height in landscape (from templateConfig.baseHeight).
 */
export function getImageBoxAspectRatio(
  layoutId: string | null,
  aspectRatioStr: string,
  baseWidth: number,
  baseHeight: number,
): string {
  const isPortrait = aspectRatioStr === "portrait";
  const canvasW = isPortrait ? baseHeight : baseWidth;
  const canvasH = isPortrait ? baseWidth  : baseHeight;

  const dims = layoutId ? LAYOUT_IMAGE_BOX_DIMS[normalizeLayoutId(layoutId)] : undefined;
  const { w, h } = dims
    ? (isPortrait ? dims.portrait : dims.landscape)
    : { w: 1, h: 1 };

  return `${Math.round(canvasW * w)} / ${Math.round(canvasH * h)}`;
}
