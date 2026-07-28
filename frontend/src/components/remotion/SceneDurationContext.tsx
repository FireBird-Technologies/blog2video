import { createContext, useContext } from "react";

/** Scene length in frames — set by the per-scene Sequence wrapper. */
export const SceneDurationInFramesContext = createContext<number | undefined>(undefined);

export function useSceneDurationInFrames(): number | undefined {
  return useContext(SceneDurationInFramesContext);
}
