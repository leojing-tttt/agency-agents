import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function utf16BeHex(text: string): string {
  const units: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    units.push(text.charCodeAt(i));
  }
  return `FEFF${units.map((unit) => unit.toString(16).padStart(4, "0").toUpperCase()).join("")}`;
}

/** Minimal PDF with UTF-16BE text so the slice-1 extractor can read Chinese Briefs. */
export function buildSamplePdf(text: string): Buffer {
  const lines = text.split(/\n/).filter((line) => line.trim());
  const ops = lines
    .map((line, index) => {
      const hex = utf16BeHex(line);
      const y = 720 - index * 18;
      return `BT /F1 12 Tf 48 ${y} Td <${hex}> Tj ET`;
    })
    .join("\n");
  const stream = ops + "\n";
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}endstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = "%PDF-1.4\n".length;
  const xref = [0];
  const body: string[] = [];
  for (const obj of objects) {
    xref.push(offset);
    body.push(obj);
    offset += obj.length + 1;
  }
  const xrefStart = offset;
  const xrefTable = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...xref.slice(1).map((pos) => `${String(pos).padStart(10, "0")} 00000 n `),
  ].join("\n");
  const pdf = `%PDF-1.4
${body.join("\n")}
${xrefTable}
trailer << /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefStart}
%%EOF
`;
  return Buffer.from(pdf, "latin1");
}

export async function writeSamplePdf(outPath: string, text: string): Promise<void> {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, buildSamplePdf(text));
}
