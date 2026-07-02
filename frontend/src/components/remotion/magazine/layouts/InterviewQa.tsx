import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  MAG_TEXTURES,
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
 * Interview Q&A — exactly one question+answer per page (left leaf / right leaf).
 * Portrait stacks the two blocks vertically. Landscape puts them side-by-side
 * with a hairline spine between them so each "page" owns exactly one exchange.
 *
 * Props: leftSpeaker, rightSpeaker, exchanges[] (first two used), or legacy
 * title + leftQuote/rightQuote.
 */
export const InterviewQa: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const speaker = (props.leftSpeaker as string) ?? "";
  const org = (props.rightSpeaker as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;

  const a1 = (props.leftQuote as string) ?? narration ?? "";
  const a2 = (props.rightQuote as string) ?? "";

  const exchanges = Array.isArray(props.exchanges) ? props.exchanges : [];
  const blocks: { q: string; a: string }[] = [];
  if (exchanges.length) {
    for (const ex of exchanges.slice(0, 2)) {
      const q = (ex?.q ?? "").trim();
      const a = (ex?.a ?? "").trim();
      if (q || a) blocks.push({ q, a });
    }
    if (blocks.length && !blocks[0].q && title) blocks[0].q = title;
  } else {
    if (title) blocks.push({ q: title, a: a1 });
    else if (a1) blocks.push({ q: "", a: a1 });
    if (a2) blocks.push({ q: "", a: a2 });
  }
  // Pad to two slots so both pages always render
  while (blocks.length < 2) blocks.push({ q: "", a: "" });

  const label = ["In Conversation", speaker, org].filter(Boolean).join(" · ");

  const frame = useMagFrame();
  const labelO = useReveal(2, 12);

  const g = p ? 0 : gutterPx(props.aspectRatio);
  const qEm = 1.5;
  const aBasePx = descriptionFontSize ?? (p ? 27 : 23);
  const floorPx = p ? 14 : 13;

  // Independent fit refs — each page sizes its own copy
  const ref0 = React.useRef<HTMLDivElement>(null);
  const ref1 = React.useRef<HTMLDivElement>(null);

  const fitDep0 = `${blocks[0].q}|${blocks[0].a}`;
  const fitDep1 = `${blocks[1].q}|${blocks[1].a}`;

  const len0 = (blocks[0].q?.length ?? 0) * qEm + (blocks[0].a?.length ?? 0) || 1;
  const len1 = (blocks[1].q?.length ?? 0) * qEm + (blocks[1].a?.length ?? 0) || 1;
  const capacity = p ? 720 : 900;
  const target0 = Math.max(floorPx, Math.round(aBasePx * (len0 > capacity ? Math.sqrt(capacity / len0) : 1)));
  const target1 = Math.max(floorPx, Math.round(aBasePx * (len1 > capacity ? Math.sqrt(capacity / len1) : 1)));

  const px0 = useFitText(ref0, target0, floorPx, 1, [fitDep0, target0, p]);
  const px1 = useFitText(ref1, target1, floorPx, 1, [fitDep1, target1, p]);

  const qScale = titleFontSize ? Math.max(1.1, titleFontSize / (aBasePx * qEm)) * qEm : qEm;

  const renderBlock = (
    b: { q: string; a: string },
    i: number,
    ref: React.RefObject<HTMLDivElement>,
    px: number,
  ) => {
    const start = 8 + i * 14;
    const qO = interpolate(frame, [start, start + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <div
        ref={ref}
        style={{
          fontSize: px,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {b.q && (
          <div
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 700,
              fontSize: `${qScale}em`,
              lineHeight: 1.22,
              letterSpacing: "-0.01em",
              color: text,
              marginBottom: "0.65em",
              flexShrink: 0,
              opacity: qO,
            }}
          >
            {b.q}
          </div>
        )}
        {b.a && (
          <p
            style={{
              fontFamily: MAG_SERIF,
              fontWeight: 400,
              fontSize: "1em",
              lineHeight: 1.6,
              color: hexToRgba(text, 0.66),
              margin: 0,
              overflow: "hidden",
            }}
          >
            <WrittenText text={b.a} start={start + 6} />
          </p>
        )}
      </div>
    );
  };

  // Spine divider between the two pages
  const spine = !p && (
    <div
      style={{
        width: g,
        flexShrink: 0,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 1, background: hexToRgba(text, 0.14), alignSelf: "stretch" }} />
    </div>
  );

  // Portrait: stack vertically with a horizontal rule between
  const portraitDivider = p && (
    <div style={{ height: 1, background: hexToRgba(text, 0.14), margin: "1.6em 0", flexShrink: 0 }} />
  );

  return (
    <MagazinePage
      colors={colors}
      section={(props.sectionLabel as string)?.trim() || "Interview"}
      issue={props.issueLabel ?? "The Interview"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      lightChrome
      {...(p ? { hidePrintTexture: true } : { printTextureSrc: MAG_TEXTURES.spread, printTextureOpacity: 0.38 })}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Kicker color={accent} style={{ opacity: labelO, marginBottom: p ? 28 : 34, flexShrink: 0 }}>
          {label || "In Conversation"}
        </Kicker>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: p ? "column" : "row",
          }}
        >
          {renderBlock(blocks[0], 0, ref0, px0)}
          {p ? portraitDivider : spine}
          {renderBlock(blocks[1], 1, ref1, px1)}
        </div>
      </div>
    </MagazinePage>
  );
};
