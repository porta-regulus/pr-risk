// Header detection and synonyms (SPEC.md Sec. 9.4 items 2 to 4).

export type Target =
  | 'registerId'
  | 'riskId'
  | 'priority'
  | 'riskDescription'
  | 'riskCategory'
  | 'likelihood'
  | 'impact'
  | 'exposure'
  | 'financialImpact'
  | 'reputationImpact'
  | 'missionImpact'
  | 'objectiveIds'
  | 'riskResponseType'
  | 'riskResponseCost'
  | 'riskResponseDescription'
  | 'implementedResponseDescription'
  | 'riskOwnerPointOfContact'
  | 'status'
  | 'reviewDue';

// Trim, collapse spaces, lower case, remove punctuation. The NIST template has leading spaces.
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// The order matters. The first target whose synonym list holds the header wins, and a
// target takes only its first matching column.
const SYNONYMS: readonly (readonly [Target, readonly string[]])[] = [
  ['registerId', ['register', 'register id', 'system', 'system id']],
  ['riskId', ['risk id', 'id', 'ref', 'reference', 'risk no', 'nr', 'number']],
  ['priority', ['pri', 'priority', 'rank']],
  ['riskDescription', ['risk description', 'description', 'risk', 'risk title', 'title', 'scenario', 'risk statement']],
  ['riskCategory', ['risk category', 'category', 'type', 'risk type', 'domain']],
  ['likelihood', ['risk likelihood', 'likelihood', 'probability', 'prob', 'chance', 'frequency']],
  ['impact', ['risk impact', 'impact', 'consequence', 'severity', 'magnitude']],
  ['exposure', ['exposure rating', 'exposure', 'risk score', 'score', 'risk level', 'rating', 'inherent risk']],
  ['financialImpact', ['financial impact', 'opex', 'capex']],
  ['reputationImpact', ['reputation impact', 'reputational impact']],
  ['missionImpact', ['mission impact', 'operational impact']],
  ['objectiveIds', ['objective', 'enterprise objective']],
  ['riskResponseType', ['risk response type', 'response type', 'treatment', 'treatment option', 'strategy']],
  ['riskResponseCost', ['risk response cost', 'cost', 'treatment cost', 'budget']],
  [
    'riskResponseDescription',
    ['risk response description', 'risk response', 'response', 'treatment plan', 'mitigation', 'actions', 'controls', 'proposed risk response'],
  ],
  ['implementedResponseDescription', ['current risk response', 'current controls', 'existing controls']],
  ['riskOwnerPointOfContact', ['risk owner point of contact', 'risk owner', 'owner', 'responsible', 'accountable']],
  ['status', ['status', 'state']],
  ['reviewDue', ['review date', 'next review', 'due date', 'follow up date']],
];

export function targetOf(header: string): Target | undefined {
  const name = normalizeHeader(header);
  return SYNONYMS.find(([, names]) => names.includes(name))?.[0];
}

// The first row in the first 20 rows where at least 3 cells match a synonym.
export function findHeaderRow(rows: readonly (readonly string[])[]): number {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const matches = (rows[i] ?? []).filter((cell) => targetOf(cell) !== undefined).length;
    if (matches >= 3) return i;
  }
  return -1;
}

export interface ColumnMapping {
  // Column index to target.
  readonly columns: ReadonlyMap<number, Target>;
  // Header text to JSON pointer, as stored in the provenance record.
  readonly record: Readonly<Record<string, string>>;
  readonly unmapped: readonly string[];
}

const POINTER: Record<Target, string> = {
  registerId: '/registerId',
  riskId: '/riskId',
  priority: '/priority',
  riskDescription: '/riskDescription',
  riskCategory: '/riskCategory',
  likelihood: '/riskLikelihood',
  impact: '/riskImpact',
  exposure: '/exposureRating',
  financialImpact: '/impacts/financial',
  reputationImpact: '/impacts/reputation/label',
  missionImpact: '/impacts/mission/label',
  objectiveIds: '/objectiveIds',
  riskResponseType: '/riskResponseType',
  riskResponseCost: '/riskResponseCost',
  riskResponseDescription: '/riskResponseDescription',
  implementedResponseDescription: '/detail/implementedResponseDescription',
  riskOwnerPointOfContact: '/riskOwnerPointOfContact',
  status: '/status',
  reviewDue: '/reviewDue',
};

export function mapColumns(headers: readonly string[], overrides: Readonly<Record<string, Target | null>> = {}): ColumnMapping {
  const columns = new Map<number, Target>();
  const taken = new Set<Target>();
  const record: Record<string, string> = {};
  const unmapped: string[] = [];
  headers.forEach((header, index) => {
    const label = header.trim();
    const override = overrides[label];
    const target = override === undefined ? targetOf(header) : (override ?? undefined);
    if (target === undefined || taken.has(target)) {
      if (label !== '') unmapped.push(label);
      return;
    }
    taken.add(target);
    columns.set(index, target);
    record[label] = POINTER[target];
  });
  return { columns, record, unmapped };
}

export function pointerOf(target: Target): string {
  return POINTER[target];
}
