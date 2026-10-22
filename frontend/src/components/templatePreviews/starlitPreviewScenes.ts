import type { StarlitScene } from "../remotion/starlit/StarlitVideoComposition";

/**
 * Curated scenes used by the Starlit template picker preview. Keeping this data
 * shared lets the landscape and portrait cards show the same real composition.
 */
export const STARLIT_PREVIEW_SCENES: StarlitScene[] = [
  {
    id: 1,
    order: 1,
    title: "Mapping the Hidden Architecture of the Cosmos",
    narration:
      "Follow the light of distant stars and discover how every observation brings the universe into sharper focus.",
    layout: "cosmic_hero",
    layoutProps: { seed: 42 },
    durationSeconds: 7,
  },
  {
    id: 2,
    order: 2,
    title: "A Galaxy of Possibility",
    narration:
      "An estimated one hundred billion stars illuminate the Milky Way, with many likely hosting worlds of their own.",
    layout: "stat_callout",
    layoutProps: {
      statValue: "100",
      statSuffix: "B+",
      descriptor:
        "estimated stars illuminate our home galaxy, with many likely hosting planets of their own.",
      seed: 86,
    },
    durationSeconds: 7,
  },
  {
    id: 3,
    order: 3,
    title: "The Ringed Giant",
    narration:
      "Saturn's luminous rings are made from countless pieces of ice, rock, and dust.",
    layout: "ringed_planet",
    layoutProps: {
      heading: "The Ringed Giant",
      body:
        "Saturn's rings span about 282,000 kilometres, yet are only metres thick in places.",
      seed: 108,
    },
    durationSeconds: 7,
  },
  {
    id: 4,
    order: 4,
    title: "Gravity Connects Everything",
    narration:
      "Trace the forces that bind planets, stars, galaxies, and the largest structures in the universe.",
    layout: "galaxy_deep_dive",
    layoutProps: {
      heading: "Gravity",
      mapStyle: "orbit",
      nodes: [
        {
          label: "Planetary Orbits",
          children: [
            { label: "Stable Paths", text: "Gravity keeps worlds moving in predictable paths." },
            { label: "Tidal Forces", text: "Nearby bodies gently stretch and reshape one another." },
            { label: "Orbital Resonance", text: "Repeating alignments can stabilise entire planetary systems." },
          ],
        },
        { label: "Stellar Nurseries" },
        { label: "Galactic Clusters" },
        { label: "Cosmic Web" },
        { label: "Dark Matter" },
      ],
      seed: 142,
    },
    durationSeconds: 8,
  },
  {
    id: 5,
    order: 5,
    title: "Signals Across the Cosmos",
    narration: "Each observation adds another point to a pattern we can measure.",
    layout: "data_visualisation",
    layoutProps: {
      chartSummary:
        "The signal grows clearer as repeated observations reveal the underlying pattern.",
      xAxisLabel: "Observation period",
      yAxisLabel: "Signal strength",
      chartType: "line",
      chartTable: {
        headers: ["Orbit", "Signal", "Baseline"],
        rows: [
          ["Q1", "42", "35"],
          ["Q2", "57", "41"],
          ["Q3", "68", "49"],
          ["Q4", "81", "58"],
        ],
      },
      seed: 176,
    },
    durationSeconds: 7,
  },
  {
    id: 6,
    order: 6,
    title: "A Universe Worth Exploring",
    narration: "Starlit Observatory Notes",
    layout: "quote_card",
    layoutProps: {
      quote:
        "Every point of light carries evidence, history, and possibility.",
      attribution: "Starlit Observatory Notes",
      seed: 211,
    },
    durationSeconds: 7,
  },
  {
    id: 7,
    order: 7,
    title: "Starlit",
    narration: "Keep looking up. The next discovery is already on its way.",
    layout: "ending_socials",
    layoutProps: {
      brandName: "Starlit",
      tagline: "Keep exploring the universe",
      showWebsiteButton: true,
      websiteLink: "https://blog2video.ai",
      ctaButtonText: "Explore more",
      socials: [
        { platform: "instagram", enabled: "true", label: "Instagram" },
        { platform: "youtube", enabled: "true", label: "YouTube" },
        { platform: "linkedin", enabled: "true", label: "LinkedIn" },
      ],
      seed: 244,
    },
    durationSeconds: 7,
  },
];
