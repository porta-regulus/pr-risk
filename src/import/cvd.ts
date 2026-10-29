// CVD Portal vulnerability export to evidence and risks (SPEC.md Sec. 9.5).
// description, stepsToReproduce and impact are never read (ADR-0004 I4).
import type { Register, Risk, RiskDocument } from '../schema/types';

interface Submission {
  readonly id: string;
  readonly productName: string;
  readonly productIdentifier: string | null;
  readonly vulnerabilityType: string;
  readonly severity: string;
  readonly status: string;
  readonly createdAt: string;
}

const TYPE_TEXT: Readonly<Record<string, string>> = {
  XSS: 'cross-site scripting',
  SQL_INJECTION: 'SQL injection',
  CSRF: 'cross-site request forgery',
  SSRF: 'server-side request forgery',
  RCE: 'remote code execution',
  IDOR: 'insecure direct object reference',
  AUTH_BYPASS: 'authentication bypass',
  INFO_DISCLOSURE: 'information disclosure',
  DOS: 'denial of service',
  OTHER: 'other',
};
const CLOSED = new Set(['RESOLVED', 'DISMISSED']);
const NOTE = 'Not estimated. The numeric NIST fields are placeholders until the owner enters estimates (rule E-02).';

export function isCvdPortalExport(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const record = value as { meta?: { count?: unknown }; data?: unknown };
  return typeof record.meta?.count === 'number' && Array.isArray(record.data) && record.data.every((item) => typeof (item as { vulnerabilityType?: unknown }).vulnerabilityType === 'string');
}

// Copy only the allowed fields. Nothing else of a submission reaches the document.
function readSubmission(raw: unknown, index: number): Submission {
  const item = raw as Record<string, unknown>;
  const text = (key: string): string => {
    const value = item[key];
    if (typeof value !== 'string' || value === '') throw new Error(`Submission ${String(index + 1)} has no ${key}`);
    return value;
  };
  const identifier = item['productIdentifier'];
  return {
    id: text('id'),
    productName: text('productName'),
    productIdentifier: typeof identifier === 'string' && identifier !== '' ? identifier : null,
    vulnerabilityType: text('vulnerabilityType'),
    severity: text('severity'),
    status: text('status'),
    createdAt: text('createdAt'),
  };
}

export interface CvdOptions {
  readonly parentRegisterId?: string;
  readonly asOf: string;
}

export interface CvdResult {
  readonly risks: Risk[];
  readonly registers: Register[];
  readonly updated: string[];
  readonly warnings: string[];
  readonly recordCount: number;
}

const productKey = (submission: Submission): string => submission.productIdentifier ?? submission.productName;
const scopeOf = (key: string): string => `CVD Portal product ${key}`;

function registerIdFor(key: string, taken: ReadonlySet<string>): string {
  const short = key.split(/[-\s]/)[0]?.toUpperCase().replace(/[^A-Z0-9._-]/g, '') ?? '';
  const full = key.toUpperCase().replace(/[^A-Z0-9._-]+/g, '-');
  return short !== '' && !taken.has(short) ? short : full;
}

export function importCvdPortal(doc: RiskDocument, json: unknown, options: CvdOptions): CvdResult {
  if (!isCvdPortalExport(json)) throw new Error('The file is not a CVD Portal vulnerability export');
  const exported = json as { meta: { count: number; capped?: boolean }; data: unknown[] };
  const submissions = exported.data.map(readSubmission);
  const warnings = ['description, stepsToReproduce and impact were not imported (data minimization).'];
  warnings.push(exported.meta.capped === true ? 'meta.capped is true, so the export is incomplete. Export again with a filter.' : 'meta.capped is false, so the export is complete.');

  const parent = options.parentRegisterId === undefined ? undefined : doc.registers.find((register) => register.id === options.parentRegisterId);
  const takenRegisters = new Set(doc.registers.map((register) => register.id));
  const registers: Register[] = [];
  const risks: Risk[] = [];
  const updated: string[] = [];

  const products = new Map<string, Submission[]>();
  for (const submission of submissions) products.set(productKey(submission), [...(products.get(productKey(submission)) ?? []), submission]);

  for (const [key, items] of products) {
    let register = doc.registers.find((item) => item.scope === scopeOf(key));
    if (register === undefined) {
      register = {
        id: registerIdFor(key, takenRegisters),
        title: `${items[0]?.productName ?? key} product`,
        level: 'system',
        scope: scopeOf(key),
        timeframeMonths: parent?.timeframeMonths ?? 12,
        asOf: options.asOf,
        method: parent?.method ?? 'qualitative',
        ...(parent === undefined ? {} : { parentRegisterId: parent.id }),
      };
      takenRegisters.add(register.id);
      registers.push(register);
    }
    const registerId = register.id;
    const productName = items[0]?.productName ?? key;
    const existing = doc.risks.filter((risk) => risk.registerId === registerId);
    let next = existing.length + 1;
    const types = [...new Set(items.map((item) => item.vulnerabilityType))].sort();
    for (const type of types) {
      const group = items.filter((item) => item.vulnerabilityType === type);
      const evidence = group.map((item) => ({
        kind: 'cvd-portal-submission' as const,
        ref: `cvdp:${item.id}`,
        summary: `${type} ${item.severity}`,
        severity: item.severity,
        status: item.status,
        date: item.createdAt.slice(0, 10),
      }));
      const match = existing.find((risk) => (risk.evidence ?? []).some((entry) => entry.kind === 'cvd-portal-submission' && entry.summary?.split(' ')[0] === type));
      const merged = match === undefined ? evidence : [...(match.evidence ?? []).filter((entry) => !evidence.some((item) => item.ref === entry.ref)), ...evidence];
      const submissionEvidence = merged.filter((entry) => entry.kind === 'cvd-portal-submission');
      const open = submissionEvidence.filter((entry) => !CLOSED.has(entry.status ?? '')).length;
      const description = `If an attacker exploits a reported ${TYPE_TEXT[type] ?? type.toLowerCase().replace(/_/g, ' ')} vulnerability in ${productName}, then customer data or device control is compromised. Evidence ${String(submissionEvidence.length)} reports, ${String(open)} open.`;
      if (match !== undefined) {
        // Re-import. Update evidence and text, ask for a review, never touch estimates.
        const changed = JSON.stringify(match.evidence) !== JSON.stringify(merged);
        risks.push({ ...structuredClone(match), riskDescription: description, evidence: merged, ...(changed ? { status: 'Review needed' } : {}) });
        updated.push(match.riskId);
        continue;
      }
      risks.push({
        riskId: `${registerId}-${String(next)}`,
        registerId,
        polarity: 'negative',
        riskDescription: description,
        riskCategory: 'Product vulnerability',
        category: { code: 'ict', subcode: 'ict.vulnerability' },
        riskLikelihood: 0,
        riskImpact: 0,
        exposureRating: 0,
        riskResponseType: ['Accept'],
        riskResponseCost: 0,
        riskResponseDescription: 'Interim acceptance pending estimate and decision.',
        riskOwnerPointOfContact: 'Unassigned',
        status: 'Open',
        responseDecision: 'pending',
        evidence,
        defaultedFields: ['/riskLikelihood', '/riskImpact', '/exposureRating', '/riskOwnerPointOfContact'],
        notes: NOTE,
      });
      next += 1;
    }
  }
  return { risks, registers, updated, warnings, recordCount: submissions.length };
}
