import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // A hash target (e.g. the nav's "/#templates") must win over the reset,
    // otherwise navigating from another page lands at the top of the landing
    // page instead of the section. The element mounts with this render, so
    // defer a frame before looking it up.
    if (hash) {
      const id = hash.slice(1);
      const frame = requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
