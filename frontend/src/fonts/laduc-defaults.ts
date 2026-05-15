/**
 * LaDuc template default fonts.
 *
 * The font binaries are bundled under:
 *   public/templates/laduc/fonts/funcion-pro/
 *
 * This module is imported for side effects by the LaDuc preview/runtime
 * composition. It registers the FunctionPro family so CSS
 * `font-family: 'FunctionPro'` resolves in the browser preview.
 */
import { staticFile } from "remotion";

type FontFaceDef = {
  file: string;
  weight: number;
  style?: "normal" | "italic";
};

const FONT_DIR = "templates/laduc/fonts/funcion-pro";
const STYLE_ID = "laduc-functionpro-font-faces";

const FACES: FontFaceDef[] = [
  { file: "FunctionPro-Light.otf", weight: 300 },
  { file: "FunctionPro-LightOblique.otf", weight: 300, style: "italic" },
  { file: "FunctionPro-Book.otf", weight: 400 },
  { file: "FunctionPro-BookOblique.otf", weight: 400, style: "italic" },
  { file: "FunctionPro-Medium.otf", weight: 500 },
  { file: "FunctionPro-MediumOblique.otf", weight: 500, style: "italic" },
  { file: "FunctionPro-Demi.otf", weight: 600 },
  { file: "FunctionPro-DemiOblique.otf", weight: 600, style: "italic" },
  { file: "FunctionPro-Bold.otf", weight: 700 },
  { file: "FunctionPro-BoldOblique.otf", weight: 700, style: "italic" },
  { file: "FunctionPro-ExtraBold.otf", weight: 800 },
  { file: "FunctionPro-ExtraBoldOblique.otf", weight: 800, style: "italic" },
];

const css = FACES.map(({ file, weight, style = "normal" }) => `
@font-face {
  font-family: 'FunctionPro';
  src: url('${staticFile(`${FONT_DIR}/${file}`)}') format('opentype');
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}
`).join("\n");

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export const LADUC_FUNCTION_PRO_FONT = "'FunctionPro'";
