import { SakuraIntro } from "./SakuraIntro";
import { SakuraSection } from "./SakuraSection";
import { SakuraQuote } from "./SakuraQuote";
import { SakuraTwoColumnDetail } from "./SakuraTwoColumnDetail";
import { SakuraStatHighlight } from "./SakuraStatHighlight";
import { SakuraListScene } from "./SakuraListScene";
import { SakuraTextNarration } from "./SakuraTextNarration";
import { SakuraEndingSocials } from "./SakuraEndingSocials";
import { SakuraDataChart } from "./SakuraDataChart";
import { SakuraTable } from "./SakuraTable";
import type { SakuraLayoutType, SceneLayoutProps } from "../types";

export type { SakuraLayoutType, SceneLayoutProps };

export const SAKURA_LAYOUT_REGISTRY: Record<SakuraLayoutType, React.FC<SceneLayoutProps>> = {
  sakura_intro: SakuraIntro,
  sakura_section: SakuraSection,
  sakura_quote: SakuraQuote,
  sakura_two_column_detail: SakuraTwoColumnDetail,
  sakura_stat_highlight: SakuraStatHighlight,
  sakura_list_scene: SakuraListScene,
  sakura_text_narration: SakuraTextNarration,
  sakura_ending_socials: SakuraEndingSocials,
  // Alias: the backend labels the ending scene with the canonical "ending_socials"
  // id, so route it to the same component (otherwise it falls back to sakura_section
  // and the socials never render).
  ending_socials: SakuraEndingSocials,
  sakura_data_visualization: SakuraDataChart,
  sakura_ticker: SakuraTable,
};
