/**
 * Slice-1 PDF text extractor.
 * Real: uncompressed PDF string literals and UTF-16BE hex strings (`<FEFF...>`).
 * Not a full PDF engine — compressed / binary Brief PDFs return empty text and
 * the skill raises open_questions instead of inventing content.
 */
export function extractSourceText(
  filename: string,
  bytes: Uint8Array,
): { text: string; pages: string[] } {
  const isPdf =
    filename.toLowerCase().endsWith(".pdf") ||
    (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
  if (!isPdf) {
    const text = new TextDecoder("utf-8").decode(bytes);
    return { text, pages: [text] };
  }
  const latin = Buffer.from(bytes).toString("latin1");
  const pages = splitPdfPages(latin).map(extractPdfStrings);
  const text = pages.join("\n\n");
  return { text, pages: pages.filter(Boolean) };
}

function splitPdfPages(source: string): string[] {
  const parts = source.split(/\/Type\s*\/Page[^s]/);
  if (parts.length <= 1) {
    return [source];
  }
  return parts.slice(1);
}

function extractPdfStrings(source: string): string {
  const chunks: string[] = [];
  const hex = source.matchAll(/<([0-9A-Fa-f\s]+)>/g);
  for (const match of hex) {
    const hexBody = (match[1] ?? "").replace(/\s+/g, "");
    if (hexBody.startsWith("FEFF") || hexBody.startsWith("feff")) {
      chunks.push(decodeUtf16BeHex(hexBody.slice(4)));
    }
  }
  const literals = source.matchAll(/\((?:\\.|[^\\)])*\)/g);
  for (const match of literals) {
    const inner = match[0].slice(1, -1).replace(/\\n/g, "\n").replace(/\\(.)/g, "$1");
    if (inner.trim()) {
      chunks.push(inner);
    }
  }
  return chunks.join("\n");
}

function decodeUtf16BeHex(hex: string): string {
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length % 2 === 1) {
    return "";
  }
  const units: number[] = [];
  for (let i = 0; i < bytes.length; i += 2) {
    units.push((bytes[i] ?? 0) * 256 + (bytes[i + 1] ?? 0));
  }
  return String.fromCharCode(...units);
}

export function looksLikeBrief(filename: string, text: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.includes("brief")) {
    return true;
  }
  return /(brief|客户要|种草|预算|kpi|目标[:：])/i.test(text);
}
