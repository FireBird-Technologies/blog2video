"""Avatar motion-style prompts.

Project-wide, user-facing choice of how much the rendered presenter moves —
distinct from ``avatar_presets.py``, which picks WHO the presenter is. See
``Project.avatar_motion_style``.

"expressive" is the long-standing default: its prompt is byte-identical to the
former module-level ``DEFAULT_AVATAR_PROMPT`` in services/avatar.py, so an
unset/legacy project renders exactly as it always has.
"""
from __future__ import annotations

DEFAULT_MOTION_STYLE: str = "expressive"

AVATAR_MOTION_PROMPTS: dict[str, str] = {
    "subtle": (
        "A real person calmly talking to the camera in a low-key, "
        "understated way, not a performance. Precise lip movements that "
        "match the audio, but the face otherwise stays mostly still,not extra head moving and "
        "composed — a flat, even, almost neutral expression with only the "
        "faintest changes, and the head and neck SHOULD NOT move much: "
        "occasional blinking and the smallest natural settling, nothing "
        "more.NO EXTRA EXAGGERATION OF FACIAL EXPRESSIONS. Clearly LESS movement and LESS facial expression than an "
        "ordinary conversation, while still looking like a real, relaxed "
        "person rather than a frozen photo. Avoid a stiff, static, robotic, "
        "or uncanny appearance; avoid jerky, sudden, or repetitive motion; "
        "avoid exaggerated or theatrical expressions; avoid any noticeable "
        "emotional reaction in the face."
    ),
    "natural": (
        "A real person casually talking to the camera in an ordinary, "
        "unscripted way, like a normal video call or a candid clip, not a "
        "performance. Clear lip movements that match the audio. The face is "
        "ACTIVELY expressive at a moderate, everyday level — eyebrows raise "
        "and shift, the mouth and cheeks visibly react as they speak, and "
        "the head and neck move noticeably: nodding, tilting, and turning "
        "along with the rhythm of the sentence, the way someone does in a "
        "real conversation. This should read as clearly MORE animated than "
        "someone sitting still, but not performative. Avoid a stiff, "
        "frozen, robotic, or uncanny appearance; avoid holding the head "
        "locked in place; avoid jerky, sudden, or repetitive motion; avoid "
        "exaggerated or theatrical expressions."
    ),
    "expressive": (
        "A person looking at the camera, speaking with strong, vivid, "
        "highly animated delivery — like an enthusiastic presenter or "
        "influencer directly engaging their audience. Lip movements and "
        "facial expressions closely track the volume, pitch, and pacing of "
        "the voice: eyebrows lift and furrow, eyes widen, the mouth and "
        "cheeks move expressively on emphasized words. The head and neck "
        "move often and visibly — nodding, tilting, leaning in — with "
        "energetic, continuous motion throughout, clearly MORE movement and "
        "MORE facial expression than an ordinary conversation. Avoid a "
        "stiff, static, or motionless appearance; avoid a flat or neutral "
        "expression; avoid long pauses with no head or facial movement."
    ),
}

VALID_MOTION_STYLES: set[str] = set(AVATAR_MOTION_PROMPTS)


def normalize_motion_style(style: str | None) -> str:
    """Coerce an incoming motion-style id to a valid one, falling back to the
    default. Lenient by design — this runs at render time, where an invalid
    value should degrade to today's behavior rather than fail the render."""
    if style in AVATAR_MOTION_PROMPTS:
        return style
    return DEFAULT_MOTION_STYLE
