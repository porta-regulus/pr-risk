import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';

// Screen S1 under the production CSP and Trusted Types: open, create, import, export, restore, remove all.
// Also AT-4 through the screen (OSCAL export and lossless import) and ADR-0004 I5 (remove all leaves
// no document, no version, no cache and no service worker).
test('start screen works end to end with no CSP violation', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByText('No document is stored in this browser.')).toBeVisible();

  // Open an example.
  await page.getByRole('button', { name: 'SME with numbers (example 2)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await expect(page.getByText('You have not saved a copy of this document yet.')).toBeVisible();
  await expectAccessible(page, 'S1 with a document');

  // Export the app file. The reminder goes away.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'App file (JSON)' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8')) as { schemaVersion: string; risks: unknown[] };
  expect(exported.schemaVersion).toBe('1.0.0');
  expect(exported.risks).toHaveLength(9);
  await expect(page.getByText('You have not saved a copy of this document yet.')).toBeHidden();

  // Save an encrypted copy for the restore below.
  const passphrase = 'correct horse battery staple';
  await page.getByLabel('Passphrase for an encrypted copy').fill(passphrase);
  const encryptedPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Encrypted copy' }).click();
  const encrypted = readFileSync(await (await encryptedPromise).path());

  // Save an OSCAL POA&M copy for the AT-4 import below.
  const oscalPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'OSCAL POA&M' }).click();
  const oscal = readFileSync(await (await oscalPromise).path());
  expect((JSON.parse(oscal.toString('utf8')) as Record<string, unknown>)['plan-of-action-and-milestones']).toBeDefined();

  // Create a new document and import the Table 10 CSV into it through the import worker.
  await page.getByLabel('Title', { exact: true }).fill('Test register');
  await page.getByLabel('Organization').fill('Example GmbH');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '"Test register" is created.' })).toBeVisible();
  const csv = fileURLToPath(new URL('../docs/schema/fixtures/table10-system-registers.csv', import.meta.url));
  await page.setInputFiles('#import-file', csv);
  await expect(page.getByText('Format csv. 3 risks, 3 new registers')).toBeVisible();
  await page.getByRole('button', { name: 'Add to Test register' }).click();
  await expect(page.getByText('3 risks from table10-system-registers.csv are saved.')).toBeVisible();
  await expect(page.getByText('4 registers, 3 risks')).toBeVisible();

  // Remove everything after a typed confirmation (ADR-0004 I5). The service worker and its cache exist first.
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  const remove = page.getByRole('button', { name: 'Remove all data from this browser' });
  await expect(remove).toBeDisabled();
  await page.getByLabel(/Type REMOVE/).fill('REMOVE');
  await remove.click();
  await expect(page.getByText('All data is removed from this browser.')).toBeVisible();
  await expect(page.getByText('No document is stored in this browser.')).toBeVisible();
  expect(await page.evaluate(storedData)).toEqual({ documents: 0, versions: 0, caches: 0, workers: 0, local: 0 });

  // In an empty browser, restore the encrypted copy as a whole document.
  await page.getByLabel('Passphrase, only for an encrypted file').fill(passphrase);
  await page.setInputFiles('#import-file', { name: 'backup.encrypted.json', mimeType: 'application/json', buffer: encrypted });
  await expect(page.getByText('Format native. 9 risks')).toBeVisible();
  await page.getByRole('button', { name: 'Save as a new document' }).click();
  await expect(page.getByText('9 risks from backup.encrypted.json are saved.')).toBeVisible();
  await page.getByLabel(/Type REMOVE/).fill('REMOVE');
  await remove.click();
  await expect(page.getByText('All data is removed from this browser.')).toBeVisible();

  // AT-4 through the screen. In an empty browser, the OSCAL copy restores example 2 by the lossless path.
  await page.setInputFiles('#import-file', { name: 'example-2.oscal-poam.json', mimeType: 'application/json', buffer: oscal });
  await expect(page.getByText('Format oscal-poam. 9 risks')).toBeVisible();
  await page.getByRole('button', { name: 'Save as a new document' }).click();
  await expect(page.getByText('9 risks from example-2.oscal-poam.json are saved.')).toBeVisible();
  // Lossless means the whole document, not only the risks: the native path restores the risks too.
  const original = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/schema/examples/example-2-sme-quantitative.json', import.meta.url)), 'utf8')) as Record<string, unknown>;
  expect(withoutLogs(await page.evaluate(storedDocument))).toEqual(withoutLogs(original));
  await page.getByLabel(/Type REMOVE/).fill('REMOVE');
  await remove.click();
  await expect(page.getByText('All data is removed from this browser.')).toBeVisible();

  // In an empty browser, import a CSV without a register column.
  await page.setInputFiles('#import-file', fileURLToPath(new URL('../docs/schema/fixtures/sp800-221r1-fig10.csv', import.meta.url)));
  await expect(page.getByText('Format csv. 10 risks')).toBeVisible();
  await page.getByRole('button', { name: 'Save as a new document' }).click();
  await expect(page.getByText('10 risks from sp800-221r1-fig10.csv are saved.')).toBeVisible();
  await page.getByLabel(/Type REMOVE/).fill('REMOVE');
  await remove.click();
  await expect(page.getByText('No document is stored in this browser.')).toBeVisible();

  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});

// SPEC.md Sec. 9.7 through the screen. A parent register takes a newer file of its child registers
// and keeps current, takes incoming or keeps both, one choice per changed risk.
test('import into an open document shows the diff and takes one choice per risk', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Table 10 imports (example 3)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  const original = await page.evaluate(storedDocument);
  const originalRisk = (id: string) => (original['risks'] as Risk[]).find((risk) => risk.riskId === id);

  // A newer copy of the Table 10 file. A-1 has a new likelihood, B-1 a new impact, C-1 a new response type.
  const table10 = readFileSync(fileURLToPath(new URL('../docs/schema/fixtures/table10-system-registers.csv', import.meta.url)), 'utf8');
  const newer = table10.replace(',0.1,2000000,', ',0.15,2000000,').replace(',0.3,400000,', ',0.3,450000,').replace('Accept,General counsel', 'Mitigate,General counsel');
  await page.setInputFiles('#import-file', { name: 'table10-newer.csv', mimeType: 'text/csv', buffer: Buffer.from(newer, 'utf8') });
  await expect(page.getByText('Format csv. 3 risks, 0 new registers')).toBeVisible();
  await expect(page.getByText('3 risks have other values in the file.')).toBeVisible();

  // One group per changed risk, with field, current and incoming. Take incoming is the default.
  const group = (id: string) => page.getByRole('group', { name: `Risk ${id}` });
  const row = (id: string, field: string) => page.getByRole('region', { name: `Changed fields of Risk ${id}` }).getByRole('row', { name: field });
  await expect(row('A-1', 'riskLikelihood').getByRole('cell')).toHaveText(['0.1', '0.15']);
  await expect(row('B-1', 'riskImpact').getByRole('cell')).toHaveText(['400000', '450000']);
  await expect(row('C-1', 'riskResponseType').getByRole('cell')).toHaveText(['Accept', 'Mitigate']);
  await expect(row('A-1', 'notes').getByRole('cell').nth(1)).toHaveText('Not set');
  for (const id of ['A-1', 'B-1', 'C-1']) await expect(group(id).getByRole('radio', { name: 'Take incoming' })).toBeChecked();
  await expectAccessible(page, 'S1 with an import diff');

  // Keep current for A-1 with the keyboard, keep both for C-1 with the mouse, B-1 stays on take incoming.
  await group('A-1').getByRole('radio', { name: 'Take incoming' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(group('A-1').getByRole('radio', { name: 'Keep current' })).toBeChecked();
  await group('C-1').getByRole('radio', { name: 'Keep both' }).check();
  await expect(group('B-1').getByRole('radio', { name: 'Take incoming' })).toBeChecked();

  // No horizontal overflow at 375 px. The diff tables scroll inside their own regions.
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.getByRole('button', { name: /^Add to / }).click();
  await expect(page.getByText('2 risks from table10-newer.csv are saved. 1 risk keeps its current version.')).toBeVisible();

  // The stored document has the result of each choice, and the change log records it.
  const stored = await page.evaluate(storedDocument);
  const risk = (id: string) => (stored['risks'] as Risk[]).find((item) => item.riskId === id);
  expect(risk('A-1')).toEqual(originalRisk('A-1'));
  expect(risk('B-1')?.riskImpact).toBe(450000);
  expect(risk('C-1')).toEqual(originalRisk('C-1'));
  expect(risk('C-1-2')?.riskResponseType).toEqual(['Mitigate']);
  expect((stored['risks'] as Risk[]).length).toBe((original['risks'] as Risk[]).length + 1);
  const log = stored['changeLog'] as { entityKind: string; entityId: string; before?: unknown; after?: unknown }[];
  expect(log.map((entry) => [entry.entityKind, entry.entityId])).toEqual([
    ['risk', 'B-1'],
    ['risk', 'C-1-2'],
  ]);
  expect(log[0]?.before).toEqual(originalRisk('B-1'));
  expect(log[0]?.after).toEqual(risk('B-1'));
  expect(log[1]).not.toHaveProperty('before');
  expect(log[1]?.after).toEqual(risk('C-1-2'));
  expect((stored['provenance'] as { fileName: string }[]).at(-1)?.fileName).toBe('table10-newer.csv');

  expect(problems, 'errors, warnings and CSP violations').toEqual([]);
});

// The diff of a preview is valid only for the document it was made against. Selecting another
// document closes the preview, so no choice is committed against the wrong diff.
test('selecting another document closes the import preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Table 10 imports (example 3)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await page.getByRole('button', { name: 'SME with numbers (example 2)' }).click();
  await expect(page.getByRole('row', { name: /Example Machinery/ }).getByRole('button', { name: 'Selected' })).toBeVisible();
  await page.getByRole('row', { name: /Import adapters/ }).getByRole('button', { name: 'Select' }).click();

  const table10 = readFileSync(fileURLToPath(new URL('../docs/schema/fixtures/table10-system-registers.csv', import.meta.url)), 'utf8');
  await page.setInputFiles('#import-file', { name: 'table10-newer.csv', mimeType: 'text/csv', buffer: Buffer.from(table10.replace(',0.1,2000000,', ',0.15,2000000,'), 'utf8') });
  await expect(page.getByRole('group', { name: 'Risk A-1' })).toBeVisible();

  await page.getByRole('row', { name: /Example Machinery/ }).getByRole('button', { name: 'Select' }).click();
  await expect(page.getByText('The selected document changed, so the preview is closed. Choose the file again.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preview of table10-newer.csv' })).toBeHidden();
  await expect(page.getByRole('button', { name: /^Add to / })).toBeHidden();
});

// CRA Annex I Part I points 2(e) and 2(f) (docs/release/annex-i-self-check.md, gaps F1, F2 and F4).
test('a damaged stored record is not opened or exported, and its last valid version comes back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'SME with numbers (example 2)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is open' })).toBeVisible();
  await expect(page.getByText('The app does not encrypt the data in this browser.')).toBeVisible();
  await expect(page.getByText('use a browser profile with no extensions')).toBeVisible();

  // A change outside the app while an editor screen is open. The next screen checks the record.
  await page.getByRole('button', { name: 'Context and strategy' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Context and strategy' })).toBeVisible();
  await page.evaluate(damageStoredDocument);
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Identify and analyze' }).click();
  await expect(page.getByRole('alert')).toContainText('The stored copy of this document is damaged, so this screen does not open it.');
  await expectAccessible(page, 'editor with a damaged document');

  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.getByRole('alert')).toContainText('is damaged. Rule ');
  await expect(page.getByText('The stored copy is damaged.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Context and strategy' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'App file (JSON)' })).toBeHidden();
  await expectAccessible(page, 'S1 with a damaged document');

  await page.getByRole('button', { name: 'Restore the last valid version' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Version 1 is restored.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Context and strategy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'App file (JSON)' })).toBeVisible();
  expect((await page.evaluate(storedDocument))['risks']).toHaveLength(9);
});

// Breaks the risk list of the first stored document, as a change in the developer tools would. Runs in the page.
async function damageStoredDocument(): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pr-risk');
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('open failed'));
    };
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const found = cursor.result;
      if (found === null) return;
      const record = found.value as { doc: Record<string, unknown> };
      found.update({ ...record, doc: { ...record.doc, risks: 'none' } });
    };
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('update failed'));
    };
  });
  db.close();
}

interface Risk {
  readonly riskId: string;
  readonly riskImpact?: number;
  readonly riskResponseType?: string[];
}

// What the browser still holds for this origin. Runs in the page.
async function storedData(): Promise<Record<string, number>> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pr-risk');
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('open failed'));
    };
  });
  const count = (store: string) =>
    db.objectStoreNames.contains(store)
      ? new Promise<number>((resolve, reject) => {
          const request = db.transaction(store).objectStore(store).count();
          request.onsuccess = () => {
            resolve(request.result);
          };
          request.onerror = () => {
            reject(request.error ?? new Error('count failed'));
          };
        })
      : Promise.resolve(0);
  const result = {
    documents: await count('documents'),
    versions: await count('versions'),
    caches: (await caches.keys()).length,
    workers: (await navigator.serviceWorker.getRegistrations()).length,
    local: localStorage.length,
  };
  db.close();
  return result;
}

// AT-4 step 3 compares without the change log and the provenance record of the import.
function withoutLogs(doc: Record<string, unknown>): Record<string, unknown> {
  const { changeLog, provenance, ...rest } = doc;
  return rest;
}

// The one stored document. Runs in the page.
async function storedDocument(): Promise<Record<string, unknown>> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('pr-risk');
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('open failed'));
    };
  });
  const all = await new Promise<{ doc: Record<string, unknown> }[]>((resolve, reject) => {
    const request = db.transaction('documents').objectStore('documents').getAll();
    request.onsuccess = () => {
      resolve(request.result as { doc: Record<string, unknown> }[]);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('read failed'));
    };
  });
  db.close();
  if (all.length !== 1 || all[0] === undefined) throw new Error(`Expected one stored document, found ${String(all.length)}`);
  return all[0].doc;
}
