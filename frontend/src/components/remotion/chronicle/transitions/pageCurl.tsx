import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

/**
 * pageCurl — a 3D book-page-turn transition.
 *
 * The exiting scene rotates around its right edge (or left, configurable),
 * curling toward the viewer like a real page being lifted and flipped.
 * A graduated shadow follows the curl to sell the depth.
 *
 * Pair with `flip()` for default scene cuts; reserve this for hero
 * boundaries (book-open → first chapter, last scene → ending).
 */

type Direction = "right-to-left" | "left-to-right";

type PageCurlProps = {
  direction?: Direction;
  perspective?: number;
};

const PageCurlComponent: React.FC<
  TransitionPresentationComponentProps<PageCurlProps>
> = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const direction = passedProps.direction ?? "right-to-left";
  const perspective = passedProps.perspective ?? 2200;

  if (presentationDirection === "entering") {
    // The next page is already lying flat underneath the lifted page.
    // It just sits there, fading in slightly as the page above clears.
    const fadeIn = Math.min(1, presentationProgress * 1.4);
    return (
      <AbsoluteFill style={{ opacity: fadeIn }}>{children}</AbsoluteFill>
    );
  }

  // Exiting page: rotate around an edge, with shadow + curl gradient.
  const isRightToLeft = direction === "right-to-left";
  const angle = presentationProgress * (isRightToLeft ? -180 : 180);

  // Shadow under the lifting page peaks mid-flip then fades.
  const shadowAlpha =
    presentationProgress < 0.5
      ? presentationProgress * 0.7
      : (1 - presentationProgress) * 0.7;

  // The curl-shadow gradient sweeps across the page as it lifts.
  const curlPos = presentationProgress * 100;

  return (
    <AbsoluteFill
      style={{
        perspective: `${perspective}px`,
        perspectiveOrigin: isRightToLeft ? "0% 50%" : "100% 50%",
      }}
    >
      <AbsoluteFill
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: isRightToLeft ? "left center" : "right center",
          transform: `rotateY(${angle}deg)`,
          backfaceVisibility: "hidden",
          boxShadow: `0 0 ${40 + presentationProgress * 60}px rgba(0,0,0,${shadowAlpha})`,
        }}
      >
        {children}

        {/* Soft curl shadow that sweeps across the page surface */}
        <AbsoluteFill
          style={{
            background: isRightToLeft
              ? `linear-gradient(to left,
                   rgba(0,0,0,${0.35 * presentationProgress}) ${curlPos - 8}%,
                   rgba(0,0,0,${0.18 * presentationProgress}) ${curlPos}%,
                   rgba(255,255,255,${0.12 * presentationProgress}) ${curlPos + 6}%,
                   transparent ${curlPos + 18}%)`
              : `linear-gradient(to right,
                   rgba(0,0,0,${0.35 * presentationProgress}) ${curlPos - 8}%,
                   rgba(0,0,0,${0.18 * presentationProgress}) ${curlPos}%,
                   rgba(255,255,255,${0.12 * presentationProgress}) ${curlPos + 6}%,
                   transparent ${curlPos + 18}%)`,
            pointerEvents: "none",
            mixBlendMode: "multiply",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const pageCurl = (
  props: PageCurlProps = {},
): TransitionPresentation<PageCurlProps> => ({
  component: PageCurlComponent,
  props,
});
