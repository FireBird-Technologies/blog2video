"""UI catalog loader and action_id validation/hydration.

Loads ui_catalog.yaml at startup and provides:
- get_catalog(): all action entries
- hydrate(action_id): returns the catalog entry, or None if unknown
- page_matches(pattern, page_path): does a path match a pattern like "/projects/:id"
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

CATALOG_PATH = Path(__file__).parent / "ui_catalog.yaml"


@dataclass(frozen=True)
class CatalogStep:
    selector: str
    tooltip: str
    placement: str = "bottom"


@dataclass(frozen=True)
class CatalogAction:
    action_id: str
    label: str
    page_pattern: str
    steps: tuple[CatalogStep, ...]


_catalog: dict[str, CatalogAction] = {}


def load_catalog(path: Path = CATALOG_PATH) -> dict[str, CatalogAction]:
    global _catalog
    with path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or []
    out: dict[str, CatalogAction] = {}
    for entry in raw:
        action_id = entry["action_id"]
        steps = tuple(
            CatalogStep(
                selector=s["selector"],
                tooltip=s["tooltip"],
                placement=s.get("placement", "bottom"),
            )
            for s in entry.get("steps", [])
        )
        out[action_id] = CatalogAction(
            action_id=action_id,
            label=entry.get("label", action_id),
            page_pattern=entry.get("page_pattern", "*"),
            steps=steps,
        )
    _catalog = out
    logger.info("Loaded %d UI catalog actions from %s", len(out), path)
    return out


def get_catalog() -> dict[str, CatalogAction]:
    if not _catalog:
        load_catalog()
    return _catalog


def hydrate(action_id: str) -> Optional[CatalogAction]:
    return get_catalog().get(action_id)


def catalog_summary_for_prompt() -> str:
    """Compact catalog representation for the LLM prompt: only action_id + label + page_pattern."""
    lines = []
    for a in get_catalog().values():
        lines.append(f"- {a.action_id}: {a.label} (page: {a.page_pattern})")
    return "\n".join(lines)


def page_matches(pattern: str, page_path: Optional[str]) -> bool:
    if not page_path:
        return False
    if pattern == "*":
        return True
    # Convert patterns like "/projects/:id" → regex "/projects/[^/]+"
    regex = "^" + re.sub(r":\w+", r"[^/]+", pattern.rstrip("/")) + "/?$"
    return re.match(regex, page_path.rstrip("/")) is not None
