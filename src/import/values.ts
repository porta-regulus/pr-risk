// Cell values (SPEC.md Sec. 9.4 item 5) and the category table (Sec. 6.7.7).

export type NumberLocale = 'dot' | 'comma';

// "1.234,56" (comma decimal) and "1,234.56" (dot decimal). The user confirms the locale once.
export function parseLocaleNumber(text: string, locale: NumberLocale): number | undefined {
  const cleaned = text.trim().replace(/[\s\u00a0\u202f']/g, '').replace(/^[€$£]|[€$£]$|eur$|usd$/gi, '');
  if (cleaned === '') return undefined;
  const normalized = locale === 'comma' ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

// Which locale the numbers of a column use. Undefined when no cell tells.
export function guessLocale(cells: readonly string[]): NumberLocale | undefined {
  for (const cell of cells) {
    const text = cell.trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) || /^\d+,\d{1,2}$/.test(text)) return 'comma';
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text) || /^\d+\.\d+$/.test(text)) return 'dot';
  }
  return undefined;
}

export interface CellValue {
  readonly number?: number;
  readonly label?: string;
  readonly percent?: boolean;
}

// "7.5% (Low)" gives 0.075 and "Low". "12%" gives 0.12. "Mod" gives a label. "3" gives 3.
export function parseCell(text: string, locale: NumberLocale): CellValue {
  const trimmed = text.trim();
  if (trimmed === '') return {};
  const compound = /^(.+?)\s*\(([^()]+)\)\s*$/.exec(trimmed);
  if (compound) {
    const inner = parseCell(compound[1] ?? '', locale);
    const label = (compound[2] ?? '').trim();
    return inner.number === undefined ? { label: trimmed } : { ...inner, label };
  }
  const percent = /^(.+?)\s*%$/.exec(trimmed);
  if (percent) {
    const value = parseLocaleNumber(percent[1] ?? '', locale);
    return value === undefined ? { label: trimmed } : { number: value / 100, percent: true };
  }
  const value = parseLocaleNumber(trimmed, locale);
  return value === undefined ? { label: trimmed } : { number: value };
}

// "OpEx: M CapEx: L" gives two financial labels (Fig. 10).
export function parseOpexCapex(text: string): { opex?: string; capex?: string } {
  const out: { opex?: string; capex?: string } = {};
  const opex = /opex\s*[:=]?\s*([^\s,;]+)/i.exec(text);
  const capex = /capex\s*[:=]?\s*([^\s,;]+)/i.exec(text);
  if (opex?.[1] !== undefined) out.opex = opex[1];
  if (capex?.[1] !== undefined) out.capex = capex[1];
  return out;
}

type ResponseType = 'Accept' | 'Avoid' | 'Transfer' | 'Mitigate' | 'Realize' | 'Share' | 'Enhance';

const NEGATIVE_WORDS: Readonly<Record<string, ResponseType>> = {
  treat: 'Mitigate',
  reduce: 'Mitigate',
  reduction: 'Mitigate',
  mitigate: 'Mitigate',
  mitigation: 'Mitigate',
  tolerate: 'Accept',
  retain: 'Accept',
  accept: 'Accept',
  terminate: 'Avoid',
  avoid: 'Avoid',
  transfer: 'Transfer',
  share: 'Transfer',
  insure: 'Transfer',
};

const POSITIVE_WORDS: Readonly<Record<string, ResponseType>> = {
  realize: 'Realize',
  realise: 'Realize',
  exploit: 'Realize',
  share: 'Share',
  enhance: 'Enhance',
  accept: 'Accept',
};

// Response words to the NIST enum, in order of first occurrence. Unknown words are returned.
export function parseResponseTypes(text: string, polarity: 'negative' | 'positive'): { types: ResponseType[]; unknown: string[] } {
  const table = polarity === 'negative' ? NEGATIVE_WORDS : POSITIVE_WORDS;
  const types: ResponseType[] = [];
  const unknown: string[] = [];
  for (const word of text.split(/[,;/+&]|\band\b/i).map((part) => part.trim().toLowerCase()).filter((part) => part !== '')) {
    const type = table[word];
    if (type === undefined) unknown.push(word);
    else if (!types.includes(type)) types.push(type);
  }
  return { types, unknown };
}

const STATUSES = ['Open', 'In treatment', 'Monitored', 'Accepted', 'Review needed', 'Closed'] as const;
export type Status = (typeof STATUSES)[number];

// Unknown values ("Updated" in the NIST XLSX) become Open with a warning.
export function parseStatus(text: string): { status: Status; known: boolean } {
  const wanted = text.trim().toLowerCase();
  const found = STATUSES.find((status) => status.toLowerCase() === wanted);
  return found === undefined ? { status: 'Open', known: false } : { status: found, known: true };
}

export interface CategoryGuess {
  readonly code: 'ict' | 'financial' | 'legal' | 'operational' | 'strategic' | 'safety' | 'reputation';
  readonly subcode?: string;
}

// The source label table of SPEC.md Sec. 6.7.7, for labels that a file can carry.
const CATEGORY_LABELS: Readonly<Record<string, CategoryGuess>> = {
  'operational risk': { code: 'operational' },
  'financial risk': { code: 'financial' },
  'strategic risk': { code: 'strategic' },
  'compliance risk': { code: 'legal' },
  'physical and environmental protection': { code: 'ict', subcode: 'ict.physical-environmental' },
  'system and information integrity': { code: 'ict', subcode: 'ict.malware' },
  'contingency planning': { code: 'ict', subcode: 'ict.availability' },
  'system and communications protection': { code: 'ict', subcode: 'ict.data-exfiltration' },
  'system and services acquisition': { code: 'ict', subcode: 'ict.supply-chain' },
  'access control': { code: 'ict', subcode: 'ict.identity' },
  'identification and authentication': { code: 'ict', subcode: 'ict.identity' },
  'configuration management': { code: 'ict', subcode: 'ict.misconfiguration' },
};

// SP 800-53 family codes, as the NIST XLSX Fig. 7 writes them in brackets. "IS" is the
// NIST typo for SI in that file.
const FAMILY_CODES: Readonly<Record<string, CategoryGuess>> = {
  PE: { code: 'ict', subcode: 'ict.physical-environmental' },
  SI: { code: 'ict', subcode: 'ict.malware' },
  IS: { code: 'ict', subcode: 'ict.malware' },
  CP: { code: 'ict', subcode: 'ict.availability' },
  SC: { code: 'ict', subcode: 'ict.data-exfiltration' },
  SA: { code: 'ict', subcode: 'ict.supply-chain' },
  AC: { code: 'ict', subcode: 'ict.identity' },
  IA: { code: 'ict', subcode: 'ict.identity' },
  CM: { code: 'ict', subcode: 'ict.misconfiguration' },
};

export function guessCategory(riskCategory: string): CategoryGuess | undefined {
  const text = riskCategory.trim();
  const family = /\(([A-Z]{2})\)\s*$/.exec(text)?.[1];
  if (family !== undefined && FAMILY_CODES[family] !== undefined) return FAMILY_CODES[family];
  const name = text
    .replace(/\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/\bsystems\b/g, 'system')
    .replace(/\bcomm\.?(?=\s|$)/g, 'communications')
    .replace(/\s+/g, ' ')
    .trim();
  return CATEGORY_LABELS[name];
}

// SPEC.md Sec. 9.4 item 5.8. A file has no polarity column. A description that names an
// opportunity is read as a positive risk, with a warning, and the user can change it.
export function looksPositive(description: string): boolean {
  return /\bopportunit(y|ies)\b/i.test(description);
}
