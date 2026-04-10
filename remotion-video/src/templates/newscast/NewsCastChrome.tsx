import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DEFAULT_NEWSCAST_ACCENT,
  DEFAULT_NEWSCAST_TEXT,
  getNewscastPortraitTypeScale,
  newscastFont,
  scaleNewscastPx,
  toRgba,
} from "./themeUtils";

const GOLD = "#D4AA50";
const TICKER_BG = "rgba(10,42,110,0.9)";

function formatDateParts(d: Date) {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return { day, mon, year, hh, mm, ss };
}

export const NewsCastChrome: React.FC<{
  tickerItems?: string[];
  lowerThirdTag?: string;
  lowerThirdHeadline?: string;
  lowerThirdSub?: string;
  showLowerThird?: boolean;
  accentColor?: string;
  textColor?: string;
  descriptionFontSize?: number;
  fontFamily?: string;
}> = ({
  tickerItems,
  lowerThirdTag,
  lowerThirdHeadline,
  lowerThirdSub,
  showLowerThird = true,
  accentColor,
  textColor,
  descriptionFontSize: _descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const portraitScale = getNewscastPortraitTypeScale(width, height);
  const tickerH = Math.max(30, Math.ceil(30 * portraitScale));
  const lowerThirdBottom = 36 + (tickerH - 30);

  const startTime = useMemo(() => new Date(), []);
  const elapsedSeconds = frame / fps;
  const now = new Date(startTime.getTime() + elapsedSeconds * 1000);
  const parts = formatDateParts(now);
  const timestamp = `${parts.day} ${parts.mon} ${parts.year} · ${parts.hh}:${parts.mm}:${parts.ss} GMT`;

  const liveBlink = interpolate((frame % fps) / fps, [0, 0.5, 1], [1, 0.2, 1], { extrapolateRight: "clamp" });

  const safeTicker = useMemo(() => tickerItems?.filter(Boolean) ?? [], [tickerItems]);
  const tickerLoop = safeTicker.length ? [...safeTicker, ...safeTicker] : ["LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS", "LIVE BREAKING FEED", "LATEST UPDATES", "OFFICIAL CONFIRMATIONS"];

  const loopFrames = Math.max(30, Math.round(10 * fps));
  const progress = ((frame % loopFrames) / loopFrames) * 100;

  const sep = "◆";
  const RED = accentColor || DEFAULT_NEWSCAST_ACCENT;
  const STEEL = textColor || DEFAULT_NEWSCAST_TEXT;
  const display13 = scaleNewscastPx(13, portraitScale);
  const display12 = scaleNewscastPx(12, portraitScale);
  const display10 = scaleNewscastPx(10, portraitScale);
  const display9 = scaleNewscastPx(9, portraitScale);
  const channelWordmark = scaleNewscastPx(22, portraitScale);
  const lowerThirdTitle = scaleNewscastPx(22, portraitScale);
  const padLowerThird = `${scaleNewscastPx(8, portraitScale)}px ${scaleNewscastPx(16, portraitScale)}px ${scaleNewscastPx(10, portraitScale)}px`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 999 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&family=Barlow+Condensed:wght@300;400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');`}</style>

      {/* Outer metal frame */}
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
        }}
      />

      {/* Red band */}
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

      {/* Side bands */}
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

      {/* Corner chrome */}
      {(["tl", "tr", "bl", "br"] as const).map((pos) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
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
            transform: pos === "tr" ? "scaleX(-1)" : pos === "bl" ? "scaleY(-1)" : pos === "br" ? "scale(-1)" : undefined,
          }}
        >
          <svg viewBox="0 0 50 50" width="100%" height="100%" fill="none">
            <path d="M0,50 L0,5 Q0,0 5,0 L50,0" stroke="rgba(200,220,255,0.75)" strokeWidth="2.5" opacity="0.8" />
          </svg>
        </div>
      ))}

      {/* LIVE badge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 14,
          right: 60,
          zIndex: 25,
          background: RED,
          padding: "4px 12px",
          borderRadius: 2,
          boxShadow: `0 0 16px ${toRgba(RED, 0.5)}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white", opacity: liveBlink }} />
        <div style={{ fontFamily: newscastFont(fontFamily, "title"), fontSize: display13, fontWeight: 700, letterSpacing: 3, color: "white" }}>LIVE</div>
      </div>

      {/* Timestamp */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 25,
          fontFamily: newscastFont(fontFamily, "label"),
          fontSize: display13,
          letterSpacing: 1,
          borderLeft: "2px solid #3A7FFF",
          padding: "3px 8px",
          background: "rgba(6,6,20,0.6)",
          color: STEEL,
        }}
      >
        {timestamp}
      </div>

      {/* Channel logo */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 25,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: newscastFont(fontFamily, "title"), fontSize: channelWordmark, fontWeight: 700, letterSpacing: 6, color: "white", textShadow: "0 0 20px rgba(100,150,255,0.4)" }}>
          WORLD NEWS
        </div>
        <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: display9, fontWeight: 500, letterSpacing: 4, color: "#7A9AB8", marginTop: -2, textTransform: "uppercase" }}>
          NETWORK · BROADCAST SYSTEM
        </div>
      </div>

      {/* Ticker */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: tickerH,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            background: RED,
            fontFamily: newscastFont(fontFamily, "title"),
            fontSize: display12,
            fontWeight: 700,
            letterSpacing: 2,
            color: "white",
            borderRight: `2px solid ${GOLD}`,
            textTransform: "uppercase",
            zIndex: 2,
          }}
        >
          BREAKING
        </div>
        <div style={{ flex: 1, height: "100%", background: TICKER_BG, borderTop: "1px solid rgba(200,220,255,0.3)", overflow: "hidden", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              transform: `translateY(-50%) translateX(${(width * 1.05 * (progress / 100)) * -1}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              whiteSpace: "nowrap",
              fontFamily: newscastFont(fontFamily, "body"),
              fontSize: display13,
              fontWeight: 500,
              color: "#E8EFF8",
            }}
          >
            {tickerLoop.map((txt, idx) => (
              <React.Fragment key={`${txt}-${idx}`}>
                {idx !== 0 ? <span style={{ color: RED, fontWeight: 700, fontSize: display12, padding: "0 6px" }}>{sep}</span> : null}
                <span>{txt}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {showLowerThird ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: lowerThirdBottom,
            left: 0,
            right: 0,
            zIndex: 25,
            padding: "0 20px",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              width: "58%",
              maxWidth: "58%",
              background: "linear-gradient(90deg, rgba(10,42,110,0.9) 0%, rgba(10,42,110,0.85) 60%, rgba(10,42,110,0.5) 85%, transparent 100%)",
              borderTop: `2px solid ${RED}`,
              borderLeft: `4px solid ${RED}`,
              backdropFilter: "blur(4px)",
              padding: padLowerThird,
              position: "relative",
              overflow: "visible",
            }}
          >
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ fontFamily: newscastFont(fontFamily, "title"), fontSize: display10, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: "#F0CC70" }}>
                  {lowerThirdTag ?? "LIVE COVERAGE"}
                </div>
                <div style={{ width: 4, height: 4, borderRadius: 999, background: "rgba(200,220,255,0.3)" }} />
                <div style={{ fontFamily: newscastFont(fontFamily, "label"), fontSize: display10, letterSpacing: 2, color: "#7A9AB8", textTransform: "uppercase" }}>
                  {lowerThirdHeadline ? "SPECIAL REPORT" : "Special Report"}
                </div>
              </div>
              <div style={{ fontFamily: newscastFont(fontFamily, "title"), fontSize: lowerThirdTitle, fontWeight: 700, color: "white", textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.1, marginBottom: 4 }}>
                {lowerThirdHeadline ?? "Correspondent Report"}
              </div>
              <div style={{ fontFamily: newscastFont(fontFamily, "body"), fontSize: display13, fontWeight: 400, color: STEEL, letterSpacing: 0.3 }}>
                {lowerThirdSub ?? "Reporting live from the broadcast desk"}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

