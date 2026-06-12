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

declare module "@remotion-video/templates/spotlight/transitions" {
  import type { TransitionPresentation, TransitionTiming } from "@remotion/transitions";
  export interface SpotlightTransitionChoice {
    presentation: TransitionPresentation<Record<string, unknown>>;
    timing: TransitionTiming;
    frames: number;
  }
  export function pickSpotlightTransition(
    fromIdx: number,
    fromLayout: string,
    toLayout: string,
    w?: number,
    h?: number,
  ): SpotlightTransitionChoice;
  export const SPOTLIGHT_TRANSITION_POOL_SIZE: number;
}

declare module "@remotion-video/templates/matrix/transitions" {
  import type { TransitionPresentation, TransitionTiming } from "@remotion/transitions";
  export interface MatrixTransitionChoice {
    presentation: TransitionPresentation<Record<string, unknown>>;
    timing: TransitionTiming;
    frames: number;
  }
  export function pickMatrixTransition(
    fromIdx: number,
    fromLayout?: string,
    toLayout?: string,
    w?: number,
    h?: number,
  ): MatrixTransitionChoice;
  export const MATRIX_TRANSITION_POOL_SIZE: number;
}

declare module "@remotion-video/templates/mosaic/layouts" {
  export const MOSAIC_LAYOUT_REGISTRY: Record<string, any>;
  export type MosaicLayoutType = string;
  export type MosaicLayoutProps = Record<string, any>;
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

declare module "@remotion-video/templates/newscast/layouts" {
  export const NEWSCAST_LAYOUT_REGISTRY: Record<string, any>;
  export type NewscastLayoutType = string;
  export type NewscastLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/blackswan/layouts" {
  export const BLACKSWAN_LAYOUT_REGISTRY: Record<string, any>;
  export type BlackswanLayoutType = string;
  export type BlackswanLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/chronicle/layouts" {
  export const CHRONICLE_LAYOUT_REGISTRY: Record<string, any>;
  export type ChronicleLayoutType = string;
  export type ChronicleLayoutProps = Record<string, any>;
}

declare module "@remotion-video/templates/chronicle/components/ChronicleChrome" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ChronicleChrome: React.FC<any>;
}
