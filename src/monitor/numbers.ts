// The engine job of screen S6. One run of the document as it is, with no option funded. It
// keeps the sorted annual losses of the roll-up for the tolerance what-if (SPEC.md Sec. 6.17
// item 2) and gives the forecasts that "Freeze forecasts" stores (Sec. 8.14).
import { documentHash } from '../engine/decision';
import { sortedCopy } from '../engine/metrics';
import { measure } from '../engine/optimize';
import { ENGINE_VERSION } from '../engine/version';
import type { RiskDocument } from '../schema/types';
import { freezeForecasts } from './forecasts';

type Forecast = NonNullable<RiskDocument['forecasts']>[number];

export interface MonitorNumbers {
  readonly hash: string;
  readonly engineVersion: string;
  readonly seed: number;
  readonly trials: number;
  readonly losses: Float64Array;
  readonly forecasts: readonly Forecast[];
}

export function monitorNumbers(doc: RiskDocument, trials: number, seed: number, createdOn: string): MonitorNumbers {
  const m = measure(doc, trials, seed, []);
  return { hash: documentHash(doc), engineVersion: ENGINE_VERSION, seed, trials, losses: sortedCopy(m.loss), forecasts: freezeForecasts(doc, m.run, { createdOn }) };
}
