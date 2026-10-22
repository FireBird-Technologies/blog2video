import React, {useId} from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { FitText } from "../components/FitText";
import type { SceneLayoutProps } from "../types";
import { getStarlitFontFamily, getStarlitTypography } from "../typography";
import { resolveEnabledSocials, SOCIAL_ICONS } from "../../SocialIcons";
import { mixTheme, withOpacity } from "../components/themeColor";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const seeded = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

const readableDestination = (value?: string) => (value || "")
  .trim()
  .replace(/^https?:\/\//i, "")
  .replace(/^www\./i, "")
  .replace(/\/$/, "");

/** Eclipse closing frame: a dark disc crosses a bright star, leaving a corona; the destination sits in the disc. */
export const EndingSocials: React.FC<SceneLayoutProps> = (props) => {
  const thTxt = props.textColor || "#ffffff"; const thBg = props.bgColor || "#000000"; const thAcc = props.accentColor || "#217cff"; const thPale = mixTheme(thAcc, thTxt, .78); const thMid = mixTheme(thAcc, thTxt, .42);
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const uid = useId().replace(/:/g, "");
  const portrait = props.aspectRatio === "portrait" || height > width;
  const bg = props.bgColor || "#000000";
  const p = portrait;
  const type = getStarlitTypography({
    ...props,
    titleFontSize: props.titleFontSize ?? (p ? 106 : 76),
    descriptionFontSize: props.descriptionFontSize ?? (p ? 67 : 40),
  }, p);
  const font = getStarlitFontFamily(props);
  const accent = props.accentColor || "#217cff";
  const text = props.textColor || "#ffffff";
  const reveal = (from: number, to: number) => interpolate(frame, [from, to], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sceneIn = reveal(0, 20);
  const brandIn = reveal(10, 34);
  const messageIn = reveal(20, 50);
  const textInDisc = reveal(84, 124);
  const socialsIn = reveal(110, 170);
  const seconds = frame / fps;

  const enabledSocials = resolveEnabledSocials(props.socials);
  const handles = props.socialHandles || [];
  const isEnabled = (value: boolean | string | undefined) => value === undefined || value === true || String(value).toLowerCase() === "true";
  const ctas = (props.ctas?.length ? props.ctas : [{ ctaButtonText: props.ctaButtonText, websiteLink: props.websiteLink, showWebsiteButton: props.showWebsiteButton }])
    .filter((cta) => isEnabled(cta.showWebsiteButton) && Boolean(cta.websiteLink?.trim()))
    .slice(0, 3);
  const brand = (props.brandName || props.title || "").trim();
  const tagline = (props.tagline || props.narration || "").trim();
  const socials = enabledSocials.length > 0
    ? enabledSocials.map(({ key, item }) => ({ key: String(key), Icon: SOCIAL_ICONS[key], label: String(item.label || item.text || item.url || key).trim() }))
    : handles.map((handle, i) => ({ key: `h${i}`, Icon: undefined, label: String(handle) }));
  const hasSocials = socials.length > 0;

  // ── geometry ──
  const cx = width / 2;
  const R = Math.min(width, height) * (portrait ? .3 : .225);
  const cy = height * (portrait ? .43 : hasSocials ? .45 : .52);
  // Rim ignites: the black disc is already in place. A thin line of light starts at the top of the rim and
  // runs round both ways until the ring closes; the halo then fades up behind it. Nothing grows or moves.
  const ring = 1; // the ring is complete from the start; the whole eclipse simply fades up out of the dark
  const discX = cx;
  const discR = R;
  const coverage = interpolate(frame, [10, 90], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) }); // rim + halo fade up together
  const coronaPulse = 1 + .03 * Math.sin(seconds * .9);
  const starGlow = 0;
  const rimR = R + R * .004;
  const half = Math.PI * rimR; // length of half the circle
  const tip = (dir: number) => ({ x: cx + Math.sin(dir * ring * Math.PI) * rimR, y: cy - Math.cos(ring * Math.PI) * rimR });

  const lines = ctas.map((cta) => ({ dest: readableDestination(cta.websiteLink), label: cta.ctaButtonText?.trim() || "" }));
  const primary = lines[0];
  const innerW = R * 1.78;
  const mainSize = type.bodyIsUserSet ? type.body : portrait ? 84 : 78;
  const brandSize = type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 28 : 22);
  const taglineSize = type.titleIsUserSet ? type.title : type.titleRelative(portrait ? 76 : 56);
  const socialSize = type.bodyIsUserSet ? type.body : type.bodyRelative(portrait ? 24 : 20);

  const iconSize = portrait ? 58 : 56;
  const shell = portrait ? 78 : 74;
  const perRow = portrait ? Math.min(socials.length, 4) : Math.min(socials.length, 7);
  const socialsTop = cy + R + (portrait ? 96 : 56);
  const cw = Math.min(width * (portrait ? .88 : .78), 1300);
  const rowH = shell + 14 + 32 + (portrait ? 34 : 24);
  const slot = socials.map((_, i) => ({
    x: width / 2 - cw / 2 + ((i % perRow) + .5) * (cw / perRow),
    y: socialsTop + Math.floor(i / perRow) * rowH + shell / 2 + ((i % perRow) % 2 === 1 ? (portrait ? 20 : 30) : 0) + (seeded(i * 4.1 + 3) - .5) * 14, // a gentle zigzag so the links read as a constellation, not a ruler line
    row: Math.floor(i / perRow),
    col: i % perRow,
  }));
  // constellation between the little planets: neighbours along a row, and straight down a column
  const planetLinks: Array<[number, number]> = [];
  slot.forEach((a, i) => slot.forEach((b, j) => { if (j > i && ((a.row === b.row && b.col === a.col + 1) || (a.col === b.col && b.row === a.row + 1))) planetLinks.push([i, j]); }));
  // a few small twinkling stars scattered around the corona and the planets
  const sparks = Array.from({ length: portrait ? 16 : 22 }, (_, i) => {
    const ang = seeded(i * 3.7 + (props.seed ?? 42)) * Math.PI * 2;
    const rad = R * (1.35 + seeded(i * 5.3 + 1) * 1.5);
    return { x: cx + Math.cos(ang) * rad * (portrait ? .85 : 1.45), y: cy + Math.sin(ang) * rad * .8, r: .8 + seeded(i * 2.1 + 9) * 1.6, phase: seeded(i * 8.9) * 6.3 };
  });

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: font, opacity: sceneIn, overflow: "hidden" }}>
      <SpaceBackdrop seed={props.seed} density={portrait ? 150 : 170} brightness={.76} accentColor={accent} backgroundColor={bg} textColor={text} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id={`${uid}-corona`} cx="50%" cy="50%" r="50%">
            <stop offset="48.5%" stopColor={thTxt} stopOpacity="1" />
            <stop offset="50.5%" stopColor={thPale} stopOpacity=".96" />
            <stop offset="53%" stopColor={thMid} stopOpacity=".72" />
            <stop offset="58%" stopColor={thMid} stopOpacity=".48" />
            <stop offset="68%" stopColor={accent} stopOpacity=".24" />
            <stop offset="84%" stopColor={accent} stopOpacity=".07" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-star`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={thTxt} stopOpacity="1" />
            <stop offset="18%" stopColor={thPale} stopOpacity=".8" />
            <stop offset="50%" stopColor={accent} stopOpacity=".38" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* the halo fades up behind the ring once it has closed */}
        <circle cx={cx} cy={cy} r={R * 2.05 * coronaPulse} fill={`url(#${uid}-corona)`} opacity={Math.min(1, coverage * 1.15)} />
        {/* the black disc is simply there */}
        <circle cx={discX} cy={cy} r={discR} fill={thBg} />
      </svg>

      <div style={{ position: "absolute", left: "50%", top: portrait ? "8%" : "7%", width: portrait ? "calc(100% - 160px)" : "72%", maxWidth: portrait ? 900 : 1220, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        {brand ? <FitText targetPx={brandSize} minPx={12} maxHeightPx={height * .05} maxWidthPx={portrait ? Math.min(width - 160, 900) : Math.min(width * .72, 1220)} fitKey={`ending-brand:${brand}:${portrait}`} exact={type.bodyIsUserSet} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: portrait ? 17 : 14, color: withOpacity(thTxt,.78), lineHeight: 1, fontWeight: 650, letterSpacing: ".18em", textTransform: "uppercase", whiteSpace: "nowrap", opacity: brandIn, transform: `translateY(${(1 - brandIn) * 10}px)` }}>
          <span style={{ width: portrait ? 9 : 7, height: portrait ? 9 : 7, borderRadius: "50%", background: accent, boxShadow: `0 0 18px ${accent}` }} />
          {brand}
        </FitText> : null}
        {tagline ? <FitText targetPx={taglineSize} minPx={portrait ? 30 : 27} maxHeightPx={height * .14} fitKey={`ending-tagline:${tagline}:${portrait}`} exact={type.titleIsUserSet} style={{ color: text, lineHeight: 1.05, fontWeight: 680, letterSpacing: "-.04em", maxWidth: portrait ? 860 : 1100, marginTop: brand ? (portrait ? 34 : 24) : 0, overflowWrap: "break-word", opacity: messageIn, transform: `translateY(${(1 - messageIn) * 20}px)` }}>{tagline}</FitText> : null}
      </div>

      {/* the destination, set inside the disc */}
      {primary ? (
        <div style={{ position: "absolute", left: cx - innerW / 2, top: cy - R, width: innerW, height: R * 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: textInDisc, transform: `scale(${.94 + textInDisc * .06})` }}>
          <FitText targetPx={mainSize} minPx={11} maxHeightPx={R * .34} maxWidthPx={innerW * .92} fitKey={`ending-primary:${primary.dest}:${portrait}`} exact={type.bodyIsUserSet} style={{ color: text, fontWeight: 700, letterSpacing: "-.035em", lineHeight: 1.05, whiteSpace: "nowrap" }}>{primary.dest}</FitText>
          {primary.label ? <FitText targetPx={Math.max(16, mainSize * .3)} minPx={10} maxHeightPx={R * .15} maxWidthPx={innerW * .92} fitKey={`ending-label:${primary.label}:${portrait}`} exact={type.bodyIsUserSet} style={{ color: withOpacity(thTxt,.62), fontWeight: 600, letterSpacing: ".18em", lineHeight: 1.05, textTransform: "uppercase", marginTop: mainSize * .22, whiteSpace: "nowrap" }}>{primary.label}</FitText> : null}
          {lines.slice(1).map((l, i) => <FitText key={i} targetPx={Math.max(16, mainSize * .4)} minPx={10} maxHeightPx={R * .15} maxWidthPx={innerW * .92} fitKey={`ending-extra:${l.dest}:${portrait}`} exact={type.bodyIsUserSet} style={{ color: withOpacity(thTxt,.75), fontWeight: 600, lineHeight: 1.05, marginTop: mainSize * .16, whiteSpace: "nowrap" }}>{l.dest}</FitText>)}
        </div>
      ) : null}

      {/* sparkle: small twinkling stars around the corona */}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <defs>
          <radialGradient id={`${uid}-pl`}>
            <stop offset="0%" stopColor={thTxt} stopOpacity=".5" />
            <stop offset="30%" stopColor={accent} stopOpacity=".42" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g opacity={coverage}>
          {sparks.map((st, i) => {
            const tw = Math.pow(.5 + .5 * Math.sin(seconds * 1.6 + st.phase), 2);
            return <g key={`sp${i}`} opacity={.25 + tw * .75}>
              <circle cx={st.x} cy={st.y} r={st.r * 4.5} fill={accent} opacity=".18" />
              <circle cx={st.x} cy={st.y} r={st.r} fill={thTxt} />
            </g>;
          })}
        </g>
        {/* constellation lines between the little planets */}
        {planetLinks.map(([i, j], k) => {
          const a2 = slot[i], b2 = slot[j];
          const draw = interpolate(socialsIn, [Math.min(.9, j * .07), Math.min(1, j * .07 + .45)], [0, 1], clamp);
          return <line key={`pl${k}`} x1={a2.x} y1={a2.y} x2={a2.x + (b2.x - a2.x) * draw} y2={a2.y + (b2.y - a2.y) * draw} stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity=".7" />;
        })}
        {slot.map((st, i) => {
          const pop = interpolate(socialsIn, [i * .07, i * .07 + .4], [0, 1], clamp);
          const glint = Math.pow(Math.max(0, Math.sin(seconds * .9 + i * 1.7)), 6);
          return <g key={`ph${i}`} opacity={pop}>
            <circle cx={st.x} cy={st.y} r={shell * (1.05 + glint * .25)} fill={`url(#${uid}-pl)`} opacity={.8 + glint * .2} />
            <circle cx={st.x} cy={st.y} r={shell * .74} fill="none" stroke={thPale} strokeOpacity=".4" strokeWidth="1" strokeDasharray="2 6" transform={`rotate(${seconds * 6 + i * 40} ${st.x} ${st.y})`} />
          </g>;
        })}
      </svg>

      {/* the socials: little planets joined into a constellation under the disc */}
      {socials.map(({ key, Icon, label }, i) => {
        const pop = interpolate(socialsIn, [i * .07, i * .07 + .4], [0, 1], clamp);
        const st = slot[i];
        return (
          <div key={key} style={{ position: "absolute", left: st.x, top: st.y - shell / 2, transform: `translateX(-50%) translateY(${(1 - pop) * 12}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: portrait ? 14 : 12, color: withOpacity(thTxt,.92), fontSize: socialSize, fontWeight: 620, lineHeight: 1.1, textAlign: "center", opacity: pop }}>
            {Icon ? <div style={{ width: shell, height: shell, borderRadius: "50%", background: mixTheme(thBg,thAcc,.1), border: `1.5px solid ${accent}`, boxShadow: `0 0 26px ${withOpacity(accent, .4)}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={iconSize * .78} /></div> : <div style={{ height: shell }} />}
            <FitText targetPx={socialSize} minPx={11} maxHeightPx={portrait ? 34 : 29} maxWidthPx={cw / perRow - 12} fitKey={`social:${label}:${portrait}:${perRow}`} exact={type.bodyIsUserSet} style={{ whiteSpace: "nowrap", textShadow: `0 0 16px ${thBg}, 0 0 30px ${thBg}` }}>{label}</FitText>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
