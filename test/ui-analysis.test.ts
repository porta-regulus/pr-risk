// NIST numbers from the simulation (SPEC.md Sec. 7.3) and the S3 helpers.
import { describe, expect, it } from 'vitest';
import { riskStats, simulate } from '../src/engine';
import { documentErrors, type Risk, type RiskDocument } from '../src/schema';
import { feedback, labelNumbers, NOT_ESTIMATED, numbersSource, riskNumbers, simulationTargets, withNistNumbers, withNumbersFrom, withSimulationSettings } from '../src/ui/analysis';
import { prepareSave } from '../src/ui/editor';
import { newRisk, registerTree } from '../src/ui/identify';
import { example, EXAMPLE_1, EXAMPLE_2 } from './schema-helpers';

const doc = example(EXAMPLE_2);
const settings = doc.simulation ?? { seed: 0, trials: 100_000, engineVersion: 'x' };
const withRisk = (target: RiskDocument, risk: Risk): RiskDocument => ({ ...target, risks: target.risks.map((item) => (item.riskId === risk.riskId ? risk : item)) });

describe('one risk alone gives its numbers of the full run (Sec. 8.6 item 7)', () => {
  const full = new Map(riskStats(simulate(doc, { trials: settings.trials, seed: settings.seed })).map((stats) => [stats.riskId, stats]));
  const linked = doc.risks.find((risk) => (risk.driverLinks ?? []).length > 0);

  it.each(doc.risks.filter((risk) => risk.estimate !== undefined && risk.onlyWithResponse === undefined).map((risk) => risk.riskId))('%s', (riskId) => {
    const alone = riskNumbers(doc, riskId);
    expect(alone?.probability).toBe(full.get(riskId)?.probability);
    expect(alone?.expectedAnnual).toBe(full.get(riskId)?.expectedAnnual);
  });

  it('covers a risk with a driver link', () => {
    expect(linked).toBeDefined();
  });
});

describe('withNistNumbers', () => {
  it('recomputes a re-estimated risk, keeps the others, and the result is valid (V-07)', () => {
    const r1 = doc.risks[0] as Risk;
    const estimate = r1.estimate;
    if (estimate === undefined) throw new Error('example 2 risk 1 has an estimate');
    const changed = withRisk(doc, { ...r1, estimate: { ...estimate, frequency: { type: 'lognormal', lower: 0.05, upper: 0.5, confidence: 0.9 } } });
    const result = withNistNumbers(doc, changed);
    const after = result.risks[0] as Risk;
    expect(after.riskLikelihood).not.toBe(r1.riskLikelihood);
    expect(Math.abs(after.exposureRating - after.riskLikelihood * after.riskImpact)).toBeLessThanOrEqual(1);
    expect(result.risks.slice(1)).toEqual(doc.risks.slice(1));
    expect(documentErrors(result)).toEqual([]);
  });

  it('returns the same document when nothing changed', () => {
    expect(withNistNumbers(doc, doc)).toBe(doc);
  });

  it('replaces the placeholders of rule D-Q2 once an estimate exists', () => {
    const base: RiskDocument = { ...doc, registers: doc.registers, risks: doc.risks };
    const fresh = newRisk(base, 'CORP', 'If the website is down, then orders stop.', 'negative');
    const estimated: Risk = {
      ...fresh,
      estimate: { frequency: { type: 'lognormal', lower: 0.1, upper: 2, confidence: 0.9 }, impactPerEvent: { type: 'pert', min: 1000, mode: 5000, max: 40_000 }, method: 'expert-calibrated', rationale: 'Two outages in the last three years.' },
    };
    const result = withNistNumbers(base, { ...base, risks: [...base.risks, estimated] });
    const saved = result.risks.at(-1) as Risk;
    expect(saved.defaultedFields).toBeUndefined();
    expect(saved.detail?.currentRiskAnalysis).toBeUndefined();
    expect(saved.riskLikelihood).toBeGreaterThan(0);
    expect(documentErrors(result)).toEqual([]);
  });
});

describe('S3 helpers', () => {
  it('a new risk is valid in a qualitative register and needs an estimate in a quantitative one (V-08)', () => {
    const qualitative: RiskDocument = { ...doc, registers: doc.registers.map((register) => ({ ...register, method: 'qualitative' })) as RiskDocument['registers'] };
    const risk = newRisk(qualitative, 'CORP', 'If a laptop is lost, then data leaks.', 'negative');
    expect(risk.detail?.currentRiskAnalysis).toBe(NOT_ESTIMATED);
    expect(documentErrors({ ...qualitative, risks: [...qualitative.risks, risk] })).toEqual([]);
    expect(documentErrors({ ...doc, risks: [...doc.risks, newRisk(doc, 'CORP', 'If a laptop is lost, then data leaks.', 'negative')] }).map((error) => error.rule)).toEqual(['V-08']);
  });

  it('withNumbersFrom gives the draft the numbers of the save', () => {
    const r1 = doc.risks[0] as Risk;
    const saved = withRisk(doc, { ...r1, riskLikelihood: 0.5, riskImpact: 100, exposureRating: 50 });
    const rebased = withNumbersFrom(saved, doc);
    expect(rebased.risks[0]).toEqual(saved.risks[0]);
    expect(withNumbersFrom(doc, doc)).toBe(doc);
  });

  it('withSimulationSettings adds a stored seed only when an estimate exists', () => {
    const { simulation: _drop, ...noSettings } = doc;
    expect(withSimulationSettings(noSettings, () => 42).simulation).toEqual({ seed: 42, trials: 100_000, engineVersion: '0.1.0' });
    expect(withSimulationSettings({ ...noSettings, risks: [] }, () => 42).simulation).toBeUndefined();
  });

  it('prepareSave writes numbers and a change log entry per risk', () => {
    const r1 = doc.risks[0] as Risk;
    const draft = withRisk(doc, { ...r1, riskOwnerPointOfContact: 'New owner' });
    const prepared = prepareSave(doc, draft, '2026-10-29T12:00:00Z');
    expect(prepared.changeLog?.at(-1)).toMatchObject({ entityKind: 'risk', entityId: r1.riskId, path: '' });
    expect(documentErrors(prepared)).toEqual([]);
  });

  it('feedback reports the implied frequency with drivers and the simulated numbers', () => {
    const risk = doc.risks.find((item) => (item.driverLinks ?? []).length > 0) as Risk;
    const result = feedback(doc, risk.riskId);
    expect(result?.numbers?.probability).toBe(riskNumbers(doc, risk.riskId)?.probability);
    expect(result?.totalFrequency).toBeGreaterThan(0);
  });

  it('registerTree lists roots first and children under their parent', () => {
    expect(registerTree(doc.registers).map((item) => [item.register.id, item.depth])).toEqual(
      doc.registers.map((register) => [register.id, register.parentRegisterId === undefined ? 0 : 1]),
    );
  });
});

describe('labels give the numbers of a risk without an estimate (rules D-Q1 and D-Q3)', () => {
  const doc1 = example(EXAMPLE_1);
  const risk1 = doc1.risks[0] as Risk;

  it('D-Q1. An exposure label gives the exposure, and the impact follows', () => {
    expect(labelNumbers(doc1, { ...risk1, riskLikelihoodLabel: 'High', exposureRatingLabel: 'Mod' })).toEqual({ riskLikelihood: 0.9, riskImpact: 555_556, exposureRating: 500_000 });
  });

  it('D-Q3. Without an exposure label, the impact label gives the impact', () => {
    const { exposureRatingLabel: _drop, ...rest } = risk1;
    expect(labelNumbers(doc1, { ...rest, riskLikelihoodLabel: 'Low', riskImpactLabel: 'High' })).toEqual({ riskLikelihood: 0.1, riskImpact: 10_000_000, exposureRating: 1_000_000 });
  });

  it('a label change updates the numbers, keeps them listed as defaulted, and the document stays valid', () => {
    const changed = withRisk(doc1, { ...risk1, riskLikelihoodLabel: 'High' });
    const result = withNistNumbers(doc1, changed);
    const after = result.risks[0] as Risk;
    expect(after.riskLikelihood).toBe(0.9);
    expect(after.defaultedFields).toEqual(risk1.defaultedFields);
    expect(documentErrors(result)).toEqual([]);
  });

  it('an unrelated save leaves every risk of example 1 as it is', () => {
    const draft = { ...doc1, context: { ...doc1.context, mission: 'Test' } };
    expect(withNistNumbers(doc1, draft).risks).toBe(draft.risks);
  });
});

describe('removing an estimate, and where numbers come from', () => {
  const doc1 = example(EXAMPLE_1);
  const risk1 = doc1.risks[0] as Risk;
  const estimated: Risk = {
    ...risk1,
    estimate: { frequency: { type: 'lognormal', lower: 0.01, upper: 0.2, confidence: 0.9 }, impactPerEvent: { type: 'lognormal', lower: 10, upper: 100, confidence: 0.9 }, method: 'expert-calibrated', rationale: 'Test estimate for the removal case.' },
  };
  const savedWithEstimate = withNistNumbers(doc1, withRisk(doc1, estimated));

  it('the estimate gives simulated numbers', () => {
    expect((savedWithEstimate.risks[0] as Risk).exposureRating).toBeLessThan(100);
    expect(numbersSource(savedWithEstimate, savedWithEstimate.risks[0] as Risk)).toBe('simulation');
  });

  it('removing it brings back the numbers of the labels (D-Q1)', () => {
    const { estimate: _drop, ...without } = savedWithEstimate.risks[0] as Risk;
    const result = withNistNumbers(savedWithEstimate, withRisk(savedWithEstimate, without));
    const after = result.risks[0] as Risk;
    expect([after.riskLikelihood, after.riskImpact, after.exposureRating]).toEqual([0.5, 1_000_000, 500_000]);
    expect(numbersSource(result, after)).toBe('labels');
  });

  it('removing it from a risk without labels gives the placeholders of D-Q2', () => {
    const { estimate: _drop, riskLikelihoodLabel: _l, exposureRatingLabel: _e, riskImpactLabel: _i, ...without } = savedWithEstimate.risks[0] as Risk;
    const result = withNistNumbers(savedWithEstimate, withRisk(savedWithEstimate, without));
    const after = result.risks[0] as Risk;
    expect([after.riskLikelihood, after.riskImpact, after.exposureRating]).toEqual([0, 0, 0]);
    expect(numbersSource(result, after)).toBe('placeholder');
    expect(documentErrors(result)).toEqual([]);
  });

  it('simulationTargets lists only changed estimates', () => {
    expect(simulationTargets(doc, doc)).toEqual([]);
    const r1 = doc.risks[0] as Risk;
    const estimate = r1.estimate;
    if (estimate === undefined) throw new Error('example 2 risk 1 has an estimate');
    expect(simulationTargets(doc, withRisk(doc, { ...r1, estimate: { ...estimate, rationale: 'A changed rationale of the estimate.' } }))).toEqual([r1.riskId]);
  });

  it('numbersSource tells labels, simulation and placeholders apart', () => {
    expect(numbersSource(doc1, risk1)).toBe('labels');
    expect(numbersSource(doc, doc.risks[0] as Risk)).toBe('simulation');
    expect(numbersSource(doc, newRisk(doc, 'CORP', 'If X occurs, then Y happens.', 'negative'))).toBe('placeholder');
  });
});
