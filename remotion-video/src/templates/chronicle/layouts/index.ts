import type React from "react";
import type { ChronicleLayoutProps, ChronicleLayoutType } from "../types";
import { BookOpen } from "./BookOpen";
import { BookOpenV2 } from "./BookOpenV2";
import { ParchmentScroll } from "./ParchmentScroll";
import { ParchmentScrollV2 } from "./ParchmentScrollV2";
import { ChapterPlate } from "./ChapterPlate";
import { IlluminatedQuote } from "./IlluminatedQuote";
import { IlluminatedQuoteV2 } from "./IlluminatedQuoteV2";
import { LedgerStats } from "./LedgerStats";
import { VersusFolio } from "./VersusFolio";
import { ChronicleTimeline } from "./ChronicleTimeline";
import { MapReveal } from "./MapReveal";
import { DecreeSeal } from "./DecreeSeal";
import { ChronicleDataChart } from "./ChronicleDataChart";
import { ChronicleTable } from "./ChronicleTable";
import { EndingSocials } from "./EndingSocials";
import { EndingSocialsV2 } from "./EndingSocialsV2";

export const CHRONICLE_LAYOUT_REGISTRY: Record<
  ChronicleLayoutType,
  React.FC<ChronicleLayoutProps>
> = {
  book_open: BookOpen,
  book_open__v2: BookOpenV2,
  parchment_scroll: ParchmentScroll,
  parchment_scroll__v2: ParchmentScrollV2,
  chapter_plate: ChapterPlate,
  illuminated_quote: IlluminatedQuote,
  illuminated_quote__v2: IlluminatedQuoteV2,
  ledger_stats: LedgerStats,
  versus_folio: VersusFolio,
  chronicle_timeline: ChronicleTimeline,
  map_reveal: MapReveal,
  decree_seal: DecreeSeal,
  chronicle_data: ChronicleDataChart,
  chronicle_table: ChronicleTable,
  ending_socials: EndingSocials,
  ending_socials__v2: EndingSocialsV2,
};

export {
  BookOpen,
  BookOpenV2,
  ParchmentScroll,
  ParchmentScrollV2,
  ChapterPlate,
  IlluminatedQuote,
  IlluminatedQuoteV2,
  LedgerStats,
  VersusFolio,
  ChronicleTimeline,
  MapReveal,
  DecreeSeal,
  ChronicleDataChart,
  ChronicleTable,
  EndingSocials,
  EndingSocialsV2,
};
