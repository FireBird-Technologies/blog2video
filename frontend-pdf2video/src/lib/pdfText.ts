/**
 * Dependency-free, in-browser PDF text extraction.
 *
 * The free tools need to show a real result to a signed-out visitor before
 * asking for an account, which means the first pass has to run entirely on the
 * client — no upload, no API call, no pdf.js in the bundle. This module is
 * deliberately small: it walks the raw PDF byte stream, inflates the content
 * streams with the platform's own DecompressionStream, and reads the
 * text-showing operators out of the page description.
 *
 * What it handles: uncompressed and FlateDecode content streams, literal
 * `(...)` and hex `<...>` strings, the Tj / TJ / ' / " show operators, and the
 * positioning operators that imply a line or word break.
 *
 * What it does NOT handle: scanned/image-only PDFs (there is no text to find),
 * cross-reference streams whose content lives inside an /ObjStm, and custom
 * font encodings that don't map to Latin-1. Callers must treat a short or empty
 * result as "couldn't read this one" and fall back to the paste box — see
 * `extractPdfText`'s `ok` flag rather than inferring failure from length.
 */

const TEXT_DECODER = new TextDecoder("latin1");

export interface PdfExtraction {
  /** False when nothing usable came out — show the paste fallback. */
  ok: boolean;
  text: string;
  /** Page count read from the page tree, 0 when it couldn't be determined. */
  pageCount: number;
  /** Set when ok is false, safe to show to a user. */
  reason?: string;
}

/** Byte-wise indexOf for a latin1 needle, so we never re-encode the whole file. */
function indexOfBytes(haystack: Uint8Array, needle: string, from: number): number {
  const first = needle.charCodeAt(0);
  const limit = haystack.length - needle.length;
  for (let i = from; i <= limit; i += 1) {
    if (haystack[i] !== first) continue;
    let matched = true;
    for (let j = 1; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle.charCodeAt(j)) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

async function inflate(bytes: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

/**
 * Zlib-wrapped first, raw second. Producers are inconsistent about the two-byte
 * zlib header, and a raw stream fed to "deflate" fails immediately rather than
 * returning garbage, so trying both is cheap and unambiguous.
 */
async function inflateEither(bytes: Uint8Array): Promise<Uint8Array | null> {
  return (await inflate(bytes, "deflate")) ?? (await inflate(bytes, "deflate-raw"));
}

/** Decode a PDF literal string body (already stripped of its outer parens). */
function decodeLiteral(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    i += 1;
    switch (next) {
      case "n": out += "\n"; break;
      case "r": out += "\r"; break;
      case "t": out += "\t"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "(": out += "("; break;
      case ")": out += ")"; break;
      case "\\": out += "\\"; break;
      case "\n": break; // line continuation
      case "\r":
        if (raw[i + 1] === "\n") i += 1;
        break;
      default:
        if (next >= "0" && next <= "7") {
          let octal = next;
          while (octal.length < 3 && raw[i + 1] >= "0" && raw[i + 1] <= "7") {
            octal += raw[i + 1];
            i += 1;
          }
          out += String.fromCharCode(Number.parseInt(octal, 8));
        } else {
          out += next ?? "";
        }
    }
  }
  return out;
}

function decodeHex(raw: string): string {
  const clean = raw.replace(/[^0-9a-fA-F]/g, "");
  // UTF-16BE is the common case for hex strings; a 2-byte pair whose high byte
  // is 0 is just Latin-1 and decodes identically either way.
  if (clean.length % 4 === 0 && clean.length > 0) {
    let out = "";
    let looksUtf16 = false;
    for (let i = 0; i < clean.length; i += 4) {
      const code = Number.parseInt(clean.slice(i, i + 4), 16);
      if (code > 0xff) looksUtf16 = true;
      out += String.fromCharCode(code);
    }
    if (looksUtf16) return out;
  }
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

/**
 * Read the text-showing operators out of one decoded content stream.
 *
 * This is a scanner, not a parser: it tracks only enough state to know whether
 * it is inside a string, and treats the line-positioning operators as
 * whitespace hints. That is sufficient for word- and paragraph-level output,
 * which is all the tools need — none of them care about glyph positions.
 */
function readContentStream(content: string): string {
  let out = "";
  let i = 0;
  const len = content.length;

  const flushGap = (gap: string) => {
    if (!out.endsWith(gap) && out.length > 0) out += gap;
  };

  while (i < len) {
    const ch = content[i];

    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      let raw = "";
      while (j < len && depth > 0) {
        const c = content[j];
        if (c === "\\") {
          raw += c + (content[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (c === "(") depth += 1;
        if (c === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
        raw += c;
        j += 1;
      }
      out += decodeLiteral(raw);
      i = j + 1;
      continue;
    }

    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i + 1);
      if (close === -1) break;
      out += decodeHex(content.slice(i + 1, close));
      i = close + 1;
      continue;
    }

    // Operators that imply a break. `TJ` array gaps are handled crudely: a
    // large negative kern between two strings is a space, but distinguishing
    // that from tight tracking needs font metrics we don't have, so we rely on
    // the line operators instead and let the word joiner below tidy up.
    if (ch === "T") {
      const op = content.slice(i, i + 2);
      if (op === "T*" || op === "Td" || op === "TD" || op === "TL") {
        flushGap("\n");
        i += 2;
        continue;
      }
      if (op === "Tj" || op === "TJ") {
        i += 2;
        continue;
      }
    }

    if (ch === "E" && content.slice(i, i + 2) === "ET") {
      flushGap("\n");
      i += 2;
      continue;
    }

    i += 1;
  }

  return out;
}

/**
 * Collapse the scanner's raw output into readable prose.
 *
 * PDFs break lines for layout, not for meaning, so a hard-wrapped paragraph
 * arrives as a dozen short lines. Lines that end mid-sentence are re-joined;
 * blank lines and lines ending in sentence punctuation keep their break.
 */
export function tidyExtractedText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());

  const paragraphs: string[] = [];
  let current = "";

  for (const line of lines) {
    if (!line) {
      if (current) {
        paragraphs.push(current);
        current = "";
      }
      continue;
    }
    if (!current) {
      current = line;
      continue;
    }
    // A hyphen at the end of a line is a word split across the wrap.
    if (current.endsWith("-")) {
      current = `${current.slice(0, -1)}${line}`;
      continue;
    }
    if (/[.!?:;"'’”)\]]$/.test(current)) {
      paragraphs.push(current);
      current = line;
      continue;
    }
    current = `${current} ${line}`;
  }
  if (current) paragraphs.push(current);

  return paragraphs
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countPages(bytes: Uint8Array): number {
  // /Type /Page (not /Pages) appears once per page in the page tree. It is a
  // lower bound rather than a guarantee — pages inside object streams won't
  // show — which is why callers fall back to a word-count estimate.
  let count = 0;
  let from = 0;
  for (;;) {
    const at = indexOfBytes(bytes, "/Type", from);
    if (at === -1) break;
    const window = TEXT_DECODER.decode(bytes.subarray(at, at + 24));
    if (/^\/Type\s*\/Page[^s]/.test(window)) count += 1;
    from = at + 5;
  }
  return count;
}

/**
 * Pull the readable text out of a PDF file, entirely in the browser.
 *
 * Never throws: a PDF this can't read comes back with `ok: false` and a reason
 * suitable for display, because every caller's next move is the same — show the
 * paste box instead.
 */
export async function extractPdfText(file: File): Promise<PdfExtraction> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, text: "", pageCount: 0, reason: "That file could not be read." };
  }

  const header = TEXT_DECODER.decode(bytes.subarray(0, 5));
  if (header !== "%PDF-") {
    return { ok: false, text: "", pageCount: 0, reason: "That does not look like a PDF file." };
  }

  const pageCount = countPages(bytes);
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < bytes.length) {
    const streamAt = indexOfBytes(bytes, "stream", cursor);
    if (streamAt === -1) break;

    const endAt = indexOfBytes(bytes, "endstream", streamAt);
    if (endAt === -1) break;

    // The dictionary immediately before `stream` says how the bytes are coded.
    const dictStart = Math.max(0, streamAt - 900);
    const dict = TEXT_DECODER.decode(bytes.subarray(dictStart, streamAt));

    // Object streams hold compressed *objects*, not page content; decoding them
    // would need a full object parser, so they're skipped rather than fed to
    // the scanner as noise.
    const isObjStm = /\/Type\s*\/ObjStm/.test(dict);
    const isImage = /\/Subtype\s*\/Image/.test(dict) || /\/DCTDecode|\/JPXDecode|\/CCITTFaxDecode/.test(dict);

    if (!isObjStm && !isImage) {
      // Skip the EOL that must follow the `stream` keyword.
      let start = streamAt + "stream".length;
      if (bytes[start] === 0x0d) start += 1;
      if (bytes[start] === 0x0a) start += 1;

      const body = bytes.subarray(start, endAt);
      let decoded: string | null = null;

      if (/\/FlateDecode/.test(dict)) {
        const inflated = await inflateEither(body);
        if (inflated) decoded = TEXT_DECODER.decode(inflated);
      } else if (!/\/Filter/.test(dict)) {
        decoded = TEXT_DECODER.decode(body);
      }

      // Only page-description streams contain show operators; anything else
      // (fonts, metadata, colour profiles) fails this test and costs one regex.
      if (decoded && /\bTj\b|\bTJ\b|\bBT\b/.test(decoded)) {
        chunks.push(readContentStream(decoded));
      }
    }

    cursor = endAt + "endstream".length;
  }

  const text = tidyExtractedText(chunks.join("\n\n"));

  if (text.replace(/\s/g, "").length < 40) {
    return {
      ok: false,
      text: "",
      pageCount,
      reason:
        "We couldn't read text out of this PDF in the browser. It's probably a scan, or it stores its text in a format that needs server-side extraction.",
    };
  }

  return { ok: true, text, pageCount };
}

/** Read a plain-text/markdown file. Kept here so callers have one entry point. */
export async function readTextFile(file: File): Promise<string> {
  try {
    return tidyExtractedText(await file.text());
  } catch {
    return "";
  }
}

export const PDF_ACCEPT = ".pdf,application/pdf";
export const TEXT_ACCEPT = ".txt,.md,.markdown,text/plain,text/markdown";
export const DOC_ACCEPT = `${PDF_ACCEPT},${TEXT_ACCEPT}`;

/** True when a filename looks like something `extractPdfText` should be given. */
export function isPdfFile(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}
