import { z } from 'zod';
import { InstitutionalEmailSchema, QrTokenSchema } from './auth';

const AES_GCM_IV_BYTES = 12;
const KEY_VERSION_HEADER_BYTES = 4;
const AES_GCM_TAG_MIN_BYTES = 16;
const MIN_CIPHERTEXT_BYTES =
  KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES + AES_GCM_TAG_MIN_BYTES;
const MIN_SECRET_BYTES = 16;
const MAX_KEY_VERSION = 0xffffffff;
const QR_HMAC_HEX_LENGTH = 24;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const UuidSchema = z.string().uuid();

export interface EncryptedPiiPayload {
  ciphertext: Uint8Array;
  byteaHex: string;
  keyVersion: number;
}

export interface DecryptedPiiPayload {
  plaintext: string;
  keyVersion: number;
}

function getSubtleCrypto(): SubtleCrypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('WebCrypto subtle API is unavailable in this runtime.');
  }
  return cryptoApi.subtle;
}

function toArrayBufferView(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}

function toSecretBytes(secret: string | Uint8Array, label: string): Uint8Array<ArrayBuffer> {
  const bytes = typeof secret === 'string' ? textEncoder.encode(secret) : secret;
  if (bytes.byteLength < MIN_SECRET_BYTES) {
    throw new Error(`${label} must be at least ${MIN_SECRET_BYTES} bytes.`);
  }
  return toArrayBufferView(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const cleaned = hex.startsWith('\\x') ? hex.slice(2) : hex;
  if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error('Invalid hex payload.');
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function encodeByteaHex(bytes: Uint8Array): string {
  return `\\x${bytesToHex(bytes)}`;
}

export function decodeByteaHex(input: Uint8Array | string): Uint8Array<ArrayBuffer> {
  return typeof input === 'string' ? hexToBytes(input) : toArrayBufferView(input);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function importHmacKey(secret: string | Uint8Array, label: string): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const keyBytes = toSecretBytes(secret, label);
  return subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function importAesGcmKey(
  keyMaterial: string | Uint8Array,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const rawBytes = toSecretBytes(keyMaterial, 'AES encryption key');
  const aesBytes =
    rawBytes.byteLength === 32
      ? rawBytes
      : new Uint8Array(await subtle.digest('SHA-256', rawBytes));

  return subtle.importKey('raw', aesBytes, { name: 'AES-GCM' }, false, usage);
}

function encodeKeyVersionHeader(keyVersion: number): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > MAX_KEY_VERSION) {
    throw new Error('keyVersion must be a positive 32-bit integer.');
  }
  const header = new Uint8Array(KEY_VERSION_HEADER_BYTES);
  new DataView(header.buffer).setUint32(0, keyVersion, false);
  return header;
}

/**
 * Computes a deterministic keyed HMAC-SHA256 blind index over normalized institutional email.
 */
export async function computeEmailBlindIndex(
  rawEmail: string,
  blindIndexPepper: string | Uint8Array
): Promise<string> {
  const normalizedEmail = InstitutionalEmailSchema.parse(rawEmail);
  const key = await importHmacKey(blindIndexPepper, 'Blind index pepper');
  const signature = await getSubtleCrypto().sign(
    'HMAC',
    key,
    toArrayBufferView(textEncoder.encode(normalizedEmail))
  );
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Encrypts a PII value with AES-256-GCM and binds keyVersion as AEAD additional data.
 */
export async function encryptPii(
  plaintext: string,
  keyMaterial: string | Uint8Array,
  keyVersion = 1
): Promise<EncryptedPiiPayload> {
  const versionHeader = encodeKeyVersionHeader(keyVersion);
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  globalThis.crypto.getRandomValues(iv);

  const key = await importAesGcmKey(keyMaterial, ['encrypt']);
  const encrypted = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv, additionalData: versionHeader },
    key,
    toArrayBufferView(textEncoder.encode(plaintext))
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(
    KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES + encryptedBytes.byteLength
  );
  combined.set(versionHeader, 0);
  combined.set(iv, KEY_VERSION_HEADER_BYTES);
  combined.set(encryptedBytes, KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES);

  return {
    ciphertext: combined,
    byteaHex: encodeByteaHex(combined),
    keyVersion,
  };
}

/**
 * Decrypts versioned AES-256-GCM PII ciphertext using the matching key from keyRing.
 */
export async function decryptPii(
  ciphertextOrBytea: Uint8Array | string,
  keyRing: Record<number, string | Uint8Array>
): Promise<DecryptedPiiPayload> {
  const payload = decodeByteaHex(ciphertextOrBytea);
  if (payload.byteLength < MIN_CIPHERTEXT_BYTES) {
    throw new Error('Encrypted PII payload is truncated or malformed.');
  }

  const versionHeader = payload.slice(0, KEY_VERSION_HEADER_BYTES);
  const keyVersion = new DataView(versionHeader.buffer).getUint32(0, false);
  const keyMaterial =
    keyVersion >= 1 && Object.prototype.hasOwnProperty.call(keyRing, keyVersion)
      ? keyRing[keyVersion]
      : undefined;
  if (!keyMaterial) {
    throw new Error(`Missing encryption key for key_version ${keyVersion}.`);
  }

  const iv = payload.slice(KEY_VERSION_HEADER_BYTES, KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES);
  const cipher = payload.slice(KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES);

  const key = await importAesGcmKey(keyMaterial, ['decrypt']);
  const decrypted = await getSubtleCrypto().decrypt(
    { name: 'AES-GCM', iv, additionalData: versionHeader },
    key,
    cipher
  );

  return {
    plaintext: textDecoder.decode(new Uint8Array(decrypted)),
    keyVersion,
  };
}

/**
 * Re-encrypts an existing PII payload under targetKeyVersion during key rotation.
 */
export async function rotateEncryptedPii(
  ciphertextOrBytea: Uint8Array | string,
  keyRing: Record<number, string | Uint8Array>,
  targetKeyVersion: number
): Promise<EncryptedPiiPayload> {
  const targetKey = keyRing[targetKeyVersion];
  if (!targetKey) {
    throw new Error(`Missing target encryption key for key_version ${targetKeyVersion}.`);
  }
  const { plaintext } = await decryptPii(ciphertextOrBytea, keyRing);
  return encryptPii(plaintext, targetKey, targetKeyVersion);
}

/**
 * Generates an opaque permanent QR token `v1.<profile_id>.<short_hmac>` with zero raw PII.
 */
export async function generateOpaqueQrToken(
  profileId: string,
  qrSecret: string | Uint8Array
): Promise<string> {
  const normalizedId = UuidSchema.parse(profileId).toLowerCase();
  const key = await importHmacKey(qrSecret, 'QR signing secret');
  const signature = await getSubtleCrypto().sign(
    'HMAC',
    key,
    toArrayBufferView(textEncoder.encode(`v1:${normalizedId}`))
  );
  const shortHmac = bytesToHex(new Uint8Array(signature)).slice(0, QR_HMAC_HEX_LENGTH);
  return `v1.${normalizedId}.${shortHmac}`;
}

/**
 * Verifies an opaque QR token signature in constant time and extracts the profile UUID.
 */
export async function verifyOpaqueQrToken(
  qrToken: string,
  qrSecret: string | Uint8Array
): Promise<{ valid: boolean; profileId: string | null }> {
  const parsed = QrTokenSchema.safeParse(qrToken);
  if (!parsed.success) {
    return { valid: false, profileId: null };
  }

  const [, profileId, providedHmac] = parsed.data.split('.');
  const expectedToken = await generateOpaqueQrToken(profileId, qrSecret);
  const expectedHmac = expectedToken.split('.')[2];

  const valid = constantTimeEqual(
    textEncoder.encode(providedHmac),
    textEncoder.encode(expectedHmac)
  );
  return { valid, profileId: valid ? profileId : null };
}
