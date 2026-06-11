import json
import re
from typing import Any

from bs4 import BeautifulSoup
from app.services.chart_planner import compute_ohlcv_chart_analysis, is_candlestick_table


TABLE_SECTION_MARKER = "EXTRACTED_TABLES_JSON"
MAX_TABLES = 8
MAX_ROWS_PER_TABLE = 20
MAX_COLS_PER_TABLE = 8
MAX_CELL_CHARS = 120
_SYNTH_HEADER_RE = re.compile(r"^col_\d+$", re.IGNORECASE)
_OHLCV_REQUIRED = frozenset({"open", "high", "low", "close"})


def _looks_like_header_row(row: list[str]) -> bool:
    if not row:
        return False
    non_empty = [str(c or "").strip() for c in row if str(c or "").strip()]
    if len(non_empty) < max(2, len(row) // 2):
        return False
    numeric = sum(1 for c in non_empty if re.fullmatch(r"[-+]?\d+(\.\d+)?", c))
    return numeric <= max(1, len(non_empty) // 3)


def _clean_cell(value: Any) -> str:
    text = str(value or "").strip()
    # Strip inline HTML tags (e.g. "Rs.<br> 434,000" → "Rs. 434,000") that survive
    # markdown/HTML scraping; otherwise they leak into chart labels and data tables.
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    if len(text) > MAX_CELL_CHARS:
        return text[:MAX_CELL_CHARS].rstrip() + "..."
    return text


def _normalize_table(headers: list[str], rows: list[list[str]], source: str) -> dict[str, Any] | None:
    header_set = {h.lower() for h in headers if h}
    row_cap = 60 if _OHLCV_REQUIRED.issubset(header_set) else MAX_ROWS_PER_TABLE
    clean_rows: list[list[str]] = []
    for row in rows[:row_cap]:
        cells = [_clean_cell(cell) for cell in row[:MAX_COLS_PER_TABLE]]
        if any(cells):
            clean_rows.append(cells)

    if len(clean_rows) < 2:
        return None

    clean_headers = [_clean_cell(h) for h in headers[:MAX_COLS_PER_TABLE]]
    has_meaningful_headers = any(clean_headers) and not all(
        _SYNTH_HEADER_RE.fullmatch(h or "") for h in clean_headers if h
    )

    if not has_meaningful_headers and clean_rows:
        # If headers are missing/placeholder-like, promote first row as headers
        # when it looks like an actual header row from source content.
        candidate = clean_rows[0]
        if _looks_like_header_row(candidate):
            clean_headers = candidate[:MAX_COLS_PER_TABLE]
            clean_rows = clean_rows[1:]

    if not any(clean_headers):
        # Last-resort fallback for truly headerless tables.
        col_count = max(len(r) for r in clean_rows)
        clean_headers = [f"Series {i + 1}" for i in range(col_count)]

    if len(clean_rows) < 2:
        return None

    return {
        "source": source,
        "headers": clean_headers,
        "rows": clean_rows,
    }


def _parse_html_table(table_tag) -> tuple[list[str], list[list[str]]]:
    rows: list[list[str]] = []
    header_cells: list[str] = []

    tr_nodes = table_tag.find_all("tr")
    for tr in tr_nodes:
        th_cells = tr.find_all("th")
        td_cells = tr.find_all("td")
        if th_cells and not rows and not header_cells:
            header_cells = [_clean_cell(c.get_text(" ", strip=True)) for c in th_cells]
            continue
        cells = th_cells or td_cells
        if not cells:
            continue
        rows.append([_clean_cell(c.get_text(" ", strip=True)) for c in cells])

    if not header_cells and rows:
        # If first row looks like a header, treat it as header.
        first = rows[0]
        if all(cell and not re.fullmatch(r"[-+]?\d+(\.\d+)?", cell) for cell in first):
            header_cells = first
            rows = rows[1:]

    return header_cells, rows


def extract_tables_from_html(html: str, source: str) -> list[dict[str, Any]]:
    if not html or "<table" not in html.lower():
        return []
    soup = BeautifulSoup(html, "lxml")
    out: list[dict[str, Any]] = []
    for table_tag in soup.find_all("table"):
        headers, rows = _parse_html_table(table_tag)
        normalized = _normalize_table(headers, rows, source=source)
        if normalized:
            out.append(normalized)
        if len(out) >= MAX_TABLES:
            break
    return out


def extract_tables_from_markdown(markdown_text: str, source: str) -> list[dict[str, Any]]:
    if not markdown_text:
        return []

    lines = markdown_text.splitlines()
    tables: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "|" not in line:
            i += 1
            continue

        # Candidate markdown header + separator.
        if i + 1 >= len(lines):
            i += 1
            continue

        sep = lines[i + 1].strip()
        if "|" not in sep or not re.fullmatch(r"\|?[\s:\-|\t]+\|?", sep):
            i += 1
            continue

        header_parts = [p.strip() for p in line.strip("|").split("|")]
        rows: list[list[str]] = []
        j = i + 2
        while j < len(lines):
            row_line = lines[j].strip()
            if "|" not in row_line or row_line.startswith("#") or not row_line:
                break
            row_parts = [p.strip() for p in row_line.strip("|").split("|")]
            rows.append(row_parts)
            j += 1

        normalized = _normalize_table(header_parts, rows, source=source)
        if normalized:
            tables.append(normalized)
        if len(tables) >= MAX_TABLES:
            break
        i = j

    return tables


def append_tables_to_content(content: str, tables: list[dict[str, Any]]) -> str:
    if not tables:
        return content

    clipped = tables[:MAX_TABLES]
    payload = json.dumps({"tables": clipped}, ensure_ascii=False, separators=(",", ":"))
    block = (
        f"\n\n═══ {TABLE_SECTION_MARKER} ═══\n"
        f"{payload}\n"
        f"═══ END_{TABLE_SECTION_MARKER} ═══"
    )
    return (content or "").rstrip() + block


def _dedup_tables(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate tables that share the same header fingerprint.

    When duplicates exist (e.g. firecrawl_html + firecrawl_markdown scraped the
    same table), keep the copy with the most complete data, preferring
    firecrawl_markdown over firecrawl_html as a tiebreaker.
    """
    def _cell_count(tbl: dict) -> int:
        return sum(
            1
            for r in (tbl.get("rows") or [])
            if isinstance(r, list)
            for c in r
            if str(c or "").strip()
        )

    seen: dict[str, dict[str, Any]] = {}
    for t in tables:
        if not isinstance(t, dict):
            continue
        headers = t.get("headers") or []
        key = "|".join(str(h).strip().lower() for h in headers)
        if not key:
            continue
        if key not in seen:
            seen[key] = t
        else:
            existing = seen[key]
            existing_is_md = (existing.get("source") or "").startswith("firecrawl_markdown")
            new_is_md = (t.get("source") or "").startswith("firecrawl_markdown")
            if new_is_md and not existing_is_md:
                seen[key] = t
            elif new_is_md == existing_is_md and _cell_count(t) > _cell_count(existing):
                seen[key] = t
    return list(seen.values())


def extract_tables_from_content(content: str) -> list[dict[str, Any]]:
    if not content:
        return []
    pattern = (
        rf"═══ {TABLE_SECTION_MARKER} ═══\s*(\{{.*\}})\s*"
        rf"═══ END_{TABLE_SECTION_MARKER} ═══"
    )
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        return []
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []
    tables = payload.get("tables") if isinstance(payload, dict) else None
    tables = tables if isinstance(tables, list) else []
    return _dedup_tables(tables)


def build_table_context_hint(
    tables: list[dict[str, Any]],
    max_tables: int = 2,
    max_rows: int = 8,
) -> str:
    if not tables:
        return ""
    clipped = []
    for table in tables[:max_tables]:
        if not isinstance(table, dict):
            continue
        clipped.append(
            {
                "source": table.get("source"),
                "headers": table.get("headers", []),
                "rows": (table.get("rows", []) or [])[:max_rows],
            }
        )
    if not clipped:
        return ""
    return (
        "TABLE_DATA_HINT_JSON:\n"
        + json.dumps({"tables": clipped}, ensure_ascii=False, separators=(",", ":"))
    )


def build_chartable_tables_payload(
    chartable_tables: list[tuple[int, dict[str, Any]]],
    chart_type_by_index: dict[int, str] | None = None,
    preferred_layout_by_index: dict[int, str] | None = None,
    max_rows: int = 8,
) -> str:
    """Serialize table bindings for the BlogToScript LLM prompt.

    Each entry includes the original table index, headers, sample rows, source,
    inferred chartType, and an optional preferred_layout so the LLM knows which
    layout to emit for the scene (e.g. "terminal_chart", "terminal_table",
    "data_visualization").  Returns empty string when there are no tables.
    """
    if not chartable_tables:
        return ""
    entries = []
    for orig_idx, table in chartable_tables:
        if not isinstance(table, dict):
            continue
        chart_type = (chart_type_by_index or {}).get(orig_idx, "auto")
        entry: dict[str, Any] = {
            "index": orig_idx,
            "chartType": chart_type,
            "source": table.get("source"),
            "headers": table.get("headers", []),
            "rows": (table.get("rows", []) or [])[:max_rows],
        }
        pl = (preferred_layout_by_index or {}).get(orig_idx)
        if pl:
            entry["preferred_layout"] = pl
        if is_candlestick_table(table):
            analysis = compute_ohlcv_chart_analysis(table)
            if analysis.get("summary"):
                entry["chart_analysis"] = analysis
        entries.append(entry)
    if not entries:
        return ""
    return json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
