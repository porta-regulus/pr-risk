// Rules of screens S4 and S5 that the record and the change log depend on.
import { describe, expect, it } from 'vitest';
import { priorityNumbers } from '../src/engine';
import { documentErrors, type ResponseOption, type RiskDocument } from '../src/schema';
import riskletData from '../src/catalogue/risklet.json';
import { CATALOGUE, fromCatalogue, riskletSubcode } from '../src/ui/catalogue';
import { documentChanges, withChangeLog } from '../src/ui/edit';
import { newRisk } from '../src/ui/identify';
import { proposedPriorities, simulationKey } from '../src/ui/prioritize';
import { residualRisks } from '../src/ui/record';
import { SUBCODES } from '../src/ui/risk-editor';
import { TABLE_2, templateStatement } from '../src/ui/templates';
import { example, EXAMPLE_1, EXAMPLE_2 } from './schema-helpers';

const doc = example(EXAMPLE_2);

describe('S4 priorities (SPEC.md Sec. 6.9 and 6.16)', () => {
  const numbers = priorityNumbers(doc, 20_000, doc.simulation?.seed ?? 0);

  it('ranks by expected annual loss within each register, as the priorities of example 2 do', () => {
    const proposed = proposedPriorities(doc, numbers.state.risks);
    const stored = new Map(doc.risks.filter((risk) => proposed.has(risk.riskId)).map((risk) => [risk.riskId, risk.priority]));
    // Example 2 gives R-05 priority 6. Its register has 5 simulated negative risks, so the proposal is 5.
    expect(Object.fromEntries(proposed)).toEqual({ ...Object.fromEntries(stored), 'R-05': 5 });
  });

  it('a change of text keeps the simulation key, a change of an estimate does not', () => {
    const key = simulationKey(doc);
    expect(key).toBeDefined();
    const text: RiskDocument = { ...doc, risks: doc.risks.map((risk, i) => (i === 0 ? { ...risk, riskDescription: 'Changed text of the risk.', priority: 9 } : risk)) };
    expect(simulationKey(text)).toBe(key);
    const r1 = doc.risks[0];
    if (r1?.estimate === undefined) throw new Error('example 2 risk 1 has an estimate');
    const estimate: RiskDocument = {
      ...doc,
      risks: doc.risks.map((risk, i) => (i === 0 ? { ...risk, estimate: { ...r1.estimate, rationale: 'Another rationale.' } } : risk)),
    } as RiskDocument;
    expect(simulationKey(estimate)).not.toBe(key);
  });

  it('a document without an estimate has no simulation', () => {
    expect(simulationKey({ ...doc, risks: doc.risks.map(({ estimate: _drop, ...risk }) => risk) })).toBeUndefined();
  });
});

describe('S5 residual risks (SPEC.md Sec. 4 and 8.12 item 4)', () => {
  it('lists the risks with Accept or a pending decision that no funded option reaches', () => {
    expect(residualRisks(doc, ['O-4', 'O-5']).map((risk) => risk.riskId)).toEqual(['R-02', 'R-03', 'R-04', 'R-05', 'R-07']);
  });

  it('a risk that a response introduces counts only when that response is funded', () => {
    expect(residualRisks(doc, ['O-1', 'O-3', 'O-4']).some((risk) => risk.onlyWithResponse === 'O-3')).toBe(
      doc.risks.some((risk) => risk.onlyWithResponse === 'O-3' && (risk.riskResponseType.includes('Accept') || risk.responseDecision === 'pending')),
    );
    expect(residualRisks(doc, []).some((risk) => risk.onlyWithResponse !== undefined)).toBe(false);
  });
});

describe('change log of response options (SPEC.md Sec. 6.18)', () => {
  it('a changed option gets one entry with kind response', () => {
    const options = doc.responses ?? [];
    const changed: RiskDocument = { ...doc, responses: options.map((option, i): ResponseOption => (i === 0 ? { ...option, owner: 'CFO' } : option)) };
    const changes = documentChanges(doc, changed);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ entityKind: 'response', entityId: options[0]?.id });
    expect(withChangeLog(doc, changed, '2026-10-29T12:00:00Z').changeLog?.at(-1)).toMatchObject({ entityKind: 'response' });
  });
});

describe('S2 templates of SP 800-221r1 Table 2 (SPEC.md Sec. 6.5 item 4)', () => {
  it('has the five example pairs, and each one gives a valid statement with a new id', () => {
    expect(TABLE_2.map((template) => template.enterprise)).toEqual([
      'Global Retail Firm',
      'Government Agency',
      'Internet Service Provider',
      'Academic Institution',
      'Healthcare Provider',
    ]);
    let current = example(EXAMPLE_1);
    for (const template of TABLE_2) {
      const statements = current.appetite?.statements ?? [];
      const added = templateStatement(statements, template);
      expect(statements.map((item) => item.id)).not.toContain(added.id);
      current = { ...current, appetite: { ...current.appetite, statements: [...statements, added] } };
    }
    expect(documentErrors(current)).toEqual([]);
  });
});

describe('S3 catalogue picker (SPEC.md Sec. 6.7.1 item 3)', () => {
  it('a template gives text, polarity and category, and never numbers (hard rule 2)', () => {
    for (const entry of CATALOGUE) {
      const risk = fromCatalogue(newRisk(doc, 'CORP', entry.text, entry.polarity), entry);
      expect(risk.riskDescription).toBe(entry.text);
      expect(risk.estimate).toBeUndefined();
      expect([risk.riskLikelihood, risk.riskImpact, risk.exposureRating]).toEqual([0, 0, 0]);
      expect(risk.defaultedFields).toEqual(['/riskLikelihood', '/riskImpact', '/exposureRating']);
      expect(risk.catalogueRef).toEqual({ catalogue: entry.catalogue, id: entry.id });
      const qualitative: RiskDocument = { ...doc, registers: doc.registers.map((register) => ({ ...register, method: 'qualitative' })) as RiskDocument['registers'] };
      expect(documentErrors({ ...qualitative, risks: [...qualitative.risks, risk] })).toEqual([]);
    }
  });
});

describe('Risklet catalogue (SPEC.md Sec. 6.7.7, Q3 answered 2026-10-29)', () => {
  const risklet = CATALOGUE.filter((entry) => entry.catalogue === 'Risklet');
  const subcodeOf = (id: string): string | undefined => risklet.find((entry) => entry.id === id)?.category.subcode;

  it('ships all 119 names with 39 labels, each mapped to a release 1 subcode', () => {
    expect(risklet).toHaveLength(119);
    expect(new Set(risklet.map((entry) => entry.group)).size).toBe(39);
    for (const entry of risklet) {
      expect(entry.polarity).toBe('negative');
      expect(
        SUBCODES[entry.category.code].map((suffix) => `${entry.category.code}.${suffix}`),
        `${entry.id} ${entry.text}`,
      ).toContain(entry.category.subcode);
    }
  });

  it('applies the exceptions of the table', () => {
    expect(risklet.find((entry) => entry.id === '54')?.text).toBe('Vendor Bankruptcy/Closure');
    expect(subcodeOf('54')).toBe('operational.supplier');
    expect(subcodeOf('61')).toBe('legal.privacy');
    expect(subcodeOf('64')).toBe('legal.contract');
    for (const name of ['Network Segmentation Failure', 'Network Sensor Blind Spots', 'Load Balancer Configuration Drift']) {
      expect(risklet.find((entry) => entry.text === name)?.category.subcode, name).toBe('ict.misconfiguration');
    }
    const vendors = risklet.filter((entry) => entry.group === 'Risklet, Vendor' && entry.id !== '54');
    expect(vendors.length).toBeGreaterThan(0);
    for (const entry of vendors) expect(entry.category.subcode).toBe('ict.supply-chain');
    for (const entry of risklet.filter((item) => item.group === 'Risklet, Compliance' && !['61', '64'].includes(item.id))) expect(entry.category.subcode).toBe('legal.regulatory');
  });

  it('every label has a mapping, so no name is lost', () => {
    for (const entry of riskletData.entries) expect(riskletSubcode(entry), entry.label).toBeDefined();
    expect(riskletData.licence).toBe('CC-BY-4.0');
  });
});
