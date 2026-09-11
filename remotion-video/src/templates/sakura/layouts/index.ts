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
import { SakuraLanternGrove } from "./SakuraLanternGrove";
import { SakuraIntroBloomingTree } from "./SakuraIntroBloomingTree";
import { SakuraEndingSocialsTsukimi } from "./SakuraEndingSocialsTsukimi";
import type { SakuraLayoutType, SceneLayoutProps } from "../types";

export type { SakuraLayoutType, SceneLayoutProps };

export const SAKURA_LAYOUT_REGISTRY: Record<SakuraLayoutType, React.FC<SceneLayoutProps>> = {
  sakura_intro: SakuraIntro,
  // Visual variant of sakura_intro ("Blooming Tree" — a large procedural
  // cherry tree grows behind the centered title); shares the base's
  // props/schema, see types.ts and meta.json's layout_variants.
  sakura_intro__v2: SakuraIntroBloomingTree,
  sakura_section: SakuraSection,
  sakura_quote: SakuraQuote,
  sakura_two_column_detail: SakuraTwoColumnDetail,
  sakura_stat_highlight: SakuraStatHighlight,
  sakura_list_scene: SakuraListScene,
  sakura_text_narration: SakuraTextNarration,
  // Visual variant of sakura_text_narration ("Lantern Grove" — night hanami
  // treatment); shares the base's props/schema, see types.ts and meta.json's
  // layout_variants.
  sakura_text_narration__v2: SakuraLanternGrove,
  sakura_ending_socials: SakuraEndingSocials,
  // Alias: the backend labels the ending scene with the canonical "ending_socials"
  // id, so route it to the same component (otherwise it falls back to sakura_section
  // and the socials never render).
  ending_socials: SakuraEndingSocials,
  // Visual variant of ending_socials ("Tsukimi Farewell" — a quiet
  // moon-viewing close); shares the base's props/schema, see types.ts and
  // meta.json's layout_variants. Hangs off the canonical "ending_socials"
  // id, matching the base above.
  ending_socials__v2: SakuraEndingSocialsTsukimi,
  sakura_data_visualization: SakuraDataChart,
  sakura_ticker: SakuraTable,
};
