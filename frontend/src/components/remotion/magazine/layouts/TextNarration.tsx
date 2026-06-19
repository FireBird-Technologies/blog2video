import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  MAG_DISPLAY,
  MAG_SERIF,
  resolveMagColors,
  isPortrait,
  useReveal,
} from "../magazineStyle";

/**
 * Text narration — a centred editorial column: kicker, large serif headline,
 * red rule and a serif body paragraph. Authoritative, image-free.
 */
export const TextNarration: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const sectionLabel = (props.sectionLabel as string) ?? "Analysis";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const frame = useCurrentFrame();
  const kickerO = useReveal(2, 12);
  const headO = useReveal(6, 14);
  const headY = interpolate(frame, [6, 20], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ruleP = useReveal(14, 14);
  const bodyO = useReveal(18, 18);

  const titlePx = titleFontSize ?? (p ? 64 : 60);
  const bodyPx = descriptionFontSize ?? (p ? 26 : 23);

  return (
    <MagazinePage colors={colors} section={sectionLabel} issue={props.issueLabel ?? "Analysis"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          maxWidth: p ? "100%" : "80%",
          margin: "0 auto",
        }}
      >
        <Kicker color={accent} style={{ opacity: kickerO, marginBottom: 22 }}>
          {sectionLabel}
        </Kicker>
        <h1
          style={{
            fontFamily: MAG_DISPLAY,
            fontWeight: 800,
            fontSize: titlePx,
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            color: text,
            margin: 0,
            opacity: headO,
            transform: `translateY(${headY}px)`,
          }}
        >
          {title}
        </h1>
        <Rule color={accent} progress={ruleP} thickness={3} width={p ? 130 : 100} style={{ margin: "30px 0 32px" }} />
        {narration && (
          <p style={{ fontFamily: MAG_SERIF, fontSize: bodyPx, lineHeight: 1.66, color: text, opacity: bodyO * 0.92, margin: 0, maxWidth: "62ch" }}>
            {narration}
          </p>
        )}
      </div>
    </MagazinePage>
  );
};
