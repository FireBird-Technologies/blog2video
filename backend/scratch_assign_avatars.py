"""One-off script: assign 5 different avatar presets to project 1094's scenes,
generating + matting each, for the avatar_scene_examples task."""
from app.database import SessionLocal
from app.models.project import Project
from app.models.scene import Scene
from app.services.avatar import generate_scene_avatar_sync
from app.services.avatar_matte import matte_scene_avatar_sync

ASSIGNMENTS = [
    (8955, "woman_blueeyes"),  # order 1
    (8956, "woman_red"),       # order 2
    (8957, "man_beard"),       # order 3
    (8958, "woman_freckles"),  # order 4
    (8959, "man_denim"),       # order 5
]

db = SessionLocal()
project = db.query(Project).get(1094)
assert project is not None, "project 1094 not found"

for scene_id, preset in ASSIGNMENTS:
    print(f"=== scene {scene_id} -> {preset} ===", flush=True)
    err = generate_scene_avatar_sync(scene_id, 1094, preset)
    if err:
        print(f"scene {scene_id} avatar FAILED: {err}", flush=True)
        continue
    print(f"scene {scene_id} avatar OK, running matte...", flush=True)
    err = matte_scene_avatar_sync(scene_id, 1094)
    if err:
        print(f"scene {scene_id} matte FAILED: {err}", flush=True)
        continue
    scene = db.query(Scene).get(scene_id)
    scene.avatar_preset = preset
    scene.avatar_bg = "transparent"
    db.commit()
    print(f"scene {scene_id} DONE (preset={preset}, avatar_bg=transparent)", flush=True)

db.close()
print("ALL SCENES PROCESSED")
