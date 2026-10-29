// Passphrase-encrypted export file (ADR-0004 I2). AES-256-GCM with a key from
// PBKDF2-HMAC-SHA-256, 600 000 iterations (OWASP Password Storage Cheat Sheet),
// 16-byte random salt, 12-byte random IV. All through WebCrypto.

export const ITERATIONS = 600_000;
const FORMAT = 'pr-risk-encrypted';

export interface EncryptedFile {
  readonly format: typeof FORMAT;
  readonly version: 1;
  readonly kdf: { readonly name: 'PBKDF2'; readonly hash: 'SHA-256'; readonly iterations: number; readonly salt: string };
  readonly cipher: { readonly name: 'AES-GCM'; readonly iv: string };
  readonly data: string;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('The passphrase is wrong, or the file was changed.');
    this.name = 'WrongPassphraseError';
  }
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// salt and iv are for known-answer tests only. Normal use leaves them random.
export async function encrypt(
  plaintext: string,
  passphrase: string,
  fixed?: { readonly salt: Uint8Array<ArrayBuffer>; readonly iv: Uint8Array<ArrayBuffer>; readonly iterations?: number },
): Promise<EncryptedFile> {
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.');
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iv = fixed?.iv ?? crypto.getRandomValues(new Uint8Array(12));
  const iterations = fixed?.iterations ?? ITERATIONS;
  const key = await deriveKey(passphrase, salt, iterations);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
  return {
    format: FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(data),
  };
}

export function isEncryptedFile(value: unknown): boolean {
  return value !== null && typeof value === 'object' && (value as { format?: unknown }).format === FORMAT;
}

// The file comes from outside, so every field is checked before use.
function readEncryptedFile(value: unknown): { salt: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer>; iterations: number } {
  const file = value as { format?: unknown; version?: unknown; kdf?: Record<string, unknown>; cipher?: Record<string, unknown>; data?: unknown };
  const text = (input: unknown): string => {
    if (typeof input !== 'string') throw new Error('This is not a pr-risk encrypted file.');
    return input;
  };
  if (!isEncryptedFile(value) || file.version !== 1 || file.kdf?.['name'] !== 'PBKDF2' || file.kdf['hash'] !== 'SHA-256' || file.cipher?.['name'] !== 'AES-GCM') {
    throw new Error('This encrypted file version is not supported.');
  }
  const iterations = file.kdf['iterations'];
  if (typeof iterations !== 'number' || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) {
    throw new Error('The key setting of this file is outside the allowed range.');
  }
  return { salt: fromBase64(text(file.kdf['salt'])), iv: fromBase64(text(file.cipher['iv'])), data: fromBase64(text(file.data)), iterations };
}

export async function decrypt(value: unknown, passphrase: string): Promise<string> {
  const file = readEncryptedFile(value);
  const key = await deriveKey(passphrase, file.salt, file.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: file.iv }, key, file.data);
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}
