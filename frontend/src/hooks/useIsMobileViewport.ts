import { useEffect, useState } from "react";

/**
 * True on small/mobile viewports (< 640px wide — Tailwind's `sm` breakpoint).
 *
 * Initialised from the viewport on the very first render (not after an effect)
 * so callers that gate expensive work on it — e.g. capping how many live
 * Remotion `<Player>` instances mount in a template grid — are already capped on
 * the first commit. A late flip from false→true would itself mount the heavy
 * previews for one frame, and that momentary spike is enough to OOM/reload a
 * phone tab (iOS Safari discards the tab when its memory ceiling is hit).
 */
export default function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
