import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";

const COLLAGE_SHARDS = [
  { clip: "polygon(0% 0%, 35% 0%, 30% 25%, 0% 20%)", ox: -280, oy: -200, rot: -340 },
  { clip: "polygon(35% 0%, 68% 0%, 65% 24%, 30% 25%)", ox: 200, oy: -220, rot: 300 },
  { clip: "polygon(68% 0%, 100% 0%, 100% 18%, 65% 24%)", ox: 320, oy: -160, rot: 260 },

  { clip: "polygon(0% 20%, 30% 25%, 34% 52%, 0% 48%)", ox: -340, oy: 20, rot: -400 },
  { clip: "polygon(30% 25%, 65% 24%, 62% 50%, 34% 52%)", ox: 0, oy: 280, rot: 380 },
  { clip: "polygon(65% 24%, 100% 18%, 100% 48%, 62% 50%)", ox: 360, oy: 60, rot: 320 },

  { clip: "polygon(0% 48%, 34% 52%, 28% 76%, 0% 72%)", ox: -260, oy: 200, rot: -340 },
  { clip: "polygon(34% 52%, 62% 50%, 68% 78%, 28% 76%)", ox: 0, oy: -320, rot: 380 },
  { clip: "polygon(62% 50%, 100% 48%, 100% 74%, 68% 78%)", ox: 320, oy: 220, rot: -360 },

  { clip: "polygon(0% 72%, 28% 76%, 32% 100%, 0% 100%)", ox: -240, oy: 340, rot: 280 },
  { clip: "polygon(28% 76%, 68% 78%, 64% 100%, 32% 100%)", ox: 0, oy: 370, rot: -300 },
  { clip: "polygon(68% 78%, 100% 74%, 100% 100%, 64% 100%)", ox: 260, oy: 320, rot: 320 },
];

const FLANKING_SHARDS_LEFT = [
  { clip: "polygon(0% 0%, 25% 0%, 20% 35%, 0% 30%)", ox: -300, oy: -180, rot: -320 },
  { clip: "polygon(0% 30%, 20% 35%, 18% 65%, 0% 60%)", ox: -280, oy: 0, rot: -380 },
  { clip: "polygon(0% 60%, 18% 65%, 22% 100%, 0% 100%)", ox: -260, oy: 200, rot: -300 },
  { clip: "polygon(25% 0%, 22% 100%, 18% 65%, 20% 35%)", ox: -200, oy: 100, rot: 280 },
];

const FLANKING_SHARDS_RIGHT = [
  { clip: "polygon(75% 0%, 100% 0%, 100% 32%, 80% 28%)", ox: 300, oy: -180, rot: 320 },
  { clip: "polygon(80% 28%, 100% 32%, 100% 62%, 78% 58%)", ox: 280, oy: 0, rot: 380 },
  { clip: "polygon(78% 58%, 100% 62%, 100% 100%, 76% 100%)", ox: 260, oy: 200, rot: 300 },
  { clip: "polygon(75% 0%, 76% 100%, 78% 58%, 80% 28%)", ox: 200, oy: 100, rot: -280 },
];

const ASSEMBLE_FRAMES = 50;
const DISPERSE_FRAMES = 40;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface MagazineCollageBackgroundProps {
  bgColor: string;
  opacity?: number;
  variant?: "full" | "flanking";
}

export const MagazineCollageBackground: React.FC<MagazineCollageBackgroundProps> = ({
  bgColor,
  opacity: maxOpacity = 0.15,
  variant = "full",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const disperseStart = durationInFrames - DISPERSE_FRAMES;

  const shards =
    variant === "flanking"
      ? [...FLANKING_SHARDS_LEFT, ...FLANKING_SHARDS_RIGHT]
      : COLLAGE_SHARDS;

  const collageUrl = staticFile("magazine-collage.avif");

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: bgColor }} />

      {shards.map((shard, i) => {
        const stagger = i * 2;

        const assemble = interpolate(
          frame,
          [stagger, ASSEMBLE_FRAMES + stagger],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const disperse = interpolate(
          frame,
          [disperseStart + stagger, durationInFrames],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const progress = frame >= disperseStart ? 1 - disperse : assemble;
        const eased = easeInOutCubic(progress);

        let tx = 0;
        let ty = 0;
        let rotate = 0;
        let scale = 1;

        if (frame < disperseStart) {
          tx = shard.ox * (1 - eased);
          ty = shard.oy * (1 - eased) * (1 + 0.12 * (1 - eased));
          rotate = shard.rot * (1 - eased) * 0.3;
          scale = 0.92 + 0.08 * eased;
        } else {
          tx = shard.ox * disperse * 0.25;
          ty = -(disperse * disperse * 600);
          rotate = shard.rot * disperse * 0.2;
          scale = 1 + 0.15 * disperse;
        }

        const shardOpacity =
          frame < disperseStart
            ? maxOpacity * eased
            : maxOpacity * (1 - disperse);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: shard.clip,
              backgroundImage: `url("${collageUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`,
              opacity: shardOpacity,
              filter: "grayscale(0.3)",
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
};
