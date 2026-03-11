// Central font registry for frontend (player + UI).
// Each id maps to a human label and CSS font-family string.

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/roboto-slab/400.css";
import "@fontsource/roboto-slab/600.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/oswald/400.css";
import "@fontsource/lora/400.css";
import "@fontsource/fira-code/400.css";

export type FontId =
  | "inter"
  | "roboto_slab"
  | "patrick_hand"
  | "poppins"
  | "montserrat"
  | "merriweather"
  | "playfair_display"
  | "oswald"
  | "lora"
  | "fira_code";

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
};

export function resolveFontFamily(id: string | null | undefined): string | null {
  if (!id) return null;
  const key = id as FontId;
  return FONT_REGISTRY[key]?.cssFamily ?? null;
}

