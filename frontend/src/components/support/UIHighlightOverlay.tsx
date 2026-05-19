import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSupportTour } from "./SupportTourContext";

type Rect = { top: number; left: number; width: number; height: number };

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const POLL_MS = 200;
const POLL_TIMEOUT_MS = 8000;

export function UIHighlightOverlay() {
  const { state, next, prev, cancel } = useSupportTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const targetRef = useRef<Element | null>(null);

  const currentStep = state.active ? state.steps[state.index] : null;

  // Locate the target element (with polling for elements that mount after a click).
  useEffect(() => {
    if (!currentStep) {
      targetRef.current = null;
      setRect(null);
      setMissing(false);
      return;
    }
    console.log("[OVERLAY] Looking for selector:", currentStep.selector);
    setMissing(false);
    const start = Date.now();
    let cancelled = false;

    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(currentStep.selector);
      if (el) {
        console.log("[OVERLAY] Found element:", el, "Tooltip:", currentStep.tooltip);
        targetRef.current = el;
        setRect(measure(el));
        return;
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        console.log("[OVERLAY] Element not found after", POLL_TIMEOUT_MS, "ms - selector:", currentStep.selector);
        targetRef.current = null;
        setMissing(true);
        return;
      }
      window.setTimeout(find, POLL_MS);
    };
    find();
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  // Reposition on scroll / resize / DOM mutations.
  useEffect(() => {
    if (!targetRef.current) return;
    const reposition = () => {
      if (targetRef.current) setRect(measure(targetRef.current));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    const ro = new ResizeObserver(reposition);
    ro.observe(targetRef.current);
    const id = window.setInterval(reposition, 500); // catch layout shifts
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      ro.disconnect();
      window.clearInterval(id);
    };
  }, [rect?.top === undefined ? null : true]);

  // Auto-advance on click of the highlighted element.
  useEffect(() => {
    if (!targetRef.current) return;
    const el = targetRef.current;
    const onClick = () => next();
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [rect, next]);

  // Auto-skip missing elements — must be in useEffect, not render, to avoid setState-during-render.
  useEffect(() => {
    if (!missing) return;
    const isLast = state.index >= state.steps.length - 1;
    if (!isLast) {
      next();
    } else {
      cancel();
    }
  }, [missing, state.index, state.steps.length, next, cancel]);

  if (!state.active || !currentStep) return null;

  const isLast = state.index >= state.steps.length - 1;

  if (missing) return null;

  if (!rect) return null;

  // Cut a hole in the dimmer at the element's rect.
  const padding = 6;
  const holeTop = rect.top - padding;
  const holeLeft = rect.left - padding;
  const holeWidth = rect.width + padding * 2;
  const holeHeight = rect.height + padding * 2;

  const placement = currentStep.placement || "bottom";
  const tooltipStyle: React.CSSProperties = (() => {
    const margin = 12;
    const w = 280;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const edgePad = 10; // min gap from viewport edge

    // Compute unclamped anchor point based on placement
    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = rect.top - margin;
        left = rect.left + rect.width / 2 - w / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.left + rect.width + margin;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - margin - w;
        break;
      case "bottom-end":
        top = rect.top + rect.height + margin;
        left = rect.left + rect.width - w;
        break;
      default: // bottom
        top = rect.top + rect.height + margin;
        left = rect.left + rect.width / 2 - w / 2;
        break;
    }

    // For top placement, shift tooltip above the element (subtract estimated height ~80px)
    if (placement === "top") top -= 80;

    // For right/left, center vertically (subtract estimated half-height ~40px)
    if (placement === "right" || placement === "left") top -= 40;

    // Clamp horizontally so tooltip never overflows left or right edge
    left = Math.max(edgePad, Math.min(left, vw - w - edgePad));

    // Clamp vertically — if tooltip would go off bottom, flip above the element
    const estimatedHeight = 90;
    if (top + estimatedHeight > vh - edgePad) {
      top = rect.top - margin - estimatedHeight;
    }
    // If still off top, pin just below the element
    if (top < edgePad) {
      top = rect.top + rect.height + margin;
    }

    return { top, left, width: w, position: "fixed" };
  })();

  return createPortal(
    <>
      <svg className="fixed inset-0 z-[10000] pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="b2v-support-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={holeLeft} y={holeTop} width={holeWidth} height={holeHeight} rx="8" ry="8" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#b2v-support-mask)" />
        <rect
          x={holeLeft}
          y={holeTop}
          width={holeWidth}
          height={holeHeight}
          rx="8"
          ry="8"
          fill="none"
          stroke="#7C3AED"
          strokeWidth="2"
        />
      </svg>
      <div
        className="fixed z-[10001] pointer-events-auto rounded-lg bg-white shadow-xl border border-gray-200 px-4 py-3"
        style={tooltipStyle}
      >
        <p className="text-sm text-gray-900">{currentStep.tooltip}</p>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {state.index + 1} / {state.steps.length}
          </span>
          <div className="flex gap-2">
            {state.index > 0 && (
              <button onClick={prev} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100">
                Back
              </button>
            )}
            <button onClick={cancel} className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100">
              Skip
            </button>
            <button
              onClick={next}
              className="px-3 py-1 rounded bg-violet-600 text-white hover:bg-violet-700"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
