import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import { useFitText } from "../components/useFitText";
import {
  MagazinePage,
  MAG_TEXTURES,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  Kicker,
  Rule,
  Halftone,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useMagFrame,
  useReveal,
} from "../magazineStyle";

const countTo = (raw: string, progress: number): string => {
  const match = raw.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) return raw;
  const decimals = match[2].includes(".") ? match[2].split(".")[1].length : 0;
  const value = Number(match[2]) * progress;
  return `${match[1]}${decimals ? value.toFixed(decimals) : Math.round(value)}${match[3]}`;
};

/** by_the_numbers__v2 — a premium annual-report insert. */
export const ByTheNumbersV2: React.FC<SceneLayoutProps> = (props) => {
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;
  const frame = useMagFrame();
  const intro = useReveal(3, 16);
  const title = (props.displayTitle || props.title || "By the Numbers").trim();
  const standfirst = (props.subtitle || props.narration || "").trim();
  const section = (props.sectionLabel || "Annual Report").trim();
  const stats = (Array.isArray(props.stats) ? props.stats : [])
    .map((stat) => ({ value: String(stat?.value ?? "").trim(), label: String(stat?.label ?? "").trim() }))
    .filter((stat) => stat.value)
    .slice(0, 4);
  const entries = stats.length >= 2
    ? stats
    : [
        { value: "2.4M", label: "Monthly readers" },
        { value: "98%", label: "Renewal rate" },
        { value: "150+", label: "Countries" },
        { value: "47", label: "Issues in print" },
      ];

  const titleTarget = props.titleFontSize ?? (p ? 120 : 124);
  const bodyTarget = props.descriptionFontSize ?? (p ? 76 : 42);
  const { titleFontSizeIsUserSet, descriptionFontSizeIsUserSet } = props as SceneLayoutProps & {
    titleFontSizeIsUserSet?: boolean;
    descriptionFontSizeIsUserSet?: boolean;
  };
  /* ── Auto-fit ──────────────────────────────────────────────
     Title and standfirst both render in full immediately (only opacity
     animates via `intro`, no progressive reveal), so direct refs on the
     visible elements are safe. Single-column text (left rail, not a
     multi-column body), so columnCount=1. */
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const standfirstRef = React.useRef<HTMLParagraphElement>(null);
  const titleBudget = p ? 230 : 190;
  const { px: titlePx } = useFitText(
    titleRef,
    titleTarget,
    titleFontSizeIsUserSet ? titleTarget : 24,
    [title, titleTarget, titleFontSizeIsUserSet, titleBudget, p],
    titleBudget,
  );
  const { px: bodyPx } = useFitText(
    standfirstRef,
    bodyTarget,
    descriptionFontSizeIsUserSet ? bodyTarget : 12,
    [standfirst, bodyTarget, descriptionFontSizeIsUserSet, titlePx, p],
  );

  return (
    <MagazinePage
      colors={colors}
      section={section}
      issue={props.issueLabel || "Annual Report"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      lightChrome
      hidePrintTexture={p}
      printTextureSrc={MAG_TEXTURES.spread}
      printTextureOpacity={0.34}
    >
      <div style={{ height: "100%", display: "flex", flexDirection: p ? "column" : "row", minHeight: 0 }}>
        <section
          style={{
            // Landscape reserves the complete right-hand leaf for the figures;
            // no stat row may begin on page one or cross the centre binding.
            flex: p ? "0 0 31%" : "0 0 50%",
            padding: p ? "2% 3% 4%" : "3% 6% 3% 2%",
            borderBottom: p ? `1px solid ${hexToRgba(text, 0.18)}` : undefined,
            borderRight: p ? undefined : `1px solid ${hexToRgba(text, 0.18)}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Halftone color={accent} opacity={0.055} gap={9} style={{ inset: "0 12% 0 0" }} />
          <Kicker color={accent} size={Math.max(13, bodyPx * 0.62)} style={{ opacity: intro }}>
            {(props.kickerPrefix || "Data").trim()} · {section}
          </Kicker>
          <Rule color={accent} progress={intro} thickness={3} width={p ? 110 : 138} style={{ margin: p ? "20px 0 24px" : "25px 0 30px" }} />
          <h1
            ref={titleRef}
            style={{
              margin: 0,
              fontFamily: MAG_DISPLAY,
              fontSize: titlePx,
              fontWeight: 900,
              lineHeight: 0.94,
              letterSpacing: "-0.045em",
              textTransform: "uppercase",
              color: text,
              opacity: intro,
              maxWidth: "96%",
            }}
          >
            {title}
          </h1>
          {standfirst && (
            <p ref={standfirstRef} style={{ margin: p ? "22px 0 0" : "28px 0 0", maxWidth: "92%", fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: bodyPx, lineHeight: 1.45, color: hexToRgba(text, 0.68), opacity: intro }}>
              {standfirst}
            </p>
          )}
          <div style={{ position: "absolute", right: p ? 18 : 28, bottom: p ? 8 : 22, fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: p ? 130 : 180, lineHeight: 1, color: hexToRgba(accent, 0.07) }}>
            {props.pageNumber || "01"}
          </div>
        </section>

        <section style={{ flex: 1, minHeight: 0, padding: p ? "4% 3% 1%" : "2% 1% 1% 5%", display: "flex", flexDirection: "column" }}>
          {entries.map((stat, index) => {
            const start = 15 + index * 9;
            const reveal = interpolate(frame, [start, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const count = interpolate(frame, [start, start + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const primary = index === 0;
            return (
              <div
                key={`${stat.value}-${index}`}
                style={{
                  flex: primary ? 1 : 1,
                  minHeight: 0,
                  display: "grid",
                  gridTemplateColumns: p ? "70px 1fr auto" : "82px 1fr minmax(220px, .85fr)",
                  alignItems: "center",
                  gap: p ? 16 : 28,
                  borderTop: `${primary ? 3 : 1}px solid ${primary ? accent : hexToRgba(text, 0.23)}`,
                  opacity: reveal,
                  transform: `translateX(${(1 - reveal) * 30}px)`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {primary && <Halftone color={accent} opacity={0.045} gap={8} />}
                <span style={{ fontFamily: MAG_SANS, fontSize: Math.max(12, bodyPx * 0.55), fontWeight: 700, letterSpacing: "0.18em", color: primary ? accent : hexToRgba(text, 0.42), position: "relative" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong style={{ fontFamily: MAG_DISPLAY, fontSize: primary ? titlePx * 1.08 : titlePx * 0.72, lineHeight: 0.9, letterSpacing: "-0.05em", color: primary ? accent : text, fontVariantNumeric: "tabular-nums", position: "relative", whiteSpace: "nowrap" }}>
                  {countTo(stat.value, count)}
                </strong>
                <span style={{ fontFamily: MAG_SANS, fontSize: bodyPx * (primary ? 0.78 : 0.68), fontWeight: 700, lineHeight: 1.25, letterSpacing: "0.11em", textTransform: "uppercase", color: text, textAlign: p ? "right" : "left", position: "relative" }}>
                  {stat.label}
                </span>
              </div>
            );
          })}
        </section>
      </div>
    </MagazinePage>
  );
};
