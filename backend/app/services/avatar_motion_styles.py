"""Avatar motion-style prompts.

Project-wide, user-facing choice of how much the rendered presenter moves —
distinct from ``avatar_presets.py``, which picks WHO the presenter is. See
``Project.avatar_motion_style``.

"expressive" is the long-standing default.

v5 (current): text conditioning alone was proven (2026-09-03, ~15 test
renders against the live LongCat-Video-Avatar-1.5 Modal service) to have
almost no effect on generated motion under this deployment's defaults — every
prompt variant, including deliberately extreme/contradictory wording, produced
near-identical output. The actual cause: run_demo_avatar_single_audio_to_video.py
hardcodes the DMD distillation LoRA (dmd_lora.safetensors) at full strength
(multiplier=1.0) whenever --use_distill is set, which is always (required for
avatar-v1.5 per upstream's README) — see modal-service/longcat-avatar/app.py's
FIX #5. Lowering that multiplier to 0.1 (an UNOFFICIAL workaround posted by a
third-party community member, "stepsahead1", on
meituan-longcat/LongCat-Video#120 — NOT confirmed or endorsed by the repo
maintainer, whose own reply on that same thread says only that an internal fix
exists and has not been released) is what actually let these v5 prompts
produce visibly different, correctly-ordered motion (subtle < natural <
expressive, confirmed by file size and frame-by-frame comparison across 5
prompt-revision rounds). The backend must send dmd_lora_multiplier=0.1 on
every /render call for these prompts to have any effect — see services/avatar.py.

KNOWN UNRESOLVED ISSUE: a reproducible eyebrow-raise / eye-glance-away glitch
at roughly the 4-second mark was observed identically across all three styles,
across all 5 prompt-revision rounds (including the most forceful possible
gaze-lock wording) — confirmed audio-driven (tied to the specific test audio
clip's waveform), not prompt-fixable. Left as a known limitation; worth
re-testing against different audio and/or escalating to upstream if it
reproduces on real user narration.

The previous (pre-v5) prompts are kept below, commented out, for reference —
they are what every project rendered under before this fix.
"""
from __future__ import annotations

DEFAULT_MOTION_STYLE: str = "natural"

AVATAR_MOTION_PROMPTS: dict[str, str] = {
    "subtle": (
        "A real person sitting calmly, looking straight into the camera "
        "only, nowhere else, the entire time — a straight, steady, "
        "unwavering gaze right at the viewer, never looking away, never "
        "looking down or to the side, speaking in a low-key, understated "
        "way. Lip syncing only: the lips move in small, precise shapes to "
        "match the audio, never opening wide. The eyes are locked "
        "straight on the camera only, nowhere else, the whole time — "
        "steady, direct, naturally focused, with normal relaxed blinking "
        "only — never glancing away even briefly, never wide-eyed or "
        "staring blankly. The face otherwise stays composed and mostly "
        "still, with only the faintest natural changes — no smiling, no "
        "eyebrow movement, no visible emotional reaction. No hand "
        "movements at all. Little to no head movement — steady in one "
        "position throughout. Overall: a still, composed, low-energy "
        "presenter looking straight into the camera only, nowhere else, "
        "at all times, whose only real motion is small, precise lip "
        "movement."
    ),
    "natural": (
        "A real person looking straight into the camera only, nowhere "
        "else, and speaking casually, like a normal video call — not a "
        "performance. Lips move clearly and naturally with the audio. "
        "The eyes stay looking straight into the camera only, nowhere "
        "else, steady and engaged, with normal relaxed blinking — "
        "present and connected, never glancing away or staring blankly. "
        "The face shows real, natural emotion as they talk — genuine "
        "warmth and reaction come through, eyebrows lift and shift "
        "naturally, mouth and cheeks visibly express what's being said, "
        "the way a real person's face carries feeling in conversation. "
        "The expression should not look dull, flat, or down — there is "
        "real life and warmth in the face throughout. Some natural hand "
        "movement is fine — small, occasional gestures. The head and "
        "neck move noticeably and naturally with the sentence rhythm — "
        "gentle nodding and tilting. Overall: clearly more movement, "
        "expression, and genuine emotion than a still, subtle delivery, "
        "but clearly less than an energetic presenter — relaxed, "
        "present, warm, and real, never dull or down."
    ),
    "expressive": (
        "A person looking straight into the camera only, nowhere else, "
        "speaking with strong, vivid, highly animated delivery — like an "
        "enthusiastic presenter or influencer directly engaging their "
        "audience, very energetic throughout, full of life from start to "
        "finish. Lip movements are wide, clear, and VERY STRONG — bold, "
        "exaggerated, emphatic mouth movements that closely track every "
        "word, especially on emphasized syllables, never subtle or "
        "restrained. Facial expressions closely track the voice too: "
        "eyebrows lift and furrow, eyes widen, the mouth and cheeks move "
        "expressively on emphasized words. The eyes stay looking "
        "straight into the camera only, nowhere else, throughout, lively "
        "and engaged, never glancing away. There is a lot of hand "
        "movement — hands gesture frequently and expressively as they "
        "talk, emphasizing points, moving with the rhythm and energy of "
        "the voice, animated and lively rather than still or restrained. "
        "The head and neck move often and visibly — nodding, tilting, "
        "leaning in — with energetic, continuous motion throughout, "
        "clearly MORE movement and MORE facial expression than an "
        "ordinary conversation. Avoid a stiff, static, or motionless "
        "appearance; avoid a flat or neutral expression; avoid long "
        "pauses with no head or facial movement; avoid low energy at "
        "any point."
    ),
}

# Pre-v5 prompts (every project rendered under these before the v5 rewrite +
# dmd_lora_multiplier=0.1 fix). Kept for reference/rollback only, not used.
#
# AVATAR_MOTION_PROMPTS_PRE_V5: dict[str, str] = {
#     "subtle": (
#         "A real person calmly talking to the camera in a low-key, "
#         "understated way, not a performance. Precise lip movements that "
#         "match the audio, but the face otherwise stays mostly still,not extra head moving and "
#         "composed — a flat, even, almost neutral expression with only the "
#         "faintest changes, and the head and neck SHOULD NOT move much: "
#         "occasional blinking and the smallest natural settling, nothing "
#         "more.NO EXTRA EXAGGERATION OF FACIAL EXPRESSIONS. Clearly LESS movement and LESS facial expression than an "
#         "ordinary conversation, while still looking like a real, relaxed "
#         "person rather than a frozen photo. Avoid a stiff, static, robotic, "
#         "or uncanny appearance; avoid jerky, sudden, or repetitive motion; "
#         "avoid exaggerated or theatrical expressions; avoid any noticeable "
#         "emotional reaction in the face."
#     ),
#     "natural": (
#         "A real person casually talking to the camera in an ordinary, "
#         "unscripted way, like a normal video call or a candid clip, not a "
#         "performance. Clear lip movements that match the audio. The face is "
#         "ACTIVELY expressive at a moderate, everyday level — eyebrows raise "
#         "and shift, the mouth and cheeks visibly react as they speak, and "
#         "the head and neck move noticeably: nodding, tilting, and turning "
#         "along with the rhythm of the sentence, the way someone does in a "
#         "real conversation. This should read as clearly MORE animated than "
#         "someone sitting still, but not performative. Avoid a stiff, "
#         "frozen, robotic, or uncanny appearance; avoid holding the head "
#         "locked in place; avoid jerky, sudden, or repetitive motion; avoid "
#         "exaggerated or theatrical expressions."
#     ),
#     "expressive": (
#         "A person looking at the camera, speaking with strong, vivid, "
#         "highly animated delivery — like an enthusiastic presenter or "
#         "influencer directly engaging their audience. Lip movements and "
#         "facial expressions closely track the volume, pitch, and pacing of "
#         "the voice: eyebrows lift and furrow, eyes widen, the mouth and "
#         "cheeks move expressively on emphasized words. The head and neck "
#         "move often and visibly — nodding, tilting, leaning in — with "
#         "energetic, continuous motion throughout, clearly MORE movement and "
#         "MORE facial expression than an ordinary conversation. Avoid a "
#         "stiff, static, or motionless appearance; avoid a flat or neutral "
#         "expression; avoid long pauses with no head or facial movement."
#     ),
# }

# DMD distillation LoRA multiplier per style (see the v5 docstring above for
# why this has to be sent at all). "expressive" wants the LoRA at its normal
# full strength (1.0) since that's the style asking for maximal motion; the
# other two dial it down to 0.1 — the same value the v5 prompts above were
# validated against — so their prompts' calmer wording actually has an effect
# instead of being overridden by the LoRA's default full-strength motion.
AVATAR_MOTION_DMD_LORA_MULTIPLIER: dict[str, float] = {
    "subtle": 0.1,
    "natural": 0.1,
    "expressive": 1.0,
}

VALID_MOTION_STYLES: set[str] = set(AVATAR_MOTION_PROMPTS)


def normalize_motion_style(style: str | None) -> str:
    """Coerce an incoming motion-style id to a valid one, falling back to the
    default. Lenient by design — this runs at render time, where an invalid
    value should degrade to today's behavior rather than fail the render."""
    if style in AVATAR_MOTION_PROMPTS:
        return style
    return DEFAULT_MOTION_STYLE
