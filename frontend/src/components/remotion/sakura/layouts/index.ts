import { SakuraIntro } from "./SakuraIntro";
import { SakuraSection } from "./SakuraSection";
import { SakuraQuote } from "./SakuraQuote";
import { SakuraTwoColumnDetail } from "./SakuraTwoColumnDetail";
import { SakuraStatHighlight } from "./SakuraStatHighlight";
import { SakuraListScene } from "./SakuraListScene";
import { SakuraTextNarration } from "./SakuraTextNarration";
import { SakuraImageFocus } from "./SakuraImageFocus";
import { SakuraChapterTransition } from "./SakuraChapterTransition";
import { SakuraEndingSocials } from "./SakuraEndingSocials";
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
  sakura_image_focus: SakuraImageFocus,
  sakura_chapter_transition: SakuraChapterTransition,
  sakura_ending_socials: SakuraEndingSocials,
};
