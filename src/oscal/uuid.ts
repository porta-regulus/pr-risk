// UUIDv5 (RFC 9562 Sec. 5.5) for stable OSCAL identifiers (SPEC.md Sec. 7.5).
// SHA-1 is used here only because UUIDv5 defines it. It protects nothing.

function sha1(message: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil((message.length + 9) / 64) * 64);
  padded.set(message);
  padded.set([0x80], message.length);
  const view = new DataView(padded.buffer);
  const bits = message.length * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(padded.length - 4, bits >>> 0);
  const h = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;
  for (let block = 0; block < padded.length; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4);
    for (let t = 16; t < 80; t++) w[t] = rotl((w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0), 1);
    let [a, b, c, d, e] = [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0, h[3] ?? 0, h[4] ?? 0];
    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) [f, k] = [(b & c) | (~b & d), 0x5a827999];
      else if (t < 40) [f, k] = [b ^ c ^ d, 0x6ed9eba1];
      else if (t < 60) [f, k] = [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
      else [f, k] = [b ^ c ^ d, 0xca62c1d6];
      const temp = (rotl(a, 5) + f + e + k + (w[t] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h[0] = (h[0] ?? 0) + a;
    h[1] = (h[1] ?? 0) + b;
    h[2] = (h[2] ?? 0) + c;
    h[3] = (h[3] ?? 0) + d;
    h[4] = (h[4] ?? 0) + e;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  h.forEach((word, i) => {
    outView.setUint32(i * 4, word);
  });
  return out;
}

export function sha1Hex(text: string): string {
  return Array.from(sha1(new TextEncoder().encode(text)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`Not a UUID: ${uuid}`);
  return Uint8Array.from({ length: 16 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

export function uuidv5(namespace: string, name: string): string {
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + nameBytes.length);
  input.set(parseUuid(namespace));
  input.set(nameBytes, 16);
  const bytes = sha1(input).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// The fixed namespace of SPEC.md Sec. 7.5. Never change it, or every exported UUID changes.
export const PR_RISK_NAMESPACE = 'b3f6d0a2-5c1e-4e8a-9f42-7d2c6a1e9b50';
