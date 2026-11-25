import React from "react";
import {useFitText} from "./useFitText";

type FitTextProps = React.HTMLAttributes<HTMLDivElement> & {
  targetPx: number;
  minPx: number;
  maxHeightPx: number;
  maxWidthPx?: number;
  fitKey: string;
  /**
   * A manually selected Studio size: kept exactly as long as it fits its box. If it
   * would overflow (after the layout has already grown the box as far as it can
   * without hitting a neighbour), it shrinks like auto mode — text never spills.
   */
  exact?: boolean;
};

export const FitText: React.FC<FitTextProps> = ({
  targetPx,
  minPx,
  maxHeightPx,
  maxWidthPx,
  fitKey,
  exact = false,
  style,
  children,
  ...rest
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const {px} = useFitText(
    ref,
    targetPx,
    Math.min(targetPx, minPx),
    [fitKey, targetPx, minPx, maxHeightPx, maxWidthPx, exact],
    maxHeightPx,
    maxWidthPx,
  );

  return (
    <div
      ref={ref}
      {...rest}
      style={{
        ...style,
        width: style?.width ?? (maxWidthPx ?? "100%"),
        maxWidth: style?.maxWidth ?? maxWidthPx,
        maxHeight: maxHeightPx,
        overflow: style?.overflow ?? "hidden",
        fontSize: px,
      }}
    >
      {children}
    </div>
  );
};
