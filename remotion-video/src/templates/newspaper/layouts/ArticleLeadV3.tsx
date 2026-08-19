import React from "react";
import { NewspaperClip } from "../components/NewspaperClip";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import { NewsBackground, NewsPaperWash } from "../NewsBackground";
import type { BlogLayoutProps } from "../types";

const H_FONT = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const B_FONT = "'Source Sans 3', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * article_lead__v3 — "Sidebar Stat".
 *
 * Same props and prop meanings as ArticleLead (stats[0].value = pull stat,
 * stats[0].label = its caption).
 *
 * Laid out as a lead column with a picture rail: the paragraph runs at a proper
 * measure with the stat banded across its foot between two rules (figure left,
 * caption right off an accent bar), and the image takes the full height of the
 * rail beside it. The page is a plane in 3D that tilts in and settles while the
 * newsprint behind drifts the other way.
 */
export const ArticleLeadV3: React.FC<BlogLayoutProps & { imageUrl?: string }> = ({
  title = "The Story",
  narration = "Lawmakers failed to pass a short-term spending bill before the midnight deadline, triggering a partial shutdown affecting hundreds of thousands of federal workers.",
  accentColor = "#FFE34D",
  bgColor = "#FAFAF8",
  textColor = "#111111",
  aspectRatio = "landscape",
  titleFontSize,
  descriptionFontSize,
  stats,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = aspectRatio === "portrait";

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 22, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const contentOpacity = fadeIn * fadeOut;

  /* ── 3D CAMERA ──────────────────────────────────────────────────────────
     The page enters tilted off-axis, eases toward flat, then keeps drifting
     so the shot never sits completely still. */
  const camRotateX = interpolate(frame, [0, 80], [11, 2], { extrapolateRight: "clamp" });
  const camRotateY = interpolate(frame, [0, 80], [10, 1.5], { extrapolateRight: "clamp" });
  const camRotateZ = interpolate(frame, [0, 80], [1.8, 0.4], { extrapolateRight: "clamp" });
  const camScale = interpolate(frame, [0, 80], [1.15, 1.03], { extrapolateRight: "clamp" });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -30]);
  const driftX = interpolate(frame, [0, durationInFrames], [0, -14]);

  // Backdrop moves on its own axis and direction — parallax against the page.
  const bgScale = interpolate(frame, [0, durationInFrames], [1.08, 1.18], {
    extrapolateRight: "clamp",
  });
  const bgDriftX = interpolate(frame, [0, durationInFrames], [0, 22]);

  /* ── PAGE ELEMENTS ─────────────────────────────────────────────────────── */
  const ruleW = interpolate(frame, [0, 20], [0, 100], { extrapolateRight: "clamp" });
  const titleOp = interpolate(frame, [8, 24], [0, 1], { extrapolateRight: "clamp" });
  const titleX = interpolate(frame, [8, 24], [-26, 0], { extrapolateRight: "clamp" });

  const bodyProgress = interpolate(frame, [24, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visChars = Math.floor(narration.length * bodyProgress);
  const visText = narration.slice(0, visChars);
  const showCursor = visChars < narration.length;
  const dropChar = narration[0] ?? "";
  const dropCapOp = interpolate(frame, [16, 32], [0, 1], { extrapolateRight: "clamp" });

  const pullVal = stats?.[0]?.value ?? "";
  const pullCap = stats?.[0]?.label ?? "";
  // The stat band rises into place under the lead paragraph.
  const clipIn = interpolate(frame, [34, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipEased = 1 - Math.pow(1 - clipIn, 3);
  const clipY = (1 - clipEased) * 26;
  const pullNumP = interpolate(frame, [44, 70], [0, 1], { extrapolateRight: "clamp" });

  const numericMatch = pullVal.match(/^(\d+(?:\.\d+)?)(.*)/);
  const baseNum = numericMatch ? parseFloat(numericMatch[1]) : null;
  const numSuffix = numericMatch ? numericMatch[2] : pullVal;
  const animatedNum = baseNum !== null ? Math.round(baseNum * pullNumP) : null;
  const displayVal = animatedNum !== null ? `${animatedNum}${numSuffix}` : pullVal;

  const imageOp = interpolate(frame, [26, 48], [0, 1], { extrapolateRight: "clamp" });
  const imageScale = interpolate(frame, [26, 48], [0.92, 1], { extrapolateRight: "clamp" });
  const hasVisual = Boolean(imageUrl || videoUrl);

  const narrationSize = descriptionFontSize ?? (p ? 38 : 29);
  const statsValueSize = narrationSize + (p ? 40 : 52);
  const statsLabelSize = Math.max(12, narrationSize - 14);

  // PORTRAIT: text first, picture second. The image is capped so it can never
  // crowd the copy — the cap tightens as the lead runs longer.
  //
  // The floor matters: a 1280px-tall portrait frame at the old 26% cap left the
  // picture ~256px once the card's own padding came off, which reads as a strip
  // rather than a photograph. The tiers below keep it at roughly a third of the
  // frame even for long copy, which the lead column can afford because it only
  // takes the height its text actually needs (`flex: 1 1 auto`).
  const narrationLen = narration.length;
  const portraitImageMaxHeight =
    narrationLen > 300 ? "36%" : narrationLen > 210 ? "42%" : narrationLen > 140 ? "48%" : "54%";

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? B_FONT,
        backgroundColor: bgColor,
        perspective: "1600px",
        perspectiveOrigin: "50% 45%",
      }}
    >
      {/* ── BACKDROP: newsprint drifting independently of the page ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${bgScale}) translateX(${bgDriftX}px)`,
        }}
      >
        <NewsBackground bgColor={bgColor} />
        <img
          src={staticFile("vintage-news.avif")}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.24,
            filter: "grayscale(80%) contrast(1.1)",
            mixBlendMode: "multiply",
          }}
        />
        {/* The texture above is grayscale and would cancel the warm cast the
            rest of the template has, so the paper wash is re-applied over it. */}
        <NewsPaperWash />
      </div>

      {/* ── THE PAGE ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform:
            `scale(${camScale}) rotateX(${camRotateX}deg) rotateY(${camRotateY}deg) ` +
            `rotateZ(${camRotateZ}deg) translate(${driftX}px, ${driftY}px)`,
          opacity: contentOpacity,
          display: "flex",
          flexDirection: "column",
          padding: p ? "11% 8%" : "7% 7%",
        }}
      >
        {/* HEADER */}
        <div style={{ flexShrink: 0, transform: "translateZ(30px)" }}>
          <div
            style={{
              height: p ? 9 : 7,
              background: textColor,
              width: `${ruleW}%`,
              marginBottom: 18,
            }}
          />
          <div
            style={{
              fontFamily: fontFamily ?? B_FONT,
              fontSize: titleFontSize ?? (p ? 65 : 50),
              fontWeight: 900,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: textColor,
              lineHeight: 0.95,
              opacity: titleOp,
              transform: `translateX(${titleX}px)`,
            }}
          >
            {title}
          </div>
        </div>

        {/* BODY + CLIPPING */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            marginTop: p ? 26 : 24,
            display: "flex",
            flexDirection: p ? "column" : "row",
            gap: p ? 24 : 48,
            alignItems: "stretch",
          }}
        >
          {/* LEAD COLUMN — paragraph, then the stat band ruled across its foot.
              Grows in both orientations so it takes the space the picture rail
              doesn't need, rather than leaving a gap between the two. */}
          <div
            style={{
              // PORTRAIT: `1 1 auto` so the copy takes the room it needs and
              // leaves the rest to the picture rail below. `1 1 0` would make
              // the column grow into ALL the free space and squeeze the rail
              // back down to its (already small) shrink floor.
              flex: p ? "1 1 auto" : "1 1 0",
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              transform: "translateZ(30px)",
            }}
          >
            <div
              style={{
                // Portrait stacks text over picture, so the paragraph sizes to
                // its content and the stat band sits directly beneath it rather
                // than being pushed to the foot of a stretched column.
                flex: p ? "0 1 auto" : 1,
                minHeight: 0,
                overflow: "hidden",
                fontFamily: fontFamily ?? B_FONT,
                fontSize: narrationSize,
                fontWeight: 500,
                color: textColor,
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  float: "left",
                  fontFamily: fontFamily ?? H_FONT,
                  fontSize: p ? 124 : 106,
                  fontWeight: 800,
                  lineHeight: 0.7,
                  marginRight: 14,
                  marginTop: 6,
                  color: textColor,
                  opacity: dropCapOp,
                  display: "inline-block",
                }}
              >
                {dropChar}
              </span>
              <span style={{ textShadow: `0 0 2px ${bgColor}` }}>
                {visText.length > 1 ? visText.slice(1) : ""}
                {showCursor && visChars > 0 && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 4,
                      height: "0.9em",
                      background: textColor,
                      opacity: 0.6,
                      marginLeft: 2,
                      verticalAlign: "middle",
                    }}
                  />
                )}
              </span>
            </div>

            {/* ── STAT BAND — runs the width of the column, figure left, caption
                 right, between two rules. Reads as part of the article rather
                 than a box parked in a side rail. ── */}
            {pullVal && (
              <div
                style={{
                  flexShrink: 0,
                  // Portrait with NO image: `auto` pushes the band to the foot of
                  // the frame, so the stat anchors the page instead of floating
                  // mid-air under a short paragraph. With an image the picture
                  // rail follows it, so it stays directly under the copy.
                  marginTop: p && !hasVisual ? "auto" : p ? 22 : 20,
                  opacity: clipIn,
                  transform: `translateY(${clipY}px)`,
                  borderTop: `4px solid ${textColor}`,
                  borderBottom: `1.5px solid ${textColor}`,
                  paddingTop: p ? 14 : 12,
                  paddingBottom: p ? 14 : 12,
                  display: "flex",
                  alignItems: "stretch",
                  gap: p ? 18 : 22,
                }}
              >
                <span
                  style={{
                    fontFamily: fontFamily ?? H_FONT,
                    fontSize: statsValueSize,
                    fontWeight: 800,
                    lineHeight: 0.9,
                    color: textColor,
                    flexShrink: 0,
                  }}
                >
                  {displayVal}
                </span>
                {pullCap && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: fontFamily ?? B_FONT,
                      fontSize: statsLabelSize,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      lineHeight: 1.3,
                      color: textColor,
                      opacity: 0.62,
                      // Full-height accent bar: `stretch` on the row gives this
                      // something to fill, so it reads as a rule not a dash.
                      borderLeft: `4px solid ${accentColor}`,
                      paddingLeft: p ? 14 : 16,
                    }}
                  >
                    {pullCap}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* PICTURE RAIL — beside the column in landscape, below it in portrait.
              In PORTRAIT the rail needs a DEFINITE height basis: its only child
              is `flex: 1`, which resolves against the rail's own height, so a
              `flexBasis: auto` rail collapses to nothing and the picture shows
              as a sliver. Sizing the basis to the same cap `maxHeight` uses
              gives the image a real box, and `flexShrink: 1` still lets a long
              lead reclaim the space rather than clipping the copy. */}
          <div
            style={{
              width: p ? "100%" : "34%",
              flexShrink: p ? 1 : 0,
              flexGrow: 0,
              flexBasis: p ? portraitImageMaxHeight : "auto",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxHeight: p ? portraitImageMaxHeight : undefined,
            }}
          >
            {hasVisual && (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  background: "#fff",
                  padding: 9,
                  boxShadow: "0 16px 36px rgba(0,0,0,0.2)",
                  opacity: imageOp,
                  transform: `scale(${imageScale}) translateZ(55px) rotate(-1deg)`,
                  clipPath: "polygon(0% 1%, 100% 0%, 99% 99%, 1% 100%)",
                }}
              >
                <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
                  {videoUrl ? (
                    <NewspaperClip
                      src={videoUrl}
                      imageObjectPosition={imageObjectPosition}
                      imageZoom={imageZoom}
                      muted={videoMuted ?? true}
                      volume={videoVolume ?? 0.35}
                      durationInFrames={videoDurationInFrames}
                      startInFrames={videoStartInFrames}
                      style={{ filter: "grayscale(0.7) contrast(1.1)" }}
                    />
                  ) : imageUrl ? (
                    <Img
                      src={imageUrl}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
                        objectPosition:
                          (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
                        transform: `scale(${imageZoom ?? 1})`,
                        transformOrigin:
                          (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
                        filter: "grayscale(0.7) contrast(1.1)",
                      }}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print screen over the whole frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(#000 1px, transparent 0)",
          backgroundSize: "4px 4px",
          opacity: 0.035,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
