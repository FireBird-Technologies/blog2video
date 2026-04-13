import { useInsertionEffect } from "react";

const STYLE_ELEMENT_ID = "blog2video-bsw-bird-motion";

/**
 * Only bird path / flight animations (SVG `d` morph + transform paths).
 * Water rings, droplet, swan stroke, stars, and dive are frame-driven in their components.
 */
const BLACKSWAN_BIRD_KEYFRAMES_CSS = `
@keyframes bsw-wflap-l {
  0%   { d: path("M0 0 C-4 -2 -9 -4 -14 -1 C-9 2 -4 1 0 0"); }
  25%  { d: path("M0 0 C-4 -8 -10 -12 -15 -8 C-10 -2 -4 0 0 0"); }
  50%  { d: path("M0 0 C-4 -11 -11 -15 -16 -11 C-10 -4 -4 -1 0 0"); }
  75%  { d: path("M0 0 C-4 -6 -10 -9 -14 -5 C-9 0 -4 0 0 0"); }
  100% { d: path("M0 0 C-4 -2 -9 -4 -14 -1 C-9 2 -4 1 0 0"); }
}
@keyframes bsw-wflap-r {
  0%   { d: path("M0 0 C4 -2 9 -4 14 -1 C9 2 4 1 0 0"); }
  25%  { d: path("M0 0 C4 -8 10 -12 15 -8 C10 -2 4 0 0 0"); }
  50%  { d: path("M0 0 C4 -11 11 -15 16 -11 C10 -4 4 -1 0 0"); }
  75%  { d: path("M0 0 C4 -6 10 -9 14 -5 C9 0 4 0 0 0"); }
  100% { d: path("M0 0 C4 -2 9 -4 14 -1 C9 2 4 1 0 0"); }
}
@keyframes bsw-chirp {
  0%,40%,100% { transform: scale(1); }
  20%         { transform: scale(1.08); }
}
@keyframes bsw-b1 {
  0%{ transform: translate(0,0) scale(1); opacity: 0; }
  4%{ opacity: 1; }
  30%{ transform: translate(195px,-96px) scale(0.8); }
  60%{ transform: translate(450px,-70px) scale(0.63); }
  85%{ transform: translate(710px,-120px) scale(0.48); }
  100%{ transform: translate(990px,-150px) scale(0.36); opacity: 0; }
}
@keyframes bsw-b2 {
  0%{ transform: translate(0,0) scale(1); opacity: 0; }
  4%{ opacity: 1; }
  25%{ transform: translate(-80px,-118px) scale(0.82); }
  55%{ transform: translate(-300px,-86px) scale(0.65); }
  80%{ transform: translate(-558px,-134px) scale(0.5); }
  100%{ transform: translate(-860px,-165px) scale(0.36); opacity: 0; }
}
@keyframes bsw-b3 {
  0%{ transform: translate(0,0) scale(1); opacity: 0; }
  4%{ opacity: 1; }
  35%{ transform: translate(112px,-148px) scale(0.78); }
  65%{ transform: translate(300px,-108px) scale(0.61); }
  100%{ transform: translate(620px,-186px) scale(0.42); opacity: 0; }
}
@keyframes bsw-b4 {
  0%{ transform: translate(0,0) scale(1); opacity: 0; }
  4%{ opacity: 1; }
  20%{ transform: translate(-52px,-66px) scale(0.88); }
  50%{ transform: translate(-198px,-116px) scale(0.71); }
  80%{ transform: translate(-415px,-84px) scale(0.55); }
  100%{ transform: translate(-652px,-155px) scale(0.39); opacity: 0; }
}
@keyframes bsw-b5 {
  0%{ transform: translate(0,0) scale(1); opacity: 0; }
  4%{ opacity: 1; }
  40%{ transform: translate(70px,-84px) scale(0.77); }
  70%{ transform: translate(242px,-152px) scale(0.61); }
  100%{ transform: translate(500px,-114px) scale(0.43); opacity: 0; }
}
`;

function ensureBirdKeyframesInDocument(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ELEMENT_ID;
  el.textContent = BLACKSWAN_BIRD_KEYFRAMES_CSS;
  document.head.appendChild(el);
}

/** Call from any layout that renders `BlackswanFlock` / animated birds (idempotent). */
export function useBlackswanBirdMotion(): void {
  useInsertionEffect(() => {
    ensureBirdKeyframesInDocument();
  }, []);
}
