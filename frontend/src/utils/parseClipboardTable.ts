/**
 * Parse clipboard text into a 2-D matrix of cells.
 * Recognizes three formats, in order:
 *   1. Markdown / GFM pipe tables (`| col | col |` with optional `|---|---|` separator)
 *   2. TSV (Excel / Google Sheets default copy format)
 *   3. CSV with quoted-comma support
 */
export function parseClipboardTable(text: string): string[][] {
  const stripped = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!stripped) return [];
  const lines = stripped.split("\n");

  // ── 1) Markdown pipe table ─────────────────────────────────────────────
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const pipedLines = nonEmpty.filter((l) => l.includes("|"));
  const pipeCount = (stripped.match(/\|/g) ?? []).length;
  const tabCount = (stripped.match(/\t/g) ?? []).length;
  const isMarkdownTable =
    pipedLines.length >= 2 &&
    pipedLines.length === nonEmpty.length &&
    pipeCount > tabCount;

  if (isMarkdownTable) {
    const splitMdRow = (line: string): string[] => {
      let s = line.trim();
      if (s.startsWith("|")) s = s.slice(1);
      if (s.endsWith("|")) s = s.slice(0, -1);
      return s.split("|").map((c) => c.trim());
    };
    const isSeparatorRow = (cells: string[]) =>
      cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
    return nonEmpty.map(splitMdRow).filter((cells) => !isSeparatorRow(cells));
  }

  // ── 2) TSV / 3) CSV ───────────────────────────────────────────────────
  const hasTabs = stripped.includes("\t");
  return lines.map((line) =>
    hasTabs
      ? line.split("\t")
      : (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [])
          .filter((_, i, a) => i < a.length - 1 || a[i] !== "")
          .map((tok) => tok.replace(/,$/, "").trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"')),
  );
}
