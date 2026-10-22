import React from "react";
import {useFitText} from "./useFitText";

type FitTextProps = React.HTMLAttributes<HTMLDivElement> & {
  targetPx: number;
  minPx: number;
  maxHeightPx: number;
  maxWidthPx?: number;
  fitKey: string;
  /** Keep a manually selected Studio value exact instead of shrinking it. */
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
    exact ? targetPx : Math.min(targetPx, minPx),
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
        overflow: style?.overflow ?? (exact ? "visible" : "hidden"),
        fontSize: px,
      }}
    >
      {children}
    </div>
  );
};
