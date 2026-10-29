// Build task 2 step 5. RFC 8785 canonical JSON and SHA-256 in plain TypeScript.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canonicalize, sha256, sha256Hex, toHex } from '../src/schema';

describe('SHA-256', () => {
  it('gives the FIPS 180-4 example digests', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(sha256Hex('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('equals node:crypto for any input, including every padding boundary', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        expect(toHex(sha256(bytes))).toBe(createHash('sha256').update(bytes).digest('hex'));
      }),
      { numRuns: 500 },
    );
  });

  it('confirms that the vendored NIST files are unchanged (SPEC.md Sec. 13)', () => {
    const pins: [string, string][] = [
      ['risk_register_schema.json', 'ff85e9c917bce3e7646b974c7b8b62ba9fcf5d90d12906e6f46be4d3653b2e69'],
      ['risk_detail_record_schema.json', 'bf9b8c0f888fc2421d094ec697cc8977347ae66d7cfc236e89bd027a23750d60'],
      ['risk_detail_record_example.json', '8b7a5630c60df9bc696a479a4d12785bd20987cfe0bc6345d9a58b060fc427da'],
    ];
    for (const [file, hash] of pins) {
      const bytes = readFileSync(new URL(`../docs/schema/vendor/nist-ir8286r1/${file}`, import.meta.url));
      expect(sha256Hex(new Uint8Array(bytes)), file).toBe(hash);
    }
  });
});

describe('RFC 8785 canonical JSON', () => {
  it('serializes numbers as in RFC 8785 Appendix B', () => {
    const cases: [number, string][] = [
      [0, '0'],
      [-0, '0'],
      [1e21, '1e+21'],
      [1e-7, '1e-7'],
      [333333333.3333333, '333333333.3333333'],
      [1e30, '1e+30'],
      [4.5, '4.5'],
      [0.002, '0.002'],
      [1e-27, '1e-27'],
      [9007199254740992, '9007199254740992'],
      [295147905179352830000, '295147905179352830000'],
    ];
    for (const [value, text] of cases) expect(canonicalize(value)).toBe(text);
  });

  it('sorts keys by UTF-16 code units (RFC 8785 Sec. 3.2.3)', () => {
    const input = {
      '€': 'Euro Sign',
      '\r': 'Carriage Return',
      'דּ': 'Hebrew Letter Dalet With Dagesh',
      '1': 'One',
      '😀': 'Emoji: Grinning Face',
      '\u0080': 'Control',
      'ö': 'Latin Small Letter O With Diaeresis',
    };
    // Object.keys would put the integer-like key "1" first, so compare the text.
    expect(canonicalize(input)).toBe(
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis",' +
        '"€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
    );
  });

  it('has no whitespace, keeps array order and round-trips any JSON value', () => {
    expect(canonicalize({ b: [3, 1, { d: true, c: null }], a: 'x' })).toBe('{"a":"x","b":[3,1,{"c":null,"d":true}]}');
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const text = canonicalize(value);
        expect(canonicalize(JSON.parse(text))).toBe(text);
      }),
      { numRuns: 300 },
    );
  });

  it('rejects values that JSON cannot hold', () => {
    expect(() => canonicalize(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => canonicalize('\ud800')).toThrow(TypeError);
  });
});
