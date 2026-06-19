"""
AI code generator — uses DSPy with Refine for self-correcting Remotion component generation.

Each scene is generated individually via DSPy ChainOfThought, wrapped in dspy.Refine
so failed validations trigger targeted feedback + retry on just the failing scene.
All scenes run in PARALLEL via asyncio.gather.
"""

import asyncio
import hashlib
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor

import dspy

from app.dspy_modules import ensure_dspy_configured, get_custom_lm
from app.models.custom_template import CustomTemplate
from app.services.code_validator import clean_code, validate_component_code

logger = logging.getLogger(__name__)

REFINE_N = 2          # Max 3 attempts per scene (1 initial + 2 retries)


# ─── DSPy Signatures ─────────────────────────────────────────


class DecideBrandSceneTypes(dspy.Signature):
    """Given a brand's identity, decide what scene types its videos should have.

    Output a JSON array of objects, each with:
    - "id": short snake_case identifier
    - "scene_type": "intro", "content", or "outro"
    - "best_for": array of content types this scene handles best.
      Must use values from: "bullets", "steps", "metrics", "code",
      "quote", "comparison", "timeline", "plain"
      (These are the content types the classification system outputs — other values won't match.)
      Do NOT use "dataviz" — charts and tables are rendered by dedicated, separate
      scenes that are always added automatically. Never create a content scene for
      charts/graphs/tables.
    - "description": one-line purpose

    Structural requirements:
    - Exactly 1 scene with scene_type="intro" and exactly 1 with scene_type="outro"
    - The rest are scene_type="content"

    Variety (THIS IS WHAT MAKES VIDEOS NOT LOOK REPETITIVE):
    - Produce 5–8 DISTINCT content scene types. Each MUST have a DIFFERENT best_for
      signature — never two scenes with the same best_for. Spread across the range;
      do NOT let "bullets" and "metrics" dominate.
    - Aim to cover, when the brand suits them: one bullets/steps scene, one metrics
      scene, one quote/testimonial scene, one comparison scene, one timeline scene,
      and one or two plain-narrative + image scenes. Pick the 5–8 that best fit THIS
      brand's personality and category — a finance brand leans metrics/comparison/
      timeline; an editorial brand leans quote/timeline/plain; a product brand leans
      steps/comparison/bullets.
    - Each "description" should hint at a DISTINCT visual treatment (e.g. "asymmetric
      split hero", "offset stat stack", "full-bleed quote", "side-rail timeline") so
      the downstream scene generator gives each scene its own composition.

    Honoring the user's brief:
    - If user_brief is non-empty and names specific scenes, content types, or an
      ordering (e.g. "add a customer testimonial scene", "make one a code demo",
      "start with a comparison"), HONOR those requests: include scene types that
      cover them and respect any requested ordering, then fill the remaining slots
      with brand-appropriate DISTINCT archetypes. Map requests to the allowed
      best_for values (a testimonial → "quote"; a code walkthrough → "code"; etc.).
    - If user_brief is empty, decide purely from the brand identity.
    - Never let the brief push you below the structural requirements (still exactly
      1 intro + 1 outro) or create a dedicated chart/table content scene.
    """

    brand_context: str = dspy.InputField(desc="Brand name, category, personality, visual patterns")
    user_brief: str = dspy.InputField(
        desc="The user's free-text prompt / uploaded-doc text describing the desired template (may be empty). Honor explicit scene requests stated here."
    )
    scene_types_json: str = dspy.OutputField(
        desc='JSON array of scene type objects: [{"id": "...", "scene_type": "...", "best_for": [...], "description": "..."}]'
    )


class GenerateDesignSystem(dspy.Signature):
    """Given a brand's visual identity, create a concrete CSS design system for video scenes.

    Output ONLY concrete CSS values (under 2000 chars) covering:
    - Background treatment: exact CSS (gradients, solid colors, or patterns)
    - Card/container style: border-radius, box-shadow, border, background
    - Text treatment: font sizes, text-shadow or glow, color usage

    Do NOT include: spring configs, animation physics, decorative elements, or entrance patterns.
    Those are creative choices each scene makes independently.
    """

    brand_context: str = dspy.InputField(desc="Brand identity: name, colors, fonts, style, patterns, personality")
    design_system: str = dspy.OutputField(desc="Concise design system (under 2000 chars) with CSS values for backgrounds, cards, and text only")


class GenerateSceneCode(dspy.Signature):
    """Generate a single Remotion video scene as a React component.

    Write a component assigned to `const SceneComponent`.

    Technical constraints:
    - NO import/export statements — all APIs are pre-injected as globals
    - Component must be deterministic (same frame = same output)
    - NEVER use: eval, fetch, document, window, process, require, import, setTimeout, setInterval
    - ALWAYS add overflow: "hidden" on the outermost container
    - ALL displayed text MUST come from props — NEVER hardcode sample/placeholder content
    - NEVER hardcode specific names, product names, service names, item labels, or example data
    - NEVER use fallback arrays with hardcoded data: do NOT write `props.bullets || [{name:'...'}]`
      or `bullets && bullets.length ? bullets : [{title:'Feature 1'}]` or any similar pattern
    - If props.bullets / props.steps / props.metrics is empty or undefined:
      fall back to splitting props.displayText into sentences, or render props.displayText as a
      single item — NEVER invent example items
    - NEVER render sceneIndex/totalScenes as visible UI
    - NEVER render contentType as visible text/label/badge

    Content array rendering (CRITICAL — THIS IS THE #1 BUG TO AVOID):
    - When scene_purpose best_for includes "steps": MUST use props.steps to render a list.
      Pattern: const items = (props.steps && props.steps.length) ? props.steps : [props.displayText];
      Then: {items.map((step, i) => <div key={i} style={{...}}>...</div>)}
      Each step is its OWN visible row/card — NEVER dump all steps into one paragraph.
    - When scene_purpose best_for includes "bullets": MUST use props.bullets to render a list.
      Pattern: const items = (props.bullets && props.bullets.length) ? props.bullets : [props.displayText];
      Then: {items.map((bullet, i) => <div key={i} style={{...}}>...</div>)}
      Each bullet is its OWN visible row/card — NEVER dump all bullets into one paragraph.
    - Stagger each item's entrance: opacity and translateX animated with delay = i * 12 frames.

    Images & Logo (MANDATORY — every scene MUST handle these — NO exceptions for intro/outro):
    - EVERY scene (intro, content, outro) MUST support content images via props.imageUrl. There are
      NO image-less scene types — the validator REJECTS any scene that does not declare `hasImage`
      and render props.imageUrl when present. Brand intro/outro scenes still support images
      (e.g. hero photo behind brand logo, founder photo, product shot, etc.).
    - ALWAYS check props.logoUrl safely and render it when present:
      {props.logoUrl && typeof props.logoUrl === 'string' && (
        <Img src={props.logoUrl} data-logo="1" style={{width: 80, height: 80, objectFit: "contain", ...}} />
      )}
      ALWAYS set explicit width + height on logo Img so layout never collapses if image fails to load.
      ALWAYS add data-logo="1" on the logo Img element (this distinguishes it from content images).
      Use it as a brand watermark (corner), header element, or animated accent — but ALWAYS render it.
    - ALWAYS check props.imageUrl safely and render it prominently when present — NOT just a dim background.
      Use: const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
      Techniques: Ken Burns zoom (scale 1→1.08 over duration with slight pan), radial vignette reveal,
      slit/clipPath reveal, or hero card with perspective rotation. Always use objectFit:"cover".
      Layer gradient overlays for text readability: linear-gradient(to top, rgba(bg,0.95) 0%, transparent 70%)
      plus radial-gradient vignette plus accent color wash with mixBlendMode:"overlay".
      ALWAYS set explicit width + height on image Img elements.
    - Image focus & zoom (MANDATORY when rendering props.imageUrl):
      If using <Img> element: add data-content-img="1" and include in style:
        objectFit: "cover", objectPosition: props.imageObjectPosition || "50% 50%",
        transform: `scale(${props.imageZoom ?? 1})`, transformOrigin: props.imageObjectPosition || "50% 50%"
      If using a <div> with backgroundImage: add data-content-img="1" and include in style:
        backgroundSize: "cover", backgroundPosition: props.imageObjectPosition || "50% 50%",
        transform: `scale(${props.imageZoom ?? 1})`, transformOrigin: props.imageObjectPosition || "50% 50%"
      This lets users adjust image focus/zoom without regenerating the template.
    - ADAPT LAYOUT based on the `hasImage` flag (declared above):
      WITH image: split layout (image on one side, text on other). Example: width: hasImage ? "50%" : "100%"
      WITHOUT image: text container MUST expand to width: "100%" to fill the full scene. Never leave an empty 50% gap.
      Both modes must look intentionally designed — not like something is missing.

    Aspect-ratio-aware layout (MANDATORY — different orientations need different layouts):
    - The same component renders into BOTH a 1920x1080 landscape canvas AND a 1080x1920 portrait canvas.
      A landscape side-by-side layout (image 50% width × full height) becomes a tall narrow strip in
      portrait if not branched — that looks broken. ALWAYS branch on aspectRatio.
    - REQUIRED top-of-component declarations (BOTH must be present together — neither replaces the other):
        const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
        const isPortrait = props.aspectRatio === 'portrait';
      Then combine them — there are FOUR layout cases to design for:
        (1) hasImage  && !isPortrait  → landscape split (image side, text side)
        (2) hasImage  &&  isPortrait  → portrait stacked (image top, text bottom)
        (3) !hasImage && !isPortrait  → landscape full-width text, no empty image gap
        (4) !hasImage &&  isPortrait  → portrait full-width text, no empty image gap
    - Concrete recipe when hasImage:
        Landscape branch: flexDirection: 'row', image container width: '50%' height: '100%';
        text container width: '50%' height: '100%'.
        Portrait branch:  flexDirection: 'column', image container width: '100%' height: '45%' (top);
        text container width: '100%' height: '55%' (bottom).
      The element with data-content-img="1" lives ONLY inside the hasImage branch.
    - Use isPortrait to also choose font sizes (portrait often needs slightly smaller headings since
      the canvas is narrower than landscape).
    - Declare BOTH `isPortrait` and `hasImage` at the top and branch on them together — render
      different JSX trees per case rather than reusing one tree (a landscape tree in portrait looks broken).
    - When props.imageUrl is ABSENT (hasImage is false): fill the scene with a deliberate backdrop
      (see the BACKDROP spec below) + decor/geometry — never leave an empty 50% hole. Respect the
      brand_context background instruction: an inverted/dark PANEL is a solid fill (always allowed,
      even for "solid backgrounds only" brands); only true multi-stop gradient *backgrounds* are gated.
    - If props.brandImages exists (Array.isArray(props.brandImages)), render gallery/carousel elements from it
    - IMPORTANT: content scenes SUPPORT images, but very often render WITHOUT one — at project
      creation, during preview, and for any scene that simply has no image assigned. So !hasImage
      is a COMMON state, not a rare edge case. Both branches must be first-class:
        • hasImage  → the split layout (image one side, text the other) looks great.
        • !hasImage → a fully-composed, full-width layout in its own right — NEVER a split with the
          image half left blank, and never a centered column that reserves space for a missing image.
      Design the no-image branch to look just as intentional as the with-image one.
    - Missing image handling is a BUG — the reward function penalizes scenes that ignore these props

    Typography (MANDATORY for readability at 1920×1080):
    - NEVER hardcode fontFamily strings like "Inter" or "Roboto" — fonts are passed as props.
      For headings/titles use: fontFamily: props.headingFont || "inherit"
      For body/description text use: fontFamily: props.bodyFont || "inherit"
      This lets users change fonts from Settings without regenerating templates.
    - Main title / displayText: use fontSize: (props.titleFontSize ?? 75) (or scale proportionally in nested layouts, never below 48 for the primary headline).
    - Subtitle / narration / body under the title: use fontSize: (props.descriptionFontSize ?? 37); supporting lines at least 28px.
    - Bullet lists, card body text, quote body, metric labels: at least 30–36px so previews stay legible when scaled down in the UI.
    - Do NOT hardcode tiny font sizes (e.g. 12–18px) for primary readable content.

    Motion (feel alive WITHOUT becoming busy — ONE dominant beat + quiet support):
    - ONE signature beat per scene (a headline pop OR a panel rise OR a count-up — NOT five
      competing animations); everything else is quiet supporting motion.
    - Entrances stagger by 8-14 frames (lists: delay = i*12) — never animate everything at once.
    - Title entrance combines transforms (translateY + scale + opacity via spring), not a bare fade;
      scale-punch a key word for emphasis (spring damping:14, stiffness:220).
    - Text reveals: split words/lines, stagger with spring(frame - i*8).
    - Count-ups: interpolate(frame, [start, end], [0, target]) — tabular figures, prefix/suffix kept,
      primary stat in the accent with a grow-in underline/marker.
    - Clean EXIT 20-30 frames before durationInFrames (fade / scale down / slide) so cuts read intentional.
    - Spring configs: snappy={damping:14,stiffness:220}, smooth={damping:20,stiffness:70}, fast={damping:22,stiffness:140,mass:1.2}.

    Quality bar (emulate the craft of polished editorial/data video — adapt everything to
    brand_context; never copy any specific brand's colors/fonts/layouts):
    - Hierarchy: sizes scale off one base — headline ≈ 2× body, big numerals ≈ 3× body; labels
      small-caps, uppercase, letter-spaced (~0.12em), muted. ONE clear focal element per scene.
    - Restraint: generous negative space, ONE decorative system at low intensity (not several),
      hairline borders, a single accent. Polished = calm and confident, not busy.
    Prefer the craft-kit components (they already encode these patterns) over re-deriving by hand.

    Available APIs (pre-injected as globals, do NOT import):
    - React, React.createElement, React.useState, React.useMemo
    - useCurrentFrame(), useVideoConfig() → { fps, width, height, durationInFrames }
    - interpolate(frame, inputRange, outputRange, options?) — BOTH ranges must be
      NUMBERS only. Never put strings/units inside (NOT ['0%','100%']); interpolate
      the number then add the unit in the style: width: `${interpolate(p,[0,1],[0,100])}%`
    - spring({ frame, fps, config: { damping, stiffness, mass }?, from?, to? })
    - Easing: Easing.bezier(x1,y1,x2,y2), Easing.inOut(Easing.ease)
    - AbsoluteFill, Sequence, Img, random(seed)

    Craft kit (pre-injected globals — OPTIONAL building blocks, do NOT import):
    These are tested, brand-themed helpers. They are ALREADY in scope — use them
    directly. NEVER redeclare them (no `const { staggerEntrance, panelRise } = {...}`
    and no `import`) — that shadows the global and crashes with a TDZ error.
    Use the ones that FIT this scene's
    content — they are never mandatory and must NOT all be crammed into one scene.
    A plain narrative scene needs none of them; reach for one only when the
    content calls for it. They automatically pick up the brand palette/fonts, so
    prefer them over hand-rolling the equivalent (especially charts).
    - <SceneFrame brandColors={props.brandColors} aspectRatio={props.aspectRatio}
        fonts={{heading: props.headingFont, body: props.bodyFont}} eyebrow? footer?
        edge? noFade?>...</SceneFrame>
        Optional scaffolding: brand background (auto solid/gradient), padding,
        clean fade in/out, optional chrome. If you use it, put your scene content
        inside; kit components below then auto-read the brand palette via context.
        You may also build your own layout WITHOUT SceneFrame — then pass colors
        explicitly. Both are fine.
    - <CustomChart chartTable={props.chartTable} chartType={props.chartType} /> —
        themed line/bar/histogram. Charts and tables are normally their OWN dedicated
        scenes (added automatically), so a content scene rarely needs this. Render it
        ONLY when props.chartTable is actually present; NEVER hand-roll a chart and
        NEVER invent chart data.
    - <StatGrid items={props.metrics} /> / <MetricRow items={props.metrics} /> /
        <StatCard item={...} primary /> — animated count-up stat displays. Use when
        props.metrics is present.
    - <CountUpValue value="$1.2M" /> — single animated number (prefix/suffix/decimals preserved).
    - <RevealText text={...} mode="word|char|line|fade|blur|typewriter" /> — staggered text
        reveal (mode="blur" is the snappy/energetic personality; word/line are smooth/calm;
        typewriter types characters in with a blinking cursor — editorial/terminal feel).
    - <HighlightPhrase text={...} phrase={...} /> — accent underline on a key phrase.
    - <CodeBlock lines={props.codeLines} language={props.codeLanguage} /> — themed, SAFE
        code panel. Renders ONLY the given lines; use it for "code" scenes instead of
        hand-rolling. NEVER invent code lines or touch process.env / runtime APIs.
    - <KenBurnsImage src={props.imageUrl} objectPosition={props.imageObjectPosition}
        zoom={props.imageZoom} scrim="bottom" /> — image with slow push + reveal,
        honoring the user's focus/zoom. (Satisfies the image-rendering requirement.)
    - <Decor system="dots|grid|orbs|starfield|rules|vignette|hairlines|mesh|ticker|concentric|wash"
        intensity={0.4} /> — restrained background atmosphere. Prefer THIS brand's signature
        decor system (named in the BRAND SIGNATURE block) so the template reads as its own persona.
    - <SignatureArtifact motion="<this brand's artifactMotion>" intensity={0.5} /> — the brand's
        recurring ANIMATED motif (its fingerprint): a drawn-in corner frame, drifting streak field,
        kinetic ticker, big ghost glyph, pulse ring or accent sweep, picked from the artifactMotion
        word. Use ONE per scene to carry the brand thread — PROMINENT in the intro, a restrained
        ECHO (lower intensity) in content, a quiet callback in the outro. (Individual pieces are also
        available directly: CornerFrame, StreakField, KineticTicker, BigGlyphBackdrop, PulseRing,
        AccentSweep — but SignatureArtifact is the brand-correct default.)
    - Helpers: useKit() → {{palette, type, isPortrait, fonts}}; derivePalette(colors);
        withAlpha(hex, a); staggerEntrance(frame, i); headlinePop(frame, fps);
        panelRise(frame, fps); countUpString(value, frame); cardStyle(palette, variant).

    Content-type → kit recipe (STRONGLY PREFERRED — compose these, don't improvise):
    Look at scene_purpose.best_for and the props that are actually present, then reach
    for the matching kit composition. This is how scenes reach built-in craft level —
    a hand-rolled equivalent will look improvised. Pick the FIRST recipe whose data is present.
    - "metrics" (props.metrics present): <StatGrid items={props.metrics} /> (3+ stats)
      or <MetricRow items={props.metrics} /> (1-2 stats); each value via CountUpValue.
      Highlight the primary stat with StatCard ... primary.
    - "quote" (props.quote present): <RevealText text={props.quote} mode="line" /> with
      <HighlightPhrase> on the key phrase; attribute props.quoteAuthor below in muted small-caps.
    - "comparison" (props.comparisonLeft/Right present): two columns, each a StatCard or
      cardStyle panel; stagger the two sides; a thin accent divider between them.
    - "timeline"/"steps" (props.timelineItems/steps present): stacked MetricRow-style rows,
      one per item, staggered with staggerEntrance(frame, i); a growing accent rule connecting them.
    - "bullets" (props.bullets present): staggered rows (NOT one paragraph), each in a
      cardStyle panel or with an accent marker; use RevealText per row if short.
    - "code" (props.codeLines present): <CodeBlock lines={props.codeLines} language={props.codeLanguage} />
      as the focal element — it renders ONLY those lines safely. NEVER hand-roll a code panel,
      NEVER invent/hardcode sample code lines, and NEVER reference process.env or any runtime API.
      If props.codeLines is empty, fall back to a "plain" RevealText of props.displayText instead.
    - "plain"/narrative: <RevealText text={props.displayText} mode="word|line" /> as the
      focal element, optional KenBurnsImage when props.imageUrl present. Needs few/no kit pieces.
    Always wrap in <SceneFrame> (or pass brand colors explicitly) so the kit reads the palette.
    Do NOT cram multiple recipes into one scene — ONE focal composition per scene.

    Scene-type craft (intro/outro — raise these to the SAME bar as content scenes):
    - INTRO (scene_type == "intro"): the brand-reveal opener. STRONGLY PREFER the <IntroStage>
      scaffold — it choreographs the whole opening (logo settle + accent rule draw + staggered
      title reveal + signature decor) so the intro matches built-in craft:
        <IntroStage title={props.displayText}
                    logo={props.logoUrl && <Img src={props.logoUrl} style={{height: 96}} />}
                    subtitle={...optional takeaway...}
                    decor="<this brand's signature decor>"
                    titleReveal="blur for energetic brands, word/line for calm" />
      Note the logo is passed as `{props.logoUrl && <Img .../>}` — keep that conditional so the
      scene stays valid; also still declare `const hasImage = !!(props.imageUrl && ...)` and, when
      hasImage, you MAY wrap IntroStage over a <KenBurnsImage scrim="bottom"/> hero backdrop.
      (You may hand-roll the opener instead, but it must hit the same bar: a real logo reveal, a
      bold title reveal, exactly ONE signature entrance beat.) Calm and confident: one focal
      headline, generous negative space. Give the brand's SIGNATURE ARTIFACT (see IDENTITY KIT)
      its most PROMINENT, animated take here — drop <SignatureArtifact motion="<artifactMotion>"
      intensity={0.7} /> as the hero moment that sets the brand's visual fingerprint for the whole
      video. Do NOT render bullet/metric/step lists in the intro.
      Branch on isPortrait: portrait stacks logo→title vertically and centered; landscape may
      offset the title or place logo+title side by side.
    - OUTRO (scene_type == "outro"): a calm closing recap — restate the brand
      (props.displayText) plus one short takeaway with a clean title reveal and a gentle exit.
      A dynamic CTA + social row is composited automatically ON TOP of the outro at render
      time, so do NOT hand-roll social icons, website buttons, or "Subscribe/Follow" CTAs —
      just provide the brand recap beneath where those will sit. Echo the brand's SIGNATURE
      ARTIFACT (see IDENTITY KIT) as a quiet closing callback so the video bookends on its motif.

    Per-scene visual composition (content scenes — MAKE EACH SCENE LOOK DIFFERENT):
    You are generating scene_index of total_scenes. scene_purpose names the composition assigned
    to THIS scene. Build the scene's GEOMETRY to match it — repeated centered cards are the #1
    reason custom videos feel repetitive, so consecutive scenes must NOT share a layout. These
    are GEOMETRY DIRECTIVES you author yourself with plain flex/absolute divs (NOT components to
    wrap); flip the focal side vs the previous scene; honor the four hasImage×isPortrait cases:
      • "centered focal"   → one dominant focal block dead-centre, generous negative space.
      • "asymmetric split" → ~60/40 two columns: focal copy one side, supporting block the other.
      • "full-bleed hero"  → a <KenBurnsImage> fills edge-to-edge; text overlaid low with a scrim.
      • "offset card stack"→ rows/cards weighted to one side; eyebrow + a vertical accent rule opposite.
      • "side rail"        → a thin vertical accent rail + vertical eyebrow on one edge, content beside.

    BACKDROP — richness lives HERE; do NOT leave every scene on the flat brand bg.
    Give each scene a deliberate backdrop and VARY it scene-to-scene. Some scenes SHOULD go
    DARK / INVERTED for contrast and drama (a deep panel using the brand's text colour or a
    darkened accent, with light text on top); others use a subtle accent wash, a brand surface
    panel, or a low-intensity <Decor> atmosphere. A few darker scenes set against lighter
    neighbours is exactly what makes a video feel crafted instead of a slide deck. An inverted/
    dark panel is a SOLID fill — always allowed, even for "solid backgrounds only" brands (this is
    per-scene contrast, NOT a gradient). Keep text contrast legible (AA); stay in the brand palette.
    Useful fragments (ADAPT to the scene — do not paste verbatim, vary them):
      • inverted panel:  <AbsoluteFill style={{background: palette.text}} /> behind light text
      • darkened accent: withAlpha(palette.accent, 0.92) over a near-black wash
      • hero scrim:      linear-gradient(0deg, <bg at 0.9> 0%, transparent 70%) over the image
      • brand atmosphere: <Decor system="<this brand's signature decor>" intensity={0.4} />
    Apply the Motion rules above (one dominant beat + quiet support). The 5 kit layout skeletons
    remain available if one fits cleanly, but are NOT required — author the geometry directly so
    each brand reads differently.

    Component Props:
    { displayText, narrationText, imageUrl?, imageObjectPosition?: string, imageZoom?: number,
      sceneIndex, totalScenes,
      logoUrl?, brandImages?, brandColors: { primary, secondary, accent, background, text, bg2? },
      aspectRatio: "landscape" | "portrait",
      titleFontSize?: number, descriptionFontSize?: number,
      headingFont?: string, bodyFont?: string,
      contentType?: "plain"|"bullets"|"metrics"|"code"|"quote"|"comparison"|"timeline"|"steps"|"dataviz",
      bullets?: string[], metrics?: {value,label,suffix?}[], codeLines?: string[],
      codeLanguage?: string, quote?: string, quoteAuthor?: string,
      comparisonLeft?: {label,description}, comparisonRight?: {label,description},
      timelineItems?: {label,description}[], steps?: string[],
      chartTable?: { headers?: string[], rows?: (string|number)[][] }, chartType?: string, chartSummary?: string }

    Resolution: 1920x1080 (landscape) / 1080x1920 (portrait), 30fps, 90-150 frames.
    """

    brand_context: str = dspy.InputField(desc="Brand name, colors, fonts, style, category, personality")
    design_system: str = dspy.InputField(desc="Shared visual styling — follow for consistency")
    scene_type: str = dspy.InputField(desc="'intro', 'content', or 'outro'")
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes being generated")
    scene_purpose: str = dspy.InputField(
        desc="What this scene is for — e.g., 'intro scene: establish brand identity' or 'content scene optimized for metrics/statistics'"
    )

    code: str = dspy.OutputField(desc="Complete SceneComponent code (const SceneComponent = (props) => { ... };)")
    image_box_width_fraction_landscape: float = dspy.OutputField(
        desc=(
            "Inside the `if (!isPortrait) { ... }` (or `!p && ...`) branch of your code: "
            "fraction of the LANDSCAPE 1920x1080 canvas WIDTH occupied by the image container (0.0 to 1.0). "
            "Examples: 0.5 if image container is width: '50%' of the scene, 1.0 if width: '100%'. "
            "Read this directly from the width style you set on the element with data-content-img=\"1\" "
            "in the LANDSCAPE branch. If the scene has no image, output 1.0."
        )
    )
    image_box_height_fraction_landscape: float = dspy.OutputField(
        desc=(
            "Inside the LANDSCAPE branch of your code: "
            "fraction of the LANDSCAPE 1920x1080 canvas HEIGHT occupied by the image container (0.0 to 1.0). "
            "Examples: 1.0 if height: '100%' of scene, 0.5 if height: '50%' (top/bottom half). "
            "Read this from the height style of the LANDSCAPE branch's data-content-img element. "
            "If the scene has no image, output 1.0."
        )
    )
    image_box_width_fraction_portrait: float = dspy.OutputField(
        desc=(
            "Inside the `if (isPortrait) { ... }` (or `p && ...`) branch of your code: "
            "fraction of the PORTRAIT 1080x1920 canvas WIDTH occupied by the image container (0.0 to 1.0). "
            "Common portrait layouts use width: '100%' (image stacked above text) → output 1.0. "
            "Read this from the width style of the PORTRAIT branch's data-content-img element. "
            "If portrait reuses the landscape branch (same JSX), output the landscape width fraction."
        )
    )
    image_box_height_fraction_portrait: float = dspy.OutputField(
        desc=(
            "Inside the PORTRAIT branch of your code: "
            "fraction of the PORTRAIT 1080x1920 canvas HEIGHT occupied by the image container (0.0 to 1.0). "
            "Common portrait layouts: image is the top 40-50% (height: '45%') → output 0.45. "
            "Read this from the height style of the PORTRAIT branch's data-content-img element. "
            "If portrait reuses the landscape branch, output the landscape height fraction."
        )
    )


# ─── Reward function for dspy.Refine ──────────────────────────


def _scene_reward(args, pred) -> float:
    """Score a generated scene. Only checks for real bugs — no aesthetic scoring."""
    raw_code = pred.code or ""
    code = clean_code(raw_code)

    # Must pass validation (hard requirement)
    scene_type = getattr(args, "scene_type", "content")
    valid, err = validate_component_code(code, scene_type=scene_type)
    if not valid:
        print(f"[F7-DEBUG] [REFINE] FAILED: {err}")
        return 0.0

    # logoUrl, imageUrl, overflow:hidden, and interpolate monotonicity are now
    # hard requirements in validate_component_code() — they return 0.0 above.
    # Remaining soft checks are for quality issues that don't cause crashes.

    score = 1.0

    # Bug: hardcoded sample data arrays (fake content in components)
    hardcoded_array = re.search(
        r'(?:const|let|var)\s+\w+\s*=\s*\[[\s\S]{20,}?(?:text|icon|label|description|name|desc|title|heading)\s*:',
        code,
    )
    if hardcoded_array and not re.search(
        r'=\s*props\.', code[hardcoded_array.start() : hardcoded_array.start() + 100]
    ):
        score -= 0.3
        print(f"[F7-DEBUG] [REFINE] -0.3: hardcoded sample data")

    # Bug: fallback hardcoded arrays — props.x || [{...}] or props.x ?? [{...}]
    if re.search(r'props\.\w+\s*(?:\|\||\?\?)\s*\[', code):
        score -= 0.3
        print(f"[F7-DEBUG] [REFINE] -0.3: hardcoded fallback array (props.x || [...])")

    # Bug: contentType rendered as visible text
    if re.search(r'>\s*\{[^}]*contentType[^}]*\}', code):
        score -= 0.2
        print(f"[F7-DEBUG] [REFINE] -0.2: contentType visible as text")

    # Bug: sceneIndex/totalScenes shown as visible counters
    if re.search(r'sceneIndex\s*\+\s*1.*totalScenes|of.*totalScenes|\$\{.*sceneIndex', code):
        score -= 0.2
        print(f"[F7-DEBUG] [REFINE] -0.2: scene counter visible")

    # Bug: steps/bullets archetype doesn't use the array prop at all
    # We check for *any* .map() call AND *any* reference to props.steps/props.bullets.
    # The AI commonly does: const items = props.steps || ...; items.map(...) — that's fine.
    scene_purpose = getattr(args, "scene_purpose", "") or ""
    if "steps" in scene_purpose and "best_for" in scene_purpose:
        uses_steps = bool(re.search(r'props\.steps', code))
        uses_map = bool(re.search(r'\.map\(', code))
        if not uses_steps or not uses_map:
            score -= 0.4
            print(f"[F7-DEBUG] [REFINE] -0.4: steps scene missing props.steps reference or .map()")
    if "bullets" in scene_purpose and "best_for" in scene_purpose:
        uses_bullets = bool(re.search(r'props\.bullets', code))
        uses_map = bool(re.search(r'\.map\(', code))
        if not uses_bullets or not uses_map:
            score -= 0.4
            print(f"[F7-DEBUG] [REFINE] -0.4: bullets scene missing props.bullets reference or .map()")

    # Soft kit-adoption nudge: when a content type has a tested kit recipe, prefer
    # composing the kit over hand-rolling (the recipe table in GenerateSceneCode).
    # Penalty drops a clean scene below threshold (0.75) so Refine retries for kit
    # usage; if the model keeps hand-rolling, Refine still returns the best attempt,
    # so kit stays effectively optional (costs at most one extra attempt).
    if "best_for" in scene_purpose:
        _kit_recipes = {
            "metrics": r'\b(StatGrid|MetricRow|StatCard|CountUpValue)\b',
            "quote": r'\b(RevealText|HighlightPhrase)\b',
            "comparison": r'\b(StatCard|MetricRow|cardStyle)\b',
            "timeline": r'\b(MetricRow|staggerEntrance|StatCard)\b',
            "code": r'\bCodeBlock\b',
        }
        for _ctype, _pattern in _kit_recipes.items():
            if _ctype in scene_purpose and not re.search(_pattern, code):
                score -= 0.3
                print(f"[F7-DEBUG] [REFINE] -0.3: {_ctype} scene hand-rolled (no matching kit component)")
                break  # one nudge per scene — don't stack across content types

    # Scene-type craft nudge (intro): the brand-reveal opener should present the
    # title via the kit's staggered text reveal rather than a flat fade. Soft —
    # drops below threshold so Refine tries once more; never mandatory. (The outro
    # is composited with the CTA overlay at render time, so it gets no nudge here.)
    if scene_type == "intro" and not re.search(r'\b(RevealText|HighlightPhrase)\b', code):
        score -= 0.3
        print(f"[F7-DEBUG] [REFINE] -0.3: intro without a kit text reveal (RevealText/HighlightPhrase)")

    # D2 richness floor (content scenes): a scene with almost no motion AND no
    # atmosphere reads as a static centered card — the exact look we're moving away
    # from. Count distinct animation techniques; if fewer than 2 AND no <Decor>,
    # nudge below threshold so Refine retries for a livelier composition. Conservative
    # by design (most real scenes use spring + interpolate already), so it only bites
    # genuinely bare scenes and stays optional (best attempt is returned regardless).
    if scene_type == "content":
        _anim_signals = sum(
            bool(re.search(_p, code))
            for _p in (
                r'\bspring\s*\(',
                r'\binterpolate\s*\(',
                r'\bRevealText\b',
                r'\bstaggerEntrance\b',
                r'\bheadlinePop\b',
                r'\bpanelRise\b',
                r'\bCountUpValue\b',
                # Signature artifacts are animated motifs — count them as motion.
                r'\b(SignatureArtifact|CornerFrame|StreakField|KineticTicker|BigGlyphBackdrop|PulseRing|AccentSweep)\b',
            )
        )
        _has_decor = bool(re.search(r'<Decor\b', code))
        if _anim_signals < 2 and not _has_decor:
            score -= 0.3
            print(f"[F7-DEBUG] [REFINE] -0.3: content scene looks static (add motion variety / <Decor>)")

        # Backdrop richness nudge (v3): a content scene that leaves itself on the
        # flat brand bg — no inverted/dark panel, no accent wash, no Decor, no
        # full-bleed image, no surface cardStyle — is the flat-slide look we're
        # moving away from. Soft -0.2 so Refine retries with a deliberate backdrop.
        # (Replaces the old skeleton-usage penalty: we no longer require the kit
        # layout COMPONENTS — the model authors geometry from the directive — so
        # penalising "no skeleton" would now fight the directive. We reward a real
        # backdrop instead, which is where the perceived richness actually comes from.)
        _has_backdrop = bool(
            re.search(r'palette\.text\b', code)          # inverted/dark panel
            or re.search(r'withAlpha\s*\(', code)         # accent/colour wash
            or re.search(r'<Decor\b', code)               # brand atmosphere
            or re.search(r'<KenBurnsImage\b', code)       # full-bleed hero image
            or re.search(r'cardStyle\s*\(', code)         # brand surface panel
            or re.search(r'linear-gradient', code)        # scrim / gradient backdrop
            or re.search(r'\b(SignatureArtifact|StreakField|KineticTicker|BigGlyphBackdrop|PulseRing|AccentSweep|CornerFrame)\b', code)  # signature artifact atmosphere
        )
        if not _has_backdrop:
            score -= 0.2
            print(f"[F7-DEBUG] [REFINE] -0.2: content scene has no deliberate backdrop (flat-slide risk)")

    line_count = code.count("\n") + 1
    print(f"[F7-DEBUG] [REFINE] Validation PASSED — score={score:.2f} | {line_count}L")
    return max(score, 0.0)


# ─── Brand context builder ─────────────────────────────────────


def _build_brand_context(
    theme: dict,
    brand_kit_data: dict | None,
    name: str,
    category: str = "",
    video_style: str = "",
    personality: str = "",
    source_url: str = "",
) -> str:
    """Build brand context string — raw data only, no instructions."""
    colors = theme.get("colors", {})
    fonts = theme.get("fonts", {})
    style = theme.get("style")
    animation = theme.get("animationPreset")
    patterns = theme.get("patterns", {})

    brand_colors = {
        "primary": colors.get("accent"),
        "secondary": colors.get("surface"),
        "accent": colors.get("accent"),
        "background": colors.get("bg"),
        "text": colors.get("text"),
    }
    # Remove None values
    brand_colors = {k: v for k, v in brand_colors.items() if v}

    ctx = f"Brand: {name}\n"
    if brand_colors:
        ctx += f"Colors: {json.dumps(brand_colors)}\n"
    if fonts.get("heading") or fonts.get("body"):
        parts = []
        if fonts.get("heading"):
            parts.append(f"Heading: {fonts['heading']}")
        if fonts.get("body"):
            parts.append(f"Body: {fonts['body']}")
        ctx += f"Fonts: {', '.join(parts)}\n"
    if style:
        ctx += f"Design style: {style}\n"
    if animation:
        ctx += f"Animation preset: {animation}\n"

    if patterns:
        ctx += "\nVisual patterns from website:\n"
        cards = patterns.get("cards", {})
        if cards:
            ctx += f"  Cards: corners={cards.get('corners')}, shadow={cards.get('shadowDepth')}, border={cards.get('borderStyle')}\n"
        spacing = patterns.get("spacing", {})
        if spacing:
            ctx += f"  Spacing: density={spacing.get('density')}, gridGap={spacing.get('gridGap')}px\n"
        images = patterns.get("images", {})
        if images:
            ctx += f"  Images: treatment={images.get('treatment')}, overlay={images.get('overlay')}\n"
        layout = patterns.get("layout", {})
        if layout:
            ctx += f"  Layout: direction={layout.get('direction')}\n"
            decorative = layout.get("decorativeElements", [])
            if decorative:
                ctx += f"  Decorative elements: {', '.join(decorative)}\n"

    if brand_kit_data:
        if brand_kit_data.get("logos"):
            ctx += "Logo available via props.logoUrl\n"
        if brand_kit_data.get("images"):
            ctx += f"{len(brand_kit_data['images'])} brand image(s) available via props.brandImages\n"
        dl = brand_kit_data.get("design_language", {})
        if dl:
            for key in ("vibe", "density", "shapes"):
                if dl.get(key):
                    ctx += f"{key.title()}: {dl[key]}\n"

    use_gradient = colors.get("bg2") is not None
    if use_gradient:
        ctx += f"Background: gradient from {colors.get('bg')} to {colors.get('bg2')} — use gradient backgrounds\n"
    else:
        ctx += f"Background: solid color {colors.get('bg')} — use SOLID backgrounds only, NO gradients\n"

    # Craft-kit decor system. Prefer the explicit theme.decor field (set by the
    # theme extractor); fall back to deriving from decorative elements.
    decor = theme.get("decor") or {}
    if decor.get("system"):
        _decor = decor["system"]
        _intensity = decor.get("intensity", 0.45)
    else:
        _decor_map = {
            "gradients": "orbs",
            "background-shapes": "orbs",
            "dots": "dots",
            "accent-lines": "rules",
        }
        _decoratives = (patterns.get("layout", {}) or {}).get("decorativeElements", []) or []
        _decor = next((_decor_map[d] for d in _decoratives if d in _decor_map), "none")
        _intensity = 0.45

    # ── Brand identity kit (v3) — the persona that makes THIS brand unlike any
    # other custom template (not a recolor). The key split: TYPE + MOTION stay
    # CONSISTENT across all scenes (that's the brand thread); DECOR + SURFACE are
    # a palette to VARY per scene. Pinning surface/decor to one value on every
    # scene was flattening intra-brand variety, so they are framed as defaults to
    # reach into, not mandates. (Decor is stated ONCE, here.) ──
    signature = theme.get("signature") or {}
    if signature:
        _surface = signature.get("surfaceStyle", "panel")
        _type = signature.get("typeTreatment", "clean-sans")
        _sig_decor = signature.get("decorSystem", _decor)
        _artifact_motion = signature.get("artifactMotion", "drift")
        _artifact_set = signature.get("artifactSet") or [_artifact_motion]
        _type_hint = {
            "tight-sans": "tight, modern sans — sentence case, low letter-spacing, heavy weights",
            "editorial-serif": "high-contrast serif headings with an ALL-CAPS sans kicker, wide tracking",
            "display-serif": "elegant display serif, generous leading, refined small caps",
            "rounded-sans": "friendly rounded sans, warm and approachable",
            "display-bold": "loud condensed display, ALL-CAPS, tight tracking, high energy",
            "clean-sans": "clean neutral sans, balanced weights",
        }.get(_type, _type)
        ctx += (
            "BRAND IDENTITY KIT — the unique persona for this template:\n"
            f"  • Type (KEEP CONSISTENT every scene — this is the brand thread): {_type_hint}\n"
            f"  • Motion energy (KEEP CONSISTENT): see the Motion energy line below\n"
            f"  • SIGNATURE ARTIFACT FAMILY (this brand's fingerprint): {_artifact_set} — a related "
            f"family of animated motifs via <SignatureArtifact motion=\"...\" />. Each scene's "
            f"scene_purpose names the EXACT motion + intensity to use for that scene, so VARY the "
            f"artifact across scenes (don't repeat one motif everywhere): the intro gets a BOLD hero "
            f"take, content scenes restrained ECHOES placed differently each time, the outro a quiet "
            f"callback with a DIFFERENT motif than the intro. (The matching <Decor system=\"{_sig_decor}\" /> "
            f"is a quiet static companion.) This rotating-but-related family is what makes the template "
            f"read as ONE brand while keeping every scene visually distinct.\n"
            f"  • Surface lean (DEFAULT, not mandatory): panels tend toward cardStyle(palette, \"{_surface}\") — switch treatment when a scene calls for it\n"
            f"  • Reveal: RevealText mode=\"blur\" for energetic brands, \"word\"/\"line\" for calm/smooth\n"
        )
    else:
        ctx += f"Suggested decor system (optional): {_decor} at intensity {_intensity}\n"

    # Motion energy: prefer explicit theme.motion.energy, else the free-form preset.
    motion = theme.get("motion") or {}
    if motion.get("energy"):
        ctx += (
            f"Motion energy: {motion['energy']} (easing {motion.get('easing', 'easeOutQuint')}) — "
            "keep ONE signature beat per scene; stagger entrances; never animate everything at once.\n"
        )
    elif animation:
        ctx += (
            f"Motion energy: interpret '{animation}' — keep ONE signature beat per "
            "scene; stagger entrances; do not animate everything at once.\n"
        )

    # Preferred content archetypes for this brand (scene-type variety hint).
    scene_bias = theme.get("sceneBias")
    if isinstance(scene_bias, list) and scene_bias:
        ctx += f"Preferred scene types for this brand: {', '.join(str(s) for s in scene_bias)}\n"

    if source_url:
        ctx += f"Website: {source_url}\n"
    if category:
        ctx += f"Category: {category}\n"
    if video_style:
        ctx += f"Video style: {video_style}\n"
    if personality:
        ctx += f"Brand personality: {personality}\n"

    return ctx


# ─── Brand scene type decision ──────────────────────────────────


def _extract_json_array(raw: str):
    """Parse a JSON array from an LLM string, tolerating common slop.

    Handles: ```json fences, prose before/after the array, and trailing text
    after the closing bracket (the `Extra data: line N` failure). Strategy:
    strip fences, then if a plain json.loads fails, slice from the first '[' to
    its matching ']' (bracket-depth aware, skipping brackets inside strings) and
    parse that. Raises json.JSONDecodeError if no valid array is found.
    """
    s = (raw or "").strip()
    # Strip a leading ```/```json fence and a trailing ``` fence.
    if s.startswith("```"):
        nl = s.find("\n")
        if nl != -1:
            s = s[nl + 1 :]
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
    s = s.strip()

    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # Find the first top-level [...] block, ignoring brackets inside strings.
    start = s.find("[")
    if start == -1:
        raise json.JSONDecodeError("no JSON array found", s, 0)
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return json.loads(s[start : i + 1])
    raise json.JSONDecodeError("unterminated JSON array", s, start)


def _decide_brand_scene_types(brand_context: str, user_brief: str = "") -> list[dict]:
    """Ask the AI to decide scene types tailored to this brand.

    `user_brief` is the user's raw prompt / uploaded-doc text (empty for URL-scraped
    templates); when present, explicit scene requests in it are honored.

    Retries once on failure. Raises RuntimeError if both attempts fail.
    Returns list of dicts: [{"id": "...", "scene_type": "...", "best_for": [...], "description": "..."}]
    """
    ensure_dspy_configured()
    module = dspy.ChainOfThought(DecideBrandSceneTypes)
    codegen_lm = get_custom_lm()

    last_error = None
    for attempt in range(2):
        t0 = time.time()
        try:
            # On the RETRY, run with the LM cache disabled so we don't re-fetch the
            # same malformed response (which fails identically in ~0s and would also
            # poison every later template with the same inputs). Guarded with
            # getattr/try so it degrades safely if the dspy/LM version differs.
            prev_cache = getattr(codegen_lm, "cache", None)
            if attempt and prev_cache is not None:
                try:
                    codegen_lm.cache = False
                except Exception:  # noqa: BLE001
                    pass
            try:
                with dspy.context(lm=codegen_lm):
                    result = module(brand_context=brand_context, user_brief=user_brief or "")
            finally:
                if attempt and prev_cache is not None:
                    try:
                        codegen_lm.cache = prev_cache
                    except Exception:  # noqa: BLE001
                        pass

            # Tolerant parse — the model sometimes appends prose / a second fence
            # after the array ("Extra data: line N"), so extract the array itself.
            scene_types = _extract_json_array(result.scene_types_json or "")

            if not isinstance(scene_types, list) or len(scene_types) < 3:
                raise ValueError(f"Expected list of 3+ scene types, got {type(scene_types).__name__} with {len(scene_types) if isinstance(scene_types, list) else 0} items")

            # Validate structure
            validated = []
            for st in scene_types:
                if not isinstance(st, dict) or "id" not in st:
                    continue
                validated.append({
                    "id": st["id"],
                    "scene_type": st.get("scene_type", "content"),
                    "best_for": st.get("best_for", []),
                    "description": st.get("description", st["id"]),
                })

            # Ensure we have intro and outro (structural requirement)
            has_intro = any(s["scene_type"] == "intro" for s in validated)
            has_outro = any(s["scene_type"] == "outro" for s in validated)
            if not has_intro:
                validated.insert(0, {"id": "hero_intro", "scene_type": "intro", "best_for": [], "description": "Opening scene"})
            if not has_outro:
                validated.append({"id": "closing_outro", "scene_type": "outro", "best_for": [], "description": "Closing scene"})

            content_types = [s for s in validated if s["scene_type"] == "content"]
            if not content_types:
                raise ValueError("AI returned no content scene types")

            # Enforce archetype non-repetition: two content scenes with the same
            # best_for signature resolve to near-identical layouts, which is the #1
            # reason custom videos feel repetitive. Keep the first of each signature.
            deduped, seen = [], set()
            for s in content_types:
                sig = tuple(sorted(str(b).lower() for b in (s.get("best_for") or []))) or (s["id"],)
                if sig in seen:
                    print(f"[F7-DEBUG] [SCENE-TYPES] Dropped duplicate archetype {s['id']!r} (best_for={s.get('best_for')})")
                    continue
                seen.add(sig)
                deduped.append(s)
            if len(deduped) < len(content_types):
                non_content = [s for s in validated if s["scene_type"] != "content"]
                validated = (
                    [s for s in non_content if s["scene_type"] == "intro"]
                    + deduped
                    + [s for s in non_content if s["scene_type"] == "outro"]
                )

            elapsed = time.time() - t0
            print(
                f"[F7-DEBUG] [SCENE-TYPES] Decided {len(validated)} scene types in {elapsed:.1f}s: "
                f"{[s['id'] for s in validated]}"
            )
            # ── V3 verification: confirm Decision D took effect at runtime ──
            # D = 5–8 DISTINCT content archetypes, and NO "dataviz" archetype
            # (charts/tables come ONLY from dedicated kit scenes now).
            _content = [s for s in validated if s["scene_type"] == "content"]
            _n_content = len(_content)
            _in_range = "OK" if 5 <= _n_content <= 8 else "OUT-OF-RANGE(expect 5-8)"
            _dataviz_hits = [
                s["id"]
                for s in validated
                if "dataviz" in str(s["id"]).lower()
                or any("dataviz" in str(b).lower() for b in (s.get("best_for") or []))
                or "dataviz" in str(s.get("scene_type", "")).lower()
            ]
            _dataviz_status = (
                f"LEAKED dataviz archetype(s): {_dataviz_hits}"
                if _dataviz_hits
                else "no dataviz archetype (correct)"
            )
            print(
                f"[F7-DEBUG] [V3][SCENE-TYPES] content={_n_content} [{_in_range}] | "
                f"breakdown={[s['scene_type'] for s in validated]} | {_dataviz_status}"
            )
            return validated

        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            elapsed = time.time() - t0
            print(f"[F7-DEBUG] [SCENE-TYPES] Attempt {attempt + 1} failed in {elapsed:.1f}s: {e}")
            if attempt == 0:
                print(f"[F7-DEBUG] [SCENE-TYPES] Retrying...")

    raise RuntimeError(f"Failed to decide brand scene types after 2 attempts: {last_error}")


# ─── Design system generation ────────────────────────────────────


def _generate_design_system(brand_context: str) -> str:
    """Generate a concise visual design system for cross-scene consistency."""
    ensure_dspy_configured()

    module = dspy.ChainOfThought(
        GenerateDesignSystem,
        rationale_field=dspy.OutputField(
            prefix="Analysis:",
            desc="Brief: brand personality → 3 key CSS decisions",
        ),
    )

    t0 = time.time()
    codegen_lm = get_custom_lm()
    with dspy.context(lm=codegen_lm):
        result = module(brand_context=brand_context)

    design_system = result.design_system or ""
    elapsed = time.time() - t0
    print(f"[F7-DEBUG] [DESIGN-SYSTEM] Generated in {elapsed:.1f}s ({len(design_system)} chars)")
    return design_system


# ─── Per-scene generation with Refine ───────────────────────────


def _generate_single_scene_sync(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    scene_purpose: str,
) -> tuple[str, dict[str, str]]:
    """Generate a single scene using DSPy ChainOfThought + Refine (sync).
    Returns (code, {"landscape": "W / H", "portrait": "W / H"})."""
    ensure_dspy_configured()

    base_module = dspy.ChainOfThought(
        GenerateSceneCode,
        rationale_field=dspy.OutputField(
            prefix="Plan:",
            desc="3 bullet points: (1) layout approach, (2) animation strategy, (3) content rendering",
        ),
    )

    refined = dspy.Refine(
        module=base_module,
        N=REFINE_N,
        reward_fn=_scene_reward,
        threshold=0.75,
    )

    t0 = time.time()

    codegen_lm = get_custom_lm()
    with dspy.context(lm=codegen_lm):
        result = refined(
            brand_context=brand_context,
            design_system=design_system,
            scene_type=scene_type,
            scene_index=scene_index,
            total_scenes=total_scenes,
            scene_purpose=scene_purpose,
        )

    elapsed = time.time() - t0
    code = clean_code(result.code or "")

    # Derive image-box aspect ratios for both orientations from the fractions the AI reported.
    # Landscape canvas: 1920x1080. Portrait canvas: 1080x1920.
    def _safe_frac(v: float | None) -> float:
        try:
            f = float(v) if v is not None else 1.0
        except (TypeError, ValueError):
            return 1.0
        return min(1.0, max(0.05, f))

    lw = _safe_frac(getattr(result, "image_box_width_fraction_landscape", None))
    lh = _safe_frac(getattr(result, "image_box_height_fraction_landscape", None))
    pw = _safe_frac(getattr(result, "image_box_width_fraction_portrait", None))
    ph = _safe_frac(getattr(result, "image_box_height_fraction_portrait", None))

    landscape_ar = f"{max(1, int(round(1920 * lw)))} / {max(1, int(round(1080 * lh)))}"
    portrait_ar = f"{max(1, int(round(1080 * pw)))} / {max(1, int(round(1920 * ph)))}"
    aspect_ratios = {"landscape": landscape_ar, "portrait": portrait_ar}

    line_count = code.count("\n") + 1

    print(
        f"[F7-DEBUG] [REFINE] Scene {scene_index} ({scene_type}) done: "
        f"{line_count} lines in {elapsed:.1f}s, "
        f"landscape_ar={landscape_ar!r} (w={lw:.2f}, h={lh:.2f}), "
        f"portrait_ar={portrait_ar!r} (w={pw:.2f}, h={ph:.2f})"
    )
    return code, aspect_ratios


_SCENE_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="scene-gen")


async def _generate_single_scene(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    scene_purpose: str,
) -> tuple[str, dict[str, str]]:
    """Async wrapper — runs the sync Refine call in a dedicated thread pool.
    Returns (code, {"landscape": "W / H", "portrait": "W / H"})."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _SCENE_EXECUTOR,
        _generate_single_scene_sync,
        brand_context,
        design_system,
        scene_type,
        scene_index,
        total_scenes,
        scene_purpose,
    )


# ─── Per-scene brief hints ──────────────────────────────────────


def _scene_hint_for(brief: str, archetype: dict) -> str:
    """Pull the sentence(s) of the user's brief that are relevant to THIS scene.

    Cheap + deterministic (no extra LLM call): split the brief into sentences and
    keep the ones that mention this archetype's content kind (best_for) or its id
    words. Returns a short directive to append to scene_purpose, or "" when nothing
    in the brief targets this scene. The full brief still steered the scene-type
    decision upstream; this just surfaces the specific art direction to the scene
    that should carry it.
    """
    if not brief:
        return ""

    # Keywords per content kind → catch the user naming it in plain language.
    kind_words = {
        "quote": ("quote", "testimonial", "review", "customer", "client", "praise"),
        "code": ("code", "snippet", "demo", "walkthrough", "terminal", "developer", "api"),
        "metrics": ("metric", "stat", "number", "kpi", "figure", "growth", "result"),
        "comparison": ("comparison", "compare", "versus", " vs ", "before", "after", "pros", "cons"),
        "timeline": ("timeline", "history", "roadmap", "milestone", "journey", "step-by-step"),
        "steps": ("step", "how to", "process", "guide", "tutorial", "instructions"),
        "bullets": ("bullet", "feature", "list", "points", "highlights"),
        "plain": ("intro", "overview", "summary", "story", "narrative"),
    }

    best_for = archetype.get("best_for") or []
    targets = set()
    for bf in best_for:
        targets.update(kind_words.get(str(bf).lower(), ()))
    # Also match the id words (e.g. "customer_testimonial" → "customer", "testimonial").
    targets.update(w for w in str(archetype.get("id", "")).lower().split("_") if len(w) > 3)
    if not targets:
        return ""

    sentences = re.split(r"(?<=[.!?\n])\s+", brief)
    matched = [
        s.strip()
        for s in sentences
        if s.strip() and any(t in s.lower() for t in targets)
    ]
    if not matched:
        return ""
    # Keep it short — at most ~240 chars of the most relevant direction.
    hint = " ".join(matched)[:240].strip()
    return f" | USER REQUEST for this scene (honor it): {hint}"


# ─── Main generation entry point ────────────────────────────────


async def generate_component_code(template: CustomTemplate) -> dict[str, str | list[str]]:
    """Generate scene variant code for a custom template using DSPy Refine.

    1. Build brand context (raw data)
    2. Ask AI to decide brand-specific scene types
    3. Generate design system
    4. Generate all scenes in parallel (1 intro + N content + 1 outro)

    Returns dict with keys:
      - intro_code: str
      - outro_code: str
      - content_codes: list[str]
      - archetype_ids: list[dict] — full metadata for content-aware matching
    Raises RuntimeError if generation fails.
    """
    theme = json.loads(template.theme) if isinstance(template.theme, str) else template.theme

    brand_kit_data = None
    if template.brand_kit:
        bk = template.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if isinstance(bk.colors, str) else bk.colors,
            "fonts": json.loads(bk.fonts) if isinstance(bk.fonts, str) else bk.fonts,
            "logos": json.loads(bk.logos) if isinstance(bk.logos, str) else bk.logos,
            "design_language": json.loads(bk.design_language) if isinstance(bk.design_language, str) else bk.design_language,
        }

    personality = ""
    if brand_kit_data and brand_kit_data.get("design_language"):
        personality = brand_kit_data["design_language"].get("personality", "")

    brand_context = _build_brand_context(
        theme,
        brand_kit_data,
        template.name,
        category=template.category or "",
        video_style="",
        personality=personality,
        source_url=template.source_url or "",
    )

    t_start = time.time()

    codegen_lm = get_custom_lm()
    _tok = (getattr(codegen_lm, "kwargs", None) or {}).get("max_tokens")
    print(
        f"[F7-DEBUG] [CODEGEN] LLM model={codegen_lm.model!r} max_tokens={_tok}"
    )

    # Step 1: AI decides scene types for this brand. The raw brief (prompt / doc
    # text, empty for URL-scraped templates) lets the user request specific scenes.
    user_brief = (theme.get("brief") or "").strip() if isinstance(theme, dict) else ""
    if user_brief:
        print(f"[F7-DEBUG] [V3][BRIEF] honoring user brief ({len(user_brief)} chars) in scene decisions")
    loop = asyncio.get_event_loop()
    all_scene_types = await loop.run_in_executor(
        None, _decide_brand_scene_types, brand_context, user_brief
    )

    intro_archetype = next(s for s in all_scene_types if s["scene_type"] == "intro")
    outro_archetype = next(s for s in all_scene_types if s["scene_type"] == "outro")
    content_archetypes = [s for s in all_scene_types if s["scene_type"] == "content"]

    # Step 2: Generate design system
    design_system = await loop.run_in_executor(None, _generate_design_system, brand_context)

    num_content = len(content_archetypes)
    total_scenes = 1 + num_content + 1

    print(
        f"[F7-DEBUG] [CODEGEN] Generating {total_scenes} scenes for '{template.name}': "
        f"1 intro + {num_content} content archetypes + 1 outro"
    )

    # Composition archetypes the per-scene directive in GenerateSceneCode rotates
    # through — surfaced in scene_purpose so each content scene is explicitly told
    # which distinct layout to build (defeats centered-card repetition). These
    # are GEOMETRY DIRECTIVES the model authors itself, not components to wrap.
    _COMPOSITIONS = [
        "centered focal",
        "asymmetric split",
        "full-bleed hero",
        "offset card stack",
        "side rail",
    ]
    # Brand-seeded permutation so two different brands do NOT march through the
    # identical structural rhythm (the old `(i+1) % len` was index-fixed, so every
    # brand shared one sequence — a structural recolor). A deterministic per-brand
    # Fisher–Yates shuffle keeps neighbours distinct while differing across brands.
    _seed = f"{theme.get('category', '')}|{theme.get('style', '')}|{template.name}"
    _rng = int(hashlib.md5(_seed.encode("utf-8")).hexdigest(), 16)
    _comp_order = _COMPOSITIONS[:]
    for _k in range(len(_comp_order) - 1, 0, -1):
        _rng, _j = divmod(_rng, _k + 1)
        _comp_order[_k], _comp_order[_j] = _comp_order[_j], _comp_order[_k]
    print(f"[F7-DEBUG] [V3][COMPOSITION] brand-seeded order: {_comp_order}")

    # Per-scene SIGNATURE ARTIFACT rotation. Instead of every scene repeating the
    # one artifactMotion (which read as same-y), rotate through the brand's small
    # artifactSet (primary + up to 2 related from the same bucket). intro = the
    # boldest/primary as a hero take; content scenes rotate the rest for variety;
    # outro = a DIFFERENT member than the intro so the bookends don't look alike.
    _sig = (theme.get("signature") or {})
    _artifact_set = _sig.get("artifactSet") or [_sig.get("artifactMotion") or "drift"]
    _intro_artifact = _artifact_set[0]
    _outro_artifact = _artifact_set[-1] if len(_artifact_set) > 1 else _artifact_set[0]
    # Content scenes rotate the non-primary members first (so they differ from the
    # intro's hero artifact), falling back to the whole set if there's only one.
    _content_pool = _artifact_set[1:] or _artifact_set
    print(
        f"[F7-DEBUG] [V3][ARTIFACT] set={_artifact_set} | intro={_intro_artifact} "
        f"| content_pool={_content_pool} | outro={_outro_artifact}"
    )

    # Step 3: Generate ALL scenes in parallel
    tasks = [
        _generate_single_scene(
            brand_context=brand_context,
            design_system=design_system,
            scene_type="intro",
            scene_index=0,
            total_scenes=total_scenes,
            scene_purpose=(
                f"{intro_archetype['id']}: {intro_archetype['description']} "
                "| brand-reveal opener: lead with an animated brand-name title + a real "
                "logo reveal and ONE signature entrance beat (no bullet/metric lists) "
                f"| SIGNATURE ARTIFACT: give <SignatureArtifact motion=\"{_intro_artifact}\" "
                "intensity={0.7} /> its BOLD hero take here — this is the loudest, most "
                "energetic moment of the whole video; the title entrance should be the "
                "video's biggest motion beat"
            ),
        ),
    ]
    for i, arch in enumerate(content_archetypes):
        best_for_hint = (
            f" | best_for={arch['best_for']}" if arch.get("best_for") else ""
        )
        _comp = _comp_order[i % len(_comp_order)]
        _brief_hint = _scene_hint_for(user_brief, arch)
        _scene_artifact = _content_pool[i % len(_content_pool)]
        # ── V3 verification: each content scene gets a distinct, brand-seeded
        # composition directive (the model authors the geometry itself).
        print(
            f"[F7-DEBUG] [V3][COMPOSITION] content scene {i + 1}/{num_content} "
            f"(archetype={arch['id']!r}) -> composition={_comp!r} artifact={_scene_artifact!r}"
            f"{' [+brief-hint]' if _brief_hint else ''}"
        )
        tasks.append(
            _generate_single_scene(
                brand_context=brand_context,
                design_system=design_system,
                scene_type="content",
                scene_index=i + 1,
                total_scenes=total_scenes,
                scene_purpose=(
                    f"{arch['id']}: {arch['description']}{best_for_hint} "
                    f"| content scene {i + 1} of {num_content}: use a '{_comp}' composition, "
                    "visually DISTINCT from its neighbours (do not reuse a centered card) "
                    f"| SIGNATURE ARTIFACT: echo the brand with <SignatureArtifact "
                    f"motion=\"{_scene_artifact}\" intensity={{0.4}} /> — a restrained ECHO "
                    "(not the intro's hero take), placed differently than neighbouring scenes"
                    f"{_brief_hint}"
                ),
            ),
        )
    tasks.append(
        _generate_single_scene(
            brand_context=brand_context,
            design_system=design_system,
            scene_type="outro",
            scene_index=total_scenes - 1,
            total_scenes=total_scenes,
            scene_purpose=(
                f"{outro_archetype['id']}: {outro_archetype['description']} "
                "| closing brand recap (a CTA + socials row is overlaid automatically — "
                "do not hand-roll social icons or CTA buttons) "
                "| DELIBERATELY DIFFERENT FROM THE INTRO: where the intro was loud, big and "
                "energetic, the outro is calm and settled — a different alignment/composition "
                "and a gentler entrance (NOT the same centered title treatment as the intro) "
                f"| SIGNATURE ARTIFACT: a QUIET callback with <SignatureArtifact "
                f"motion=\"{_outro_artifact}\" intensity={{0.35}} /> — a different motif than "
                "the intro's hero artifact so the bookends don't look identical"
            ),
        ),
    )

    scene_tuples = await asyncio.gather(*tasks)
    scenes = [code for code, _ in scene_tuples]
    # Each entry is a dict {"landscape": "W / H", "portrait": "W / H"}
    scene_aspect_ratios: list[dict[str, str]] = [ar for _, ar in scene_tuples]

    # Log what was generated
    scene_labels = [intro_archetype["id"]] + [a["id"] for a in content_archetypes] + [outro_archetype["id"]]
    for i, (label, code) in enumerate(zip(scene_labels, scenes)):
        line_count = code.count("\n") + 1
        print(f"[F7-DEBUG] [CODEGEN] Scene {i} ({label}): {line_count} lines")

    # Final validation pass
    scene_types_simple = ["intro"] + ["content"] * num_content + ["outro"]
    for i, code in enumerate(scenes):
        valid, err = validate_component_code(code, scene_type=scene_types_simple[i])
        if not valid:
            raise RuntimeError(f"Scene {i} ({scene_types_simple[i]}) failed validation after Refine: {err}")

    intro_code = scenes[0]
    outro_code = scenes[-1]
    content_codes = list(scenes[1:-1])

    t_total = time.time() - t_start

    scene_summary = ", ".join(
        f"{label}:{code.count(chr(10)) + 1}L"
        for label, code in zip(scene_labels, scenes)
    )
    print(
        f"[F7-DEBUG] [CODEGEN] '{template.name}' done in {t_total:.1f}s — "
        f"{len(scenes)} scenes ({scene_summary})"
    )

    return {
        "intro_code": intro_code,
        "outro_code": outro_code,
        "content_codes": content_codes,
        # Full archetype metadata for content-aware matching at video time
        "archetype_ids": [{"id": a["id"], "best_for": a["best_for"]} for a in content_archetypes],
        # Image box aspect ratios per scene type — used to configure the image adjustment modal
        "intro_aspect_ratio": scene_aspect_ratios[0],
        "outro_aspect_ratio": scene_aspect_ratios[-1],
        "content_aspect_ratios": scene_aspect_ratios[1:-1],
    }
