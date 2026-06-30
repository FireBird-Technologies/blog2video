import api from "./http";

export interface StockPricePoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface StockMetricRow {
  metric: string;
  values: Array<{ date: string; value: number | null }>;
}

export interface StockInfo {
  name: string;
  sector: string | null;
  industry: string | null;
  currency: string;
  current_price: number | null;
  previous_close: number | null;
  market_cap: number | null;
  pe_ratio: number | null;
  dividend_yield: number | null;
}

export interface StockDataResponse {
  ticker: string;
  period: string;
  info: StockInfo;
  prices: StockPricePoint[];
  income_statement: StockMetricRow[];
  balance_sheet: StockMetricRow[];
}

export function getStockData(ticker: string, days: 7 | 30 | 60) {
  return api.get<StockDataResponse>(
    `/stock-data?ticker=${encodeURIComponent(ticker)}&days=${days}`
  );
}
