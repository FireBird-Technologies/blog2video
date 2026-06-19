import React from "react";
import { Img, useCurrentFrame, interpolate } from "remotion";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  hexToRgba,
  resolveMagColors,
  isPortrait,
  useReveal,
} from "../magazineStyle";

/**
 * Expert spotlight — a profile page. The person's headshot sits in a red-keyline
 * portrait box, beside the name, role, credential and a bio with a
 * character-by-character reveal. With no image, a large serif monogram (the
 * person's initials) stands in for the portrait.
 */
export const ExpertSpotlight: React.FC<SceneLayoutProps> = (props) => {
  const { narration, titleFontSize, descriptionFontSize, imageUrl, imageObjectPosition, imageZoom } = props;
  const expertName = (props.expertName as string) ?? props.title ?? "Jane Doe";
  const expertRole = (props.expertRole as string) ?? "";
  const credential = (props.credential as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const initials = expertName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  const hasImage = Boolean(imageUrl) && props.imagePlacement !== "none";

  const frame = useCurrentFrame();
  const monoO = useReveal(2, 14);
  const monoScale = interpolate(frame, [2, 18], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbScale = interpolate(frame, [0, 150], [1.05, 1.13], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (imageZoom ?? 1);
  const nameO = useReveal(10, 14);
  const ruleP = useReveal(18, 14);
  const bioStart = 22;
  const bio = narration ?? "";
  const charsShown = Math.floor(interpolate(frame, [bioStart, bioStart + bio.length * 0.6], [0, bio.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  const namePx = titleFontSize ?? (p ? 56 : 56);
  const bioPx = descriptionFontSize ?? (p ? 24 : 21);
  const monoSize = p ? 220 : 300;

  return (
    <MagazinePage colors={colors} section="Profile" issue={props.issueLabel ?? "Spotlight"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily}>
      <div style={{ height: "100%", display: "flex", flexDirection: p ? "column" : "row", alignItems: p ? "center" : "center", gap: p ? 28 : 56, textAlign: p ? "center" : "left" }}>
        {/* Portrait box — headshot if available, monogram otherwise */}
        <div
          style={{
            flexShrink: 0,
            width: monoSize,
            height: monoSize,
            border: `3px solid ${accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: monoO,
            transform: `scale(${monoScale})`,
            position: "relative",
            overflow: "hidden",
            background: hasImage ? hexToRgba(text, 0.06) : "transparent",
          }}
        >
          {hasImage ? (
            <Img
              src={imageUrl as string}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: imageObjectPosition ?? "50% 30%",
                transform: `scale(${kbScale.toFixed(4)})`,
              }}
            />
          ) : (
            <span style={{ fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: monoSize * 0.46, color: text, letterSpacing: "-0.02em" }}>{initials}</span>
          )}
          <div style={{ position: "absolute", bottom: -3, left: -3, width: "45%", height: 3, background: accent, zIndex: 2 }} />
        </div>

        {/* Details */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: p ? "center" : "flex-start" }}>
          <Kicker color={accent} style={{ opacity: nameO, marginBottom: 12 }}>
            Expert Profile
          </Kicker>
          <h1 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: namePx, lineHeight: 1.04, letterSpacing: "-0.015em", color: text, margin: 0, opacity: nameO }}>
            {expertName}
          </h1>
          {expertRole && (
            <div style={{ fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: p ? 24 : 22, color: text, opacity: nameO * 0.7, marginTop: 10 }}>
              {expertRole}
            </div>
          )}
          {credential && (
            <div style={{ display: "inline-block", marginTop: 16, opacity: nameO, background: accent, color: bg, fontFamily: MAG_SANS, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 14px" }}>
              {credential}
            </div>
          )}
          <Rule color={accent} progress={ruleP} thickness={2} width={p ? 120 : 90} style={{ margin: "24px 0" }} />
          {bio && (
            <p style={{ fontFamily: MAG_SERIF, fontSize: bioPx, lineHeight: 1.6, color: text, opacity: 0.9, margin: 0, maxWidth: p ? "92%" : "94%" }}>
              {bio.slice(0, charsShown)}
            </p>
          )}
        </div>
      </div>
    </MagazinePage>
  );
};
