/**
 * Chronicle template default fonts (medieval chronicle / illuminated manuscript).
 * Bundled here so they render in preview when project font is not set.
 * NOT in the user-selectable font registry — hardcoded template defaults only.
 */
import "@fontsource/cinzel-decorative/400.css";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/cinzel-decorative/900.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/im-fell-english/400-italic.css";
import "@fontsource/im-fell-english-sc/400.css";
import "@fontsource/pirata-one/400.css";

export const CHRONICLE_HEADING_FONT =
  "'Cinzel Decorative', 'Trajan Pro', Georgia, 'Times New Roman', serif";

export const CHRONICLE_BODY_FONT =
  "'IM Fell English', Georgia, 'Times New Roman', serif";

export const CHRONICLE_SMALLCAPS_FONT =
  "'IM Fell English SC', 'IM Fell English', Georgia, serif";

export const CHRONICLE_BLACKLETTER_FONT =
  "'Pirata One', 'UnifrakturCook', 'Cinzel Decorative', serif";
