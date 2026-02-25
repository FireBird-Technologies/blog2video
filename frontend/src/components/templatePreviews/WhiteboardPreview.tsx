import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────
   SCALE WRAPPER — renders at 700×394 internally, CSS-scales to fit
───────────────────────────────────────────────────────────── */
const IW = 700, IH = 394;

function ScaledCanvas({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / IW);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width:"100%", aspectRatio:`${IW}/${IH}`, position:"relative", overflow:"hidden", borderRadius:14 }}>
      <div style={{ width:IW, height:IH, transform:`scale(${scale})`, transformOrigin:"top left", position:"absolute" }}>
        {children}
      </div>
    </div>
  );
}

/* ─── TOKENS ─────────────────────────────────────────────── */
const BG     = "#F7F3E8";
const TEXT   = "#1a1209";
const ACCENT = "#d4420a";
const FONT   = "'Comic Sans MS','Segoe Print','Bradley Hand',cursive";

/* ─── ANIMATION TIMER ────────────────────────────────────── 
   Returns 0→1 over `ms` milliseconds. Resets when `active` flips true. */
function useTimer(ms: number, active: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) { setT(0); return; }
    const start = performance.now();
    let raf: number | undefined;
    const tick = (now: number) => {
      const next = Math.min((now - start) / ms, 1);
      setT(next);
      if (next < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf !== undefined) cancelAnimationFrame(raf); };
  }, [active, ms]);
  return t;
}

/* ─── PAPER BACKGROUND ───────────────────────────────────── 
   Inline defs so grain filter and grain rect are in the SAME SVG. */
function PaperBg() {
  return (
    <div style={{ position:"absolute", inset:0, background:BG }}>
      {/* dot grid */}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:"radial-gradient(rgba(0,0,0,0.065) 1.2px, transparent 1.2px)",
        backgroundSize:"22px 22px",
      }}/>
      {/* grain + vignette — defs and rect in same SVG so filter is in scope */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} aria-hidden>
        <defs>
          <filter id="pgrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" result="noise"/>
            <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
            <feComponentTransfer in="gray" result="faded">
              <feFuncA type="linear" slope="0.055"/>
            </feComponentTransfer>
            <feComposite in="faded" in2="SourceGraphic" operator="over"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#pgrain)" fill="white"/>
      </svg>
      {/* vignette */}
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,0.08))", pointerEvents:"none" }}/>
    </div>
  );
}

/* ─── SVG INK FILTERS — inline into each slide SVG that uses them ─── */
function InkDefs({ ids = ["ink","inkLine","inkFig"] }) {
  return (
    <defs>
      {ids.includes("ink") && (
        <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves="5" seed="11" result="w"/>
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      )}
      {ids.includes("inkLine") && (
        <filter id="inkLine" x="-4%" y="-50%" width="108%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="6" result="w"/>
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      )}
      {ids.includes("inkFig") && (
        <filter id="inkFig" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="w"/>
          <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      )}
    </defs>
  );
}

/* ─── DOUBLE-STROKE helpers (bleed + core = marker feel) ─── */
function DS({ d, c = TEXT, w = 4, ...rest }: { d: string; c?: string; w?: number } & React.SVGProps<SVGPathElement>) {
  return <>
    <path d={d} fill="none" stroke={c} strokeWidth={w + 4} strokeOpacity={0.17} strokeLinecap="round" strokeLinejoin="round" {...rest}/>
    <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" {...rest}/>
  </>;
}
function DSLine({ x1, y1, x2, y2, c = TEXT, w = 4, ...rest }: { x1: number; y1: number; x2: number; y2: number; c?: string; w?: number } & React.SVGProps<SVGLineElement>) {
  return <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w + 4} strokeOpacity={0.17} strokeLinecap="round" {...rest}/>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={w} strokeLinecap="round" {...rest}/>
  </>;
}
function DSCircle({ cx, cy, r, c = TEXT, w = 4, da, dashOffset }: { cx: number; cy: number; r: number; c?: string; w?: number; da?: number; dashOffset?: number }) {
  const extra = da != null && dashOffset != null ? { strokeDasharray: da, strokeDashoffset: dashOffset } : {};
  return <>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={w+4} strokeOpacity={0.17} {...extra}/>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={w} {...extra}/>
  </>;
}

/* ─── STICK FIGURE ──────────────────────────────────────── */
function StickFigure({ cx=50, cy=30, sc=1, color=TEXT, progress=1 }) {
  const D = 320 * sc, off = D * (1 - progress);
  const da = { strokeDasharray:D, strokeDashoffset:off };
  return (
    <g filter="url(#inkFig)" strokeLinecap="round">
      <DSCircle cx={cx} cy={cy} r={15*sc} c={color} w={3.5} da={D} dashOffset={off}/>
      <DSLine x1={cx} y1={cy+15*sc} x2={cx} y2={cy+52*sc} c={color} w={3.5} {...da}/>
      <DSLine x1={cx} y1={cy+24*sc} x2={cx-22*sc} y2={cy+38*sc} c={color} w={3.5} {...da}/>
      <DSLine x1={cx} y1={cy+24*sc} x2={cx+22*sc} y2={cy+32*sc} c={color} w={3.5} {...da}/>
      <DS d={`M${cx},${cy+52*sc} Q${cx-10*sc},${cy+76*sc} ${cx-18*sc},${cy+92*sc}`} c={color} w={3.5} {...da}/>
      <DS d={`M${cx},${cy+52*sc} Q${cx+10*sc},${cy+76*sc} ${cx+18*sc},${cy+92*sc}`} c={color} w={3.5} {...da}/>
    </g>
  );
}

/* ─── WOBBLY BUBBLE (rounded rect path) ────────────────── */
function WobblyBubble({ x, y, w, h, stroke, fill = "rgba(255,255,255,0.9)" }: { x: number; y: number; w: number; h: number; stroke: string; fill?: string }) {
  const r = 16;
  const d = [
    `M ${x+r},${y+1}`,
    `Q ${x+w/2},${y-1.5} ${x+w-r},${y+2}`,
    `Q ${x+w+1.5},${y} ${x+w+1.5},${y+r}`,
    `Q ${x+w+2},${y+h/2} ${x+w},${y+h-r}`,
    `Q ${x+w+1.5},${y+h+1.5} ${x+w-r},${y+h}`,
    `Q ${x+w/2},${y+h+2} ${x+r},${y+h-1.5}`,
    `Q ${x-1.5},${y+h} ${x},${y+h-r}`,
    `Q ${x-2},${y+h/2} ${x+1.5},${y+r}`,
    `Q ${x},${y-1.5} ${x+r},${y+1} Z`,
  ].join(" ");
  return <>
    <path d={d} fill={fill} stroke={stroke} strokeWidth={7} strokeOpacity={0.18} strokeLinejoin="round" strokeLinecap="round"/>
    <path d={d} fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"/>
  </>;
}

/* ══════════════════════════════════════════════════════════
   SLIDE 1 — DrawnTitle
══════════════════════════════════════════════════════════ */
function SlideDrawnTitle({ active }: { active: boolean }) {
  const t = useTimer(2600, active);
  const title = "Story Comes Alive";
  const nar   = "Hand-drawn markers, stick figures & story beats.";
  // clamp slices so they never exceed string length
  const tc = Math.min(title.length, Math.floor(t / 0.5 * title.length));
  const nc = Math.min(nar.length, Math.max(0, Math.floor((t - 0.42) / 0.55 * nar.length)));
  const lw = Math.max(0, Math.min(1, (t - 0.36) / 0.28));
  const sp = Math.max(0, Math.min(1, (t - 0.52) / 0.44));

  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 14%", fontFamily:FONT }}>
      {/* Title typewriter */}
      <div style={{ color:TEXT, fontWeight:700, fontSize:60, lineHeight:1.05, textAlign:"center" }}>
        {title.slice(0, tc)}
        {tc < title.length && <span style={{ opacity:0.3 }}>|</span>}
      </div>

      {/* Wobbly underline — defs + path in same SVG */}
      <svg viewBox="0 0 460 14" style={{ width:"min(460px, 90%)", height:14, marginTop:12 }} preserveAspectRatio="none">
        <defs>
          <filter id="ul" x="-3%" y="-60%" width="106%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.3" numOctaves="3" seed="6" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <path d="M0,7 Q115,4 230,8 Q345,12 460,6" fill="none" stroke={ACCENT} strokeWidth={9} strokeOpacity={0.2} strokeLinecap="round" filter="url(#ul)" strokeDasharray={520} strokeDashoffset={520*(1-lw)}/>
        <path d="M0,7 Q115,4 230,8 Q345,12 460,6" fill="none" stroke={ACCENT} strokeWidth={4.5} strokeLinecap="round" filter="url(#ul)" strokeDasharray={520} strokeDashoffset={520*(1-lw)}/>
      </svg>

      {/* Narration typewriter */}
      <div style={{ marginTop:18, color:TEXT, fontSize:23, fontWeight:500, textAlign:"center", maxWidth:480, lineHeight:1.4 }}>
        {nar.slice(0, nc)}
        {nc > 0 && nc < nar.length && <span style={{ opacity:0.3 }}>|</span>}
      </div>

      {/* Bottom-right stick figure */}
      <svg style={{ position:"absolute", right:"5%", bottom:"5%", width:"11%", height:"auto", overflow:"visible" }} viewBox="0 0 90 110" fill="none">
        <defs>
          <filter id="inkFig" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <StickFigure cx={45} cy={16} sc={0.92} progress={sp}/>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 2 — StatsChart (horizontal bars)
══════════════════════════════════════════════════════════ */
const BARS = [
  { label:"Option A", pct:85 },
  { label:"Option B", pct:62 },
  { label:"Option C", pct:44 },
];

function SlideStatsChart({ active }: { active: boolean }) {
  const t = useTimer(2400, active);
  const titleOp = Math.min(1, t * 3.5);
  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"5% 10%", gap:24, fontFamily:FONT }}>
      <div style={{ textAlign:"center", opacity:titleOp }}>
        <div style={{ color:TEXT, fontWeight:700, fontSize:48 }}>By the Numbers</div>
        <div style={{ color:TEXT, fontSize:21, opacity:0.78, marginTop:4 }}>A quick look at the results</div>
      </div>

      <div style={{ width:"100%", maxWidth:520, display:"flex", flexDirection:"column", gap:18 }}>
        {BARS.map((bar, i) => {
          const delay = 0.28 + i * 0.2;
          const barT = Math.max(0, Math.min(1, (t - delay) / 0.36));
          const rowOp = Math.max(0, Math.min(1, (t - delay) * 7));
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:14, opacity:rowOp }}>
              <span style={{ color:TEXT, fontSize:19, fontWeight:600, minWidth:80 }}>{bar.label}</span>
              <div style={{ flex:1, height:28, borderRadius:6, backgroundColor:"rgba(0,0,0,0.06)", overflow:"hidden", border:`2.5px solid ${ACCENT}`, position:"relative" }}>
                {/* bleed fill */}
                <div style={{ position:"absolute", inset:0, width:`${bar.pct * barT}%`, backgroundColor:ACCENT, opacity:0.18, borderRadius:4 }}/>
                {/* core fill */}
                <div style={{ width:`${bar.pct * barT}%`, height:"100%", backgroundColor:ACCENT, borderRadius:4 }}/>
              </div>
              <span style={{ color:ACCENT, fontSize:21, fontWeight:800, minWidth:42, textAlign:"right", opacity:barT }}>{bar.pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 3 — ComparisonThoughts (VS)
══════════════════════════════════════════════════════════ */
function SlideComparison({ active }: { active: boolean }) {
  const t = useTimer(2800, active);
  const figP     = Math.min(1, t * 2.6);
  const bubbleOp = Math.max(0, Math.min(1, (t - 0.36) * 4));
  const vsOp     = Math.max(0, Math.min(1, (t - 0.44) * 5));
  const titleOp  = Math.max(0, Math.min(1, t * 3));

  const D = 360, off = D * (1 - figP);
  const fp = { strokeDasharray:D, strokeDashoffset:off };

  // Shared figure drawing — inline to keep filter IDs scoped
  const Fig = ({ cx, cy, color }: { cx: number; cy: number; color: string }) => (
    <>
      {/* bleed */}
      <circle cx={cx} cy={cy} r={22} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
      <line x1={cx} y1={cy+22} x2={cx} y2={cy+82} stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
      <line x1={cx} y1={cy+36} x2={cx-32} y2={cy+58} stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
      <line x1={cx} y1={cy+36} x2={cx+32} y2={cy+50} stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
      <line x1={cx} y1={cy+82} x2={cx-18} y2={cy+128} stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
      <line x1={cx} y1={cy+82} x2={cx+18} y2={cy+128} stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
      {/* core */}
      <circle cx={cx} cy={cy} r={22} fill="none" stroke={color} strokeWidth={4.5} {...fp}/>
      <line x1={cx} y1={cy+22} x2={cx} y2={cy+82} stroke={color} strokeWidth={4.5} {...fp}/>
      <line x1={cx} y1={cy+36} x2={cx-32} y2={cy+58} stroke={color} strokeWidth={4.5} {...fp}/>
      <line x1={cx} y1={cy+36} x2={cx+32} y2={cy+50} stroke={color} strokeWidth={4.5} {...fp}/>
      <line x1={cx} y1={cy+82} x2={cx-18} y2={cy+128} stroke={color} strokeWidth={4.5} {...fp}/>
      <line x1={cx} y1={cy+82} x2={cx+18} y2={cy+128} stroke={color} strokeWidth={4.5} {...fp}/>
    </>
  );

  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", padding:"4% 6%", fontFamily:FONT }}>
      {/* Title */}
      <div style={{ textAlign:"center", marginBottom:10, opacity:titleOp }}>
        <div style={{ color:TEXT, fontWeight:700, fontSize:44 }}>Make a Choice</div>
        <div style={{ color:TEXT, fontSize:19, opacity:0.78 }}>Which path will you take?</div>
      </div>

      <div style={{ flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
        <svg viewBox="0 0 700 250" style={{ width:"100%", height:"auto", overflow:"visible" }} fill="none">
          <defs>
            <filter id="inkFig" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="w"/>
              <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="inkBub" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035 0.02" numOctaves="4" seed="8" result="w"/>
              <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
          </defs>

          {/* Left bubble — x:20, w:230, bottom at y:82; figure head top at cy=100-22=78 → tail fills the gap */}
          <g opacity={bubbleOp} filter="url(#inkBub)">
            <WobblyBubble x={20} y={6} w={228} h={68} stroke={TEXT}/>
            {/* tail: from bubble bottom (y=74) down to head top (y=78) */}
            <path d="M122,74 Q128,84 134,90 Q140,84 146,74"
              fill="rgba(255,255,255,0.9)" stroke={TEXT} strokeWidth={3} strokeLinejoin="round"/>
          </g>
          <foreignObject x={34} y={14} width={202} height={58} opacity={bubbleOp}>
            <div style={{ color:TEXT, fontSize:19, fontWeight:600, fontFamily:FONT, textAlign:"center", lineHeight:1.35, display:"flex", alignItems:"center", justifyContent:"center", height:"100%", wordBreak:"break-word" }}>
              Speed over quality!
            </div>
          </foreignObject>

          {/* Right bubble — x:450, w:230; tail aligns to right figure head */}
          <g opacity={bubbleOp} filter="url(#inkBub)">
            <WobblyBubble x={452} y={6} w={228} h={68} stroke={ACCENT} fill="rgba(255,255,255,0.9)"/>
            <path d="M554,74 Q560,84 566,90 Q572,84 578,74"
              fill="rgba(255,255,255,0.9)" stroke={ACCENT} strokeWidth={3} strokeLinejoin="round"/>
          </g>
          <foreignObject x={466} y={14} width={202} height={58} opacity={bubbleOp}>
            <div style={{ color:ACCENT, fontSize:19, fontWeight:600, fontFamily:FONT, textAlign:"center", lineHeight:1.35, display:"flex", alignItems:"center", justifyContent:"center", height:"100%", wordBreak:"break-word" }}>
              Quality takes time!
            </div>
          </foreignObject>

          {/* VS label */}
          <text x={350} y={160} textAnchor="middle" dominantBaseline="middle"
            fill={ACCENT} fontSize={50} fontWeight={800} fontFamily={FONT} opacity={vsOp}>vs</text>

          {/* Left figure: head cy=100 (head top=78, bubble bottom+tail = y=74+16=90 → close) */}
          <g filter="url(#inkFig)" strokeLinecap="round">
            <Fig cx={134} cy={100} color={TEXT}/>
          </g>

          {/* Right figure: head cy=100, bubble tail ends at same y */}
          <g filter="url(#inkFig)" strokeLinecap="round">
            <Fig cx={566} cy={100} color={ACCENT}/>
          </g>
        </svg>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 4 — StatsFigures (cards)
══════════════════════════════════════════════════════════ */
const STATS = [
  { value:"87%", label:"Engagement" },
  { value:"3×",  label:"Faster" },
  { value:"10K+",label:"Users" },
];

function SlideStatsFigures({ active }: { active: boolean }) {
  const t = useTimer(2500, active);
  const titleOp = Math.min(1, t * 3.5);

  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"5% 8%", gap:28, fontFamily:FONT }}>
      <div style={{ textAlign:"center", opacity:titleOp }}>
        <div style={{ color:TEXT, fontWeight:700, fontSize:48 }}>The Impact</div>
        <div style={{ color:TEXT, fontSize:21, opacity:0.78, marginTop:4 }}>Numbers that tell the story</div>
      </div>

      <div style={{ display:"flex", gap:22, justifyContent:"center" }}>
        {STATS.map((s, i) => {
          const delay = 0.28 + i * 0.18;
          const cardT = Math.max(0, Math.min(1, (t - delay) / 0.34));
          const cardOp = Math.max(0, Math.min(1, (t - delay) * 6));
          // Normalised 100×100 viewBox perimeter ≈ 400
          const dash = 400, dashOff = dash * (1 - cardT);
          return (
            <div key={i} style={{
              position:"relative", width:158, height:128,
              backgroundColor:"rgba(255,255,255,0.55)",
              boxShadow:"0 4px 14px rgba(0,0,0,0.07)", borderRadius:14,
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:6, opacity:cardOp,
            }}>
              {/* Hand-drawn border — filter defs and rect in same SVG */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                style={{ position:"absolute", inset:0, width:"100%", height:"100%", overflow:"visible", pointerEvents:"none" }}
                fill="none">
                <defs>
                  <filter id={`inkC${i}`} x="-6%" y="-6%" width="112%" height="112%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed={i+2} result="w"/>
                    <feDisplacementMap in="SourceGraphic" in2="w" scale="2" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                </defs>
                <g filter={`url(#inkC${i})`}>
                  <rect x={2} y={2} width={96} height={96} rx={10} stroke={ACCENT} strokeWidth={7} strokeOpacity={0.18}/>
                  <rect x={2} y={2} width={96} height={96} rx={10} stroke={ACCENT} strokeWidth={3} strokeDasharray={dash} strokeDashoffset={dashOff}/>
                </g>
              </svg>

              {/* Value */}
              <span style={{ color:ACCENT, fontSize:40, fontWeight:800, fontFamily:FONT, lineHeight:1 }}>{s.value}</span>

              {/* Wobbly divider — filter defs and path in same SVG */}
              <svg viewBox="0 0 100 8" preserveAspectRatio="none" style={{ width:"75%", height:7 }} fill="none">
                <defs>
                  <filter id={`inkD${i}`} x="-4%" y="-80%" width="108%" height="260%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.06 0.35" numOctaves="3" seed={i+7} result="w"/>
                    <feDisplacementMap in="SourceGraphic" in2="w" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                </defs>
                <path d="M4,4 Q50,2 96,4" stroke={TEXT} strokeWidth={4} strokeOpacity={0.2} strokeLinecap="round" filter={`url(#inkD${i})`} strokeDasharray={100} strokeDashoffset={100*(1-cardT)}/>
                <path d="M4,4 Q50,2 96,4" stroke={TEXT} strokeWidth={2.5} strokeLinecap="round" filter={`url(#inkD${i})`} strokeDasharray={100} strokeDashoffset={100*(1-cardT)}/>
              </svg>

              {/* Label */}
              <div style={{ color:TEXT, fontSize:17, fontWeight:600, textAlign:"center" }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 5 — SpeechBubbleDialogue
══════════════════════════════════════════════════════════ */
function SlideSpeechDialogue({ active }: { active: boolean }) {
  const t = useTimer(3000, active);
  const figP   = Math.min(1, t * 2.4);
  const leftP  = Math.max(0, Math.min(1, (t - 0.34) / 0.4));
  const rightP = Math.max(0, Math.min(1, (t - 0.62) / 0.36));
  const titleOp = Math.max(0, Math.min(1, (t - 0.84) * 6));

  const D = 460, figOff = D * (1 - figP);
  const fp = { strokeDasharray:D, strokeDashoffset:figOff };

  const leftText  = "Did you know this?";
  const rightText = "Tell me more!";
  const lc = Math.min(leftText.length,  Math.floor(leftText.length  * leftP));
  const rc = Math.min(rightText.length, Math.floor(rightText.length * rightP));

  // Two figures close together; bubbles fan outward
  // Left fig cx=240, right fig cx=460
  // Left bubble extends LEFT from x=20 to x=238; right bubble extends RIGHT from x=462 to x=680
  // Ground at y=292; feet end at cy+128 where cy=152 → feet at y=280 ✓
  // Head top: cy-r = 152-24 = 128
  // Bubble bottom: y=60+68=128 → tail starts exactly at head top ✓

  const FigBody = ({ cx, color }: { cx: number; color: string }) => <>
    <circle cx={cx} cy={152} r={24} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
    <line x1={cx} y1={176} x2={cx} y2={240} stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
    <path d={`M${cx},200 Q${cx-26},216 ${cx-48},230`} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
    <path d={`M${cx},200 Q${cx+26},212 ${cx+48},222`} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
    <path d={`M${cx},240 Q${cx-14},264 ${cx-22},288`} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
    <path d={`M${cx},240 Q${cx+14},264 ${cx+22},288`} fill="none" stroke={color} strokeWidth={9} strokeOpacity={0.18} {...fp}/>
    <circle cx={cx} cy={152} r={24} fill="none" stroke={color} strokeWidth={4.5} {...fp}/>
    <line x1={cx} y1={176} x2={cx} y2={240} stroke={color} strokeWidth={4.5} {...fp}/>
    <path d={`M${cx},200 Q${cx-26},216 ${cx-48},230`} fill="none" stroke={color} strokeWidth={4.5} {...fp}/>
    <path d={`M${cx},200 Q${cx+26},212 ${cx+48},222`} fill="none" stroke={color} strokeWidth={4.5} {...fp}/>
    <path d={`M${cx},240 Q${cx-14},264 ${cx-22},288`} fill="none" stroke={color} strokeWidth={4.5} {...fp}/>
    <path d={`M${cx},240 Q${cx+14},264 ${cx+22},288`} fill="none" stroke={color} strokeWidth={4.5} {...fp}/>
  </>;

  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, padding:"3% 5%", fontFamily:FONT }}>
      <svg viewBox="0 0 700 320" style={{ width:"92%", maxWidth:740, height:"auto", overflow:"visible" }} fill="none">
        <defs>
          <filter id="inkFig" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="29" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <filter id="inkBL" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.02" numOctaves="4" seed="7" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
          <filter id="inkBR" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.02" numOctaves="4" seed="11" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>

        {/* Ground line */}
        <g filter="url(#inkFig)">
          <line x1={20} y1={292} x2={680} y2={290} stroke={TEXT} strokeWidth={6} strokeOpacity={0.18} strokeLinecap="round"/>
          <line x1={20} y1={292} x2={680} y2={290} stroke={TEXT} strokeWidth={3} strokeLinecap="round"/>
        </g>

        {/* Left figure cx=240 */}
        <g filter="url(#inkFig)" strokeLinecap="round">
          <FigBody cx={240} color={TEXT}/>
        </g>

        {/* Right figure cx=460 */}
        <g filter="url(#inkFig)" strokeLinecap="round">
          <FigBody cx={460} color={ACCENT}/>
        </g>

        {/* Speaker labels — 20px below ground */}
        <text x={240} y={314} textAnchor="middle" fill={TEXT} fontSize={16} fontFamily={FONT} fontWeight="700" opacity={Math.min(figP*3,1)}>Alex</text>
        <text x={460} y={314} textAnchor="middle" fill={ACCENT} fontSize={16} fontFamily={FONT} fontWeight="700" opacity={Math.min(figP*3,1)}>Jordan</text>

        {/* Left bubble — extends LEFT from figure (x=20, w=218 → right edge=238, fig cx=240)
            Head top = cy-r = 152-24 = 128
            Bubble: y=56, h=68 → bottom at y=124
            Tail bottom: y=128 → exactly at head top ✓ */}
        <g opacity={leftP} filter="url(#inkBL)">
          <WobblyBubble x={20} y={56} w={218} h={68} stroke={TEXT}/>
          <path d="M116,124 Q124,128 130,132 Q136,128 144,124"
            fill="rgba(255,255,255,0.9)" stroke={TEXT} strokeWidth={3} strokeLinejoin="round"/>
        </g>
        <foreignObject x={34} y={64} width={190} height={56} opacity={Math.min(leftP*2.5, 1)}>
          <div style={{ color:TEXT, fontSize:17, fontWeight:600, fontFamily:FONT, lineHeight:1.4, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", height:"100%", wordBreak:"break-word" }}>
            {leftText.slice(0, lc)}{lc > 0 && lc < leftText.length && <span style={{opacity:0.35}}>|</span>}
          </div>
        </foreignObject>

        {/* Right bubble — extends RIGHT from figure (x=462, w=218 → right edge=680, fig cx=460)
            Tail: same geometry, anchored at right figure head top */}
        <g opacity={rightP} filter="url(#inkBR)">
          <WobblyBubble x={462} y={56} w={218} h={68} stroke={ACCENT} fill="rgba(255,255,255,0.9)"/>
          <path d="M556,124 Q564,128 570,132 Q576,128 584,124"
            fill="rgba(255,255,255,0.9)" stroke={ACCENT} strokeWidth={3} strokeLinejoin="round"/>
        </g>
        <foreignObject x={476} y={64} width={190} height={56} opacity={Math.min(rightP*2.5, 1)}>
          <div style={{ color:ACCENT, fontSize:17, fontWeight:600, fontFamily:FONT, lineHeight:1.4, textAlign:"center", display:"flex", alignItems:"center", justifyContent:"center", height:"100%", wordBreak:"break-word" }}>
            {rightText.slice(0, rc)}{rc > 0 && rc < rightText.length && <span style={{opacity:0.35}}>|</span>}
          </div>
        </foreignObject>
      </svg>

      {/* Caption */}
      <div style={{ textAlign:"center", opacity:titleOp }}>
        <div style={{ color:TEXT, fontWeight:700, fontSize:36 }}>The Big Conversation</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SLIDE 6 — CountdownTimer
══════════════════════════════════════════════════════════ */
function SlideCountdown({ active }: { active: boolean }) {
  const t = useTimer(3200, active);
  const START = 5;
  const FPC = 1 / START;                      // fraction per count
  const elapsed = Math.min(t, 0.9999);        // clamp so we never get exactly 1.0 / FPC
  const countIdx = Math.floor(elapsed / FPC); // 0..4
  const currentCount = START - countIdx;      // 5..1, then 0 = GO!
  const within = (elapsed % FPC) / FPC;       // 0..1 within current count
  const ringProgress = 1 - within;
  // Pop scale: 0→1 fast, tiny overshoot, settle
  const popScale = within < 0.22 ? 0.45 + (within/0.22)*0.78
                 : within < 0.38 ? 1.23 - ((within-0.22)/0.16)*0.23
                 : 1.0;
  const globalOp = Math.min(1, t * 7);
  const urgency  = currentCount <= 2 ? "#e53e3e" : ACCENT;
  const R=118, CX=350, CY=182, circ=2*Math.PI*R;

  return (
    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, fontFamily:FONT, opacity:globalOp }}>
      <div style={{ color:TEXT, fontWeight:700, fontSize:46, textAlign:"center" }}>Get Ready!</div>

      <svg viewBox="0 0 700 300" style={{ width:"78%", maxWidth:560, height:"auto", overflow:"visible" }} fill="none">
        <defs>
          <filter id="inkRing" x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="4" seed="57" result="w"/>
            <feDisplacementMap in="SourceGraphic" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>

        {/* Track */}
        <g filter="url(#inkRing)">
          <circle cx={CX} cy={CY} r={R} stroke={TEXT} strokeWidth={20} strokeOpacity={0.07} fill="none"/>
          <circle cx={CX} cy={CY} r={R} stroke={TEXT} strokeWidth={2} strokeOpacity={0.18} fill="none" strokeDasharray="4 10"/>
        </g>

        {/* Active arc */}
        <g filter="url(#inkRing)">
          <circle cx={CX} cy={CY} r={R} stroke={urgency} strokeWidth={21} strokeOpacity={0.18} fill="none"
            strokeDasharray={circ} strokeDashoffset={circ*(1-ringProgress)}
            strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`}/>
          <circle cx={CX} cy={CY} r={R} stroke={urgency} strokeWidth={13} strokeOpacity={0.95} fill="none"
            strokeDasharray={circ} strokeDashoffset={circ*(1-ringProgress)}
            strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`}/>
        </g>

        {/* Center number — scale from ring center */}
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
          fill={urgency}
          fontSize={currentCount > 0 ? 102 : 66}
          fontWeight={800} fontFamily={FONT}
          transform={`translate(${CX},${CY}) scale(${popScale}) translate(${-CX},${-CY})`}>
          {currentCount > 0 ? currentCount : "GO!"}
        </text>

        {/* "seconds" sub-label */}
        <text x={CX} y={CY+66} textAnchor="middle" fill={TEXT} fontSize={19} fontFamily={FONT} fillOpacity={0.5}>
          {currentCount===1 ? "second" : currentCount>0 ? "seconds" : ""}
        </text>

        {/* Burst lines on each new count */}
        {within < 0.2 && [45,135,225,315].map((angle, ai) => {
          const rad = angle*Math.PI/180;
          const bop = (0.2-within)/0.2;
          return (
            <g key={ai} opacity={bop} filter="url(#inkRing)">
              <line
                x1={CX+Math.cos(rad)*(R+26)} y1={CY+Math.sin(rad)*(R+26)}
                x2={CX+Math.cos(rad)*(R+46)} y2={CY+Math.sin(rad)*(R+46)}
                stroke={urgency} strokeWidth={5} strokeOpacity={0.2} strokeLinecap="round"/>
              <line
                x1={CX+Math.cos(rad)*(R+26)} y1={CY+Math.sin(rad)*(R+26)}
                x2={CX+Math.cos(rad)*(R+46)} y2={CY+Math.sin(rad)*(R+46)}
                stroke={urgency} strokeWidth={2.5} strokeLinecap="round"/>
            </g>
          );
        })}

        {/* Progress dots */}
        {Array.from({length:START}).map((_,di) => {
          const passed = di < countIdx;
          const cx2 = CX - ((START-1)/2 - di)*28;
          return (
            <g key={di}>
              <circle cx={cx2} cy={278} r={7} stroke={TEXT} strokeWidth={5} strokeOpacity={0.14}
                fill={passed ? urgency : "none"} fillOpacity={0.7}/>
              <circle cx={cx2} cy={278} r={7} stroke={TEXT} strokeWidth={2} strokeOpacity={0.35}
                fill={passed ? urgency : "none"} fillOpacity={0.85}/>
            </g>
          );
        })}
      </svg>

      <div style={{ color:TEXT, fontSize:22, fontWeight:600, opacity:0.78 }}>until launch 🚀</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NAV DOTS
══════════════════════════════════════════════════════════ */
function NavDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ position:"absolute", bottom:13, left:"50%", transform:"translateX(-50%)", display:"flex", gap:7, zIndex:10 }}>
      {Array.from({length:total},(_,i)=>(
        <button key={i} onClick={()=>onDotClick(i)} style={{
          width:i===current?22:7, height:7, borderRadius:4,
          background:i===current?ACCENT:`rgba(26,18,9,0.2)`,
          border:"none", cursor:"pointer", padding:0,
          transition:"all 0.3s ease",
        }}/>
      ))}
    </div>
  );
}

/* ── SLIDE LABEL BADGE ─────────────────────────────────── */
const SLIDE_NAMES = ["Drawn Title","Stats Chart","Comparison","Stat Cards","Dialogue","Countdown"];

function SlideBadge({ name }: { name: string }) {
  return (
    <div style={{
      position:"absolute", top:13, left:14, zIndex:10,
      background:"rgba(255,255,255,0.78)",
      border:`1.5px solid rgba(212,66,10,0.22)`,
      borderRadius:20, padding:"4px 13px",
      fontFamily:FONT, fontSize:13, fontWeight:600, color:TEXT,
    }}>
      {name}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════ */
const SLIDES = [
  SlideDrawnTitle,
  SlideStatsChart,
  SlideComparison,
  SlideStatsFigures,
  SlideSpeechDialogue,
  SlideCountdown,
];
const SLIDE_DURATION = 4000;

export default function WhiteboardPreview() {
  const [current, setCurrent]       = useState(0);
  const [visible, setVisible]       = useState(true);
  const transitioningRef            = useRef(false);
  const timeoutRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef                  = useRef(0);

  // Keep currentRef in sync so the interval callback always has the latest value
  useEffect(() => { currentRef.current = current; }, [current]);

  const goTo = useCallback((i: number) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setVisible(false);
    // Clear any previously scheduled timeout before creating a new one
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrent(i);
      setVisible(true);
      transitioningRef.current = false;
      timeoutRef.current = null;
    }, 200);
  }, []);

  // Auto-advance — uses currentRef so the interval never needs to be recreated
  useEffect(() => {
    const id = setInterval(() => {
      goTo((currentRef.current + 1) % SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(id);
  }, [goTo]);                          // goTo is stable (useCallback, no deps)

  // Cleanup any pending timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const SlideComp = SLIDES[current];

  return (
    <ScaledCanvas>
      <PaperBg/>

      <div style={{
        position:"absolute", inset:0,
        opacity:visible ? 1 : 0,
        transform:visible ? "scale(1)" : "scale(0.97)",
        transition:"opacity 0.2s ease, transform 0.2s ease",
      }}>
        <SlideComp active={visible}/>
      </div>

      <SlideBadge name={SLIDE_NAMES[current]}/>
      <NavDots total={SLIDES.length} current={current} onDotClick={goTo}/>
    </ScaledCanvas>
  );
}