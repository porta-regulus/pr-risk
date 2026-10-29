// The engine Web Worker. One worker per job, so that cancel is terminate().
import { decisionRecord } from './decision';
import { numbersOf } from './numbers';
import { fiscal, measure, optimize } from './optimize';
import { priorityNumbers } from './prioritize';
import type { EngineRequest, EngineResponse } from './protocol';
import { summarize } from './summary';

const post = (message: EngineResponse): void => {
  postMessage(message);
};

addEventListener('message', (event: MessageEvent<EngineRequest>) => {
  // Only the page that made this dedicated worker can post to it, and the event origin is then
  // empty. The check refuses anything else (CodeQL js/missing-origin-check).
  if (event.origin !== '' && event.origin !== location.origin) return;
  const request = event.data;
  try {
    if (request.kind === 'simulate') {
      post({ kind: 'simulate', result: summarize(request.doc, measure(request.doc, request.trials, request.seed, request.active)) });
    } else if (request.kind === 'optimize') {
      const result = optimize(request.doc, {
        budget: request.budget,
        seed: request.seed,
        ...(request.trials === undefined ? {} : { trials: request.trials }),
        ...(request.confirmTrials === undefined ? {} : { confirmTrials: request.confirmTrials }),
        onProgress: (done, total) => {
          post({ kind: 'progress', done, total });
        },
      });
      post({ kind: 'optimize', result: { ...result, marginal: Object.fromEntries(result.marginal) } });
    } else if (request.kind === 'prioritize') {
      post({ kind: 'prioritize', result: priorityNumbers(request.doc, request.trials, request.seed) });
    } else if (request.kind === 'decision') {
      const result = decisionRecord(request.doc, {
        budget: request.budget,
        seed: request.seed,
        onProgress: (done, total) => {
          post({ kind: 'progress', done, total });
        },
      });
      post({ kind: 'decision', result });
    } else if (request.kind === 'riskNumbers') {
      post({ kind: 'riskNumbers', result: numbersOf(request.doc, request.riskIds) });
    } else {
      post({ kind: 'fiscal', result: fiscal(request.doc, request.budget, request.trials, request.seed) });
    }
  } catch (error) {
    post({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
