// CSV per RFC 4180 (SPEC.md Sec. 9.4 item 1). UTF-8, UTF-8 with BOM or Windows-1252.
// Delimiter is comma, semicolon or tab, detected from the first lines.

export interface DecodedText {
  readonly text: string;
  readonly encoding: 'utf-8' | 'utf-8-bom' | 'windows-1252';
}

export function decodeText(bytes: Uint8Array): DecodedText {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8-bom' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

const DELIMITERS = [',', ';', '\t'] as const;
export type Delimiter = (typeof DELIMITERS)[number];

// The delimiter that splits the first lines into the most equal, largest field counts.
export function detectDelimiter(text: string): Delimiter {
  let best: Delimiter = ',';
  let bestScore = -1;
  for (const delimiter of DELIMITERS) {
    const counts = parseCsv(text, delimiter, 10).map((row) => row.length);
    if (counts.length === 0) continue;
    const first = counts[0] ?? 0;
    const consistent = counts.filter((count) => count === first).length;
    const score = first > 1 ? first * consistent : 0;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

// Rows of cells. Quoted cells may hold delimiters, line breaks and doubled quotes.
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text), maxRows = Number.POSITIVE_INFINITY): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const pushRow = (): void => {
    row.push(cell);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    cell = '';
  };
  while (i < text.length && rows.length < maxRows) {
    const ch = text[i] ?? '';
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRow();
    } else if (ch === '\n') {
      pushRow();
    } else {
      cell += ch;
    }
    i += 1;
  }
  if (rows.length < maxRows && (cell !== '' || row.length > 0)) pushRow();
  return rows;
}
