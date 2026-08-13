/**
 * Maps legacy / alias layout IDs to the canonical key used in LAYOUT_IMAGE_BOX_DIMS.
 * Add any new aliases here when templates rename layouts.
 */
import { buildMagazineImageBoxDims } from "./magazine/magazineImageBoxDims";

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
 * Normalize a raw layout ID (which may be a legacy alias, or a `__vN` visual
 * variant) to the canonical key used in LAYOUT_IMAGE_BOX_DIMS.  Returns the input
 * unchanged if nothing matches.
 *
 * Variants share their base layout's image box unless they declare their own
 * LAYOUT_IMAGE_BOX_DIMS entry — an exact entry is checked first, so a variant
 * that reshapes its image slot just adds one under its full ID.
 */
export function normalizeLayoutId(layoutId: string): string {
  const aliased = LAYOUT_ID_ALIASES[layoutId];
  if (aliased) return aliased;
  if (layoutId in LAYOUT_IMAGE_BOX_DIMS) return layoutId;
  const sep = layoutId.indexOf("__");
  return sep === -1 ? layoutId : layoutId.slice(0, sep);
}

export interface ImageBoxDims {
  landscape: { w: number; h: number };
  portrait:  { w: number; h: number };
  /** When true, the layout crops the image into a circle — the adjust-modal
   *  preview box should render round (border-radius 50%) to match. */
  circular?: boolean;
}

/**
 * Image box dimensions for every layout that renders an image, expressed as
 * fractions of the template canvas (imageBoxWidth / canvasWidth, imageBoxHeight / canvasHeight).
 *
 * Canvas base sizes (landscape):
 *   default, nightfall, gridcraft, spotlight, matrix, mosaic, blackswan → 1920 × 1080
 *   whiteboard, newspaper, newscast → 1920 × 1080
 *   magazine → 1920 × 1080
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

  // ── NEWSPAPER: news_headline / article_lead and their style variants ──
  //
  // Every value below is MEASURED, not derived: each layout was rendered in a
  // real browser at its true canvas (1280×720 / 720×1280) and the painted image
  // card was read off with getBoundingClientRect, so these match what the
  // adjust-modal preview has to mirror. Layouts whose image sits in a flex slot
  // depend on how much room the copy takes, so they were measured with a
  // representative ~180-character narration.
  //
  // Variants need their OWN entry: normalizeLayoutId() strips the `__vN` suffix
  // and falls back to the base, which is the wrong shape for all four here.
  // pull_quote__v2 / ending_socials__v2 are intentionally absent — they render
  // no image (both bases are in meta.json `layouts_without_image`).

  // Polaroid-style card, tilted, pinned right (landscape) / centred (portrait).
  news_headline: {
    landscape: { w: 0.435, h: 0.594 }, // measured 557 × 428
    portrait:  { w: 0.841, h: 0.381 }, // measured 606 × 487
  },

  // Tilted photo card beside the lead column.
  article_lead: {
    landscape: { w: 0.368, h: 0.593 }, // measured 471 × 427
    portrait:  { w: 0.844, h: 0.367 }, // measured 607 × 469
  },

  // NewsHeadlineV2 — "Broadsheet": below-the-fold card under the masthead.
  // Wide and short in landscape; nearly square and much taller in portrait,
  // where it takes the whole lower half of the page.
  news_headline__v2: {
    landscape: { w: 0.521, h: 0.344 }, // measured 667 × 248
    portrait:  { w: 0.791, h: 0.480 }, // measured 570 × 614
  },

  // NewsHeadlineV3 — "Stacked Deck": pasted cutout beside the column. Nearly
  // full content height in landscape, so the box is tall rather than wide.
  news_headline__v3: {
    landscape: { w: 0.407, h: 0.783 }, // measured 521 × 564
    portrait:  { w: 0.900, h: 0.539 }, // measured 648 × 691
  },

  // ArticleLeadV2 — "Two Column": a wide strip spanning the full measure under
  // the head, so the landscape box is a letterbox.
  article_lead__v2: {
    landscape: { w: 0.840, h: 0.312 }, // measured 1075 × 225
    portrait:  { w: 0.840, h: 0.288 }, // measured 605 × 368
  },

  // ArticleLeadV3 — "Sidebar Stat": narrow picture rail down the side in
  // landscape; a band under the copy in portrait, whose height varies with
  // narration length (see portraitImageMaxHeight) — this is the mid case.
  article_lead__v3: {
    landscape: { w: 0.304, h: 0.639 }, // measured 389 × 460
    portrait:  { w: 0.878, h: 0.374 }, // measured 632 × 479
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

  // Polaroid expert photo: left 45% column landscape / top 38% band portrait
  // (see ExpertProfile.tsx). Landscape: 45%-wide column, side padding 6%/4%
  // (% is width-relative) → card ~448px wide; flex:1 fills the column minus the
  // credit line → ~76% canvas height. Portrait: top 38% band with 6% margins.
  expert_profile: {
    landscape: { w: 0.42, h: 0.76 }, // widened preview box for the left-column polaroid card
    portrait:  { w: 0.88, h: 0.38 }, // top 38% with 6% side margin → 634 × 486
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

  // The v2 variant reshapes the slot entirely: instead of an inset rounded card
  // in a flex row, the photo is a full-bleed panel pinned to the left half
  // (landscape) or bannered across the top (portrait). Needs its own entry —
  // falling back to the base above would report the wrong crop box.
  marker_story__v2: {
    landscape: { w: 0.52, h: 1.0 },  // 666 × 720 on 1280×720
    portrait:  { w: 1.0,  h: 0.34 }, // 720 × 435
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHRONICLE template  (canvas 1920 × 1080)
  // ─────────────────────────────────────────────────────────────────────────

  // Two-page spread: image is the right page (~flex 1.1 of ~50% canvas width).
  // Portrait stacks: image is ~88% × 35%.
  parchment_scroll: {
    landscape: { w: 0.52, h: 0.70 }, // ~998 × 756
    portrait:  { w: 0.88, h: 0.35 }, // ~950 × 672
  },

  // Quote with optional inline image plate (flex 0 0 30%, ~60% width within column)
  illuminated_quote: {
    landscape: { w: 0.30, h: 0.40 }, // ~576 × 432
    portrait:  { w: 0.60, h: 0.20 }, // ~648 × 384
  },

  // Two-page versus folio: each side holds an embossed image (~70% wide on each half).
  // We use the larger half for the preview box.
  versus_folio: {
    landscape: { w: 0.35, h: 0.55 }, // ~672 × 594
    portrait:  { w: 1.00, h: 0.28 }, // ~1080 × 537 (top page)
  },

  // Unfurled cartographer's map — occupies most of the canvas.
  map_reveal: {
    landscape: { w: 0.80, h: 0.85 }, // ~1536 × 918
    portrait:  { w: 0.95, h: 0.70 }, // ~1026 × 1344
  },

  // Ledger-of-facts header image (optional): ~55% wide landscape, 85% wide portrait
  ledger_stats: {
    landscape: { w: 0.55, h: 0.40 }, // ~1056 × 432
    portrait:  { w: 0.85, h: 0.30 }, // ~918 × 576
  },

  // book_open, chapter_plate, ledger_stats, chronicle_timeline, decree_seal and
  // ending_socials hide the image (layouts_without_image). Let them fall back to
  // the default full-canvas placeholder since no image adjustment is exposed.

  // ─────────────────────────────────────────────────────────────────────────
  // LADUC template  (canvas 1920 × 1080)
  // Mirrors LADUC_LAYOUTS in templateConfig.tsx + LADUC_LAYOUT_REGISTRY in
  // laduc/layouts/index.ts. `market_annotation` and `ticker` deliberately
  // omitted — they're declared in meta.json `layouts_without_image`, so the
  // editor hides the image picker entirely. `tier_showcase` is NOT a real
  // LaDuc layout (no registry entry, no validLayouts membership).
  // ─────────────────────────────────────────────────────────────────────────

  // Full-bleed editorial canvas — image fills the whole frame via
  // LaDucLayoutImageBackground in both orientations.
  masthead:        { landscape: { w: 1.0, h: 1.0 }, portrait: { w: 1.0, h: 1.0 } },
  data_impact:     { landscape: { w: 1.0, h: 1.0 }, portrait: { w: 1.0, h: 1.0 } },
  two_column:      { landscape: { w: 1.0, h: 1.0 }, portrait: { w: 1.0, h: 1.0 } },
  kinetic_quote:   { landscape: { w: 1.0, h: 1.0 }, portrait: { w: 1.0, h: 1.0 } },
  sign_off:        { landscape: { w: 1.0, h: 1.0 }, portrait: { w: 1.0, h: 1.0 } },
  ending_socials:  { landscape: { w: 1.0, h: 1.0 }, portrait: { w: 1.0, h: 1.0 } },

  // Right-side editorial card (landscape) / full-bleed (portrait).
  // Each of these three render `<ZoomCropImg>` in an explicit absolute card
  // when landscape, and switch to a full-bleed LaDucLayoutImageBackground
  // in portrait — so the focus picker mirrors that shape.

  // DeepDive: right:0, top:0, bottom:0, width:38% → 38% × 100% (≈ 730 × 1080)
  // See LaDucDeepDive.tsx:132-145
  deep_dive: {
    landscape: { w: 0.38, h: 1.00 },
    portrait:  { w: 1.00, h: 1.00 },
  },

  // ThesisStatement: right:padH(8%), top:14%, bottom:14%, width:34%
  //   → 34% × 72% (≈ 653 × 778)
  // See LaDucThesisStatement.tsx:147-160
  thesis_statement: {
    landscape: { w: 0.34, h: 0.72 },
    portrait:  { w: 1.00, h: 1.00 },
  },

  // FrameworkFlow: image card inside the steps rail.
  // rail ≈ canvas × (1 − 2×7.5% padH) ≈ 85% wide
  // rail ≈ 55% canvas height (top header + bottom footnote + padV 5.5% × 2)
  // image takes flex: 0 0 28% of rail width → 0.28 × 0.85 ≈ 0.24 wide × 0.55 high
  // See LaDucFrameworkFlow.tsx:330-344
  // ─────────────────────────────────────────────────────────────────────────
  // STICKMAN 2 template  (canvas 1920 × 1080)
  // Full-bleed atmospheric background at 0.35 opacity — same as chalk_title hero.
  // ─────────────────────────────────────────────────────────────────────────

  chalk_title: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  shooting_star: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  night_walk: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  lantern_dialogue: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  neon_countdown: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STICKMAN_FOOTBALL template  (canvas 1920 × 1080)
  // Only kickoff_title, freekick_setup and goal_moment render an image; every
  // other layout is in meta.json `layouts_without_image`. All three draw the
  // image as a centered circular "mood" vignette of a fixed size — 560×560 in
  // landscape, 420×420 in portrait (see KickoffTitle/FreekickSetup/GoalMoment).
  // ─────────────────────────────────────────────────────────────────────────

  kickoff_title: {
    landscape: { w: 0.292, h: 0.519 }, // 560 × 560 on 1920×1080 (1:1 box)
    portrait:  { w: 0.389, h: 0.219 }, // 420 × 420 on 1080×1920 (1:1 box)
    circular: true,
  },
  freekick_setup: {
    landscape: { w: 0.292, h: 0.519 },
    portrait:  { w: 0.389, h: 0.219 },
    circular: true,
  },
  goal_moment: {
    landscape: { w: 0.292, h: 0.519 },
    portrait:  { w: 0.389, h: 0.219 },
    circular: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ECONOMIST template  (canvas 1920 × 1080)
  // Image-capable: cover_reveal, image_feature, section_divider (full-bleed
  // hero/backdrop) and the matted leader_article (left plate) / leader_quote
  // (portrait mat card). See CoverReveal/ImageFeature/SectionDivider/
  // LeaderArticle/LeaderQuote.
  // ─────────────────────────────────────────────────────────────────────────

  cover_reveal: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  image_feature: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  section_divider: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },
  // Left duotone plate ~42% width / full height (landscape); top band in portrait.
  leader_article: {
    landscape: { w: 0.42, h: 0.85 }, // ~806 × 918
    portrait:  { w: 0.86, h: 0.28 }, // ~929 × 528
  },
  // Matted editorial portrait card up the right margin (landscape) / lower band (portrait).
  leader_quote: {
    landscape: { w: 0.26, h: 0.58 }, // ~499 × 626
    portrait:  { w: 0.64, h: 0.22 }, // ~691 × 422
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SAKURA template  (canvas 1920 × 1080)
  // Mirrors SAKURA_LAYOUTS in templateConfig.tsx + SAKURA_LAYOUT_REGISTRY.
  // Only sakura_intro, sakura_section, sakura_text_narration,
  // sakura_list_scene and sakura_stat_highlight render an image; every other
  // sakura layout (incl. sakura_two_column_detail) is in meta.json
  // `layouts_without_image`, so the editor hides the image picker.
  // ─────────────────────────────────────────────────────────────────────────

  // Hero: image is a full-bleed blended BACKGROUND behind the title stack.
  // See SakuraIntro.tsx (heroBg).
  sakura_intro: {
    landscape: { w: 1.0, h: 1.0 },
    portrait:  { w: 1.0, h: 1.0 },
  },

  // Right-column photo panel: 620×700 landscape; (width−160)×620 portrait.
  // See SakuraSection.tsx (panelW/panelH).
  sakura_section: {
    landscape: { w: 0.323, h: 0.648 }, // 620 × 700
    portrait:  { w: 0.852, h: 0.323 }, // (1080−160) × 620
  },

  // Right-side supporting panel: 620×700 landscape; (width−160)×620 portrait.
  // See SakuraTextNarration.tsx (panelW/panelH).
  sakura_text_narration: {
    landscape: { w: 0.323, h: 0.648 },
    portrait:  { w: 0.852, h: 0.323 },
  },

  // Right-side supporting panel down the list's empty right edge: 36% × full
  // height landscape; bottom band (width−160 × 30%) portrait.
  // See SakuraListScene.tsx (imagePanel).
  sakura_list_scene: {
    landscape: { w: 0.360, h: 1.0 },
    portrait:  { w: 0.852, h: 0.30 },
  },

  // Circular vignette behind the number: 560 landscape / 420 portrait.
  // See SakuraStatHighlight.tsx (vignetteSize).
  sakura_stat_highlight: {
    landscape: { w: 0.292, h: 0.519 }, // 560 × 560 (1:1 box)
    portrait:  { w: 0.389, h: 0.219 }, // 420 × 420 (1:1 box)
    circular: true,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MAGAZINE template — computed from layout geometry (magazineImageBoxDims.ts)
  // ─────────────────────────────────────────────────────────────────────────
  ...buildMagazineImageBoxDims(),
};

/**
 * True when a layout crops its image into a circle, so the adjust-modal preview
 * box should be rendered round. Falls back to false for unknown layouts.
 */
export function isImageBoxCircular(layoutId: string | null): boolean {
  if (!layoutId) return false;
  return LAYOUT_IMAGE_BOX_DIMS[normalizeLayoutId(layoutId)]?.circular ?? false;
}

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
