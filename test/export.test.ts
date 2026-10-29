// Exports (SPEC.md Sec. 9.8), the CSV injection guard (ADR-0004 T4) and the encrypted
// export file (ADR-0004 I2), with a known-answer test against node:crypto.
import { createCipheriv, pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, ITERATIONS, WrongPassphraseError } from '../src/export/encryption';
import { exportCsv, exportIr8286, exportNative, guardCell, hasDefaultedNumbers } from '../src/export/export';
import { decodeText, parseCsv } from '../src/import/csv';
import { canonicalize, readDocument, REGISTER_FIELDS, type RiskDocument } from '../src/schema';
import { example, EXAMPLE_1, EXAMPLE_2 } from './schema-helpers';

describe('native JSON', () => {
  it('is the RFC 8785 form and reads back', () => {
    const doc = example(EXAMPLE_2);
    const text = exportNative(doc);
    expect(text).toBe(canonicalize(doc));
    const read = readDocument(text);
    expect(read.ok && canonicalize(read.doc)).toBe(text);
  });
});

describe('IR 8286 JSON', () => {
  it('rule E-02 asks first when numbers are placeholders', () => {
    const doc = example(EXAMPLE_1);
    const placeholders = doc.risks.filter(hasDefaultedNumbers).map((risk) => risk.riskId);
    expect(exportIr8286(doc)).toEqual({ ok: false, confirm: placeholders });
    const included = exportIr8286(doc, 'include');
    const excluded = exportIr8286(doc, 'exclude');
    expect(included.ok && included.riskIds.length).toBe(doc.risks.length);
    expect(excluded.ok && excluded.riskIds).toEqual(doc.risks.filter((risk) => !placeholders.includes(risk.riskId)).map((risk) => risk.riskId));
  });

  it('writes two arrays when nothing is a placeholder', () => {
    const result = exportIr8286(example(EXAMPLE_2));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entries = JSON.parse(result.registerEntries) as Record<string, unknown>[];
      const rdrs = JSON.parse(result.riskDetailRecords) as Record<string, unknown>[];
      expect(entries).toHaveLength(9);
      expect(Object.keys(entries[0] ?? {})).toEqual([...REGISTER_FIELDS]);
      expect(rdrs).toHaveLength(9);
    }
  });

  it('rule E-01 refuses a file that fails the NIST schema', () => {
    const doc = example(EXAMPLE_2);
    const broken = { ...doc, risks: doc.risks.map((risk, i) => (i === 0 ? { ...risk, riskId: 7 as unknown as string } : risk)) } as RiskDocument;
    const result = exportIr8286(broken);
    expect(result.ok).toBe(false);
    expect('errors' in result && result.errors.length).toBeGreaterThan(0);
  });
});

describe('CSV', () => {
  it('guards the six formula prefixes of OWASP CSV Injection', () => {
    for (const start of ['=', '+', '-', '@', '\t', '\r']) expect(guardCell(`${start}1+1`)).toBe(`'${start}1+1`);
    expect(guardCell('Plain text')).toBe('Plain text');
  });

  it('puts the NIST columns first and reads back with the importer', () => {
    const doc = example(EXAMPLE_1);
    const evil = { ...doc, risks: doc.risks.map((risk, i) => (i === 0 ? { ...risk, riskDescription: '=HYPERLINK("http://x","a, b")' } : risk)) };
    const rows = parseCsv(decodeText(new TextEncoder().encode(exportCsv(evil))).text);
    expect(rows[0]?.slice(0, REGISTER_FIELDS.length)).toEqual([...REGISTER_FIELDS]);
    expect(rows).toHaveLength(doc.risks.length + 1);
    expect(rows[1]?.[1]).toBe('\'=HYPERLINK("http://x","a, b")');
  });
});

describe('encrypted export', () => {
  const passphrase = 'correct horse battery staple';

  it('reads back with the right passphrase and refuses a wrong one or a changed file', async () => {
    const file = await encrypt('{"a":1}', passphrase);
    expect(file.kdf.iterations).toBe(ITERATIONS);
    expect(await decrypt(file, passphrase)).toBe('{"a":1}');
    await expect(decrypt(file, 'wrong passphrase!')).rejects.toBeInstanceOf(WrongPassphraseError);
    const changed = { ...file, data: file.data.slice(0, -4) + (file.data.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
    await expect(decrypt(changed, passphrase)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('equals node:crypto for a fixed salt and IV (known answer)', async () => {
    const salt = new Uint8Array(16).map((_, i) => i);
    const iv = new Uint8Array(12).map((_, i) => 100 + i);
    const plaintext = 'PortaRegulus Risk known-answer test';
    const file = await encrypt(plaintext, passphrase, { salt, iv });
    const key = pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha256');
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const expected = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]).toString('base64');
    expect(file.data).toBe(expected);
  });

  it('refuses short passphrases and files with a weak key setting', async () => {
    await expect(encrypt('x', 'short')).rejects.toThrow('12 characters');
    const file = await encrypt('x', passphrase);
    await expect(decrypt({ ...file, kdf: { ...file.kdf, iterations: 1000 } }, passphrase)).rejects.toThrow('outside the allowed range');
    await expect(decrypt({ format: 'other' }, passphrase)).rejects.toThrow('not supported');
  });
});
