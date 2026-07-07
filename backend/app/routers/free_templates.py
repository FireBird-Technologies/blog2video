import io
import json
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User


router = APIRouter(prefix="/api/templates", tags=["free-templates"])

_REPO_ROOT = Path(__file__).parent.parent.parent.parent
_REMOTION_SRC = _REPO_ROOT / "remotion-video" / "src"
REMOTION_TEMPLATES_DIR = _REMOTION_SRC / "templates"
REMOTION_COMPONENTS_DIR = _REMOTION_SRC / "components"
REMOTION_FONTS_DIR = _REMOTION_SRC / "fonts"
B2V_LOGO_PATH = _REPO_ROOT / "frontend" / "public" / "b2b.png"

# Files from src/components/ needed by all free templates
SHARED_COMPONENTS = [
    "B2VWatermark.tsx",
    "LogoOverlay.tsx",
    "Transitions.tsx",
]

# Files from src/fonts/ needed by all free templates
SHARED_FONTS = [
    "registry.ts",
    "nightfall-defaults.ts",
]

# Files from src/templates/ root (siblings of template folders)
SHARED_TEMPLATE_ROOT = [
    "SocialIcons.tsx",
    "playbackSpeed.ts",
]

# slug → (display_name, dir_name)
FREE_TEMPLATES: dict[str, tuple[str, str]] = {
    "geometric-explainer": ("Geometric Explainer", "default"),
    "nightfall":           ("Nightfall",           "nightfall"),
    "spotlight":           ("Spotlight",           "spotlight"),
    "matrix":              ("Matrix",              "matrix"),
    "gridcraft":           ("Gridcraft",           "gridcraft"),
}

SOURCE_EXTENSIONS = {".ts", ".tsx", ".css"}

# ─── Per-template style.md content ────────────────────────────────────────────

STYLE_MDS: dict[str, str] = {
    "geometric-explainer": """\
# Geometric Explainer — Style Guide

**Composition ID:** `DefaultVideo`

## Visual Identity

- **Background:** Pure white (`#FFFFFF`) — clean, distraction-free canvas
- **Accent color:** Deep purple (`#7C3AED`) — used for highlights, borders, and key labels
- **Text color:** Near-black (`#000000` / `#1F2937`) — maximum legibility on white
- **Surface color:** Light gray (`#F9FAFB`) — used for cards and code blocks

## Typography

- **Primary font:** Inter (sans-serif) — used for all body text and labels
- **Heading weight:** 700–800 — bold structural hierarchy
- **Code font:** JetBrains Mono — syntax-highlighted code blocks
- **Line height:** 1.5–1.6 — optimized for on-screen reading at video scale

## Layouts Available

| Layout | Use Case |
|---|---|
| `hero_image` | Opening title with optional image backdrop |
| `text_narration` | Body paragraphs and explanations |
| `bullet_list` | Step-by-step lists and feature sets |
| `code_block` | Syntax-highlighted code with language label |
| `comparison` | Side-by-side contrast view |
| `flow_diagram` | Visual process flows |
| `metric` | Single large KPI or stat |
| `quote_callout` | Pull quote with left accent stripe |
| `data_visualization` | Bar, pie, and line charts |
| `timeline` | Chronological event sequences |
| `animated_image` | Image with zoom/pan animation |
| `image_caption` | Image with bottom caption |
| `ending_socials` | Outro with social handles |

## Motion Principles

- **Entrance style:** Fade + slight upward translate (20–30px)
- **Timing:** Spring physics (damping 20, stiffness 60) for natural deceleration
- **Code lines:** Staggered reveal at 60ms intervals per line
- **Charts:** Bars animate from zero, pies draw clockwise
- **Transitions:** Wipe left-to-right between scenes

## Tone

Structured, educational, developer-friendly. Works best for tutorials, how-to
guides, documentation walkthroughs, and technical explainers. The white
background keeps focus on the content rather than the template.

---

## Blog2Video

This template is powered by Blog2Video — paste any blog URL to generate a
structured, narrated video using this template automatically.

https://blog2video.com | Built by FireBird Technologies (https://firebird-technologies.com)
""",

    "nightfall": """\
# Nightfall — Style Guide

**Composition ID:** `NightfallVideo`

## Visual Identity

- **Background:** Deep navy-black (`#0A0A1A`) — cinematic dark canvas
- **Accent color:** Indigo-violet (`#818CF8`) — glows on dark backgrounds
- **Text color:** Soft white (`#E2E8F0`) — high contrast without harshness
- **Card surface:** Semi-transparent white (`rgba(255,255,255,0.06)`) with blur — glass morphism

## Typography

- **Primary font:** Playfair Display (serif) for titles — editorial authority
- **Body font:** Inter (sans-serif) — readable narration text
- **Title weight:** 800 — maximum visual impact at large sizes
- **Letter spacing:** −0.01em on titles — tight and intentional

## Layouts Available

| Layout | Use Case |
|---|---|
| `cinematic_title` | Full-frame hero title with image reveal |
| `glass_narrative` | Body text on translucent card |
| `glass_stack` | Stacked glass cards for lists |
| `glass_code` | Syntax-highlighted code on dark glass |
| `glass_image` | Full-bleed image with glass overlay |
| `split_glass` | Two-column glass panel layout |
| `glow_metric` | Large number with neon glow |
| `kinetic_insight` | Animated quote with highlighted keyword |
| `chapter_break` | Section divider with number + subtitle |
| `data_visualization` | Charts rendered on dark background |
| `ending_socials` | Outro with social handles |

## Motion Principles

- **Entrance style:** Blur fade + slight scale from 1.02 → 1.0
- **Title reveal:** Spring with overshoot (stiffness 80, mass 1.2)
- **Glass cards:** Fade in with `backdrop-filter: blur(20px)` on entrance
- **Image reveal:** Delayed 70 frames after text — cinematic build
- **Accent lines:** Width animates from 0 → 100% with glow pulse
- **Transitions:** Dark overlay with blur ramp + scale push between scenes

## Tone

Cinematic, premium, editorial. Works best for long-form analysis, tech deep
dives, product stories, and any content where visual atmosphere should match
the weight of the subject.

---

## Blog2Video

This template is powered by Blog2Video — paste any blog URL to generate a
cinematic, narrated video using Nightfall automatically.

https://blog2video.com | Built by FireBird Technologies (https://firebird-technologies.com)
""",

    "spotlight": """\
# Spotlight — Style Guide

**Composition ID:** `SpotlightVideo`

## Visual Identity

- **Background:** Solid black (`#000000`) — maximum contrast stage
- **Accent color:** Vivid red (`#EF4444`) — punchy, high-energy emphasis
- **Text color:** Pure white (`#FFFFFF`) — stark contrast for bold statements
- **Secondary text:** Medium gray (`#9CA3AF`) — supporting context

## Typography

- **Primary font:** Inter Black (weight 900) — impact-first hierarchy
- **Display size:** Up to 160px for single-word layouts
- **Letter spacing:** −0.03em on large titles — ultra-tight for YouTube aesthetic
- **All caps:** Used on category labels and CTA text

## Layouts Available

| Layout | Use Case |
|---|---|
| `impact_title` | Giant full-frame headline |
| `statement` | Centered claim with one highlighted keyword |
| `versus` | Red/white split comparison |
| `cascade_list` | Items cascade in from the side one by one |
| `rapid_points` | Short phrases with hard cuts between each |
| `word_punch` | Single word fills the entire frame |
| `stat_stage` | Large number centered with label |
| `spotlight_image` | Full-bleed image with text overlay |
| `closer` | Call-to-action closing scene |
| `ending_socials` | Outro with social handles |

## Motion Principles

- **Entrance style:** Snap-in from bottom (translateY 60px → 0) with spring overshoot
- **Statement keyword:** Scale pulse + color flash on reveal
- **Versus split:** Left and right halves slide in from opposite edges simultaneously
- **Cascade items:** 80ms stagger, each slides from left with opacity 0 → 1
- **Rapid points:** Hard cut with 2-frame flash between each phrase
- **Transitions:** 8-frame hard flash cut — abrupt, high-energy

## Tone

Bold, kinetic, YouTube-native. Works best for social clips, YouTube explainers,
product launches, and any content where attention must be captured in the first
two seconds. Pacing is intentionally fast.

---

## Blog2Video


This template is powered by Blog2Video — paste any blog URL to generate a
bold, kinetic video using Spotlight automatically.

https://blog2video.com | Built by FireBird Technologies (https://firebird-technologies.com)
""",

    "matrix": """\
# Matrix — Style Guide

**Composition ID:** `MatrixVideo`

## Visual Identity

- **Background:** Pure black (`#000000`) — terminal canvas
- **Accent color:** Matrix green (`#00FF41`) — the iconic terminal phosphor color
- **Text color:** Matrix green (`#00FF41`) — all primary text matches the terminal aesthetic
- **Secondary:** Dimmed green (`rgba(0,255,65,0.45)`) — supporting and metadata text
- **Rain columns:** Cascading green characters — animated background ambience

## Typography

- **Primary font:** JetBrains Mono / Courier New — monospace only, no exceptions
- **Weight:** 400 normal, 700 bold for terminal output emphasis
- **Letter spacing:** 0.05–0.1em — spaced like a real terminal
- **Line height:** 1.4 — tight terminal line spacing

## Layouts Available

| Layout | Use Case |
|---|---|
| `awakening` | Full-frame wake sequence opening |
| `terminal_text` | Character-by-character typewriter reveal |
| `data_stream` | Items reveal like incoming terminal log lines |
| `fork_choice` | Red/blue split — two paths decision layout |
| `cipher_metric` | Number decodes from cipher noise |
| `glitch_punch` | Single word slams in with glitch effect |
| `transmission` | Short intercepted signal phrases, hard cuts |
| `matrix_title` | Title with rain backdrop and scan lines |
| `matrix_image` | Image with terminal overlay and scan effects |
| `ending_socials` | Outro with social handles |

## Motion Principles

- **Typewriter:** 40ms per character with cursor blink (500ms interval)
- **Data stream:** 120ms stagger between line reveals; each line slides from left
- **Rain background:** Columns of random characters fall at varied speeds
- **Cipher decode:** 3 random character swaps per frame before locking to final digit
- **Glitch effect:** 3–5 frame color channel offset (RGB split) before snap
- **Fork split:** Chromatic red/blue tint bleeds from center divider outward
- **Transitions:** 8-frame hard cut with scan-line flash

## Tone

Cyberpunk, terminal, developer-native. Works best for dev tutorials, security
content, technical breakdowns, and any subject that benefits from a
high-stakes, hacker-culture aesthetic.

---

## Blog2Video

This template is powered by Blog2Video — paste any blog URL to generate a
cyberpunk terminal video using Matrix automatically.

https://blog2video.com | Built by FireBird Technologies (https://firebird-technologies.com)
""",

    "gridcraft": """\
# Gridcraft — Style Guide

**Composition ID:** `GridcraftVideo`

## Visual Identity

- **Background:** Off-white (`#FAFAFA`) — warm editorial paper tone
- **Accent color:** Burnt orange (`#F97316`) — warm, editorial energy
- **Text color:** Near-black (`#171717`) — editorial authority on light backgrounds
- **Card surface:** White (`#FFFFFF`) with subtle shadow — bento grid tiles
- **Border:** Light gray (`#E5E7EB`) — structural grid lines

## Typography

- **Primary font:** Inter (sans-serif) — clean editorial legibility
- **Display headings:** Weight 700, tracking −0.02em — magazine-style authority
- **Body text:** Weight 400, size 28–32px at 1920w — comfortable reading distance
- **Labels and tags:** Weight 600, uppercase, tracking 0.1em — editorial metadata

## Layouts Available

| Layout | Use Case |
|---|---|
| `editorial` | Full editorial spread with title and body |
| `editorial_body` | Body text in magazine grid format |
| `bento_hero` | Large hero card with supporting tiles |
| `bento_steps` | Multi-step workflow in grid cards |
| `bento_features` | Feature grid with icons and descriptions |
| `bento_compare` | Two-option comparison with verdict |
| `bento_highlight` | Single bold highlight card |
| `bento_code` | Code block in bento card style |
| `kpi_grid` | Metrics in grid tile format |
| `pull_quote` | Editorial pull quote with attribution |
| `ending_socials` | Outro with social handles |

## Motion Principles

- **Grid entrance:** Cards scale from 0.94 → 1.0 with opacity 0 → 1, staggered 100ms
- **Bento tiles:** Each tile animates independently — left tiles enter from left, right from right
- **Steps:** Sequential reveal — each step fades in 200ms after the previous
- **Pull quote:** Accent bar extends from left (width 0 → 60px) before text fades in
- **KPI numbers:** Count-up animation from 0 to final value over 40 frames
- **Transitions:** Soft cross-dissolve with scale 1.0 → 1.02 on outgoing scene

## Tone

Warm, editorial, marketing-friendly. Works best for product content, SaaS
marketing, brand stories, and any writing that benefits from a structured,
magazine-quality visual treatment.

---

## Blog2Video

This template is powered by Blog2Video — paste any blog URL to generate a
warm editorial video using Gridcraft automatically.

https://blog2video.com | Built by FireBird Technologies (https://firebird-technologies.com)
""",
}

MARKETING_MD = """\
# Blog2Video — Free Remotion Template

This template is the exact source code used by Blog2Video to render blog posts
as polished videos. It is a standalone Remotion composition with its own
layouts, components, and types.

---

## About Blog2Video

Blog2Video converts published blog posts, articles, PDFs, and newsletters into
polished narrated videos — without you writing a script or recording anything.
Paste a URL and get a scene-by-scene video with AI voiceover, transitions, and
brand styling.

**Key capabilities:**
- URL-to-video in minutes — paste any blog post URL
- 12+ built-in templates (including this one, plus custom brand templates)
- AI voiceover with 100+ voices, including voice cloning
- Scene editor — adjust narration, visuals, and pacing per scene
- Landscape and portrait output from the same project
- Bulk processing — convert your entire content archive

Try it free: https://blog2video.com

---

## Want Templates Built For Your Brand?

Blog2Video builds custom Remotion templates matched to your brand identity —
colors, fonts, motion style, and content structure — without you writing code.

Book a custom template: https://blog2video.com/pricing

---

## Built by FireBird Technologies

Blog2Video is a product of FireBird Technologies, an AI SaaS & Automation house
focused on AI-powered content tools.

Learn more: https://firebird-technologies.com

---

© Blog2Video / FireBird Technologies — Free to use and modify.
Attribution appreciated but not required.
"""


_COMPOSITION_MAP = {
    "geometric-explainer": ("DefaultVideo",   "default",   "calculateDefaultMetadata",   "default-sample.json"),
    "nightfall":           ("NightfallVideo", "nightfall", "calculateNightfallMetadata", "nightfall-sample.json"),
    "spotlight":           ("SpotlightVideo", "spotlight", "calculateSpotlightMetadata", "spotlight-sample.json"),
    "matrix":              ("MatrixVideo",    "matrix",    "calculateMatrixMetadata",    "matrix-sample.json"),
    "gridcraft":           ("GridcraftVideo", "gridcraft", "calculateGridcraftMetadata", "gridcraft-sample.json"),
}
_SAMPLES_DIR = _REPO_ROOT / "remotion-video" / "public" / "samples"


def _package_json(slugs: list[str]) -> str:
    names = [FREE_TEMPLATES[s][0] for s in slugs]
    label = names[0] if len(names) == 1 else "Free Templates"
    return json.dumps({
        "name": f"blog2video-{slugs[0] if len(slugs) == 1 else 'free-templates'}",
        "private": True,
        "version": "1.0.0",
        "description": f"Blog2Video — {label} Remotion template. Run: npm install && npx remotion studio",
        "scripts": {
            "studio": "npx remotion studio",
            "render": f"npx remotion render {_COMPOSITION_MAP[slugs[0]][0]} out/video.mp4",
        },
        "dependencies": {
            "@fontsource/inter": "^5.1.0",
            "@fontsource/playfair-display": "^5.1.0",
            "@fontsource/roboto-slab": "^5.1.0",
            "@fontsource/poppins": "^5.1.0",
            "@fontsource/montserrat": "^5.1.0",
            "@fontsource/merriweather": "^5.1.0",
            "@fontsource/oswald": "^5.1.0",
            "@fontsource/lora": "^5.1.0",
            "@fontsource/patrick-hand": "^5.1.0",
            "@fontsource/arimo": "^5.1.0",
            "@fontsource/archivo-black": "^5.2.7",
            "@remotion/cli": "4.0.434",
            "@remotion/player": "4.0.434",
            "@remotion/transitions": "^4.0.434",
            "react": "^18.3.0",
            "react-dom": "^18.3.0",
            "recharts": "^3.8.1",
            "remotion": "4.0.434",
        },
        "devDependencies": {
            "@types/react": "^18.3.0",
            "@types/react-dom": "^18.3.0",
            "typescript": "^5.5.0",
        },
    }, indent=2)


_TSCONFIG = json.dumps({
    "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": True,
        "esModuleInterop": True,
        "skipLibCheck": True,
        "forceConsistentCasingInFileNames": True,
        "noEmit": True,
        "isolatedModules": True,
    },
    "include": ["src"],
}, indent=2)


_REMOTION_CONFIG = """\
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
"""


def _build_root_tsx(slugs: list[str]) -> str:
    imports = []
    compositions = []
    for slug in slugs:
        comp, dir_name, meta, sample_file = _COMPOSITION_MAP[slug]
        imports.append(
            f'import {{ {comp}, {meta} }} from "./templates/{dir_name}/{comp}";'
        )
        compositions.append(f"""\
    <Composition
      id="{comp}"
      component={{{comp}}}
      durationInFrames={{30 * 300}}
      fps={{30}}
      width={{1920}}
      height={{1080}}
      defaultProps={{{{ dataUrl: "/samples/{sample_file}" }}}}
      calculateMetadata={{{meta}}}
    />""")

    return f"""\
import {{ Composition }} from "remotion";
{chr(10).join(imports)}

/**
 * Remotion entry point.
 * Run: npx remotion studio
 *
 * Each composition loads sample scenes from public/samples/.
 * To use your own content, swap dataUrl to point at your own JSON file.
 */
export const RemotionRoot: React.FC = () => (
  <>
{chr(10).join(compositions)}
  </>
);
"""


def _build_template_zip(zf: zipfile.ZipFile, slugs: list[str]) -> None:
    """
    Produces a complete, standalone Remotion project that anyone can run:

      unzip blog2video-nightfall.zip
      cd blog2video-nightfall
      npm install
      npx remotion studio

    Structure mirrors remotion-video/src/ exactly so all relative imports resolve.
    """
    added: set[str] = set()

    def add(src: Path, arcname: str) -> None:
        if arcname not in added and src.exists():
            zf.write(src, arcname=arcname)
            added.add(arcname)

    # ── Template source files ──────────────────────────────────────────────
    for slug in slugs:
        display_name, dir_name = FREE_TEMPLATES[slug]
        _, _, _, sample_file = _COMPOSITION_MAP[slug]
        template_dir = REMOTION_TEMPLATES_DIR / dir_name
        for fpath in sorted(template_dir.rglob("*")):
            if fpath.is_file() and fpath.suffix in SOURCE_EXTENSIONS:
                rel = fpath.relative_to(template_dir)
                add(fpath, f"src/templates/{dir_name}/{rel}")
        add(_SAMPLES_DIR / sample_file, f"public/samples/{sample_file}")
        zf.writestr(f"docs/{display_name}-STYLE.md", STYLE_MDS[slug])

    # ── Shared files all templates import ─────────────────────────────────
    for fname in SHARED_TEMPLATE_ROOT:      # ../SocialIcons, ../playbackSpeed
        add(REMOTION_TEMPLATES_DIR / fname, f"src/templates/{fname}")
    for fname in SHARED_COMPONENTS:         # ../../components/B2VWatermark etc.
        add(REMOTION_COMPONENTS_DIR / fname, f"src/components/{fname}")
    for fname in SHARED_FONTS:              # ../../fonts/registry etc.
        add(REMOTION_FONTS_DIR / fname, f"src/fonts/{fname}")

    # ── Public assets ──────────────────────────────────────────────────────
    add(B2V_LOGO_PATH, "public/b2v-logo.png")

    # ── Project boilerplate ────────────────────────────────────────────────
    zf.writestr("src/Root.tsx",         _build_root_tsx(slugs))
    zf.writestr("src/index.ts",         'import { registerRoot } from "remotion";\nimport { RemotionRoot } from "./Root";\nregisterRoot(RemotionRoot);\n')
    zf.writestr("package.json",         _package_json(slugs))
    zf.writestr("tsconfig.json",        _TSCONFIG)
    zf.writestr("remotion.config.ts",   _REMOTION_CONFIG)
    zf.writestr("BLOG2VIDEO.md",        MARKETING_MD)


@router.get("/free-download-all")
async def download_all_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Outer ZIP contains one inner ZIP per template + a root-level BLOG2VIDEO.md
    outer_buf = io.BytesIO()
    with zipfile.ZipFile(outer_buf, "w", zipfile.ZIP_DEFLATED) as outer_zf:
        outer_zf.writestr("BLOG2VIDEO.md", MARKETING_MD)
        for slug in FREE_TEMPLATES:
            inner_buf = io.BytesIO()
            with zipfile.ZipFile(inner_buf, "w", zipfile.ZIP_DEFLATED) as inner_zf:
                _build_template_zip(inner_zf, [slug])
            inner_buf.seek(0)
            outer_zf.writestr(f"blog2video-{slug}.zip", inner_buf.getvalue())

    # Track "all" on user record
    existing = current_user.free_templates_downloaded
    try:
        downloaded: list[str] = json.loads(existing) if existing else []
    except (json.JSONDecodeError, TypeError):
        downloaded = []
    for slug in FREE_TEMPLATES:
        if slug not in downloaded:
            downloaded.append(slug)
    current_user.free_templates_downloaded = json.dumps(downloaded)
    db.commit()

    outer_buf.seek(0)
    return StreamingResponse(
        iter([outer_buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=blog2video-free-templates.zip"},
    )


@router.get("/free-download/{slug}")
async def download_single_template(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if slug not in FREE_TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        _build_template_zip(zf, [slug])

    # Track download on user record
    existing = current_user.free_templates_downloaded
    try:
        downloaded: list[str] = json.loads(existing) if existing else []
    except (json.JSONDecodeError, TypeError):
        downloaded = []
    if slug not in downloaded:
        downloaded.append(slug)
    current_user.free_templates_downloaded = json.dumps(downloaded)
    db.commit()

    buf.seek(0)
    filename = f"blog2video-{slug}.zip"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
