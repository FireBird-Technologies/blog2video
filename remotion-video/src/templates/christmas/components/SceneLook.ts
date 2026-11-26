/**
 * The per-scene backdrop look, shared through context so layouts never have to pass
 * it: ChristmasVideoComposition provides one look per scene; WinterBackdrop and
 * Snowfall read it with useSceneLook(). Without a provider (a layout rendered on its
 * own) look 0 is used.
 *
 * Mirror byte-identical in all three trees.
 */
import { createContext, useContext } from "react";
import { SCENE_LOOKS, type SceneLook } from "../christmasStyle";

export const SceneLookContext = createContext<SceneLook>(SCENE_LOOKS[0]);

export const useSceneLook = (): SceneLook => useContext(SceneLookContext);

/** Layout order — gives each layout its own starting look (single-scene previews differ too). */
const LAYOUT_ORDER = [
  "santa_hero",
  "snowy_narration",
  "frosted_window",
  "gift_stat",
  "tree_list",
  "letter_quote",
  "snow_compare",
  "snowball_steps",
  "data_visualisation",
  "ending_socials",
];

/**
 * One look per scene: (5 · layout + 2 · position) mod 6 — every layout starts on its
 * own look (single-scene previews differ), repeated layouts drift across the video,
 * and a video in layout order cycles through all six. Bumped forward whenever it would
 * repeat the previous scene's look, so neighbouring scenes never share a background.
 * Deterministic.
 */
export const computeSceneLooks = (layouts: string[]): SceneLook[] => {
  const n = SCENE_LOOKS.length;
  let prev = -1;
  return layouts.map((layout, i) => {
    const base = Math.max(0, LAYOUT_ORDER.indexOf(layout));
    let idx = (base * 5 + i * 2) % n;
    if (idx === prev) idx = (idx + 1) % n;
    prev = idx;
    return SCENE_LOOKS[idx];
  });
};
