import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import type { WhiteboardLayoutProps } from "../types";

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
  const hasImage = !!imageUrl;

  const titleProgress = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textProgress = interpolate(frame, [14, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const doodleOp = interpolate(frame, [22, 42], [0, 1], { extrapolateRight: "clamp" });
  const lineProgress = interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" });

  const titleClipRight = 100 - titleProgress * 100;
  const textClipRight = 100 - textProgress * 100;

  // Doodle stroke dash
  const doodleDash = 500;
  const doodleOff = doodleDash * (1 - doodleOp);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive",
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.05" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="14" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain)" fill="white" />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: hasImage && !p ? "row" : "column",
          alignItems: hasImage && !p ? "stretch" : "center",
          justifyContent: "center",
          gap: hasImage ? (p ? 20 : 28) : 0,
          padding: p ? "8% 8%" : "6% 7%",
        }}
      >
        <div
          style={{
            flex: hasImage && !p ? "1 1 56%" : "none",
            width: hasImage && p ? "100%" : "auto",
          }}
        >
          {/* Title with clip reveal */}
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <div
              style={{
                color: textColor,
                fontSize: titleFontSize ?? (p ? 68 : 88),
                lineHeight: 1.03,
                fontWeight: 700,
                opacity: 0,
              }}
            >
              {title}
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: `inset(0 ${titleClipRight}% 0 0)`,
                color: textColor,
                fontSize: titleFontSize ?? (p ? 68 : 88),
                lineHeight: 1.03,
                fontWeight: 700,
                filter: "url(#ink)",
              }}
            >
              {title}
            </div>
          </div>

          {/* Wobbly accent underline */}
          <svg
            style={{ display: "block", width: p ? 220 : 320, height: 12, marginTop: 8 }}
            viewBox="0 0 320 12"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="inkLine2">
                <feTurbulence type="fractalNoise" baseFrequency="0.06 0.35" numOctaves="3" seed="3" result="w" />
                <feDisplacementMap in="SourceGraphic" in2="w" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <path
              d="M0,6 Q80,2 160,7 Q240,12 320,5"
              fill="none"
              stroke={accentColor}
              strokeWidth="8"
              strokeOpacity="0.2"
              strokeLinecap="round"
              filter="url(#inkLine2)"
              strokeDasharray={400}
              strokeDashoffset={400 * (1 - lineProgress)}
            />
            <path
              d="M0,6 Q80,2 160,7 Q240,12 320,5"
              fill="none"
              stroke={accentColor}
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#inkLine2)"
              strokeDasharray={400}
              strokeDashoffset={400 * (1 - lineProgress)}
            />
          </svg>

          {/* Body text with clip reveal */}
          <div
            style={{
              marginTop: 22,
              fontSize: descriptionFontSize ?? (p ? 30 : 40),
              lineHeight: 1.25,
              maxWidth: p ? "100%" : 820,
              position: "relative",
              color: textColor,
            }}
          >
            <div style={{ opacity: 0 }}>{narration}</div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: `inset(0 ${textClipRight}% 0 0)`,
                filter: "url(#ink)",
              }}
            >
              {narration}
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

      {/* Decorative marker doodles — bottom left corner */}
      <svg
        style={{
          position: "absolute",
          bottom: 80,
          left: 50,
          width: p ? "30%" : "22%",
          height: "auto",
          pointerEvents: "none",
        }}
        viewBox="0 0 280 200"
        fill="none"
      >
        <defs>
          <filter id="inkDoodle">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="17" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#inkDoodle)">
          {/* Swirl */}
          <path
            d="M60,180 C 80,140 120,130 130,150 C 140,170 110,190 90,175 C 70,160 95,140 115,150"
            stroke={accentColor}
            strokeWidth="6"
            strokeOpacity="0.22"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M60,180 C 80,140 120,130 130,150 C 140,170 110,190 90,175 C 70,160 95,140 115,150"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          {/* Arrow */}
          <path
            d="M150,160 Q210,140 240,150"
            stroke={textColor}
            strokeWidth="5"
            strokeOpacity="0.18"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M150,160 Q210,140 240,150"
            stroke={textColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          <path
            d="M226,140 L 240,150 L 226,162"
            stroke={textColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
          {/* Stars */}
          <path d="M30,100 L32,88 L40,96 L28,92 L44,90 Z" stroke={accentColor} strokeWidth="2.5" fill="none" strokeDasharray={doodleDash} strokeDashoffset={doodleOff} />
          <path d="M240,80 L242,70 L248,78 L238,74 L252,72 Z" stroke={textColor} strokeWidth="2" fill="none" strokeDasharray={doodleDash} strokeDashoffset={doodleOff} />
          {/* Stars cluster */}

          {/* Star 3 */}
          <path
            d="M120,90 L122,80 L130,88 L118,84 L134,82 Z"
            stroke={textColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />

          {/* Star 4 */}
          <path
            d="M200,60 L202,50 L210,58 L198,54 L214,52 Z"
            stroke={textColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />

          {/* Star 5 small sparkle */}
          <path
            d="M160,110 L162,104 L168,108 L158,106 L170,104 Z"
            stroke={accentColor}
            strokeWidth="1.8"
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />

          {/* Tiny cross sparkle */}
          <path
            d="M100,150 L100,160 M95,155 L105,155"
            stroke={textColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={doodleOff}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};