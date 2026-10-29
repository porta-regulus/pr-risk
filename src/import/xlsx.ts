// XLSX through SheetJS Community Edition 0.20.3 from cdn.sheetjs.com (SPEC.md Sec. 9.4 item 1).
// The ZIP directory is checked before SheetJS reads anything, so a ZIP bomb is refused
// at its declared size (ADR-0004 D1).
import { read, utils } from 'xlsx';

export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 2000;

// Sum of the uncompressed sizes in the ZIP central directory.
export function zipUncompressedSize(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('The file is not a valid XLSX (no ZIP directory).');
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (entries > MAX_ENTRIES) throw new Error(`The XLSX holds more than ${String(MAX_ENTRIES)} parts.`);
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('The XLSX ZIP directory is damaged.');
    const size = view.getUint32(offset + 24, true);
    if (size === 0xffffffff) throw new Error('The XLSX uses ZIP64, which is larger than the limit.');
    total += size;
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return total;
}

// The cells of one sheet as text. Merged cells are unmerged into each cell of the range.
export function xlsxRows(bytes: Uint8Array, maxRows: number, sheetName?: string): string[][] {
  const size = zipUncompressedSize(bytes);
  if (size > MAX_UNCOMPRESSED_BYTES) throw new Error(`The XLSX unpacks to ${String(Math.round(size / 1048576))} MB, above the 50 MB limit.`);
  const book = read(bytes, { type: 'array', dense: true, cellFormula: false, cellHTML: false, cellStyles: false, sheetRows: maxRows });
  const name = sheetName ?? book.SheetNames[0];
  const sheet = name === undefined ? undefined : book.Sheets[name];
  if (sheet === undefined) throw new Error('The XLSX has no sheet to import.');
  const rows = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
  for (const range of sheet['!merges'] ?? []) {
    const value = rows[range.s.r]?.[range.s.c] ?? '';
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = rows[r];
      if (row === undefined) continue;
      for (let c = range.s.c; c <= range.e.c; c++) row[c] = value;
    }
  }
  // raw: false gives the formatted text of every cell.
  return rows;
}
