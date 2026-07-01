/**
 * Magazine template default fonts (authentic print-editorial aesthetic).
 *
 * Pairing chosen to mimic a glossy newsstand title without licensing
 * proprietary faces:
 *   - Playfair Display: high-contrast didone-ish serif → masthead wordmark,
 *     cover lines, headlines, pull quotes, oversized figures, drop caps.
 *   - Source Serif 4: refined transitional book serif → body copy, Q&A
 *     answers, captions, fine print.
 *   - Inter: neutral grotesque → kickers, folios, running heads, table
 *     headers, tracked uppercase labels.
 *
 * Bundled here so they render in server-side video even when the project font
 * is unset. The serif role stays user-swappable via the `fontFamily` override.
 */
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/800.css";
import "@fontsource/playfair-display/900.css";
import "@fontsource/playfair-display/500-italic.css";
import "@fontsource/playfair-display/600-italic.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/source-serif-4/600-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

export const MAGAZINE_DISPLAY_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";
export const MAGAZINE_SERIF_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
export const MAGAZINE_SANS_FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
