import os
import json
import shutil
import subprocess
import signal
import re
import threading
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.project import Project, ProjectStatus
from app.models.scene import Scene

# Track running studio processes: project_id -> subprocess.Popen
_studio_processes: dict[int, subprocess.Popen] = {}
# Track running player processes: project_id -> subprocess.Popen
_player_processes: dict[int, subprocess.Popen] = {}

# Render progress tracker: project_id -> { progress, total_frames, rendered_frames, done, error }
_render_progress: dict[int, dict] = {}

# ─── Template files to copy into each workspace ──────────────

_TEMPLATE_CONFIG_FILES = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "remotion.config.ts",
    "vite.player.config.ts",
    "player.html",
]

_TEMPLATE_SRC_FILES = [
    "src/Root.tsx",
    "src/index.ts",
    "src/PlayerApp.tsx",
    "src/components/TextScene.tsx",
    "src/components/ImageScene.tsx",
    "src/components/Transitions.tsx",
]


# ─── Per-project workspace management ────────────────────────


def get_workspace_dir(project_id: int) -> str:
    """Return the per-project Remotion workspace path."""
    return os.path.join(
        settings.MEDIA_DIR, f"projects/{project_id}/remotion-workspace"
    )


def provision_workspace(project_id: int) -> str:
    """
    Create (or ensure) a per-project Remotion workspace.
    Copies config and template source files from the shared template.
    Creates a directory junction (Windows) or symlink (Unix) for node_modules.
    Returns the workspace path.
    """
    workspace = get_workspace_dir(project_id)
    template = settings.REMOTION_PROJECT_PATH

    os.makedirs(workspace, exist_ok=True)
    os.makedirs(os.path.join(workspace, "public"), exist_ok=True)
    os.makedirs(
        os.path.join(workspace, "src", "components", "generated"), exist_ok=True
    )

    # Link node_modules from template (junction on Windows, symlink on Unix)
    _link_directory(
        os.path.join(template, "node_modules"),
        os.path.join(workspace, "node_modules"),
    )

    # Copy config files
    for filename in _TEMPLATE_CONFIG_FILES:
        src = os.path.join(template, filename)
        dst = os.path.join(workspace, filename)
        if os.path.exists(src):
            shutil.copy2(src, dst)

    # Copy static template source files
    for rel_path in _TEMPLATE_SRC_FILES:
        src = os.path.join(template, rel_path)
        dst = os.path.join(workspace, rel_path)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)

    return workspace


def _link_directory(src: str, dst: str) -> None:
    """Create a directory junction (Windows) or symlink (Unix)."""
    if os.path.exists(dst) or os.path.islink(dst):
        return  # already linked
    if not os.path.exists(src):
        raise FileNotFoundError(
            f"Template node_modules not found at {src}. "
            f"Run 'npm install' in {os.path.dirname(src)} first."
        )

    src = os.path.abspath(src)
    dst = os.path.abspath(dst)

    if os.name == "nt":
        # Directory junction — no admin required on Windows
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", dst, src],
            check=True,
            capture_output=True,
        )
    else:
        os.symlink(src, dst, target_is_directory=True)


def safe_remove_workspace(workspace_dir: str) -> None:
    """
    Safely remove a workspace directory, unlinking the node_modules
    junction/symlink first so we don't delete the shared template's
    real node_modules.
    """
    if not os.path.exists(workspace_dir):
        return
    nm = os.path.join(workspace_dir, "node_modules")
    # Remove junction/symlink without following it
    if os.path.islink(nm):
        os.unlink(nm)
    elif os.path.isdir(nm):
        try:
            # os.rmdir removes a junction on Windows without following it
            os.rmdir(nm)
        except OSError:
            pass  # real dir with contents — rmtree will handle it
    shutil.rmtree(workspace_dir, ignore_errors=True)


def rebuild_workspace(project: Project, scenes: list[Scene], db: Session) -> str:
    """
    Fully rebuild a project's Remotion workspace from DB data.
    Can reconstruct at any time from stored scene code + assets.
    """
    workspace = provision_workspace(project.id)
    write_remotion_data(project, scenes, db)
    write_scene_components(project, scenes)
    return workspace


# ─── Write project files to workspace ────────────────────────


def write_remotion_data(project: Project, scenes: list[Scene], db: Session) -> str:
    """
    Write scene data and assets to the project's Remotion workspace public folder.
    Returns the path to data.json.
    """
    workspace = provision_workspace(project.id)
    public_dir = os.path.join(workspace, "public")
    os.makedirs(public_dir, exist_ok=True)

    # Collect and copy ALL images to public dir
    all_image_files = []
    for asset in project.assets:
        if asset.asset_type.value == "image" and os.path.exists(asset.local_path):
            dest = os.path.join(public_dir, asset.filename)
            _copy_file(asset.local_path, dest)
            all_image_files.append(asset.filename)

    # Identify hero image (first image asset = OG/hero from scraper)
    hero_image_file = all_image_files[0] if all_image_files else None

    # Distribute images across scenes (hero gets first, rest are round-robin)
    scene_image_map: dict[int, list[str]] = {i: [] for i in range(len(scenes))}
    if all_image_files:
        scene_image_map[0].append(all_image_files[0])
        remaining = all_image_files[1:]
        for idx, img_file in enumerate(remaining):
            scene_idx = idx % len(scenes)
            if img_file not in scene_image_map[scene_idx]:
                scene_image_map[scene_idx].append(img_file)

    # Build scene data
    scene_data = []
    for i, scene in enumerate(scenes):
        voiceover_filename = None
        if scene.voiceover_path and os.path.exists(scene.voiceover_path):
            voiceover_filename = f"audio_scene_{scene.order}.mp3"
            dest = os.path.join(public_dir, voiceover_filename)
            _copy_file(scene.voiceover_path, dest)

        scene_data.append(
            {
                "id": scene.id,
                "order": scene.order,
                "title": scene.title,
                "narration": scene.narration_text,
                "visualDescription": scene.visual_description,
                "durationSeconds": scene.duration_seconds,
                "voiceoverFile": voiceover_filename,
                "images": scene_image_map.get(i, []),
            }
        )

    data = {
        "projectName": project.name,
        "heroImage": hero_image_file,
        "scenes": scene_data,
    }
    data_path = os.path.join(public_dir, "data.json")
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return data_path


def write_scene_components(project: Project, scenes: list[Scene]) -> None:
    """
    Write individual Remotion scene component files from DB-stored code,
    plus regenerate ExplainerVideo.tsx for the workspace.
    """
    workspace = get_workspace_dir(project.id)
    components_dir = os.path.join(workspace, "src", "components", "generated")
    os.makedirs(components_dir, exist_ok=True)

    for scene in scenes:
        filename = f"Scene{scene.order}.tsx"
        filepath = os.path.join(components_dir, filename)

        code = scene.remotion_code if scene.remotion_code else _default_scene_component(scene)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(code)

    # Write an index file that exports all scenes
    index_path = os.path.join(components_dir, "index.ts")
    exports = []
    for scene in scenes:
        exports.append(
            f'export {{ default as Scene{scene.order} }} from "./Scene{scene.order}";'
        )
    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(exports) + "\n")

    # Regenerate ExplainerVideo.tsx
    _write_explainer_video(project, scenes)


# ─── Studio & Player ─────────────────────────────────────────


def launch_studio(project: Project, db: Session) -> int:
    """Launch Remotion Studio + Player preview from the project workspace."""
    stop_studio(project.id)

    workspace = get_workspace_dir(project.id)

    # ── Studio (full editing UI) ─────────────────────────
    studio_port = 3100 + (project.id % 100)
    npx = shutil.which("npx") or "npx"
    studio_cmd = [
        npx,
        "remotion",
        "studio",
        "--port",
        str(studio_port),
        "--no-open",
    ]

    studio_proc = subprocess.Popen(
        studio_cmd,
        cwd=workspace,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=(os.name == "nt"),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )
    _studio_processes[project.id] = studio_proc

    # ── Player preview (controls-only) ───────────────────
    player_port = 3200 + (project.id % 100)
    player_cmd = [
        npx,
        "vite",
        "--config",
        "vite.player.config.ts",
        "--port",
        str(player_port),
        "--strictPort",
    ]

    player_proc = subprocess.Popen(
        player_cmd,
        cwd=workspace,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=(os.name == "nt"),
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )
    _player_processes[project.id] = player_proc

    project.studio_port = studio_port
    project.player_port = player_port
    db.commit()

    return studio_port


def stop_studio(project_id: int) -> None:
    """Stop running Remotion Studio and Player subprocesses."""
    for store in (_studio_processes, _player_processes):
        process = store.pop(project_id, None)
        if process and process.poll() is None:
            try:
                if os.name == "nt":
                    process.terminate()
                else:
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            except (ProcessLookupError, OSError):
                pass


# ─── Render ───────────────────────────────────────────────────


def get_render_progress(project_id: int) -> dict:
    """Return the current render progress for a project."""
    return _render_progress.get(project_id, {})


def render_video(project: Project) -> str:
    """Render the video synchronously from the project workspace."""
    workspace = get_workspace_dir(project.id)
    output_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/output")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "video.mp4")

    npx = shutil.which("npx") or "npx"
    cmd = [npx, "remotion", "render", "ExplainerVideo", output_path]

    result = subprocess.run(
        cmd,
        cwd=workspace,
        shell=(os.name == "nt"),
        capture_output=True,
        text=True,
        timeout=600,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Remotion render failed: {result.stderr}")

    return output_path


def start_render_async(project: Project) -> None:
    """Kick off the Remotion render as a background subprocess with progress tracking."""
    workspace = get_workspace_dir(project.id)
    output_dir = os.path.join(settings.MEDIA_DIR, f"projects/{project.id}/output")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "video.mp4")

    npx = shutil.which("npx") or "npx"
    cmd = [npx, "remotion", "render", "ExplainerVideo", output_path]

    _render_progress[project.id] = {
        "progress": 0,
        "total_frames": 0,
        "rendered_frames": 0,
        "done": False,
        "error": None,
        "output_path": output_path,
        "time_remaining": None,
    }

    process = subprocess.Popen(
        cmd,
        cwd=workspace,
        shell=(os.name == "nt"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    )

    for stream in (process.stdout, process.stderr):
        t = threading.Thread(
            target=_read_render_stream,
            args=(project.id, stream),
            daemon=True,
        )
        t.start()

    threading.Thread(
        target=_wait_render, args=(project.id, process), daemon=True
    ).start()


# ─── Render stream parsing ────────────────────────────────────


def _read_render_stream(project_id: int, stream) -> None:
    """Read raw byte stream, splitting on \\r and \\n for Remotion progress."""
    frame_pat = re.compile(r"Rendered\s+(\d+)\s*/\s*(\d+)")
    time_pat = re.compile(r"time remaining:\s*(.+?)$")

    buf = b""
    try:
        while True:
            ch = stream.read(1)
            if not ch:
                break
            if ch in (b"\r", b"\n"):
                if buf:
                    _parse_render_line(
                        project_id,
                        buf.decode("utf-8", errors="replace"),
                        frame_pat,
                        time_pat,
                    )
                    buf = b""
            else:
                buf += ch
        if buf:
            _parse_render_line(
                project_id,
                buf.decode("utf-8", errors="replace"),
                frame_pat,
                time_pat,
            )
    except Exception:
        pass


def _parse_render_line(project_id: int, line: str, frame_pat, time_pat) -> None:
    """Parse a single line of Remotion render output for progress info."""
    line = line.strip()
    if not line:
        return

    m = frame_pat.search(line)
    if m:
        rendered = int(m.group(1))
        total = int(m.group(2))
        _render_progress[project_id]["rendered_frames"] = rendered
        _render_progress[project_id]["total_frames"] = total
        if total > 0:
            _render_progress[project_id]["progress"] = round(
                (rendered / total) * 100
            )
        tm = time_pat.search(line)
        if tm:
            _render_progress[project_id]["time_remaining"] = tm.group(1).strip()


def _wait_render(project_id: int, process: subprocess.Popen) -> None:
    """Wait for the render process to finish and update status."""
    import time

    try:
        while True:
            retcode = process.poll()
            if retcode is not None:
                break
            prog = _render_progress.get(project_id, {})
            total = prog.get("total_frames", 0)
            rendered = prog.get("rendered_frames", 0)
            if total > 0 and rendered >= total:
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.terminate()
                break
            time.sleep(0.5)

        retcode = (
            process.returncode if process.returncode is not None else process.poll()
        )

        if retcode is None or retcode == 0:
            _render_progress[project_id]["progress"] = 100
            _render_progress[project_id]["rendered_frames"] = _render_progress[
                project_id
            ].get("total_frames", 0)
            _render_progress[project_id]["done"] = True
        else:
            _render_progress[project_id]["error"] = (
                f"Render failed (exit code {retcode})"
            )
            _render_progress[project_id]["done"] = True
    except Exception as e:
        _render_progress[project_id]["error"] = str(e)
        _render_progress[project_id]["done"] = True


# ─── Internal helpers ─────────────────────────────────────────


def _write_explainer_video(project: Project, scenes: list[Scene]) -> None:
    """Regenerate ExplainerVideo.tsx in the project workspace."""
    workspace = get_workspace_dir(project.id)
    filepath = os.path.join(workspace, "src", "ExplainerVideo.tsx")

    scene_imports = []
    for scene in scenes:
        scene_imports.append(
            f'import Scene{scene.order} from "./components/generated/Scene{scene.order}";'
        )
    imports_block = "\n".join(scene_imports)

    scene_map_entries = []
    for scene in scenes:
        scene_map_entries.append(f"  {scene.order}: Scene{scene.order},")
    scene_map_block = "\n".join(scene_map_entries)

    code = f'''import {{ useEffect, useState }} from "react";
import {{
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  staticFile,
  interpolate,
  useCurrentFrame,
  CalculateMetadataFunction,
}} from "remotion";
import {{ TextScene }} from "./components/TextScene";
import {{ TransitionWipe }} from "./components/Transitions";

// ─── AI-generated scene components ───────────────────────────
{imports_block}

const SCENE_COMPONENTS: Record<number, React.FC<{{ title: string; narration: string; imageUrl?: string }}>> = {{
{scene_map_block}
}};

// ─── Types ───────────────────────────────────────────────────

interface SceneData {{
  id: number;
  order: number;
  title: string;
  narration: string;
  visualDescription: string;
  durationSeconds: number;
  voiceoverFile: string | null;
  images: string[];
}}

interface VideoData {{
  projectName: string;
  heroImage?: string | null;
  scenes: SceneData[];
}}

interface VideoProps {{
  dataUrl: string;
}}

// ─── Calculate actual duration from data.json ────────────────

export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> =
  async ({{ props }}) => {{
    const FPS = 30;
    try {{
      const url = staticFile(props.dataUrl.replace(/^\\//, ""));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${{url}}`);
      const data: VideoData = await res.json();

      const totalSeconds = data.scenes.reduce(
        (sum, s) => sum + (s.durationSeconds || 5),
        0
      );
      const totalFrames = Math.ceil((totalSeconds + 2) * FPS);

      return {{
        durationInFrames: Math.max(totalFrames, FPS * 5),
        fps: FPS,
        width: 1920,
        height: 1080,
      }};
    }} catch (e) {{
      console.warn("calculateVideoMetadata fallback:", e);
      return {{
        durationInFrames: FPS * 300,
        fps: FPS,
        width: 1920,
        height: 1080,
      }};
    }}
  }};

// ─── Main composition ────────────────────────────────────────

export const ExplainerVideo: React.FC<VideoProps> = ({{ dataUrl }}) => {{
  const [data, setData] = useState<VideoData | null>(null);

  useEffect(() => {{
    fetch(staticFile(dataUrl.replace(/^\\//, "")))
      .then((res) => res.json())
      .then(setData)
      .catch(() => {{
        setData({{
          projectName: "Blog2Video Preview",
          scenes: [
            {{
              id: 1,
              order: 1,
              title: "Welcome",
              narration: "This is a preview of your Blog2Video project.",
              visualDescription: "Title card",
              durationSeconds: 5,
              voiceoverFile: null,
              images: [],
            }},
          ],
        }});
      }});
  }}, [dataUrl]);

  if (!data) {{
    return (
      <AbsoluteFill
        style={{{{
          backgroundColor: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}}}
      >
        <p style={{{{ color: "white", fontSize: 36 }}}}>Loading...</p>
      </AbsoluteFill>
    );
  }}

  const FPS = 30;
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{{{ backgroundColor: "#0f172a" }}}}>
      {{data.scenes.map((scene, index) => {{
        const durationFrames = Math.round(scene.durationSeconds * FPS);
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        const GeneratedComponent = SCENE_COMPONENTS[scene.order] || TextScene;
        const hasImages = scene.images.length > 0;
        const imageUrl = hasImages ? staticFile(scene.images[0]) : undefined;

        return (
          <Sequence
            key={{scene.id}}
            from={{startFrame}}
            durationInFrames={{durationFrames}}
            name={{scene.title}}
          >
            <GeneratedComponent
              title={{scene.title}}
              narration={{scene.narration}}
              imageUrl={{imageUrl}}
            />

            {{/* Voiceover audio */}}
            {{scene.voiceoverFile && (
              <Audio src={{staticFile(scene.voiceoverFile)}} />
            )}}

            {{/* Transition overlay */}}
            {{index < data.scenes.length - 1 && (
              <Sequence
                from={{durationFrames - 15}}
                durationInFrames={{15}}
              >
                <TransitionWipe />
              </Sequence>
            )}}
          </Sequence>
        );
      }})}}
    </AbsoluteFill>
  );
}};
'''

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(code)


def _copy_file(src: str, dest: str) -> None:
    """Copy a file from src to dest."""
    if os.path.abspath(src) != os.path.abspath(dest):
        shutil.copy2(src, dest)


def _default_scene_component(scene: Scene) -> str:
    """Generate a default Remotion scene component."""
    if scene.order == 1:
        return f'''import {{ AbsoluteFill, Img, interpolate, useCurrentFrame }} from "remotion";

const Scene{scene.order}: React.FC<{{
  title: string;
  narration: string;
  imageUrl?: string;
}}> = ({{ imageUrl }}) => {{
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 40], [0, 1], {{ extrapolateRight: "clamp" }});
  const scale = interpolate(frame, [0, 60], [1.08, 1.0], {{ extrapolateRight: "clamp" }});

  return (
    <AbsoluteFill style={{{{ backgroundColor: "#0A0A0A" }}}}>
      {{imageUrl && (
        <Img
          src={{imageUrl}}
          style={{{{ width: "100%", height: "100%", objectFit: "cover", opacity, transform: `scale(${{scale}})` }}}}
        />
      )}}
    </AbsoluteFill>
  );
}};

export default Scene{scene.order};
'''
    else:
        return f'''import {{ AbsoluteFill, interpolate, useCurrentFrame }} from "remotion";

const ACCENT = "#7C3AED";

const Scene{scene.order}: React.FC<{{
  title: string;
  narration: string;
  imageUrl?: string;
}}> = ({{ title, narration }}) => {{
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 25], [0, 1], {{ extrapolateRight: "clamp" }});
  const textOpacity = interpolate(frame, [12, 35], [0, 1], {{ extrapolateRight: "clamp" }});
  const textY = interpolate(frame, [12, 35], [20, 0], {{ extrapolateRight: "clamp" }});
  const barWidth = interpolate(frame, [5, 25], [0, 120], {{ extrapolateRight: "clamp" }});
  const circleScale = interpolate(frame, [0, 35], [0, 1], {{ extrapolateRight: "clamp" }});

  return (
    <AbsoluteFill style={{{{ backgroundColor: "#FFFFFF", padding: "80px 120px", display: "flex", flexDirection: "column", justifyContent: "center" }}}}>
      {{/* Geometric shapes */}}
      <div style={{{{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", border: `2px solid ${{ACCENT}}20`, transform: `scale(${{circleScale}})` }}}} />
      <div style={{{{ position: "absolute", top: 80, left: 120, width: barWidth, height: 4, backgroundColor: ACCENT, borderRadius: 2 }}}} />
      <div style={{{{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 5, backgroundColor: ACCENT }}}} />

      <div style={{{{ position: "relative", zIndex: 1, maxWidth: 1100 }}}}>
        <h1 style={{{{ color: "#0A0A0A", fontSize: 54, fontWeight: 700, opacity: titleOpacity, marginBottom: 24, fontFamily: "Inter, sans-serif", lineHeight: 1.2 }}}}>
          {{title}}
        </h1>
        <div style={{{{ width: 50, height: 4, backgroundColor: ACCENT, borderRadius: 2, marginBottom: 24 }}}} />
        <p style={{{{ color: "#404040", fontSize: 27, lineHeight: 1.8, opacity: textOpacity, transform: `translateY(${{textY}}px)`, maxWidth: 950, fontFamily: "Inter, sans-serif" }}}}>
          {{narration}}
        </p>
      </div>
    </AbsoluteFill>
  );
}};

export default Scene{scene.order};
'''
