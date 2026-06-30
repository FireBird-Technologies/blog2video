"""
Public stock data endpoint powered by yfinance.
No auth required — the auth gate is enforced on the frontend (custom tickers require signup).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Query
import math

router = APIRouter(prefix="/api/stock-data", tags=["stock-data"])

ALLOWED_DAYS = {7, 30, 60}

_INCOME_METRICS = [
    "Total Revenue",
    "Net Income",
    "Operating Income",
    "Gross Profit",
    "EBITDA",
]

_BALANCE_METRICS = [
    "Total Assets",
    "Total Liabilities Net Minority Interest",
    "Stockholders Equity",
    "Total Debt",
    "Cash And Cash Equivalents",
]


def _safe_float(val) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 4)
    except (TypeError, ValueError):
        return None


def _df_to_metric_list(df, target_metrics: list[str]) -> list[dict]:
    if df is None or df.empty:
        return []
    result = []
    for metric in target_metrics:
        if metric not in df.index:
            continue
        row = df.loc[metric]
        values = []
        for col, val in row.items():
            try:
                date_str = col.strftime("%Y-%m-%d")
            except AttributeError:
                date_str = str(col)[:10]
            values.append({"date": date_str, "value": _safe_float(val)})
        result.append({"metric": metric, "values": values[:4]})
    return result


@router.get("")
async def get_stock_data(
    ticker: str = Query(default="SPCX", max_length=20),
    days: int = Query(default=30),
):
    if days not in ALLOWED_DAYS:
        raise HTTPException(status_code=400, detail="days must be 7, 30, or 60")

    ticker_clean = ticker.upper().strip()
    # Basic sanity check: allow letters, digits, dash, dot (for tickers like BRK.B)
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.")
    if not ticker_clean or not all(c in allowed for c in ticker_clean) or len(ticker_clean) > 10:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol")

    try:
        import yfinance as yf  # imported lazily so startup isn't blocked if not installed
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="yfinance is not installed on this server. Add it to requirements.txt.",
        )

    try:
        stock = yf.Ticker(ticker_clean)

        end = datetime.now()
        start = end - timedelta(days=days + 5)  # extra buffer for weekends/holidays
        hist = stock.history(start=start, end=end)

        if hist is None or hist.empty:
            raise HTTPException(status_code=404, detail=f"No price data found for {ticker_clean}")

        # Trim to requested window
        hist = hist.tail(days)

        prices = []
        for date_idx, row in hist.iterrows():
            try:
                date_str = date_idx.strftime("%Y-%m-%d")
            except AttributeError:
                date_str = str(date_idx)[:10]
            prices.append({
                "date": date_str,
                "open": _safe_float(row.get("Open")),
                "high": _safe_float(row.get("High")),
                "low": _safe_float(row.get("Low")),
                "close": _safe_float(row.get("Close")),
                "volume": _safe_float(row.get("Volume")),
            })

        info: dict = {}
        try:
            info = stock.info or {}
        except Exception:
            pass

        income_statement: list[dict] = []
        try:
            income_statement = _df_to_metric_list(stock.financials, _INCOME_METRICS)
        except Exception:
            pass

        balance_sheet: list[dict] = []
        try:
            balance_sheet = _df_to_metric_list(stock.balance_sheet, _BALANCE_METRICS)
        except Exception:
            pass

        current_price = _safe_float(
            info.get("currentPrice") or info.get("regularMarketPrice") or
            (prices[-1]["close"] if prices else None)
        )
        previous_close = _safe_float(
            info.get("previousClose") or info.get("regularMarketPreviousClose") or
            (prices[-2]["close"] if len(prices) >= 2 else None)
        )

        return {
            "ticker": ticker_clean,
            "period": f"{days}d",
            "info": {
                "name": info.get("longName") or info.get("shortName") or ticker_clean,
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "currency": info.get("currency", "USD"),
                "current_price": current_price,
                "previous_close": previous_close,
                "market_cap": _safe_float(info.get("marketCap")),
                "pe_ratio": _safe_float(info.get("trailingPE")),
                "dividend_yield": _safe_float(info.get("dividendYield")),
            },
            "prices": prices,
            "income_statement": income_statement,
            "balance_sheet": balance_sheet,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stock data: {str(e)}")
