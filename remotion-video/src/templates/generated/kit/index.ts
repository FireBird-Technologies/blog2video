/**
 * Custom-template craft kit — public surface.
 *
 * A library of OPTIONAL, tested, brand-themed building blocks that AI-generated
 * custom scenes compose when the content fits. The kit raises the quality floor
 * (coherent palette, type scale, count-ups, reveals, charts, scene scaffolding)
 * without forcing any particular look — the brand theme drives everything.
 */

// Design-system core (pure)
export {
  derivePalette,
  typeScale,
  backgroundCss,
  hexToRgb,
  rgbToHex,
  mixHex,
  blend,
  withAlpha,
  luminance,
  isDarkColor,
  readableOn,
  type KitColors,
  type KitPalette,
  type TypeScale,
} from "./theme";

// Motion primitives
export {
  easeInOutCubic,
  easeOutQuint,
  easeOutBack,
  clamp01,
  progressAt,
  masterOpacity,
  staggerEntrance,
  headlinePop,
  panelRise,
  parseValue,
  countUpString,
  type EntranceStyle,
  type ParsedValue,
} from "./motion";

// Theme context
export { KitProvider, useKit, colorsFromBrand, type KitFonts, type KitContextValue } from "./context";

// Scaffolding
export { SceneFrame, type SceneFrameProps } from "./SceneFrame";

// Cards / stats / numbers
export {
  cardStyle,
  CountUpValue,
  StatCard,
  StatGrid,
  MetricRow,
  type StatItem,
} from "./cards";

// Text reveals
export { RevealText, HighlightPhrase, type RevealTextProps } from "./text";

// Image treatment
export { KenBurnsImage, type KenBurnsImageProps } from "./KenBurnsImage";

// Decoration
export { Decor, type DecorProps, type DecorSystem } from "./Decor";

// Charts (data-viz)
export { CustomChart, autoChartSummary, type CustomChartProps } from "./CustomChart";
export { CustomTable, type CustomTableProps, type CustomTableData } from "./CustomTable";
export { DataChartScene, DataTableScene } from "./DataVizScenes";
