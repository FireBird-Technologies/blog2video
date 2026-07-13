import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EconomistLayoutProps } from "../types";
import { ECONOMIST_COLORS, CHROME_INSET } from "../constants";
import { EditorialDivider, EngravingTexture } from "../components/EconomistOrnaments";
import { ECONOMIST_SERIF_FONT, ECONOMIST_SANS_FONT } from "../../../../fonts/economist-defaults";
import { clamp01, easeOutQuint, redactionReveal, ruleDraw, slideFrom } from "./motion";

/**
 * LeaderArticle — "The Essay Plate".
 *
 * A reversed-out editorial feature spread, deliberately unlike every other
 * (all-paper) Economist scene. A bold full-height ink panel on the left carries
 * the title, kicker and standfirst reversed out in paper-white; the paper side
 * on the right gives the narration as one large kinetic lead statement that
 * fills the page — no drop cap, no column box, no article furniture. Key points
 * sit beneath as a clean ruled list. When an `imageUrl` is supplied the ink
 * panel becomes a duotone photo plate under a dark wash, with the title reversed
 * over it.
 *
 * Motion: the ink plate wipes in from the left, the kicker sweeps in under a
 * redaction bar, the title rises out from behind its own top edge while the ink
 * dries, a red rule draws under it, and on the paper side the lead reveals
 * sentence-by-sentence (rising into place) followed by the key points.
 *
 * Portrait stacks the plate as a top band over the paper lead.
 */
export const LeaderArticle: React.FC<EconomistLayoutProps> = ({
  title,
  narration,
  body,
  sectionLabel = "ESSAY",
  dateline,
  standfirst,
  keyPoints,
  imageUrl,
  imageObjectPosition = "50% 50%",
  imageZoom = 1,
  accentColor = ECONOMIST_COLORS.accent,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
  aspectRatio = "landscape",
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const isPortrait = aspectRatio === "portrait";
  const hasImage = Boolean(imageUrl);

  const topInset = (isPortrait ? CHROME_INSET.topPortrait : CHROME_INSET.top) + 18;
  const botInset = (isPortrait ? CHROME_INSET.bottomPortrait : CHROME_INSET.bottom) + 16;

  // Reversed-out palette for the ink/photo plate.
  const PAPER = ECONOMIST_COLORS.paper;
  const MUTED_ON_DARK = "#B9B4A8";

  // The on-screen body is the full article paragraph (independent of the short
  // spoken `narration`); fall back to narration when no body was generated.
  const lead = (body || narration || "").trim();
  const titleSize = (titleFontSize ?? (isPortrait ? 66 : 74)) as number;
  // The lead is the hero on the paper side; scale it by length so a terse beat
  // reads as a big statement that fills the page and a long article still fits.
  const leadLen = lead.length;
  const isLongLead = leadLen > 320;
  const baseLeadFs = (descriptionFontSize ?? 0) || 0;
  const leadFs =
    baseLeadFs > 0
      ? baseLeadFs
      : leadLen < 120
        ? isPortrait
          ? 50
          : 54
        : leadLen < 260
          ? isPortrait
            ? 42
            : 44
          : leadLen < 420
            ? isPortrait
              ? 35
              : 37
            : leadLen < 620
              ? isPortrait
                ? 30
                : 32
              : isPortrait
                ? 26
                : 28;

  // ── timeline ────────────────────────────────────────────────────────────────
  // The ink plate wipes in first; everything else is staggered behind it.
  const plateRev = interpolate(frame, [0, 16], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const platePinch = `inset(0 ${(100 - plateRev).toFixed(2)}% 0 0)`;
  const kickerReveal = redactionReveal(frame, 8, 14);
  const titleMaskT = easeOutQuint(clamp01((frame - 10) / 24));
  const titleOp = clamp01((frame - 10) / 12);
  const titleBlur = 5 * (1 - clamp01((frame - 10) / 22));
  const sfOp = interpolate(frame, [26, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const folioOp = interpolate(frame, [34, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const endOp = interpolate(frame, [58, 74], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Photo plate develops from newsprint monochrome to colour.
  const developT = clamp01((frame - 8) / 52);
  const kbScale = interpolate(frame, [0, 260], [1.05, 1.13], { extrapolateRight: "clamp" }) * imageZoom;

  // Sentence-by-sentence rise of the lead (distinct from LeaderQuote's word-by-
  // word assembly). Each sentence rises into place with a small stagger.
  const sentences = lead.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const leadParts = sentences.length > 0 ? sentences : lead ? [lead] : [];
  // Stagger shrinks as the article lengthens so the full body always lands by
  // ~frame 80 regardless of sentence count (a short voiceover scene won't cut it).
  const leadStep = Math.min(9, 44 / Math.max(1, leadParts.length));

  const points = (keyPoints ?? []).filter((p) => (p || "").trim()).slice(0, 4);

  const folio = [sectionLabel, dateline].map((s) => (s || "").trim()).filter(Boolean).join("   ·   ");

  // ── the reversed-out plate (ink or photo) ───────────────────────────────────
  const plate = (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: hasImage ? ECONOMIST_COLORS.ink : "#181818",
        clipPath: platePinch,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: isPortrait ? "40px 56px" : "64px 56px",
        ...(isPortrait
          ? { width: "100%", height: "42%", flex: "0 0 auto" }
          : { width: "42%", height: "100%", flex: "0 0 42%" }),
      }}
    >
      {hasImage ? (
        <>
          <Img
            src={imageUrl as string}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imageObjectPosition,
              transform: `scale(${kbScale.toFixed(4)})`,
              filter: `grayscale(${(1 - developT).toFixed(3)}) contrast(1.04)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(115deg, rgba(20,20,20,0.92) 0%, rgba(20,20,20,0.78) 48%, rgba(20,20,20,0.55) 100%)",
            }}
          />
        </>
      ) : (
        <EngravingTexture color={PAPER} opacity={0.05} gap={12} angle={-45} />
      )}

      {/* Top group: kicker + title + standfirst, reversed out. */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative", marginBottom: isPortrait ? 18 : 26, display: "inline-block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, clipPath: kickerReveal.clipPath }}>
            <span style={{ width: 13, height: 13, background: accentColor }} />
            <span
              style={{
                fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
                fontWeight: 800,
                fontSize: isPortrait ? 22 : 19,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: MUTED_ON_DARK,
              }}
            >
              {sectionLabel}
            </span>
          </div>
          <span
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${kickerReveal.barLeftPct.toFixed(2)}%`,
              width: `${kickerReveal.barWidthPct}%`,
              background: accentColor,
              opacity: kickerReveal.barOpacity,
            }}
          />
        </div>

        {/* Title rises out from behind its own top edge (masked). */}
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
              fontWeight: 900,
              fontSize: titleSize,
              lineHeight: 1.04,
              letterSpacing: -titleSize * 0.012,
              color: PAPER,
              opacity: titleOp,
              transform: `translateY(${((1 - titleMaskT) * 102).toFixed(2)}%)`,
              filter: titleBlur > 0.01 ? `blur(${titleBlur.toFixed(2)}px)` : "none",
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ height: 4, width: 92, background: accentColor, margin: "22px 0 0", ...ruleDraw(frame, 24, 16) }} />

        {standfirst && (
          <div
            style={{
              fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
              fontStyle: "italic",
              fontSize: isPortrait ? 26 : 24,
              lineHeight: 1.42,
              color: MUTED_ON_DARK,
              opacity: sfOp,
              marginTop: 22,
              maxWidth: "94%",
            }}
          >
            {standfirst}
          </div>
        )}
      </div>

      {/* Foot of the plate: running folio, pinned to the bottom edge. */}
      {folio && !isPortrait && (
        <div
          style={{
            position: "absolute",
            left: 56,
            bottom: 48,
            fontFamily: fontFamily ?? ECONOMIST_SANS_FONT,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: MUTED_ON_DARK,
            opacity: folioOp,
          }}
        >
          {folio}
        </div>
      )}
    </div>
  );

  // ── the paper side: kinetic lead + key points ───────────────────────────────
  const paperSide = (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        // Portrait anchors the body just under the plate band (so it doesn't
        // strand in the lower middle); landscape centres it in the right column.
        justifyContent: isPortrait ? "flex-start" : "center",
        padding: isPortrait ? "52px 60px 8px" : `0 ${Math.round(width * 0.05)}px 0 64px`,
      }}
    >
      {/* Lead statement — the hero, revealed sentence by sentence. */}
      <div
        style={{
          fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT,
          fontWeight: 500,
          fontSize: leadFs,
          lineHeight: isLongLead ? 1.44 : 1.3,
          color: ECONOMIST_COLORS.ink,
        }}
      >
        {/* A short red lead-in tick sits before the first line. */}
        <span
          style={{
            display: "inline-block",
            width: leadFs * 0.9,
            height: 5,
            background: accentColor,
            verticalAlign: "middle",
            marginRight: 18,
            marginBottom: leadFs * 0.18,
            transform: `scaleX(${easeOutQuint(clamp01((frame - 30) / 16)).toFixed(3)})`,
            transformOrigin: "left center",
          }}
        />
        {leadParts.map((s, i) => {
          const delay = 32 + i * leadStep;
          const t = easeOutQuint(clamp01((frame - delay) / 18));
          return (
            <span
              key={i}
              style={{
                opacity: clamp01((frame - delay) / 11),
                // Each sentence rises a touch into place.
                display: "inline",
                ...(t < 1
                  ? { filter: `blur(${(2.4 * (1 - t)).toFixed(2)}px)` }
                  : {}),
              }}
            >
              {s}{i < leadParts.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>

      {/* Key points — a clean ruled list of takeaways. */}
      {points.length > 0 && (
        <div style={{ marginTop: isPortrait ? 34 : 44 }}>
          <div style={{ height: 1, background: ECONOMIST_COLORS.rule, width: "100%", ...ruleDraw(frame, 44, 16) }} />
          {points.map((pt, i) => {
            const row = slideFrom(frame, 48 + i * 7, -16);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 16,
                  padding: isPortrait ? "12px 0" : "13px 0",
                  borderBottom: `1px solid ${ECONOMIST_COLORS.rule}`,
                  opacity: row.opacity,
                  transform: row.transform,
                }}
              >
                <span style={{ flexShrink: 0, width: 11, height: 11, marginTop: 4, background: accentColor, transform: "rotate(45deg)" }} />
                <span style={{ fontFamily: fontFamily ?? ECONOMIST_SERIF_FONT, fontSize: isPortrait ? 27 : 25, lineHeight: 1.3, color: ECONOMIST_COLORS.ink }}>
                  {pt}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {points.length === 0 && (
        <div style={{ marginTop: 40, opacity: endOp }}>
          <EditorialDivider width={210} progress={endOp} accentColor={accentColor} height={16} />
        </div>
      )}
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        padding: `${topInset}px 0 ${botInset}px 0`,
        display: "flex",
        flexDirection: isPortrait ? "column" : "row",
      }}
    >
      {plate}
      {paperSide}
    </AbsoluteFill>
  );
};
