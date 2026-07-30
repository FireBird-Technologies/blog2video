import { useEffect, useState } from "react";

const JUST_LOGGED_IN_KEY = "b2v_just_logged_in";

/**
 * Single owner of the `b2v_just_logged_in` session flag.
 *
 * `login()` in useAuth sets the flag on every real sign-in, but NOT on page
 * reload — a reload restores the session via `setUser` without calling
 * `login()`. So the flag is exactly "this render follows a fresh login".
 *
 * The problem this hook solves: more than one global surface wants to fire once
 * per login, and a consumer that reads sessionStorage directly must delete the
 * flag to avoid re-firing on a later reload. Sibling effects run in mount order,
 * so whichever consumer ran first would delete the flag and the others would
 * never fire. Routing every consumer through this module means one read, one
 * delete, and an answer that is independent of mount order.
 *
 * The snapshot is taken lazily on first call rather than at module scope: the
 * bundle evaluates at page load, BEFORE `login()` writes the flag (this is an
 * SPA — signing in sets state without a navigation or remount), so a
 * module-scope read would always be false.
 */
let snapshot: boolean | null = null;

function readSnapshot(): boolean {
  if (snapshot === null) {
    try {
      snapshot = sessionStorage.getItem(JUST_LOGGED_IN_KEY) === "1";
      // Consume here, inside the single owner. A later reload must read the flag
      // as absent — otherwise a plan change within the same tab session (e.g.
      // free -> paid) would surface a login-only popup on that reload.
      sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
    } catch {
      snapshot = false;
    }
  }
  return snapshot;
}

/**
 * True when this page load followed a real sign-in. Starts `false` and flips
 * after mount, so callers should treat it as a trigger rather than a condition
 * available during the first render.
 */
export default function useJustLoggedIn(): boolean {
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    setJustLoggedIn(readSnapshot());
  }, []);

  return justLoggedIn;
}
