import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { WhiteboardBackground } from "../WhiteboardBackground";
import { WhiteboardClip } from "../components/WhiteboardClip";
import type { WhiteboardLayoutProps } from "../types";

/**
 * Variant of MarkerStory ("Photo Panel").
 *
 * Unlike the other whiteboard variants this one differs in LAYOUT as well as
 * motion, so it reads as a distinct scene rather than a restyled one:
 *
 * - Image placement: the base insets a rounded photo card into a flex row
 *   (right of the text in landscape, stacked under it in portrait). Here the
 *   photo is a full-bleed panel pinned to the LEFT half in landscape and
 *   bannered across the TOP in portrait.
 * - Orientation: the copy is written on a PAGE — a ruled sheet of paper with a
 *   margin rule, laid on the board at a slight tilt — instead of sharing a flex
 *   row with the photo. Landscape anchors it to the edge opposite the image;
 *   portrait sits it directly below the banner so the copy reads high in frame.
 *   The page is present with or without an image, so both cases read the same.
 * - Motion: the photo wipes open first from its anchored edge, then the page
 *   slides in and settles out of its tilt, the rules ink on, and only then is
 *   the copy written — title word-by-word on a spring, underline RIGHT→LEFT,
 *   doodles staggered. Every beat after the photo is anchored to when the page
 *   lands, so a no-image scene plays the same sequence, just earlier.
 *
 * Because the image box is a different shape, this layout has its OWN entry in
 * `imageBoxConfig.ts` rather than inheriting the base's.
 */
export const MarkerStoryV2: React.FC<WhiteboardLayoutProps> = ({
  title,
  narration,
  imageUrl,
  imageObjectPosition,
  imageZoom,
  videoUrl,
  videoMuted,
  videoVolume,
  videoDurationInFrames,
  videoStartInFrames,
  accentColor,
  bgColor,
  textColor,
  aspectRatio,
  titleFontSize,
  descriptionFontSize,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = aspectRatio === "portrait";
  const hasImage = !!(imageUrl || videoUrl);

  const words = title.split(/(\s+)/);

  // Page treatment. The sheet is a touch lighter than the board so it reads as
  // paper laid on top, with faint blue-grey rules and a red margin rule.
  const PAGE_TINT = "#FFFDF6";
  const RULE_COLOR = "rgba(63,102,140,0.16)";
  const MARGIN_RULE = "rgba(190,80,70,0.30)";
  const RULE_GAP = p ? 46 : 40;

  // Portrait photo banner height, and where the page starts beneath it. Both
  // are percentages of frame HEIGHT — the page uses `top`, not padding, since
  // percentage padding would resolve against width instead.
  const PORTRAIT_BAND = "34%";
  const PORTRAIT_PAGE_TOP = "40%";

  // The photo panel wipes open FIRST, from its anchored edge, and the copy
  // lands on top of it afterwards — the reverse of the base layout, where the
  // text wipes in first beside a static image card.
  const imageReveal = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The page slides in from the edge it is anchored to. With an image it waits
  // for the photo wipe; without one it comes in almost immediately, so a
  // no-image scene still animates rather than appearing formed on frame 0.
  const cardStart = hasImage ? 18 : 2;
  const cardIn = interpolate(frame, [cardStart, cardStart + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardShift = interpolate(cardIn, [0, 1], [p ? 40 : 70, 0]);
  // The sheet settles out of a slight tilt as it lands.
  const pageTilt = interpolate(cardIn, [0, 1], [p ? -1.6 : -2.2, 0]);
  // Rules are inked onto the page just after it lands, before the copy starts.
  const rulesIn = interpolate(frame, [cardStart + 14, cardStart + 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Copy is written onto the page after the rules are inked. Every downstream
  // beat is anchored to `cardStart`, so the whole sequence shifts together in
  // the no-image case instead of the copy racing ahead of the page.
  const writeStart = cardStart + 30;
  const textProgress = interpolate(frame, [writeStart + 8, writeStart + 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textRise = interpolate(textProgress, [0, 1], [24, 0]);

  const doodleOp = interpolate(frame, [writeStart, writeStart + 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const lineProgress = interpolate(frame, [writeStart, writeStart + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Doodle stroke dash. Each doodle gets its own delayed progress so the
  // cluster assembles piece by piece.
  const doodleDash = 500;
  const staggeredOff = (delay: number) => {
    const t = interpolate(frame, [writeStart + delay, writeStart + 22 + delay], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return doodleDash * (1 - t);
  };

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        fontFamily: fontFamily ?? "'Patrick Hand', system-ui, sans-serif",
        letterSpacing: "1.5px"
      }}
    >
      <WhiteboardBackground bgColor={bgColor} />

      {/* Paper grain */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        <defs>
          <filter id="grain_msv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="linear" slope="0.05" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <filter id="ink_msv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="14" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#grain_msv2)" fill="none" />
      </svg>

      {/* IMAGE PANEL — full-bleed and edge-anchored, unlike the base layout's
          inset rounded card in a flex row. Landscape pins it to the LEFT half
          (the base puts its image right); portrait banners it across the TOP
          (the base stacks it under the text). The text card then overlaps it. */}
      {hasImage && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: p ? "100%" : "52%",
            height: p ? PORTRAIT_BAND : "100%",
            overflow: "hidden",
            zIndex: 1,
            // Reveal: the panel wipes open from the anchored edge.
            clipPath: p
              ? `inset(0 0 ${(1 - imageReveal) * 100}% 0)`
              : `inset(0 ${(1 - imageReveal) * 100}% 0 0)`,
          }}
        >
          {(() => {
            const visualStyle: React.CSSProperties = {
              width: "100%", height: "100%",
              objectFit: (imageZoom ?? 1) < 1 ? "contain" : "cover",
              objectPosition: (imageZoom ?? 1) < 1 ? "center" : (imageObjectPosition ?? "50% 50%"),
              transform: `scale(${imageZoom ?? 1})`,
              transformOrigin: (imageZoom ?? 1) < 1 ? "center center" : (imageObjectPosition ?? "50% 50%"),
            };
            return videoUrl ? (
              <WhiteboardClip
                src={videoUrl}
                imageObjectPosition={imageObjectPosition}
                imageZoom={imageZoom}
                muted={videoMuted ?? true}
                volume={videoVolume ?? 0.35}
                durationInFrames={videoDurationInFrames}
                startInFrames={videoStartInFrames}
                style={visualStyle}
              />
            ) : (
              <Img src={imageUrl!} style={visualStyle} />
            );
          })()}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          // NOTE: percentage PADDING resolves against the container's WIDTH,
          // even for padding-top. On a 720×1280 portrait frame a "39%" top pad
          // is 39% of 720 = 281px, not 499px — which rode the page up over the
          // photo. Portrait therefore positions with `top`, which does resolve
          // against height, and keeps padding to the horizontal axis only.
          top: p && hasImage ? PORTRAIT_PAGE_TOP : 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          // Text hugs the edge OPPOSITE the image panel.
          alignItems: hasImage && !p ? "flex-end" : "center",
          // Portrait: the page sits just BELOW the photo banner rather than
          // being pushed to the bottom of the frame, so the copy reads high and
          // the empty board shows beneath it instead of above it.
          justifyContent: hasImage && p ? "flex-start" : "center",
          padding: p ? (hasImage ? "0 8% 8% 8%" : "12% 8% 14% 8%") : "6% 5% 6% 7%",
          // Above the board, the photo panel and every decorative doodle.
          zIndex: 6,
        }}
      >
        {/* THE PAGE — a sheet of paper the copy is written on. Present whether
            or not there is an image, so the layout reads the same either way;
            without a photo it simply sits centred on the board. */}
        <div
          style={{
            position: "relative",
            width: hasImage && !p ? "46%" : p ? "100%" : "72%",
            zIndex: 2,
            // The page itself animates in — slides from the anchored edge and
            // settles out of a slight tilt, like a sheet being laid down.
            transform: `${
              p ? `translateY(${cardShift}px)` : `translateX(${cardShift}px)`
            } rotate(${pageTilt}deg)`,
            opacity: cardIn,
            transformOrigin: "center center",
            backgroundColor: PAGE_TINT,
            padding: p ? "40px 34px 46px 44px" : "44px 40px 48px 52px",
            // Stacked shadows read as a sheet lifted off the board with a
            // second page just under it.
            boxShadow:
              "0 1px 0 rgba(0,0,0,0.10), 0 10px 26px rgba(0,0,0,0.16), 6px 8px 0 -2px rgba(0,0,0,0.05)",
          }}
        >
          {/* Ruled lines + margin rule, drawn behind the copy so the text sits
              ON the page rather than floating above a plain block. */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent ${
                RULE_GAP - 1
              }px, ${RULE_COLOR} ${RULE_GAP - 1}px, ${RULE_COLOR} ${RULE_GAP}px)`,
              backgroundPositionY: p ? 38 : 42,
              opacity: rulesIn * 0.9,
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: p ? 26 : 32,
              width: 2,
              backgroundColor: MARGIN_RULE,
              opacity: rulesIn,
              pointerEvents: "none",
            }}
          />
          {/* Title — word-by-word spring drop */}
          <div
            style={{
              color: textColor,
              fontSize: titleFontSize ?? (p ? 70 : 63),
              lineHeight: 1.03,
              fontWeight: 700,
              filter: "url(#ink_msv2)",
            }}
          >
            {words.map((word, i) => {
              if (/^\s+$/.test(word)) return <span key={i}>{word}</span>;
              // Count only real words for the stagger index.
              const wordIndex = words.slice(0, i).filter((w) => !/^\s+$/.test(w)).length;
              const s = spring({
                frame: frame - writeStart - wordIndex * 3,
                fps,
                config: { damping: 14, mass: 0.6 },
              });
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: s,
                    transform: `translateY(${interpolate(s, [0, 1], [-38, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Wobbly accent underline — draws right→left */}
          <svg
            style={{ display: "block", width: p ? 220 : 320, height: 12, marginTop: 8 }}
            viewBox="0 0 320 12"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="inkLine2_msv2">
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
              filter="url(#inkLine2_msv2)"
              strokeDasharray={400}
              strokeDashoffset={-400 * (1 - lineProgress)}
            />
            <path
              d="M0,6 Q80,2 160,7 Q240,12 320,5"
              fill="none"
              stroke={accentColor}
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#inkLine2_msv2)"
              strokeDasharray={400}
              strokeDashoffset={-400 * (1 - lineProgress)}
            />
          </svg>

          {/* Portrait extra: Hand-drawn separator line */}
          {p && (
            <svg width="100%" height="40" style={{ marginTop: 20, opacity: doodleOp * 0.4 }}>
              <path
                d="M 10,20 Q 50,10 100,20 T 200,20 T 300,20"
                fill="none"
                stroke={textColor}
                strokeWidth="2"
                strokeDasharray="10 15"
              />
            </svg>
          )}

          {/* Body text — rises into place */}
          <div
            style={{
              marginTop: p ? 10 : 22,
              fontSize: descriptionFontSize ?? (p ? 36 : 28),
              lineHeight: 1.3,
              maxWidth: p ? "100%" : 820,
              color: textColor,
              opacity: textProgress,
              transform: `translateY(${textRise}px)`,
              filter: "url(#ink_msv2)",
            }}
          >
            {narration}
          </div>
        </div>

      </div>

      {/* Background filler for Portrait: Big Rough Circle/Splatter. With an
          image the photo banner takes the top 34% and the page runs to roughly
          72%, so this drops into the open board BELOW the page — anywhere
          higher and it would sit hidden behind the sheet. */}
      {p && (
        <svg
          style={{
            position: "absolute",
            top: hasImage ? "74%" : "45%",
            right: "-10%",
            width: "60%",
            opacity: 0.1,
            pointerEvents: "none",
            // Behind the page, so a page that grows tall covers it rather than
            // having the splatter show through the paper.
            zIndex: 2,
          }}
          viewBox="0 0 200 200"
        >
          <circle cx="100" cy="100" r="80" fill={accentColor} filter="url(#inkDoodle_msv2)" />
        </svg>
      )}

      {/* Decorative marker doodles — staggered pop-in. Kept on the side the
          photo panel does NOT occupy (bottom-right in landscape, bottom in
          portrait), otherwise the cluster would sit under the image. */}
      <svg
        style={{
          position: "absolute",
          bottom: p ? 24 : 40,
          left: hasImage && !p ? undefined : p ? 20 : 50,
          right: hasImage && !p ? 40 : undefined,
          width: p ? "45%" : "22%",
          height: "auto",
          pointerEvents: "none",
          zIndex: 2,
        }}
        viewBox="0 0 280 200"
        fill="none"
      >
        <defs>
          <filter id="inkDoodle_msv2">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="17" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#inkDoodle_msv2)">
          {/* Swirl */}
          <path
            d="M60,180 C 80,140 120,130 130,150 C 140,170 110,190 90,175 C 70,160 95,140 115,150"
            stroke={accentColor}
            strokeWidth="6"
            strokeOpacity="0.22"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(0)}
          />
          <path
            d="M60,180 C 80,140 120,130 130,150 C 140,170 110,190 90,175 C 70,160 95,140 115,150"
            stroke={accentColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(0)}
          />

          {/* Portrait extra: "Notes" text doodle */}
          {p && (
            <text
              x="20" y="40"
              fill={textColor}
              fontSize="24"
              opacity={doodleOp * 0.3}
              style={{ fontWeight: "bold", transform: "rotate(-5deg)" }}
            >
              IMPORTANT!
            </text>
          )}

          {/* Arrow */}
          <path
            d="M150,160 Q210,140 240,150"
            stroke={textColor}
            strokeWidth="5"
            strokeOpacity="0.18"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(6)}
          />
          <path
            d="M150,160 Q210,140 240,150"
            stroke={textColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(6)}
          />
          <path
            d="M226,140 L 240,150 L 226,162"
            stroke={textColor}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(10)}
          />
          {/* Stars */}
          <path d="M30,100 L32,88 L40,96 L28,92 L44,90 Z" stroke={accentColor} strokeWidth="2.5" fill="none" strokeDasharray={doodleDash} strokeDashoffset={staggeredOff(14)} />
          <path d="M240,80 L242,70 L248,78 L238,74 L252,72 Z" stroke={textColor} strokeWidth="2" fill="none" strokeDasharray={doodleDash} strokeDashoffset={staggeredOff(18)} />

          {/* Star 3 */}
          <path
            d="M120,90 L122,80 L130,88 L118,84 L134,82 Z"
            stroke={textColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(22)}
          />

          {/* Star 4 */}
          <path
            d="M200,60 L202,50 L210,58 L198,54 L214,52 Z"
            stroke={textColor}
            strokeWidth="2"
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(26)}
          />

          {/* Star 5 small sparkle */}
          <path
            d="M160,110 L162,104 L168,108 L158,106 L170,104 Z"
            stroke={accentColor}
            strokeWidth="1.8"
            fill="none"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(30)}
          />

          {/* Tiny cross sparkle */}
          <path
            d="M100,150 L100,160 M95,155 L105,155"
            stroke={textColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={doodleDash}
            strokeDashoffset={staggeredOff(34)}
          />
        </g>
      </svg>

      {/* Top Right Portrait Doodle Cluster. Suppressed when there is an image,
          since the photo banner covers the top of the frame. */}
      {p && !hasImage && (
        <svg
          style={{ position: "absolute", top: 40, right: 30, width: "20%", height: "auto", opacity: doodleOp, zIndex: 2 }}
          viewBox="0 0 100 100"
        >
           <circle cx="50" cy="50" r="30" stroke={accentColor} strokeWidth="2" fill="none" strokeDasharray="5 5" />
           <path d="M40,40 L60,60 M60,40 L40,60" stroke={textColor} strokeWidth="2" />
        </svg>
      )}
    </AbsoluteFill>
  );
};
