/**
 * The Economist template — "newspaper × economic article" aesthetic.
 *
 * A blog/article rendered like a modern issue of The Economist: warm paper,
 * near-black ink, one decisive red, hairline rules, custom-SVG data charts that
 * match the reference images, and a signature blue/red PROS·CONS page.
 *
 * Types mirror the shape used by other templates (see chronicle/types.ts).
 */
import type { SocialsMap } from "../SocialIcons";

export type EconomistLayoutType =
  | "cover_reveal" // HERO — the magazine cover intro
  | "leader_article" // fallback — drop-cap article page
  | "section_divider" // chapter break
  | "chart_line" // custom-SVG line chart (← linechart1 / linechart2)
  | "chart_bar" // custom-SVG bar chart (← common.jpg)
  | "data_table" // ranked rows + inline red magnitude bars
  | "pros_cons" // signature ▶PROS (blue) / ▶CONS (red)
  | "key_indicators" // "by the numbers" KPI panel
  | "leader_quote" // oversized red quote mark + pull-quote
  | "image_feature" // full-bleed photo + caption + headline
  | "ending_socials"; // sign-off masthead + CTA + socials

/** chartTable data shape shared across templates (Bloomberg/Newscast contract):
 *  first column = x-axis labels, remaining columns = numeric series. */
export interface EconomistChartTable {
  headers?: string[];
  rows?: Array<Array<string | number>>;
}

export interface EconomistProsConsItem {
  /** Short bold uppercase lead-in clause (≤6 words). */
  lead: string;
  /** One-sentence explanation. */
  body: string;
}

export interface EconomistIndicator {
  value: string;
  label: string;
  /** Optional trend delta, e.g. "+2.3%" or "-0.4pp". Leading +/− tints up/down. */
  delta?: string;
  /** Optional comparison baseline value (e.g. prior period / benchmark figure). */
  compareValue?: string;
  /** Optional comparison label (e.g. "vs 2024", "vs forecast"). Defaults to "vs". */
  compareLabel?: string;
}

export interface EconomistLayoutProps {
  title: string;
  narration?: string;

  // Global theming
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  aspectRatio?: "landscape" | "portrait";
  fontFamily?: string;

  // Responsive typography (drives the scene editor)
  titleFontSize?: number;
  descriptionFontSize?: number;

  // Image adjustment modal props
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;

  // ── Editorial chrome / shared ──────────────────────────────────────────────
  /** Section kicker shown on a hairline rule (e.g. "BRIEFING", "FINANCE"). */
  sectionLabel?: string;
  /** Issue dateline / folio (e.g. "MAY 23RD–29TH 2026"). */
  dateline?: string;
  /** Byline (e.g. "By our finance correspondent"). */
  byline?: string;
  /** Source attribution line (charts, tables, KPI panels). */
  source?: string;
  /** Footnote (e.g. "*Population-weighted average"). */
  note?: string;

  // ── cover_reveal ───────────────────────────────────────────────────────────
  /** Masthead wordmark — the brand/publication name from the brief. Hidden when
   * empty; never falls back to "The Economist" (that is the style homage). */
  wordmark?: string;
  /** Contents teaser headlines on hairline-ruled rows (top-right of the cover). */
  teasers?: string[];

  // ── leader_article ─────────────────────────────────────────────────────────
  /** Drop-cap override; defaults to the first letter of the body. */
  illuminatedLetter?: string;

  // ── section_divider ──────────────────────────────────────────────────────────
  /** Short standfirst under the section name. */
  standfirst?: string;

  // ── chart_line / chart_bar / data_table ──────────────────────────────────────
  chartTable?: EconomistChartTable;
  /** "line" | "bar" | "hbar" — chart_bar reads bar/hbar; chart_line reads line. */
  chartType?: "line" | "bar" | "hbar";
  /** Series names (≤4) to highlight in colour; the rest render as grey context lines. */
  highlightSeries?: string[];
  /** Per-series colour overrides (hex), index-aligned to the highlighted series. */
  seriesColors?: string[];
  /** Emphasise a black zero line when the data crosses zero. Default true. */
  emphasizeZero?: boolean;
  /** Boxed panel number top-right (e.g. "2"), as in linechart2. */
  panelNumber?: string | number;
  /** Unit suffix for value labels (e.g. "%", "$"). */
  unit?: string;
  /** Label placement for line series: "end" (right of each line) or "inline" (on the chart). */
  labelMode?: "end" | "inline";

  // ── pros_cons ─────────────────────────────────────────────────────────────
  pros?: EconomistProsConsItem[];
  cons?: EconomistProsConsItem[];
  /** Column header overrides for non-binary framings. Default "PROS"/"CONS". */
  prosLabel?: string;
  consLabel?: string;
  /** Justified intro paragraph above the two columns. */
  intro?: string;

  // ── key_indicators ──────────────────────────────────────────────────────────
  indicators?: EconomistIndicator[];

  // ── leader_quote ────────────────────────────────────────────────────────────
  quote?: string;
  attribution?: string;
  highlightPhrase?: string;

  // ── image_feature ───────────────────────────────────────────────────────────
  caption?: string;
  credit?: string;

  // ── ending_socials ──────────────────────────────────────────────────────────
  socials?: SocialsMap | Array<Record<string, unknown>>;
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  /** Optional multi-CTA array (up to 3). When present, renderer renders columns. */
  ctas?: Array<{
    ctaButtonText?: string;
    websiteLink?: string;
    showWebsiteButton?: boolean;
  }>;
}
