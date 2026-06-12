import type React from "react";
import type { ChronicleLayoutProps, ChronicleLayoutType } from "../types";
import { BookOpen } from "./BookOpen";
import { ParchmentScroll } from "./ParchmentScroll";
import { ChapterPlate } from "./ChapterPlate";
import { IlluminatedQuote } from "./IlluminatedQuote";
import { LedgerStats } from "./LedgerStats";
import { VersusFolio } from "./VersusFolio";
import { ChronicleTimeline } from "./ChronicleTimeline";
import { MapReveal } from "./MapReveal";
import { DecreeSeal } from "./DecreeSeal";
import { ChronicleDataChart } from "./ChronicleDataChart";
import { ChronicleTable } from "./ChronicleTable";
import { EndingSocials } from "./EndingSocials";

export const CHRONICLE_LAYOUT_REGISTRY: Record<
  ChronicleLayoutType,
  React.FC<ChronicleLayoutProps>
> = {
  book_open: BookOpen,
  parchment_scroll: ParchmentScroll,
  chapter_plate: ChapterPlate,
  illuminated_quote: IlluminatedQuote,
  ledger_stats: LedgerStats,
  versus_folio: VersusFolio,
  chronicle_timeline: ChronicleTimeline,
  map_reveal: MapReveal,
  decree_seal: DecreeSeal,
  chronicle_data: ChronicleDataChart,
  chronicle_table: ChronicleTable,
  ending_socials: EndingSocials,
};

export {
  BookOpen,
  ParchmentScroll,
  ChapterPlate,
  IlluminatedQuote,
  LedgerStats,
  VersusFolio,
  ChronicleTimeline,
  MapReveal,
  DecreeSeal,
  ChronicleDataChart,
  ChronicleTable,
  EndingSocials,
};
