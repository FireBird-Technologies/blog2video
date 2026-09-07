// Central font registry for frontend (player + UI).
// Each id maps to a human label and CSS font-family string.

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto-slab/400.css";
import "@fontsource/roboto-slab/600.css";
import "@fontsource/roboto-slab/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/arimo/400.css";
import "@fontsource/arimo/600.css";
import "@fontsource/arimo/700.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/600.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/700.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "@fontsource/fira-code/700.css";
import "@fontsource/righteous/400.css";
import "@fontsource/im-fell-english/400.css";
import "@fontsource/pirata-one/400.css";
import "@fontsource/cinzel-decorative/400.css";
import "@fontsource/cinzel-decorative/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/shippori-mincho/400.css";
import "@fontsource/shippori-mincho/700.css";

export type FontId =
  | "inter"
  | "roboto_slab"
  | "patrick_hand"
  | "arimo"
  | "archivo_black"
  | "poppins"
  | "montserrat"
  | "merriweather"
  | "playfair_display"
  | "oswald"
  | "lora"
  | "fira_code"
  | "righteous"
  | "im_fell_english"
  | "pirata_one"
  | "cinzel_decorative"
  | "dm_sans"
  | "source_sans_3"
  | "source_serif_4"
  | "shippori_mincho";

export interface FontOption {
  id: FontId;
  label: string;
  cssFamily: string;
}

export const FONT_REGISTRY: Record<FontId, FontOption> = {
  inter: {
    id: "inter",
    label: "Inter",
    cssFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  roboto_slab: {
    id: "roboto_slab",
    label: "Roboto Slab",
    cssFamily: "'Roboto Slab', serif",
  },
  patrick_hand: {
    id: "patrick_hand",
    label: "Patrick Hand",
    cssFamily: "'Patrick Hand', system-ui, sans-serif",
  },
  arimo: {
    id: "arimo",
    label: "Arimo",
    cssFamily: "Arimo, Arial, sans-serif",
  },
  archivo_black: {
    id: "archivo_black",
    label: "Archivo Black",
    cssFamily: "'Archivo Black', 'Arial Black', 'Helvetica Neue', sans-serif",
  },
  poppins: {
    id: "poppins",
    label: "Poppins",
    cssFamily: "Poppins, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  montserrat: {
    id: "montserrat",
    label: "Montserrat",
    cssFamily: "Montserrat, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  merriweather: {
    id: "merriweather",
    label: "Merriweather",
    cssFamily: "Merriweather, 'Times New Roman', serif",
  },
  playfair_display: {
    id: "playfair_display",
    label: "Playfair Display",
    cssFamily: "'Playfair Display', 'Times New Roman', serif",
  },
  oswald: {
    id: "oswald",
    label: "Oswald",
    cssFamily: "Oswald, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  lora: {
    id: "lora",
    label: "Lora",
    cssFamily: "Lora, 'Times New Roman', serif",
  },
  fira_code: {
    id: "fira_code",
    label: "Fira Code",
    cssFamily: "'Fira Code', 'Courier New', monospace",
  },
  righteous: {
    id: "righteous",
    label: "Righteous",
    cssFamily: "Righteous, 'Arial Black', sans-serif",
  },
  im_fell_english: {
    id: "im_fell_english",
    label: "IM Fell English",
    cssFamily: "'IM Fell English', 'Times New Roman', serif",
  },
  pirata_one: {
    id: "pirata_one",
    label: "Pirata One",
    cssFamily: "'Pirata One', 'Times New Roman', serif",
  },
  cinzel_decorative: {
    id: "cinzel_decorative",
    label: "Cinzel Decorative",
    cssFamily: "'Cinzel Decorative', 'Times New Roman', serif",
  },
  dm_sans: {
    id: "dm_sans",
    label: "DM Sans",
    cssFamily: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  source_sans_3: {
    id: "source_sans_3",
    label: "Source Sans 3",
    cssFamily: "'Source Sans 3', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  source_serif_4: {
    id: "source_serif_4",
    label: "Source Serif 4",
    cssFamily: "'Source Serif 4', 'Times New Roman', serif",
  },
  shippori_mincho: {
    id: "shippori_mincho",
    label: "Shippori Mincho",
    cssFamily: "'Shippori Mincho', 'Times New Roman', serif",
  },
};

/** Every selectable font, in registry order — for pickers. */
export const FONT_OPTIONS: FontOption[] = Object.values(FONT_REGISTRY);

/**
 * Best-effort match of a free-form font NAME to a registry id.
 *
 * The theme extractor writes whatever face it saw on the site ("Playfair
 * Display", "DM Sans"), which is a label, not an id — and sometimes a face that
 * is not bundled at all. Anything unmatched returns null, which the caller shows
 * as an explicit "not bundled" state rather than silently pretending it will
 * render (it would fall back to the system sans).
 */
export function fontIdFromName(name: string | null | undefined): FontId | null {
  if (!name) return null;
  const norm = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (norm in FONT_REGISTRY) return norm as FontId;
  const byLabel = FONT_OPTIONS.find(
    (f) => f.label.toLowerCase().replace(/[\s-]+/g, "_") === norm,
  );
  return byLabel?.id ?? null;
}

export function resolveFontFamily(id: string | null | undefined): string | null {
  if (!id) return null;
  const key = id as FontId;
  return FONT_REGISTRY[key]?.cssFamily ?? null;
}

/**
 * The Google Fonts FAMILY name for a free-form font name, or null.
 *
 * Google Fonts is case-sensitive and does not accept snake_case:
 * `family=merriweather` returns HTTP 400, `family=Merriweather` returns 200.
 * The theme extractor stores whatever the model wrote — measured across the 12
 * most recent templates, 4 carry a name that 400s ("merriweather", "oswald",
 * "playfair_display", "dm_sans"), so their stylesheet never loaded and the face
 * silently fell back to the system font.
 *
 * Returns null for a face the app does not ship, so callers can skip the
 * request instead of firing another 400.
 */
export function googleFontFamily(name: string | null | undefined): string | null {
  const id = fontIdFromName(name);
  return id ? FONT_REGISTRY[id].label : null;
}

/**
 * A usable CSS font-family stack for a free-form font name.
 *
 * Falls back to the name as written when it is not in the registry: a template
 * may legitimately name a face the user has installed locally, and a bare name
 * still beats dropping the declaration entirely.
 */
export function cssFamilyFromName(
  name: string | null | undefined,
  fallback = "sans-serif",
): string {
  const id = fontIdFromName(name);
  if (id) return FONT_REGISTRY[id].cssFamily;
  return name ? `${name}, ${fallback}` : fallback;
}
