// Build task 3, done criterion 4. SPEC.md Sec. 8.16 targets with a margin factor of 2.
// Timing needs a quiet machine, so these run only with PERF=1, alone (npm run test:performance,
// CI job "performance"). Inside the full suite other test files share the CPU.
// The log line gives the CPU model, because hosted runners differ in speed (HANDOFF task 3).
// A hosted runner shares its CPU with other jobs, so the simulation runs 3 times and the
// fastest run is checked. Runs 2 and 3 also start with the code already compiled by the JIT.
import { cpus } from 'node:os';
import { describe, expect, it } from 'vitest';
import { optimize, simulate } from '../src/engine';
import type { ResponseOption } from '../src/schema';
import { constant, document, lognormal, pert, risk } from './engine-helpers';

const MARGIN = 2;
const RUNS = 3;

function largeDocument(options: number) {
  const drivers = Array.from({ length: 5 }, (_, i) => ({ id: `D-${String(i)}`, frequency: lognormal(0.1, 1.5) }));
  const risks = Array.from({ length: 50 }, (_, i) =>
    risk({
      id: `R-${String(i)}`,
      frequency: i % 3 === 0 ? pert(0.05, 0.3, 2) : lognormal(0.02, 1.5),
      impact: i % 2 === 0 ? lognormal(5000, 400_000) : pert(1000, 20_000, 300_000),
      links: i % 4 === 0 ? [{ driverId: `D-${String(i % 5)}`, q: 0.4 }] : [],
      secondary: i % 5 === 0 ? [{ p: 0.3, impact: lognormal(1000, 50_000) }] : [],
    }),
  );
  const responses: ResponseOption[] = Array.from({ length: options }, (_, i) => ({
    id: `O-${String(i).padStart(2, '0')}`,
    title: `Option ${String(i)}`,
    responseType: 'Mitigate',
    costs: { oneOff: 1000 * (i + 1), annual: 500, lifetimeYears: 3 },
    status: 'candidate',
    effects: [{ targetKind: 'risk', targetId: `R-${String(i * 3)}`, frequency: constant(0.01), rationale: 'test effect' }],
  }));
  const doc = document(risks, { drivers, responses });
  doc.appetite = {
    capacity: { amount: 3_000_000, rationale: 'test' },
    toleranceCurve: { points: [{ loss: 60_000, maxExceedanceProbability: 0.5 }, { loss: 300_000, maxExceedanceProbability: 0.2 }, { loss: 1_000_000, maxExceedanceProbability: 0.05 }] },
  };
  return doc;
}

describe('performance (SPEC.md Sec. 8.16)', () => {
  it.runIf(process.env['PERF'] === '1')('100 000 trials, 50 leaf risks, 5 drivers in under 3 s / 2 (fastest of 3)', () => {
    const doc = largeDocument(0);
    const times = Array.from({ length: RUNS }, () => {
      const start = performance.now();
      const run = simulate(doc, { trials: 100_000, seed: 20261207 });
      const seconds = (performance.now() - start) / 1000;
      expect(run.risks.size).toBe(50);
      return seconds;
    });
    const fastest = Math.min(...times);
    console.log(`CPU ${cpus()[0]?.model ?? 'unknown'}. Simulation ${times.map((seconds) => seconds.toFixed(2)).join(', ')} s, fastest ${fastest.toFixed(2)} s.`);
    expect(fastest * MARGIN).toBeLessThan(3);
  }, 60_000);

  it.runIf(process.env['PERF'] === '1')('256 portfolios at 20 000 trials plus confirmation in under 90 s / 2', () => {
    // 8 independent options give exactly 256 portfolios with an unlimited budget.
    const doc = largeDocument(8);
    const start = performance.now();
    const result = optimize(doc, { budget: 1e9, seed: 20261207 });
    const seconds = (performance.now() - start) / 1000;
    expect(result.count).toBe(256);
    expect(result.method).toBe('exact');
    expect(seconds * MARGIN).toBeLessThan(90);
  }, 600_000);
});
