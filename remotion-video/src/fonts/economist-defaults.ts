/**
 * Economist template default fonts ("newspaper × economic article" aesthetic).
 *
 * The real magazine uses proprietary faces (Milo Serif for body/headlines,
 * Econ Sans — an Officina-based grotesque — for charts/labels). Those cannot be
 * licensed here, so we use the closest free @fontsource mimics:
 *
 *   - Source Serif 4: editorial transitional serif → masthead wordmark,
 *     headlines, drop-caps, article body, pull-quotes.
 *   - Inter: neutral grotesque → chart titles, axis/series labels, section
 *     kickers, captions, source lines, KPI labels, ▶PROS/▶CONS headers.
 *
 * Bundled here so they render in server-side video even when the project font
 * is unset. NOT in the user-selectable font registry — template defaults only.
 * (The serif role stays user-swappable via the existing `fontFamily` override,
 * like every other template.)
 */
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-serif-4/900.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/600-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";

export const ECONOMIST_SERIF_FONT =
  "'Source Serif 4', Georgia, 'Times New Roman', serif";

export const ECONOMIST_SANS_FONT =
  "'Inter', 'Helvetica Neue', Arial, sans-serif";
