import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

const CHARS_PER_SEC = 30;
const FPS = 30;

/** Split narration into bullet lines: by newline, or by sentence (.) when single paragraph. */
function toBulletLines(narration: string): string[] {
  const raw = narration.trim();
  if (!raw) return [];
  const byNewline = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const bySentence = raw.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return bySentence.length > 1 ? bySentence : [raw];
}

export const MarkerStory: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  imageUrl,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
}) => {
  const frame = useCurrentFrame();
  const p = aspectRatio === "portrait";
  const doodleOp = interpolate(frame, [18, 38], [0, 1], { extrapolateRight: "clamp" });
  const hasImage = !!imageUrl;

  const bulletLines = toBulletLines(narration);
  const bulletedText = bulletLines.map((l) => `• ${l}`).join("\n");
  const titleDurationFrames = Math.ceil(title.length * (FPS / CHARS_PER_SEC));
  const titleChars = Math.min(title.length, Math.floor(interpolate(frame, [0, titleDurationFrames], [0, title.length], { extrapolateRight: "clamp" })));
  const totalBulletChars = bulletedText.length;
  const narrationStartFrame = 10 + titleDurationFrames;
  const narrationDurationFrames = Math.ceil(totalBulletChars * (FPS / CHARS_PER_SEC));
  const narrationChars = Math.min(totalBulletChars, Math.max(0, Math.floor(interpolate(frame, [narrationStartFrame, narrationStartFrame + narrationDurationFrames], [0, totalBulletChars], { extrapolateRight: "clamp" }))));

  const visibleTitle = title.slice(0, titleChars);
  const visibleNarration = bulletedText.slice(0, narrationChars);
  const narrationLines = visibleNarration.split("\n");

  const paperBg = "#E8DCC8";
  const paperBorder = "rgba(0,0,0,0.2)";
  const inkColor = "#2C2416";

  return (
    <AbsoluteFill style={{ overflow: "hidden", fontFamily: "Georgia, 'Times New Roman', Times, serif" }}>
      <WhiteboardBackground bgColor={bgColor} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: hasImage && !p ? "stretch" : "center",
          justifyContent: "center",
          gap: hasImage ? (p ? 20 : 26) : 0,
          padding: p ? "8% 8%" : "6% 7%",
        }}
      >
        <div style={{ flex: hasImage && !p ? "1 1 56%" : "none", width: hasImage && p ? "100%" : "auto", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {/* Newspaper-style panel */}
          <div
            style={{
              padding: p ? "20px 18px" : "24px 28px",
              backgroundColor: paperBg,
              border: `2px solid ${paperBorder}`,
              borderRadius: 2,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.4)",
              maxWidth: p ? "100%" : 820,
              position: "relative",
            }}
          >
            {/* Title as headline */}
            <div style={{ position: "relative", display: "inline-flex", flexWrap: "wrap", maxWidth: "100%" }}>
              <span
                style={{
                  color: inkColor,
                  fontSize: titleFontSize ?? (p ? 56 : 72),
                  lineHeight: 1.1,
                  fontWeight: 700,
                  fontFamily: "Georgia, 'Times New Roman', Times, serif",
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {visibleTitle}
              </span>
            </div>
            <div style={{ marginTop: 10, width: p ? 180 : 240, height: 2, backgroundColor: inkColor, opacity: 0.6 }} />
            {/* Body as bullet list, typewriter */}
            <div
              style={{
                marginTop: 16,
                color: inkColor,
                fontSize: descriptionFontSize ?? (p ? 26 : 32),
                lineHeight: 1.6,
                fontFamily: "Georgia, 'Times New Roman', Times, serif",
                listStyle: "none",
                paddingLeft: 0,
              }}
            >
              {narrationLines.map((line, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <span style={{ whiteSpace: "pre-wrap" }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasImage && (
          <div
            style={{
              flex: p ? "none" : "0 0 36%",
              width: p ? "100%" : "auto",
              minHeight: p ? 280 : 420,
              border: "4px solid rgba(0,0,0,0.45)",
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.7)",
              boxShadow: "0 8px 26px rgba(0,0,0,0.14)",
            }}
          >
            <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
      </div>

      <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: doodleOp }}>
        <path d="M120 160 C 220 130, 380 170, 460 140" stroke={accentColor} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M150 220 L 210 250 L 170 285" stroke={textColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
};
