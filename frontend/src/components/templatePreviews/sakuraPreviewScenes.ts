/**
 * Curated demo scenes for the Sakura template preview (landscape + portrait).
 *
 * These are REAL Sakura layouts with their real prop names, fed to the actual
 * SakuraVideoComposition so the preview reflects true template output. The arc
 * — intro → stat → quote → ending — also exercises Sakura's signature
 * transitions (leaving sakura_intro fires the petal curtain; the ending fades
 * clean). Kept in one place so the landscape and portrait previews can't drift.
 */
export interface SakuraDemoScene {
  id: number;
  order: number;
  title: string;
  narration: string;
  layout: string;
  layoutProps: Record<string, unknown>;
  durationSeconds: number;
  imageUrl?: string;
}

export const SAKURA_PREVIEW_SCENES: SakuraDemoScene[] = [
  {
    id: 1,
    order: 0,
    title: "桜",
    narration: "The brief, brilliant season of the cherry blossom.",
    layout: "sakura_intro",
    layoutProps: {
      kanjiTitle: "桜",
      romanTitle: "SAKURA",
      tagline: "The brief, brilliant season of the cherry blossom.",
      author: "A Field Almanac",
    },
    durationSeconds: 4,
  },
  {
    id: 2,
    order: 1,
    title: "In Full Bloom",
    narration: "",
    layout: "sakura_stat_highlight",
    layoutProps: {
      stat: "72%",
      statLabel: "In Full Bloom",
      context: "of the trees reach peak flowering in the same week.",
    },
    durationSeconds: 5,
  },
  {
    id: 3,
    order: 2,
    title: "A single fallen petal",
    narration: "The blossom teaches us that beauty is fleeting.",
    layout: "sakura_quote",
    layoutProps: {
      quote: "花は桜木、人は武士",
      quoteRoman: "Hana wa sakuragi, hito wa bushi",
      quoteTranslation:
        "Among flowers, the cherry blossom; among people, the noble spirit.",
      attribution: "Old Japanese proverb",
    },
    durationSeconds: 5,
  },
  {
    id: 4,
    order: 3,
    title: "Hanami Journal",
    narration: "Follow the bloom, season after season.",
    layout: "sakura_ending_socials",
    layoutProps: {
      brandName: "Hanami Journal",
      tagline: "Follow the bloom, season after season.",
      ctaText: "Read the almanac",
      websiteUrl: "hanamijournal.jp",
      socialHandles: ["@hanamijournal", "@sakurawatch"],
    },
    durationSeconds: 4,
  },
];
