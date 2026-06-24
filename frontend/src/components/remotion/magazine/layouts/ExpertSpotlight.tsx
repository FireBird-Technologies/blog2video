import React from "react";
import { SceneLayoutProps } from "../types";
import {
  MagazinePage,
  Kicker,
  Rule,
  KineticWords,
  MAG_DISPLAY,
  MAG_SERIF,
  MAG_SANS,
  resolveMagColors,
  isPortrait,
  useReveal,
  gutterPx,
} from "../magazineStyle";

/**
 * Expert spotlight — an editorial two-page spread. The left page is a dark (ink)
 * panel carrying a big, bold, uppercase pull-quote opened by a red quotation
 * mark; the right page is a solid accent (red) panel with the "introducing"-style
 * profile copy (kicker, rule, name, role, credential) centred. Image-free, in
 * keeping with the print redesign — the page turns over on exit (see the
 * single-page-turn transition wired for this layout).
 */
export const ExpertSpotlight: React.FC<SceneLayoutProps> = (props) => {
  const { narration, titleFontSize, descriptionFontSize } = props;
  const expertName = (props.expertName as string) ?? props.title ?? "Jane Doe";
  const expertRole = (props.expertRole as string) ?? "";
  const credential = (props.credential as string) ?? "";
  const p = isPortrait(props.aspectRatio);
  const colors = resolveMagColors(props);
  const { bg, text, accent } = colors;

  const quote = (narration ?? props.title ?? "").trim();

  // Staged reveals on the right page; the left quote animates via KineticWords.
  const kickerO = useReveal(8, 12);
  const ruleP = useReveal(12, 14);
  const nameO = useReveal(15, 14);
  const roleO = useReveal(20, 14);
  const credO = useReveal(24, 14);

  const g = gutterPx(props.aspectRatio);
  const quotePx = titleFontSize ?? (p ? 46 : 56);
  const rolePx = descriptionFontSize ?? (p ? 22 : 21);
  const namePx = p ? 40 : 44;
  const pad = p ? "32px 30px" : "48px 46px";

  return (
    <MagazinePage colors={colors} section="Profile" issue={props.issueLabel ?? "Spotlight"} page={props.pageNumber} aspectRatio={props.aspectRatio} fontFamily={props.fontFamily} cameraMove={props.cameraMove}>
      <div style={{ height: "100%", display: "flex", flexDirection: p ? "column" : "row", gap: p ? 24 : g }}>
        {/* LEFT PAGE — dark ink panel with the pull-quote */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: text,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: pad,
            overflow: "hidden",
          }}
        >
          <div style={{ fontFamily: MAG_DISPLAY, fontWeight: 900, fontSize: p ? 92 : 124, lineHeight: 0.55, color: accent, marginBottom: p ? 6 : 10 }}>
            &ldquo;
          </div>
          <h1
            style={{
              fontFamily: MAG_DISPLAY,
              fontWeight: 800,
              fontSize: quotePx,
              lineHeight: 1.0,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: bg,
              margin: 0,
            }}
          >
            <KineticWords text={quote} start={6} stagger={3} dur={14} />
          </h1>
        </div>

        {/* RIGHT PAGE — solid accent panel with the centred profile copy */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: accent,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: pad,
            overflow: "hidden",
          }}
        >
          <Kicker color={bg} style={{ opacity: kickerO, marginBottom: 16 }}>
            Expert Profile
          </Kicker>
          <Rule color={bg} progress={ruleP} thickness={2} width={48} style={{ marginBottom: 22 }} />
          <h2 style={{ fontFamily: MAG_DISPLAY, fontWeight: 800, fontSize: namePx, lineHeight: 1.05, letterSpacing: "-0.015em", color: bg, margin: 0, opacity: nameO, transform: `translateY(${(1 - nameO) * 12}px)` }}>
            {expertName}
          </h2>
          {expertRole && (
            <div style={{ fontFamily: MAG_SERIF, fontStyle: "italic", fontSize: rolePx, color: bg, opacity: roleO * 0.92, marginTop: 12, maxWidth: "92%" }}>
              {expertRole}
            </div>
          )}
          {credential && (
            <div style={{ display: "inline-block", marginTop: 20, opacity: credO, background: bg, color: accent, fontFamily: MAG_SANS, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 14px" }}>
              {credential}
            </div>
          )}
        </div>
      </div>
    </MagazinePage>
  );
};
