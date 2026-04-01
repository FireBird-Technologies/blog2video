import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { NewscastLayoutProps } from "./types";
import { NewsCastLayoutImageBackground } from "../NewsCastLayoutImageBackground";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  resolveNewscastDescriptionSize,
  resolveNewscastTitleSize,
  scaleNewscastPx,
  toRgba,
} from "../themeUtils";
import {
  HEADLINE_WEIGHT,
  headlinePop,
  headlinePopStyle,
  headlineTextShadow,
  headlineTextShadowFor,
  panelTumbleStyle,
  panelTumbleUp,
} from "../newscastLayoutMotion";

const GOLD = "#D4AA50";

function splitTitleForAccent(title: string) {
  const words = (title || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { white: words[0] ?? "", red: "" };
  return { white: words.slice(0, -1).join(" "), red: words[words.length - 1] };
}

export const CinematicTitle: React.FC<NewscastLayoutProps> = ({
  title,
  narration,
  imageUrl,
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  accentColor,
  textColor,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const heroBarH = Math.max(36, Math.ceil(36 * portraitScale));
  const heroTickerBottomPad = 36 + (heroBarH - 36);
  const fadeIn = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });

  const { white, red } = splitTitleForAccent(title);
  const safeTicker = useMemo(() => (tickerItems?.filter(Boolean) ?? []).slice(0, 8), [tickerItems]);

  const hasBgImage = Boolean(imageUrl?.trim());
  const heroTumble = panelTumbleUp(frame, 0);
  const heroTitlePop = headlinePop(frame, 6);
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;
  const shadows = headlineTextShadowFor(RED);

  // Hero needs to be self-contained: include ticker + lower-third + chrome-like bands.
  return (
    <AbsoluteFill style={{ backgroundColor: hasBgImage ? "transparent" : "#060614", overflow: "hidden" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Barlow+Condensed:wght@300;400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');
        `}
      </style>
      {/* Optional full-bleed plate under globe/grid (same as other NEWSCAST layouts). */}
      <NewsCastLayoutImageBackground imageUrl={imageUrl} accentColor={RED} />

      {/* Animated scan line (subtle) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 2,
          top: `${Math.min(100, Math.max(0, (frame / 220) * 120 - 10))}%`,
          background: "linear-gradient(90deg, transparent, rgba(30,95,212,0.15), rgba(30,95,212,0.45), rgba(30,95,212,0.15), transparent)",
          opacity: fadeIn,
          zIndex: 3,
          pointerEvents: "none",
        }}
      />

      {/* Metallic emboss frame */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          border: "3px solid transparent",
          background:
            "linear-gradient(135deg, rgba(200,220,255,0.6) 0%, rgba(100,150,220,0.2) 25%, rgba(50,80,160,0.1) 50%, rgba(100,150,220,0.2) 75%, rgba(200,220,255,0.5) 100%) border-box",
          boxShadow: "inset 0 0 70px rgba(0,0,0,0.45)",
          zIndex: 10,
          pointerEvents: "none",
        }}
      />

      {/* Red band + side bands */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${toRgba(RED, 0.5)}, ${RED} 50%, ${toRgba(RED, 0.5)})`,
          boxShadow: `0 0 12px ${toRgba(RED, 0.6)}`,
          zIndex: 15,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: `linear-gradient(to bottom, ${RED}, transparent 40%, transparent 60%, ${RED})`,
          zIndex: 12,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 4,
          background: `linear-gradient(to bottom, ${RED}, transparent 40%, transparent 60%, ${RED})`,
          zIndex: 12,
        }}
      />

      {/* Corner chrome arcs */}
      {(["tl", "tr", "bl", "br"] as const).map((pos) => (
        <div
          key={pos}
          aria-hidden
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            zIndex: 20,
            ...(pos === "tl" ? { top: 4, left: 4 } : null),
            ...(pos === "tr" ? { top: 4, right: 4 } : null),
            ...(pos === "bl" ? { bottom: 4, left: 4 } : null),
            ...(pos === "br" ? { bottom: 4, right: 4 } : null),
            transform:
              pos === "tr"
                ? "scaleX(-1)"
                : pos === "bl"
                  ? "scaleY(-1)"
                  : pos === "br"
                    ? "scale(-1)"
                    : undefined,
            pointerEvents: "none",
          }}
        >
          <svg viewBox="0 0 50 50" width="100%" height="100%" fill="none">
            <path
              d="M0,50 L0,5 Q0,0 5,0 L50,0"
              stroke="rgba(200,220,255,0.75)"
              strokeWidth="2.5"
              opacity="0.8"
            />
          </svg>
        </div>
      ))}

      {/* Top bar (matches your hero snippet layout) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          background: "rgba(3,3,15,0.7)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(200,220,255,0.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: "1.5px solid rgba(200,220,255,0.4)",
                borderRadius: "50%",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "60%",
                  height: 1,
                  background: "rgba(200,220,255,0.4)",
                  transform: "rotate(-25deg)",
                  left: "20%",
                  top: "50%",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: "50%",
                  height: "50%",
                  borderRadius: "50%",
                  border: "1px solid rgba(200,220,255,0.3)",
                  left: "25%",
                  top: "25%",
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: scaleNewscastPx(15, portraitScale),
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: "white",
                }}
              >
                WORLD NEWS
              </div>
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(9, portraitScale),
                  letterSpacing: 3,
                  color: "#7A9AB8",
                  textTransform: "uppercase",
                  marginTop: -2,
                }}
              >
                Network · Est. 1988
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontFamily: newscastFont(fontFamily, "label"),
              fontSize: scaleNewscastPx(12, portraitScale),
              fontWeight: 500,
              letterSpacing: 1,
              color: "#7A9AB8",
              borderLeft: "2px solid #3A7FFF",
              paddingLeft: 10,
            }}
          >
            {/* Static render-time placeholder; NewsCastChrome provides accurate formatting elsewhere */}
            30 MAR 2026 · 00:00:00 GMT
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: RED,
              padding: "3px 10px 3px 8px",
              borderRadius: 2,
              boxShadow: "0 0 12px rgba(232,32,32,0.4)",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "white",
                opacity: 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2)),
              }}
            />
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: scaleNewscastPx(11, portraitScale),
                fontWeight: 700,
                letterSpacing: 3,
                color: "white",
              }}
            >
              LIVE
            </div>
          </div>
        </div>
      </div>

      {/* Channel bar */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 44,
          left: 0,
          right: 0,
          height: heroBarH,
          zIndex: 45,
          background: "rgba(10,42,110,0.6)",
          borderBottom: "1px solid rgba(200,220,255,0.1)",
          backdropFilter: "blur(4px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 1,
            background:
              `linear-gradient(90deg, ${RED} 0%, #D4AA50 30%, #1E5FD4 70%, ${RED} 100%)`,
          }}
        />
        <div style={{ display: "flex", height: "100%", alignItems: "stretch" }}>
          <div
            style={{
              background: RED,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: scaleNewscastPx(11, portraitScale),
              fontWeight: 700,
              letterSpacing: 2.5,
              color: "white",
              borderRight: "2px solid #D4AA50",
              flexShrink: 0,
            }}
          >
            BREAKING
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 8px", overflow: "hidden" }}>
            {["Climate Accord", "Markets", "G20 Summit", "Middle East", "Tech Policy", "Space"].map((t, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                style={{
                  fontFamily: newscastFont(fontFamily, "body"),
                  fontSize: scaleNewscastPx(12, portraitScale),
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: i === 0 ? RED : STEEL,
                  padding: "0 12px",
                  height: heroBarH,
                  display: "flex",
                  alignItems: "center",
                  borderRight: "1px solid rgba(200,220,255,0.07)",
                  whiteSpace: "nowrap",
                }}
              >
                {t}
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                gap: 8,
                borderLeft: "1px solid rgba(200,220,255,0.1)",
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#D4AA50" }} />
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(11, portraitScale),
                  letterSpacing: 2,
                  color: "#7A9AB8",
                  textTransform: "uppercase",
                }}
              >
                World Edition
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main hero content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          padding: "6% 6% 7% 6%",
          ...panelTumbleStyle(heroTumble),
          opacity: fadeIn * heroTumble.opacity,
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: RED,
                color: "#fff",
                fontWeight: 900,
                letterSpacing: "0.08em",
                padding: "8px 12px 8px 10px",
                borderRadius: 2,
                fontSize: scaleNewscastPx(14, portraitScale),
                textTransform: "uppercase",
                clipPath: "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%)",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "white",
                  opacity: 0.2 + 0.8 * (0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2)),
                }}
              />
              Breaking News
            </div>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "label"),
                fontSize: scaleNewscastPx(12, portraitScale),
                fontWeight: 600,
                letterSpacing: 3,
                color: "#7A9AB8",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ width: 20, height: 1, background: "rgba(200,220,255,0.3)" }} />
              World Affairs · Geneva
            </div>
          </div>

          <h1
            style={{
              fontFamily: newscastFont(fontFamily, "title"),
              fontSize: resolveNewscastTitleSize(titleFontSize, 72, portraitScale),
              fontWeight: HEADLINE_WEIGHT,
              textTransform: "uppercase",
              letterSpacing: 1,
              lineHeight: 1.05,
              marginBottom: 6,
              color: "white",
              textShadow: shadows.strong,
              ...headlinePopStyle(heroTitlePop),
            }}
          >
            {white} <span style={{ color: RED }}>{red}</span>
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "16px 0 18px" }}>
            <div
              style={{
                flex: 1,
                height: 1,
                background: `linear-gradient(90deg, ${RED} 0%, #D4AA50 40%, rgba(200,220,255,0.2) 100%)`,
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                background: GOLD,
                transform: "rotate(45deg)",
                margin: "0 10px",
                boxShadow: "0 0 8px rgba(212,170,80,0.6)",
              }}
            />
          </div>

          {narration ? (
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 18, portraitScale),
                fontWeight: 400,
                lineHeight: 1.65,
                color: STEEL,
                marginBottom: 28,
                maxWidth: "90%",
              }}
            >
              {narration}
            </div>
          ) : null}
        </div>
      </div>

      {/* Lower third strip */}
      <div style={{ position: "absolute", bottom: heroTickerBottomPad, left: 0, right: 0, zIndex: 40, padding: "0 20px" }}>
        <div
          style={{
            width: "58%",
            maxWidth: "58%",
            background:
              "linear-gradient(90deg, rgba(10,42,110,0.92) 0%, rgba(10,42,110,0.88) 55%, rgba(10,42,110,0.6) 80%, transparent 100%)",
            borderTop: `2px solid ${RED}`,
            borderLeft: `4px solid ${RED}`,
            backdropFilter: "blur(6px)",
            padding: `${scaleNewscastPx(10, portraitScale)}px ${scaleNewscastPx(20, portraitScale)}px ${scaleNewscastPx(12, portraitScale)}px`,
            position: "relative",
            overflow: "visible",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "title"),
                  fontSize: scaleNewscastPx(10, portraitScale),
                  fontWeight: 600,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: "#F0CC70",
                }}
              >
                {lowerThirdTag ?? "LIVE COVERAGE"}
              </div>
              <div style={{ width: 4, height: 4, borderRadius: 999, background: "rgba(200,220,255,0.3)" }} />
              <div
                style={{
                  fontFamily: newscastFont(fontFamily, "label"),
                  fontSize: scaleNewscastPx(10, portraitScale),
                  letterSpacing: 2,
                  color: "#7A9AB8",
                  textTransform: "uppercase",
                }}
              >
                Special Report
              </div>
            </div>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "title"),
                fontSize: scaleNewscastPx(24, portraitScale),
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "white",
                lineHeight: 1.1,
                marginBottom: 4,
              }}
            >
              {lowerThirdHeadline ?? "Correspondent Report"}
            </div>
            <div
              style={{
                fontFamily: newscastFont(fontFamily, "body"),
                fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale),
                fontWeight: 400,
                color: STEEL,
                letterSpacing: 0.3,
              }}
            >
              {lowerThirdSub ?? "Reporting live from the broadcast desk"}
            </div>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: heroBarH, zIndex: 50, display: "flex" }}>
        <div
          style={{
            flexShrink: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            background: RED,
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 13, portraitScale),
            fontWeight: 700,
            letterSpacing: 2.5,
            color: "white",
            borderRight: "2px solid #D4AA50",
          }}
        >
          BREAKING
        </div>
        <div
          style={{
            flex: 1,
            background: "rgba(6,6,20,0.92)",
            borderTop: "1px solid rgba(200,220,255,0.2)",
            height: "100%",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              display: "flex",
              alignItems: "center",
              height: "100%",
              left: 0,
              top: "50%",
              transform: `translateY(-50%) translateX(${-(progressTicker(frame) % 1) * 100}%)`,
              whiteSpace: "nowrap",
              gap: 0,
              fontFamily: newscastFont(fontFamily, "body"),
              fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 14, portraitScale),
              fontWeight: 500,
              color: STEEL,
              letterSpacing: 0.3,
              willChange: "transform",
            }}
          >
            {[
              ...(safeTicker.length ? safeTicker : ["JUST IN", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"]),
              ...(safeTicker.length ? safeTicker : ["JUST IN", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"]),
            ].map((txt, idx, arr) => (
              <React.Fragment key={`${txt}-${idx}`}>
                <span style={{ padding: "0 20px" }}>{txt}</span>
                {idx !== arr.length - 1 ? (
                  <span style={{ color: RED, fontWeight: 700, fontSize: resolveNewscastDescriptionSize(descriptionFontSize, 12, portraitScale), padding: "0 4px" }}>◆</span>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

function progressTicker(frame: number) {
  // Deterministic marquee progress approximation (0..1..2) based on frame.
  return (frame % 600) / 600;
}

