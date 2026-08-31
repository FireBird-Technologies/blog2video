import { useEffect, useRef, useState } from "react";
import { getCodeGenerationStatus, type CodeGenStatus } from "../api/client";

/**
 * Live progress for a template that is generating.
 *
 * Generation takes 5-10 minutes, and until now the only feedback was a spinner
 * and the word "Generating..." — so a user could not tell a healthy run from a
 * stalled one, or know how much was left. The backend already tracks a durable
 * per-run stage plus a scene counter; this surfaces them.
 *
 * Styled to match the video-generation loader in ProjectView (regenerate-script
 * / language-change): a thin purple fill bar above a row of INDEPENDENT circles
 * with labels beneath — done circles green, the active one purple with a ring,
 * upcoming ones grey. A user waiting on a long run meets the same shape of thing
 * whether that run is a video or a template.
 *
 * Deliberately rendered on WHITE rather than in the brand's own palette: while a
 * template is generating its theme is the one thing not yet proven, and a dark
 * brand background made the status text hard to read on the very cards that most
 * needed reading.
 */

/** The pipeline as a user experiences it, in order.
 *
 * FOUR steps, not the backend's six. The three pre-scene stages (choosing
 * scene types, authoring the blueprint, building the design system) are one
 * thing from the outside — the template is being designed — and splitting them
 * produced a rail whose first half raced past while the real wait sat entirely
 * under one circle. Labels stay short so they fit side by side without
 * wrapping. */
const STEPS: { key: string; label: string }[] = [
  // The `key` is the internal identity the backend's stage vocabulary maps onto
  // and the scene counter hangs off — the LABEL is what the user reads, and the
  // two are deliberately allowed to differ. A custom template's "scenes" are
  // layouts from the user's point of view: reusable designs the video's real
  // scenes are later laid out into.
  { key: "design", label: "Designing" },
  { key: "scenes", label: "Layouts" },
  { key: "examine", label: "Verifying" },
  { key: "persist", label: "Saving" },
];

/** Bar fill per step, mirroring ProjectView's REGEN_SCRIPT_PROGRESS: the last
 *  step deliberately stops short of 100%, which is reached only when the run
 *  actually completes. */
const STEP_PROGRESS = [15, 45, 70, 88];

/** Map one backend stage/step token onto an index into STEPS.
 *
 * Checked most-advanced-first so a value matching more than one rule lands on
 * the later step. Returns -1 for a token that says nothing about position. */
function indexForToken(v: string): number {
  if (!v) return -1;
  if (v === "done") return STEPS.length;
  if (v.includes("persist") || v.includes("saving")) return 3;
  // The backend's validation pass over the generated scenes.
  if (v.includes("examine")) return 2;
  // "generating_scenes" / "scenes" — but NOT "scene_types", which is planning.
  if (v.includes("scene") && !v.includes("scene_types")) return 1;
  return 0;
}

/** Map the backend's stage/step vocabulary onto the four steps above.
 *
 * Reads BOTH fields and takes the more advanced. They advance independently:
 * `stage` is the durable run row (coarse, survives a restart) while `step` is
 * the in-memory per-tab detail, and each can lead the other depending on where
 * the run is. Preferring `stage` outright left the modal parked on "Designing"
 * while `step` had already moved on to generating scenes. */
function activeStepIndex(s: CodeGenStatus | null): number {
  if (!s) return 0;
  if (s.status === "complete") return STEPS.length;
  return Math.max(
    0,
    indexForToken((s.stage || "").toLowerCase()),
    indexForToken((s.step || "").toLowerCase())
  );
}

/** Last known status per template, shared by every consumer of the hook.
 *
 * A fresh mount used to start at `null`, which `activeStepIndex` reads as step
 * 1 — so REOPENING the progress modal on a run already at "Layouts" showed
 * "Designing" until its first poll returned, contradicting the card behind it
 * that was polling the same endpoint. The status is a property of the template,
 * not of whichever component happens to be displaying it, so it is cached here
 * and a remount resumes from the last known value instead of from nothing.
 *
 * Module-level rather than a context: consumers are in unrelated trees (a
 * gallery card and a portalled modal), and this needs no provider to work.
 */
const _statusCache = new Map<number, CodeGenStatus>();

/** Forget a template's cached status.
 *
 * Call when a NEW run starts for a template that already has one cached — a
 * regeneration — so the rail does not open on the previous run's finished
 * state while waiting for the first poll of the new one.
 */
export function invalidateGenerationStatus(templateId: number): void {
  _statusCache.delete(templateId);
}

export function useGenerationStatus(templateId: number, active: boolean) {
  const [status, setStatus] = useState<CodeGenStatus | null>(
    () => _statusCache.get(templateId) ?? null,
  );
  const timer = useRef<number | null>(null);

  // Switching templates within one mounted component must not keep showing the
  // previous template's progress.
  useEffect(() => {
    setStatus(_statusCache.get(templateId) ?? null);
  }, [templateId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await getCodeGenerationStatus(templateId);
        // Terminal states are cached TOO.
        //
        // Deleting them looked right — it stopped a later regeneration opening
        // on the previous run's finished rail — but it made a COMPLETED run
        // indistinguishable from an unknown one: the modal reseeded as null,
        // showed step 1, and its `finished` check never fired, so it never
        // closed and never told the page to refresh. A finished run is exactly
        // the state the modal most needs to see.
        //
        // The regeneration case is handled by invalidateGenerationStatus(),
        // which the page calls when it STARTS one.
        _statusCache.set(templateId, data);
        if (!cancelled) setStatus(data);
      } catch {
        // A failed poll is not worth surfacing — the next one usually works,
        // and the card already shows the last known state.
      }
    };

    poll();
    timer.current = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [templateId, active]);

  return status;
}

interface Props {
  status: CodeGenStatus | null;
  /** `card` is the compact form for a gallery tile; `modal` has room for the
   *  full step list. */
  variant?: "card" | "modal";
}

export default function TemplateGenerationProgress({ status, variant = "card" }: Props) {
  const active = activeStepIndex(status);
  const done = status?.scenes_done ?? 0;
  const total = status?.scenes_total ?? 0;
  const compact = variant === "card";
  const complete = active >= STEPS.length;

  // Scene generation is the long pole and the only step with a real unit of
  // work to count, so it is the only one that gets a counter.
  //
  // Held back until the total is AUTHORITATIVE. The backend publishes a
  // provisional figure ~8s in, as soon as scene types are decided, but the
  // blueprint then authors its own layouts — a brand-seeded 6-8 of them — and
  // overwrites the count. Showing the early number meant the rail visibly
  // changed from "Layouts 0/8" to "Layouts 0/9" mid-run, which reads as a
  // glitch rather than as the pipeline refining its own estimate.
  //
  // The cost is ~50s where the step reads just "Layouts" with no scale. That is
  // the deliberate trade: no number beats a number that moves.
  //
  // The count climbs in COMPLETION order, not index order: the backend generates
  // every layout in parallel and reports each as it lands.
  //
  // Hidden once the step is DONE: a completed step still carrying "9/9" invited
  // the reading that something was still counting up.
  //
  // Keyed by STEPS entry rather than a literal index, so renumbering the steps
  // cannot silently hang the counter off the wrong one.
  const totalIsFinal = status?.scenes_total_final ?? false;
  const sceneCounter = (i: number) =>
    STEPS[i]?.key === "scenes" && i >= active && total > 0 && totalIsFinal
      ? `${done}/${total}`
      : null;

  const barProgress = complete
    ? 100
    : STEP_PROGRESS[Math.min(active, STEP_PROGRESS.length - 1)];

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center py-4 ${
        compact ? "px-3" : "px-3 sm:px-4"
      }`}
      style={{ background: "#FFFFFF" }}
    >
      <div className={compact ? "w-full max-w-[260px]" : "w-full max-w-sm"}>
        {/* Progress bar — the same thin purple fill used above the video
            generation steps, so the two loaders read as one family. */}
        <div
          className={`w-full bg-gray-100 rounded-full h-1.5 overflow-hidden ${
            compact ? "mb-4" : "mb-4 sm:mb-6"
          }`}
        >
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${barProgress}%` }}
          />
        </div>

        {/* Independent step circles with labels beneath — NOT joined by
            connectors, matching ProjectView's regenerate-script row. */}
        <div className="flex items-start justify-between">
          {STEPS.map(({ key, label: stepLabel }, i) => {
            const isDone = i < active;
            const isActive = i === active;
            return (
              <div
                key={key}
                // Flexible columns that share the row rather than fixed widths.
                // A fixed w-16/w-20 overflowed the rail on a narrow phone, which
                // is what pushed the labels into each other; `min-w-0` lets a
                // long label wrap inside its share instead of forcing the row
                // wider than the modal.
                className={`flex flex-1 min-w-0 flex-col items-center gap-1.5 ${
                  compact ? "max-w-[64px]" : "max-w-[80px]"
                }`}
              >
                <div
                  className={`shrink-0 rounded-full flex items-center justify-center font-medium transition-all ${
                    compact ? "w-6 h-6 text-[10px]" : "w-7 h-7 sm:w-8 sm:h-8 text-[11px] sm:text-xs"
                  } ${
                    isDone
                      ? "bg-green-100 text-green-600"
                      : isActive
                      ? "bg-purple-100 text-purple-600 ring-2 ring-purple-200"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <svg
                      className={compact ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  // `break-words` so "Designing" wraps inside its column on a
                  // very narrow screen rather than widening the row.
                  className={`w-full font-medium text-center leading-tight break-words ${
                    compact ? "text-[9px]" : "text-[10px] sm:text-xs"
                  } ${isDone ? "text-green-600" : isActive ? "text-purple-600" : "text-gray-400"}`}
                >
                  {stepLabel}
                  {/* The counter sits on its own line at narrow widths — inline
                      it made "Scenes 0/8" the widest label in the row and forced
                      the whole rail wider than the modal. */}
                  {sceneCounter(i) ? (
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="hidden sm:inline"> </span>
                      <span className="block sm:inline">{sceneCounter(i)}</span>
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status line beneath the rail.
            The active step's own label is already highlighted in purple above,
            so repeating it in bold here said the same word twice; this carries
            only what the rail cannot — the overall position and the expected
            wait. On completion it does name the phase, since no step is
            highlighted once every circle is green. */}
        <div className={compact ? "mt-5 text-center" : "mt-6 sm:mt-9 text-center"}>
          {complete && (
            <p
              className="font-semibold truncate"
              style={{ fontSize: compact ? 11 : 13, color: "#111827" }}
            >
              Finishing up
            </p>
          )}
          <p
            className={compact ? "text-[9px]" : "text-[10px] sm:text-[11px]"}
            style={{ color: "#9CA3AF", marginTop: 4 }}
          >
            Step {Math.min(active + 1, STEPS.length)} of {STEPS.length}
            {/* The duration hint is dropped on narrow screens, where it wrapped
                to a second line and pushed the modal's action button below the
                fold. The elapsed-time line beneath already sets expectations. */}
            {compact ? "" : <span className="hidden sm:inline"> · this usually takes 5-10 minutes</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
