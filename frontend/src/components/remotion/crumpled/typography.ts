import type { SceneLayoutProps } from "./types";

type TypographyKind = "title" | "body";

/** Caveat — a natural pencil-handwriting face — for every title, body, label and caption. */
export const CRUMPLED_DEFAULT_FONT = '"Caveat", "Patrick Hand", "Comic Sans MS", cursive';

/** One font stack for every Crumpled Paper layout. A project font chosen by the user wins. */
export const getCrumpledFontFamily = (props: Pick<SceneLayoutProps, "fontFamily">) =>
  props.fontFamily?.trim() || CRUMPLED_DEFAULT_FONT;

/**
 * A layout's default sizes, written ONCE inside the layout file as
 *
 *   (titleFontSize, descriptionFontSize) => ({
 *     title: titleFontSize ?? (p ? 104 : 92),
 *     body: descriptionFontSize ?? (p ? 60 : 50),
 *   })
 *
 * That literal shape is what Template Studio's "save to source" rewrites
 * (backend/app/routers/template_studio.py), and it must match the layout's
 * `defaults` in backend/templates/crumpled/meta.json.
 */
export type CrumpledSizes = (titleFontSize?: number, descriptionFontSize?: number) => { title: number; body: number };

/**
 * The built-in font-size contract (same as Starlit):
 * - `title` / `body` drive ONE primary element each. When the matching `*IsUserSet`
 *   flag is true (a size the user picked), that element renders at exactly that px
 *   (FitText `exact`); otherwise the value is a starting size that may auto-shrink.
 * - Secondary text uses `titleRelative(base)` / `bodyRelative(base)`, which scale
 *   `base` by how far the slider has moved from THIS layout's default.
 */
export const getCrumpledTypography = (
  props: Pick<
    SceneLayoutProps,
    "titleFontSize" | "descriptionFontSize" | "titleFontSizeIsUserSet" | "descriptionFontSizeIsUserSet"
  >,
  sizes: CrumpledSizes,
) => {
  const base = sizes();
  const current = sizes(props.titleFontSize, props.descriptionFontSize);
  const titleScale = current.title / (base.title || 1);
  const bodyScale = current.body / (base.body || 1);

  const relative = (basePx: number, kind: TypographyKind) =>
    Math.max(1, Math.round(basePx * (kind === "title" ? titleScale : bodyScale) * 100) / 100);

  return {
    title: current.title,
    body: current.body,
    titleIsUserSet: props.titleFontSizeIsUserSet === true,
    bodyIsUserSet: props.descriptionFontSizeIsUserSet === true,
    titleRelative: (basePx: number) => relative(basePx, "title"),
    bodyRelative: (basePx: number) => relative(basePx, "body"),
  };
};
