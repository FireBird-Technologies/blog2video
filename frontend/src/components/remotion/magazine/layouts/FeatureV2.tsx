import React from "react";
import { interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  MAG_TEXTURES,
  Kicker,
  Rule,
  JumpLine,
  QuoteGlyph,
  PageHalf,
  MagPlate,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  hexToRgba,
  useReveal,
  useInkReveal,
  gutterPx,
  useMagFrame,
  useFitText,
} from "../magazineStyle";

/**
 * FeatureV2 — "Sidebar"
 *
 * Variant of `feature`. Same props, different composition.
 *
 * Base runs a kicker, an italic-last-word headline with a red side rule on the left
 * leaf, then a justified TWO-column body across both leaves led by a red drop cap,
 * with the three keyPoints in a horizontal band along the bottom. This one
 * re-composes it as a narrow-column feature with a true print SIDEBAR:
 *
 *   - the body becomes a SINGLE justified column confined to one leaf;
 *   - the facing leaf becomes marginalia — the keyPoints as a NUMBERED vertical
 *     list (red numerals, hairline rules between) instead of a bottom band;
 *   - the headline sits in a banner above a heavy rule with the kicker inline to
 *     its left, and inks in left-to-right rather than staggering word-by-word.
 *
 * FOLD SAFETY: the banner is confined to the left leaf rather than spanning the
 * hinge. A full-width banner reads better typographically but would cross the
 * binding, which this template's grid forbids (see GUTTER_W / PageHalf).
 *
 * The drop cap keeps the base's pinned-span + transparent-float-spacer technique.
 * With a single column `column-fill:balance` is not in play, but preserving it
 * costs nothing and avoids reintroducing the "letter on the second page" bug if the
 * column count is ever raised again.
 */
export const FeatureV2: React.FC<SceneLayoutProps> = (props) => {
  const { title, narration, titleFontSize, descriptionFontSize } = props;
  const heading = ((props.heading as string)?.trim() || title || "").trim();
  const sectionLabel = (props.sectionLabel as string) ?? "Feature";
  // Sidebar entries. Each carries an optional `figure` that replaces the ordinal.
  //
  // `keyPoints` is this layout's own field, but a scene switched in from a STATS
  // layout (`by_the_numbers`) arrives carrying `stats` — {value,label} — and nothing
  // in `keyPoints`. Reading only keyPoints left the sidebar silently empty for those
  // scenes, so `stats` is a first-class fallback source and its value becomes the
  // displayed figure.
  const sidebarItems: { figure?: string; text: string }[] = React.useMemo(() => {
    const fromKeyPoints = (Array.isArray(props.keyPoints) ? props.keyPoints : [])
      .map((k) => (typeof k === "string" ? k : (k as { value?: string })?.value ?? ""))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
    if (fromKeyPoints.length > 0) return fromKeyPoints.slice(0, 3);

    const fromStats = (Array.isArray(props.stats) ? props.stats : [])
      .map((s) => ({
        figure: String((s as { value?: string })?.value ?? "").trim(),
        text: String((s as { label?: string })?.label ?? "").trim(),
      }))
      .filter((s) => s.figure || s.text);
    return fromStats.slice(0, 3);
  }, [props.keyPoints, props.stats]);
  const p = isPortrait(props.aspectRatio);
  const hasImage = Boolean(props.imageUrl || props.videoUrl);
  const colors = resolveMagColors(props);
  const { text, accent } = colors;
  const uid = React.useId().replace(/[:]/g, "");

  const frame = useMagFrame();
  const g = p ? 0 : gutterPx(props.aspectRatio);

  const kickerO = useReveal(2, 10);
  const ink = useInkReveal(6, 20);        // banner headline wipes in like a press pass
  const ruleP = useReveal(18, 14);
  const plateO = useReveal(12, 18);
  const panelO = useReveal(26, 16);       // the sidebar panel settles after the body
  const bodyO = interpolate(frame, [26, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const titlePx = titleFontSize ?? (p ? 86 : 62);

  const body = ((props.body as string)?.trim() || narration || "").trim();
  const columns = body;

  const base = descriptionFontSize ?? (p ? 52 : 28);
  // Always a single column in this variant — the facing leaf is the sidebar.
  const bodyCols = 1;
  // Capacity estimate seeds the fitter. The base uses 1180 for a landscape 2-col
  // spread; a ~62% single column holds roughly half that, and a photo above the
  // column takes more room again.
  const bodyCapacity = p ? (hasImage ? 520 : 700) : hasImage ? 430 : 620;
  const len = columns.length || 1;
  const estScale = len > bodyCapacity ? Math.sqrt(bodyCapacity / len) : 1;
  const floorPx = p ? 13 : 12;
  const targetBodyPx = Math.max(floorPx, Math.round(base * estScale));

  const bodyRef = React.useRef<HTMLDivElement>(null);
  const bodyPx = useFitText(bodyRef, targetBodyPx, floorPx, bodyCols, [columns, targetBodyPx, p], undefined);

  const cls = `featv2-${uid}`;
  // Same drop-cap technique as the base: a pinned absolute span plus a transparent
  // floated spacer reserving its footprint. See the base's comment for why this is
  // NOT ::first-letter or a real float.
  const capPx = bodyPx * 3.6;
  const capW = capPx * 0.62;
  const css = `.${cls}{position:relative;column-count:${bodyCols};column-fill:auto;height:100%;box-sizing:border-box;}
.${cls} p{margin:0;text-align:justify;}`;

  const bodyBlock = (
    <div
      ref={bodyRef}
      className={cls}
      style={{
        fontFamily: MAG_SERIF,
        fontSize: bodyPx,
        lineHeight: 1.62,
        color: hexToRgba(text, 0.9),
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {columns.charAt(0) && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 6,
            left: 0,
            fontFamily: MAG_DISPLAY,
            fontWeight: 800,
            fontSize: capPx,
            lineHeight: 0.72,
            color: accent,
            pointerEvents: "none",
            zIndex: 1,
            opacity: interpolate(frame, [26, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {columns.charAt(0)}
        </span>
      )}
      <p style={{ opacity: bodyO }}>
        {columns.charAt(0) && (
          <span
            aria-hidden
            style={{
              float: "left",
              width: capW,
              height: capPx * 0.72,
              marginRight: 14,
            }}
          />
        )}
        {columns.slice(1)}
      </p>
    </div>
  );

  /** Banner: kicker inline at the left, headline beside it, heavy rule beneath. */
  const banner = (
    <div style={{ flexShrink: 0, position: "relative" }}>
      {/* Oversized ghost folio behind the headline — gives the banner depth and ties
          it to the template's print-furniture vocabulary. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: p ? -34 : -30,
          right: 0,
          fontFamily: MAG_DISPLAY,
          fontWeight: 900,
          fontSize: p ? 190 : 168,
          lineHeight: 0.8,
          letterSpacing: "-0.04em",
          color: hexToRgba(text, 0.06),
          opacity: ink.opacity,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {props.pageNumber ?? "01"}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: p ? 14 : 18, flexWrap: "nowrap", position: "relative" }}>
        <Kicker color={accent} size={p ? 17 : 15} style={{ opacity: kickerO, flexShrink: 0, whiteSpace: "nowrap" }}>
          {sectionLabel}
        </Kicker>
        <h1
          style={{
            fontFamily: MAG_DISPLAY,
            fontWeight: 800,
            fontSize: titlePx,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: text,
            margin: 0,
            minWidth: 0,
            opacity: ink.opacity,
            clipPath: ink.clipPath,
            transform: ink.transform,
          }}
        >
          {heading}
        </h1>
      </div>
      {/* A single crisp rule closes the banner. Deliberately NO MagSwoosh beneath it:
          the brush sweep rendered as a red band whose height changed as it wiped in,
          which read as a layout glitch rather than an accent. */}
      <Rule color={accent} progress={ruleP} thickness={4} width="100%" style={{ marginTop: p ? 16 : 18 }} />
    </div>
  );

  /** The marginal sidebar: hairline-separated entries, each led by a figure (from
   *  `stats`) or an ordinal (for `keyPoints`). Null when the scene supplies neither,
   *  so the facing leaf falls back to the ghosted folio block below rather than
   *  showing an empty "In Brief" heading. */
  const sidebar = sidebarItems.length > 0 ? (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        // A tinted panel with a hairline edge, so the facing leaf reads as designed
        // marginalia rather than loose text on blank paper. This is the single biggest
        // lift for the spread's balance.
        background: hexToRgba(accent, 0.045),
        border: `1px solid ${hexToRgba(text, 0.12)}`,
        borderTop: `3px solid ${accent}`,
        padding: p ? "22px 22px 20px" : "20px 22px 18px",
        opacity: panelO,
      }}
    >
      {/* Oversized ghost quote glyph in the panel's corner — depth without noise. */}
      <div style={{ position: "absolute", top: p ? -18 : -14, right: p ? 10 : 8, pointerEvents: "none" }}>
        <QuoteGlyph color={accent} size={p ? 150 : 128} opacity={0.09} />
      </div>

      <div
        style={{
          fontFamily: MAG_SANS,
          fontWeight: 700,
          fontSize: p ? 12 : 11,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: accent,
          opacity: kickerO,
          marginBottom: p ? 12 : 14,
          position: "relative",
        }}
      >
        {sidebarItems.some((s) => s.figure) ? "By The Numbers" : "In Brief"}
      </div>
      <Rule color={hexToRgba(text, 0.28)} progress={ruleP} thickness={1} width="100%" />

      <div style={{ marginTop: p ? 14 : 16, minHeight: 0, position: "relative" }}>
        {sidebarItems.map((item, i) => {
          const start = 30 + i * 5;
          const o = interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(frame, [start, start + 14], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          // A stat's value leads the row; otherwise fall back to the ordinal. Figures
          // are set a touch smaller since they can run several characters ("2.4M").
          const lead = item.figure || String(i + 1).padStart(2, "0");
          const leadPx = item.figure
            ? item.figure.length > 3
              ? p ? 26 : 23
              : p ? 34 : 30
            : p ? 34 : 30;
          return (
            <div key={i} style={{ opacity: o, transform: `translateY(${y}px)` }}>
              {i > 0 && (
                <div style={{ height: 1, background: hexToRgba(text, 0.14), margin: `${p ? 14 : 16}px 0` }} />
              )}
              <div style={{ display: "flex", alignItems: "flex-start", gap: p ? 12 : 14 }}>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: MAG_DISPLAY,
                    fontWeight: 800,
                    fontSize: leadPx,
                    lineHeight: 0.9,
                    color: accent,
                    whiteSpace: "nowrap",
                  }}
                >
                  {lead}
                </span>
                <span
                  style={{
                    fontFamily: MAG_SANS,
                    fontWeight: 600,
                    fontSize: p ? 19 : 17,
                    lineHeight: 1.34,
                    letterSpacing: "0.01em",
                    color: hexToRgba(text, 0.82),
                  }}
                >
                  {item.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Print furniture at the sidebar foot — the JumpLine atom, which no other
          layout currently uses. */}
      <JumpLine
        color={hexToRgba(text, 0.45)}
        page={props.pageNumber}
        style={{ marginTop: "auto", paddingTop: 18, opacity: interpolate(frame, [44, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
      />
    </div>
  ) : null;

  /** Facing-leaf fallback when there are no keyPoints — a ghosted folio and an
   *  edge-running section mark, mirroring how the base fills its blank leaf so the
   *  page never reads as unfinished. */
  const asideFallback = (
    <div style={{ position: "relative", height: "100%", minHeight: 180 }}>
      <div
        style={{
          position: "absolute",
          top: -16,
          right: 64,
          fontFamily: MAG_DISPLAY,
          fontWeight: 900,
          fontSize: 200,
          lineHeight: 0.8,
          letterSpacing: "-0.04em",
          color: hexToRgba(text, 0.07),
          opacity: ink.opacity,
          pointerEvents: "none",
        }}
      >
        {props.pageNumber ?? "01"}
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontFamily: MAG_SANS,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: hexToRgba(text, 0.5),
          opacity: ink.opacity,
        }}
      >
        {sectionLabel}
      </div>
      <JumpLine
        color={hexToRgba(text, 0.45)}
        page={props.pageNumber}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          opacity: interpolate(frame, [44, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />
    </div>
  );

  const plate = hasImage ? (
    <MagPlate
      src={props.imageUrl}
      videoUrl={props.videoUrl}
      videoMuted={props.videoMuted}
      videoVolume={props.videoVolume}
      videoDurationInFrames={props.videoDurationInFrames}
      videoStartInFrames={props.videoStartInFrames}
      colors={colors}
      objectPosition={props.imageObjectPosition}
      zoom={props.imageZoom}
      opacity={plateO}
      style={{ height: "30%", flexShrink: 0, marginBottom: p ? 20 : 22 }}
    />
  ) : null;

  return (
    <MagazinePage
      colors={colors}
      section={sectionLabel}
      issue={props.issueLabel ?? "Feature"}
      page={props.pageNumber}
      aspectRatio={props.aspectRatio}
      fontFamily={props.fontFamily}
      establishingShot={props.establishingShot}
      cameraMove={props.cameraMove}
      lightChrome
      {...(p ? { hidePrintTexture: true } : { printTextureSrc: MAG_TEXTURES.spread, printTextureOpacity: 0.38 })}
    >
      <style>{css}</style>

      {p ? (
        // Portrait: there is no facing leaf, so the sidebar stacks BELOW the body
        // rather than beside it, and everything stays inside one fold-safe column.
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <PageHalf side="left" aspectRatio={props.aspectRatio} style={{ marginBottom: 18 }}>
            {banner}
          </PageHalf>
          {plate}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{bodyBlock}</div>
          {sidebarItems.length > 0 && (
            <div style={{ flexShrink: 0, marginTop: 20 }}>{sidebar}</div>
          )}
        </div>
      ) : (
        // Landscape: body column on the left leaf (banner above it, confined to the
        // same leaf so nothing crosses the binding), sidebar on the facing leaf.
        <div style={{ display: "flex", gap: g, height: "100%", minHeight: 0 }}>
          <div
            style={{
              width: `calc(62% - ${g / 2}px)`,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {banner}
            <div style={{ height: 22, flexShrink: 0 }} />
            {plate}
            {bodyBlock}
          </div>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{sidebar ?? asideFallback}</div>
        </div>
      )}
    </MagazinePage>
  );
};
