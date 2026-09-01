/**
 * Music-genre grouping for the background-music picker.
 *
 * Purely a frontend presentation concern — the API returns a flat track list
 * with only `mood`, so the genre for each track is assigned here. The labels
 * follow the conventional genre vocabulary used by stock-music libraries
 * (Epidemic Sound / Artlist): Cinematic, Orchestral, Pop, Rock, Acoustic,
 * Ambient — not video themes like "Corporate", which describe the use case
 * rather than the sound.
 */

/** Display order of the pills; also the order of headings in the dropdown. */
export const BGM_GENRE_ORDER = [
  "Cinematic",
  "Orchestral",
  "Pop",
  "Rock",
  "Acoustic",
  "Ambient",
] as const;

export type BgmGenre = (typeof BGM_GENRE_ORDER)[number];

const TRACK_GENRES: Record<string, BgmGenre> = {
  corporate_upbeat: "Pop",
  trending_reels: "Pop",
  documentary_sad: "Cinematic",
  podcast_intro: "Pop",
  ambient_background: "Ambient",
  chasing_success: "Cinematic",
  relaxed_narrative: "Acoustic",
  sad_violin: "Orchestral",
  dramatic_trailer: "Cinematic",
  powerful_percussion: "Cinematic",
  dark_cyberpunk: "Cinematic",
  wonders_of_the_earth: "Orchestral",
  action_race_rock: "Rock",
  moment_of_peace: "Ambient",
};

/** Genre for a track, or null when the track isn't in the map (new track ids). */
export function getBgmGenre(trackId: string): BgmGenre | null {
  return TRACK_GENRES[trackId] ?? null;
}

/**
 * The genres actually present in `tracks`, in BGM_GENRE_ORDER. Genres with no
 * track are dropped so the pill row never offers an empty filter.
 */
export function availableBgmGenres(tracks: { track_id: string }[]): BgmGenre[] {
  const present = new Set(
    tracks.map((t) => getBgmGenre(t.track_id)).filter((g): g is BgmGenre => g !== null),
  );
  return BGM_GENRE_ORDER.filter((g) => present.has(g));
}

/**
 * Bucket tracks under their genre heading in BGM_GENRE_ORDER. Unmapped tracks
 * fall into a trailing "Other" group so nothing ever disappears from the list.
 */
export function groupTracksByGenre<T extends { track_id: string }>(
  tracks: T[],
): [string, T[]][] {
  const groups: [string, T[]][] = [];
  for (const genre of BGM_GENRE_ORDER) {
    const matching = tracks.filter((t) => getBgmGenre(t.track_id) === genre);
    if (matching.length) groups.push([genre, matching]);
  }
  const ungrouped = tracks.filter((t) => getBgmGenre(t.track_id) === null);
  if (ungrouped.length) groups.push(["Other", ungrouped]);
  return groups;
}
