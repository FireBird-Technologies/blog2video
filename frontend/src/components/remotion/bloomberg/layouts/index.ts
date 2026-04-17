import { TerminalBoot } from "./TerminalBoot";
import { TerminalNarrative } from "./TerminalNarrative";
import { TerminalChart } from "./TerminalChart";
import { TerminalDashboard } from "./TerminalDashboard";
import { TerminalTicker } from "./TerminalTicker";
import { TerminalTable } from "./TerminalTable";
import { TerminalSplit } from "./TerminalSplit";
import { TerminalQuote } from "./TerminalQuote";
import { TerminalList } from "./TerminalList";
import { TerminalMetric } from "./TerminalMetric";
import { TerminalProfile } from "./TerminalProfile";
import { TerminalOptions } from "./TerminalOptions";
import { EndingSocials } from "./EndingSocials";
import type { BloombergLayoutProps, BloombergLayoutType } from "../types";

export type { BloombergLayoutType, BloombergLayoutProps };

export const BLOOMBERG_LAYOUT_REGISTRY: Record<
  BloombergLayoutType,
  React.FC<BloombergLayoutProps>
> = {
  terminal_boot: TerminalBoot,
  terminal_narrative: TerminalNarrative,
  terminal_chart: TerminalChart,
  terminal_dashboard: TerminalDashboard,
  terminal_ticker: TerminalTicker,
  terminal_table: TerminalTable,
  terminal_split: TerminalSplit,
  terminal_quote: TerminalQuote,
  terminal_list: TerminalList,
  terminal_metric: TerminalMetric,
  terminal_profile: TerminalProfile,
  terminal_options: TerminalOptions,
  ending_socials: EndingSocials,
};
