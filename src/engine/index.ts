export { ENGINE_VERSION } from './version';
export { decisionRecord, documentHash, statusOf } from './decision';
export { priorityNumbers } from './prioritize';
export type { PriorityNumbers, RegisterCurve } from './prioritize';
export type { DecisionRecord, NotFunded, PortfolioRow, RiskRow, StateNumbers, ToleranceStatus } from './decision';
export {
  capacityOf,
  contributions,
  exceedance,
  lossGrid,
  mean,
  PERCENTILES,
  quantile,
  registerTotal,
  riskStats,
  shareAtLeastOne,
  sortedCopy,
  standardError,
  subtree,
  tolerance,
  toleranceAt,
} from './metrics';
export type { RiskStats, TolerancePoint, ToleranceResult } from './metrics';
export { DEFAULT_TRIALS, numbersOf, riskNumbers } from './numbers';
export type { RiskNumbers } from './numbers';
export { normalQuantile } from './normal';
export {
  annualizedCost,
  compareRank,
  CONFIRM_TRIALS,
  evaluate,
  feasiblePortfolios,
  firstYearCash,
  fiscal,
  batchSe,
  measure,
  optimize,
  pairedSe,
  PORTFOLIO_LIMIT,
  RANKING_TRIALS,
  triggerProbability,
} from './optimize';
export type { Evaluation, Feasible, Marginal, Measured, OptimizationResult, OptimizeOptions } from './optimize';
export { Mulberry32, stream, Xoshiro128 } from './rng';
export { gamma, poisson, RATE_CAP, sampler, Sampler, Z90 } from './sample';
export { createCache, isSimulated, overridesFor, simulate } from './simulate';
export type { RiskRun, Run, RunOptions, SimulationCache } from './simulate';
