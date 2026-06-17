"""
Depth tier — chart_planner deterministic functions.

The code that turns messy LLM/scraped tables into chart props — where chart bugs
(the flicker/wrong-figure class) originate. Pure input->output; outputs verified
against the real functions before asserting.
"""
import pytest

from app.services.chart_planner import (
    _parse_number,
    is_candlestick_table,
    normalize_chart_table,
)

pytestmark = pytest.mark.depth


# ─── _parse_number — the numeric guardrail ──────────────────────────────────

@pytest.mark.parametrize("value,expected", [
    (5, 5.0),
    (3.5, 3.5),
    ("1234.56", 1234.56),
    ("1,234", 1234.0),            # thousands separator
    ("Rs. 484,500", 484500.0),   # currency prefix, single numeric token
    ("(20)", -20.0),             # accounting negative
])
def test_parse_number__valid(value, expected):
    assert _parse_number(value) == expected


@pytest.mark.parametrize("value", [
    "range-bound prose",            # prose, not a number
    "+15% initial, -15% decline",   # multiple numbers -> rejected
    "Apr 10, 26",                   # date-like, no currency hint
    "",
    None,
])
def test_parse_number__rejects_non_numeric(value):
    # Guardrail: reject prose / multi-number / date cells so they can't poison a chart.
    assert _parse_number(value) is None


# ─── is_candlestick_table — OHLC + time axis ────────────────────────────────

def test_is_candlestick__ohlc_with_date__true():
    assert is_candlestick_table({"headers": ["Date", "Open", "High", "Low", "Close"]}) is True


def test_is_candlestick__ohlc_without_date__false():
    # A multi-symbol snapshot has OHLC but no time axis -> NOT a candlestick chart.
    assert is_candlestick_table({"headers": ["Symbol", "Open", "High", "Low", "Close"]}) is False


def test_is_candlestick__plain_table__false():
    assert is_candlestick_table({"headers": ["Name", "Price"]}) is False


# ─── normalize_chart_table — cleaning + guards ──────────────────────────────

def test_normalize__valid_table_cleaned():
    out = normalize_chart_table({"headers": ["A", "B"], "rows": [["1", "2"], ["3", "4"]]})
    assert out == {"headers": ["A", "B"], "rows": [["1", "2"], ["3", "4"]]}


@pytest.mark.parametrize("bad", [
    None,
    {"headers": "not-a-list", "rows": []},
    {"headers": ["A"], "rows": []},   # no usable rows
])
def test_normalize__invalid_returns_none(bad):
    assert normalize_chart_table(bad) is None
