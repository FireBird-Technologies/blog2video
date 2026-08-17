import { useEffect, useRef } from "react";

/**
 * Observes all `.reveal` and `.reveal-scale` elements inside the ref
 * and adds `.visible` when they scroll into view.
 *
 * Usage:
 *   const containerRef = useScrollReveal();
 *   <div ref={containerRef}> ... <div className="reveal">...</div> ... </div>
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const targets = el.querySelectorAll(".reveal, .reveal-scale");
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target); // animate once
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((t) => observer.observe(t));

    return () => observer.disconnect();
  }, []);

  return ref;
}
