"""One-off script: render the full project 1094 video (all 5 scenes, each with
a different avatar composited in). Prints the output path on success."""
from app.database import SessionLocal
from app.models.project import Project
from app.models.scene import Scene
from app.services.remotion import write_remotion_data, render_video

db = SessionLocal()
try:
    project = db.query(Project).filter(Project.id == 1094).first()
    assert project is not None, "project 1094 not found"
    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == 1094, Scene.is_active == True)  # noqa: E712
        .order_by(Scene.order)
        .all()
    )
    print(f"rendering {len(scenes)} scenes for project 1094...", flush=True)
    write_remotion_data(project, scenes, db)
    print("data.json written, starting remotion render...", flush=True)
    output_path = render_video(project, resolution="1080p")
    print(f"RENDER OK: {output_path}", flush=True)
finally:
    db.close()
