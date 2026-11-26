import type { SceneLayoutProps } from "./types";

type TypographyKind = "title" | "body";

/** Festive Christmas-card script for titles, numbers and tags (one weight: 400). */
export const CHRISTMAS_TITLE_FONT = '"Berkshire Swash", "Georgia", serif';
/** Rounded, very readable body face. */
export const CHRISTMAS_BODY_FONT = '"Nunito", "Helvetica Neue", Arial, sans-serif';

/**
 * Font stacks for a layout. A project font chosen by the user replaces BOTH faces
 * (same contract as every other built-in: one project font wins everywhere).
 */
export const getChristmasFonts = (props: Pick<SceneLayoutProps, "fontFamily">) => {
  const custom = props.fontFamily?.trim();
  return {
    title: custom || CHRISTMAS_TITLE_FONT,
    body: custom || CHRISTMAS_BODY_FONT,
    /** Berkshire Swash ships one weight — never fake-bold it; a project font gets bold. */
    titleWeight: custom ? 700 : 400,
  };
};

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
 * `defaults` in backend/templates/christmas/meta.json.
 */
export type ChristmasSizes = (titleFontSize?: number, descriptionFontSize?: number) => { title: number; body: number };

/**
 * The built-in font-size contract (same as Crumpled / Starlit):
 * - `title` / `body` drive ONE primary element each. When the matching `*IsUserSet`
 *   flag is true, that element renders at exactly that px (FitText `exact`);
 *   otherwise the value is a starting size that may auto-shrink.
 * - Secondary text uses `titleRelative(base)` / `bodyRelative(base)`, which scale
 *   `base` by how far the slider has moved from THIS layout's default.
 */
export const getChristmasTypography = (
  props: Pick<
    SceneLayoutProps,
    "titleFontSize" | "descriptionFontSize" | "titleFontSizeIsUserSet" | "descriptionFontSizeIsUserSet"
  >,
  sizes: ChristmasSizes,
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
