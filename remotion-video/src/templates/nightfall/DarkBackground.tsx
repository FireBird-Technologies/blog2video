import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const BASE_BG = "#0A0A1A";

/** Dark gradient mesh background for nightfall. Optional slow drift. */
export const DarkBackground: React.FC<{ drift?: boolean }> = ({ drift = true }) => {
  const frame = useCurrentFrame();
  const t = drift ? (frame / 300) % 1 : 0;
  const x1 = 20 + Math.sin(t * Math.PI * 2) * 10;
  const y1 = 30 + Math.cos(t * Math.PI * 2) * 5;
  const x2 = 80 + Math.cos(t * Math.PI * 2 + 1) * 8;
  const y2 = 70 + Math.sin(t * Math.PI * 2 + 1) * 5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BASE_BG,
        backgroundImage: `
          radial-gradient(ellipse ${120 + 40 * t}% ${80}% at ${x1}% ${y1}%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
          radial-gradient(ellipse ${100}% ${100}% at ${x2}% ${y2}%, rgba(34, 211, 238, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse 80% 60% at 50% 50%, rgba(129, 140, 248, 0.06) 0%, transparent 60%)
        `,
        filter: "blur(0px)", // gradients are soft by design
      }}
    />
  );
};
