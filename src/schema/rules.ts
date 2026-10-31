// Semantic rules V-01 to V-21 and lint L-01 to L-11 (SPEC.md Sec. 7.6).
// V errors block save and import. L warnings show in the UI and the record annex.
// docs/schema/validate.py implements a subset of the V rules. This file implements all
// of them, and it must report nothing on documents that pass the Python reference.
import type { Distribution, Finding, Risk, RiskDocument, ScaleBand } from './types';

const NEGATIVE: ReadonlySet<string> = new Set(['Accept', 'Avoid', 'Transfer', 'Mitigate']);
const POSITIVE: ReadonlySet<string> = new Set(['Realize', 'Share', 'Enhance', 'Accept']);
const OPPORTUNITY_RESPONSES: ReadonlySet<string> = new Set(['Realize', 'Share', 'Enhance']);
const MAX_FREQUENCY = 100;

type ScaleName = 'likelihood' | 'impact' | 'exposure';

const finding = (rule: string, message: string, riskIds?: readonly string[]): Finding =>
  riskIds === undefined ? { rule, message } : { rule, message, riskIds };

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) (seen.has(id) ? repeated : seen).add(id);
  return [...repeated];
}

// Every label of a risk with the scale it must come from (validate.py label_fields).
export function labelFields(risk: Risk): [string, ScaleName, string | undefined][] {
  const out: [string, ScaleName, string | undefined][] = [
    ['riskLikelihoodLabel', 'likelihood', risk.riskLikelihoodLabel],
    ['riskImpactLabel', 'impact', risk.riskImpactLabel],
    ['exposureRatingLabel', 'exposure', risk.exposureRatingLabel],
  ];
  const previous = risk.previousAssessment;
  out.push(
    ['previousAssessment.riskLikelihoodLabel', 'likelihood', previous?.riskLikelihoodLabel],
    ['previousAssessment.riskImpactLabel', 'impact', previous?.riskImpactLabel],
    ['previousAssessment.exposureRatingLabel', 'exposure', previous?.exposureRatingLabel],
  );
  for (const part of ['planned', 'measured'] as const) {
    const block = risk.detail?.[part];
    out.push(
      [`detail.${part}.likelihoodLabel`, 'likelihood', block?.likelihoodLabel],
      [`detail.${part}.impactLabel`, 'impact', block?.impactLabel],
      [`detail.${part}.exposureRatingLabel`, 'exposure', block?.exposureRatingLabel],
    );
  }
  // Schema 1.1.0 adds the impact split of the previous period.
  for (const [prefix, impacts] of [['impacts', risk.impacts], ['previousAssessment.impacts', previous?.impacts]] as const) {
    out.push(
      [`${prefix}.financial.opex`, 'impact', impacts?.financial?.opex?.label],
      [`${prefix}.financial.capex`, 'impact', impacts?.financial?.capex?.label],
      [`${prefix}.reputation`, 'impact', impacts?.reputation?.label],
      [`${prefix}.mission`, 'impact', impacts?.mission?.label],
      [`${prefix}.safety`, 'impact', impacts?.safety?.label],
    );
  }
  return out;
}

function bandsOf(doc: RiskDocument, scale: ScaleName): readonly ScaleBand[] | undefined {
  const bands = doc.strategy?.scales?.[scale];
  return bands === undefined ? undefined : [...bands].sort((a, b) => a.lower - b.lower);
}

// Position of a label on a scale, by label or alias. Undefined when not on the scale.
export function rankOf(bands: readonly ScaleBand[], label: string): number | undefined {
  const index = bands.findIndex((band) => band.label === label || (band.aliases ?? []).includes(label));
  return index < 0 ? undefined : index;
}

// Every distribution in the document, with where it is and whether it is a frequency.
function distributions(doc: RiskDocument): { where: string; frequency: boolean; value: Distribution }[] {
  const out: { where: string; frequency: boolean; value: Distribution }[] = [];
  for (const risk of doc.risks) {
    const estimate = risk.estimate;
    if (estimate === undefined) continue;
    out.push({ where: `${risk.riskId} frequency`, frequency: true, value: estimate.frequency });
    out.push({ where: `${risk.riskId} impactPerEvent`, frequency: false, value: estimate.impactPerEvent });
    (estimate.secondaryImpacts ?? []).forEach((item, index) => {
      out.push({ where: `${risk.riskId} secondary impact ${String(index + 1)}`, frequency: false, value: item.impactPerEvent });
    });
  }
  for (const driver of doc.drivers ?? []) {
    out.push({ where: `driver ${driver.id} frequency`, frequency: true, value: driver.frequency });
  }
  for (const option of doc.responses ?? []) {
    for (const effect of option.effects) {
      if (effect.frequency !== undefined) {
        out.push({ where: `response ${option.id} effect frequency`, frequency: true, value: effect.frequency });
      }
      if (effect.impactPerEvent !== undefined) {
        out.push({ where: `response ${option.id} effect impactPerEvent`, frequency: false, value: effect.impactPerEvent });
      }
    }
  }
  return out;
}

function upperBound(distribution: Distribution): number | undefined {
  if (distribution.type === 'lognormal') return distribution.upper;
  if (distribution.type === 'pert') return distribution.max;
  return distribution.value;
}

export function semanticErrors(doc: RiskDocument): Finding[] {
  const errors: Finding[] = [];
  const registers = new Map(doc.registers.map((register) => [register.id, register]));
  const drivers = new Set((doc.drivers ?? []).map((driver) => driver.id));
  const objectives = new Set((doc.context?.objectives ?? []).map((objective) => objective.id));
  const functions = new Set((doc.context?.functions ?? []).map((item) => item.id));
  const assets = new Map((doc.assets ?? []).map((asset) => [asset.id, asset]));
  const responses = new Map((doc.responses ?? []).map((option) => [option.id, option]));
  const risks = new Map(doc.risks.map((risk) => [risk.riskId, risk]));
  const keys = new Set(doc.risks.map((risk) => `${risk.registerId}\u0000${risk.riskId}`));

  // V-01. Ids are unique per kind.
  const kinds: [string, string[]][] = [
    ['riskId', doc.risks.map((risk) => risk.riskId)],
    ['register id', doc.registers.map((register) => register.id)],
    ['driver id', (doc.drivers ?? []).map((driver) => driver.id)],
    ['response id', (doc.responses ?? []).map((option) => option.id)],
    ['asset id', (doc.assets ?? []).map((asset) => asset.id)],
    ['objective id', (doc.context?.objectives ?? []).map((objective) => objective.id)],
    ['function id', (doc.context?.functions ?? []).map((item) => item.id)],
    ['forecast id', (doc.forecasts ?? []).map((forecast) => forecast.id)],
    ['appetite statement id', (doc.appetite?.statements ?? []).map((statement) => statement.id)],
    ['provenance id', (doc.provenance ?? []).map((record) => record.id)],
  ];
  for (const [kind, ids] of kinds) {
    for (const id of duplicates(ids)) errors.push(finding('V-01', `${kind} ${id} is not unique in the document`));
  }

  // V-02. Parents exist, and the register tree has no cycle.
  for (const register of doc.registers) {
    if (register.parentRegisterId !== undefined && !registers.has(register.parentRegisterId)) {
      errors.push(finding('V-02', `register ${register.id} has an unknown parent ${register.parentRegisterId}`));
    }
    const path = new Set([register.id]);
    let parent = register.parentRegisterId;
    while (parent !== undefined && registers.has(parent)) {
      if (path.has(parent)) {
        errors.push(finding('V-02', `register ${register.id} is in a parent cycle`));
        break;
      }
      path.add(parent);
      parent = registers.get(parent)?.parentRegisterId;
    }
  }

  for (const asset of assets.values()) {
    for (const id of asset.supportsFunctionIds ?? []) {
      if (!functions.has(id)) errors.push(finding('V-20', `asset ${asset.id} supports unknown function ${id}`));
    }
  }

  for (const option of responses.values()) {
    for (const id of option.introducesRisks ?? []) {
      const introduced = risks.get(id);
      if (introduced === undefined) {
        errors.push(finding('V-19', `response ${option.id} introduces unknown risk ${id}`));
      } else if (introduced.onlyWithResponse !== option.id) {
        errors.push(finding('V-19', `response ${option.id} introduces ${id}, but ${id} has no onlyWithResponse ${option.id}`, [id]));
      }
    }
    for (const effect of option.effects) {
      const known = effect.targetKind === 'driver' ? drivers.has(effect.targetId) : risks.has(effect.targetId);
      if (!known) errors.push(finding('V-14', `response ${option.id} targets unknown ${effect.targetKind} ${effect.targetId}`));
    }
    for (const part of option.bundleOf ?? []) {
      if (part === option.id || !responses.has(part)) {
        errors.push(finding('V-14', `response ${option.id} bundles a missing option or itself (${part})`));
      }
    }
  }

  for (const forecast of doc.forecasts ?? []) {
    if (!risks.has(forecast.riskId)) errors.push(finding('V-21', `forecast ${forecast.id} refers to unknown risk ${forecast.riskId}`));
    if (!(forecast.windowEnd > forecast.windowStart)) {
      errors.push(finding('V-15', `forecast ${forecast.id} window ends on or before its start`));
    }
    if (forecast.outcome !== undefined && forecast.outcome.recordedOn < forecast.windowEnd) {
      errors.push(finding('V-15', `forecast ${forecast.id} outcome is recorded before the window ends`));
    }
  }

  const scales: Partial<Record<ScaleName, readonly ScaleBand[]>> = {};
  for (const name of ['likelihood', 'impact', 'exposure'] as const) {
    const bands = bandsOf(doc, name);
    if (bands !== undefined) scales[name] = bands;
  }

  for (const risk of doc.risks) {
    const id = risk.riskId;
    const register = registers.get(risk.registerId);
    if (register === undefined) {
      errors.push(finding('V-03', `${id} has an unknown registerId ${risk.registerId}`, [id]));
      continue;
    }
    const allowed = risk.polarity === 'negative' ? NEGATIVE : POSITIVE;
    if (!risk.riskResponseType.every((type) => allowed.has(type))) {
      errors.push(finding('V-04', `${id} response type does not match polarity ${risk.polarity}`, [id]));
    }
    for (const link of risk.driverLinks ?? []) {
      if (!drivers.has(link.driverId)) errors.push(finding('V-05', `${id} links unknown driver ${link.driverId}`, [id]));
    }
    for (const source of risk.sourceRefs ?? []) {
      if (!keys.has(`${source.registerId}\u0000${source.riskId}`)) {
        errors.push(finding('V-06', `${id} has a sourceRef to a missing risk ${source.registerId}/${source.riskId}`, [id]));
      } else if (source.registerId === risk.registerId && source.riskId === id) {
        errors.push(finding('V-06', `${id} is its own source`, [id]));
      }
    }
    const expected = Math.round(risk.riskLikelihood * risk.riskImpact);
    if (Math.abs(expected - risk.exposureRating) > 1) {
      errors.push(
        finding('V-07', `${id} exposureRating ${String(risk.exposureRating)} is not riskLikelihood x riskImpact (${String(expected)})`, [id]),
      );
    }
    if (register.method === 'quantitative' && risk.estimate === undefined && (risk.sourceRefs ?? []).length === 0) {
      errors.push(finding('V-08', `${id} is in a quantitative register but has no estimate`, [id]));
    }
    if (
      risk.responseDecision === 'pending' &&
      (risk.riskResponseType.length !== 1 || risk.riskResponseType[0] !== 'Accept' || risk.riskResponseCost !== 0)
    ) {
      errors.push(finding('V-09', `${id} is pending but the NIST fields are not an interim Accept with cost 0`, [id]));
    }
    for (const [field, scale, label] of labelFields(risk)) {
      const bands = scales[scale];
      if (label && bands !== undefined && rankOf(bands, label) === undefined) {
        errors.push(finding('V-11', `${id} ${field} '${label}' is not on the strategy scale`, [id]));
      }
    }
    for (const objective of risk.objectiveIds ?? []) {
      if (!objectives.has(objective)) errors.push(finding('V-16', `${id} refers to unknown objective ${objective}`, [id]));
    }
    for (const asset of risk.assetIds ?? []) {
      if (!assets.has(asset)) errors.push(finding('V-17', `${id} refers to unknown asset ${asset}`, [id]));
    }
    for (const link of risk.linkedRisks ?? []) {
      if (!risks.has(link.riskId) || link.riskId === id) {
        errors.push(finding('V-18', `${id} has a linked risk that is missing or itself (${link.riskId})`, [id]));
      }
    }
    const only = risk.onlyWithResponse;
    if (only !== undefined && !(responses.get(only)?.introducesRisks ?? []).includes(id)) {
      errors.push(finding('V-19', `${id} onlyWithResponse ${only} does not list it in introducesRisks`, [id]));
    }
  }

  // V-10 and V-13 for every distribution in the document.
  for (const { where, frequency, value } of distributions(doc)) {
    if (value.type === 'lognormal' && !((value.lower ?? Number.NaN) < (value.upper ?? Number.NaN))) {
      errors.push(finding('V-10', `${where} lognormal lower is not below upper`));
    }
    if (value.type === 'pert' && !((value.min ?? Number.NaN) <= (value.mode ?? Number.NaN) && (value.mode ?? Number.NaN) <= (value.max ?? Number.NaN))) {
      errors.push(finding('V-10', `${where} PERT min, mode, max are not in order`));
    }
    const upper = upperBound(value);
    if (frequency && upper !== undefined && upper > MAX_FREQUENCY) {
      errors.push(finding('V-13', `${where} upper bound ${String(upper)} is above ${String(MAX_FREQUENCY)} per year`));
    }
  }
  const trials = doc.simulation?.trials;
  if (trials !== undefined && (trials < 1000 || trials > 1_000_000)) {
    errors.push(finding('V-13', `simulation trials ${String(trials)} is outside 1 000 to 1 000 000`));
  }

  const points = doc.appetite?.toleranceCurve?.points ?? [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined && !(a.loss < b.loss && a.maxExceedanceProbability > b.maxExceedanceProbability)) {
      errors.push(finding('V-12', 'tolerance curve is not ascending in loss and strictly descending in probability'));
      break;
    }
  }
  return errors;
}

// Values that need a simulation run. Lint rules without them are skipped.
export interface SimulationFacts {
  // Expected annual loss (or gain) per riskId.
  readonly expectedAnnual?: ReadonlyMap<string, number>;
  // Share of trials with a clipped rate (SPEC.md Sec. 8.5).
  readonly clippedShare?: number;
  // True when the tolerance curve changed no ranking or funding decision.
  readonly toleranceNeverBinding?: boolean;
}

const ORDINAL_INPUTS = ['likelihood', 'impact', 'opex', 'capex', 'reputation', 'mission', 'safety'] as const;

// The ordinal inputs of a risk as ranks on the strategy scales (Fig. 10 columns).
function ordinalInputs(doc: RiskDocument, risk: Risk): Map<string, number> {
  const likelihood = bandsOf(doc, 'likelihood') ?? [];
  const impact = bandsOf(doc, 'impact') ?? [];
  const labels: [string, readonly ScaleBand[], string | undefined][] = [
    ['likelihood', likelihood, risk.riskLikelihoodLabel],
    ['impact', impact, risk.riskImpactLabel],
    ['opex', impact, risk.impacts?.financial?.opex?.label],
    ['capex', impact, risk.impacts?.financial?.capex?.label],
    ['reputation', impact, risk.impacts?.reputation?.label],
    ['mission', impact, risk.impacts?.mission?.label],
    ['safety', impact, risk.impacts?.safety?.label],
  ];
  const ranks = new Map<string, number>();
  for (const [name, bands, label] of labels) {
    if (!label) continue;
    const rank = rankOf(bands, label);
    if (rank !== undefined) ranks.set(name, rank);
  }
  return ranks;
}

function matrixScore(doc: RiskDocument, risk: Risk): number | undefined {
  const likelihood = bandsOf(doc, 'likelihood');
  const impact = bandsOf(doc, 'impact');
  if (!risk.riskLikelihoodLabel || !risk.riskImpactLabel || likelihood === undefined || impact === undefined) {
    return undefined;
  }
  const l = rankOf(likelihood, risk.riskLikelihoodLabel);
  const i = rankOf(impact, risk.riskImpactLabel);
  return l === undefined || i === undefined ? undefined : (l + 1) * (i + 1);
}

export function lint(doc: RiskDocument, facts: SimulationFacts = {}): Finding[] {
  const warnings: Finding[] = [];
  const exposure = bandsOf(doc, 'exposure');

  // L-01. Matrix order opposite to the expected annual values, which differ by 2 or more (Cox 2008).
  const expectedAnnual = facts.expectedAnnual;
  if (expectedAnnual !== undefined) {
    const scored = doc.risks
      .map((risk) => ({ risk, score: matrixScore(doc, risk), value: expectedAnnual.get(risk.riskId) }))
      .filter((item): item is { risk: Risk; score: number; value: number } => item.score !== undefined && item.value !== undefined);
    for (const a of scored) {
      for (const b of scored) {
        if (a.score > b.score && b.value >= 2 * a.value && a.value > 0) {
          warnings.push(
            finding('L-01', `${a.risk.riskId} ranks above ${b.risk.riskId} in the matrix, but ${b.risk.riskId} has at least twice its expected annual value`, [a.risk.riskId, b.risk.riskId]),
          );
        }
      }
    }
  }

  for (const { where, value } of distributions(doc)) {
    if (value.type === 'lognormal' && value.lower !== undefined && value.upper !== undefined && value.lower > 0 && value.upper / value.lower > 1000) {
      warnings.push(finding('L-02', `${where} range is wider than a factor of 1 000`));
    }
  }

  // L-03. Dominance within a register: equal or higher on every ordinal input, higher on one, lower exposure label.
  if (exposure !== undefined) {
    const rated = doc.risks
      .map((risk) => ({ risk, inputs: ordinalInputs(doc, risk), exposure: risk.exposureRatingLabel ? rankOf(exposure, risk.exposureRatingLabel) : undefined }))
      .filter((item) => item.exposure !== undefined && item.inputs.size > 0);
    for (const a of rated) {
      for (const b of rated) {
        if (a === b || a.risk.registerId !== b.risk.registerId || a.risk.polarity !== b.risk.polarity) continue;
        const names = ORDINAL_INPUTS.filter((name) => a.inputs.has(name) || b.inputs.has(name));
        if (!names.every((name) => a.inputs.has(name) && b.inputs.has(name))) continue;
        const geq = names.every((name) => (a.inputs.get(name) ?? 0) >= (b.inputs.get(name) ?? 0));
        const gt = names.some((name) => (a.inputs.get(name) ?? 0) > (b.inputs.get(name) ?? 0));
        if (geq && gt && (a.exposure ?? 0) < (b.exposure ?? 0)) {
          warnings.push(
            finding('L-03', `${a.risk.riskId} rates every input equal or higher than ${b.risk.riskId}, but has a lower exposure label`, [a.risk.riskId, b.risk.riskId]),
          );
        }
      }
    }
  }

  for (const risk of doc.risks) {
    const id = risk.riskId;
    if (exposure !== undefined && risk.exposureRatingLabel) {
      const rank = rankOf(exposure, risk.exposureRatingLabel);
      const band = rank === undefined ? undefined : exposure[rank];
      if (band !== undefined && !(band.lower <= risk.exposureRating && risk.exposureRating <= band.upper)) {
        warnings.push(finding('L-04', `${id} exposure label ${risk.exposureRatingLabel} does not match the band of ${String(risk.exposureRating)}`, [id]));
      }
    }
    const owner = risk.riskOwnerPointOfContact.trim().toLowerCase();
    if (owner === '' || owner === 'unassigned' || owner === 'tbd') warnings.push(finding('L-05', `${id} has no risk owner`, [id]));
    if ((risk.defaultedFields ?? []).length > 0) {
      warnings.push(finding('L-07', `${id} has defaulted fields ${(risk.defaultedFields ?? []).join(', ')}`, [id]));
    }
    if ((risk.objectiveIds ?? []).length === 0) warnings.push(finding('L-09', `${id} supports no objective`, [id]));
    const sources = (risk.sourceRefs ?? []).map((source) => doc.risks.find((item) => item.registerId === source.registerId && item.riskId === source.riskId));
    const types = new Set(sources.map((source) => (source === undefined ? '' : [...source.riskResponseType].sort().join('+'))));
    if (sources.length > 1 && types.size > 1) warnings.push(finding('L-10', `${id} summarizes sources with different response types`, [id]));
    if (risk.polarity === 'positive') {
      const options = (doc.responses ?? []).filter(
        (option) => OPPORTUNITY_RESPONSES.has(option.responseType) && option.effects.some((effect) => effect.targetKind === 'risk' && effect.targetId === id),
      );
      if (options.length === 0) warnings.push(finding('L-11', `${id} is positive but has no Realize, Share or Enhance option`, [id]));
    }
  }

  const linkCount = new Map<string, number>();
  for (const risk of doc.risks) for (const link of risk.driverLinks ?? []) linkCount.set(link.driverId, (linkCount.get(link.driverId) ?? 0) + 1);
  for (const driver of doc.drivers ?? []) {
    if ((linkCount.get(driver.id) ?? 0) < 2) warnings.push(finding('L-06', `driver ${driver.id} has fewer than 2 links`));
  }

  if (facts.clippedShare !== undefined && facts.clippedShare > 0.05) {
    warnings.push(finding('L-08', `${(facts.clippedShare * 100).toFixed(1)}% of trials have a clipped rate`));
  }
  if (facts.toleranceNeverBinding === true) warnings.push(finding('L-11', 'the tolerance curve never changes a decision'));
  return warnings;
}
