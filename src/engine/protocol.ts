// Messages between the app and the engine worker.
import type { MonitorNumbers } from '../monitor/numbers';
import type { RiskDocument } from '../schema/types';
import type { DecisionRecord } from './decision';
import type { RiskNumbers } from './numbers';
import type { OptimizationResult } from './optimize';
import type { PriorityNumbers } from './prioritize';
import type { RunSummary } from './summary';

export type EngineRequest =
  | { readonly kind: 'simulate'; readonly doc: RiskDocument; readonly trials: number; readonly seed: number; readonly active: readonly string[] }
  | { readonly kind: 'optimize'; readonly doc: RiskDocument; readonly budget: number; readonly seed: number; readonly trials?: number; readonly confirmTrials?: number }
  | { readonly kind: 'fiscal'; readonly doc: RiskDocument; readonly budget: number; readonly seed: number; readonly trials: number }
  | { readonly kind: 'riskNumbers'; readonly doc: RiskDocument; readonly riskIds: readonly string[] }
  | { readonly kind: 'prioritize'; readonly doc: RiskDocument; readonly trials: number; readonly seed: number }
  | { readonly kind: 'decision'; readonly doc: RiskDocument; readonly budget: number; readonly seed: number }
  | { readonly kind: 'monitor'; readonly doc: RiskDocument; readonly trials: number; readonly seed: number; readonly createdOn: string };

// The optimization result without Map values, so that it survives structured clone as plain data.
export type OptimizationSummary = Omit<OptimizationResult, 'marginal'> & {
  readonly marginal: Readonly<Record<string, { netLossIfDropped: number; gapIfDropped: number }>>;
};

export type EngineResponse =
  | { readonly kind: 'progress'; readonly done: number; readonly total: number }
  | { readonly kind: 'simulate'; readonly result: RunSummary }
  | { readonly kind: 'optimize'; readonly result: OptimizationSummary }
  | { readonly kind: 'fiscal'; readonly result: readonly string[] }
  | { readonly kind: 'riskNumbers'; readonly result: Readonly<Record<string, RiskNumbers>> }
  | { readonly kind: 'prioritize'; readonly result: PriorityNumbers }
  | { readonly kind: 'decision'; readonly result: DecisionRecord }
  | { readonly kind: 'monitor'; readonly result: MonitorNumbers }
  | { readonly kind: 'error'; readonly message: string };
