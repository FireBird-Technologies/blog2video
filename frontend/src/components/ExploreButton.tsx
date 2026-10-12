/** Star positions (percent of button box), size in px, and twinkle delay in ms. */
const STARS = [
  { top: 18, left: 8, size: 2, delay: 0 },
  { top: 70, left: 16, size: 1.5, delay: 600 },
  { top: 30, left: 30, size: 1, delay: 1200 },
  { top: 78, left: 44, size: 1.5, delay: 300 },
  { top: 14, left: 58, size: 1, delay: 1800 },
  { top: 62, left: 72, size: 2, delay: 900 },
  { top: 22, left: 86, size: 1.5, delay: 1500 },
  { top: 80, left: 92, size: 1, delay: 450 },
];

interface ExploreButtonProps {
  href: string;
  onClick?: () => void;
  className?: string;
}

/** Dark night-sky pill with twinkling stars — sits next to "Sign in" in the navbar. */
const ExploreButton = ({ href, onClick, className = "" }: ExploreButtonProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    onClick={onClick}
    className={`group relative inline-flex items-center overflow-hidden font-medium text-white rounded-lg ring-1 ring-white/10 ${className}`}
    style={{
      background:
        "radial-gradient(ellipse at 20% 0%, rgba(40,62,95,0.5) 0%, transparent 60%), radial-gradient(ellipse at 90% 100%, rgba(25,45,75,0.45) 0%, transparent 55%), linear-gradient(135deg, #0a0e17 0%, #111a2b 55%, #080b12 100%)",
    }}
  >
    {STARS.map((s, i) => (
      <span
        key={i}
        aria-hidden="true"
        className="explore-star pointer-events-none absolute rounded-full bg-white"
        style={{
          top: `${s.top}%`,
          left: `${s.left}%`,
          width: s.size,
          height: s.size,
          animationDelay: `${s.delay}ms`,
          boxShadow: "0 0 4px rgba(255,255,255,0.9)",
        }}
      />
    ))}
    <span className="relative">Explore</span>
  </a>
);

export default ExploreButton;
