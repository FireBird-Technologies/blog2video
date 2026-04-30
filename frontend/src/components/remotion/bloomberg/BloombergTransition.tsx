import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BLOOMBERG_COLORS, BLOOMBERG_DEFAULT_FONT_FAMILY, derivePalette } from "./constants";

export type BloombergTransitionVariant =
  | "scanline_wipe"
  | "pixel_dissolve"
  | "price_flash"
  | "command_prompt"
  | "column_shutter"
  | "phosphor_slide"
  | "news_wire"
  | "panel_refresh";

export interface BloombergNextSceneHint {
  title?: string;
  narration?: string;
  layout?: string;
  items?: string[];
  metrics?: { value: string; label: string; suffix?: string }[];
  ticker?: string;
}

export interface BloombergTransitionProps {
  variant: BloombergTransitionVariant;
  accentColor?: string;
  textColor?: string;
  bgColor?: string;
  aspectRatio?: string;
  fontFamily?: string;
  nextScene?: BloombergNextSceneHint;
}

export const BLOOMBERG_TRANSITION_DURATION = 90;

export function pickBloombergTransition(
  outgoingLayout: string,
): BloombergTransitionVariant {
  switch (outgoingLayout) {
    case "terminal_boot":
      return "command_prompt";
    case "terminal_chart":
    case "terminal_dataviz":
    case "terminal_dashboard":
      return "panel_refresh";
    case "terminal_ticker":
    case "terminal_quote":
    case "terminal_metric":
      return "price_flash";
    case "terminal_table":
    case "terminal_options":
    case "terminal_profile":
      return "column_shutter";
    case "terminal_narrative":
    case "terminal_list":
    case "terminal_split":
      return "news_wire";
    default:
      return "phosphor_slide";
  }
}

// ─── shared easing presets ────────────────────────────────────────────────────
// Newspaper-inspired smooth camera easing
const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOutCubic = Easing.bezier(0.65, 0, 0.35, 1);
const easeOutCubic = Easing.bezier(0.33, 1, 0.68, 1);
const easeInOutQuart = Easing.bezier(0.76, 0, 0.24, 1);

// ─── shared helpers ───────────────────────────────────────────────────────────

const Scanlines: React.FC<{ opacity: number; color?: string }> = ({ opacity, color = "#FFB340" }) => (
  <div style={{
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `repeating-linear-gradient(to bottom, ${color ?? "#FFB340"}04 0px, ${color ?? "#FFB340"}04 1px, transparent 1px, transparent 3px)`,
    opacity,
  }} />
);

/**
 * Pull concrete numbers + context from narration text.
 * Returns up to `max` items like { val: "7,022", unit: "pts", label: "S&P 500" }
 */
function extractNarrationNumbers(
  narration: string,
  max = 4,
): { val: string; unit: string; label: string }[] {
  if (!narration) return [];
  const out: { val: string; unit: string; label: string }[] = [];

  const pctRe = /(?:([A-Z][a-zA-Z\s&]{1,20})\s+)?(?:rose|fell|gained|lost|climbed|slipped|surged|dropped|up|down|at)?\s*([+\-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(%)/gi;
  let m: RegExpExecArray | null;
  while ((m = pctRe.exec(narration)) !== null && out.length < max) {
    const label = (m[1] || "").trim().replace(/\s+/g, " ").slice(0, 14) || "CHG";
    out.push({ val: m[2], unit: "%", label: label.toUpperCase() });
  }

  const dollarRe = /\$\s*([\d,]+(?:\.\d{1,2})?)\s*([BMK](?:illion|n)?)?/gi;
  while ((m = dollarRe.exec(narration)) !== null && out.length < max) {
    const suffix = m[2] ? m[2][0].toUpperCase() : "";
    out.push({ val: m[1], unit: suffix || "", label: "$" });
  }

  if (out.length < 2) {
    const numRe = /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g;
    while ((m = numRe.exec(narration)) !== null && out.length < max) {
      out.push({ val: m[1], unit: "", label: "LEVEL" });
    }
  }

  return out.slice(0, max);
}

/** Get the opening sentence (up to `len` chars) of a narration string. */
function narrationLead(narration: string, len = 80): string {
  if (!narration) return "";
  const sentence = narration.split(/[.!?]/)[0] ?? narration;
  return sentence.trim().slice(0, len);
}

// ─── [01] NEWS WIRE ─ "DOLLY IN" camera push ─────────────────────────────────
// Camera slowly pushes forward from a wide shot, title types in on approach.
const NewsWire: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  bgColor,
  fontFamily,
  nextScene,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const _bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(_bg, accentColor);

  // Spring-driven camera settle — exactly like newspaper ArticleLead's camera moves
  const cameraSp = spring({ frame, fps, config: { stiffness: 30, damping: 14 } });

  const cameraScale = interpolate(cameraSp, [0, 1], [1.08, 1.0]);
  const cameraRotateX = interpolate(cameraSp, [0, 1], [3, 0]);
  const cameraTranslateX = interpolate(cameraSp, [0, 1], [6, 0]);

  // Spring-driven background fade — avoids the hard opacity cut
  const bgSp = spring({ frame, fps, config: { stiffness: 60, damping: 18 } });
  const bgOpacity = interpolate(bgSp, [0, 1], [0, 1]);

  const headline = (nextScene?.title || "NEXT SEGMENT").toUpperCase();
  const charsShown = Math.floor(
    interpolate(frame, [20, durationInFrames * 0.7], [0, headline.length], {
      extrapolateRight: "clamp", extrapolateLeft: "clamp",
      easing: easeInOutCubic,
    }),
  );
  const cursorOn = Math.floor(frame / 5) % 2 === 0 && charsShown < headline.length;

  const lead = narrationLead(nextScene?.narration || "", 90);
  const leadOpacity = interpolate(frame, [durationInFrames * 0.55, durationInFrames * 0.82], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });
  const leadY = interpolate(frame, [durationInFrames * 0.55, durationInFrames * 0.82], [12, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });

  const fn = nextScene?.layout ? nextScene.layout.replace("terminal_", "").toUpperCase() : "";
  const livePulse = 0.4 + 0.6 * Math.abs(Math.sin(frame / 7));

  const stats = extractNarrationNumbers(nextScene?.narration || "", 3);
  const statsOpacity = interpolate(frame, [durationInFrames * 0.68, durationInFrames * 0.9], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });
  const statsY = interpolate(frame, [durationInFrames * 0.68, durationInFrames * 0.9], [16, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });

  // Underline grows with the title
  const ruleWidth = interpolate(
    frame,
    [durationInFrames * 0.3, durationInFrames * 0.7],
    [0, 100],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp", easing: easeOutCubic },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100, perspective: "1200px" }}>
      {/* Camera layer */}
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) translateX(${cameraTranslateX}px)`,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundColor: _bg, opacity: bgOpacity * 0.93 }} />
        <Scanlines opacity={bgOpacity} color={accentColor} />

        {/* Top bar — function tag + live */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 36, backgroundColor: headerBg,
          borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center", padding: "0 28px", gap: 14,
          opacity: bgOpacity, fontFamily: ff,
          transform: "translateZ(20px)",
        }}>
          <div style={{
            backgroundColor: BLOOMBERG_COLORS.neg,
            color: "#fff", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.2em", padding: "2px 8px",
          }}>FIRST WORD</div>
          {fn && (
            <span style={{ color: accentColor, fontSize: 10, letterSpacing: "0.16em" }}>
              ▸ {fn}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: BLOOMBERG_COLORS.neg, opacity: livePulse }} />
            <span style={{ color: BLOOMBERG_COLORS.neg, fontSize: 9, letterSpacing: "0.18em" }}>LIVE</span>
          </div>
        </div>

        {/* Main content — slightly forward in Z (depth layer) */}
        <div style={{
          position: "absolute", top: 36, bottom: 0, left: 0, right: 0,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 52px", gap: 20,
          opacity: bgOpacity,
          transform: "translateZ(30px)",
        }}>
          <div style={{ fontFamily: ff }}>
            <div style={{
              color: accentColor,
              fontSize: 22, fontWeight: 700,
              letterSpacing: "0.04em", lineHeight: 1.25,
              textShadow: `0 0 24px ${accentColor}44`,
            }}>
              {headline.slice(0, charsShown)}
              {cursorOn && (
                <span style={{
                  display: "inline-block", width: 12, height: 20,
                  backgroundColor: accentColor, verticalAlign: "-3px", marginLeft: 3,
                }} />
              )}
            </div>

            <div style={{
              height: 2, marginTop: 14,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}00)`,
              width: `${ruleWidth}%`,
              transition: "none",
            }} />
          </div>

          {lead && (
            <div style={{
              color: "#e8e0cf",
              fontFamily: ff,
              fontSize: 12, lineHeight: 1.6,
              maxWidth: "72%",
              opacity: leadOpacity,
              transform: `translateY(${leadY}px)`,
            }}>
              {lead}{lead.length >= 90 ? "…" : ""}
            </div>
          )}

          {stats.length > 0 && (
            <div style={{
              display: "flex", gap: 24,
              opacity: statsOpacity,
              transform: `translateY(${statsY}px)`,
              fontFamily: ff,
            }}>
              {stats.map((s, i) => (
                <div key={i} style={{
                  borderLeft: `2px solid ${accentColor}`,
                  paddingLeft: 10,
                }}>
                  <div style={{ color: accentColor, fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums" }}>
                    {s.val}{s.unit}
                  </div>
                  <div style={{ color: muted, fontSize: 8, letterSpacing: "0.2em", marginTop: 2 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── [02] PANEL REFRESH ─ "BIRD'S EYE TILT DOWN" camera ──────────────────────
// Starts from above (rotateX -10°) and smoothly tilts level, as if a
// ceiling-mounted camera swivels down to reveal the panel grid.
const PanelRefresh: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  bgColor,
  fontFamily,
  nextScene,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const _bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(_bg, accentColor);

  // Spring-driven camera tilt — slow soft spring so the settle feels like a real camera
  const cameraSp = spring({ frame, fps, config: { stiffness: 28, damping: 13 } });
  const cameraRotateX = interpolate(cameraSp, [0, 1], [-10, 0]);
  const cameraScale = interpolate(cameraSp, [0, 1], [1.1, 1.0]);
  const cameraTranslateY = interpolate(cameraSp, [0, 1], [-20, 0]);

  const bgSp = spring({ frame, fps, config: { stiffness: 55, damping: 18 } });
  const bgOpacity = interpolate(bgSp, [0, 1], [0, 1]);

  type PanelDatum = { label: string; value: string; suffix?: string; dir?: "up" | "down" | "neu" };
  let panelData: PanelDatum[] = [];

  if ((nextScene?.metrics?.length ?? 0) >= 2) {
    panelData = (nextScene!.metrics!).slice(0, 4).map((m) => ({
      label: m.label,
      value: m.value,
      suffix: m.suffix || "",
      dir: (m.suffix || "").startsWith("-") ? "down" : (m.suffix || "").startsWith("+") ? "up" : "neu",
    }));
  } else if ((nextScene?.items?.length ?? 0) >= 2) {
    panelData = (nextScene!.items!).slice(0, 4).map((row) => {
      const parts = row.split(/\s{2,}/);
      const sym = (parts[0] || "").trim();
      const pct = (parts[1] || "").trim();
      const price = (parts[2] || "").replace("$", "").replace("—", "").trim();
      return {
        label: sym || "SYM",
        value: pct || price || "—",
        suffix: price && pct ? `$${price}` : "",
        dir: pct.startsWith("+") ? "up" : pct.startsWith("-") ? "down" : "neu",
      };
    });
  } else {
    const nums = extractNarrationNumbers(nextScene?.narration || "", 4);
    if (nums.length > 0) {
      panelData = nums.map((n) => ({
        label: n.label,
        value: `${n.val}${n.unit}`,
        dir: n.val.startsWith("+") ? "up" : n.val.startsWith("-") ? "down" : "neu",
      }));
    }
    const titleWords = (nextScene?.title || "").toUpperCase().split(/\s+/).filter(Boolean);
    while (panelData.length < 4) {
      const w = titleWords[panelData.length] || "—";
      panelData.push({ label: "SEGMENT", value: w, dir: "neu" });
    }
  }

  const header = nextScene?.ticker
    || (nextScene?.title || "").split(" ").slice(0, 3).join(" ").toUpperCase().slice(0, 18);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100, perspective: "1400px" }}>
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) translateY(${cameraTranslateY}px)`,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundColor: _bg, opacity: bgOpacity * 0.95 }} />
        <Scanlines opacity={bgOpacity} color={accentColor} />

        {/* Top amber strip */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 38, backgroundColor: accentColor,
          display: "flex", alignItems: "center", paddingLeft: 28, gap: 16,
          opacity: interpolate(frame, [8, 26], [0, 1], { extrapolateRight: "clamp", easing: easeOutCubic }),
          fontFamily: ff,
          transform: "translateZ(25px)",
        }}>
          <span style={{ color: _bg, fontSize: 14, fontWeight: 700, letterSpacing: "0.1em" }}>
            {header}
          </span>
          {nextScene?.layout && (
            <span style={{ color: `${_bg}77`, fontSize: 9, letterSpacing: "0.14em" }}>
              ▸ {nextScene.layout.replace("terminal_", "").toUpperCase()}
            </span>
          )}
          {nextScene?.narration && (
            <span style={{
              color: `${_bg}AA`, fontSize: 9, letterSpacing: "0.06em",
              overflow: "hidden", whiteSpace: "nowrap",
              maxWidth: "45%",
              opacity: interpolate(frame, [28, 44], [0, 1], { extrapolateRight: "clamp", easing: easeOutCubic }),
            }}>
              {narrationLead(nextScene.narration, 60)}
            </span>
          )}
        </div>

        {/* 2×2 panel grid — each panel slides up from below with stagger */}
        <div style={{
          position: "absolute", top: 38, bottom: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: "64%",
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 10, fontFamily: ff,
            transform: "translateZ(10px)",
          }}>
            {panelData.slice(0, 4).map((pd, i) => {
              // Each panel slides up individually — no harsh flash
              const staggerStart = 12 + i * 12;
              const panelReveal = interpolate(frame, [staggerStart, staggerStart + 22], [0, 1], {
                extrapolateRight: "clamp", extrapolateLeft: "clamp",
                easing: easeOutCubic,
              });
              const panelY = interpolate(frame, [staggerStart, staggerStart + 22], [24, 0], {
                extrapolateRight: "clamp", extrapolateLeft: "clamp",
                easing: easeOutCubic,
              });
              // Soft amber glow instead of harsh flash
              const glowIntensity = interpolate(frame, [staggerStart, staggerStart + 8, staggerStart + 20], [0, 1, 0], {
                extrapolateRight: "clamp", extrapolateLeft: "clamp",
                easing: easeOutCubic,
              });
              const valueColor = pd.dir === "up" ? "#4ADE80" : pd.dir === "down" ? BLOOMBERG_COLORS.neg : accentColor;

              return (
                <div key={i} style={{
                  backgroundColor: panelBg,
                  border: `1px solid ${border}`,
                  borderTop: `2px solid ${accentColor}`,
                  padding: "14px 16px", position: "relative", overflow: "hidden", minHeight: 80,
                  opacity: panelReveal,
                  transform: `translateY(${panelY}px)`,
                  boxShadow: glowIntensity > 0.05 ? `0 0 ${20 * glowIntensity}px ${accentColor}${Math.floor(glowIntensity * 80).toString(16).padStart(2, "0")}` : "none",
                }}>
                  <div style={{
                    color: muted,
                    fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                    marginBottom: 10, fontFamily: ff,
                  }}>
                    {pd.label}
                  </div>
                  <div style={{
                    color: valueColor,
                    fontSize: 20, fontWeight: 700,
                    fontFamily: ff, letterSpacing: "0.03em",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {pd.value}
                    {pd.suffix && (
                      <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>{pd.suffix}</span>
                    )}
                  </div>
                  <div style={{
                    position: "absolute", top: 10, right: 10, width: 5, height: 5,
                    backgroundColor: panelReveal > 0.5 ? accentColor : border,
                    opacity: panelReveal,
                  }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── [03] COMMAND PROMPT ─ "ZOOM TO SCREEN" perspective ──────────────────────
// Camera starts at a slight angle (as if looking at the terminal from the side)
// and smoothly swivels to face it head-on, like a rack focus on a monitor.
const CommandPrompt: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  bgColor,
  fontFamily,
  nextScene,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const _bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(_bg, accentColor);

  // Spring-driven rack focus — camera swings to face the screen
  const cameraSp = spring({ frame, fps, config: { stiffness: 32, damping: 13 } });
  const cameraRotateY = interpolate(cameraSp, [0, 1], [-10, 0]);
  const cameraScale = interpolate(cameraSp, [0, 1], [1.06, 1.0]);
  const cameraTranslateX = interpolate(cameraSp, [0, 1], [-12, 0]);

  const bgSp = spring({ frame, fps, config: { stiffness: 65, damping: 18 } });
  const bgOpacity = interpolate(bgSp, [0, 1], [0, 1]);

  const rawCmd = narrationLead(nextScene?.narration || nextScene?.title || "LOADING NEXT FUNCTION", 42);
  const cmd = rawCmd.toUpperCase();

  const charsShown = Math.floor(
    interpolate(frame, [8, durationInFrames * 0.68], [0, cmd.length], {
      extrapolateRight: "clamp", extrapolateLeft: "clamp",
      easing: easeInOutCubic,
    }),
  );
  const cursorBlink = Math.floor(frame / 4) % 2 === 0 && charsShown < cmd.length;

  const goAppear = interpolate(frame, [durationInFrames * 0.68, durationInFrames * 0.82], [0, 1], {
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });
  const goPressed = frame > durationInFrames * 0.84;

  const fnCode = nextScene?.layout ? nextScene.layout.replace("terminal_", "").toUpperCase() : "NEXT";

  const descOpacity = interpolate(frame, [durationInFrames * 0.52, durationInFrames * 0.74], [0, 1], {
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });
  const descY = interpolate(frame, [durationInFrames * 0.52, durationInFrames * 0.74], [10, 0], {
    extrapolateRight: "clamp",
    easing: easeOutCubic,
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100, perspective: "1300px" }}>
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateY(${cameraRotateY}deg) translateX(${cameraTranslateX}px)`,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundColor: _bg, opacity: bgOpacity * 0.96 }} />
        <Scanlines opacity={bgOpacity} color={accentColor} />

        {/* Top chrome with breadcrumb */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: 38, backgroundColor: headerBg,
          borderBottom: `1px solid ${border}`,
          display: "flex", alignItems: "center",
          padding: "0 28px", gap: 10, opacity: bgOpacity, fontFamily: ff,
          transform: "translateZ(20px)",
        }}>
          <span style={{ color: muted, fontSize: 10, letterSpacing: "0.14em" }}>PANEL 1</span>
          <span style={{ color: border, fontSize: 10 }}>›</span>
          <span style={{ color: accentColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em" }}>{fnCode}</span>
          <div style={{ flex: 1 }} />
          <div style={{ width: 70, height: 5, backgroundColor: border }} />
        </div>

        {/* Command bar */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          transform: "translateY(-60%) translateZ(35px)",
          padding: "0 36px",
          display: "flex", flexDirection: "column", gap: 16,
          fontFamily: ff, opacity: bgOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ color: muted, fontSize: 18 }}>&gt;</span>
            <span style={{
              color: accentColor, fontWeight: 600,
              fontSize: 16, letterSpacing: "0.05em",
              overflow: "hidden", whiteSpace: "nowrap",
              textShadow: `0 0 14px ${accentColor}66`,
            }}>
              {cmd.slice(0, charsShown)}
              {cursorBlink && (
                <span style={{
                  display: "inline-block", width: 10, height: 16,
                  backgroundColor: accentColor, verticalAlign: "-3px", marginLeft: 2,
                }} />
              )}
            </span>
            <div style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 12px",
              backgroundColor: goPressed ? "#2fbf5f" : border,
              color: goPressed ? "#000" : muted,
              fontSize: 10, letterSpacing: "0.2em", fontWeight: 600,
              opacity: goAppear,
              boxShadow: goPressed ? "0 0 16px rgba(47,191,95,0.5)" : "none",
              transition: "background-color 0.1s, box-shadow 0.1s",
            }}>
              <span style={{ fontSize: 9 }}>◻</span> GO
            </div>
          </div>

          {nextScene?.title && (
            <div style={{
              color: muted,
              fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
              paddingLeft: 32,
              opacity: descOpacity,
              transform: `translateY(${descY}px)`,
              borderLeft: `2px solid ${border}`,
            }}>
              {nextScene.title.slice(0, 52)}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── [04] PRICE FLASH ─ "PUSH IN" smooth glow, no hard flash ─────────────────
// Replaces the jarring double-flash with a smooth amber bloom that expands
// and fades, then the content panel emerges from the center with a gentle
// 3D lift — like a card rising off a desk.
const PriceFlash: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  bgColor,
  fontFamily,
  nextScene,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const _bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(_bg, accentColor);

  // Camera push — spring from elevated angle to level
  const cameraSp = spring({ frame, fps, config: { stiffness: 30, damping: 14 } });
  const cameraScale = interpolate(cameraSp, [0, 1], [1.07, 1.0]);
  const cameraRotateX = interpolate(cameraSp, [0, 1], [6, 0]);

  const bgSp = spring({ frame, fps, config: { stiffness: 50, damping: 18 } });
  const bgOpacity = interpolate(bgSp, [0, 1], [0, 1]);

  // Amber bloom — spring-driven expansion (no hard cut)
  const bloomSp = spring({ frame, fps, config: { stiffness: 80, damping: 10 } });
  const bloomScale = interpolate(bloomSp, [0, 0.5, 1], [0, 2.0, 2.5]);
  const bloomOpacity = interpolate(bloomSp, [0, 0.15, 0.6, 1], [0, 0.45, 0.45, 0], { extrapolateRight: "clamp" });

  // Panel spring — rises from below with natural deceleration
  const panelSp = spring({ frame: Math.max(0, frame - 15), fps, config: { stiffness: 55, damping: 14 } });
  const panelOpacity = interpolate(panelSp, [0, 0.25, 1], [0, 0.7, 1], { extrapolateRight: "clamp" });
  const panelY = interpolate(panelSp, [0, 1], [30, 0]);
  const panelScale = interpolate(panelSp, [0, 1], [0.92, 1.0]);

  const tickerRows = (nextScene?.items?.length ?? 0) >= 2 ? nextScene!.items!.slice(0, 5) : [];
  const narrationStats = tickerRows.length < 2 ? extractNarrationNumbers(nextScene?.narration || "", 4) : [];
  const hasRows = tickerRows.length >= 2;
  const hasStats = narrationStats.length >= 1;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100, perspective: "1200px" }}>
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg)`,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundColor: _bg, opacity: bgOpacity * 0.9 }} />
        <Scanlines opacity={bgOpacity} color={accentColor} />

        {/* Amber bloom — smooth circular glow from center */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 200, height: 200,
          borderRadius: "50%",
          backgroundColor: accentColor,
          transform: `translate(-50%, -50%) scale(${bloomScale})`,
          opacity: bloomOpacity,
          filter: "blur(40px)",
          pointerEvents: "none",
        }} />

        {/* Content panel */}
        {hasRows && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: `translate(-50%, calc(-50% + ${panelY}px)) scale(${panelScale}) translateZ(30px)`,
            width: "58%", opacity: panelOpacity, fontFamily: ff,
            border: `1px solid ${border}`,
            backgroundColor: panelBg,
          }}>
            <div style={{
              borderBottom: `1px solid ${accentColor}55`,
              padding: "8px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: muted, fontSize: 9, letterSpacing: "0.2em" }}>
                SCRN — {(nextScene?.title || "MOVERS").toUpperCase().slice(0, 24)}
              </span>
              <span style={{ color: accentColor, fontSize: 9, letterSpacing: "0.12em" }}>
                {(nextScene?.layout || "").replace("terminal_", "").toUpperCase()}
              </span>
            </div>
            {tickerRows.map((row, i) => {
              const parts = row.split(/\s{2,}/);
              const sym = parts[0] || "";
              const pct = parts[1] || "";
              const price = parts[2] || "";
              const isPos = !pct.startsWith("-");
              const rowReveal = interpolate(frame, [32 + i * 6, 46 + i * 6], [0, 1], {
                extrapolateRight: "clamp",
                easing: easeOutCubic,
              });
              const rowY = interpolate(frame, [32 + i * 6, 46 + i * 6], [10, 0], {
                extrapolateRight: "clamp",
                easing: easeOutCubic,
              });
              return (
                <div key={i} style={{
                  padding: "10px 16px",
                  borderBottom: i < tickerRows.length - 1 ? `1px solid ${border}` : "none",
                  display: "flex", alignItems: "center", gap: 14,
                  opacity: rowReveal,
                  transform: `translateY(${rowY}px)`,
                }}>
                  <span style={{ color: accentColor, fontSize: 12, fontWeight: 700, fontFamily: ff, minWidth: 52 }}>{sym}</span>
                  <span style={{ color: isPos ? "#4ADE80" : BLOOMBERG_COLORS.neg, fontSize: 12, fontFamily: ff, minWidth: 64 }}>{pct}</span>
                  <span style={{ color: muted, fontSize: 10, fontFamily: ff, marginLeft: "auto" }}>{price}</span>
                </div>
              );
            })}
          </div>
        )}

        {!hasRows && hasStats && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: `translate(-50%, calc(-50% + ${panelY}px)) scale(${panelScale}) translateZ(30px)`,
            opacity: panelOpacity, fontFamily: ff,
            display: "flex", gap: 14,
            border: `1px solid ${border}`,
            backgroundColor: panelBg,
          }}>
            <div style={{
              position: "absolute", top: -32, left: 0, right: 0,
              color: muted, fontSize: 9, letterSpacing: "0.16em",
              textTransform: "uppercase", fontFamily: ff,
            }}>
              {(nextScene?.title || "").toUpperCase().slice(0, 40)}
            </div>
            {narrationStats.map((s, i) => {
              const rowReveal = interpolate(frame, [32 + i * 7, 48 + i * 7], [0, 1], {
                extrapolateRight: "clamp",
                easing: easeOutCubic,
              });
              return (
                <div key={i} style={{
                  padding: "18px 20px", minWidth: 90, textAlign: "center", opacity: rowReveal,
                  borderRight: i < narrationStats.length - 1 ? `1px solid ${border}` : "none",
                }}>
                  <div style={{ color: accentColor, fontSize: 22, fontWeight: 700, fontFamily: ff, fontVariantNumeric: "tabular-nums" }}>
                    {s.val}{s.unit}
                  </div>
                  <div style={{ color: muted, fontSize: 8, letterSpacing: "0.18em", marginTop: 6 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {!hasRows && !hasStats && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: `translate(-50%, calc(-50% + ${panelY}px)) scale(${panelScale}) translateZ(30px)`,
            opacity: panelOpacity, fontFamily: ff,
            border: `2px solid ${accentColor}`,
            backgroundColor: "#000",
            padding: "14px 28px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{ color: accentColor, fontSize: 9, letterSpacing: "0.2em" }}>
              {(nextScene?.layout || "").replace("terminal_", "").toUpperCase() || "NEXT"}
            </div>
            <div style={{ color: "#e8e0cf", fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", maxWidth: 280, textAlign: "center" }}>
              {(nextScene?.title || "").toUpperCase().slice(0, 36)}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── [05] COLUMN SHUTTER ─ "VENETIAN BLIND" with depth ───────────────────────
// Columns now open/close with a 3D perspective as if they are actual physical
// blinds swiveling on an axis. Camera itself has a very slight counter-roll to
// reinforce the sense of depth and weight.
const ColumnShutter: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  bgColor,
  fontFamily,
  nextScene,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const _bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(_bg, accentColor);

  // Spring-driven camera settle — slight roll straightens out as blinds fall
  const cameraSp = spring({ frame, fps, config: { stiffness: 25, damping: 14 } });
  const cameraRotateZ = interpolate(cameraSp, [0, 0.5, 1], [0.6, 0.1, 0]);
  const cameraScale = interpolate(cameraSp, [0, 1], [1.04, 1.0]);

  // Columns progress — smooth cubic interpolation over 60% of duration
  const progress = interpolate(frame, [0, durationInFrames * 0.62], [0, 1], {
    extrapolateRight: "clamp",
    easing: easeInOutQuart,
  });

  const headerRow = nextScene?.items?.[0] || "";
  const rawCols = headerRow ? headerRow.split("|").map((c) => c.trim()).filter(Boolean) : [];
  const totalCols = Math.max(rawCols.length || 0, 8);

  const tableReveal = interpolate(frame, [durationInFrames * 0.62, durationInFrames * 0.84], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });
  const tableY = interpolate(frame, [durationInFrames * 0.62, durationInFrames * 0.84], [18, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });

  const dataRows = (nextScene?.items || []).slice(1, 3);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100, perspective: "1200px" }}>
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `scale(${cameraScale}) rotateZ(${cameraRotateZ}deg)`,
      }}>
        {/* Shutter columns */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {Array.from({ length: totalCols }).map((_, i) => {
            const fromTop = i % 2 === 0;
            const colLabel = rawCols[i] || "";

            // Stagger each column slightly for a more organic feel
            const colStagger = i * 0.018;
            const colProgress = Math.min(1, Math.max(0, progress - colStagger) / (1 - colStagger * totalCols * 0.5));
            const easedColProgress = colProgress < 0.5
              ? 4 * colProgress ** 3
              : 1 - Math.pow(-2 * colProgress + 2, 3) / 2;

            const labelReveal = interpolate(frame, [durationInFrames * 0.32, durationInFrames * 0.56], [0, 1], {
              extrapolateRight: "clamp", extrapolateLeft: "clamp",
              easing: easeOutCubic,
            });

            return (
              <div key={i} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute",
                  left: 0, right: 0,
                  top: fromTop ? 0 : "auto",
                  bottom: fromTop ? "auto" : 0,
                  height: `${easedColProgress * 100}%`,
                  backgroundColor: accentColor,
                  opacity: 0.95,
                  display: "flex",
                  alignItems: fromTop ? "flex-end" : "flex-start",
                  justifyContent: "center",
                  paddingBottom: fromTop ? 6 : 0,
                  paddingTop: fromTop ? 0 : 6,
                  // Each column has a subtle scaleX breathing — venetian blind wobble
                  transform: `scaleX(${1 - 0.04 * Math.abs(Math.sin(frame / 6 + i))})`,
                  transformOrigin: "center",
                }}>
                  {colLabel && easedColProgress > 0.25 && (
                    <span style={{
                      color: _bg, fontSize: 8, fontWeight: 700,
                      fontFamily: ff, letterSpacing: "0.14em",
                      textTransform: "uppercase", writingMode: "vertical-rl",
                      opacity: labelReveal,
                    }}>
                      {colLabel.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Table data rows revealed after shutter closes */}
        {(rawCols.length > 0 || dataRows.length > 0) && tableReveal > 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: `translate(-50%, calc(-50% + ${tableY}px)) translateZ(20px)`,
            width: "74%", opacity: tableReveal, fontFamily: ff,
            backgroundColor: "#050505",
            border: `1px solid ${border}`,
          }}>
            {rawCols.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${rawCols.length}, 1fr)`,
                borderBottom: `2px solid ${accentColor}`,
                padding: "6px 14px",
                gap: 8,
              }}>
                {rawCols.map((col, j) => (
                  <span key={j} style={{
                    color: accentColor, fontSize: 9,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    fontFamily: ff, fontWeight: 600,
                  }}>
                    {col.slice(0, 12)}
                  </span>
                ))}
              </div>
            )}
            {dataRows.map((row, ri) => {
              const cells = row.split("|").map((c) => c.trim());
              const rowOpacity = interpolate(frame, [
                durationInFrames * 0.66 + ri * 9,
                durationInFrames * 0.82 + ri * 9,
              ], [0, 1], { extrapolateRight: "clamp", easing: easeOutCubic });
              const rowY2 = interpolate(frame, [
                durationInFrames * 0.66 + ri * 9,
                durationInFrames * 0.82 + ri * 9,
              ], [8, 0], { extrapolateRight: "clamp", easing: easeOutCubic });
              return (
                <div key={ri} style={{
                  display: "grid",
                  gridTemplateColumns: rawCols.length > 0 ? `repeat(${rawCols.length}, 1fr)` : "1fr",
                  padding: "8px 14px", gap: 8,
                  borderBottom: ri === 0 ? `1px dashed ${border}` : "none",
                  opacity: rowOpacity,
                  transform: `translateY(${rowY2}px)`,
                }}>
                  {(rawCols.length > 0 ? cells.slice(0, rawCols.length) : cells).map((cell, j) => (
                    <span key={j} style={{
                      color: j === 0 ? "#e8e0cf" : muted,
                      fontSize: 10, fontFamily: ff,
                    }}>
                      {cell.slice(0, 16)}
                    </span>
                  ))}
                </div>
              );
            })}
            {rawCols.length === 0 && dataRows.length === 0 && nextScene?.title && (
              <div style={{ padding: "12px 16px", color: muted, fontSize: 10, fontFamily: ff }}>
                {nextScene.title.toUpperCase().slice(0, 40)}
              </div>
            )}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── [06] PHOSPHOR SLIDE ─ "SWEEPING CRANE SHOT" ─────────────────────────────
// The amber band sweeps while the camera performs a gentle crane movement —
// a slow downward tilt combined with a lateral drift. The title and stat are
// on separate depth planes (different translateZ) creating a parallax split.
const PhosphorSlide: React.FC<BloombergTransitionProps> = ({
  accentColor = BLOOMBERG_COLORS.amber,
  bgColor,
  fontFamily,
  nextScene,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const ff = fontFamily || BLOOMBERG_DEFAULT_FONT_FAMILY;
  const _bg = bgColor || BLOOMBERG_COLORS.bg;
  const { panelBg, headerBg, border, muted } = derivePalette(_bg, accentColor);

  // Camera crane — very slow spring, settles well past the transition end
  // so the movement feels continuous and unresolved (like a real crane shot)
  const craneSp = spring({ frame, fps, config: { stiffness: 18, damping: 12 } });
  const cameraRotateX = interpolate(craneSp, [0, 1], [4, -2]);
  const cameraTranslateY = interpolate(craneSp, [0, 1], [-8, 8]);
  const cameraTranslateX = interpolate(craneSp, [0, 1], [0, -10]);

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
    easing: easeInOutCubic,
  });
  const bgSp = spring({ frame, fps, config: { stiffness: 45, damping: 18 } });
  const bgOpacity = interpolate(bgSp, [0, 1], [0, 1]);

  // Band sweeps with smooth velocity — starts fast, decelerates
  const bandX = progress * 112 - 6;

  const titleOpacity = interpolate(frame, [durationInFrames * 0.25, durationInFrames * 0.55], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });
  const titleY = interpolate(frame, [durationInFrames * 0.25, durationInFrames * 0.55], [16, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });

  const stat = extractNarrationNumbers(nextScene?.narration || "", 1)[0];
  const statOpacity = interpolate(frame, [durationInFrames * 0.48, durationInFrames * 0.74], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });
  const statY = interpolate(frame, [durationInFrames * 0.48, durationInFrames * 0.74], [20, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
    easing: easeOutCubic,
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100, perspective: "1400px" }}>
      <div style={{
        position: "absolute", inset: 0,
        transformStyle: "preserve-3d",
        transform: `rotateX(${cameraRotateX}deg) translateY(${cameraTranslateY}px) translateX(${cameraTranslateX}px)`,
      }}>
        {/* Dark background layer — furthest back */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundColor: _bg, opacity: bgOpacity * 0.9,
          transform: "translateZ(-10px)",
        }} />

        {/* Amber sweep band — mid depth */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${bandX}%`, width: 14,
          backgroundColor: accentColor,
          boxShadow: `0 0 50px 18px ${accentColor}99, 0 0 120px 40px ${accentColor}33`,
          transform: "translateZ(0px)",
        }} />
        {/* Soft halo trailing the band */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${bandX - 3}%`, width: 40,
          background: `linear-gradient(90deg, transparent, ${accentColor}22, transparent)`,
          transform: "translateZ(0px)",
        }} />

        {/* Title — forward plane, elevated Z so it's "in front" of the band */}
        {nextScene?.title && (
          <div style={{
            position: "absolute", top: "50%", left: 0, right: 0,
            transform: `translateY(calc(-50% + ${titleY}px)) translateZ(40px)`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
            opacity: titleOpacity, fontFamily: ff,
          }}>
            <div style={{
              color: accentColor, fontSize: 18, fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              textShadow: `0 0 24px ${accentColor}66`,
              maxWidth: "70%", textAlign: "center",
            }}>
              {nextScene.title.toUpperCase().slice(0, 48)}
            </div>

            {stat && (
              <div style={{
                opacity: statOpacity,
                transform: `translateY(${statY}px) translateZ(15px)`,
                textAlign: "center",
              }}>
                <div style={{
                  color: accentColor, fontSize: 28, fontWeight: 700,
                  letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums",
                  textShadow: `0 0 16px ${accentColor}44`,
                }}>
                  {stat.val}{stat.unit}
                </div>
                <div style={{ color: muted, fontSize: 9, letterSpacing: "0.2em", marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Legacy aliases ───────────────────────────────────────────────────────────
const ScanlineWipe: React.FC<BloombergTransitionProps> = (props) => <NewsWire {...props} />;
const PixelDissolve: React.FC<BloombergTransitionProps> = (props) => <PanelRefresh {...props} />;

// ─── Dispatcher ──────────────────────────────────────────────────────────────
export const BloombergTransition: React.FC<BloombergTransitionProps> = (props) => {
  switch (props.variant) {
    case "news_wire":
    case "scanline_wipe":
      return <NewsWire {...props} />;
    case "panel_refresh":
    case "pixel_dissolve":
      return <PanelRefresh {...props} />;
    case "price_flash":
      return <PriceFlash {...props} />;
    case "command_prompt":
      return <CommandPrompt {...props} />;
    case "column_shutter":
      return <ColumnShutter {...props} />;
    case "phosphor_slide":
    default:
      return <PhosphorSlide {...props} />;
  }
};

export { ScanlineWipe, PixelDissolve };
