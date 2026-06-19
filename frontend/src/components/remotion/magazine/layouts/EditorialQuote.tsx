import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Rule,
  Halftone,
  MAG_DISPLAY,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
} from "../magazineStyle";

/**
 * Editorial pull quote — a large centred serif statement framed by short red
 * rules, with an attribution line. Oversized quotation mark watermark behind.
 */
export const EditorialQuote: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize } = props;
  const attribution = (props.attribution as string) ?? narration;
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const topRuleP = useReveal(0, 14);
  const markO = useReveal(4, 12);

  const words = (title ?? "").split(" ");
  const wStart = 8;
  const wStagger = Math.max(1, Math.round(fps * 0.06));
  const wDur = Math.round(fps * 0.3);
  const lastEnd = wStart + (words.length - 1) * wStagger + wDur;
  const attrO = interpolate(frame, [lastEnd, lastEnd + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const quotePx = titleFontSize ?? (p ? 58 : 66);

  return (
    <MagazinePage colors={colors} section="Quote" issue={props.issueLabel ?? "Comment"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Faint halftone field for print texture */}
        <Halftone color={text} opacity={0.05 * markO} gap={8} />

        {/* Watermark quote mark */}
        <div
          style={{
            position: "absolute",
            top: p ? "2%" : "-4%",
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: MAG_DISPLAY,
            fontWeight: 900,
            fontSize: p ? 360 : 440,
            lineHeight: 1,
            color: accent,
            opacity: 0.08 * markO,
            pointerEvents: "none",
          }}
        >
          &ldquo;
        </div>

        <Rule color={accent} progress={topRuleP} thickness={2} width={p ? 120 : 160} style={{ marginBottom: p ? 34 : 44 }} />

        <blockquote
          style={{
            fontFamily: MAG_DISPLAY,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: quotePx,
            lineHeight: 1.28,
            letterSpacing: "-0.01em",
            color: text,
            margin: 0,
            maxWidth: p ? "92%" : "78%",
            zIndex: 1,
          }}
        >
          {words.map((w, i) => {
            const s = wStart + i * wStagger;
            const o = interpolate(frame, [s, s + wDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <span key={i} style={{ opacity: o }}>
                {w}{" "}
              </span>
            );
          })}
        </blockquote>

        <Rule color={accent} progress={attrO} thickness={2} width={p ? 120 : 160} style={{ margin: `${p ? 34 : 44}px 0 22px` }} />

        {attribution && (
          <div
            style={{
              fontFamily: MAG_SANS,
              fontWeight: 700,
              fontSize: p ? 18 : 17,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: text,
              opacity: attrO * 0.75,
            }}
          >
            {attribution.replace(/^[—–-]\s*/, "— ")}
          </div>
        )}
      </div>
    </MagazinePage>
  );
};
