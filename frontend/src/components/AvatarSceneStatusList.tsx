import type { AvatarProgressScene } from "../api/client";

/** A scene the UI knows about but the server has not reported a job row for.
 *
 *  Kept as its own shape rather than a faked AvatarProgressScene so it can never
 *  be mistaken for real rollup data — only this list sees these; every derived
 *  value elsewhere (progress counts, hasMatteRows, the stall signature) still
 *  reads the untouched server rows. */
export interface PlaceholderRow {
  scene_id: number;
  placeholder: true;
}

export type DisplayRow = AvatarProgressScene | PlaceholderRow;

/** Human-readable state for one scene's row in the rollup.
 *
 *  Shared by the batch wizard and the project Avatar card so the same job is
 *  described the same way wherever it is shown — the two used to drift, with the
 *  card reducing a whole pass to "3 scenes to go". */
export function sceneStatusLabel(row: DisplayRow, hasPolled: boolean): string {
  // No server row for this scene YET. "Starting…" only until the first poll
  // answers — after that the scene genuinely has no job (its enqueue POST
  // failed) and the optimistic label would be a lie.
  //
  // Deliberately blank rather than "Starting…" before the first poll on a
  // remount: a view can mount straight into "generating" on a project whose
  // jobs already FAILED, and claiming every scene is starting overwrites the
  // real state for the ~1.2s until the rollup lands. Showing nothing for a
  // moment is honest; showing the wrong thing is not.
  if ("placeholder" in row) return hasPolled ? "Not started" : "";
  // Retry bookkeeping is deliberately NOT surfaced. "attempt 2 of 3" reads as
  // something going wrong and invites the user to intervene, when a retry is
  // routine and entirely automatic — there is nothing for them to do with the
  // number. The server still enforces the budget; it just isn't their problem.
  switch (row.status) {
    case "completed":
      return "Done";
    case "failed":
      return row.attempts_exhausted ? "Failed — open scene to retry" : "Failed";
    case "running":
      // A matte job has no phases and never re-renders — describing it as
      // "Rendering" would misrepresent both the work and its cost.
      if (row.kind === "matte") return "Removing background";
      if (row.phase === "starting_service") return "Warming up";
      return "Rendering";
    case "queued":
      // Queue POSITION is deliberately not surfaced. queue_position counts jobs
      // from every project ahead of this one, so it reads as a backlog the user
      // is stuck behind and can do nothing about — and it ticks down at a pace
      // unrelated to their own work. "Queued" is the fact that matters.
      //
      // Name the phase here too. A bare "Queued" under a "Generating background"
      // headline reads as if the render were somehow starting over.
      if (row.kind === "matte") return "Background queued";
      return "Queued";
    default:
      return "";
  }
}

/**
 * Per-scene progress for an avatar batch — one row per scene, with a spinner on
 * whichever scene the server is actually working on.
 *
 * The work runs in the backend queue, not the browser: these rows come from
 * polling the server's rollup, so they keep advancing while the user is on
 * another tab and are still correct after a reload. The spinner therefore marks
 * a real job in flight, not a local animation.
 */
export default function AvatarSceneStatusList({
  rows,
  orderOf,
  hasPolled,
  className = "mt-5 space-y-1.5 max-w-sm mx-auto",
}: {
  rows: DisplayRow[];
  /** scene id -> the 1-based scene number the user recognises. */
  orderOf: Map<number, number>;
  /** False until the first rollup response — see sceneStatusLabel. */
  hasPolled: boolean;
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className={className}>
      {rows.map((row) => {
        const status = "placeholder" in row ? undefined : row.status;
        // Cold start only: no server row AND no answer yet (a first visit or
        // hard reload — a tab switch seeds real rows from the cached rollup, so
        // it never lands here). sceneStatusLabel stays honest and returns "";
        // showing a skeleton rather than empty space says "fetching" without
        // asserting a status that may turn out to be "Failed".
        const loading = "placeholder" in row && !hasPolled;
        return (
          <li
            key={row.scene_id}
            className="flex items-center justify-between gap-3 text-[11px]"
          >
            <span className="text-gray-500 flex-shrink-0">
              Scene {orderOf.get(row.scene_id) ?? "?"}
            </span>
            <span
              className={`flex items-center gap-1.5 text-right ${
                status === "failed"
                  ? "text-amber-600"
                  : status === "completed"
                    ? "text-green-600"
                    : "text-gray-400"
              }`}
            >
              {/* Only on the row actually being worked. A queued row spinning
                  would claim progress that has not started, and a finished one
                  would never stop — either way the spinner stops meaning
                  "this is the scene the machine is on right now". */}
              {status === "running" && (
                <span
                  className="w-2.5 h-2.5 border-[1.5px] border-gray-200 border-t-gray-500 rounded-full animate-spin flex-shrink-0"
                  aria-hidden
                />
              )}
              {loading ? (
                // Sized to a typical label so the row doesn't resize when the
                // real text arrives.
                <span
                  className="h-2.5 w-16 rounded bg-gray-100 animate-pulse"
                  aria-label="Checking status"
                />
              ) : (
                sceneStatusLabel(row, hasPolled)
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
