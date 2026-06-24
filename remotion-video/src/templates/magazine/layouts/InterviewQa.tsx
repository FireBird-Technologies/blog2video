import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  WrittenText,
  MAG_DISPLAY,
  MAG_SERIF,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
  useMagFrame,
  gutterPx,
  useFitText,
} from "../magazineStyle";

/**
 * Interview Q&A — an "In Conversation" kicker over alternating question/answer
 * blocks, set as a true editorial SPREAD: the conversation flows across BOTH
 * leaves in balanced columns (left page → right page) so the copy continues from
 * one page onto the next and both halves carry text, never leaving the facing
 * leaf blank. Playfair questions, muted Source Serif answers, hairline rules
 * between exchanges. `useFitText` shrinks the type so the whole conversation sits
 * inside the spread without overflowing off the bottom.
 *
 * Props: leftSpeaker (interviewee), rightSpeaker (role/org), exchanges[] (q/a),
 * or the legacy title + leftQuote/rightQuote pair.
 */
export const InterviewQa: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const speaker = (props.leftSpeaker as string) ?? "";
  const org = (props.rightSpeaker as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;
  const uid = React.useId().replace(/[:]/g, "");

  const a1 = (props.leftQuote as string) ?? narration ?? "";
  const a2 = (props.rightQuote as string) ?? "";

  // Up to four exchanges. Prefer the explicit `exchanges` array; otherwise fall
  // back to the legacy title + leftQuote/rightQuote pair so old scenes are
  // unchanged.
  const exchanges = Array.isArray(props.exchanges) ? props.exchanges : [];
  const blocks: { q: string; a: string }[] = [];
  if (exchanges.length) {
    for (const ex of exchanges.slice(0, 4)) {
      const q = (ex?.q ?? "").trim();
      const a = (ex?.a ?? "").trim();
      if (q || a) blocks.push({ q, a });
    }
    // If the first exchange omitted a question, borrow the scene title.
    if (blocks.length && !blocks[0].q && title) blocks[0].q = title;
  } else {
    if (title) blocks.push({ q: title, a: a1 });
    else if (a1) blocks.push({ q: "", a: a1 });
    if (a2) blocks.push({ q: "", a: a2 });
  }

  const label = ["In Conversation", speaker, org].filter(Boolean).join(" · ");

  const frame = useMagFrame();
  const labelO = useReveal(2, 12);

  // ── Spread flow + auto-fit ──────────────────────────────────────────────────
  // The conversation flows in 1 column (portrait, single page) or 2 columns
  // (landscape spread) split across the binding. Question size is an em multiple
  // of the answer size so `useFitText` can scale both together by shrinking a
  // single container font-size until the whole conversation fits the spread.
  const colCount = p ? 1 : 2;
  const g = p ? 0 : gutterPx(props.aspectRatio); // fold-safe centre channel
  const qEm = 1.5; // question display size relative to the answer body
  const aBasePx = descriptionFontSize ?? (p ? 27 : 23);

  const totalLen =
    blocks.reduce((s, b) => s + (b.q?.length ?? 0) * qEm + (b.a?.length ?? 0), 0) || 1;
  const capacity = p ? 720 : 1180;
  const estScale = totalLen > capacity ? Math.sqrt(capacity / totalLen) : 1;
  const floorPx = p ? 14 : 13;
  const targetPx = Math.max(floorPx, Math.round(aBasePx * estScale));

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const fitDep = blocks.map((b) => `${b.q}|${b.a}`).join("¶");
  const bodyPx = useFitText(bodyRef, targetPx, floorPx, colCount, [fitDep, targetPx, p]);

  // The big display title (titleFontSize) is honoured by scaling the question em
  // up relative to the body, so explicit title sizing still reads.
  const qScale = titleFontSize ? Math.max(1.1, titleFontSize / (aBasePx * qEm)) * qEm : qEm;

  const cls = `qa-${uid}`;
  const css = `.${cls}{column-count:${colCount};column-gap:${p ? "8%" : `${g}px`};column-fill:balance;height:100%;box-sizing:border-box;}
.${cls} .x{margin:0;}
.${cls} .x + .x{margin-top:1.4em;padding-top:1.4em;}
.${cls} .rule{height:1px;width:100%;background:${hexToRgba(text, 0.14)};margin:0 0 1.4em;break-inside:avoid;}
.${cls} .q{font-family:${MAG_DISPLAY};font-weight:700;font-size:${qScale}em;line-height:1.22;letter-spacing:-0.01em;color:${text};margin:0 0 0.6em;break-inside:avoid;break-after:avoid-column;}
.${cls} .a{font-family:${MAG_SERIF};font-weight:400;font-size:1em;line-height:1.6;color:${hexToRgba(text, 0.66)};margin:0;}`;

  // The conversation column-flow. Question opacity fades in per block; the answer
  // writes on word-by-word (inline spans, so it fragments across the page break
  // and the spread reads as one continuous, flowing conversation).
  const conversation = (
    <div ref={bodyRef} className={cls} style={{ fontSize: bodyPx, flex: 1, minHeight: 0 }}>
      {blocks.map((b, i) => {
        const start = 8 + i * 12;
        const qO = interpolate(frame, [start, start + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div className="x" key={i}>
            {i > 0 && <div className="rule" />}
            {b.q && (
              <div className="q" style={{ opacity: qO }}>
                {b.q}
              </div>
            )}
            {b.a && (
              <p className="a">
                <WrittenText text={b.a} start={start + 6} />
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <MagazinePage
      colors={colors}
      section="Interview"
      issue={props.issueLabel ?? "The Interview"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      printTextureSrc="qa-timeline-bg.svg"
      printTextureOpacity={0.4}
    >
      <style>{css}</style>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Kicker color={accent} style={{ opacity: labelO, marginBottom: p ? 28 : 34, flexShrink: 0 }}>
          {label || "In Conversation"}
        </Kicker>
        {conversation}
      </div>
    </MagazinePage>
  );
};
