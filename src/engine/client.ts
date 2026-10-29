// Run engine jobs in a Web Worker with progress and cancel (SPEC.md Sec. 8.16).
import { scriptUrl } from '../trusted-types';
import type { EngineRequest, EngineResponse, OptimizationSummary } from './protocol';
import type { RunSummary } from './summary';
import workerUrl from './worker?worker&url';

export class CancelledError extends Error {
  constructor() {
    super('The run was cancelled');
    this.name = 'CancelledError';
  }
}

export interface Job<T> {
  readonly result: Promise<T>;
  // Stops the worker at once. The promise rejects with CancelledError.
  cancel(): void;
}

type ResultOf<K extends EngineRequest['kind']> = K extends 'simulate' ? RunSummary : K extends 'optimize' ? OptimizationSummary : readonly string[];

export function runJob<R extends EngineRequest>(request: R, onProgress?: (done: number, total: number) => void): Job<ResultOf<R['kind']>> {
  const worker = new Worker(scriptUrl(workerUrl), { type: 'module', name: `engine-${request.kind}` });
  let reject: (reason: unknown) => void = () => undefined;
  const result = new Promise<ResultOf<R['kind']>>((resolve, fail) => {
    reject = fail;
    worker.addEventListener('message', (event: MessageEvent<EngineResponse>) => {
      const message = event.data;
      if (message.kind === 'progress') {
        onProgress?.(message.done, message.total);
        return;
      }
      worker.terminate();
      if (message.kind === 'error') fail(new Error(message.message));
      else resolve(message.result as ResultOf<R['kind']>);
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      fail(new Error(event.message));
    });
  });
  worker.postMessage(request);
  return {
    result,
    cancel: () => {
      worker.terminate();
      reject(new CancelledError());
    },
  };
}
