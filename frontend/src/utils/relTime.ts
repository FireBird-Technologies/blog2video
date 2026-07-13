/**
 * Parse a backend timestamp as UTC. The API stores naive UTC datetimes that
 * serialize without a timezone suffix; without a trailing "Z" the browser would
 * wrongly read them as local time. `Date` then renders in the machine's timezone.
 */
export function parseUtc(iso: string): Date {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

/** Human-friendly relative time ("just now", "5m ago", …) from a UTC timestamp. */
export function relTime(iso: string): string {
  const d = parseUtc(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}
