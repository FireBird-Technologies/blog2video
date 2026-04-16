import json
import re
from typing import Any


_TIME_LIKE_RE = re.compile(
    r"(^q[1-4](\s*\d{2,4})?$)"
    r"|(^\d{4}$)"
    r"|(^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$)"
    r"|(^\d{1,2}[/-]("
    r"jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|"
    r"jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?"
    r")([/-]\d{2,4})?$)"
    r"|(^((jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|"
    r"jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?)"
    r"\s+\d{1,2},?\s*\d{2,4})$)"
    r"|(^("
    r"jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|"
    r"jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?"
    r")[/-]\d{1,2}([/-]\d{2,4})?$)"
    r"|(^("
    r"jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|"
    r"jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?"
    r")(\b|[./-]\d{2,4}|\s+\d{2,4})$)",
    re.IGNORECASE,
)
_BUCKET_LIKE_RE = re.compile(r"(^\d+\s*[-–]\s*\d+$)|(^<\s*\d+$)|(^>\s*\d+$)|(^\d+\+$)")
_STRICT_NUMERIC_CELL_RE = re.compile(
    r"^\s*\(?\s*(?:[a-z]{1,6}\.?\s*)?[+\-]?"
    r"(?:\$|€|£|¥|₹)?\s*\d[\d,]*(?:\.\d+)?(?:[eE][+\-]?\d+)?"
    r"\s*(?:%|[a-z]{1,12}(?:/[a-z]{1,12})?)?\s*\)?\s*$",
    re.IGNORECASE,
)
_CURRENCY_HINT_RE = re.compile(r"(?:^|\b)(rs\.?|pkr|usd|eur|gbp|aed|sar|inr|\$|€|£|¥|₹)", re.IGNORECASE)
_SYNTH_HEADER_RE = re.compile(r"^col_\d+$", re.IGNORECASE)


def _looks_like_header_row(values: list[str]) -> bool:
    if not values:
        return False
    cleaned = [str(v or "").strip() for v in values]
    non_empty = [v for v in cleaned if v]
    if len(non_empty) < max(2, len(cleaned) // 2):
        return False
    numeric = sum(1 for v in non_empty if re.fullmatch(r"[-+]?\d+(\.\d+)?", v))
    return numeric <= max(1, len(non_empty) // 3)


def _parse_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    # Guardrail: only parse cells that are mostly numeric.
    # Reject mixed prose such as "minor bump, range-bound" or
    # multi-number phrases like "+15% initial, -15-18% decline".
    strict_match = bool(_STRICT_NUMERIC_CELL_RE.match(text))
    if not strict_match:
        # Safe fallback for common currency-like strings that strict regex can miss.
        # We only accept exactly one numeric token and a currency hint, to avoid
        # misparsing prose/date strings like "Apr 10, 26".
        if not _CURRENCY_HINT_RE.search(text):
            return None
        tokens = re.findall(r"[+\-]?\d[\d,]*(?:\.\d+)?(?:[eE][+\-]?\d+)?", text)
        if len(tokens) != 1:
            return None
        token = tokens[0].replace(",", "")
        if token in {"", "-", ".", "-."}:
            return None
        negative_by_parens = text.startswith("(") and text.endswith(")")
        try:
            n = float(token)
            return -abs(n) if negative_by_parens else n
        except ValueError:
            return None
    negative_by_parens = text.startswith("(") and text.endswith(")")
    token_match = re.search(r"[+\-]?\d[\d,]*(?:\.\d+)?(?:[eE][+\-]?\d+)?", text)
    if not token_match:
        return None
    token = token_match.group(0).replace(",", "")
    if token in {"", "-", ".", "-."}:
        return None
    try:
        n = float(token)
        return -abs(n) if negative_by_parens else n
    except ValueError:
        return None


def _tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 2}


def _are_series_labels_comparable(labels: list[str]) -> bool:
    if len(labels) < 2:
        return False
    stop = {"series", "value", "values", "data", "index"}
    token_sets = []
    for label in labels:
        toks = {t for t in _tokenize(label) if t not in stop}
        token_sets.append(toks)
    base = token_sets[0]
    if not base:
        return False
    for other in token_sets[1:]:
        if base & other:
            return True
    return False


def _extract_tables_from_visual_hint(visual_description: str) -> list[dict[str, Any]]:
    if not visual_description:
        return []
    m = re.search(r"TABLE_DATA_HINT_JSON:\s*(\{.*\})\s*$", visual_description, flags=re.DOTALL)
    if not m:
        return []
    try:
        payload = json.loads(m.group(1))
    except json.JSONDecodeError:
        return []
    tables = payload.get("tables") if isinstance(payload, dict) else None
    return tables if isinstance(tables, list) else []


def count_tables_in_visual_hint(visual_description: str) -> int:
    return len(_extract_tables_from_visual_hint(visual_description))


def get_tables_from_visual_hint(visual_description: str) -> list[dict[str, Any]]:
    return _extract_tables_from_visual_hint(visual_description)


def get_chartable_tables_from_visual_hint(
    visual_description: str,
) -> list[tuple[int, dict[str, Any]]]:
    """Return (original_index, table) pairs for tables that produce non-empty chart props."""
    tables = _extract_tables_from_visual_hint(visual_description)
    return [
        (i, t)
        for i, t in enumerate(tables)
        if isinstance(t, dict) and _build_chart_props_from_table(t)
    ]


def _score_table_for_scene(table: dict[str, Any], scene_text: str) -> float:
    headers = table.get("headers", []) or []
    rows = table.get("rows", []) or []
    if not headers or not rows:
        return -1.0

    scene_tokens = _tokenize(scene_text)
    if not scene_tokens:
        scene_tokens = set()

    header_tokens = _tokenize(" ".join(str(h) for h in headers))
    first_col_tokens = _tokenize(" ".join(str((r or [""])[0]) for r in rows if isinstance(r, list) and r))

    overlap = len(scene_tokens & header_tokens) * 2.0 + len(scene_tokens & first_col_tokens) * 3.0

    # Prefer tables with at least one numeric column and enough rows.
    numeric_cols = 0
    max_cols = max(len(r) for r in rows if isinstance(r, list))
    for c in range(max_cols):
        nums = 0
        for r in rows:
            if not isinstance(r, list) or c >= len(r):
                continue
            if _parse_number(r[c]) is not None:
                nums += 1
        if nums >= 2:
            numeric_cols += 1

    row_bonus = min(len(rows), 8) * 0.2
    numeric_bonus = numeric_cols * 1.5
    return overlap + row_bonus + numeric_bonus


def _is_time_like(values: list[str]) -> bool:
    if len(values) < 2:
        return False
    hits = sum(1 for v in values if _TIME_LIKE_RE.search((v or "").strip()))
    return hits >= max(2, len(values) // 2)


def _is_bucket_like(values: list[str]) -> bool:
    if len(values) < 3:
        return False
    hits = sum(1 for v in values if _BUCKET_LIKE_RE.search((v or "").strip()))
    return hits >= max(2, len(values) // 2)


def _build_chart_props_from_table(table: dict[str, Any]) -> dict[str, Any]:
    headers = [str(h or "").strip() for h in (table.get("headers", []) or [])]
    rows = [r for r in (table.get("rows", []) or []) if isinstance(r, list) and len(r) >= 2]
    if len(rows) < 2:
        return {}

    # Recover real header names if upstream provided placeholder headers.
    if headers and all(_SYNTH_HEADER_RE.fullmatch(h or "") for h in headers if h):
        first = [str(c or "").strip() for c in rows[0]] if rows else []
        if _looks_like_header_row(first):
            headers = first
            rows = rows[1:]
            if len(rows) < 2:
                return {}

    col_count = max(len(r) for r in rows)
    labels = [str(r[0] if len(r) > 0 else "").strip() or str(i + 1) for i, r in enumerate(rows)]

    numeric_columns: list[tuple[int, str, list[float]]] = []
    for c in range(1, col_count):
        values: list[float] = []
        missing = 0
        for r in rows:
            cell = r[c] if c < len(r) else ""
            n = _parse_number(cell)
            if n is None:
                missing += 1
                values.append(float("nan"))
            else:
                values.append(n)
        if sum(1 for x in values if x == x) >= 2:
            label = headers[c] if c < len(headers) and headers[c] else f"Series {c}"
            numeric_columns.append((c, label, values))

    if not numeric_columns:
        return {}

    time_like = _is_time_like(labels)
    bucket_like = _is_bucket_like(labels)

    chart_table = {
        "headers": headers[:8],
        "rows": [[str(cell or "") for cell in row[:8]] for row in rows[:20]],
    }

    # Prefer line charts for ordered/time-like rows; otherwise histogram for bucket labels; else bar.
    if time_like:
        first_series = [v for v in numeric_columns[0][2] if v == v]
        if len(first_series) >= 2:
            start = first_series[0]
            end = first_series[-1]
            delta = end - start
            pct = ((delta / start) * 100.0) if start else 0.0
            return {
                "chartType": "line",
                "chartTable": chart_table,
                "marketSymbol": numeric_columns[0][1],
                "marketValue": f"{end:g}",
                "marketDelta": f"{delta:+.2f}",
                "marketPercent": f"{pct:+.2f}%",
                "marketTrend": "up" if delta >= 0 else "down",
            }

    primary_label = numeric_columns[0][1]
    primary_values = numeric_columns[0][2]
    rows_out = []
    for i, value in enumerate(primary_values):
        if value != value:
            continue
        rows_out.append({"label": labels[i], "value": f"{value:g}"})
    rows_out = rows_out[:20]
    if len(rows_out) < 2:
        return {}

    if bucket_like and len(rows_out) >= 3:
        return {
            "chartType": "histogram",
            "chartTable": chart_table,
            "marketSymbol": primary_label,
        }

    start = _parse_number(rows_out[0]["value"]) or 0.0
    end = _parse_number(rows_out[-1]["value"]) or start
    delta = end - start
    pct = ((delta / start) * 100.0) if start else 0.0
    return {
        "chartType": "bar",
        "chartTable": chart_table,
        "marketSymbol": primary_label,
        "marketValue": f"{end:g}",
        "marketDelta": f"{delta:+.2f}",
        "marketPercent": f"{pct:+.2f}%",
        "marketTrend": "up" if delta >= 0 else "down",
    }


def generate_chart_props_from_table_hints(
    visual_description: str,
    scene_title: str = "",
    narration: str = "",
    preferred_table_index: int | None = None,
) -> dict[str, Any]:
    """
    Build graph-ready props from TABLE_DATA_HINT_JSON.

    Returns chart props suitable for `data_visualization` layout:
    - chartType
    - chartTable
    - optional market summary fields
    """
    tables = _extract_tables_from_visual_hint(visual_description)
    if not tables:
        return {}

    if (
        preferred_table_index is not None
        and isinstance(preferred_table_index, int)
        and 0 <= preferred_table_index < len(tables)
        and isinstance(tables[preferred_table_index], dict)
    ):
        best_table: dict[str, Any] | None = tables[preferred_table_index]
    else:
        scene_text = f"{scene_title}\n{narration}".strip()
        best_table = None
        best_score = float("-inf")
        for t in tables:
            if not isinstance(t, dict):
                continue
            score = _score_table_for_scene(t, scene_text)
            if score > best_score:
                best_score = score
                best_table = t

    if not best_table:
        return {}
    return _build_chart_props_from_table(best_table)
