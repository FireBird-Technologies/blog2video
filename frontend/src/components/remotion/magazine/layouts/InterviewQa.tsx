import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  MAG_DISPLAY,
  MAG_SERIF,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
} from "../magazineStyle";

/**
 * Interview Q&A — an "In Conversation" kicker over alternating question/answer
 * blocks separated by hairline rules, faithful to the .s-qa print pattern:
 * Playfair questions, muted Source Serif answers, no ornament.
 *
 * Props: leftSpeaker (interviewee), rightSpeaker (role/org), leftQuote &
 * rightQuote (answers); falls back to narration/title.
 */
export const InterviewQa: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, descriptionFontSize } = props;
  const speaker = (props.leftSpeaker as string) ?? "";
  const org = (props.rightSpeaker as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const a1 = (props.leftQuote as string) ?? narration ?? "";
  const a2 = (props.rightQuote as string) ?? "";

  const blocks: { q: string; a: string }[] = [];
  if (title) blocks.push({ q: title, a: a1 });
  else if (a1) blocks.push({ q: "", a: a1 });
  if (a2) blocks.push({ q: "", a: a2 });

  const label = ["In Conversation", speaker, org].filter(Boolean).join(" · ");

  const frame = useCurrentFrame();
  const labelO = useReveal(2, 12);

  const qPx = descriptionFontSize ? descriptionFontSize * 1.35 : p ? 38 : 36;
  const aPx = descriptionFontSize ?? (p ? 26 : 25);

  return (
    <MagazinePage colors={colors} section="Interview" issue={props.issueLabel ?? "The Interview"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: p ? "100%" : "1180px" }}>
        <Kicker color={accent} style={{ opacity: labelO, marginBottom: p ? 40 : 54 }}>
          {label || "In Conversation"}
        </Kicker>

        {blocks.map((b, i) => {
          const start = 10 + i * 14;
          const o = interpolate(frame, [start, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame, [start, start + 16], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div style={{ height: 1, background: hexToRgba(text, 0.14 * o), margin: `${p ? 38 : 46}px 0` }} />
              )}
              <div style={{ opacity: o, transform: `translateY(${y}px)` }}>
                {b.q && (
                  <div
                    style={{
                      fontFamily: MAG_DISPLAY,
                      fontWeight: 700,
                      fontSize: qPx,
                      lineHeight: 1.24,
                      letterSpacing: "-0.01em",
                      color: text,
                      marginBottom: 22,
                    }}
                  >
                    {b.q}
                  </div>
                )}
                {b.a && (
                  <div
                    style={{
                      fontFamily: MAG_SERIF,
                      fontWeight: 400,
                      fontSize: aPx,
                      lineHeight: 1.62,
                      color: hexToRgba(text, 0.64),
                      maxWidth: "62ch",
                    }}
                  >
                    {b.a}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </MagazinePage>
  );
};
