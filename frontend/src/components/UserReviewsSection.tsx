import { useState, useEffect, useRef } from "react";
import { pubById, type Publication } from "./publicationData";

// ─── Publication logo with priority fallback chain ────────────────────────────
//   christianleadership : fetchUrl → logoSrc → initials
//   all others          : logoSrc  → initials

type ImgStage = "fetch" | "file" | "initials";

function PublicationLogo({ pub, size = 28 }: { pub: Publication; size?: number }) {
  const startStage: ImgStage = pub.fetchUrl ? "fetch" : "file";
  const [stage, setStage] = useState<ImgStage>(startStage);

  const src =
    stage === "fetch" ? pub.fetchUrl! :
    stage === "file"  ? pub.logoSrc   :
    null;

  const advance = () => {
    if (stage === "fetch") setStage("file");
    else setStage("initials");
  };

  if (stage === "initials" || !src) {
    return (
      <div
        className={`rounded-full ${pub.avatarBg} flex items-center justify-center text-white font-bold shrink-0`}
        style={{ width: size, height: size, fontSize: size * 0.3 }}
      >
        {pub.initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={pub.name}
      width={size}
      height={size}
      className="rounded-lg object-contain shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
      draggable={false}
      onError={advance}
    />
  );
}

// ─── Reviews data ─────────────────────────────────────────────────────────────

interface Review {
  id: string;
  name: string;
  source: string;
  href?: string;
  quote: string;
  pubId: string;
}

const REVIEWS: Review[] = [
  {
    id: "hodman",
    name: "Hodman Murad",
    source: "Between Thinking & Doing",
    href: "https://betweenthinkingdoing.substack.com/",
    pubId: "betweenthinkingdoing",
    quote:
      "I've been testing Blog2Video, today. It's very cool! Lots of potential! I think you should try it too!",
  },
  {
    id: "lextrading",
    name: "lextrading",
    source: "Substack",
    href: "https://substack.com/@lextrading",
    pubId: "lextrading",
    quote:
      "I think this is a very valuable piece of software you have built. Well done 👍",
  },
  {
    id: "tony",
    name: "Tony Orbiz",
    source: "Current Revolt",
    href: "https://www.currentrevolt.com/p/dem-war-update-crockett-leads-poll",
    pubId: "currentrevolt",
    quote:
      "Blog2Video took me from url to finished video in 3 mins. Which saved us a lot of money & time. It just works.",
  },
  {
    id: "justin",
    name: "Justin Wilson",
    source: "Christian Leadership",
    href: "https://christianleadership.now/p/let-your-yes-be-yes",
    pubId: "christianleadership",
    quote:
      "Love what you are doing with blog2video. Will recommend it to everyone.",
  },
];

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const pub = pubById[review.pubId];
  return (
    <div className="shrink-0 w-[260px] mx-3 flex flex-col gap-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-purple-400 via-violet-400 to-purple-300" />

      <div className="px-4 pb-4 flex flex-col gap-3">

        {/* Quote */}
        <p className="text-[11.5px] text-gray-600 leading-relaxed line-clamp-3">
          &ldquo;{review.quote}&rdquo;
        </p>

        {/* Author */}
        <div className="flex items-center gap-2.5">
          {pub && (
            <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden border border-gray-100 bg-gray-50">
              <PublicationLogo pub={pub} size={28} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-gray-900 truncate leading-tight">{review.name}</p>
            {review.href ? (
              <a
                href={review.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-purple-500 hover:text-purple-700 hover:underline transition-colors truncate block leading-tight"
              >
                {review.source} ↗
              </a>
            ) : (
              <p className="text-[10px] text-gray-400 truncate leading-tight">{review.source}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const TICKER_LOOP_SECONDS = 24;

function ReviewTicker({ running }: { running: boolean }) {
  const track = [...REVIEWS, ...REVIEWS, ...REVIEWS];
  return (
    <div
      className="relative mx-auto w-full overflow-hidden px-3"
      style={{
        maxWidth: 900,
        maskImage:
          "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
    >
      <div
        className="flex w-max"
        style={{
          animation: `ticker-scroll ${TICKER_LOOP_SECONDS}s linear infinite`,
          animationPlayState: running ? "running" : "paused",
        }}
      >
        {track.map((r, i) => (
          <ReviewCard key={`${r.id}-${i}`} review={r} />
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function UserReviewsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setRunning(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 border-t border-gray-100 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 mb-8 text-center">
        <p className="text-xs font-medium text-purple-600 tracking-widest uppercase mb-3">
          What users are saying
        </p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">
          Loved by writers everywhere
        </h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Real feedback from real writers who use blog2video.
        </p>
      </div>
      <ReviewTicker running={running} />
    </section>
  );
}

