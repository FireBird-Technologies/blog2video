import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { GuidanceStep } from "../../api/support";

type TourState = {
  steps: GuidanceStep[];
  index: number;
  active: boolean;
};

type TourContextValue = {
  state: TourState;
  startTour: (steps: GuidanceStep[]) => void;
  next: () => void;
  prev: () => void;
  cancel: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function SupportTourProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TourState>({
    steps: [],
    index: 0,
    active: false,
  });

  const startTour = useCallback((steps: GuidanceStep[]) => {
    if (!steps || steps.length === 0) return;
    setState({ steps, index: 0, active: true });
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (!s.active) return s;
      if (s.index + 1 >= s.steps.length) return { ...s, active: false };
      return { ...s, index: s.index + 1 };
    });
  }, []);

  const prev = useCallback(() => {
    setState((s) => (s.active && s.index > 0 ? { ...s, index: s.index - 1 } : s));
  }, []);

  const cancel = useCallback(() => {
    setState((s) => ({ ...s, active: false }));
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({ state, startTour, next, prev, cancel }),
    [state, startTour, next, prev, cancel],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useSupportTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useSupportTour must be used inside SupportTourProvider");
  return ctx;
}
