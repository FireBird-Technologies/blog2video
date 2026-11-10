// The Blog2Video extension is a Chrome Web Store extension, so it only installs
// in desktop Chromium browsers (Chrome, Edge, Brave, Opera, ...). Safari and
// Firefox can't install it, and mobile browsers don't support extensions at all.

interface NavigatorWithUAData extends Navigator {
  userAgentData?: { brands?: { brand: string }[]; mobile?: boolean };
}

export function supportsChromeExtensions(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithUAData;
  const ua = nav.userAgent || "";

  // Mobile (incl. Chrome on iOS "CriOS" / Android) can't install extensions.
  if (nav.userAgentData?.mobile) return false;
  if (/Android|iPhone|iPad|iPod|CriOS|EdgiOS|FxiOS|OPT\//i.test(ua)) return false;

  // Firefox and Safari: never.
  if (/Firefox\//i.test(ua)) return false;

  // Prefer UA Client Hints (Chrome, Edge, Brave, Opera all report "Chromium").
  const brands = nav.userAgentData?.brands;
  if (brands?.length) return brands.some((b) => /Chromium/i.test(b.brand));

  // Fallback: every Chromium browser (Brave, Edge "Edg/", Opera "OPR/") keeps
  // "Chrome/" in its UA; Safari does not.
  return /Chrome\/|Chromium\//i.test(ua);
}
