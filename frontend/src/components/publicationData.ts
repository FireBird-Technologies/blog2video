// Shared publication data used by PlatformShowcaseSection and UserReviewsSection.

export interface Publication {
  id: string;
  name: string;
  /** Local public/ file — primary source. */
  logoSrc: string;
  /**
   * Remote URL tried before logoSrc — only set for publications where the
   * live logo is preferable to the local file (e.g. christianleadership).
   */
  fetchUrl?: string;
  initials: string;
  avatarBg: string;
}

function publicAsset(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `/${encodeURI(p)}`;
}

export const PUBLICATIONS: Publication[] = [
  {
    id: "betweenthinkingdoing",
    name: "Between Thinking & Doing",
    logoSrc: publicAsset("pub-betweenthinkingdoing.png"),
    initials: "BT",
    avatarBg: "bg-rose-500",
  },
  {
    id: "lextrading",
    name: "lextrading",
    logoSrc: publicAsset("pub-lextrading.png"),
    initials: "LX",
    avatarBg: "bg-emerald-600",
  },
  {
    id: "currentrevolt",
    name: "Current Revolt",
    logoSrc: publicAsset("pub-currentrevolt.png"),
    initials: "CR",
    avatarBg: "bg-orange-500",
  },
  {
    id: "christianleadership",
    name: "Christian Leadership",
    fetchUrl: "https://www.google.com/s2/favicons?domain=christianleadership.now&sz=128",
    logoSrc: publicAsset("pub-christianleadership.png"),
    initials: "CL",
    avatarBg: "bg-indigo-500",
  },
   {
    id: "Firebird Technologies",
    name: "Firebird technologies",
    logoSrc: publicAsset("Logo-Firebird.webp"),
    initials: "FB",
    avatarBg: "bg-indigo-500",
  },
];

export const pubById = Object.fromEntries(PUBLICATIONS.map((p) => [p.id, p]));
