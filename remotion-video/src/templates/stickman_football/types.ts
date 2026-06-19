import type { SocialsMap, SocialsRow } from "../SocialIcons";

export type StickmanFootballLayoutType =
  | "kickoff_title" | "passing_play" | "freekick_setup" | "goal_moment" | "match_stats" | "injury_break" | "ball_control" | "text_narration" | "ending_socials" | "football_data_viz" | "football_ticker" | "corner_kick";

export interface SceneLayoutProps {
  title: string;
  narration: string;
  imageUrl?: string;
  imageObjectPosition?: string;
  imageZoom?: number;
  accentColor: string;
  bgColor: string;
  textColor: string;
  aspectRatio?: string;
  // sceneDurationInFrames is THIS scene's exact length — drive entrance/exit from it
  sceneDurationInFrames?: number;
  fontFamily?: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  // socials / website are used by the ending_socials layout, which
  // renders the shared <SocialIcons> component (../../SocialIcons)
  socials?: SocialsMap | SocialsRow[];
  websiteLink?: string;
  showWebsiteButton?: boolean;
  ctaButtonText?: string;
  // object_array props use the standard label/value pair shape so the editor can render both fields
  subline?: string;
  shotLabel?: string;
  goalLabel?: string;
  scoreline?: string;
  // freekick_setup + goal_moment: short tags shown above the kicker's head
  kickerName?: string;
  kickerNumber?: string;
  stats?: Array<{ label?: string; value?: string }>;
  // corner_kick: ordered build-up steps (3–5 required). Each step is one pass;
  // `label` is required (1–3 words), `detail` is optional (1–4 words).
  steps?: Array<{ label?: string; detail?: string }>;
  leftLabel?: string;
  rightLabel?: string;
  leftDescription?: string;
  rightDescription?: string;
  skillCaption?: string;
  handles?: string[];
  // football_data_viz: chart driven by a scraped data table
  chartTable?: { headers?: string[]; rows?: Array<Array<string | number>> };
  chartType?: "auto" | "line" | "bar" | "histogram";
  chartSummary?: string;
  chartYAxisTicks?: string[];
  subtitle?: string;
  yAxisLabel?: string;
  barPrimaryColor?: string;
  barSecondaryColor?: string;
  barTertiaryColor?: string;
  // football_ticker: tabular data ticker
  tickerTable?: { headers?: string[]; rows?: string[][] };
  tickerTitle?: string;
  tickerFootnote?: string;
  tickerHighlightCol?: number;
}
