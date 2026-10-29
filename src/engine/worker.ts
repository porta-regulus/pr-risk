// The engine Web Worker. One worker per job, so that cancel is terminate().
import { fiscal, measure, optimize } from './optimize';
import type { EngineRequest, EngineResponse } from './protocol';
import { summarize } from './summary';

const post = (message: EngineResponse): void => {
  postMessage(message);
};

addEventListener('message', (event: MessageEvent<EngineRequest>) => {
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
    } else {
      post({ kind: 'fiscal', result: fiscal(request.doc, request.budget, request.trials, request.seed) });
    }
  } catch (error) {
    post({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
