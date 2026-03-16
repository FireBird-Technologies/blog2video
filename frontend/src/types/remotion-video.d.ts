declare module "@remotion-video/templates/default/layouts" {
  export const LAYOUT_REGISTRY: Record<string, any>;
  export type LayoutType = string;
  export type SceneLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/nightfall/layouts" {
  export const NIGHTFALL_LAYOUT_REGISTRY: Record<string, any>;
  export type NightfallLayoutType = string;
  export type NightfallLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/gridcraft/layouts" {
  export const GRIDCRAFT_LAYOUT_REGISTRY: Record<string, any>;
}

declare module "@remotion-video/templates/spotlight/layouts" {
  export const SPOTLIGHT_LAYOUT_REGISTRY: Record<string, any>;
  export type SpotlightLayoutType = string;
  export type SpotlightLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/matrix/layouts" {
  export const MATRIX_LAYOUT_REGISTRY: Record<string, any>;
  export type MatrixLayoutType = string;
  export type MatrixLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/whiteboard/layouts" {
  export const WHITEBOARD_LAYOUT_REGISTRY: Record<string, any>;
  export type WhiteboardLayoutType = string;
  export type WhiteboardLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/newspaper/layouts" {
  export const NEWSPAPER_LAYOUT_REGISTRY: Record<string, any>;
  export type NewspaperLayoutType = string;
  export type BlogLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/custom/UniversalScene" {
  export const UniversalScene: any;
}

declare module "@remotion-video/templates/custom/types" {
  export type CustomTheme = Record<string, any>;
  export type SceneLayoutConfig = Record<string, any>;
}
