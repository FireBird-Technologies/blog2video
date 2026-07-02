import React from "react";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  OptionalImg,
  Rule,
  QuoteGlyph,
  KineticWords,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
  gutterPx,
} from "../magazineStyle";

/**
 * Color block — a generic two-panel "color-block" spread whose blocks animate in
 * one after another. The left panel is a solid ink (dark) block carrying a big
 * serif statement opened by a red quotation mark; the right panel is a solid
 * accent (red) block holding a centred label stack (kicker → rule → heading →
 * italic subline → tag chip).
 *
 * The scene carries its own motion: the panels and their inner elements reveal
 * sequentially (staggered useReveal), so no cross-page transition runs on either
 * side of it (see the colorblock skip in transitions/index.ts). Image-free, in
 * keeping with the print redesign; flat fills + transform/opacity only to stay
 * cheap to paint.
 */
export const Colorblock: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const quote = ((props.leftQuote as string) ?? title ?? narration ?? "").trim();
  const label = (props.panelLabel as string) ?? "Color Block";
  const heading = (props.panelHeading as string) ?? title ?? "";
  const subline = (props.panelSubline as string) ?? "";
  const tag = (props.panelTag as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const imageUrl = props.imageUrl;
  const hasImage = Boolean(imageUrl);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  // Block-by-block sequential reveal. Each block (and each element inside the
  // right block) starts a beat after the previous one — the defining motion.
  const leftPanelO = useReveal(2, 12); // left ink block wipes/fades in first
  const rightPanelO = useReveal(14, 12); // accent block follows
  const kickerO = useReveal(22, 12); // then the label stack, one line at a time
  const ruleP = useReveal(26, 14);
  const headingO = useReveal(30, 14);
  const sublineO = useReveal(36, 14);
  const tagO = useReveal(42, 14);

  const g = gutterPx(props.aspectRatio);
  const quotePx = titleFontSize ?? (p ? 52 : 62);
  const sublinePx = descriptionFontSize ?? (p ? 40 : 30);
  const headingPx = p ? 68 : 58;
  const kickerPx = p ? 32 : 24;
  const tagPx = p ? 21 : 17;
  const pad = p ? "34px 32px" : "52px 50px";

  return (
    <MagazinePage
      lightChrome
      colors={colors}
      section={(props.sectionLabel as string)?.trim() || "Feature"}
      issue={props.issueLabel ?? "Spotlight"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      cameraMove={props.cameraMove}
      singlePage
      raisedRightLeaf
      hidePrintTexture
    >
      <div style={{ height: "100%", display: "flex", flexDirection: p ? "column" : "row", gap: p ? 22 : g }}>
        {/* LEFT BLOCK — solid ink panel with the pull-quote */}
        <div
          style={{
            flex: p ? 0.7 : 1,
            minWidth: 0,
            background: text,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: pad,
            overflow: "hidden",
            opacity: leftPanelO,
            transform: `translateY(${((1 - leftPanelO) * 18).toFixed(1)}px)`,
          }}
        >
          <QuoteGlyph color={accent} size={p ? 96 : 128} opacity={1} style={{ marginBottom: p ? 4 : 8 }} />
          <h1
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: quotePx,
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: bg,
              margin: 0,
            }}
          >
            <KineticWords text={quote} start={6} stagger={3} dur={14} depth={false} />
          </h1>
        </div>

        {/* RIGHT BLOCK — a solid accent panel, OR (when the scene has a photo) a
            hero image under an accent-tinted scrim so the centred white label
            stack stays legible. The image honours the scene focus point + zoom. */}
        <div
          style={{
            flex: p ? 1.3 : 1,
            minWidth: 0,
            position: "relative",
            overflow: "hidden",
            background: hasImage ? text : accent,
            opacity: rightPanelO,
            transform: `translateY(${((1 - rightPanelO) * 18).toFixed(1)}px)`,
          }}
        >
          {imageUrl && (
            <>
              <OptionalImg
                src={imageUrl}
                onError={() => {}}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: (props.imageZoom ?? 1) < 1 ? "contain" : "cover",
                  objectPosition: (props.imageZoom ?? 1) < 1 ? "center" : (props.imageObjectPosition ?? "50% 50%"),
                  transform: `scale(${props.imageZoom ?? 1})`,
                  transformOrigin: (props.imageZoom ?? 1) < 1 ? "center center" : (props.imageObjectPosition ?? "50% 50%"),
                  // filter removed — offscreen-pass cost on a full-bleed image (no GPU).
                  zIndex: 0,
                }}
              />
              {/* accent-tinted scrim + a thin light keyline framing the hero */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(180deg, rgba(0,0,0,0.34) 0%, ${hexToRgba(accent, 0.58)} 100%)`,
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(bg, 0.45)}`,
                  zIndex: 1,
                }}
              />
            </>
          )}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: pad,
            }}
          >
            <Kicker color={bg} size={kickerPx} style={{ opacity: kickerO, marginBottom: 16 }}>
              {label}
            </Kicker>
            <Rule color={bg} progress={ruleP} thickness={2} width={48} style={{ marginBottom: 22 }} />
            {heading && (
              <h2
                style={{
                  fontFamily: MAG_DISPLAY,
                  fontWeight: 800,
                  fontSize: headingPx,
                  lineHeight: 1.12,
                  letterSpacing: "-0.015em",
                  color: bg,
                  margin: 0,
                  opacity: headingO,
                  transform: `translateY(${((1 - headingO) * 12).toFixed(1)}px)`,
                }}
              >
                {heading}
              </h2>
            )}
            {subline && (
              <div
                style={{
                  fontFamily: MAG_SERIF,
                  fontStyle: "italic",
                  fontSize: sublinePx,
                  color: bg,
                  opacity: sublineO * 0.92,
                  marginTop: 12,
                  maxWidth: "92%",
                }}
              >
                {subline}
              </div>
            )}
            {tag && (
              <div
                style={{
                  display: "inline-block",
                  marginTop: 20,
                  opacity: tagO,
                  background: bg,
                  color: accent,
                  fontFamily: MAG_SANS,
                  fontWeight: 700,
                  fontSize: tagPx,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "6px 14px",
                }}
              >
                {tag}
              </div>
            )}
          </div>
        </div>
      </div>
    </MagazinePage>
  );
};
