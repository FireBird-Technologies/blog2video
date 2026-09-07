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
  relativeLuminance,
  contrastRatio,
  ensureContrast,
  clampGradientStop,
  AA_CONTRAST,
  isDarkColor,
  readableOn,
  type KitColors,
  type KitPalette,
  type TypeScale,
} from "./theme";
export { enforceTheme, type EnforceThemeOptions } from "./enforceTheme";

// Motion primitives
export {
  easeInOutCubic,
  easeOutQuint,
  easeOutBack,
  clamp01,
  progressAt,
  drawProgress,
  seededRand,
  masterOpacity,
  staggerEntrance,
  headlinePop,
  panelRise,
  parseValue,
  countUpString,
  cameraStage,
  cameraPush,
  parallaxLayer,
  panelTilt,
  type EntranceStyle,
  type ParsedValue,
  type CameraStyle,
  type CameraTransform,
} from "./motion";

// Theme context
export { KitProvider, EyebrowSizeProvider, KitVariantProvider, useKit, colorsFromBrand, type KitFonts, type KitContextValue } from "./context";

// Structural variants — which arrangement content components render.
export {
  STAT_ARRANGEMENTS,
  LIST_ARRANGEMENTS,
  SEQUENCE_ARRANGEMENTS,
  QUOTE_ARRANGEMENTS,
  DEFAULT_VARIANT,
  variantFromSeed,
  hashString,
  type KitVariant,
  type StatArrangement,
  type ListArrangement,
  type SequenceArrangement,
  type QuoteArrangement,
} from "./variants";

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

// Auto-fit text — deterministic overflow-safe headline/numeral block
export { FitText, type FitTextProps } from "./FitText";

// Shared type budget — wrap a scene's text region so its headline and body copy
// shrink TOGETHER against one budget instead of each fitting its own box while
// the pair overflows. The generated-scene equivalent of the built-ins'
// withAutoFitLayout. `useFitScale` is exported for completeness; scenes use the
// component, not the hook.
export { FitBlock, useFitScale, type FitBlockProps } from "./FitBlock";

// Code panel (the "code" archetype — safe, renders only props.codeLines)
export { CodeBlock, type CodeBlockProps } from "./CodeBlock";

// Layout skeletons — structure-only composition scaffolds (intra-video variety)
export {
  CenteredFocal,
  AsymmetricSplit,
  FullBleedHero,
  OffsetCardStack,
  SideRail,
  type LayoutBaseProps,
} from "./Layouts";

// Intro scaffold — signature brand-reveal opener (bookend richness)
export { IntroStage, type IntroStageProps } from "./IntroStage";

// Image treatment
export { KenBurnsImage, type KenBurnsImageProps } from "./KenBurnsImage";

// Decoration
export { Decor, type DecorProps, type DecorSystem } from "./Decor";

// Structure — persistent chrome and editorial framing. Distinct from Decor:
// these are elements the layout is built AROUND, and repeating them across
// scenes is what makes a set of scenes read as one template.
export {
  Masthead,
  SectionDivider,
  DropCap,
  PanelNumber,
  EditorialRule,
  Kicker,
  SafeArea,
  type MastheadProps,
  type SectionDividerProps,
  type DropCapProps,
  type PanelNumberProps,
  type EditorialRuleProps,
  type KickerProps,
  type SafeAreaProps,
  type SafeAreaInset,
} from "./Structure";

// Signature artifacts — the brand's recurring animated motif (fingerprint)
export {
  SignatureArtifact,
  CornerFrame,
  StreakField,
  KineticTicker,
  BigGlyphBackdrop,
  PulseRing,
  AccentSweep,
  DiagonalShards,
  HalftoneField,
  StarburstBadge,
  LightDust,
  OrbitRings,
  type ArtifactMotion,
} from "./Artifacts";

// Charts (data-viz)
export { CustomChart, autoChartSummary, type CustomChartProps } from "./CustomChart";
export { CustomTable, type CustomTableProps, type CustomTableData } from "./CustomTable";
export { DataChartScene, DataTableScene } from "./DataVizScenes";

// Social icons — re-exported so a generated OUTRO can render the closing
// handles itself.
//
// The outro used to be replaced wholesale by GeneratedCtaOverlay, so every
// custom template ended on the same generic centred card no matter how
// distinct the rest of it was. The outro now composes its own ending, and this
// is the one piece it must not hand-roll: the icon set and its handle
// resolution are shared with every built-in `ending_socials` layout, so the
// glyphs stay consistent while the ARRANGEMENT is the template's own.
//
// Lives outside kit/ (it predates the kit and is shared with built-in
// templates), but `../../SocialIcons` resolves correctly in BOTH the
// remotion-video tree and the copied frontend trees, so the sync script's
// file-copy pass does not need to move it.
export { SocialIcons, type SocialIconsProps } from "../../SocialIcons";

// Type-size bands + the single clamp both read paths call. See typeBands.ts for
// which band sizes which element — it is easy to get backwards.
// Which type tier a FitText is, and whether its size was chosen by a person.
// Supplied by the caller that resolves the props, so an already-generated scene
// gets literal sizing and the title>body floor without being regenerated.
export {
  TypeTierProvider,
  BodySizeScope,
  useTypeTier,
  type TypeTierValue,
} from "./typeTier";

export {
  TYPE_BANDS,
  USER_BANDS,
  HEADLINE_BODY_RATIO,
  clampToBand,
  clampToUserBand,
  bodySizeForHeadline,
  resolveTypeSizes,
  resolveTypeExactness,
  eyebrowRepeatsHeadline,
  type Orientation,
} from "./typeBands";

// Force structured-content props into their declared shapes; see the file
// header for the two real crashes this prevents.
export { sanitizeSceneProps } from "./sanitizeProps";
