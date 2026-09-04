"""One-off script: matte the 5 already-generated avatar videos for project 1094,
then set avatar_preset + avatar_bg='transparent' per scene. Uses short-lived
sessions per operation to avoid holding one connection open across the whole run."""
from app.database import SessionLocal
from app.models.scene import Scene
from app.services.avatar_matte import matte_scene_avatar_sync

ASSIGNMENTS = [
    (8955, "woman_blueeyes"),
    (8956, "woman_red"),
    (8957, "man_beard"),
    (8958, "woman_freckles"),
    (8959, "man_denim"),
]

for scene_id, preset in ASSIGNMENTS:
    print(f"=== matte scene {scene_id} ({preset}) ===", flush=True)
    err = matte_scene_avatar_sync(scene_id, 1094)
    if err:
        print(f"scene {scene_id} matte FAILED: {err}", flush=True)
        continue
    db = SessionLocal()
    try:
        scene = db.get(Scene, scene_id)
        scene.avatar_preset = preset
        scene.avatar_bg = "transparent"
        db.commit()
        print(f"scene {scene_id} DONE (preset={preset}, avatar_bg=transparent)", flush=True)
    finally:
        db.close()

print("ALL SCENES MATTED")
