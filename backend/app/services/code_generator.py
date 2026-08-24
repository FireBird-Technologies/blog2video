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
from functools import partial

import dspy

from app.config import settings
from app.dspy_modules import ensure_dspy_configured, get_custom_lm, get_scene_type_lm
from app.models.custom_template import CustomTemplate
from app.services.scene_visual_check import visual_check_scene
from app.services.code_validator import (
    clean_code,
    validate_component_code,
    validate_wrapped_component_code,
)

logger = logging.getLogger(__name__)

REFINE_N = 2          # Max 3 attempts per scene (1 initial + 2 retries)
MAX_SCENE_EDIT_RETRIES = 3  # Repair attempts for a single-scene AI edit (P4)


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
    plan_note: str = dspy.OutputField(
        desc=(
            "AT MOST 2 SHORT LINES naming the shape of the set you are about to emit — the "
            "brand's content character and how the content scenes differ. Then STOP and write "
            "scene_types_json. This replaces free-form chain-of-thought deliberately: an "
            "unbounded rationale consumed the output budget and the JSON array came back "
            "truncated. Do not enumerate the scenes here; do not think out loud."
        )
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
    - THE THREE TEXT PROPS ARE DIFFERENT THINGS — do not substitute one for another:
        props.displayText   the ON-SCREEN copy. This is your headline / body text.
        props.sceneTitle    the scene's SHORT TITLE — a label, not a sentence. Good for an
                            eyebrow, a section heading or a chapter marker above the headline.
                            May be empty; guard it.
        props.narrationText the VOICEOVER SCRIPT. It is spoken aloud, and is usually a full
                            paragraph. NEVER RENDER IT AT ALL — not as a headline, not as a
                            caption, not as an eyebrow, not anywhere. It is audio, not copy.
                            Putting it on screen shows the viewer the words they are already
                            hearing, usually duplicating displayText. This is validated: any
                            JSX use of narrationText is rejected. If you want a small label,
                            use props.sceneTitle.

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
      RECLAIM THE FULL WIDTH. If the with-image branch gives the text column 35%, the no-image
      branch gives it 90-100% — not 70%. Widening only part-way is the single most common way
      generated scenes end up with a third of the frame empty, and it is scored:
          width: showVisualSlot ? '35%' : '100%'      ✅
          width: showVisualSlot ? '35%' : '70%'       ❌ leaves 30% bare
      If the extra width alone would leave the copy stranded, spend it: a larger headline, a
      typographic anchor, a rule, or an oversized ghost numeral behind the text.
    - Missing image handling is a BUG — the validator REJECTS a scene that does not declare
      hasImage and branch on it, and the reward function penalizes an image-capable layout
      with no data-content-img slot

    Stock-footage clip (props.hasVideo) — a THIRD state, distinct from both hasImage cases:
    - const hasVideo = !!props.hasVideo;
      When true, a background video clip is ALREADY being rendered behind this component by the
      player — you do NOT render the clip, and props.imageUrl will be undefined even though this is
      NOT the "no visual" case. Treat hasVideo exactly like hasImage for LAYOUT PURPOSES: use the
      same split/stacked geometry (landscape 50/50 row, portrait 45/55 stacked) and still render the
      slot container marked data-content-img="1" (see the CRITICAL rule below for exactly where that
      marker goes) — but leave that container fully transparent (background: 'transparent', no fill,
      no <Img>) so the clip underneath shows through. NEVER render the hasImage-false (full-width
      text) branch when hasVideo is true — that layout has no slot for the clip and the clip would
      end up hidden behind opaque text/background.
    - Priority when branching: check hasVideo BEFORE falling back to the hasImage-false branch:
        const showVisualSlot = hasImage || hasVideo;  // reserve the image/video geometry
        const showImageContent = hasImage && !hasVideo;  // only render <Img> when there really is one
      Use `showVisualSlot` wherever you'd normally check `hasImage` for LAYOUT (split vs full-width),
      and `showImageContent` only to decide whether an actual <Img> is painted inside the slot.
    - CRITICAL — WHERE data-content-img="1" GOES: put it on the slot's CONTAINER <div> (the element
      that carries the slot's width/height/position), and render that container whenever
      `showVisualSlot` is true — NOT on the <Img>, and NEVER inside a `{showImageContent && ...}`
      guard. If the marker only exists on the <Img>, it disappears in the hasVideo case (no <Img>
      is painted) and the player cannot find the slot to align the clip to — the clip then falls
      back to covering the whole frame. Correct shape:
        {showVisualSlot && (
          <div data-content-img="1" style={{ width: ..., height: ..., position: 'relative',
                                             overflow: 'hidden', background: 'transparent' }}>
            {showImageContent && <Img src={props.imageUrl} style={{width:'100%',height:'100%',
                                     objectFit:'cover', ...}} />}
          </div>
        )}
    - When hasVideo is true the slot must be visually EMPTY: no <Img>, no background fill, no opaque
      overlay/scrim inside it — the clip is painted behind it and shows through.
    - The component's OUTERMOST <AbsoluteFill> background must ALSO be transparent when hasVideo is
      true (`background: hasVideo ? 'transparent' : <your normal bg>`). An unconditional
      backgroundColor/gradient there sits on top of the clip and hides it completely.
    - NEVER pass a video URL as props.imageUrl — the player never does this; a real image is always
      a real image.

    Typography (MANDATORY for readability at 1920×1080):
    - NEVER hardcode fontFamily strings like "Inter" or "Roboto" — fonts are passed as props.
      For headings/titles use: fontFamily: props.headingFont || "inherit"
      For body/description text use: fontFamily: props.bodyFont || "inherit"
      This lets users change fonts from Settings without regenerating templates.
    - ALL FONT SIZES COME FROM THE `art_direction` FIELD. It states a min-max px range for the
      headline, body and labels, per orientation, for THIS template. Use those numbers; do not
      substitute a size of your own and do not treat the bottom of a range as the target.
      (Sizes are not stated here because they differ per template — a single house scale applied
      to every brand is what made body copy uniformly tiny and headlines overflow their frame.)
    - MANDATORY — the headline MUST read props.titleFontSize, and body copy MUST read
      props.descriptionFontSize, each with your art_direction size as the fallback:
          <FitText fontSize={props.titleFontSize ?? <headline max from art_direction>} ...>
          fontSize: (props.descriptionFontSize ?? <body size from art_direction>)
      These are the editor's Typography sliders. A hardcoded headline size makes the slider do
      nothing when the user drags it. This is validated: a headline that renders
      props.displayText without referencing props.titleFontSize is rejected.
    - Do NOT hardcode tiny font sizes (e.g. 12–18px) for primary readable content, and do NOT
      exceed the top of the art_direction range — that is what breaks a headline mid-word.

    Overflow safety (MANDATORY — content must FIT the frame in BOTH orientations):
    The polished built-in templates never let text or rows escape the frame, and neither may you.
    overflow:'hidden' on the root only CLIPS spill — it does NOT make content fit. The frame is
    1920×1080 (landscape) or a much narrower 1080×1920 (portrait); the SAME copy must fit both.
    - Every flex CHILD that holds text MUST set `minWidth: 0`. Flex items default to min-width:auto,
      which lets long words/titles push past the container instead of wrapping — this is the #1 cause
      of text spilling off-frame. Add `minWidth: 0` to the text column of every split/row layout.
    - Every block of running text MUST set `overflowWrap: 'break-word'` (and `wordBreak: 'break-word'`)
      so a long unbroken word breaks instead of overflowing.
    - The primary headline / displayText and any BIG numeral should use <FitText> (auto-shrinks to
      fit, never overshoots) rather than a bare element with a fixed fontSize — portrait especially.
    - CAP every list before mapping: `const items = (props.bullets ?? []).slice(0, isPortrait ? 4 : 5);`
      (metrics/steps/timelineItems likewise — portrait fits FEWER rows). NEVER map an uncapped array;
      a long list overshoots the bottom of the frame. The kit StatGrid/MetricRow already cap internally.
    - Fixed-size decals (markers, dots, icons, the logo Img) MUST set `flexShrink: 0` so they don't get
      squeezed; the flexible text beside them gets `flex: 1, minWidth: 0`.
    - Bound any stacked-rows block with a sensible gap and, if many rows, `maxHeight: '100%'` + smaller
      per-row sizing in portrait. When in doubt, fewer items at a larger size beats cramming everything.
    - Portrait is NARROW: scale headings down (use isPortrait to pick a smaller fontSize, or rely on
      <FitText>), stack instead of side-by-side, and reduce the item count. A landscape layout reused
      verbatim in portrait WILL overshoot — that is the exact bug to avoid.

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
    - Negative space is STRUCTURED, not leftover. Space earns its place by separating groups
      and framing the focal element; a large region with nothing in it is a HOLE, not
      restraint. Concretely: the composed content (type, panels, decor, artifact) should
      occupy roughly 55-75% of the safe area. Below that the frame reads unfinished — which
      is the most common defect in generated scenes — above it, cluttered.
    - ONE decorative system at low intensity (not several), hairline borders, a single accent.
    Prefer the craft-kit components (they already encode these patterns) over re-deriving by hand.

    Available APIs (pre-injected as globals, do NOT import):
    - React, React.createElement, React.useState, React.useMemo
    - useCurrentFrame(), useVideoConfig() → { fps, width, height, durationInFrames }
    - interpolate(frame, inputRange, outputRange, options?) — BOTH ranges must be
      NUMBERS only. Never put strings/units inside (NOT ['0%','100%']); interpolate
      the number then add the unit in the style: width: `${interpolate(p,[0,1],[0,100])}%`
    - interpolate's FIRST argument (the progress value, e.g. `frame`, `frame - item.delay`,
      `frame - i*12`) MUST always evaluate to a finite number — "Cannot interpolate an input
      which is not a number" is a hard runtime crash that takes down the whole scene. This
      breaks whenever the value is derived from a field on a mapped item that might be
      undefined (e.g. `item.delay`, `entry.offset`) rather than the loop index `i` itself.
      When interpolating per-item inside a `.map((item, i) => ...)`, ALWAYS derive the
      progress value from `i` (e.g. `frame - i * 12`), never from a property read off `item` —
      props arrays (props.timelineItems, props.steps, etc.) are free-form data and are not
      guaranteed to carry timing fields.
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
    - <FitText fontSize={props.titleFontSize ?? 75} minFontSize={48} maxLines={3}>{props.displayText}</FitText>
        — auto-shrinking text that CANNOT overshoot its box (deterministic, render-safe). Use it for
        the primary headline / displayText and for any big numeral, ESPECIALLY in portrait where the
        canvas is narrow. It already applies minWidth:0 + overflowWrap, so wrap long titles in it
        instead of a bare <div> with a fixed fontSize.
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
    - CONTRAST: readableOn(bgHex) → "#FFFFFF" on a dark background, "#0A0A0A" on a
        light one. Also luminance(hex) → 0..1 and isDarkColor(hex) → boolean.
        readableOn is how you guarantee text is visible on ANY background you set.
    - DEPTH / CAMERA (pre-injected globals — this is what separates a filmed shot
        from a slide; use them, do not hand-roll perspective math):
        cameraStage(depth?) → put on the WRAPPER to establish the 3D volume, e.g.
          <AbsoluteFill style={{...cameraStage(1600)}}> ... </AbsoluteFill>
        cameraPush(frame, durationInFrames, intensity?) → a slow continuous push +
          settling tilt across the WHOLE scene. Spread on the composition group.
          Keep intensity 0.3-0.6 behind text.
        parallaxLayer(frame, durationInFrames, depth?, intensity?) → per-layer
          drift. Give the BACKDROP a negative depth and the foreground a positive
          one so they separate — opposing directions is what reads as parallax.
          Spread it: <div style={{...parallaxLayer(frame, durationInFrames, -1, 0.4)}}>
        panelTilt(frame, delayFrames?, intensity?) → a card that rises with a
          forward tilt that settles; returns {{transform, transformStyle, opacity}}.
          Spread it: <div style={{...panelTilt(frame, 6)}}>
        ALL FOUR of these return style OBJECTS. They MUST be spread into a style
          prop with `...`. Writing style={{ cameraPush(...) }} without the spread
          is a JavaScript syntax error and the scene will not compile.
        All are frame-driven and bounded (perspective clamps to 900-2600px, the
        push tops out at 6%), so they cannot distort type or push content
        off-frame. NEVER derive motion from Date.now() or Math.random() — renders
        must be deterministic.

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

    ART DIRECTION — read the `art_direction` input field.
    The composition rules for THIS template (safe area, how the frame is used, the intro and
    outro character, and the per-scene geometry) are NOT in this prompt. They arrive in the
    `art_direction` field, because they differ per template. Follow that field exactly. This
    prompt tells you what the kit CAN DO; `art_direction` tells you what THIS BRAND DOES.
    Where the two ever seem to disagree, `art_direction` wins.

    Scene-type technical contracts (these hold for every template, whatever the art direction):
    - EVERY SCENE, including content and outro: the logo conditional from the Required Elements
      above is MANDATORY here too — `{props.logoUrl && typeof props.logoUrl === 'string' && (
      <Img src={props.logoUrl} data-logo="1" ... />)}`. The validator REJECTS any scene missing
      it, whatever its art direction. It is a render-safety contract, not an intro flourish:
      art_direction decides WHERE the logo sits (or that it sits quietly in a corner), never
      WHETHER the conditional exists.
    - INTRO (scene_type == "intro"): also declare `const hasImage = !!(props.imageUrl && ...)`.
      Do NOT render bullet/metric/step lists in the intro. Branch on isPortrait — portrait and
      landscape must not be the same JSX.
    - OUTRO (scene_type == "outro"): a dynamic CTA + social row is composited automatically ON TOP
      of the outro at render time, so do NOT hand-roll social icons, website buttons, or
      "Subscribe/Follow" CTAs — leave the space where those will sit clear. This scene takes NO
      content image.

    BACKDROP — richness lives HERE; do NOT leave every scene on the flat brand bg.
    Give each scene a deliberate backdrop and VARY it scene-to-scene. Some scenes SHOULD go
    DARK / INVERTED for contrast and drama (a deep panel using the brand's text colour or a
    darkened accent, with light text on top); others use a subtle accent wash, a brand surface
    panel, or a low-intensity <Decor> atmosphere. A few darker scenes set against lighter
    neighbours is exactly what makes a video feel crafted instead of a slide deck. An inverted/
    dark panel is a SOLID fill — always allowed, even for "solid backgrounds only" brands (this is
    per-scene contrast, NOT a gradient). Keep text contrast legible (AA); stay in the brand palette.
    CONTRAST (HARD RULE — invisible text is the single worst failure a scene can have):
    Whenever you set a background that is NOT palette.bg, you MUST derive its foreground:
        const panelBg = <that colour>;
        const panelFg = readableOn(panelBg);   // pre-injected global, no import
    and use panelFg for EVERY text node inside that region. Never place palette.text on a
    surface whose background IS palette.text — that renders the text invisible. The same
    applies to a dark accent panel, a coloured card, or type over a solid colour block.

    Useful fragments (ADAPT to the scene — do not paste verbatim, vary them):
      • inverted panel:  const invBg = palette.text; const invFg = readableOn(invBg);
          <AbsoluteFill style={{background: invBg}} /> — and every text node on top of it
          uses color: invFg (NOT palette.text, which is this panel's own background).
      • darkened accent: withAlpha(palette.accent, 0.92) over a near-black wash, with
          text at color: readableOn(palette.accent)
      • hero scrim:      linear-gradient(0deg, <bg at 0.9> 0%, transparent 70%) over the image
      • brand atmosphere: <Decor system="<this brand's signature decor>" intensity={0.4} />
    Apply the Motion rules above (one dominant beat + quiet support). Author the scene's geometry
    directly from `art_direction` with plain flex/absolute divs — the kit layout skeletons are
    available if one happens to fit cleanly, but they are NOT a menu to pick from and reaching for
    one instead of building the described geometry is what makes every brand look alike.

    Component Props:
    { sceneTitle?, displayText, narrationText, imageUrl?, imageObjectPosition?: string, imageZoom?: number,
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
    blueprint: str = dspy.InputField(
        desc=(
            "This template's Design Blueprint as JSON (may be empty). When present it is the "
            "DESIGN LAW for the whole template: its identity, persistent structure (chrome, "
            "dividers, panel numbering), type system and per-orientation safe-area policy. "
            "Every scene in this template shares it — that shared structure is what makes the "
            "scenes read as one template. Follow it exactly; it OVERRIDES any generic guidance "
            "in this prompt, including default insets, font sizes and composition habits."
        ),
        default="",
    )
    art_direction: str = dspy.InputField(
        desc=(
            "THE COMPOSITION RULES FOR THIS TEMPLATE — safe-area insets, how the frame is used, "
            "the intro and outro character, and this scene's geometry. These are deliberately "
            "not in the system prompt because they differ per template: a generic house style "
            "applied to every brand is what makes custom templates look alike. Treat this field "
            "as the art director's brief and follow it literally, including its numbers. It "
            "OUTRANKS any composition habit or default inset you would otherwise apply."
        ),
        default="",
    )
    layout_spec: str = dspy.InputField(
        desc=(
            "THIS scene's layout entry from the blueprint as JSON (may be empty): id, role, "
            "geometry, geometry_portrait, best_for, surface, artifact, artifact_intensity, "
            "structural_elements, supports_image, image_treatment, motion_beat. Build the "
            "scene's geometry to match `geometry` (and `geometry_portrait` for portrait) — "
            "these were authored specifically for this brand, so do not substitute a generic "
            "composition. Render every component named in `structural_elements`."
        ),
        default="",
    )
    scene_type: str = dspy.InputField(desc="'intro', 'content', or 'outro'")
    scene_index: int = dspy.InputField(desc="0-based scene index")
    total_scenes: int = dspy.InputField(desc="Total number of scenes being generated")
    scene_purpose: str = dspy.InputField(
        desc="What this scene is for — e.g., 'intro scene: establish brand identity' or 'content scene optimized for metrics/statistics'"
    )
    current_code: str = dspy.InputField(
        desc=(
            "Empty when generating fresh. When editing: the scene's CURRENT code. Produce a "
            "modified version of it, preserving everything the user did not ask to change."
        ),
        default="",
    )
    edit_instruction: str = dspy.InputField(
        desc=(
            "Empty when generating fresh. When editing: the user's requested change to this "
            "scene. Apply it faithfully. If it conflicts with layout_spec.geometry, THE USER "
            "WINS — the layout is theirs to change, and the blueprint is a starting point, not "
            "a constraint on what they may ask for. Keep every technical contract intact "
            "(props-only text, the image/logo conditionals, the data-content-img marker, "
            "overflow guards)."
        ),
        default="",
    )
    previous_failure: str = dspy.InputField(
        desc=(
            "Empty on the first attempt. On a retry: the EXACT validation error from your "
            "previous attempt, with the offending source lines when available. Fix EVERY "
            "error reported here. Change ONLY what is broken — keep the intended layout, "
            "geometry and motion of your previous attempt."
        ),
        default="",
    )

    code: str = dspy.OutputField(desc="Complete SceneComponent code (const SceneComponent = (props) => { ... };)")
    image_box_width_fraction_landscape: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the `if (!isPortrait) { ... }` (or `!p && ...`) branch of your code: "
            "fraction of the LANDSCAPE 1920x1080 canvas WIDTH occupied by the image container (0.0 to 1.0). "
            "Examples: 0.5 if image container is width: '50%' of the scene, 1.0 if width: '100%'. "
            "Read this directly from the width style you set on the element with data-content-img=\"1\" "
            "in the LANDSCAPE branch. If the scene has no image, output 1.0."
        )
    )
    image_box_height_fraction_landscape: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the LANDSCAPE branch of your code: "
            "fraction of the LANDSCAPE 1920x1080 canvas HEIGHT occupied by the image container (0.0 to 1.0). "
            "Examples: 1.0 if height: '100%' of scene, 0.5 if height: '50%' (top/bottom half). "
            "Read this from the height style of the LANDSCAPE branch's data-content-img element. "
            "If the scene has no image, output 1.0."
        )
    )
    image_box_width_fraction_portrait: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the `if (isPortrait) { ... }` (or `p && ...`) branch of your code: "
            "fraction of the PORTRAIT 1080x1920 canvas WIDTH occupied by the image container (0.0 to 1.0). "
            "Common portrait layouts use width: '100%' (image stacked above text) → output 1.0. "
            "Read this from the width style of the PORTRAIT branch's data-content-img element. "
            "If portrait reuses the landscape branch (same JSX), output the landscape width fraction."
        )
    )
    image_box_height_fraction_portrait: float = dspy.OutputField(
        default=1.0,
        desc=(
            "Inside the PORTRAIT branch of your code: "
            "fraction of the PORTRAIT 1080x1920 canvas HEIGHT occupied by the image container (0.0 to 1.0). "
            "Common portrait layouts: image is the top 40-50% (height: '45%') → output 0.45. "
            "Read this from the height style of the PORTRAIT branch's data-content-img element. "
            "If portrait reuses the landscape branch, output the landscape height fraction."
        )
    )


# ─── Scene scoring ────────────────────────────────────────────
#
# The bar an attempt must clear to be accepted without a retry. Deliberately
# generous: the checks below are quality NUDGES, and each costs a full extra LLM
# call when it forces a re-roll. At the old 0.75 any TWO -0.15 nudges (e.g. "no
# overflow guard" + "does not branch on isPortrait", both common on blueprint
# templates) sank an otherwise VALID scene to 0.70 and bought another rollout for
# cosmetic reasons. 0.6 still forces a retry on the genuinely bad combinations
# (hardcoded data -0.3 + contentType leak -0.2 = 0.5) while letting valid,
# slightly-imperfect scenes through.
REFINE_THRESHOLD = 0.6

# Scenes scoring at or above this are trusted without rendering them. Below it
# (but at or above REFINE_THRESHOLD) the scene is good enough to ship yet has at
# least one soft defect, which is exactly where a screenshot earns its cost: the
# new contrast (-0.25) and undersized-type (-0.24) penalties land here on
# purpose, so the picture confirms or clears them instead of forcing a blind
# re-roll. A scene at 1.00 never touches a browser.
VISUAL_CHECK_THRESHOLD = 0.85


def _score_valid_scene(code: str, args) -> float:
    """Soft quality score for code that ALREADY passed validation.

    Split out of _scene_reward so the informed-retry loop can score an attempt
    it has already validated, without validating twice.

    `args` may be a plain kwargs dict (informed-retry path) or a DSPy Example
    (legacy reward path), so field access goes through _arg() rather than
    getattr alone.
    """
    def _arg(name: str, default=""):
        if isinstance(args, dict):
            return args.get(name, default)
        return getattr(args, name, default)

    scene_type = _arg("scene_type", "content")
    score = 1.0

    # Bug: hardcoded sample data arrays (fake content in components)
    #
    # The array must contain a QUOTED STRING for one of these keys — invented
    # copy is the defect, not the key name. Two false positives measured on real
    # scenes before this was tightened, both costing a -0.3 and a repair rollout
    # on correct code:
    #   * `fallbackItems.push({value: segments[i] || displayText, label: ''})`
    #     — built FROM props, and `label: ''` is empty, not fake copy;
    #   * `const nodePositions = [18, 38, 58, 78]` followed by `labelSize: 16`
    #     — layout coordinates, matched only because "label" appears nearby.
    hardcoded_array = re.search(
        r'(?:const|let|var)\s+\w+\s*=\s*\[[\s\S]{20,}?'
        r'(?:text|icon|label|description|name|desc|title|heading)\s*:\s*'
        r'[\'"][^\'"]{3,}[\'"]',
        code,
    )
    if hardcoded_array and not re.search(
        r'=\s*props\.', code[hardcoded_array.start() : hardcoded_array.start() + 100]
    ):
        score -= 0.3
        print("[F7-DEBUG] [REFINE] -0.3: hardcoded sample data")

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
    scene_purpose = _arg("scene_purpose", "") or ""
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

    # ── Blueprint adherence (P2) ──────────────────────────────────────────────
    # Replaces the old CONFORMITY nudges. Those penalised any deviation from one
    # house style — -0.3 if a metrics scene didn't use StatGrid, -0.3 if an intro
    # lacked RevealText, -0.2 for "no deliberate backdrop" — which is precisely
    # what made every brand's scenes converge. A metrics scene in an editorial
    # template SHOULD look different from one in a fintech template.
    #
    # What replaces them is adherence to THIS template's own design: did the
    # scene render the structural elements and artifact its blueprint layout
    # declared? Skipped entirely when layout_spec is absent (the legacy path and
    # already-generated templates), so nothing regresses.
    layout_spec_raw = _arg("layout_spec", "") or ""
    if layout_spec_raw:
        try:
            _spec = json.loads(layout_spec_raw)
        except (json.JSONDecodeError, TypeError):
            _spec = {}

        if _spec:
            from app.services.kit_vocabulary import STRUCTURAL_COMPONENT

            _elements = _spec.get("structural_elements") or []
            # Masthead is the persistent chrome — its absence breaks the
            # "one template" read across scenes, so it is weighted heavier.
            if "masthead" in _elements and not re.search(r"<Masthead\b", code):
                score -= 0.2
                print("[F7-DEBUG] [REFINE] -0.2: blueprint declares a masthead, scene omits it")

            _missing = [
                e for e in _elements
                if e != "masthead"
                and not re.search(rf"<{STRUCTURAL_COMPONENT.get(e, e)}\b", code)
            ]
            if _missing:
                score -= min(0.3, 0.15 * len(_missing))
                print(f"[F7-DEBUG] [REFINE] -{min(0.3, 0.15 * len(_missing)):.2f}: blueprint structural elements missing: {_missing}")

            _artifact = _spec.get("artifact")
            if _artifact and not re.search(r"<SignatureArtifact\b", code):
                score -= 0.15
                print(f"[F7-DEBUG] [REFINE] -0.15: blueprint artifact {_artifact!r} not rendered")

            # A layout declared image-capable must actually handle an image.
            if _spec.get("supports_image") and not re.search(r"data-content-img", code):
                score -= 0.15
                print("[F7-DEBUG] [REFINE] -0.15: image-capable layout has no data-content-img slot")

    # ── The no-image branch must RECLAIM the space ────────────────────────────
    #
    # Content scenes very often render without an image — always in the preview,
    # and whenever the pipeline assigns none. A scene that reserves 35% for an
    # image and then widens to only 70% without one leaves 30% of the frame bare.
    # That is the "large amount of empty space" defect, and it is invisible to
    # every other check here: the scene has a hasImage branch, has the image
    # slot, and scores 1.00 while a third of the canvas renders empty.
    _reclaim = re.findall(
        r"(?:showVisualSlot|hasImage|showImageContent)\s*\?\s*'(\d+)%'\s*:\s*'(\d+)%'", code
    )
    _short = [(int(a), int(b)) for a, b in _reclaim if int(b) > int(a) and int(b) < 90]
    if _short:
        score -= 0.15
        _w, _n = _short[0]
        print(
            f"[F7-DEBUG] [REFINE] -0.15: no-image branch widens {_w}% -> {_n}% only, "
            f"leaving {100 - _n}% of the frame bare"
        )

    # ── Inert-scene floor (content) ───────────────────────────────────────────
    # The only survivor of the old richness nudges, and softened: it guards
    # against a genuinely lifeless scene rather than enforcing a look. Largely
    # redundant (validate_component_code already requires >= 2 animation calls),
    # so it is a small backstop, not a style mandate.
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
                r'\b(SignatureArtifact|CornerFrame|StreakField|KineticTicker|BigGlyphBackdrop|PulseRing|AccentSweep)\b',
            )
        )
        if _anim_signals < 1 and not re.search(r'<Decor\b', code):
            score -= 0.15
            print("[F7-DEBUG] [REFINE] -0.15: content scene has no motion at all")

    # ── Portrait quality nudge (CONTENT scenes only) ──────────────────────────
    # The same component renders into a 1920×1080 landscape AND a 1080×1920
    # portrait canvas. A content scene that declares isPortrait but never *branches*
    # on it is really a landscape-only layout that can look squished/overshooting in
    # portrait. Scoped to content (intro/outro are often a centred brand reveal that
    # reads fine both ways — don't make them burn retries). Small penalty so a single
    # miss alone won't drop a scene below threshold; it only bites when stacked with
    # another real issue. Best attempt is always returned regardless.
    if scene_type == "content":
        _declares_portrait = bool(re.search(r'\bisPortrait\b', code))
        # "Used" = appears in a ternary or an if/&& guard, not just the declaration line.
        _branches_portrait = bool(
            re.search(r'isPortrait\s*\?', code)               # ternary
            or re.search(r'(?:if\s*\(|&&|\|\|)\s*[^)\n]*\bisPortrait\b', code)  # guard
            or re.search(r'!\s*isPortrait\b', code)           # negated guard
        )
        if not _declares_portrait or not _branches_portrait:
            score -= 0.15
            print(f"[F7-DEBUG] [REFINE] -0.15: content scene does not branch layout on isPortrait (portrait may look off)")

    # ── Overflow-safety nudge (ALL scene types) ───────────────────────────────
    # overflow:'hidden' on the root only CLIPS spill — it doesn't make content fit.
    # Metrics/steps/long headers overshoot the frame in BOTH orientations unless the
    # scene uses the same structural guards the built-in templates use:
    #   • minWidth:0 on flex children  (flex defaults to min-width:auto → children
    #     overflow instead of wrapping — the #1 cause of text spilling)
    #   • overflowWrap/wordBreak on text  (long words break instead of pushing out)
    #   • FitText for headlines/numerals  (auto-shrinks to fit, never overshoots)
    # Small penalty so it nudges without forcing a retry on its own — kit-built scenes
    # (StatGrid/MetricRow/FitText) already satisfy this; only a fully hand-rolled scene
    # with zero guards is flagged.
    _has_overflow_guard = bool(
        re.search(r'minWidth\s*:\s*0\b', code)
        or re.search(r'overflowWrap', code)
        or re.search(r'wordBreak', code)
        or re.search(r'<FitText\b', code)
    )
    if not _has_overflow_guard:
        score -= 0.15
        print(f"[F7-DEBUG] [REFINE] -0.15: no overflow guard (minWidth:0 / overflowWrap / FitText) — text may overshoot")

    # ── Depth / camera (ALL scene types) ──────────────────────────────────────
    # The art direction asks every scene for a camera stage and a continuous
    # push; without a score attached that is only a suggestion, and the model
    # reliably skips it (flat 2D is less work). This is what makes generated
    # scenes read as slides next to the built-in templates.
    #
    # A PENALTY only, with no offsetting bonus. A bonus here would let a rich but
    # UNSAFE scene (oversized type, no FitText) buy its way back over the
    # threshold, which is the one thing the scoring must never allow — the
    # overflow penalties have to stay decisive.
    _has_camera = bool(re.search(r'\b(?:cameraStage|cameraPush|parallaxLayer|panelTilt)\s*\(', code))
    if not _has_camera:
        score -= 0.2
        print("[F7-DEBUG] [REFINE] -0.2: no camera/depth (cameraStage/cameraPush/parallaxLayer)")

    # Tonal depth: a gradient, scrim or wash somewhere. A scene painted on one
    # flat fill is the other half of the "everything looks the same" report.
    _has_depth = bool(
        re.search(r'linear-gradient|radial-gradient|<Decor\b|withAlpha\s*\(', code)
    )
    if not _has_depth:
        score -= 0.1
        print("[F7-DEBUG] [REFINE] -0.1: no tonal depth (gradient / scrim / Decor / withAlpha)")

    # ── Contrast (ALL scene types) ────────────────────────────────────────────
    # Nothing checked colour relationships at all, so a scene rendering its text
    # in the same colour as its own background scored identically to a correct
    # one. -0.25 lands a valid scene at 0.75 — inside the visual-check band, so
    # a screenshot confirms or denies it rather than forcing a blind re-roll.
    for _defect in _detect_contrast_defects(code):
        score -= 0.25
        print(f"[F7-DEBUG] [REFINE] -0.25: contrast — {_defect}")
        break  # one hit is enough; stacking would double-punish one mistake

    # ── Font-size sanity (ALL scene types) ────────────────────────────────────
    # Nothing here inspected a font size at all, so a scene with a 240px headline
    # and a 14px caption scored identically to a correct one — which is how the
    # observed "body tiny, headline overflowing" output kept passing. Checks
    # hardcoded numeric fontSize values against the art direction's own bands.
    _bands = _arg("_type_bands") or {}
    _sizes = [int(m) for m in re.findall(r'fontSize\s*:\s*(\d{1,3})\b', code)]
    if _sizes:
        _ceiling = max(
            _bands.get("headline_landscape", (0, _TYPE_CEILING["headline_landscape"]))[1],
            _TYPE_CEILING["headline_landscape"],
        )
        _oversize = [s for s in _sizes if s > _ceiling]
        if _oversize:
            # Decisive on its own: a headline past the ceiling breaks the frame,
            # and no amount of camera work or decoration should let that ship.
            # At -0.45 it clears the threshold from a perfect 1.0 in one hit.
            score -= 0.45
            print(
                f"[F7-DEBUG] [REFINE] -0.45: hardcoded fontSize above the {_ceiling}px ceiling "
                f"{sorted(set(_oversize))} — will overflow the frame"
            )
        # 12px, not 20px.
        #
        # 20 punished the eyebrows, kickers, captions and panel numbers that the
        # art direction ITSELF asks for at 18-22px — so nearly every scene took a
        # -0.15 for following instructions, and the repair loop was sent to fix
        # correct code. Only sizes that are genuinely illegible on a 1080p frame
        # should score here; small print is a real typographic tool.
        _tiny = [s for s in _sizes if s < 12]
        if _tiny:
            score -= 0.15
            print(
                f"[F7-DEBUG] [REFINE] -0.15: hardcoded fontSize below 12px {sorted(set(_tiny))} "
                "— illegible at 1080p"
            )

        # The 12-47px band was entirely unscored, which is exactly the "fonts are
        # very small" complaint: legible, but far below the type system the
        # blueprint authored, leaving tiny type marooned in a large empty frame.
        #
        # Proportional and capped, because 18-22px eyebrows and captions ARE
        # requested by the art direction — that is why the hard floor sits at 12.
        # Two undersized values are free (eyebrow + caption is a correct pattern);
        # a pile of them is a scene with no typographic hierarchy.
        _body_floor = (_bands.get("body_landscape") or (_TYPE_FLOOR["body_landscape"], 0))[0]
        _under = sorted({s for s in _sizes if 12 <= s < _body_floor})
        if len(_under) > 2:
            _pen = min(0.24, 0.08 * (len(_under) - 2))
            score -= _pen
            print(
                f"[F7-DEBUG] [REFINE] -{_pen:.2f}: {len(_under)} distinct fontSizes below the "
                f"{_body_floor}px body floor {_under} — only 2 (eyebrow + caption) are expected"
            )

        # No type at headline scale at all — the scene has no focal element, which
        # is the other half of the "small text in an empty frame" report.
        #
        # `_sizes` only captures the style-object form (`fontSize: 70`), so a
        # headline sized through the JSX prop form (`<FitText fontSize={70}>`) —
        # which is the form the art direction actually mandates — must be counted
        # too, or this false-positives on every correctly built scene.
        # Matches both the bare form and the prop-with-fallback form the
        # titleFontSize gate now REQUIRES:
        #     fontSize={70}
        #     fontSize={props.titleFontSize ?? 70}
        #     fontSize={props.titleFontSize ?? (isPortrait ? 52 : 70)}
        # Without the second form this reported "largest is 12px" on scenes whose
        # headline was correctly bound to the prop, costing 0.2 for compliance.
        # The LAST number in the expression is the landscape fallback.
        _prop_sizes: list[int] = []
        for _expr in re.findall(r"fontSize=\{([^{}]{1,80})\}", code):
            _nums = re.findall(r"\b(\d{1,3})\b", _expr)
            if _nums:
                _prop_sizes.append(int(_nums[-1]))
        _all_sizes = _sizes + _prop_sizes
        _head_floor = (_bands.get("headline_landscape") or (_TYPE_FLOOR["headline_landscape"], 0))[0]
        # A FitText headline with no explicit size resolves from the kit's type
        # scale at render time, so it is headline-scale by construction.
        # Headline-scale by construction, so the size check cannot apply:
        #   * <FitText> with no fontSize    — resolves from the kit type scale
        #   * fontSize={props.titleFontSize} — resolves from the user's slider
        _implicit_headline = bool(
            re.search(r"<FitText(?![^>]*fontSize)", code)
            or re.search(r"fontSize=\{props\.titleFontSize\s*\}", code)
        )
        if _all_sizes and not _implicit_headline and max(_all_sizes) < _head_floor:
            score -= 0.2
            print(
                f"[F7-DEBUG] [REFINE] -0.2: no type at headline scale (largest is "
                f"{max(_all_sizes)}px, headline floor is {_head_floor}px) — no focal element"
            )

    # NOTE: the headline/<FitText> requirement is now a HARD gate in
    # validate_component_code — a -0.15 nudge let scenes ship at 0.70-0.85 with
    # an unwrapped headline, and that is precisely the text that ends up too
    # small or overflowing. Scoring it twice would double-punish, so it is not
    # repeated here.

    # ── Uncapped list nudge (content scenes) ──────────────────────────────────
    # Mapping straight over props.metrics/steps/bullets/timelineItems with no
    # .slice(N) cap lets a long array push rows off the frame. The kit components
    # cap internally, but hand-rolled maps don't — require an explicit cap, mirroring
    # the built-ins (teasers.slice(0,5), keyPoints.slice(0,4), table rows capped).
    if scene_type == "content":
        _maps_list_prop = re.search(
            r'props\.(metrics|steps|bullets|timelineItems)\b[\s\S]{0,160}?\.map\(', code
        )
        _has_slice = bool(re.search(r'\.slice\s*\(\s*0\s*,', code))
        if _maps_list_prop and not _has_slice:
            score -= 0.1
            print(f"[F7-DEBUG] [REFINE] -0.1: list prop mapped without a .slice(0,N) cap (rows may overshoot)")

    line_count = code.count("\n") + 1
    print(f"[F7-DEBUG] [REFINE] Validation PASSED — score={score:.2f} | {line_count}L")
    return max(score, 0.0)


def _scene_reward(args, pred) -> float:
    """Validate + score a generated scene, as a single float.

    Kept for any caller that still wants the combined signature (and for tests);
    the live generation path uses _informed_retry, which validates once and calls
    _score_valid_scene directly so it can also feed the error text back.
    """
    code = clean_code(pred.code or "")

    # An EMPTY code field means the response was truncated, not that the scene was
    # bad. Return the neutral threshold so the caller stops re-rolling and the
    # repair loop — which sends a real "you were cut off, be compact" instruction
    # — gets the attempt instead.
    if not code.strip():
        print("[F7-DEBUG] [REFINE] empty code (response truncated) — deferring to repair loop")
        return REFINE_THRESHOLD

    scene_type = (
        args.get("scene_type", "content")
        if isinstance(args, dict)
        else getattr(args, "scene_type", "content")
    )
    valid, err = validate_component_code(code, scene_type=scene_type)
    if not valid:
        print(f"[F7-DEBUG] [REFINE] FAILED: {err}")
        return 0.0

    return _score_valid_scene(code, args)


# ─── Brand context builder ─────────────────────────────────────


# ── Art direction (the composition rules that used to live in the prompt) ──
#
# The GenerateSceneCode docstring used to carry a full house style: a
# MANDATORY ~6-8% safe area, a mandate to centre every content group, the
# five named compositions, a STRONGLY PREFER <IntroStage> scaffold and a
# "calm closing recap" outro. Those are DESIGN DECISIONS, and stating them in
# the system prompt applied one art director's taste to every brand.
#
# Worse, they beat the blueprint. The blueprint arrives as an input VALUE
# while the house style sat in the docstring above it, written in
# MANDATORY/STRONGLY-PREFER language with copy-pasteable numbers and code.
# Given a concrete instruction and an abstract "the blueprint overrides this",
# models follow the concrete one — so blueprints generated fine and changed
# nothing about the output.
#
# Both paths now render into the SAME field at the SAME specificity, so
# exactly one art direction reaches the model. Flag off reproduces the old
# text verbatim.
_V1_SAFE_AREA = (
    "SAFE AREA (MANDATORY — content stays inside the frame, visually balanced):\n"
    "- The whole composition MUST sit inside a CENTERED safe area with balanced margins. Give\n"
    "  the outermost content container a symmetric inset of ~6-8% of the frame on every side\n"
    "  (e.g. padding: isPortrait ? '8% 6%' : '6% 8%') so nothing hugs or spills off the edges.\n"
    "- The scene's content group should read as centered/balanced within that safe area —\n"
    "  center the flex container (justifyContent/alignItems: 'center') even when the internal\n"
    "  layout is asymmetric. Asymmetry is EXPRESSED WITHIN the centered safe area (columns\n"
    "  weighted 60/40, offset stacks, side rails), NOT by pushing content past the frame edges.\n"
    "- Full-bleed image backdrops may reach the edges, but the TEXT/focal blocks on top MUST\n"
    "  stay inside the safe-area inset. Nothing readable ever touches the outer 6% of the frame.\n"
    "- This is about placement only — it does NOT force every scene to a single dead-center\n"
    "  card; keep the layout VARIETY fully intact, just centered in-frame."
)

# The v1 type scale, moved out of the docstring alongside the safe area so the
# flag-off path keeps its exact previous behaviour. (The blueprint path gets
# _bp_type_directive instead, which states a min AND a max per role.)
_V1_TYPE_SCALE = (
    "TYPE SCALE:\n"
    "- Main title / displayText: fontSize: (props.titleFontSize ?? 75), scaled proportionally in\n"
    "  nested layouts, never below 48 for the primary headline.\n"
    "- Subtitle / narration / body: fontSize: (props.descriptionFontSize ?? 37); supporting\n"
    "  lines at least 28px.\n"
    "- Bullet lists, card body, quote body, metric labels: at least 30-36px so previews stay\n"
    "  legible when scaled down in the UI."
)

def _bp_safe_area(blueprint: dict) -> str:
    """This template's own safe-area policy, stated as concretely as v1's was."""
    st = (blueprint or {}).get("structure") or {}
    sa = (st.get("safe_area") or {}).get("landscape") or {}
    sap = (st.get("safe_area") or {}).get("portrait") or {}
    edge = st.get("edge_policy") or "inset"
    land = f"{sa.get('top', 6)}% {sa.get('right', 8)}% {sa.get('bottom', 6)}% {sa.get('left', 8)}%"
    port = f"{sap.get('top', 8)}% {sap.get('right', 6)}% {sap.get('bottom', 8)}% {sap.get('left', 6)}%"
    edge_rule = {
        "inset": (
            "EDGE POLICY 'inset': readable content stays inside the inset above. Full-bleed\n"
            "  image backdrops may still reach the edges."
        ),
        "edge_to_edge": (
            "EDGE POLICY 'edge_to_edge': this template DELIBERATELY runs elements to the frame\n"
            "  edge — rules, panels, images and even type may bleed past the inset. Do NOT\n"
            "  centre everything into a safe box; that would erase this template's character.\n"
            "  Keep only small print clear of the outer 2%."
        ),
        "mixed": (
            "EDGE POLICY 'mixed': anchor the scene on the inset above, but let ONE deliberate\n"
            "  element per scene (a rule, a panel edge, an image) bleed off-frame for tension."
        ),
    }.get(edge, "")
    return (
        "SAFE AREA — THIS TEMPLATE'S OWN POLICY (authored for this brand; not a generic inset):\n"
        f"- Outermost content container inset: landscape {land}, portrait {port}.\n"
        f"  Apply it literally: padding: isPortrait ? '{port}' : '{land}'.\n"
        f"- {edge_rule}\n"
        "- Do NOT substitute a symmetric 6-8% inset or force the content group to dead centre\n"
        "  unless the geometry below actually asks for centring."
    )

# Hard type ceilings, in px. Nothing in the system had an upper bound before, and
# that is the whole reason headlines overflowed: the directive gave a body FLOOR
# plus an open-ended scale_ratio, so "headline = body x ratio^n" resolved upward
# with nothing to stop it (72px body x 1.7^3 = 353px is reachable from values the
# blueprint validator happily accepts).
#
# Portrait ceilings are much lower than landscape because the canvas is 1080 wide
# rather than 1920 — the kit's own theme actually made portrait titles LARGER
# than landscape, which is backwards for the narrower frame.
_TYPE_CEILING = {
    "headline_landscape": 88,
    "headline_portrait": 60,
    "body_landscape": 44,
    "body_portrait": 38,
}
_TYPE_FLOOR = {
    "headline_landscape": 48,
    "headline_portrait": 36,
    "body_landscape": 28,
    "body_portrait": 26,
}


def _hex_luminance(hex_str: str) -> float | None:
    """Perceived luminance 0..1, mirroring kit/theme.ts's `luminance`.

    Returns None for anything that is not a plain 3/6-digit hex, so callers skip
    computed values rather than guessing at them.
    """
    h = (hex_str or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None
    # Rec. 601, same coefficients as the TS helper.
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0


# One style object's worth of source, e.g. `{background: '#111', color: '#111'}`.
_STYLE_OBJ_RE = re.compile(r"\{[^{}]{0,400}\}")
_BG_LITERAL_RE = re.compile(r"background(?:Color)?\s*:\s*['\"](#[0-9a-fA-F]{3,8})['\"]")
_FG_LITERAL_RE = re.compile(r"\bcolor\s*:\s*['\"](#[0-9a-fA-F]{3,8})['\"]")


def _detect_contrast_defects(code: str) -> list[str]:
    """Find text that is invisible against its own background.

    DELIBERATELY CONSERVATIVE — regex only, unambiguous patterns only. A false
    positive costs a full LLM rollout, so computed values, withAlpha(...),
    gradients and CSS variables are all skipped rather than guessed at. This
    catches the failure the prompt itself used to cause: an inverted panel whose
    background is palette.text, with type still coloured palette.text.
    """
    hits: list[str] = []

    # The palette.text-on-palette.text case, which the old BACKDROP fragment
    # actively encouraged by supplying a background and no foreground.
    if re.search(r"background(?:Color)?\s*:\s*palette\.text\b", code) and re.search(
        r"\bcolor\s*:\s*palette\.text\b", code
    ):
        hits.append(
            "palette.text is used as BOTH a background and a text colour — that text is "
            "invisible. Derive the foreground: const fg = readableOn(palette.text)."
        )

    # Literal hex collisions, scoped to a single style object so unrelated
    # declarations elsewhere in the file are never paired up.
    for obj in _STYLE_OBJ_RE.findall(code):
        bg = _BG_LITERAL_RE.search(obj)
        fg = _FG_LITERAL_RE.search(obj)
        if not bg or not fg:
            continue
        bg_hex, fg_hex = bg.group(1), fg.group(1)
        if bg_hex.lower() == fg_hex.lower():
            hits.append(f"text and background are the same colour ({bg_hex}) in one style object")
            continue
        lb, lf = _hex_luminance(bg_hex), _hex_luminance(fg_hex)
        if lb is not None and lf is not None and abs(lb - lf) < 0.25:
            hits.append(
                f"text {fg_hex} on background {bg_hex} is too low-contrast to read "
                f"(luminance delta {abs(lb - lf):.2f}); use readableOn({bg_hex})"
            )
    return hits


def _type_bands(blueprint: dict) -> dict[str, tuple[int, int]]:
    """Concrete min/max px per role and orientation for this template.

    Derived from the blueprint so a brand's type character still varies, but
    clamped so it can never exceed what the frame can hold.
    """
    ts = (blueprint or {}).get("type_system") or {}
    ratio = float(ts.get("scale_ratio", 1.25) or 1.25)

    def _band(key: str, target: float) -> tuple[int, int]:
        """Clamp a target size into [floor, ceiling] and widen it into a band.

        Order matters: clamp the TARGET into the legal range first, then derive
        the band around it. Deriving the low end before clamping produced
        inverted bands (min above max) whenever the target fell below the floor.
        """
        floor, ceil = _TYPE_FLOOR[key], _TYPE_CEILING[key]
        hi = int(max(floor, min(target, ceil)))
        lo = int(max(floor, min(hi - 4, round(hi * 0.8))))
        return min(lo, hi), hi

    body_l = float(ts.get("base_body_px_landscape", 36) or 36)
    body_p = float(ts.get("base_body_px_portrait", 34) or 34)
    # Headline steps are chosen so a default template (36px body, ratio 1.25)
    # lands near 70px landscape — close to the 75px the house style used and the
    # size the built-in templates ship — rather than collapsing to the floor.
    return {
        "headline_landscape": _band("headline_landscape", body_l * (ratio ** 3)),
        "headline_portrait": _band("headline_portrait", body_p * (ratio ** 2)),
        "body_landscape": _band("body_landscape", body_l),
        "body_portrait": _band("body_portrait", body_p),
    }


# How each era actually LOOKS, as buildable instructions.
#
# The era was reaching the blueprint and picking a typeface, but never reaching
# the scene prompt — so a "vintage" template rendered as a modern one in an old
# typeface. Era only becomes visible when it drives surface, decor, motion and
# camera together, which is what these entries do.
_ERA_DIRECTION: dict[str, dict[str, str]] = {
    "vintage": {
        "look": (
            "Letterpress print, 1900s-1950s. Paper-toned grounds, heavy rules, ornamental "
            "borders, engraved/etched imagery, ink texture. Colour is restrained and slightly "
            "aged — never pure #fff or pure #000."
        ),
        "gradient": (
            "Paper wash: a soft off-white/sepia radial that is warmer at the centre and darker "
            "at the corners, plus a subtle vignette. Never a modern blue-to-purple ramp."
        ),
        "camera": (
            "Almost still — a very slow push (intensity 0.25) as though on a copy stand. "
            "No tilting; the page stays flat to the lens."
        ),
        "motion": "Deliberate and typeset: elements settle rather than fly. Long, calm holds.",
    },
    "editorial": {
        "look": (
            "Broadsheet / magazine. Strong hairline rules, column structure, generous margins, "
            "drop caps, small-caps kickers. Black on off-white with ONE accent."
        ),
        "gradient": (
            "Barely-there paper tone plus a scrim under any image so the deck stays readable. "
            "Depth comes from rules and whitespace, not colour ramps."
        ),
        "camera": "Slow push (0.35) with a settling tilt, like a page being laid down.",
        "motion": "Staggered column reveals; rules draw in before the type they underline.",
    },
    "modern": {
        "look": (
            "Contemporary product marketing. Soft rounded surfaces, generous negative space, "
            "clean geometric sans, subtle shadows and glass."
        ),
        "gradient": (
            "Confident duotone wash between two brand hues, plus a radial accent bloom behind "
            "the focal element. This is the era where gradients belong."
        ),
        "camera": "Smooth push (0.5) with parallax: backdrop drifts opposite the foreground.",
        "motion": "Springy but controlled — scale + fade entrances, continuous ambient drift.",
    },
    "technical": {
        "look": (
            "Engineering / data. Visible grid, monospace labels, tick marks, hairline borders, "
            "measurement annotations. Dense and precise, near-black grounds."
        ),
        "gradient": (
            "Scanline or grid-mesh overlay rather than a colour ramp; a cold radial glow behind "
            "data. Think instrument panel, not sunset."
        ),
        "camera": "Precise push (0.4) with slight parallax on the grid layer.",
        "motion": "Snappy, mechanical: values count up, rules extend, elements snap to grid.",
    },
    "expressive": {
        "look": (
            "Poster / streetwear. Oversized type that bleeds off-frame, hard-edged colour "
            "blocks, high contrast, collage overlaps, rotated elements."
        ),
        "gradient": (
            "Bold saturated duotone at a steep angle, or a hard two-tone split. Loud is correct "
            "here."
        ),
        "camera": "Assertive push (0.7) with real tilt and layered parallax.",
        "motion": "Punchy: slams, whip entrances, overshoot. The loudest era.",
    },
}


def _bp_era_directive(blueprint: dict) -> str:
    """The era as buildable art direction: look, gradient, camera and motion.

    Without this the era only ever changed the typeface, so a vintage template
    was a modern template in an old face — which is why templates still read as
    near-identical after the font work.
    """
    ident = (blueprint or {}).get("identity") or {}
    era = ident.get("era")
    spec = _ERA_DIRECTION.get(era)
    if not spec:
        return ""
    energy = ident.get("motion_energy") or "smooth"
    decor = ident.get("decor_system") or "rules"
    surface = ident.get("surface_default") or "panel"
    return (
        f"ERA — '{era}'. This is the template's visual period and it governs every scene.\n"
        f"- Look: {spec['look']}\n"
        f"- Depth / gradient: {spec['gradient']}\n"
        f"- Camera: {spec['camera']} Use the kit helpers — wrap the composition in\n"
        f"  <AbsoluteFill style={{{{...cameraStage(1600)}}}}> and spread\n"
        f"  cameraPush(frame, durationInFrames, <intensity above>) on the group. Give the\n"
        f"  backdrop style={{{{...parallaxLayer(frame, durationInFrames, -1, 0.4)}}}} so it\n"
        f"  drifts the OTHER way. Panels enter with style={{{{...panelTilt(frame, delay)}}}}.\n"
        f"  ALL FOUR return style OBJECTS — they must be SPREAD into a style prop with `...`.\n"
        f"  `style={{{{ parallaxLayer(...) }}}}` without the spread is a syntax error.\n"
        f"- Motion: {spec['motion']} (motion energy: {energy})\n"
        f"- Surfaces use cardStyle(palette, '{surface}'); the atmosphere is "
        f"<Decor system=\"{decor}\" />, which is frame-animated and runs the whole scene.\n"
        f"A viewer must be able to name this era from a single frame. If the scene would look "
        f"equally at home in another era, it is not finished."
    )


def _bp_type_directive(blueprint: dict) -> str:
    """The blueprint's type system, as concrete CSS-ready values.

    Emits a min AND a max for every role. The previous version emitted only a
    floor ("36px landscape — never smaller") plus a modular ratio, which the
    model resolved in the worst possible way in both directions: body copy sat
    exactly ON the floor (a floor stated as the template's own type law reads as
    the target), while headlines grew by an unbounded ratio until they overflowed
    their container.
    """
    ts = (blueprint or {}).get("type_system") or {}
    if not ts:
        return ""
    case_rule = {
        "upper": "textTransform: 'uppercase'",
        "title": "Title Case (capitalise each significant word)",
        "sentence": "sentence case",
    }.get(ts.get("heading_case", "sentence"), "sentence case")
    label_rule = (
        "textTransform: 'uppercase'"
        if ts.get("label_case") == "upper"
        else "fontVariant: 'small-caps'"
    )
    b = _type_bands(blueprint)
    hl, hh = b["headline_landscape"]
    pl, ph = b["headline_portrait"]
    bl, bh = b["body_landscape"]
    bpl, bph = b["body_portrait"]
    return (
        "TYPE SYSTEM (this template's own — these are the ACTUAL sizes to use, not minimums):\n"
        f"- Headline / displayText: MANDATORY <FitText> (the validator rejects a bare\n"
        f"  fontSize on the headline). Target {hl}-{hh}px landscape, {pl}-{ph}px portrait:\n"
        f"    <FitText fontSize={{props.titleFontSize ?? {hh}}} minFontSize={{{hl}}} maxLines={{3}}\n"
        f"             containerWidth={{<px width of the column it sits in>}}\n"
        f"             maxHeight={{<px height available for it>}}>{{props.displayText}}</FitText>\n"
        "  FitText solves for the size that FILLS its box and clamps to a legible range, so it\n"
        "  fixes BOTH failure modes: a short title grows instead of sitting tiny, a long one\n"
        "  shrinks instead of overflowing. PASS containerWidth whenever the headline is in a\n"
        "  column or card rather than spanning the frame — without it FitText measures against\n"
        "  the whole canvas and sizes the text roughly twice too large for a narrow column.\n"
        "  Use it for big numerals and any other text whose length you do not control.\n"
        f"- Body / narration copy: {bl}-{bh}px landscape, {bpl}-{bph}px portrait.\n"
        f"- Eyebrows / labels: {max(18, bl - 12)}-{max(22, bl - 8)}px, {label_rule}, "
        f"letterSpacing: '{ts.get('label_tracking_em', 0.12)}em'.\n"
        f"- Headings: {case_rule}, letterSpacing: '{ts.get('heading_tracking_em', -0.01)}em'.\n"
        f"- Big numerals: at most {int(bh * 2.5)}px, and always inside <FitText>.\n"
        f"- Numerals: {ts.get('numeral_style', 'tabular')}.\n"
        f"NEVER exceed the top of a range. A headline above {hh}px landscape / {ph}px portrait "
        "does not fit the frame and will break mid-word or spill off the canvas. Portrait is "
        "1080px wide — always smaller than landscape, never larger."
    )


def build_art_direction(
    blueprint: dict | None,
    role: str,
    index: int = 0,
    composition: str = "",
) -> str:
    """The complete art-direction brief for one scene.

    Flag OFF -> the exact v1 house style, so output is unchanged.
    Flag ON  -> the blueprint's decisions, at the same specificity.
    """
    if not blueprint:
        parts = [_V1_SAFE_AREA, _V1_TYPE_SCALE]
        if role == "content":
            # regenerate_single_scene has no composition rotation to draw from
            # (it edits one existing scene, not a fresh batch), so it passes none
            # and the scene keeps whatever geometry it already has.
            _comp_line = (
                f"Build THIS scene as a '{composition}' composition."
                if composition
                else "Keep this scene's existing composition."
            )
            parts.append(
                "PER-SCENE COMPOSITION (MAKE EACH SCENE LOOK DIFFERENT):\n"
                f"{_comp_line} Repeated centered cards\n"
                "are the #1 reason custom videos feel repetitive, so consecutive scenes must\n"
                "NOT share a layout. These are GEOMETRY DIRECTIVES you author yourself with\n"
                "plain flex/absolute divs (NOT components to wrap); flip the focal side vs the\n"
                "previous scene; honor the four hasImage×isPortrait cases:\n"
                "  • 'centered focal'    → one dominant focal block dead-centre, generous space.\n"
                "  • 'asymmetric split'  → ~60/40 two columns: focal copy one side, support other.\n"
                "  • 'full-bleed hero'   → <KenBurnsImage> edge-to-edge; text overlaid low + scrim.\n"
                "  • 'offset card stack' → rows weighted one side; eyebrow + vertical rule opposite.\n"
                "  • 'side rail'         → thin vertical accent rail + vertical eyebrow, content beside."
            )
        elif role == "intro":
            parts.append(
                "INTRO: the brand-reveal opener. STRONGLY PREFER the <IntroStage> scaffold — it\n"
                "choreographs the whole opening (logo settle + accent rule draw + staggered title\n"
                "reveal + signature decor):\n"
                "  <IntroStage title={props.displayText}\n"
                "              logo={props.logoUrl && <Img src={props.logoUrl} style={{height: 96}} />}\n"
                "              subtitle={...optional takeaway...}\n"
                "              decor=\"<this brand's signature decor>\"\n"
                "              titleReveal=\"blur for energetic brands, word/line for calm\" />\n"
                "When hasImage you MAY wrap IntroStage over a <KenBurnsImage scrim=\"bottom\"/> hero\n"
                "backdrop. (You may hand-roll instead, but it must hit the same bar: a real logo\n"
                "reveal, a bold title reveal, exactly ONE signature entrance beat.) Calm and\n"
                "confident: one focal headline, generous negative space. Give the SIGNATURE\n"
                "ARTIFACT its most PROMINENT take here — <SignatureArtifact intensity={0.7} />."
            )
        else:
            parts.append(
                "OUTRO: a calm closing recap — restate the brand (props.displayText) plus one\n"
                "short takeaway with a clean title reveal and a gentle exit. Echo the brand's\n"
                "SIGNATURE ARTIFACT as a quiet closing callback so the video bookends on its motif."
            )
        return "\n\n".join(parts)

    # Era FIRST — it is the template's identity, and everything below is an
    # expression of it. Placed ahead of the safe area and type system so the model
    # reads the period before the mechanics.
    parts = []
    _era = _bp_era_directive(blueprint)
    if _era:
        parts.append(_era)
    parts.append(_bp_safe_area(blueprint))
    _type = _bp_type_directive(blueprint)
    if _type:
        parts.append(_type)

    lay = None
    from app.dspy_modules.blueprint import layout_for_scene

    lay = layout_for_scene(blueprint, role, index)
    if lay:
        geom = [
            "SCENE GEOMETRY — build exactly this (authored for this brand, not a generic recipe):",
            f"- Landscape: {lay.get('geometry')}",
        ]
        if lay.get("geometry_portrait"):
            geom.append(f"- Portrait (1080x1920): {lay['geometry_portrait']}")
        else:
            geom.append(
                "- Portrait: re-compose the above for a tall frame (stack, fewer items, larger\n"
                "  type). Do NOT reuse the landscape JSX unchanged."
            )
        if lay.get("motion_beat"):
            geom.append(f"- Motion beat: {lay['motion_beat']}")
        geom.append(
            f"- Surface treatment: '{lay.get('surface')}' "
            f"(cardStyle(palette, '{lay.get('surface')}') where a panel is called for)."
        )
        if lay.get("supports_image"):
            geom.append(
                f"- Image treatment: '{lay.get('image_treatment')}' — honour it in the\n"
                "  hasImage branch."
            )
        else:
            geom.append("- This layout takes NO content image; compose it as a text/number scene.")
        geom.append(
            f"- Signature artifact: <SignatureArtifact motion=\"{lay.get('artifact')}\" "
            f"intensity={{{lay.get('artifact_intensity', 0.45)}}} /> — placed to suit THIS\n"
            "  geometry, not dropped in the same corner as neighbouring scenes."
        )
        geom.append(
            "Do not replace this geometry with a centred card, a 60/40 split or any other\n"
            "stock composition. If it feels unusual, that is the brand, and it is intended."
        )
        parts.append("\n".join(geom))

    if role in ("intro", "outro"):
        be = (blueprint.get("bookends") or {}).get(role) or {}
        if role == "intro":
            parts.append(
                "OPENING (this brand's own, NOT a generic brand reveal):\n"
                f"- opening_move: '{be.get('opening_move')}'\n"
                f"- logo_treatment: '{be.get('logo_treatment')}'\n"
                f"- title_reveal: <RevealText mode=\"{be.get('title_reveal')}\" />\n"
                f"- energy: '{be.get('energy')}'\n"
                "Build THIS opening. Do NOT default to a centred logo-above-title reveal, and do\n"
                "NOT reach for the <IntroStage> scaffold unless the opening_move above genuinely\n"
                "describes what it does — it choreographs one specific opening, and using it for\n"
                "every brand is exactly why templates looked identical."
            )
        else:
            parts.append(
                "CLOSING (this brand's own):\n"
                f"- closing_move: '{be.get('closing_move')}'\n"
                f"- energy: '{be.get('energy')}'\n"
                f"- echoes_intro: {be.get('echoes_intro')}\n"
                "Design it on its OWN terms. It need NOT be quieter or calmer than the intro —\n"
                "an emphatic close is valid if the energy above says so."
            )
    return "\n\n".join(parts)


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

    # The gradient rule governs the BASE CANVAS only.
    #
    # It used to read "use SOLID backgrounds only, NO gradients", which the model
    # correctly applied to everything — so scenes for the (many) brands without a
    # bg2 had no tonal depth anywhere: no scrims over images, no vignettes, no
    # washes behind a panel. That flatness is a large part of why templates looked
    # alike. What the brand evidence actually constrains is the page background,
    # not every decorative surface in a video.
    use_gradient = colors.get("bg2") is not None
    if use_gradient:
        ctx += (
            f"Background: gradient from {colors.get('bg')} to {colors.get('bg2')} — the base "
            "canvas may be a gradient, and decorative surfaces may be too\n"
        )
    else:
        ctx += (
            f"Background: solid {colors.get('bg')} — the BASE CANVAS is a solid fill (this brand's "
            "own site is solid, so a gradient page background would misrepresent it). This governs "
            "the canvas ONLY: image scrims, vignettes, radial accent washes behind a panel, and "
            "tonal depth on a decorative surface are all still encouraged — they are lighting, not "
            "a brand background.\n"
        )

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
    def _default_brand_scene_types() -> list[dict]:
        """A valid, varied scene set for when the model cannot produce one.

        Deliberately spans the content-type taxonomy so downstream archetype
        matching still has somewhere to route each kind of scene. When the
        blueprint stage is enabled it supersedes these layouts entirely, so the
        cost of falling back here is small — far smaller than failing generation.
        """
        return [
            {"id": "brand_intro", "scene_type": "intro", "best_for": [],
             "description": "Opening brand reveal"},
            {"id": "key_points", "scene_type": "content", "best_for": ["bullets"],
             "description": "Key points as a staggered list"},
            {"id": "headline_stat", "scene_type": "content", "best_for": ["metrics"],
             "description": "A headline figure with supporting stats"},
            {"id": "pull_quote", "scene_type": "content", "best_for": ["quote"],
             "description": "A pulled quote with attribution"},
            {"id": "process_steps", "scene_type": "content", "best_for": ["steps"],
             "description": "An ordered sequence of steps"},
            {"id": "side_by_side", "scene_type": "content", "best_for": ["comparison"],
             "description": "Two options compared side by side"},
            {"id": "narrative_beat", "scene_type": "content", "best_for": ["plain"],
             "description": "A narrative passage with a supporting visual"},
            {"id": "closing_outro", "scene_type": "outro", "best_for": [],
             "description": "Closing brand recap"},
        ]

    # dspy.Predict, NOT ChainOfThought.
    #
    # ChainOfThought prepends an unbounded `reasoning` field that is emitted
    # BEFORE scene_types_json. GLM filled it and ran out of budget mid-array, so
    # the response was a bare unterminated "[" — "unterminated JSON array: char 0"
    # — on every attempt. Template 143 (SpaceX) failed generation outright this
    # way, twice, after 13-24s per attempt spent writing prose instead of JSON.
    #
    # The planning is not lost: the signature declares a `plan_note` output capped
    # at two lines, so the model still commits to a shape before emitting it but
    # cannot spend the response deliberating. Same fix as the blueprint stage.
    module = dspy.Predict(DecideBrandSceneTypes)
    codegen_lm = get_scene_type_lm()

    last_error = None
    # Set when an attempt ran out of budget mid-array, so the retry can ask for a
    # shorter answer instead of re-rolling into the same truncation.
    _truncated = False
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
                # A truncated first attempt means the model wrote prose until the
                # budget ran out. Re-rolling identically truncates again (observed:
                # both attempts, on two consecutive generations), so the retry asks
                # for a shorter answer rather than a different one.
                _brief = user_brief or ""
                if attempt and _truncated:
                    _brief = (
                        f"{_brief}\n\n[Your previous attempt was CUT OFF before the JSON array "
                        "was complete. Be COMPACT: skip the plan note, emit SIX content scenes "
                        "rather than eight, and keep each description to one short sentence. A "
                        "complete six-scene array is worth far more than a truncated eight-scene "
                        "one, which is discarded entirely.]"
                    ).strip()
                with dspy.context(lm=codegen_lm):
                    result = module(brand_context=brand_context, user_brief=_brief)
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
            # An empty or unterminated array means the response was CUT OFF, not
            # that the model wrote something malformed. Naming the real cause
            # makes the log diagnosable and lets the retry adapt.
            _raw = (getattr(result, "scene_types_json", "") or "") if "result" in locals() else ""
            _truncated = isinstance(e, json.JSONDecodeError) and (
                not _raw.strip() or "unterminated" in str(e).lower()
            )
            print(
                f"[F7-DEBUG] [SCENE-TYPES] Attempt {attempt + 1} failed in {elapsed:.1f}s: {e}"
                + (" — response TRUNCATED (out of output budget)" if _truncated else "")
            )
            if attempt == 0:
                print("[F7-DEBUG] [SCENE-TYPES] Retrying...")

    # Fall back rather than failing the whole template.
    #
    # This stage only decides the SHAPE of the scene set; the blueprint supersedes
    # its layouts anyway when enabled. Raising here killed generation outright for
    # template 143 — a much worse outcome than a generic-but-valid scene set.
    print(
        f"[F7-DEBUG] [SCENE-TYPES] FALLBACK — both attempts failed ({last_error}); "
        "using the default scene set"
    )
    return _default_brand_scene_types()


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


# ─── Per-scene generation with informed retries ─────────────────


class _SalvagedPrediction:
    """A stand-in for a dspy.Prediction recovered from a parse failure.

    Carries the scene code plus default image-box fractions, so downstream code
    that reads `result.code` / `getattr(result, "image_box_*", None)` works
    unchanged.
    """

    def __init__(self, code: str) -> None:
        self.code = code
        self.image_box_width_fraction_landscape = 1.0
        self.image_box_height_fraction_landscape = 1.0
        self.image_box_width_fraction_portrait = 1.0
        self.image_box_height_fraction_portrait = 1.0


def _salvage_scene_from_parse_error(err: Exception) -> _SalvagedPrediction | None:
    """Pull scene code out of a DSPy AdapterParseError, if it is in there.

    DSPy embeds the raw LM response in the exception message. When the only
    problem is missing trailing fields, the `code` value is intact and can be
    recovered — far better than failing the whole template for metadata that
    nothing renders.

    Returns None when there is no usable code, so the caller re-raises.
    """
    text = str(err or "")
    if "code" not in text:
        return None
    # The response is JSON-ish; find the "code" member and decode just that
    # string, tolerating the truncation that broke the whole-object parse.
    m = re.search(r'"code"\s*:\s*"', text)
    if not m:
        return None
    start = m.end()
    buf: list[str] = []
    i = start
    while i < len(text):
        ch = text[i]
        if ch == "\\" and i + 1 < len(text):
            buf.append(text[i : i + 2])
            i += 2
            continue
        if ch == '"':
            break
        buf.append(ch)
        i += 1
    try:
        code = json.loads(f'"{"".join(buf)}"')
    except (json.JSONDecodeError, ValueError):
        return None
    if len(code.strip()) < 200 or "SceneComponent" not in code:
        return None
    return _SalvagedPrediction(code)


def _informed_retry(
    base_module,
    base_kwargs: dict,
    previous_failure: str,
    scene_type: str,
    type_bands: dict | None = None,
):
    """Run the scene module up to REFINE_N+1 times, feeding the REAL error back.

    Replaces dspy.Refine, which could not be told what actually went wrong.
    Refine calls reward_fn (which returns a bare float, discarding the validator
    message) and then, to produce a retry hint, spends an ENTIRE EXTRA LLM CALL on
    its OfferFeedback signature — handing it the program source and trajectory so
    it can *infer* the failure. Meanwhile `previous_failure` stayed empty for every
    rollout, so the two attempts where most failures happen never saw the
    diagnostic that the outer repair loop already builds perfectly well.

    That was the dominant cost in the 187s-per-scene tail: 2 rollouts + 1 meta-call
    to guess at an error we were holding the whole time.

    Here each retry receives `_format_scene_failure(...)` — the real error, the
    annotated source window, and the full contract checklist — exactly like a
    repair. Same rollout budget, no meta-call, and the model is told rather than
    guessed at.

    Returns the best prediction by score, matching Refine's contract of never
    raising and always handing back its best attempt.
    """
    best = None
    best_score = -1.0
    failure = previous_failure

    for attempt in range(REFINE_N + 1):
        try:
            result = base_module(previous_failure=failure, **base_kwargs)
        except Exception as e:  # noqa: BLE001
            # A parse failure must not discard a usable scene.
            #
            # The four image_box_* fields are emitted AFTER `code`, so a response
            # truncated anywhere past the code block loses them — and DSPy's
            # JSONAdapter compares parsed keys to the signature with strict
            # equality, ignoring field defaults, so it raises rather than filling
            # them in. Template 139 failed generation outright this way with a
            # complete, valid scene sitting in the response.
            #
            # Those fractions are cropper metadata (see the aspect-ratio note
            # below); nothing about the render depends on them, so recovering the
            # code and defaulting them is strictly better than losing the scene.
            salvaged = _salvage_scene_from_parse_error(e)
            if salvaged is None:
                raise
            print(
                "[F7-DEBUG] [REFINE] recovered code from a parse failure "
                "(image-box fractions defaulted)"
            )
            result = salvaged
        code = clean_code(result.code or "")

        # Truncation: retrying makes it worse (temperature and verbosity both
        # push the same way), so hand straight to the repair loop, which sends
        # an explicit "you were cut off, be compact" instruction.
        if not code.strip():
            print("[F7-DEBUG] [REFINE] empty code (response truncated) — deferring to repair loop")
            return best if best is not None else result

        valid, err = validate_component_code(code, scene_type=scene_type, collect_all=True)
        if not valid:
            score = 0.0
            print(f"[F7-DEBUG] [REFINE] attempt {attempt + 1} FAILED: {err}")
        else:
            score = _score_valid_scene(
                code, {**base_kwargs, "_type_bands": type_bands or {}}
            )

        if score > best_score:
            best, best_score = result, score

        # ── Visual verification ───────────────────────────────────────────────
        # Static analysis cannot see invisible text, a clipped headline or an
        # empty frame. Render the scene and let a vision model look at it — but
        # only for scenes in the suspect band, because a browser + vision call is
        # the most expensive check in the pipeline:
        #   * score 1.00 -> skip; nothing suggests a defect
        #   * score < REFINE_THRESHOLD -> skip; a concrete textual failure is
        #     already queued and a screenshot would only confirm it
        #   * last attempt -> skip; no rollout left to consume the critique
        if (
            valid
            and attempt < REFINE_N
            and REFINE_THRESHOLD <= score < VISUAL_CHECK_THRESHOLD
        ):
            _critique = visual_check_scene(
                code,
                scene_type=scene_type,
                scene_index=int(base_kwargs.get("scene_index") or 0),
                total_scenes=int(base_kwargs.get("total_scenes") or 1),
                art_hints=str(base_kwargs.get("art_direction") or "")[:1200],
            )
            if _critique:
                failure = _format_visual_failure(_critique)
                continue
            # Passing the eye beats the heuristics: accept even a 0.78 scene.

        if score >= REFINE_THRESHOLD:
            return result
        if attempt == REFINE_N:
            break

        # Feed the real diagnostic into the next attempt.
        failure = _format_scene_failure(code, err) if not valid else (
            f"ERROR: your previous attempt scored {score:.2f}, below the {REFINE_THRESHOLD} bar. "
            "It was VALID but had quality problems — see the checklist below and fix them "
            "while keeping everything that already works.\n\n" + REPAIR_CHECKLIST
        )

    print(f"[F7-DEBUG] [REFINE] returning best of {REFINE_N + 1} attempts (score={best_score:.2f})")
    return best


def _generate_single_scene_sync(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    scene_purpose: str,
    previous_failure: str = "",
    use_refine: bool = True,
    blueprint: str = "",
    layout_spec: str = "",
    art_direction: str = "",
    current_code: str = "",
    edit_instruction: str = "",
) -> tuple[str, dict[str, str], list[dict]]:
    """Generate a single scene using DSPy ChainOfThought (+ Refine) (sync).
    Returns (code, {"landscape": "W / H", "portrait": "W / H"}).

    use_refine=False (§R Layer 2) runs the base module ONCE instead of wrapping
    it in dspy.Refine. Repair attempts pass False: Refine costs up to REFINE_N+1
    rollouts and, because it returns its best-scoring attempt even when every
    attempt scored 0.0 (it never raises), a "retry" could burn 3 calls and still
    hand back invalid code. One informed call per repair attempt makes the
    worst-case cost per scene predictable instead of opaque.
    """
    ensure_dspy_configured()

    base_module = dspy.ChainOfThought(
        GenerateSceneCode,
        rationale_field=dspy.OutputField(
            prefix="Plan:",
            desc="3 bullet points: (1) layout approach, (2) animation strategy, (3) content rendering",
        ),
    )

    t0 = time.time()

    # This template's type bands, for the font-size penalty in _score_valid_scene.
    # Not a signature field — it never reaches the model, only the scorer.
    _bands: dict = {}
    if blueprint:
        try:
            _bands = _type_bands(json.loads(blueprint))
        except (ValueError, TypeError):
            _bands = {}

    _base_kwargs = dict(
        brand_context=brand_context,
        design_system=design_system,
        blueprint=blueprint,
        layout_spec=layout_spec,
        art_direction=art_direction,
        scene_type=scene_type,
        scene_index=scene_index,
        total_scenes=total_scenes,
        scene_purpose=scene_purpose,
        current_code=current_code,
        edit_instruction=edit_instruction,
    )

    codegen_lm = get_custom_lm()
    with dspy.context(lm=codegen_lm):
        if use_refine:
            result = _informed_retry(
                base_module, _base_kwargs, previous_failure, scene_type, type_bands=_bands
            )
        else:
            result = base_module(previous_failure=previous_failure, **_base_kwargs)

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
    # Separate cheap pass — see DescribeSceneProps for why this is not another
    # output field on GenerateSceneCode.
    prop_schema = _describe_scene_props(code)
    if prop_schema:
        print(
            f"[F7-DEBUG] [PROP-SCHEMA] scene {scene_index} declares "
            f"{[f['key'] for f in prop_schema]}"
        )

    return code, aspect_ratios, prop_schema


_SCENE_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="scene-gen")


async def _generate_single_scene(
    brand_context: str,
    design_system: str,
    scene_type: str,
    scene_index: int,
    total_scenes: int,
    scene_purpose: str,
    previous_failure: str = "",
    use_refine: bool = True,
    blueprint: str = "",
    layout_spec: str = "",
    art_direction: str = "",
    current_code: str = "",
    edit_instruction: str = "",
) -> tuple[str, dict[str, str], list[dict]]:
    """Async wrapper — runs the sync generation call in a dedicated thread pool.
    Returns (code, {"landscape": "W / H", "portrait": "W / H"}).

    Uses functools.partial rather than run_in_executor's positional *args so
    adding a parameter can never silently shift argument order.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _SCENE_EXECUTOR,
        partial(
            _generate_single_scene_sync,
            brand_context=brand_context,
            design_system=design_system,
            blueprint=blueprint,
            layout_spec=layout_spec,
            art_direction=art_direction,
            scene_type=scene_type,
            scene_index=scene_index,
            total_scenes=total_scenes,
            scene_purpose=scene_purpose,
            previous_failure=previous_failure,
            use_refine=use_refine,
            current_code=current_code,
            edit_instruction=edit_instruction,
        ),
    )


# ─── Failure diagnostics (§R Layer 1) ───────────────────────────


def _format_scene_failure(code: str, error: str) -> str:
    """Format a validation failure into a diagnostic the MODEL can act on.

    The retry loop used to send a hardcoded "the previous attempt had a syntax
    error, double-check every React.createElement(...) call" hint. That claim is
    wrong for ~14 of the ~15 failures validate_component_code() can return
    (missing logoUrl conditional, non-monotonic interpolate, string in
    outputRange, TDZ destructure, dangerous API, unbalanced parens, ...), so on
    a non-syntax failure the model was actively MISDIRECTED toward the wrong fix
    while the real error sat unused in `err`.

    This returns the real error plus, when the error carries an esbuild
    "<stdin>:LINE:COL" position, an annotated source window so the model can see
    the offending token in context.
    """
    error = (error or "").strip() or "(no error message)"
    parts = [f"ERROR: {error}"]

    m = re.search(r"<stdin>:(\d+):(\d+)", error)
    if m and code:
        line_no = int(m.group(1))
        lines = code.split("\n")
        lo, hi = max(0, line_no - 4), min(len(lines), line_no + 3)
        snippet = "\n".join(
            f"{'>>> ' if j + 1 == line_no else '    '}{j + 1:4d} | {lines[j]}"
            for j in range(lo, hi)
        )
        parts.append(f"SOURCE (>>> marks the reported line):\n{snippet}")

        # esbuild reports where parsing BROKE, which for JSX is often one line
        # PAST the actual mistake. The dominant case: an opening tag whose
        # attribute list is never closed with `>`, so the next child expression
        # is misread as another attribute:
        #
        #     <div style={{ color: 'red' }}      <- missing '>'
        #       {props.displayText}              <- reported here
        #
        # Point at the real line, otherwise the model "fixes" the wrong one.
        if 'Expected "..." but found' in error and line_no >= 2:
            preceding = "\n".join(lines[max(0, line_no - 6) : line_no - 1])
            if "}}" in preceding and not re.search(r"}}\s*>\s*$", preceding.rstrip()):
                parts.append(
                    "LIKELY CAUSE: the JSX tag opened ABOVE line "
                    f"{line_no} was never closed with '>'. Its attribute list ends with "
                    "'}}' and the next line starts a child expression, so the parser is "
                    "still reading attributes. Add the missing '>' at the end of the "
                    "opening tag — do NOT change the child expression itself."
                )
    elif code:
        # No position info (e.g. "Code is empty", a regex-based structural
        # failure). Show the head of the output, truncated so the prompt — and
        # the logs — stay a sane size.
        preview = code[:1000] + ("..." if len(code) > 1000 else "")
        parts.append(f"YOUR PREVIOUS OUTPUT ({len(code)} chars):\n{preview}")
    else:
        # An empty `code` field almost always means the response was TRUNCATED
        # (the model spent its budget on reasoning and never reached the field),
        # not that it chose to emit nothing. Saying "your previous output was
        # empty" gives it nothing to act on and burns identical retries, so name
        # the real cause and ask for a shorter answer.
        parts.append(
            "YOUR PREVIOUS OUTPUT: (empty — the response was cut off before the code "
            "field was written)\n"
            "Your previous attempt ran out of output budget. Keep your reasoning to a "
            "few short bullets and write the component immediately. Prefer a compact, "
            "correct scene over an elaborate one: fewer nested wrappers, fewer inline "
            "style objects, no long comments."
        )

    # validate_component_code() returns on its FIRST failure, so a repair prompt
    # names one broken contract and says nothing about the dozen the scene
    # currently satisfies. Observed consequence: a scene told "missing logoUrl"
    # came back with the logo and ZERO animations; told "insufficient
    # animations" it came back animated and without the logo — ping-ponging
    # between two contracts, shrinking 279 -> 154 lines, and burning every
    # repair attempt without converging.
    #
    # Restating the full contract on every repair costs a few hundred tokens and
    # removes the trade-off the model was implicitly making.
    parts.append(REPAIR_CHECKLIST)

    return "\n\n".join(parts)


# Every hard requirement validate_component_code() enforces, as a checklist.
# Attached to EVERY repair prompt — see _format_scene_failure().
REPAIR_CHECKLIST = (
    "KEEP EVERY OTHER CONTRACT INTACT. Fixing the error above must not break a rule the "
    "scene already satisfies — that is the single most common way a repair fails. Before "
    "you answer, verify ALL of these are still true:\n"
    "  1. LOGO: `{props.logoUrl && typeof props.logoUrl === 'string' && (<Img "
    "src={props.logoUrl} data-logo=\"1\" style={{width: .., height: ..}} />)}` is present.\n"
    "  2. IMAGE: `const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');` "
    "is declared and the image is rendered when present, on an element carrying "
    "data-content-img=\"1\".\n"
    "  3. ANIMATION: at least TWO interpolate() or spring() calls drive visible motion.\n"
    "  4. OVERFLOW: the outermost container sets overflow:'hidden'.\n"
    "  5. TEXT FROM PROPS: every visible string comes from props — no invented sample "
    "copy, no hardcoded headlines, and never the raw contentType value as text.\n"
    "  6. NO IMPORTS / NO REDECLARED KIT GLOBALS, and no process.env or runtime APIs.\n"
    "  7. PORTRAIT: the isPortrait branch is genuinely different from the landscape one.\n"
    "  8. HEADLINE SIZE: the headline is `<FitText fontSize={props.titleFontSize ?? <your "
    "size>} ...>{props.displayText}</FitText>` — inside FitText AND reading the prop. Body "
    "copy reads `props.descriptionFontSize ?? <your size>`.\n"
    "  9. NO NARRATION ON SCREEN: `props.narrationText` appears NOWHERE in the JSX. It is "
    "the voiceover. Use `props.sceneTitle` for an eyebrow/label.\n"
    "Keep the layout, geometry and motion of your previous attempt — change only what the "
    "error requires."
)


def _format_visual_failure(critique: str) -> str:
    """Turn a vision-model critique into a repair instruction.

    Framed carefully: the code COMPILED and passed every static check, so the
    model must not go rewriting structure. Only the rendered result is wrong.
    """
    return (
        "ERROR: your previous attempt compiled and passed every static check, but a "
        "SCREENSHOT of the rendered frame shows real visual defects. This is not a style "
        "opinion — a vision model looked at the actual pixels:\n\n"
        f"{critique}\n\n"
        "Fix EXACTLY these defects. The code is structurally correct, so keep the layout, "
        "the motion, and every contract the scene already satisfies — change only what is "
        "visually wrong. If a defect is invisible or low-contrast text, derive the "
        "foreground from its own background: const fg = readableOn(<that background>).\n\n"
        + REPAIR_CHECKLIST
    )


# ─── Per-layout prop schema (P3) ────────────────────────────────


class DescribeSceneProps(dspy.Signature):
    """List the extra editable props a generated scene reads.

    Runs as a SEPARATE, cheap pass over finished code rather than as another
    output field on GenerateSceneCode. That signature already carries a very
    large docstring plus 11 inputs and 5 outputs; adding a sixth output pushed
    responses past max_tokens and the model returned an EMPTY `code` field after
    burning ~145s — a total loss, because `code` is emitted before the later
    fields. Reading the finished code costs a fraction of that and cannot
    corrupt the scene.

    Report ONLY props read via `props.layoutProps?.<key>`. Ignore every standard
    prop (displayText, narrationText, imageUrl, bullets, metrics, quote, ...) —
    those are already editable elsewhere.

    Output a JSON array, or [] when the scene reads none:
      [{"key":"chapterNumber","label":"Chapter Number","type":"string","default":"01"}]

    type must be one of: string | text | color | number | select | string_array
    | object_array. object_array needs "subFields":[{"key":..,"label":..}];
    select needs "options":[{"value":..,"label":..}].
    """

    scene_code: str = dspy.InputField(desc="The generated scene component code.")
    prop_schema_json: str = dspy.OutputField(desc="JSON array of extra editable props, or [].")


def _describe_scene_props(code: str) -> list[dict]:
    """Extract the per-layout prop schema from finished scene code.

    Skips the LLM entirely when the code contains no `props.layoutProps` read —
    the common case, and it makes this free for most scenes.
    """
    if not code or "layoutProps" not in code:
        return []
    try:
        ensure_dspy_configured()
        with dspy.context(lm=get_scene_type_lm()):
            result = dspy.Predict(DescribeSceneProps)(scene_code=code)
        return _parse_prop_schema(getattr(result, "prop_schema_json", "") or "", code)
    except Exception as e:  # noqa: BLE001 - never fail a good scene over metadata
        print(f"[F7-DEBUG] [PROP-SCHEMA] describe failed ({type(e).__name__}); skipping: {e}")
        return []

# The scene editor's generic renderer maps exactly these schema types
# (SceneEditModal.schemaLayoutPropTypeToFieldType). Anything else renders
# nothing, so an unknown type is dropped rather than stored as a dead field.
_ALLOWED_PROP_TYPES = frozenset({
    "string", "text", "color", "number", "select", "string_array", "object_array",
})

# Keys owned by the standard scene contract (GeneratedSceneProps / SceneProps).
# A layout prop that shadows one of these would create two editor fields writing
# to different places, so collisions are rejected.
_RESERVED_PROP_KEYS = frozenset({
    "displayText", "narrationText", "imageUrl", "imageObjectPosition", "imageZoom",
    "hasVideo", "sceneIndex", "totalScenes", "logoUrl", "brandImages", "brandColors",
    "aspectRatio", "contentType", "bullets", "metrics", "codeLines", "codeLanguage",
    "quote", "quoteAuthor", "comparisonLeft", "comparisonRight", "timelineItems",
    "steps", "chartTable", "chartType", "chartSummary", "titleFontSize",
    "descriptionFontSize", "headingFont", "bodyFont", "layoutProps",
    "imageBoxAspectRatio",
})

MAX_LAYOUT_PROPS = 12


def _parse_prop_schema(raw: str, code: str) -> list[dict]:
    """Validate the model's declared per-layout props.

    Drops anything unusable rather than raising — a bad schema must never fail a
    scene that otherwise renders fine. Two rules do real work:

      * a prop the CODE never reads is dropped, because it would show up as an
        editor field that changes nothing;
      * a key colliding with the standard scene contract is dropped, because two
        fields would write to different places.
    """
    if not raw or not raw.strip():
        return []
    try:
        parsed = _extract_json_array(raw)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []

    out: list[dict] = []
    seen: set[str] = set()
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        key = str(entry.get("key") or "").strip()
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", key):
            continue
        if key in _RESERVED_PROP_KEYS or key in seen:
            continue
        ftype = str(entry.get("type") or "string").strip()
        if ftype not in _ALLOWED_PROP_TYPES:
            continue
        # Declared but never read -> a dead editor field.
        if not re.search(rf"layoutProps\s*(?:\?\.|\[\s*['\"]){re.escape(key)}", code):
            print(f"[F7-DEBUG] [PROP-SCHEMA] dropped {key!r}: declared but not read in code")
            continue

        field: dict = {
            "key": key,
            "label": str(entry.get("label") or key)[:60],
            "type": ftype,
        }
        if entry.get("placeholder"):
            field["placeholder"] = str(entry["placeholder"])[:120]
        if ftype == "select":
            options = [
                {"value": str(o.get("value")), "label": str(o.get("label") or o.get("value"))}
                for o in (entry.get("options") or [])
                if isinstance(o, dict) and o.get("value") is not None
            ]
            if not options:
                continue  # a select with no options is unusable
            field["options"] = options[:12]
        if ftype == "object_array":
            subs = [
                {"key": str(sf.get("key")), "label": str(sf.get("label") or sf.get("key"))}
                for sf in (entry.get("subFields") or [])
                if isinstance(sf, dict) and sf.get("key")
            ]
            if not subs:
                continue  # without subFields the editor cannot render rows
            field["subFields"] = subs[:6]
        if ftype == "number":
            for bound in ("min", "max", "step"):
                if isinstance(entry.get(bound), (int, float)):
                    field[bound] = entry[bound]
        if ftype in ("string_array", "object_array"):
            if isinstance(entry.get("maxItems"), int):
                field["maxItems"] = max(1, min(12, entry["maxItems"]))

        default = entry.get("default")
        if default is not None:
            field["default"] = default

        out.append(field)
        seen.add(key)
        if len(out) >= MAX_LAYOUT_PROPS:
            break

    return out


def build_layout_prop_schema(fields: list[dict], label: str) -> dict:
    """Shape a validated field list into a meta.json `layout_prop_schema` entry.

    Matches what SceneEditModal.layoutPropSchemaToFieldDefs consumes for
    built-in and crafted templates, so custom templates light up the SAME
    generic renderer with no frontend changes.
    """
    defaults = {f["key"]: f["default"] for f in fields if "default" in f}
    entry: dict = {
        "label": label,
        "fields": [{k: v for k, v in f.items() if k != "default"} for f in fields],
    }
    if defaults:
        entry["defaults"] = defaults
    return entry


# ─── Deterministic stub scene (§R Layer 3) ──────────────────────


def _build_stub_scene_code(scene_type: str, theme: dict | None = None) -> str:
    """Build a valid, on-brand fallback scene WITHOUT calling an LLM.

    Used when a scene fails validation after every repair attempt. Because it is
    hand-written it cannot fail, which is the whole point: it converts "one bad
    scene kills the batch" into "one scene looks simpler than the rest".

    MUST satisfy every hard gate in validate_component_code():
      - `const SceneComponent` declaration
      - >= 2 interpolate/spring calls
      - >= 500 chars
      - overflow:'hidden'
      - a conditional props.logoUrl render
      - a `hasImage` declaration (image conditional)
      - balanced braces/parens/brackets, no dangerous APIs
      - monotonic numeric interpolate ranges
    It also renders the data-content-img CONTAINER whenever a visual slot is
    needed, so the stock-footage clip path (ClipSlotOverlay) still aligns.

    Covered by test_stub_scene_validates so a regression in the validator or in
    this string is caught in CI rather than at generation time.
    """
    colors = ((theme or {}).get("colors") or {}) if isinstance(theme, dict) else {}
    # Fall back to the props-provided brand colors at runtime; these literals are
    # only the last resort if props.brandColors is somehow absent.
    bg = colors.get("bg") or "#0F172A"
    text = colors.get("text") or "#F8FAFC"
    accent = colors.get("accent") or "#38BDF8"

    return f"""const SceneComponent = (props) => {{
  const frame = useCurrentFrame();
  const {{ fps, durationInFrames }} = useVideoConfig();

  const hasImage = !!(props.imageUrl && typeof props.imageUrl === 'string');
  const hasVideo = !!props.hasVideo;
  const showVisualSlot = hasImage || hasVideo;
  const showImageContent = hasImage && !hasVideo;
  const isPortrait = props.aspectRatio === 'portrait';

  const colors = props.brandColors || {{}};
  const bg = colors.background || '{bg}';
  const fg = colors.text || '{text}';
  const accent = colors.accent || '{accent}';

  const enter = spring({{ frame, fps, config: {{ damping: 20, stiffness: 90 }} }});
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 20), durationInFrames],
    [1, 0],
    {{ extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }}
  );
  const rule = interpolate(frame, [6, 30], [0, 100], {{
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }});

  return (
    <AbsoluteFill
      style={{{{
        background: hasVideo ? 'transparent' : bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: isPortrait ? 'column' : 'row',
        alignItems: 'stretch',
        opacity: exit,
      }}}}
    >
      {{showVisualSlot && (
        <div
          data-content-img="1"
          style={{{{
            position: 'relative',
            overflow: 'hidden',
            background: 'transparent',
            width: isPortrait ? '100%' : '45%',
            height: isPortrait ? '45%' : '100%',
            flexShrink: 0,
          }}}}
        >
          {{showImageContent && (
            <Img
              src={{props.imageUrl}}
              style={{{{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: props.imageObjectPosition || '50% 50%',
                transform: `scale(${{props.imageZoom ?? 1}})`,
                transformOrigin: props.imageObjectPosition || '50% 50%',
              }}}}
            />
          )}}
        </div>
      )}}

      <div
        style={{{{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: isPortrait ? '8% 7%' : '7% 6%',
          transform: `translateY(${{(1 - enter) * 24}}px)`,
          opacity: enter,
        }}}}
      >
        {{props.logoUrl && typeof props.logoUrl === 'string' && (
          <Img
            src={{props.logoUrl}}
            data-logo="1"
            style={{{{
              width: 72,
              height: 72,
              objectFit: 'contain',
              marginBottom: 24,
              flexShrink: 0,
            }}}}
          />
        )}}

        <div
          style={{{{
            width: `${{rule}}%`,
            maxWidth: 120,
            height: 4,
            background: accent,
            marginBottom: 28,
            flexShrink: 0,
          }}}}
        />

        <FitText
          fontSize={{props.titleFontSize ?? (isPortrait ? 58 : 68)}}
          maxLines={{3}}
          style={{{{
            color: fg,
            fontFamily: props.headingFont || 'inherit',
            fontWeight: 700,
          }}}}
        >
          {{props.displayText}}
        </FitText>
      </div>
    </AbsoluteFill>
  );
}};"""


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

    # Step 1b: Design blueprint (P2). Gated on CUSTOM_BLUEPRINT_ENABLED so this
    # ships dark — it changes how every custom template is generated, and
    # rollback should be a config change rather than a revert.
    #
    # The blueprint replaces the fixed five-composition vocabulary with layouts
    # this brand's own design authored, so two brands stop sharing a structural
    # rhythm. It can never break generation: output is validated + repaired, and
    # a total failure falls back to a blueprint synthesised from the existing
    # deterministic signature engine (i.e. today's behaviour).
    blueprint: dict | None = None
    if settings.CUSTOM_BLUEPRINT_ENABLED:
        from app.dspy_modules.blueprint import fallback_blueprint, generate_blueprint

        _bp_seed = f"{theme.get('category', '')}|{theme.get('style', '')}|{template.name}"
        # The blueprint stage must NEVER be able to fail template generation —
        # that is its stated contract, and the whole point of having a
        # deterministic fallback. generate_blueprint() catches the model-failure
        # exceptions it anticipates, but an unanticipated one (an AttributeError
        # from a malformed section, as seen on template 135) escaped and killed
        # the entire run. Catch broadly here: a template built on the fallback
        # blueprint is a far better outcome than no template at all.
        blueprint = None
        try:
            blueprint, _bp_repairs = await loop.run_in_executor(
                None, partial(generate_blueprint, brand_context, user_brief, seed=_bp_seed)
            )
        except Exception as _bp_err:  # noqa: BLE001
            print(f"[F7-DEBUG] [BLUEPRINT] stage raised {type(_bp_err).__name__}: {_bp_err}")
        if blueprint is None:
            blueprint = fallback_blueprint(theme, content_archetypes, template.name)
            print("[F7-DEBUG] [BLUEPRINT] using deterministic fallback blueprint")

        # The blueprint's own layouts supersede the scene-type archetypes: it
        # authored them together with their geometry, so they must stay paired.
        _bp_content = [
            l for l in blueprint["layouts"] if l["role"] not in ("intro", "outro")
        ]
        if _bp_content:
            content_archetypes = [
                {
                    "id": l["id"],
                    "scene_type": "content",
                    "best_for": l["best_for"],
                    "description": l["label"],
                    "role": l["role"],
                    "supports_image": l["supports_image"],
                }
                for l in _bp_content
            ]

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

    # Blueprint threading helpers. When the blueprint path is off, both return
    # "" and every scene falls back to the legacy scene_purpose directives.
    _blueprint_json = json.dumps(blueprint, ensure_ascii=False) if blueprint else ""

    def _layout_spec_for(role: str, index: int = 0) -> str:
        if not blueprint:
            return ""
        from app.dspy_modules.blueprint import layout_for_scene

        lay = layout_for_scene(blueprint, role, index)
        return json.dumps(lay, ensure_ascii=False) if lay else ""

    def _bookend_directive(which: str) -> str:
        """Per-brand bookend art direction from the blueprint.

        Replaces the old hardcoded arc ("the intro is loud, the outro is calm"),
        which was a house style applied to every brand regardless of fit.
        """
        if not blueprint:
            return ""
        be = (blueprint.get("bookends") or {}).get(which) or {}
        if which == "intro":
            return (
                f" | OPENING (this brand's own): opening_move={be.get('opening_move')!r}, "
                f"logo_treatment={be.get('logo_treatment')!r}, "
                f"title_reveal={be.get('title_reveal')!r}, energy={be.get('energy')!r}. "
                "Build THIS opening — do not default to a generic centred logo-and-title reveal."
            )
        return (
            f" | CLOSING (this brand's own): closing_move={be.get('closing_move')!r}, "
            f"energy={be.get('energy')!r}, echoes_intro={be.get('echoes_intro')}. "
            "Design it on its own terms; it need NOT be quieter than the intro."
        )

    def _structure_directive() -> str:
        """Persistent chrome that repeats across every scene of this template."""
        if not blueprint:
            return ""
        st = blueprint.get("structure") or {}
        parts: list[str] = []
        chrome = st.get("chrome") or {}
        if chrome.get("enabled"):
            parts.append(
                f"<Masthead position=\"{chrome.get('position', 'top')}\" "
                f"rule=\"{chrome.get('rule', 'hairline')}\" /> on EVERY scene "
                f"(left={chrome.get('left')!r}, right={chrome.get('right')!r})"
            )
        num = st.get("panel_numbering") or {}
        if num.get("enabled"):
            parts.append(
                f"<PanelNumber style=\"{num.get('style', 'padded')}\" "
                f"corner=\"{num.get('corner', 'tr')}\" value={{props.sceneIndex + 1}} "
                f"total={{props.totalScenes}} />"
            )
        sa = (st.get("safe_area") or {}).get("landscape") or {}
        sap = (st.get("safe_area") or {}).get("portrait") or {}
        if sa and sap:
            parts.append(
                "safe area (THIS template's own policy, not a generic inset): landscape "
                f"{sa.get('top')}/{sa.get('right')}/{sa.get('bottom')}/{sa.get('left')}%, portrait "
                f"{sap.get('top')}/{sap.get('right')}/{sap.get('bottom')}/{sap.get('left')}%"
            )
        return f" | TEMPLATE STRUCTURE: {'; '.join(parts)}" if parts else ""

    # Step 3: Generate ALL scenes in parallel. Each scene's kwargs are kept
    # alongside its task (not just the coroutine) so a scene that fails FINAL
    # validation below can be individually regenerated — dspy.Refine always
    # returns its best-scoring attempt even when every attempt scored 0.0 (it
    # never raises), so a scene can silently come back invalid despite Refine
    # "succeeding". Retrying only the failed scene(s) is far cheaper than
    # failing the whole batch and forcing the user to regenerate all 9 scenes
    # (burning quota) to get past one bad one.
    scene_kwargs: list[dict] = [
        dict(
            brand_context=brand_context,
            design_system=design_system,
            blueprint=_blueprint_json,
            layout_spec=_layout_spec_for("intro"),
            art_direction=build_art_direction(blueprint, "intro"),
            scene_type="intro",
            scene_index=0,
            total_scenes=total_scenes,
            scene_purpose=(
                (
                    # Blueprint path: the opening move, logo treatment, reveal
                    # and energy all come from this brand's own bookend design.
                    f"{intro_archetype['id']}: {intro_archetype['description']} "
                    "| brand-reveal opener (no bullet/metric lists)"
                    f"{_bookend_directive('intro')}{_structure_directive()}"
                )
                if blueprint
                else (
                    f"{intro_archetype['id']}: {intro_archetype['description']} "
                    "| brand-reveal opener: lead with an animated brand-name title + a real "
                    "logo reveal and ONE signature entrance beat (no bullet/metric lists) "
                    f"| SIGNATURE ARTIFACT: give <SignatureArtifact motion=\"{_intro_artifact}\" "
                    "intensity={0.7} /> its BOLD hero take here — this is the loudest, most "
                    "energetic moment of the whole video; the title entrance should be the "
                    "video's biggest motion beat"
                )
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
        # ── V3 verification: each content scene gets a distinct directive.
        #
        # On the BLUEPRINT path the five-composition rotation is not used at all
        # — build_art_direction() sends the layout's authored geometry instead —
        # so logging `composition='centered focal'` there claimed a directive the
        # model never received and made the blueprint look ignored in the logs.
        if blueprint:
            _lay = _bp_content[i % len(_bp_content)] if _bp_content else None
            print(
                f"[F7-DEBUG] [V3][COMPOSITION] content scene {i + 1}/{num_content} "
                f"(archetype={arch['id']!r}) -> blueprint layout="
                f"{(_lay or {}).get('id', '?')!r} surface={(_lay or {}).get('surface')!r} "
                f"img={(_lay or {}).get('image_treatment')!r} "
                f"artifact={(_lay or {}).get('artifact')!r}"
                f"{' [+brief-hint]' if _brief_hint else ''}"
            )
        else:
            print(
                f"[F7-DEBUG] [V3][COMPOSITION] content scene {i + 1}/{num_content} "
                f"(archetype={arch['id']!r}) -> composition={_comp!r} artifact={_scene_artifact!r}"
                f"{' [+brief-hint]' if _brief_hint else ''}"
            )
        scene_kwargs.append(
            dict(
                brand_context=brand_context,
                design_system=design_system,
                blueprint=_blueprint_json,
                layout_spec=_layout_spec_for("content", i),
                art_direction=build_art_direction(blueprint, "content", i, composition=_comp),
                scene_type="content",
                scene_index=i + 1,
                total_scenes=total_scenes,
                scene_purpose=(
                    (
                        # Blueprint path: geometry comes from layout_spec, so the
                        # fixed five-composition directive is deliberately absent.
                        f"{arch['id']}: {arch['description']}{best_for_hint} "
                        f"| content scene {i + 1} of {num_content}: build the geometry described "
                        "in layout_spec — it was authored for this brand and must not be "
                        "replaced with a generic composition"
                        f"{_structure_directive()}{_brief_hint}"
                    )
                    if blueprint
                    else (
                        f"{arch['id']}: {arch['description']}{best_for_hint} "
                        f"| content scene {i + 1} of {num_content}: use a '{_comp}' composition, "
                        "visually DISTINCT from its neighbours (do not reuse a centered card) "
                        f"| SIGNATURE ARTIFACT: echo the brand with <SignatureArtifact "
                        f"motion=\"{_scene_artifact}\" intensity={{0.4}} /> — a restrained ECHO "
                        "(not the intro's hero take), placed differently than neighbouring scenes"
                        f"{_brief_hint}"
                    )
                ),
            ),
        )
    scene_kwargs.append(
        dict(
            brand_context=brand_context,
            design_system=design_system,
            blueprint=_blueprint_json,
            layout_spec=_layout_spec_for("outro"),
            art_direction=build_art_direction(blueprint, "outro"),
            scene_type="outro",
            scene_index=total_scenes - 1,
            total_scenes=total_scenes,
            scene_purpose=(
                (
                    # Blueprint path: the outro is designed on its OWN terms.
                    # The old directive defined it only in opposition to the
                    # intro ("where the intro was loud, the outro is calm"),
                    # which gave every brand the same arc.
                    f"{outro_archetype['id']}: {outro_archetype['description']} "
                    "| closing scene. A CTA + socials row is overlaid automatically at render "
                    "time — do NOT hand-roll social icons, website buttons or Subscribe/Follow "
                    "CTAs; leave room for them. This scene takes NO content image."
                    f"{_bookend_directive('outro')}{_structure_directive()}"
                )
                if blueprint
                else (
                    f"{outro_archetype['id']}: {outro_archetype['description']} "
                    "| closing brand recap (a CTA + socials row is overlaid automatically — "
                    "do not hand-roll social icons or CTA buttons) "
                    "| DELIBERATELY DIFFERENT FROM THE INTRO: where the intro was loud, big and "
                    "energetic, the outro is calm and settled — a different alignment/composition "
                    "and a gentler entrance (NOT the same centered title treatment as the intro) "
                    f"| SIGNATURE ARTIFACT: a QUIET callback with <SignatureArtifact "
                    f"motion=\"{_outro_artifact}\" intensity={{0.35}} /> — a different motif than "
                    "the intro's hero artifact so the bookends don't look identical"
                )
            ),
        ),
    )

    # ── Per-generation cache-buster ───────────────────────────────────────────
    # DSPy's LM caches on the request signature (model + prompt + params). Every
    # call to generate_component_code builds byte-identical scene_purpose kwargs
    # for the same template, so a *regenerate* produces the identical cache key and
    # replays the cached completion verbatim — including a scene that renders blank
    # at runtime (a crash the static validator can't catch, so it passes final
    # validation, gets stored, and can never be regenerated away). Confirmed in the
    # wild: three back-to-back regenerate-code calls wrote byte-identical scene
    # files (e.g. SceneContent3.tsx 10331 bytes each time). This is the same disk
    # cache replay the failure-retry loop already busts via a nonce (see below) —
    # here we bust it for EVERY generation, not just the failed-validation path, so
    # a user hitting "Regenerate" always gets a genuinely fresh completion.
    _gen_nonce = time.time_ns()
    for _kw in scene_kwargs:
        _kw["scene_purpose"] = f"{_kw['scene_purpose']} | [gen {_gen_nonce}]"

    scene_tuples = await asyncio.gather(*(_generate_single_scene(**kw) for kw in scene_kwargs))
    scenes = [code for code, _, _ in scene_tuples]
    # Each entry is a dict {"landscape": "W / H", "portrait": "W / H"}
    scene_aspect_ratios: list[dict[str, str]] = [ar for _, ar, _ in scene_tuples]
    # Per-layout editable props each scene declared (P3), index-aligned with scenes.
    scene_prop_schemas: list[list[dict]] = [ps for _, _, ps in scene_tuples]

    # Log what was generated
    scene_labels = [intro_archetype["id"]] + [a["id"] for a in content_archetypes] + [outro_archetype["id"]]
    for i, (label, code) in enumerate(zip(scene_labels, scenes)):
        line_count = code.count("\n") + 1
        print(f"[F7-DEBUG] [CODEGEN] Scene {i} ({label}): {line_count} lines")

    # Final validation pass. dspy.Refine (inside _generate_single_scene) always
    # returns its best-scoring attempt even when every attempt scored 0.0 — it
    # never raises on a failing scene, so a syntactically-broken scene can come
    # back here despite Refine "succeeding". Rather than failing the ENTIRE
    # 9-scene batch (which burns the user's quota + discards 8 good scenes) over
    # one bad scene, regenerate just the failing scene(s) a few more times —
    # each retry uses a fresh temperature=1.0 rollout, so it isn't the same
    # deterministic failure repeating.
    def _log_failed_scene(scene_idx: int, label: str, code: str, error: str, attempt_label: str) -> str:
        """Print the validator error AND the actual LLM output around the
        failure point, so a broken generation is diagnosable from server logs
        alone instead of having to query the DB for what the model wrote.

        Returns the formatted diagnostic so the RETRY can feed the model the
        real error (see _format_scene_failure) instead of a generic hint."""
        print(f"[F7-DEBUG] [CODEGEN] Scene {scene_idx} ({label}) {attempt_label}: {error}")
        diagnostic = _format_scene_failure(code, error)
        print(f"[F7-DEBUG] [CODEGEN] Failure context (scene {scene_idx}):\n{diagnostic}")
        return diagnostic

    scene_types_simple = ["intro"] + ["content"] * num_content + ["outro"]
    MAX_SCENE_RETRIES = 3
    # Escalating repair strategies (§R Layer 2). Each attempt DIFFERS rather than
    # repeating the same request: targeted repair, then simplify, then strip the
    # scene back to its essentials. Appended to scene_purpose alongside a nonce
    # (DSPy caches on the whole prompt; previous_failure already busts the key,
    # but the nonce covers the identical-error case).
    # Repair strategies escalate in FOCUS, not in destruction.
    #
    # The previous repair 3 said "Produce the SIMPLEST scene ... Drop all other
    # decoration", and repair 2 said "drop non-essential decoration". Combined
    # with a validator that reported one error at a time, that instruction is
    # what drove the observed collapse: a scene told "missing logoUrl" rewrote
    # itself smaller, lost its animations, was told "insufficient animations",
    # rewrote again and lost the logo — shrinking 279 -> 279 -> 154 lines across
    # three repairs without ever converging.
    #
    # Every repair now says the same thing in stronger terms: change ONLY what
    # the listed errors require, and keep everything else exactly as it is.
    _REPAIR_STRATEGIES = (
        "",
        (
            " | [repair 2: your previous attempt still failed. Fix ONLY the listed errors. "
            "Keep the layout geometry, the motion, and every contract the scene already "
            "satisfies — a repair that fixes one error by breaking another cannot converge.]"
        ),
        (
            " | [repair 3: FINAL attempt. Work through the numbered error list and satisfy "
            "EVERY item simultaneously — they are all required at once, not in turn. Start "
            "from your previous code and make the minimum edit that clears the whole list; "
            "do NOT rewrite the scene from scratch and do NOT strip existing detail.]"
        ),
    )
    generation_warnings: list[str] = []

    for i in range(len(scenes)):
        # collect_all: report EVERY broken contract, not just the first. Fixing one
        # at a time is what made a scene restore its logo while dropping its
        # animations, then restore animations and drop the logo again.
        valid, err = validate_component_code(
            scenes[i], scene_type=scene_types_simple[i], collect_all=True
        )
        if valid:
            continue
        diagnostic = _log_failed_scene(
            i, scene_labels[i], scenes[i], err, "failed final validation (initial attempt)"
        )
        for retry in range(1, MAX_SCENE_RETRIES + 1):
            strategy = _REPAIR_STRATEGIES[min(retry - 1, len(_REPAIR_STRATEGIES) - 1)]
            retry_kwargs = {
                **scene_kwargs[i],
                "scene_purpose": (
                    f"{scene_kwargs[i]['scene_purpose']}{strategy}"
                    f" | [repair {retry} {time.time_ns()}]"
                ),
                # The REAL error, not a hardcoded "syntax error" guess (§R Layer 1).
                "previous_failure": diagnostic,
                # One informed call per repair instead of Refine's rollouts (§R Layer 2).
                "use_refine": False,
            }
            code, ar, ps = await _generate_single_scene(**retry_kwargs)
            valid, err = validate_component_code(
                code, scene_type=scene_types_simple[i], collect_all=True
            )
            scenes[i] = code
            scene_aspect_ratios[i] = ar
            scene_prop_schemas[i] = ps
            if valid:
                print(f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) recovered on repair {retry}")
                break
            diagnostic = _log_failed_scene(
                i, scene_labels[i], code, err, f"failed final validation (repair {retry}/{MAX_SCENE_RETRIES})"
            )
        if not valid:
            # §R Layer 3 — substitute a deterministic, non-LLM stub rather than
            # raising. Raising here killed the WHOLE batch (and ~6 minutes of
            # compute across the other scenes) over one bad scene. A template
            # with N-1 real scenes plus one on-brand stub is far more useful
            # than a refunded slot and nothing — and P4's per-scene AI edit is
            # the natural repair path for the stubbed scene.
            print(
                f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) STUBBED after "
                f"{MAX_SCENE_RETRIES} repairs — last error: {err}"
            )
            scenes[i] = _build_stub_scene_code(scene_types_simple[i], theme)
            scene_aspect_ratios[i] = {"landscape": "16 / 9", "portrait": "9 / 16"}
            scene_prop_schemas[i] = []
            generation_warnings.append(
                f"Scene {i} ({scene_labels[i]}) could not be generated after "
                f"{MAX_SCENE_RETRIES} attempts and uses a simplified fallback design. "
                f"Last error: {err}"
            )

    # Total failure (every scene stubbed) is a real outage — surface it rather
    # than storing an all-placeholder template.
    if generation_warnings and len(generation_warnings) == len(scenes):
        raise RuntimeError(
            f"All {len(scenes)} scenes failed validation. Last error: {err}"
        )

    # §R Layer 5 — validate the WRAPPED output, not just the raw snippet.
    # validate_component_code() parses the raw scene code, but what actually gets
    # bundled is _wrap_generated_code(raw): raw plus ~45 kit imports, the remotion
    # imports and a shadowing `interpolate`. A raw snippet can parse cleanly yet
    # break once wrapped — most commonly when the generated code declares a name
    # that collides with an injected import (the same TDZ class the validator
    # already special-cases). Catching it here keeps a whole-video bundle failure
    # out of the database.
    for i in range(len(scenes)):
        wrapped_ok, wrapped_err = validate_wrapped_component_code(scenes[i])
        if wrapped_ok:
            continue
        print(
            f"[F7-DEBUG] [CODEGEN] Scene {i} ({scene_labels[i]}) failed WRAPPED "
            f"validation — stubbing: {wrapped_err}"
        )
        scenes[i] = _build_stub_scene_code(scene_types_simple[i], theme)
        scene_aspect_ratios[i] = {"landscape": "16 / 9", "portrait": "9 / 16"}
        scene_prop_schemas[i] = []
        generation_warnings.append(
            f"Scene {i} ({scene_labels[i]}) conflicted with the render wrapper and "
            f"uses a simplified fallback design. Error: {wrapped_err}"
        )

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
        # §R — scenes that fell back to the deterministic stub. Persisted and
        # surfaced in the UI so a stubbed scene is visible, not silent.
        "generation_warnings": generation_warnings,
        # P2 — the design law this template was built from. Persisted so a
        # per-scene AI edit can regenerate ONE scene against the same design,
        # and so the editor knows each layout's image capability.
        "design_blueprint": blueprint,
        # P3 — per-layout editable props, mirroring image_box_aspect_ratios'
        # {intro, content[], outro} shape so the indexing convention matches.
        # Cached so a single-scene AI edit reuses the same shared styling.
        "design_system": design_system,
        "layout_prop_schemas": {
            "intro": scene_prop_schemas[0],
            "content": scene_prop_schemas[1:-1],
            "outro": scene_prop_schemas[-1],
        },
    }


# ─── Single-scene AI edit (P4) ──────────────────────────────────


SCENE_KEY_RE = re.compile(r"^(intro|outro|content_(\d+))$")


def parse_scene_key(scene_key: str, num_content: int) -> tuple[str, int]:
    """Resolve a scene key into (role, content index). Raises ValueError."""
    m = SCENE_KEY_RE.match((scene_key or "").strip())
    if not m:
        raise ValueError(f"invalid scene key {scene_key!r}")
    if m.group(1) in ("intro", "outro"):
        return m.group(1), -1
    idx = int(m.group(2))
    if idx < 0 or idx >= num_content:
        raise ValueError(f"content index {idx} out of range (0..{num_content - 1})")
    return "content", idx


async def regenerate_single_scene(
    template: CustomTemplate,
    scene_key: str,
    user_prompt: str,
    keep_geometry: bool = False,
) -> dict:
    """Regenerate ONE scene from a user's prompt.

    A thin sibling of generate_component_code: same validation, same repair
    ladder, but scoped to a single scene and driven by an edit instruction.

    Deliberately does NOT fall back to the stub. Everywhere else a stub is the
    right answer — a degraded scene beats a dead batch. Here it would silently
    replace the user's scene with a generic one after they asked for a specific
    change, so a failed edit is reported as a failure and the published scene is
    left untouched.
    """
    theme = json.loads(template.theme) if isinstance(template.theme, str) else template.theme
    content_codes = json.loads(template.content_codes) if template.content_codes else []
    role, content_index = parse_scene_key(scene_key, len(content_codes))

    if role == "intro":
        current = template.intro_code or ""
        scene_index = 0
    elif role == "outro":
        current = template.outro_code or ""
        scene_index = len(content_codes) + 1
    else:
        current = content_codes[content_index]
        scene_index = content_index + 1
    if not current:
        raise RuntimeError(f"scene {scene_key!r} has no existing code to edit")

    total_scenes = len(content_codes) + 2

    brand_kit_data = None
    if template.brand_kit:
        bk = template.brand_kit
        brand_kit_data = {
            "colors": json.loads(bk.colors) if isinstance(bk.colors, str) else bk.colors,
            "fonts": json.loads(bk.fonts) if isinstance(bk.fonts, str) else bk.fonts,
            "logos": json.loads(bk.logos) if isinstance(bk.logos, str) else bk.logos,
            "design_language": (
                json.loads(bk.design_language)
                if isinstance(bk.design_language, str)
                else bk.design_language
            ),
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

    # Reuse the STORED design system rather than regenerating it. Regenerating
    # would drift the shared styling and leave the edited scene subtly out of
    # step with its siblings — the opposite of what an edit should do.
    design_system = ""
    if getattr(template, "design_system", None):
        design_system = template.design_system or ""
    if not design_system:
        loop = asyncio.get_event_loop()
        design_system = await loop.run_in_executor(None, _generate_design_system, brand_context)

    blueprint = (
        json.loads(template.design_blueprint) if template.design_blueprint else None
    )
    layout_spec_json = ""
    if blueprint:
        from app.dspy_modules.blueprint import layout_for_scene

        lay = layout_for_scene(blueprint, role, max(0, content_index))
        if lay:
            layout_spec_json = json.dumps(lay, ensure_ascii=False)

    instruction = (user_prompt or "").strip()
    if keep_geometry:
        instruction += (
            " | KEEP THE EXISTING LAYOUT GEOMETRY unchanged — apply only the change "
            "described above, leaving the overall composition where it is."
        )

    kwargs = dict(
        brand_context=brand_context,
        design_system=design_system,
        blueprint=json.dumps(blueprint, ensure_ascii=False) if blueprint else "",
        layout_spec=layout_spec_json,
        # Same art direction the scene was originally built under, so an edit
        # does not silently re-compose the scene against a different brief.
        art_direction=build_art_direction(blueprint, role, max(0, content_index)),
        scene_type=role,
        scene_index=scene_index,
        total_scenes=total_scenes,
        scene_purpose=f"{scene_key}: user-requested edit | [edit {time.time_ns()}]",
        current_code=current,
        edit_instruction=instruction,
    )

    code, aspect_ratio, prop_schema = await _generate_single_scene(**kwargs)
    valid, err = validate_component_code(code, scene_type=role)

    for retry in range(1, MAX_SCENE_EDIT_RETRIES + 1):
        if valid:
            break
        diagnostic = _format_scene_failure(code, err)
        print(f"[F7-DEBUG] [SCENE-EDIT] {scene_key} attempt {retry} invalid: {err}")
        code, aspect_ratio, prop_schema = await _generate_single_scene(
            **{
                **kwargs,
                "scene_purpose": f"{scene_key}: user-requested edit | [edit retry {retry} {time.time_ns()}]",
                "previous_failure": diagnostic,
                "use_refine": False,
            }
        )
        valid, err = validate_component_code(code, scene_type=role)

    if not valid:
        raise RuntimeError(f"edited scene failed validation: {err}")

    wrapped_ok, wrapped_err = validate_wrapped_component_code(code)
    if not wrapped_ok:
        raise RuntimeError(f"edited scene conflicts with the render wrapper: {wrapped_err}")

    print(f"[F7-DEBUG] [SCENE-EDIT] {scene_key} edited OK ({code.count(chr(10)) + 1} lines)")
    return {
        "scene_key": scene_key,
        "role": role,
        "content_index": content_index,
        "code": code,
        "aspect_ratio": aspect_ratio,
        "prop_schema": prop_schema,
    }
