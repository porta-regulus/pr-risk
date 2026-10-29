// Run an import in a Web Worker. The worker is stopped after 20 s (ADR-0004 D1).
import { scriptUrl } from '../trusted-types';
import type { ImportPreview } from './pipeline';
import type { ImportRequest, ImportResponse } from './worker';
import workerUrl from './worker?worker&url';

export const IMPORT_TIMEOUT_MS = 20_000;

export class ImportTimeoutError extends Error {
  constructor(milliseconds: number) {
    super(`The import stopped after ${String(milliseconds / 1000)} s. The file is too large or too complex.`);
    this.name = 'ImportTimeoutError';
  }
}

export function runImport(request: ImportRequest, timeoutMs = IMPORT_TIMEOUT_MS): Promise<ImportPreview> {
  const worker = new Worker(scriptUrl(workerUrl), { type: 'module', name: 'import' });
  return new Promise<ImportPreview>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new ImportTimeoutError(timeoutMs));
    }, timeoutMs);
    worker.addEventListener('message', (event: MessageEvent<ImportResponse>) => {
      clearTimeout(timer);
      worker.terminate();
      if (event.data.kind === 'preview') resolve(event.data.preview);
      else reject(new Error(event.data.message));
    });
    worker.addEventListener('error', (event) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(event.message));
    });
    worker.postMessage(request);
  });
}
