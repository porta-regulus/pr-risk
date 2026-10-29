// Build task 4 step 1 in Chromium. The import runs in a Web Worker and stops at its time limit.
import { expect, it } from 'vitest';
import example1 from '../../docs/schema/examples/example-1-sp800-221r1-fig10-table9.json';
import fig10 from '../../docs/schema/fixtures/sp800-221r1-fig10.csv?raw';
import { ImportTimeoutError, runImport } from '../../src/import/client';
import type { Register, RiskDocument } from '../../src/schema';

const source = example1 as unknown as RiskDocument;
const err = source.registers.find((register) => register.id === 'ERR') as Register;
const doc: RiskDocument = { ...source, registers: [err], risks: [], provenance: [] };
const bytes = new TextEncoder().encode(fig10);

it('imports Fig. 10 in a worker with no errors', async () => {
  const preview = await runImport({ doc, file: { fileName: 'fig10.csv', bytes }, options: { register: err } });
  expect(preview.errors).toEqual([]);
  expect(preview.risks).toHaveLength(10);
});

it('stops the worker at the time limit', async () => {
  const big = new TextEncoder().encode(`Risk Id,Risk Description,Risk Owner\n${Array.from({ length: 4000 }, (_, i) => `${String(i)},x,y`).join('\n')}`);
  await expect(runImport({ doc, file: { fileName: 'big.csv', bytes: big }, options: { register: err } }, 1)).rejects.toBeInstanceOf(ImportTimeoutError);
});
