import type { SceneLayoutProps } from "./types";

type TypographyKind = "title" | "body";

export const STARLIT_DEFAULT_FONT = '"Space Grotesk", "Inter", system-ui, sans-serif';

/** One font stack for every Starlit layout, label, caption, and CTA. */
export const getStarlitFontFamily = (
  props: Pick<SceneLayoutProps, "fontFamily">,
) => props.fontFamily?.trim() || STARLIT_DEFAULT_FONT;

/**
 * Starlit's editor exposes one title-size control and one body-size control.
 * Primary copy uses those values directly; secondary labels keep their visual
 * hierarchy by scaling in the same proportion as the corresponding control.
 */
export const getStarlitTypography = (
  props: Pick<SceneLayoutProps, "titleFontSize" | "descriptionFontSize" | "titleFontSizeIsUserSet" | "descriptionFontSizeIsUserSet">,
  portrait: boolean,
) => {
  const defaultTitle = portrait ? 92 : 76;
  const defaultBody = portrait ? 52 : 40;
  const title = props.titleFontSize ?? defaultTitle;
  const body = props.descriptionFontSize ?? defaultBody;
  const titleScale = title / defaultTitle;
  const bodyScale = body / defaultBody;

  const relative = (basePx: number, kind: TypographyKind = "body") =>
    Math.max(1, Math.round(basePx * (kind === "title" ? titleScale : bodyScale) * 100) / 100);

  return {
    title,
    body,
    titleIsUserSet: props.titleFontSizeIsUserSet === true,
    bodyIsUserSet: props.descriptionFontSizeIsUserSet === true,
    titleRelative: (basePx: number) => relative(basePx, "title"),
    bodyRelative: (basePx: number) => relative(basePx, "body"),
  };
};
