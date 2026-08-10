import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneLayoutProps } from "../types";

const PLANE_SVG_PATH =
  "M21,16L21,14L13,9L13,3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z";

/** Returns the plane rotation in degrees for a given velocity (dx, dy). */
function travelAngle(dx: number, dy: number): number {
  return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
}

/** Shared plane rendering helper — glow + optional tether + plane SVG. */
function renderPlane(
  accentColor: string,
  planeX: number,
  planeY: number,
  planeOp: number,
  rot: number,
  scale: number,
  tetherOp: number,
  tetherX2: number,
  tetherY2: number,
  tetherSide: "top" | "bottom" | "left" | "right"
) {
  if (planeOp < 0.01) return null;
  const anchorOffset = scale * 4;
  const tx1 = planeX + (tetherSide === "left" ? -anchorOffset : tetherSide === "right" ? anchorOffset : 0);
  const ty1 = planeY + (tetherSide === "top" ? -anchorOffset : tetherSide === "bottom" ? anchorOffset : 0);
  return (
    <>
      <circle
        cx={planeX} cy={planeY}
        r={scale * 13}
        fill={accentColor}
        fillOpacity={planeOp * 0.15}
        style={{ filter: "blur(9px)" }}
      />
      {tetherOp > 0.01 && (
        <line
          x1={tx1} y1={ty1}
          x2={tetherX2} y2={tetherY2}
          stroke={accentColor}
          strokeWidth={2}
          strokeDasharray="11 8"
          strokeOpacity={tetherOp * 0.46}
          strokeLinecap="round"
        />
      )}
      <g
        opacity={planeOp}
        transform={`translate(${planeX}, ${planeY}) rotate(${rot}) scale(${scale}) translate(-11.5, -11)`}
        style={{ filter: `drop-shadow(0 0 15px ${accentColor}cc)` }}
      >
        <path d={PLANE_SVG_PATH} fill={accentColor} />
        <path d="M11.5,2 L13,9 L10,9 Z" fill="white" fillOpacity={0.38} />
      </g>
    </>
  );
}

export const Comparison: React.FC<SceneLayoutProps> = ({
  title,
  accentColor,
  bgColor,
  textColor,
  leftLabel = "Before",
  rightLabel = "After",
  leftDescription = "",
  rightDescription = "",
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const p = aspectRatio === "portrait";

  // ── Timing ─────────────────────────────────────────────────────────────────
  const PLANE_DUR  = 68;
  const EXIT_DUR   = 32;
  const exitStart  = Math.max(0, durationInFrames - EXIT_DUR);
  const inExit     = frame >= exitStart;

  // Landscape: vertical overshoot + horizontal arc on the plane's path
  const OS_Y  = height * 0.82;
  const ARC_X = width  * 0.055;

  // Portrait: horizontal overshoot + vertical arc on the plane's path
  const OS_X  = width  * 0.78;
  const ARC_Y_P = height * 0.042;   // gentle vertical bow for portrait planes
  // Estimated card-centre Y for portrait tether endpoints
  const P_TOP_CARD_CY    = height * 0.35;
  const P_BOTTOM_CARD_CY = height * 0.72;

  // Shared easing curves
  const EASE_OUT = Easing.bezier(0.16, 0.72, 0.44, 1.0);
  const EASE_IN  = Easing.bezier(0.44, 0, 0.84, 0.18);

  // ═══════════════════════════════════════════════════════════════════════════
  // LANDSCAPE — vertical planes (top→bottom left, bottom→top right)
  // ═══════════════════════════════════════════════════════════════════════════

  // Left entry plane: top → bottom at x ≈ 25% width
  const lsLeftEntT = interpolate(frame, [0, PLANE_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT,
  });
  const lsLeftPlaneY  = interpolate(lsLeftEntT, [0, 1], [-OS_Y, height + OS_Y * 0.25]);
  const lsLeftPlaneX  = width * 0.25 + ARC_X * Math.sin(lsLeftEntT * Math.PI);
  const lsLeftEntOp   = interpolate(lsLeftEntT, [0, 0.04, 0.84, 0.97], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lsLeftEntRot  = travelAngle(ARC_X * Math.PI * Math.cos(lsLeftEntT * Math.PI), height + OS_Y * 1.25);

  // Right entry plane: bottom → top at x ≈ 75% width, +10 delay
  const lsRightEntT = interpolate(frame, [10, PLANE_DUR + 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT,
  });
  const lsRightPlaneY  = interpolate(lsRightEntT, [0, 1], [height + OS_Y * 0.25, -OS_Y]);
  const lsRightPlaneX  = width * 0.75 - ARC_X * Math.sin(lsRightEntT * Math.PI);
  const lsRightEntOp   = interpolate(lsRightEntT, [0, 0.04, 0.84, 0.97], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lsRightEntRot  = travelAngle(-ARC_X * Math.PI * Math.cos(lsRightEntT * Math.PI), -(height + OS_Y * 1.25));

  // Card springs (landscape)
  const lsLeftCardSp = spring({ frame, fps, config: { damping: 28, stiffness: 20, mass: 4.2 } });
  const lsLeftCardY  = interpolate(lsLeftCardSp, [0, 1], [-OS_Y, 0]);

  const lsRightCardSp = spring({ frame: frame - 10, fps, config: { damping: 28, stiffness: 20, mass: 4.2 } });
  const lsRightCardY  = interpolate(lsRightCardSp, [0, 1], [OS_Y, 0]);

  // Exit springs (landscape)
  const lsLeftExitSp  = spring({ frame: frame - exitStart, fps, config: { damping: 22, stiffness: 32, mass: 3.0 }, durationInFrames: EXIT_DUR });
  const lsRightExitSp = spring({ frame: frame - exitStart, fps, config: { damping: 22, stiffness: 32, mass: 3.0 }, durationInFrames: EXIT_DUR });
  const lsLeftExitY   = interpolate(lsLeftExitSp,  [0, 1], [0,  OS_Y]);  // falls down
  const lsRightExitY  = interpolate(lsRightExitSp, [0, 1], [0, -OS_Y]);  // rises up

  // Landscape tether: show while entry plane is above/below the card
  const lsLeftCardCy  = height * 0.54 + (inExit ? lsLeftExitY  : lsLeftCardY);
  const lsRightCardCy = height * 0.54 + (inExit ? lsRightExitY : lsRightCardY);
  const lsLeftTetherOp = (!inExit && !p && lsLeftEntOp > 0.05 && lsLeftPlaneY < lsLeftCardCy - 25)
    ? interpolate(lsLeftEntT, [0.04, 0.12, 0.78, 0.90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const lsRightTetherOp = (!inExit && !p && lsRightEntOp > 0.05 && lsRightPlaneY > lsRightCardCy + 25)
    ? interpolate(lsRightEntT, [0.04, 0.12, 0.78, 0.90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTRAIT — horizontal planes (left→right top card, right→left bottom card)
  // Minor / smaller scale than landscape, same tether mechanic.
  // ═══════════════════════════════════════════════════════════════════════════
  const P_SCALE = 3.6; // smaller than landscape's 5.0 — "minor"

  // Top card entry: plane from LEFT → RIGHT at y ≈ top-card-centre
  const pTopEntT = interpolate(frame, [0, PLANE_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT,
  });
  const pTopPlaneX   = interpolate(pTopEntT, [0, 1], [-OS_X * 0.2, width + OS_X * 0.2]);
  const pTopPlaneY   = P_TOP_CARD_CY + ARC_Y_P * Math.sin(pTopEntT * Math.PI);
  const pTopEntOp    = interpolate(pTopEntT, [0, 0.04, 0.84, 0.97], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pTopEntRot   = travelAngle(width + OS_X * 0.4, ARC_Y_P * Math.PI * Math.cos(pTopEntT * Math.PI));

  // Bottom card entry: plane from RIGHT → LEFT at y ≈ bottom-card-centre, +10 delay
  const pBotEntT = interpolate(frame, [10, PLANE_DUR + 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT,
  });
  const pBotPlaneX   = interpolate(pBotEntT, [0, 1], [width + OS_X * 0.2, -OS_X * 0.2]);
  const pBotPlaneY   = P_BOTTOM_CARD_CY + ARC_Y_P * Math.sin(pBotEntT * Math.PI);
  const pBotEntOp    = interpolate(pBotEntT, [0, 0.04, 0.84, 0.97], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pBotEntRot   = travelAngle(-(width + OS_X * 0.4), ARC_Y_P * Math.PI * Math.cos(pBotEntT * Math.PI));

  // Portrait card springs — same config, X-based lag
  const pTopCardSp  = spring({ frame, fps, config: { damping: 28, stiffness: 22, mass: 3.8 } });
  const pTopCardX   = interpolate(pTopCardSp, [0, 1], [-OS_X, 0]);

  const pBotCardSp  = spring({ frame: frame - 10, fps, config: { damping: 28, stiffness: 22, mass: 3.8 } });
  const pBotCardX   = interpolate(pBotCardSp, [0, 1], [OS_X, 0]);

  // Portrait exit springs — cards exit to opposite sides
  const pTopExitSp  = spring({ frame: frame - exitStart, fps, config: { damping: 22, stiffness: 32, mass: 3.0 }, durationInFrames: EXIT_DUR });
  const pBotExitSp  = spring({ frame: frame - exitStart, fps, config: { damping: 22, stiffness: 32, mass: 3.0 }, durationInFrames: EXIT_DUR });
  const pTopExitX   = interpolate(pTopExitSp, [0, 1], [0, -OS_X]);   // top card exits LEFT
  const pBotExitX   = interpolate(pBotExitSp, [0, 1], [0,  OS_X]);   // bottom card exits RIGHT

  // Portrait exit planes (reversed direction)
  const pTopExtT = interpolate(frame, [exitStart, exitStart + EXIT_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN,
  });
  const pTopExtPlaneX = interpolate(pTopExtT, [0, 1], [width + OS_X * 0.2, -OS_X * 0.2]);  // RIGHT → LEFT
  const pTopExtPlaneY = P_TOP_CARD_CY + ARC_Y_P * Math.sin(pTopExtT * Math.PI);
  const pTopExtOp     = interpolate(pTopExtT, [0, 0.04, 0.84, 0.97], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pTopExtRot    = travelAngle(-(width + OS_X * 0.4), ARC_Y_P * Math.PI * Math.cos(pTopExtT * Math.PI));

  const pBotExtT = interpolate(frame, [exitStart + 8, exitStart + EXIT_DUR + 8], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN,
  });
  const pBotExtPlaneX = interpolate(pBotExtT, [0, 1], [-OS_X * 0.2, width + OS_X * 0.2]); // LEFT → RIGHT
  const pBotExtPlaneY = P_BOTTOM_CARD_CY + ARC_Y_P * Math.sin(pBotExtT * Math.PI);
  const pBotExtOp     = interpolate(pBotExtT, [0, 0.04, 0.84, 0.97], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pBotExtRot    = travelAngle(width + OS_X * 0.4, ARC_Y_P * Math.PI * Math.cos(pBotExtT * Math.PI));

  // Active portrait plane state
  const activePTopPlaneX  = inExit ? pTopExtPlaneX : pTopPlaneX;
  const activePTopPlaneY  = inExit ? pTopExtPlaneY : pTopPlaneY;
  const activePTopOp      = inExit ? pTopExtOp     : pTopEntOp;
  const activePTopRot     = inExit ? pTopExtRot    : pTopEntRot;

  const activePBotPlaneX  = inExit ? pBotExtPlaneX : pBotPlaneX;
  const activePBotPlaneY  = inExit ? pBotExtPlaneY : pBotPlaneY;
  const activePBotOp      = inExit ? pBotExtOp     : pBotEntOp;
  const activePBotRot     = inExit ? pBotExtRot    : pBotEntRot;

  // Portrait tethers
  const pTopCardCx  = width * 0.5 + (inExit ? pTopExitX : pTopCardX);
  const pBotCardCx  = width * 0.5 + (inExit ? pBotExitX : pBotCardX);
  const pTopTetherOp = (!inExit && p && pTopEntOp > 0.05 && pTopPlaneX < pTopCardCx - 20)
    ? interpolate(pTopEntT, [0.04, 0.12, 0.78, 0.90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const pBotTetherOp = (!inExit && p && pBotEntOp > 0.05 && pBotPlaneX > pBotCardCx + 20)
    ? interpolate(pBotEntT, [0.04, 0.12, 0.78, 0.90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  // Exit portrait tethers
  const pTopExtTetherOp = (inExit && p && pTopExtOp > 0.05 && pTopExtPlaneX > pTopCardCx + 20)
    ? interpolate(pTopExtT, [0.04, 0.12, 0.78, 0.90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const pBotExtTetherOp = (inExit && p && pBotExtOp > 0.05 && pBotExtPlaneX < pBotCardCx - 20)
    ? interpolate(pBotExtT, [0.04, 0.12, 0.78, 0.90], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  const activePTopTetherOp = inExit ? pTopExtTetherOp : pTopTetherOp;
  const activePBotTetherOp = inExit ? pBotExtTetherOp : pBotTetherOp;

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL COMBINED CARD TRANSFORMS
  // ═══════════════════════════════════════════════════════════════════════════
  const finalLeftX  = p ? (inExit ? pTopExitX  : pTopCardX)  : 0;
  const finalLeftY  = p ? 0                                    : (inExit ? lsLeftExitY  : lsLeftCardY);
  const finalRightX = p ? (inExit ? pBotExitX  : pBotCardX)  : 0;
  const finalRightY = p ? 0                                    : (inExit ? lsRightExitY : lsRightCardY);

  const cardOpIn  = interpolate(frame, [5, 22], [0, 1], { extrapolateRight: "clamp" });
  const cardOpOut = interpolate(p ? pTopExitSp : lsLeftExitSp, [0, 1], [1, 0], { extrapolateLeft: "clamp" });
  const finalOp   = inExit ? cardOpOut : cardOpIn;

  // ── Misc ────────────────────────────────────────────────────────────────────
  const titleOp  = interpolate(frame, [3, 22], [0, 1], { extrapolateRight: "clamp" });
  const dividerH = interpolate(frame, [5, 35], [0, 100], { extrapolateRight: "clamp" });
  const resolvedDescriptionFontSize = descriptionFontSize ?? (p ? 43 : 33);

  return (
    <>
      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          backgroundColor: bgColor,
          padding: p ? "60px 50px" : "80px 100px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <h2
          style={{
            color: textColor,
            fontSize: titleFontSize ?? (p ? 70 : 78),
            fontWeight: 700,
            fontFamily: fontFamily ?? "'Roboto Slab', serif",
            opacity: titleOp,
            marginTop: 0,
            marginBottom: p ? 28 : 40,
            textAlign: "center",
          }}
        >
          {title}
        </h2>

        <div style={{ display: "flex", flexDirection: p ? "column" : "row", flex: 1, gap: 0, position: "relative" }}>

          {/* Left / Top card */}
          <div style={{ flex: 1, padding: p ? "24px 20px" : 40, opacity: finalOp, transform: `translateX(${finalLeftX}px) translateY(${finalLeftY}px)` }}>
            <div style={{ width: resolvedDescriptionFontSize * 1.2, height: resolvedDescriptionFontSize * 1.2, borderRadius: 12, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width={resolvedDescriptionFontSize} height={resolvedDescriptionFontSize} viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 style={{ fontSize: resolvedDescriptionFontSize, fontWeight: 600, color: textColor, fontFamily: fontFamily ?? "'Roboto Slab', serif", margin: 0, marginBottom: 12 }}>{leftLabel}</h3>
            <p style={{ fontSize: resolvedDescriptionFontSize, color: textColor, fontFamily: fontFamily ?? "'Roboto Slab', serif", lineHeight: 1.6, opacity: 0.7, margin: 0 }}>{leftDescription}</p>
          </div>

          {/* Divider */}
          <div style={p ? { height: 2, backgroundColor: `${accentColor}40`, alignSelf: "center", width: `${dividerH}%`, borderRadius: 1 } : { width: 2, backgroundColor: `${accentColor}40`, alignSelf: "center", height: `${dividerH}%`, borderRadius: 1 }} />

          {/* Right / Bottom card */}
          <div style={{ flex: 1, padding: p ? "24px 20px" : 40, opacity: finalOp, transform: `translateX(${finalRightX}px) translateY(${finalRightY}px)` }}>
            <div style={{ width: resolvedDescriptionFontSize * 1.2, height: resolvedDescriptionFontSize * 1.2, borderRadius: 12, backgroundColor: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width={resolvedDescriptionFontSize} height={resolvedDescriptionFontSize} viewBox="0 0 24 24" fill="none">
                <path d="M5 12L10 17L19 7" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 style={{ fontSize: resolvedDescriptionFontSize, fontWeight: 600, color: textColor, fontFamily: fontFamily ?? "'Roboto Slab', serif", margin: 0, marginBottom: 12 }}>{rightLabel}</h3>
            <p style={{ fontSize: resolvedDescriptionFontSize, color: textColor, fontFamily: fontFamily ?? "'Roboto Slab', serif", lineHeight: 1.6, opacity: 0.7, margin: 0 }}>{rightDescription}</p>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 4, backgroundColor: accentColor }} />
      </AbsoluteFill>

      {/* ── Plane overlay — outside overflow:hidden ──────────────────────────── */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", overflow: "visible" }}
      >
        {/* ── LANDSCAPE planes ────────────────────────────────────────────── */}
        {!p && renderPlane(accentColor, lsLeftPlaneX,  lsLeftPlaneY,  inExit ? 0 : lsLeftEntOp,  lsLeftEntRot,  5.0, lsLeftTetherOp,  width * 0.25, lsLeftCardCy,  "bottom")}
        {!p && renderPlane(accentColor, lsRightPlaneX, lsRightPlaneY, inExit ? 0 : lsRightEntOp, lsRightEntRot, 5.0, lsRightTetherOp, width * 0.75, lsRightCardCy, "top")}

        {/* ── PORTRAIT planes (minor scale) ───────────────────────────────── */}
        {p && renderPlane(accentColor, activePTopPlaneX, activePTopPlaneY, activePTopOp, activePTopRot, P_SCALE, activePTopTetherOp, pTopCardCx, P_TOP_CARD_CY,    "right")}
        {p && renderPlane(accentColor, activePBotPlaneX, activePBotPlaneY, activePBotOp, activePBotRot, P_SCALE, activePBotTetherOp, pBotCardCx, P_BOTTOM_CARD_CY, "left")}
      </svg>
    </>
  );
};
