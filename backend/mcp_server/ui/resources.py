"""Loader for bundled MCP-UI views.

The Vite project at ``ui_src/`` produces self-contained single-file HTML
artifacts (one per view) and writes them into this package's ``views/``
directory. Tool handlers call :func:`load_html` to get the HTML string
they pass to :func:`mcp_ui_server.create_ui_resource`.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

VIEWS_DIR = Path(__file__).parent / "views"

# Registered view names → filename in ``views/``. Add a new entry whenever
# we ship a new UI bundle (Phase B will add theme_review, render_progress,
# voice_picker here).
UI_RESOURCES: dict[str, str] = {
    "template_gallery": "template_gallery.html",
    "voice_gallery": "voice_gallery.html",
    "setup_gallery": "setup_gallery.html",
}


@lru_cache(maxsize=None)
def load_html(name: str) -> str:
    """Read the bundled HTML for *name*. Cached after first read.

    Raises:
        KeyError: name not registered.
        FileNotFoundError: bundle missing (run ``npm run build`` in
            ``backend/mcp_server/ui_src/``).
    """
    if name not in UI_RESOURCES:
        raise KeyError(
            f"Unknown UI resource {name!r}. "
            f"Known: {sorted(UI_RESOURCES)}"
        )
    path = VIEWS_DIR / UI_RESOURCES[name]
    if not path.exists():
        raise FileNotFoundError(
            f"Bundled view {path} not found. "
            f"Build it: cd backend/mcp_server/ui_src && npm run build"
        )
    return path.read_text(encoding="utf-8")
