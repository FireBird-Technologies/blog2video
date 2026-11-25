import type { ChristmasScene } from "../remotion/christmas/ChristmasVideoComposition";

/**
 * Curated scenes for the Snowy Christmas template picker preview — one per layout,
 * opening to closing, shared by the landscape and portrait cards (and BlogDemoPlayer).
 */
export const CHRISTMAS_PREVIEW_SCENES: ChristmasScene[] = [
  {
    "id": 1,
    "order": 0,
    "title": "A Very Merry Season",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Everything you need to make this Christmas the brightest one yet.",
    "layout": "santa_hero",
    "layoutProps": {},
    "durationSeconds": 6
  },
  {
    "id": 2,
    "order": 1,
    "title": "Why traditions matter",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Small rituals repeated every December give families a shared story. They slow the season down and turn ordinary evenings into memories that last for years.",
    "layout": "snowy_narration",
    "layoutProps": {},
    "durationSeconds": 6,
    "imageUrl": "/assets/christmas-cottage.svg"
  },
  {
    "id": 3,
    "order": 2,
    "title": "Look out the window",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "The first real snowfall changes how a whole town feels overnight, from the quiet streets to the glow of every window.",
    "layout": "frosted_window",
    "layoutProps": {
      "imageCaption": "The view tonight"
    },
    "durationSeconds": 6,
    "imageUrl": "/assets/christmas-tree-gifts.svg"
  },
  {
    "id": 4,
    "order": 3,
    "title": "Holiday shopping by the numbers",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Most gifts are now bought online, and the average family spends more every year.",
    "layout": "gift_stat",
    "layoutProps": {
      "stats": [
        {
          "value": "73%",
          "label": "shop online"
        },
        {
          "value": "$1,000",
          "label": "avg. spend"
        }
      ]
    },
    "durationSeconds": 6
  },
  {
    "id": 5,
    "order": 4,
    "title": "A calmer Christmas plan",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Four habits that take the stress out of the season.",
    "layout": "tree_list",
    "layoutProps": {
      "items": [
        "Set a realistic gift budget",
        "Shop early for the best prices",
        "Wrap presents as you go",
        "Keep every receipt together"
      ]
    },
    "durationSeconds": 6
  },
  {
    "id": 6,
    "order": 5,
    "title": "A thought for the season",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Christmas is not a time nor a season, but a state of mind.",
    "layout": "letter_quote",
    "layoutProps": {
      "quote": "Christmas is not a time nor a season, but a state of mind.",
      "attribution": "Calvin Coolidge"
    },
    "durationSeconds": 6
  },
  {
    "id": 7,
    "order": 6,
    "title": "Real or artificial?",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Both trees have loyal fans, for very different reasons.",
    "layout": "snow_compare",
    "layoutProps": {
      "leftLabel": "Real tree",
      "leftPoints": ["Fresh pine scent", "A yearly trip to the farm", "Needles to sweep up", "Bought new every year"],
      "rightLabel": "Artificial",
      "rightPoints": ["No natural scent", "Set up in minutes", "No needles to clean", "Reused for years"]
    },
    "durationSeconds": 6
  },
  {
    "id": 8,
    "order": 7,
    "title": "Countdown to the big day",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Spread the work across December and nothing piles up.",
    "layout": "snowball_steps",
    "layoutProps": {
      "steps": [
        {
          "label": "Dec 1",
          "text": "Plan the guest list and the menu"
        },
        {
          "label": "Dec 10",
          "text": "Order gifts and decorations"
        },
        {
          "label": "Dec 20",
          "text": "Wrap, bake and get the house ready"
        }
      ]
    },
    "durationSeconds": 6
  },
  {
    "id": 9,
    "order": 8,
    "title": "Orders climb toward Christmas",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Weekly orders nearly tripled in the four weeks before Christmas.",
    "layout": "data_visualisation",
    "layoutProps": {
      "chartType": "bar",
      "xAxisLabel": "Week",
      "yAxisLabel": "Orders",
      "chartTable": {
        "headers": [
          "Week",
          "Orders"
        ],
        "rows": [
          [
            "Nov 25",
            "120"
          ],
          [
            "Dec 2",
            "180"
          ],
          [
            "Dec 9",
            "260"
          ],
          [
            "Dec 16",
            "310"
          ]
        ]
      }
    },
    "durationSeconds": 6
  },
  {
    "id": 10,
    "order": 9,
    "title": "Merry Christmas!",
    "narration": "Sample narration for this scene about getting ready for Christmas.",
    "displayText": "Thanks for watching, and see you in the new year.",
    "layout": "ending_socials",
    "layoutProps": {
      "socials": [
        {
          "platform": "instagram",
          "enabled": "true",
          "label": "@yourbrand"
        },
        {
          "platform": "youtube",
          "enabled": "true",
          "label": "YourBrand"
        },
        {
          "platform": "linkedin",
          "enabled": "true",
          "label": "Your Brand"
        }
      ],
      "ctas": [
        {
          "ctaButtonText": "Shop the gift guide",
          "websiteLink": "https://yourwebsite.com",
          "showWebsiteButton": "true"
        }
      ]
    },
    "durationSeconds": 6
  }
];
