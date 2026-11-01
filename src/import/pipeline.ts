// The common import pipeline (SPEC.md Sec. 9.1) and merge with diff (Sec. 9.7).
// read -> detect -> map -> validate -> preview -> commit. Nothing changes before commit.
import { canonicalize } from '../schema/canonical';
import { depthOf, documentErrors, MAX_DOCUMENT_BYTES, MAX_JSON_DEPTH, readDocument, unsafeKeyPaths } from '../schema/document';
import { sha256Hex } from '../schema/sha256';
import type { Finding, Register, Risk, RiskDocument } from '../schema/types';
import { decodeText, parseCsv } from './csv';
import { importCvdPortal, isCvdPortalExport, type CvdOptions } from './cvd';
import { importIr8286, isIr8286 } from './ir8286';
import { statedVersion } from './stated';
import { tableToRisks, type TableOptions } from './table';
import { xlsxRows } from './xlsx';
import { importPoam } from '../oscal/poam';

export const MAX_ROWS = 5000;

export type ImportFormat = 'native' | 'ir8286-json' | 'csv' | 'xlsx' | 'cvd-portal-json' | 'oscal-poam' | 'unknown';

export interface ImportFile {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

export interface ImportOptions extends TableOptions {
  readonly importedOn?: string;
  readonly provenanceId?: string;
  readonly cvd?: Partial<CvdOptions>;
  readonly ir8286RegisterId?: string;
}

type ProvenanceRecord = NonNullable<RiskDocument['provenance']>[number];

export interface DiffEntry {
  readonly kind: 'risk' | 'register';
  readonly id: string;
  readonly field: string;
  readonly current: unknown;
  readonly incoming: unknown;
}

export interface ImportPreview {
  readonly format: ImportFormat;
  readonly registers: Register[];
  readonly risks: Risk[];
  readonly warnings: string[];
  // Errors of the merge into the open document.
  readonly errors: Finding[];
  readonly diff: DiffEntry[];
  // True when the file states only some fields of a risk (CSV, XLSX, NIST IR 8286). For a
  // matched risk, the risks above then hold the current risk with the stated fields of the file.
  readonly partial?: boolean;
  readonly provenance: ProvenanceRecord;
  // The whole document, when the file restores one without loss (native JSON, OSCAL payload).
  readonly document?: RiskDocument;
  // Errors of that whole document on its own, for a restore that replaces the open document.
  readonly documentErrors?: Finding[];
}

const isZip = (bytes: Uint8Array): boolean => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

// Detect by content first (Sec. 9.1 item 2), then by extension and magic bytes.
export function detectFormat(file: ImportFile): ImportFormat {
  if (isZip(file.bytes)) return /\.xlsx$/i.test(file.fileName) ? 'xlsx' : 'unknown';
  const text = decodeText(file.bytes).text.trimStart();
  if (text.startsWith('{') || text.startsWith('[')) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return 'unknown';
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if ('schemaVersion' in value) return 'native';
      if ('plan-of-action-and-milestones' in value) return 'oscal-poam';
      if (isCvdPortalExport(value)) return 'cvd-portal-json';
    }
    return isIr8286(value) ? 'ir8286-json' : 'unknown';
  }
  return /\.(csv|tsv|txt)$/i.test(file.fileName) || /[,;\t]/.test(text.split('\n')[0] ?? '') ? 'csv' : 'unknown';
}

function blocked(format: ImportFormat, file: ImportFile, importedOn: string, message: string, rule = 'IMPORT'): ImportPreview {
  return {
    format,
    registers: [],
    risks: [],
    warnings: [],
    errors: [{ rule, message }],
    diff: [],
    provenance: { id: 'PV-0', importedOn, format: format === 'unknown' ? 'native' : format, fileName: file.fileName, sha256: sha256Hex(file.bytes), recordCount: 0 },
  };
}

function diffOf(kind: DiffEntry['kind'], current: object | undefined, incoming: object, id: string): DiffEntry[] {
  if (current === undefined) return [];
  const keys = [...new Set([...Object.keys(current), ...Object.keys(incoming)])].sort();
  const a = current as Record<string, unknown>;
  const b = incoming as Record<string, unknown>;
  return keys
    .filter((key) => canonicalize(a[key] ?? null) !== canonicalize(b[key] ?? null))
    .map((field) => ({ kind, id, field, current: a[field], incoming: b[field] }));
}

// The list with each incoming item in the place of the item with its id, and new items at the end.
function replaced<T>(items: readonly T[], incoming: readonly T[], id: (item: T) => string): T[] {
  const byId = new Map(incoming.map((item) => [id(item), item]));
  const result = items.map((item) => byId.get(id(item)) ?? item);
  const existing = new Set(items.map(id));
  return [...result, ...incoming.filter((item) => !existing.has(id(item)))];
}

// The document after a commit of these registers and risks.
function merged(doc: RiskDocument, registers: readonly Register[], risks: readonly Risk[]): RiskDocument {
  return {
    ...doc,
    registers: replaced(doc.registers, registers, (register) => register.id) as RiskDocument['registers'],
    risks: replaced(doc.risks, risks, (risk) => risk.riskId),
  };
}

export function prepareImport(doc: RiskDocument, file: ImportFile, options: ImportOptions = {}): ImportPreview {
  const importedOn = options.importedOn ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const format = detectFormat(file);
  if (file.bytes.length > MAX_DOCUMENT_BYTES) return blocked(format, file, importedOn, 'The file is larger than 10 MB.', 'LIMIT');
  const head = decodeText(file.bytes.subarray(0, 1024)).text.trimStart();
  if (head.startsWith('{') || head.startsWith('[')) {
    // Limits and key screen for every JSON file, before the format decides anything.
    let value: unknown;
    try {
      value = JSON.parse(decodeText(file.bytes).text);
    } catch (error) {
      return blocked(format, file, importedOn, `The JSON cannot be read. ${error instanceof Error ? error.message : ''}`.trim());
    }
    if (depthOf(value) > MAX_JSON_DEPTH) return blocked(format, file, importedOn, `The JSON is nested deeper than ${String(MAX_JSON_DEPTH)} levels.`, 'LIMIT');
    const unsafe = unsafeKeyPaths(value);
    if (unsafe.length > 0) return blocked(format, file, importedOn, `${unsafe[0] ?? ''} is not an allowed property name.`, 'SCHEMA');
  }
  if (format === 'unknown') return blocked(format, file, importedOn, 'The format is not known. Use native JSON, NIST IR 8286 JSON, a CVD Portal export or CSV.');

  const text = decodeText(file.bytes).text;
  let registers: Register[] = [];
  let risks: Risk[];
  let warnings: string[] = [];
  let recordCount: number;
  let columnMapping: Record<string, string> | undefined;
  let stated: ReadonlyMap<string, readonly string[]> | undefined;
  let document: RiskDocument | undefined;
  try {
    if (format === 'csv' || format === 'xlsx') {
      const rows = format === 'csv' ? parseCsv(text) : xlsxRows(file.bytes, MAX_ROWS + 22);
      if (rows.length > MAX_ROWS + 1) return blocked(format, file, importedOn, `The file has more than ${String(MAX_ROWS)} rows.`, 'LIMIT');
      const result = tableToRisks(doc, rows, options);
      ({ registers, risks, warnings, columnMapping, stated } = result);
      recordCount = risks.length;
    } else {
      const value = JSON.parse(text) as unknown;
      if (format === 'native') {
        const read = readDocument(text);
        if (!read.ok) return { ...blocked(format, file, importedOn, 'The document is not valid.'), errors: [...read.errors] };
        registers = [...read.doc.registers];
        risks = read.doc.risks;
        recordCount = risks.length;
        document = read.doc;
      } else if (format === 'oscal-poam') {
        const result = importPoam(value, doc, importedOn.slice(0, 10));
        warnings = [...result.report];
        if (result.path === 'lossless') {
          document = result.document;
          registers = [...result.document.registers];
          risks = result.document.risks;
        } else {
          ({ registers, risks } = result);
        }
        recordCount = risks.length;
      } else if (format === 'cvd-portal-json') {
        const result = importCvdPortal(doc, value, { asOf: options.cvd?.asOf ?? importedOn.slice(0, 10), ...(options.cvd?.parentRegisterId === undefined ? {} : { parentRegisterId: options.cvd.parentRegisterId }) });
        ({ registers, risks, warnings, recordCount } = result);
      } else {
        const registerId = options.ir8286RegisterId ?? options.register?.id;
        if (registerId === undefined) return blocked(format, file, importedOn, 'Choose a target register for the NIST entries.');
        const result = importIr8286(value, registerId);
        ({ risks, warnings, recordCount, stated } = result);
        if (options.register !== undefined && !doc.registers.some((register) => register.id === registerId)) registers = [options.register];
      }
    }
  } catch (error) {
    return blocked(format, file, importedOn, error instanceof Error ? error.message : String(error));
  }
  if (stated !== undefined) {
    // Sec. 9.7. The file changes only the fields that it states of a matched risk.
    const fields = stated;
    risks = risks.map((risk) => {
      const current = doc.risks.find((item) => item.riskId === risk.riskId);
      const pointers = fields.get(risk.riskId);
      return current === undefined || pointers === undefined ? risk : statedVersion(current, risk, pointers);
    });
  }

  const provenance: ProvenanceRecord = {
    id: options.provenanceId ?? `PV-${String((doc.provenance ?? []).length + 1)}`,
    importedOn,
    format,
    fileName: file.fileName,
    sha256: sha256Hex(file.bytes),
    recordCount,
    ...(columnMapping === undefined ? {} : { columnMapping }),
    ...(warnings.length === 0 ? {} : { warnings }),
  };
  const diff = [
    ...registers.flatMap((register) => diffOf('register', doc.registers.find((item) => item.id === register.id), register, register.id)),
    ...risks.flatMap((risk) => diffOf('risk', doc.risks.find((item) => item.riskId === risk.riskId), risk, risk.riskId)),
  ];
  const errors = documentErrors({ ...merged(doc, registers, risks), provenance: [...(doc.provenance ?? []), provenance] });
  return {
    format,
    registers,
    risks,
    warnings,
    errors,
    diff,
    ...(stated === undefined ? {} : { partial: true }),
    provenance,
    ...(document === undefined ? {} : { document, documentErrors: documentErrors(replacement(document, provenance)) }),
  };
}

export type Choice = 'current' | 'incoming' | 'both';
// A register has no keep both, because its risks point to its id.
export type RegisterChoice = Exclude<Choice, 'both'>;

// The choice per matched risk id and per matched register id. The default is 'incoming'.
export interface ImportChoices {
  readonly risks?: Readonly<Record<string, Choice>>;
  readonly registers?: Readonly<Record<string, RegisterChoice>>;
}

// Provenance ids must stay unique (rule V-01) after the record joins a document.
function withUniqueId(record: ProvenanceRecord, existing: readonly ProvenanceRecord[]): ProvenanceRecord {
  const taken = new Set(existing.map((item) => item.id));
  if (!taken.has(record.id)) return record;
  let n = existing.length + 1;
  while (taken.has(`PV-${String(n)}`)) n += 1;
  return { ...record, id: `PV-${String(n)}` };
}

// The restored document as it is saved. Its provenance and change log continue.
function replacement(document: RiskDocument, provenance: ProvenanceRecord, actor?: string): RiskDocument {
  return {
    ...document,
    provenance: [...(document.provenance ?? []), withUniqueId(provenance, document.provenance ?? [])],
    changeLog: [...(document.changeLog ?? []), { at: provenance.importedOn, entityKind: 'context', entityId: document.document.id, path: '', ...(actor === undefined ? {} : { actor }) }],
  };
}

// Sec. 9.7. Per matched entity the user keeps current, takes incoming, or keeps both
// (incoming gets a new id). The change log records the result. A matched entity without a
// changed field adds nothing.
export function commitImport(
  doc: RiskDocument,
  preview: ImportPreview,
  choices: ImportChoices = {},
  actor?: string,
  mode: 'merge' | 'replace' = 'merge',
): RiskDocument {
  if (mode === 'replace') {
    // Replace the open document with the imported one. Only the incoming document must be valid.
    if (preview.document === undefined) throw new Error('Only a whole document can replace the open document');
    const replaced = replacement(preview.document, preview.provenance, actor);
    const replaceErrors = documentErrors(replaced);
    if (replaceErrors.length > 0) throw new Error(`The imported document is not valid: ${replaceErrors[0]?.message ?? ''}`);
    return replaced;
  }
  if (preview.errors.length > 0) throw new Error('The import has errors and cannot be committed');
  const at = preview.provenance.importedOn;
  const by = actor === undefined ? {} : { actor };
  const changed = new Set(preview.diff.map((entry) => `${entry.kind} ${entry.id}`));
  const taken = new Set(doc.risks.map((risk) => risk.riskId));
  const incoming: Risk[] = [];
  const log: NonNullable<RiskDocument['changeLog']> = [];
  for (const risk of preview.risks) {
    const exists = taken.has(risk.riskId);
    const choice = exists ? (choices.risks?.[risk.riskId] ?? 'incoming') : 'incoming';
    if (choice === 'current' || (exists && choice === 'incoming' && !changed.has(`risk ${risk.riskId}`))) continue;
    let id = risk.riskId;
    if (choice === 'both') {
      let n = 2;
      while (taken.has(`${risk.riskId}-${String(n)}`)) n += 1;
      id = `${risk.riskId}-${String(n)}`;
      taken.add(id);
    }
    const before = choice === 'incoming' ? doc.risks.find((item) => item.riskId === id) : undefined;
    incoming.push({ ...risk, riskId: id });
    log.push({ at, entityKind: 'risk', entityId: id, path: '', ...by, ...(before === undefined ? {} : { before }), after: { ...risk, riskId: id } });
  }
  const registers: Register[] = [];
  for (const register of preview.registers) {
    const before = doc.registers.find((item) => item.id === register.id);
    const choice = before === undefined ? 'incoming' : (choices.registers?.[register.id] ?? 'incoming');
    if (choice === 'current' || (before !== undefined && !changed.has(`register ${register.id}`))) continue;
    registers.push(register);
    log.push({ at, entityKind: 'register', entityId: register.id, path: '', ...by, ...(before === undefined ? {} : { before }), after: register });
  }
  const result = merged(doc, registers, incoming);
  const committed: RiskDocument = {
    ...result,
    provenance: [...(doc.provenance ?? []), withUniqueId(preview.provenance, doc.provenance ?? [])],
    changeLog: [...(doc.changeLog ?? []), ...log],
  };
  const errors = documentErrors(committed);
  if (errors.length > 0) throw new Error(`The merged document is not valid: ${errors[0]?.message ?? ''}`);
  return committed;
}
