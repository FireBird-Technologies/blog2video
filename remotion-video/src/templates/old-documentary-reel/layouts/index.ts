import { DocreelCountdown } from "./DocreelCountdown";
import { DocreelSlate } from "./DocreelSlate";
import { DocreelStatistic } from "./DocreelStatistic";
import { DocreelTitleCard } from "./DocreelTitleCard";
import { DocreelDossier } from "./DocreelDossier";
import { DocreelPhotoPan } from "./DocreelPhotoPan";
import { DocreelContactSheet } from "./DocreelContactSheet";
import { DocreelInterview } from "./DocreelInterview";
import { DocreelFieldNotes } from "./DocreelFieldNotes";
import { DocreelEssayCaptions } from "./DocreelEssayCaptions";
import { DocreelReelOut } from "./DocreelReelOut";
import type { DocReelLayoutType, SceneLayoutProps } from "../types";

export type { DocReelLayoutType, SceneLayoutProps };

export const DOCREEL_LAYOUT_REGISTRY: Record<DocReelLayoutType, React.FC<SceneLayoutProps>> = {
  // System-owned: force-injected as scene 0 by the pipeline, never LLM-written.
  docreel_countdown: DocreelCountdown,
  docreel_slate: DocreelSlate,
  docreel_statistic: DocreelStatistic,
  docreel_title_card: DocreelTitleCard,
  docreel_dossier: DocreelDossier,
  docreel_photo_pan: DocreelPhotoPan,
  docreel_contact_sheet: DocreelContactSheet,
  docreel_interview: DocreelInterview,
  docreel_field_notes: DocreelFieldNotes,
  docreel_essay_captions: DocreelEssayCaptions,
  docreel_reel_out: DocreelReelOut,
  // Alias: the backend labels the ending scene with the canonical
  // "ending_socials" id, so route it to the reel-out component.
  ending_socials: DocreelReelOut,
};
