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
    r")(\b|[./-]\d{2,4}|\s+\d{2,4})$)"
    # "1 Jun", "5 June 2026", "11 Jun, 26" — day SPACE month (optional year)
    r"|(^\d{1,2}\s+("
    r"jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|"
    r"jul(y)?|aug(ust)?|sep(t|tember)?|oct(ober)?|nov(ember)?|dec(ember)?"
    r")(,?\s*\d{2,4})?$)"
    # weekday names ("Mon", "Tuesday") — daily series
    r"|(^(mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)$)"
    # "Week 1" / "Day 3" / "Wk 12" ordinal periods
    r"|(^(week|wk|day)\s*\d+$)"
    # fiscal years ("FY24", "FY 2025") and half-years ("H1", "H2 2025")
    r"|(^fy\s*'?\d{2,4}$)"
    r"|(^h[1-2](\s*\d{2,4})?$)"
    # year ranges ("2023-24", "2023/2024")
    r"|(^\d{4}\s*[-–/]\s*\d{2,4}$)",
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
    # Strip HTML tags (e.g. "Rs.<br> 484,500" → "Rs. 484,500")
    text = re.sub(r"<[^>]+>", " ", text).strip()
    # Collapse any whitespace left by tag removal
    text = re.sub(r"\s{2,}", " ", text).strip()
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


def _clean_text_cell(value: Any) -> str:
    """Strip inline HTML tags + collapse whitespace from a display cell.

    The chartTable bound to a scene is rendered verbatim (especially by the
    data_table layout), so leftover tags like "Rs.<br> 434,000" must be removed.
    Tables read straight from EXTRACTED_TABLES_JSON bypass table_extraction's own
    cleaner, so we re-clean here at the point the chartTable is built.
    """
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()



def _extract_tables_from_visual_hint(visual_description: str) -> list[dict[str, Any]]:
    if not visual_description:
        return []
    m = re.search(
        r"(?:TABLE_DATA_HINT_JSON\s*:\s*|[═=]{2,}\s*EXTRACTED_TABLES_JSON\s*[═=]{2,}\s*)(\{.*\})"
        r"(?:\s*[═=]{2,}\s*END_EXTRACTED_TABLES_JSON\s*[═=]{2,})?",
        visual_description,
        flags=re.DOTALL,
    )
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


def get_line_chartable_tables_from_visual_hint(
    visual_description: str,
) -> list[tuple[int, dict[str, Any]]]:
    """Return (original_index, table) pairs for tables that produce a line chart."""
    tables = _extract_tables_from_visual_hint(visual_description)
    result = []
    for i, t in enumerate(tables):
        if not isinstance(t, dict):
            continue
        props = _build_chart_props_from_table(t)
        if props.get("chartType") == "line":
            result.append((i, t))
    return result


_CANDLESTICK_REQUIRED = {"open", "high", "low", "close"}
_CANDLESTICK_DATE_KEYWORDS = {"date", "time", "period", "week", "month", "year", "day", "quarter"}


def is_candlestick_table(table: dict[str, Any]) -> bool:
    """Return True if the table has OHLCV columns AND a date/time axis column.

    A multi-symbol snapshot (e.g. SYMBOL | OPEN | HIGH | LOW | CLOSE) has the
    OHLC columns but no time axis — it should be a terminal_table, not terminal_chart.
    """
    headers = [str(h or "").strip().lower() for h in (table.get("headers", []) or [])]
    found = set()
    has_date_col = False
    for h in headers:
        for r in _CANDLESTICK_REQUIRED:
            if r in h:
                found.add(r)
        if any(kw in h for kw in _CANDLESTICK_DATE_KEYWORDS):
            has_date_col = True
    return _CANDLESTICK_REQUIRED.issubset(found) and has_date_col


def has_candlestick_table_in_visual_hint(visual_description: str) -> bool:
    """Return True if any table in the visual hint looks like OHLCV data."""
    tables = _extract_tables_from_visual_hint(visual_description)
    return any(is_candlestick_table(t) for t in tables if isinstance(t, dict))


def _parse_volume_to_billions(raw: str) -> float:
    s = str(raw or "").replace("$", "").replace(",", "").strip()
    multiplier = 1.0
    if s.upper().endswith("B"):
        s = s[:-1]
    elif s.upper().endswith("M"):
        s, multiplier = s[:-1], 0.001
    elif s.upper().endswith("K"):
        s, multiplier = s[:-1], 0.000001
    try:
        return float(s) * multiplier
    except ValueError:
        return 0.0


def generate_terminal_chart_candlestick_items(table: dict[str, Any], max_items: int = 60) -> list[str]:
    """Format an OHLCV table as candlestick items for TerminalChart.

    Each item: "<date_label>|<open>|<high>|<low>|<close>|<vol_billions>"
    """
    headers = [str(h or "").strip().lower() for h in (table.get("headers", []) or [])]
    rows = [r for r in (table.get("rows", []) or []) if isinstance(r, list)]
    if not rows:
        return []

    def _find_col(*keywords: str) -> int | None:
        for kw in keywords:
            for i, h in enumerate(headers):
                if kw in h:
                    return i
        return None

    date_col = _find_col("date start", "date") or 0
    open_col = _find_col("open")
    high_col = _find_col("high")
    low_col = _find_col("low")
    close_col = _find_col("close")
    vol_col = _find_col("volume")

    if None in (open_col, high_col, low_col, close_col):
        return []

    items = []
    for row in rows[:max_items]:
        label = str(row[date_col] if date_col < len(row) else "").strip()
        label = label.split(",")[0].strip()  # "Mar 21, 2026" → "Mar 21"

        o = _parse_number(row[open_col] if open_col < len(row) else "")
        h = _parse_number(row[high_col] if high_col < len(row) else "")
        l = _parse_number(row[low_col] if low_col < len(row) else "")
        c = _parse_number(row[close_col] if close_col < len(row) else "")

        if None in (o, h, l, c):
            continue

        vol = 0.0
        if vol_col is not None and vol_col < len(row):
            vol = _parse_volume_to_billions(row[vol_col])

        items.append(f"{label}|{o:.2f}|{h:.2f}|{l:.2f}|{c:.2f}|{vol:.2f}")

    return items


def compute_ohlcv_chart_analysis(table: dict[str, Any]) -> dict[str, str]:
    """Derive plain-English chart analysis from an OHLCV table.

    Returns a dict with keys: verdict, trend, momentum, biggest_move,
    range_position, volatility, summary.  All values are human-readable
    sentences suitable for direct inclusion in narration prompts.
    """
    headers = [str(h or "").strip().lower() for h in (table.get("headers", []) or [])]
    rows = [r for r in (table.get("rows", []) or []) if isinstance(r, list)]
    if not rows:
        return {}

    def _find_col(*kws: str) -> int | None:
        for kw in kws:
            for i, h in enumerate(headers):
                if kw in h:
                    return i
        return None

    close_col = _find_col("close")
    open_col = _find_col("open")
    high_col = _find_col("high")
    low_col = _find_col("low")
    date_col = _find_col("date") or 0

    if None in (close_col, open_col, high_col, low_col):
        return {}

    def _pn(row: list, col: int | None) -> float | None:
        if col is None or col >= len(row):
            return None
        return _parse_number(row[col])

    candles: list[dict] = []
    for row in rows:
        o = _pn(row, open_col)
        h = _pn(row, high_col)
        l = _pn(row, low_col)
        c = _pn(row, close_col)
        if None in (o, h, l, c):
            continue
        label = str(row[date_col] if date_col < len(row) else "").strip().split(",")[0]
        candles.append({"o": o, "h": h, "l": l, "c": c, "label": label})

    n = len(candles)
    if n < 2:
        return {}

    closes = [k["c"] for k in candles]
    highs = [k["h"] for k in candles]
    lows = [k["l"] for k in candles]
    p_max = max(highs)
    p_min = min(lows)
    p_range = max(p_max - p_min, 0.001)
    first_close = closes[0]
    last_close = closes[-1]

    # 1. Overall trend
    pct_change = ((last_close - first_close) / max(abs(first_close), 0.001)) * 100
    direction = "up" if pct_change >= 0 else "down"
    verdict = (
        "BULLISH TREND" if pct_change > 5
        else "BEARISH DECLINE" if pct_change < -5
        else "CONSOLIDATING"
    )
    trend = (
        f"{direction.capitalize()} {abs(pct_change):.1f}% over {n} trading periods "
        f"(from {first_close:.2f} to {last_close:.2f})"
    )

    # 2. Recent momentum (last ~12% of bars, min 3)
    recent_window = max(3, int(n * 0.12))
    recent_closes = closes[-recent_window:]
    recent_delta = recent_closes[-1] - recent_closes[0]
    recent_pct = (recent_delta / max(abs(recent_closes[0]), 0.001)) * 100
    recent_label = candles[-recent_window]["label"] or f"{recent_window} periods ago"
    if abs(recent_pct) < 0.4:
        momentum = f"Price has been flat since {recent_label} — no clear short-term direction"
    elif recent_pct > 0 and pct_change > 0:
        momentum = f"Accelerating — gained another {recent_pct:.1f}% since {recent_label}, building on the uptrend"
    elif recent_pct > 0 and pct_change <= 0:
        momentum = f"Recovering — up {recent_pct:.1f}% since {recent_label} after the broader decline"
    elif pct_change > 0:
        momentum = f"Stalling — down {abs(recent_pct):.1f}% since {recent_label} despite the overall uptrend"
    else:
        momentum = f"Still under pressure — fell another {abs(recent_pct):.1f}% since {recent_label}"

    # 3. Biggest single-bar move
    body_pcts = [((k["c"] - k["o"]) / max(abs(k["o"]), 0.001)) * 100 for k in candles]
    biggest_i = max(range(n), key=lambda i: abs(body_pcts[i]))
    biggest_pct = body_pcts[biggest_i]
    biggest_label = candles[biggest_i]["label"] or f"bar {biggest_i + 1}"
    sign = "+" if biggest_pct >= 0 else ""
    move_type = "surge" if biggest_pct >= 0 else "selloff"
    biggest_move = (
        f"Biggest single-period move: {sign}{biggest_pct:.1f}% on {biggest_label} "
        f"— a sharp {move_type} that stands out in this period"
    )

    # 4. Where price sits vs. the period range
    pos_in_range = (last_close - p_min) / p_range
    if pos_in_range > 0.75:
        range_position = (
            f"Currently near its {n}-period high of {p_max:.2f} "
            f"— buyers remain in control"
        )
    elif pos_in_range < 0.25:
        range_position = (
            f"Sitting close to its {n}-period low of {p_min:.2f} "
            f"— sellers have dominated this stretch"
        )
    else:
        range_position = (
            f"Trading mid-range between {p_min:.2f} and {p_max:.2f} "
            f"— no decisive winner yet between buyers and sellers"
        )

    # 5. Volatility — average daily range as % of close
    avg_daily_range = sum((k["h"] - k["l"]) / max(k["c"], 0.001) for k in candles) / n * 100
    if avg_daily_range < 1.5:
        volatility = f"Low volatility period — average daily swing of {avg_daily_range:.1f}%, tight and orderly"
    elif avg_daily_range > 3.5:
        volatility = (
            f"Highly volatile — average daily swing of {avg_daily_range:.1f}%, "
            f"expect large intraday moves in either direction"
        )
    else:
        volatility = f"Moderate volatility — average daily swing of {avg_daily_range:.1f}%"

    summary = (
        f"Chart verdict: {verdict}. "
        f"{trend}. {momentum}. {biggest_move}. "
        f"{range_position}. {volatility}."
    )

    return {
        "verdict": verdict,
        "trend": trend,
        "momentum": momentum,
        "biggest_move": biggest_move,
        "range_position": range_position,
        "volatility": volatility,
        "summary": summary,
    }


def generate_terminal_chart_items(table: dict[str, Any], max_items: int = 8) -> list[str]:
    """Format a time-series table as items strings for the TerminalChart layout.

    Produces "{label}: {value}" per row using the first column as the label and the
    first numeric column as the value.  The Remotion component extracts numbers from
    these strings to drive the synthetic candlestick chart.
    """
    rows = [r for r in (table.get("rows", []) or []) if isinstance(r, list) and len(r) >= 2]
    if len(rows) < 2:
        return []

    # Find first numeric column (skip column 0 which is the label)
    col_count = max(len(r) for r in rows)
    numeric_col = None
    for c in range(1, col_count):
        if sum(1 for r in rows if _parse_number(r[c] if c < len(r) else "") is not None) >= 2:
            numeric_col = c
            break
    if numeric_col is None:
        return []

    items = []
    for r in rows[:max_items]:
        label = str(r[0] if r else "").strip()
        raw_val = r[numeric_col] if numeric_col < len(r) else ""
        num = _parse_number(raw_val)
        if num is None:
            continue
        val_str = f"{num:g}"
        items.append(f"{label}: {val_str}" if label else val_str)

    return items


def is_ticker_snapshot_table(table: dict[str, Any]) -> bool:
    """True if the table is a multi-symbol market snapshot (symbol column + % change column).

    These should be rendered as terminal_ticker, not terminal_table.
    """
    headers = [str(h or "").strip().lower() for h in (table.get("headers", []) or [])]
    has_symbol = any(kw in h for h in headers for kw in ("symbol", "ticker", "scrip"))
    has_pct = any("%" in h for h in headers)
    return has_symbol and has_pct


# Keywords that strongly identify a ticker/snapshot table (entity name column).
_LADUC_TICKER_NAME_KEYWORDS = ("name", "symbol", "ticker", "scrip", "stock", "asset", "fund", "etf", "company")
# Keywords that identify value/movement columns.
_LADUC_TICKER_VALUE_KEYWORDS = ("price", "cost", "value", "share", "close", "last", "bid", "ask")
# "change" or "%" alone isn't enough — they also appear in plain time-series tables
# (e.g. "% Change YoY"). They qualify only when combined with a name column.
_LADUC_TICKER_CHANGE_KEYWORDS = ("change", "%", "return", "gain", "loss", "delta", "chg")


def is_laduc_ticker_table(table: dict[str, Any]) -> bool:
    """True if a table looks like a LaDuc ticker/snapshot layout.

    Two paths to qualify:
    1. Has a name/entity column + at least one value or change column.
    2. Any header contains the word "change" AND the table has >=3 columns
       (multi-column tables with a change column are snapshot-style, not
       a simple two-column time-series with a single "% Change" column).
    """
    headers = [str(h or "").strip().lower() for h in (table.get("headers", []) or [])]
    if not headers:
        return False
    # Path 1: name column + value/change column
    has_name = any(kw in h for h in headers for kw in _LADUC_TICKER_NAME_KEYWORDS)
    has_value = any(kw in h for h in headers for kw in _LADUC_TICKER_VALUE_KEYWORDS)
    has_change = any(kw in h for h in headers for kw in _LADUC_TICKER_CHANGE_KEYWORDS)
    if has_name and (has_value or has_change):
        return True
    # Path 2: "change" in any header + multi-column table (>=3 cols)
    has_change_word = any("change" in h for h in headers)
    if has_change_word and len(headers) >= 3:
        return True
    return False


def generate_terminal_ticker_items(table: dict[str, Any], max_items: int = 10) -> list[str]:
    """Convert a multi-symbol snapshot table to terminal ticker item strings.

    Detects SYMBOL, PRICE (close > ldcp > last > price), and CHANGE(%) columns by
    header keywords. Returns empty list if required columns are not found.
    Output format per item: "SYMBOL  +X.XX%  PRICE"
    """
    headers = [str(h or "").strip().lower() for h in (table.get("headers", []) or [])]
    rows = [r for r in (table.get("rows", []) or []) if isinstance(r, list)]
    if not headers or not rows:
        return []

    def _find(keywords: list[str]) -> int | None:
        for kw in keywords:
            for i, h in enumerate(headers):
                if kw in h:
                    return i
        return None

    sym_col = _find(["symbol", "ticker", "scrip"])
    pct_col = _find(["%"])
    # Prefer close over ldcp for the displayed price
    price_col = _find(["close", "last", "price", "ldcp"])

    if sym_col is None or pct_col is None:
        return []

    items = []
    for row in rows[:max_items]:
        sym = str(row[sym_col] if sym_col < len(row) else "").strip()
        pct = str(row[pct_col] if pct_col < len(row) else "").strip()
        if not sym or not pct:
            continue
        # Ensure explicit sign
        if pct and not pct.startswith(("+", "-")):
            pct = "+" + pct
        if price_col is not None and price_col < len(row):
            price = str(row[price_col]).strip()
            items.append(f"{sym}  {pct}  {price}")
        else:
            items.append(f"{sym}  {pct}")

    return items


def generate_terminal_table_items(table: dict[str, Any], max_items: int = 12) -> list[str]:
    """Format a table as pipe-delimited items strings for the TerminalTable layout.

    Returns a list where item[0] is the header row and the rest are data rows,
    all pipe-delimited and uppercased to match the Bloomberg terminal aesthetic.
    max_items includes the header row, so data rows = max_items - 1.
    """
    headers = [str(h or "").strip() for h in (table.get("headers", []) or [])]
    rows = [r for r in (table.get("rows", []) or []) if isinstance(r, list)]
    if not headers or len(rows) < 1:
        return []

    def _fmt_row(cells: list) -> str:
        return " | ".join(str(c or "").strip().upper() for c in cells)

    header_str = _fmt_row(headers)
    data_strs = [_fmt_row(r) for r in rows[: max_items - 1] if any(str(c or "").strip() for c in r)]

    items = [header_str] + data_strs
    return items[:max_items]


_TICKER_ARROW_RE = re.compile(
    # Matches the Motley Fool arrow-block format WITH the Arrow-Thin-Down prefix:
    # "Arrow-Thin-Down\\\n\\\nSYMBOL NAME\\\n\\\n$PRICE\\\n\\\n+X.X%"
    r"Arrow-Thin-(?:Down|Up)\s*\\\s*\n"
    r"\s*\\\s*\n\s*([^\\\n]{1,30}?)\s*\\\s*\n"  # name/symbol line
    r"\s*\\\s*\n\s*(\$?[\d,]+\.?\d*)\s*\\\s*\n"  # price line
    r"\s*\\\s*\n\s*([+\-]\d+\.?\d*%)",            # pct change line
    re.MULTILINE,
)

_TICKER_BARE_BLOCK_RE = re.compile(
    # Matches bare backslash-newline blocks WITHOUT the Arrow-Thin prefix:
    # "S&P 500\\\n\\\n7,108.40\\\n\\\n-0.4%"
    r"([^\\\n]{1,40})\\\n"    # name line ending with backslash-newline
    r"\\\n"                    # blank backslash-newline separator
    r"(\$?[\d,]+\.?\d*)\\\n"  # price line
    r"\\\n"                    # blank separator
    r"([+\-]\d+\.?\d*%)",     # pct change line
    re.MULTILINE,
)

_TICKER_PAREN_RE = re.compile(
    # Matches Motley Fool inline format: "CompanyName (\nMSFT\n3.90%\n)"
    r'\(\s*\n\s*([A-Z]{1,6})\s*\n\s*([+\-]?\d+\.?\d*%)\s*\n\s*\)',
    re.MULTILINE,
)

_TICKER_INLINE_RE = re.compile(
    r"\b([A-Z]{2,5})\b"           # ticker symbol (2-5 caps)
    r"[^$\d\n]{0,40}"             # optional gap (stock name)
    r"\$?([\d,]+\.?\d*)"          # price
    r"[^%\-+\d\n]{0,10}"
    r"([+\-]\d+\.?\d*%)",         # change pct
    re.MULTILINE,
)

_TICKER_STOPWORDS = {
    "THE", "AND", "FOR", "ARE", "NOT", "BUT", "INC", "LLC", "ETF", "IPO",
    "CEO", "CFO", "SEC", "NYSE", "USA", "GDP", "FED", "USD", "ALL", "NEW",
    "ITS", "HAS", "WAS", "THIS", "WITH", "FROM", "INTO", "THAT", "THEY",
    "WILL", "HAVE", "BEEN", "THEIR", "MORE", "ALSO", "BOTH", "EACH", "OVER",
}

# Abbreviate long index names to a short label for display
_NAME_ABBREV = {
    "S&P 500": "SPX",
    "DOW JONES": "DJI",
    "NASDAQ": "NDX",
    "BITCOIN": "BTC",
    "ETHEREUM": "ETH",
}


def extract_ticker_items_from_blog(blog_content: str, max_items: int = 10) -> list[str]:
    """Extract real ticker rows from scraped blog content for terminal_ticker.

    Returns formatted strings: "SYMBOL  +X.XX%  $PRICE"
    Priority: arrow-block format → tables with Name/Last/Chg% → inline text pattern.
    """
    if not blog_content:
        return []

    seen: set[str] = set()
    items: list[str] = []

    def _add(raw_name: str, price: str, pct: str) -> None:
        name = raw_name.strip().upper()
        # Map long names to short symbols
        sym = _NAME_ABBREV.get(name, name)
        # If still long, try to use the last all-caps word as symbol
        if len(sym) > 7:
            tokens = [t for t in re.split(r"\s+", sym) if t.isalpha()]
            short = next((t for t in tokens if 1 <= len(t) <= 6 and t not in _TICKER_STOPWORDS), None)
            sym = short or sym[:6]
        sym = sym.lstrip("^").strip()
        if not sym or sym in seen or sym in _TICKER_STOPWORDS:
            return
        seen.add(sym)
        price_clean = price.strip().lstrip("$").replace(",", "")
        pct_clean = pct.strip()
        if not pct_clean.startswith(("+", "-")):
            pct_clean = "+" + pct_clean
        items.append(f"{sym:<6}  {pct_clean:<8}  ${price_clean}")

    # Priority 1a: bare backslash-newline block — "S&P 500\\\n\\\n7,108.40\\\n\\\n-0.4%"
    for m in _TICKER_BARE_BLOCK_RE.finditer(blog_content):
        if len(items) >= max_items:
            break
        _add(m.group(1), m.group(2), m.group(3))

    # Priority 1b: Motley Fool arrow-block format with Arrow-Thin-Down prefix
    if len(items) < 4:
        for m in _TICKER_ARROW_RE.finditer(blog_content):
            if len(items) >= max_items:
                break
            _add(m.group(1), m.group(2), m.group(3))

    # Priority 1c: Motley Fool inline paren format — "CompanyName (\nMSFT\n3.90%\n)"
    # No price available in this format; use pct-only display
    if len(items) < 4:
        for m in _TICKER_PAREN_RE.finditer(blog_content):
            if len(items) >= max_items:
                break
            sym = m.group(1).strip()
            pct = m.group(2).strip()
            if sym in _TICKER_STOPWORDS or sym in seen:
                continue
            seen.add(sym)
            pct_clean = pct if pct.startswith(("+", "-")) else "+" + pct
            items.append(f"{sym:<6}  {pct_clean:<8}  —")

    # Priority 2: tables with Name/Last/Chg.% columns
    if len(items) < 4:
        try:
            from app.services.table_extraction import extract_tables_from_content
            tables = extract_tables_from_content(blog_content)
        except Exception:
            tables = []
        for tbl in tables:
            if len(items) >= max_items:
                break
            hdrs = [str(h).lower() for h in tbl.get("headers", [])]
            name_i = next((i for i, h in enumerate(hdrs) if h in {"name", "ticker", "symbol"}), -1)
            last_i = next((i for i, h in enumerate(hdrs) if "last" in h or "price" in h or "close" in h), -1)
            chg_i = next((i for i, h in enumerate(hdrs) if "chg" in h and "%" in h or h == "chg. %"), -1)
            if name_i == -1 or last_i == -1 or chg_i == -1:
                continue
            for row in tbl.get("rows", []):
                if len(items) >= max_items:
                    break
                name = str(row[name_i] if name_i < len(row) else "").strip()
                price = str(row[last_i] if last_i < len(row) else "").strip()
                pct = str(row[chg_i] if chg_i < len(row) else "").strip()
                if name and price and pct:
                    _add(name, price, pct)

    # Priority 3: inline "TICKER $price +X%" pattern (last resort)
    if len(items) < 4:
        for m in _TICKER_INLINE_RE.finditer(blog_content):
            if len(items) >= max_items:
                break
            sym = m.group(1)
            if sym in _TICKER_STOPWORDS:
                continue
            _add(sym, m.group(2), m.group(3))

    return items[:max_items]


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
        "headers": [_clean_text_cell(h) for h in headers[:8]],
        "rows": [[_clean_text_cell(cell) for cell in row[:8]] for row in rows[:20]],
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
