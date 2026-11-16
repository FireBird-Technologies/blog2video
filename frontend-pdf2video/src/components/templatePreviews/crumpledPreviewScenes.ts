import type { CrumpledScene } from "../remotion/crumpled/CrumpledVideoComposition";

/**
 * Curated scenes for the Crumpled Paper template picker preview — one per layout,
 * opening to closing, shared by the landscape and portrait cards.
 */
export const CRUMPLED_PREVIEW_SCENES: CrumpledScene[] = [
  {
    "id": 1,
    "order": 0,
    "title": "How Ideas Get Made",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Sketch, scrap, and refine until the shape of a good idea appears.",
    "layout": "paper_hero",
    "layoutProps": {},
    "durationSeconds": 6
  },
  {
    "id": 2,
    "order": 1,
    "title": "Start messy on purpose",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Most good ideas begin as scribbles nobody else would understand. Early drafts are for thinking, not for showing. Giving yourself permission to be rough makes it easier to explore, discard, and try again without fear.",
    "layout": "sketch_narration",
    "layoutProps": {},
    "durationSeconds": 6
  },
  {
    "id": 3,
    "order": 2,
    "title": "Look at the real thing",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Reference material keeps sketches honest. A photo taped beside the page reminds you what you are actually drawing.",
    "layout": "taped_image",
    "layoutProps": {
      "imageCaption": "Field reference, 2026"
    },
    "durationSeconds": 6,
    "imageUrl": "/assets/earth-blue-marble.jpg"
  },
  {
    "id": 4,
    "order": 3,
    "title": "Drafts before the keeper",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "37% of designers say their final concept came from a discarded early sketch, after about 4 drafts on average.",
    "layout": "pencil_stat",
    "layoutProps": {
      "stats": [
        {
          "value": "37%"
        },
        {
          "value": "4"
        }
      ]
    },
    "durationSeconds": 6
  },
  {
    "id": 5,
    "order": 4,
    "title": "Habits that help",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Small routines that keep the ideas coming.",
    "layout": "sticky_list",
    "layoutProps": {
      "items": [
        "Keep a notebook within reach",
        "Date every page",
        "Never erase — cross out",
        "Revisit old pages weekly"
      ]
    },
    "durationSeconds": 6
  },
  {
    "id": 6,
    "order": 5,
    "title": "Quote",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "layout": "torn_quote",
    "layoutProps": {
      "quote": "The wastebasket is the writer's best friend.",
      "attribution": "Isaac Bashevis Singer"
    },
    "durationSeconds": 6
  },
  {
    "id": 7,
    "order": 6,
    "title": "Sketch vs. polish",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "layout": "fold_comparison",
    "layoutProps": {
      "leftLabel": "Sketching",
      "leftText": "Fast, cheap and disposable. The goal is quantity of options and quick feedback.",
      "rightLabel": "Polishing",
      "rightText": "Slow and deliberate. The goal is quality, consistency and finishing details."
    },
    "durationSeconds": 6
  },
  {
    "id": 8,
    "order": 7,
    "title": "Ideas per week",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Teams that sketch daily generate far more usable ideas each week.",
    "layout": "data_visualisation",
    "layoutProps": {
      "chartType": "bar",
      "xAxisLabel": "Week",
      "yAxisLabel": "Ideas",
      "chartTable": {
        "headers": [
          "Week",
          "Sketch daily",
          "Sketch rarely"
        ],
        "rows": [
          [
            "W1",
            "12",
            "5"
          ],
          [
            "W2",
            "18",
            "6"
          ],
          [
            "W3",
            "24",
            "7"
          ],
          [
            "W4",
            "31",
            "8"
          ]
        ]
      }
    },
    "durationSeconds": 6
  },
  {
    "id": 9,
    "order": 8,
    "title": "Keep sketching. Keep tearing it up.",
    "narration": "Sample narration for this scene about sketching and drafting ideas on paper.",
    "displayText": "Thanks for reading — see you on the next page.",
    "layout": "ending_socials",
    "layoutProps": {
      "websiteLink": "https://blog2video.app",
      "ctaButtonText": "Make your own",
      "showWebsiteButton": true,
      "socials": [
        {
          "platform": "youtube",
          "enabled": "true",
          "label": "YouTube"
        },
        {
          "platform": "instagram",
          "enabled": "true",
          "label": "Instagram"
        },
        {
          "platform": "linkedin",
          "enabled": "true",
          "label": "LinkedIn"
        }
      ]
    },
    "durationSeconds": 6
  }
];
