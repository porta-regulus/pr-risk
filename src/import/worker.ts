// The import Web Worker (SPEC.md Sec. 9.1 item 1). Parsing never runs on the page thread.
import type { RiskDocument } from '../schema/types';
import { prepareImport, type ImportFile, type ImportOptions, type ImportPreview } from './pipeline';

export interface ImportRequest {
  readonly doc: RiskDocument;
  readonly file: ImportFile;
  readonly options: Omit<ImportOptions, 'newRegister'>;
}

export type ImportResponse = { readonly kind: 'preview'; readonly preview: ImportPreview } | { readonly kind: 'error'; readonly message: string };

addEventListener('message', (event: MessageEvent<ImportRequest>) => {
  const { doc, file, options } = event.data;
  try {
    postMessage({ kind: 'preview', preview: prepareImport(doc, file, options) } satisfies ImportResponse);
  } catch (error) {
    postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) } satisfies ImportResponse);
  }
});
