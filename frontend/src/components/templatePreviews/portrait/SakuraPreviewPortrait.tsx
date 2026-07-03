const P = {
  plum: "#4A1220",
  void: "#080305",
  blush: "#F4B8C8",
  deepBlush: "#E8739A",
  mist: "#E8D5DF",
  crimson: "#C0143C",
  gold: "#C9A84C",
};

const Blossom = ({
  x,
  y,
  r,
  rot = 0,
  color = P.blush,
  opacity = 1,
}: {
  x: number;
  y: number;
  r: number;
  rot?: number;
  color?: string;
  opacity?: number;
}) => (
  <g transform={`translate(${x},${y}) rotate(${rot})`} opacity={opacity}>
    {[0, 1, 2, 3, 4].map((i) => {
      const a = ((i * 72 - 90) * Math.PI) / 180;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      return (
        <ellipse
          key={i}
          cx={px}
          cy={py}
          rx={r * 0.55}
          ry={r * 0.35}
          transform={`rotate(${i * 72 - 90}, ${px}, ${py})`}
          fill={color}
        />
      );
    })}
    <circle r={r * 0.18} fill={P.deepBlush} />
  </g>
);

const SakuraPreviewPortrait = ({ thumbnailMode = false }: { thumbnailMode?: boolean }) => {
  void thumbnailMode;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "9/16",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Georgia, serif",
      }}
    >
      <svg
        viewBox="0 0 180 320"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id="skpp-bg" cx="30%" cy="18%" r="95%">
            <stop offset="0%" stopColor={P.plum} />
            <stop offset="100%" stopColor={P.void} />
          </radialGradient>
        </defs>
        <rect width="180" height="320" fill="url(#skpp-bg)" />
        <circle cx="90" cy="150" r="86" fill="none" stroke={P.gold} strokeWidth="1" opacity="0.14" />
        <circle cx="90" cy="150" r="64" fill="none" stroke={P.blush} strokeWidth="0.8" opacity="0.1" />
        {/* corner blossoms */}
        <Blossom x={20} y={26} r={11} rot={15} color={P.blush} opacity={0.8} />
        <Blossom x={38} y={14} r={7} rot={-20} color={P.mist} opacity={0.6} />
        <Blossom x={160} y={296} r={11} rot={-15} color={P.blush} opacity={0.8} />
        <Blossom x={142} y={308} r={7} rot={30} color={P.mist} opacity={0.6} />
        {/* drifting petals */}
        <Blossom x={140} y={70} r={6} rot={40} color={P.mist} opacity={0.5} />
        <Blossom x={44} y={230} r={7} rot={10} color={P.blush} opacity={0.5} />
        {/* kanji */}
        <text
          x="90"
          y="164"
          textAnchor="middle"
          fontFamily="'Noto Serif JP', Georgia, serif"
          fontSize="82"
          fontWeight={700}
          fill={P.blush}
          opacity="0.96"
        >
          桜
        </text>
        {/* split brush lines */}
        <path d="M 90 190 Q 62 187 36 190" stroke={P.crimson} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M 90 190 Q 118 193 144 190" stroke={P.crimson} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
        {/* gold label */}
        <text
          x="90"
          y="210"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="9"
          letterSpacing="8"
          fill={P.gold}
        >
          SAKURA
        </text>
      </svg>
    </div>
  );
};

export default SakuraPreviewPortrait;
