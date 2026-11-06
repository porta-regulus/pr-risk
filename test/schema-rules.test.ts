// Build task 2, done criteria 1 and 5. Mutations fail with the expected rule, and
// lint L-03 on example 1 reports exactly row 7 over row 6 (G1 d).
import { describe, expect, it } from 'vitest';
import { documentErrors, lint, readDocument, type Risk, type RiskDocument } from '../src/schema';
import { EXAMPLE_1, EXAMPLE_2, EXAMPLE_3, example } from './schema-helpers';

type Mutation = (doc: RiskDocument) => void;

function riskOf(doc: RiskDocument, id: string): Risk {
  const risk = doc.risks.find((item) => item.riskId === id);
  if (risk === undefined) throw new Error(`no risk ${id}`);
  return risk;
}

function rulesAfter(name: string, mutate: Mutation): string[] {
  const doc = example(name);
  mutate(doc);
  return [...new Set(documentErrors(doc).map((error) => error.rule))];
}

const mutable = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

const CASES: [string, string, Mutation, string][] = [
  ['wrong polarity for the response type', EXAMPLE_1, (doc) => { riskOf(doc, '2').riskResponseType = ['Mitigate']; }, 'SCHEMA'],
  ['positive response type on a negative risk', EXAMPLE_2, (doc) => { mutable(riskOf(doc, 'R-01'))['riskResponseType'] = ['Enhance']; }, 'SCHEMA'],
  ['unknown field', EXAMPLE_2, (doc) => { mutable(riskOf(doc, 'R-01'))['riskLikelyhood'] = 0.2; }, 'SCHEMA'],
  ['missing NIST field', EXAMPLE_2, (doc) => { delete mutable(riskOf(doc, 'R-01'))['riskOwnerPointOfContact']; }, 'SCHEMA'],
  ['lognormal with PERT fields', EXAMPLE_2, (doc) => { mutable(riskOf(doc, 'R-01').estimate?.frequency)['mode'] = 1; }, 'SCHEMA'],
  ['lognormal lower above upper', EXAMPLE_2, (doc) => {
    const frequency = riskOf(doc, 'R-01').estimate?.frequency;
    if (frequency?.type === 'lognormal') [frequency.lower, frequency.upper] = [frequency.upper ?? 0, frequency.lower ?? 0];
  }, 'V-10'],
  ['frequency above 100 per year', EXAMPLE_2, (doc) => {
    const frequency = riskOf(doc, 'R-01').estimate?.frequency;
    if (frequency?.type === 'lognormal') frequency.upper = 150;
  }, 'V-13'],
  ['unknown objective', EXAMPLE_2, (doc) => { riskOf(doc, 'R-01').objectiveIds = ['NO-SUCH-OBJECTIVE']; }, 'V-16'],
  ['unknown asset', EXAMPLE_2, (doc) => { riskOf(doc, 'R-01').assetIds = ['NO-SUCH-ASSET']; }, 'V-17'],
  ['unknown linked risk', EXAMPLE_2, (doc) => { riskOf(doc, 'R-01').linkedRisks = [{ riskId: 'NO-SUCH-RISK', relation: 'trade-off' }]; }, 'V-18'],
  ['linked risk is itself', EXAMPLE_2, (doc) => { riskOf(doc, 'R-01').linkedRisks = [{ riskId: 'R-01', relation: 'trade-off' }]; }, 'V-18'],
  ['onlyWithResponse without the reverse link', EXAMPLE_2, (doc) => {
    const risk = doc.risks.find((item) => item.onlyWithResponse !== undefined);
    const option = doc.responses?.find((item) => item.id === risk?.onlyWithResponse);
    if (option !== undefined) option.introducesRisks = [];
  }, 'V-19'],
  ['introducesRisks without onlyWithResponse', EXAMPLE_2, (doc) => {
    const risk = doc.risks.find((item) => item.onlyWithResponse !== undefined);
    if (risk !== undefined) delete risk.onlyWithResponse;
  }, 'V-19'],
  ['duplicate riskId', EXAMPLE_2, (doc) => { riskOf(doc, 'R-02').riskId = 'R-01'; }, 'V-01'],
  ['duplicate driver id', EXAMPLE_2, (doc) => {
    const [first, second] = doc.drivers ?? [];
    if (first !== undefined && second !== undefined) second.id = first.id;
  }, 'V-01'],
  ['register parent cycle', EXAMPLE_3, (doc) => {
    const [a] = doc.registers;
    const b = doc.registers[1];
    if (b !== undefined) {
      a.parentRegisterId = b.id;
      b.parentRegisterId = a.id;
    }
  }, 'V-02'],
  ['unknown register', EXAMPLE_2, (doc) => { riskOf(doc, 'R-01').registerId = 'NO-SUCH-REGISTER'; }, 'V-03'],
  ['unknown driver link', EXAMPLE_2, (doc) => {
    const risk = doc.risks.find((item) => (item.driverLinks ?? []).length > 0);
    const link = risk?.driverLinks?.[0];
    if (link !== undefined) link.driverId = 'NO-SUCH-DRIVER';
  }, 'V-05'],
  ['source is the risk itself', EXAMPLE_3, (doc) => {
    const risk = doc.risks.find((item) => (item.sourceRefs ?? []).length > 0);
    if (risk !== undefined) risk.sourceRefs = [{ registerId: risk.registerId, riskId: risk.riskId }];
  }, 'V-06'],
  ['exposure is not likelihood times impact', EXAMPLE_2, (doc) => { riskOf(doc, 'R-01').exposureRating += 10; }, 'V-07'],
  ['quantitative risk without estimate', EXAMPLE_2, (doc) => { delete riskOf(doc, 'R-01').estimate; }, 'V-08'],
  ['pending decision with a final response', EXAMPLE_2, (doc) => {
    const risk = riskOf(doc, 'R-01');
    risk.responseDecision = 'pending';
    risk.riskResponseType = ['Mitigate'];
  }, 'V-09'],
  ['label not on the strategy scale', EXAMPLE_1, (doc) => { riskOf(doc, '1').exposureRatingLabel = 'Extreme'; }, 'V-11'],
  ['previous reputation label not on the strategy scale (1.1.0)', EXAMPLE_1, (doc) => {
    riskOf(doc, '1').previousAssessment = { asOf: '2026-01-01', impacts: { reputation: { label: 'Extreme' } } };
  }, 'V-11'],
  ['unknown field in the previous impact split (1.1.0)', EXAMPLE_1, (doc) => {
    riskOf(doc, '1').previousAssessment = { asOf: '2026-01-01', impacts: { reputation: { label: 'High' } } };
    mutable(riskOf(doc, '1').previousAssessment?.impacts)['brand'] = { label: 'High' };
  }, 'SCHEMA'],
  ['unknown response cost rule (1.1.0)', EXAMPLE_3, (doc) => { mutable(riskOf(doc, 'ORG-1').rollUp)['responseCostRule'] = 'median'; }, 'SCHEMA'],
  ['tolerance curve not descending', EXAMPLE_2, (doc) => {
    const points = doc.appetite?.toleranceCurve?.points;
    const [first, second] = points ?? [];
    if (first !== undefined && second !== undefined) second.maxExceedanceProbability = first.maxExceedanceProbability;
  }, 'V-12'],
  ['response targets an unknown risk', EXAMPLE_2, (doc) => {
    const effect = doc.responses?.[0]?.effects[0];
    if (effect !== undefined) {
      effect.targetKind = 'risk';
      effect.targetId = 'NO-SUCH-RISK';
    }
  }, 'V-14'],
  ['forecast window ends before it starts', EXAMPLE_2, (doc) => {
    const forecast = doc.forecasts?.[0];
    if (forecast !== undefined) forecast.windowEnd = '2000-01-01';
  }, 'V-15'],
  ['forecast for an unknown risk', EXAMPLE_2, (doc) => {
    const forecast = doc.forecasts?.[0];
    if (forecast !== undefined) forecast.riskId = 'NO-SUCH-RISK';
  }, 'V-21'],
];

describe('mutations fail with the expected rule', () => {
  for (const [name, file, mutate, rule] of CASES) {
    it(`${name} gives ${rule}`, () => {
      const rules = rulesAfter(file, mutate);
      expect(rules).toContain(rule);
    });
  }

  it('every example is valid before mutation', () => {
    for (const file of [EXAMPLE_1, EXAMPLE_2, EXAMPLE_3]) expect(documentErrors(example(file))).toEqual([]);
  });
});

describe('lint', () => {
  it('L-03 on example 1 reports exactly row 7 over row 6 (G1 d)', () => {
    const dominance = lint(example(EXAMPLE_1)).filter((warning) => warning.rule === 'L-03');
    expect(dominance.map((warning) => warning.riskIds)).toEqual([['7', '6']]);
  });

  it('L-03 reports nothing on examples 2 and 3', () => {
    for (const file of [EXAMPLE_2, EXAMPLE_3]) expect(lint(example(file)).filter((warning) => warning.rule === 'L-03')).toEqual([]);
  });

  it('L-10 flags the summary with mixed response types in example 3 (G3 e)', () => {
    expect(lint(example(EXAMPLE_3)).filter((warning) => warning.rule === 'L-10').length).toBeGreaterThan(0);
  });

  it('L-01 needs simulated values and flags an inverted pair', () => {
    const doc = example(EXAMPLE_1);
    expect(lint(doc).filter((warning) => warning.rule === 'L-01')).toEqual([]);
    const f1 = riskOf(doc, 'F11-1');
    const f2 = riskOf(doc, 'F11-2');
    const values = new Map([
      [f1.riskId, 1_000_000],
      [f2.riskId, 10_000],
    ]);
    expect(lint(doc, { expectedAnnual: values }).filter((warning) => warning.rule === 'L-01').map((warning) => warning.riskIds)).toEqual([
      [f2.riskId, f1.riskId],
    ]);
  });
});

describe('readDocument', () => {
  it('reads every example', () => {
    for (const file of [EXAMPLE_1, EXAMPLE_2, EXAMPLE_3]) expect(readDocument(JSON.stringify(example(file))).ok).toBe(true);
  });

  it('reads a 1.0.0 document and a 1.1.0 document with the new optional fields (SPEC.md Sec. 7.7)', () => {
    const old = example(EXAMPLE_1);
    expect(old.schemaVersion).toBe('1.0.0');
    expect(readDocument(JSON.stringify(old)).ok).toBe(true);
    const doc = example(EXAMPLE_1);
    doc.schemaVersion = '1.1.0';
    riskOf(doc, '1').previousAssessment = { asOf: '2026-01-01', riskImpactLabel: 'High', impacts: { reputation: { label: 'Medium' }, mission: { label: 'High' } } };
    const read = readDocument(JSON.stringify(doc));
    expect(read.ok && read.doc.risks.find((risk) => risk.riskId === '1')?.previousAssessment?.impacts?.mission?.label).toBe('High');
  });

  it('reads a 1.2.0 document with the answers of the guided questions (release 2)', () => {
    const doc = example(EXAMPLE_2);
    doc.schemaVersion = '1.2.0';
    doc.appetite = { ...doc.appetite, elicitation: { heldOn: '2026-11-06', capacity: 3_000_000, points: [{ oneIn: 100, answers: ['accept', 'unknown'] }] } };
    const read = readDocument(JSON.stringify(doc));
    expect(read.ok && read.doc.appetite?.elicitation?.points?.[0]?.answers).toEqual(['accept', 'unknown']);
  });

  it('rejects a newer minor version, because it can hold fields that this app does not know', () => {
    const read = readDocument(JSON.stringify({ ...example(EXAMPLE_2), schemaVersion: '1.3.0' }));
    expect(read.ok).toBe(false);
    expect(!read.ok && read.errors[0]?.message).toBe('Schema version 1.3.0 is newer than this app. This app reads 1.0.0 to 1.2.0. Use a newer version of the app.');
  });

  it('rejects broken JSON, deep nesting, other major versions and __proto__ keys', () => {
    const doc = example(EXAMPLE_2);
    const cases = [
      '{"schemaVersion": ',
      `${'['.repeat(40)}${']'.repeat(40)}`,
      JSON.stringify({ ...doc, schemaVersion: '2.0.0' }),
      JSON.stringify(doc).replace('"riskId":"R-01"', '"__proto__":{"polluted":true},"riskId":"R-01"'),
    ];
    for (const text of cases) expect(readDocument(text).ok, text.slice(0, 40)).toBe(false);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('rejects Object.prototype key names that Ajv unevaluatedProperties lets through', () => {
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const doc = example(EXAMPLE_2);
      const risk = JSON.parse(JSON.stringify(riskOf(doc, 'R-01'))) as Record<string, unknown>;
      const text = JSON.stringify({ ...doc, risks: [{ ...risk, [`${key}_marker`]: 1 }] }).replace(`"${key}_marker"`, `"${key}"`);
      const result = readDocument(text);
      expect(result.ok, key).toBe(false);
      if (!result.ok) expect(result.errors[0]?.message).toContain(`/${key} is not an allowed property name`);
    }
  });
});
