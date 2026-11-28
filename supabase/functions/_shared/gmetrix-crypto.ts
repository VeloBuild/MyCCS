const AES_GCM_IV_BYTES = 12;
const KEY_VERSION_HEADER_BYTES = 4;
const AES_GCM_TAG_MIN_BYTES = 16;
const MIN_CIPHERTEXT_BYTES =
  KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES + AES_GCM_TAG_MIN_BYTES;
const MIN_SECRET_BYTES = 16;
const MAX_KEY_VERSION = 0xffffffff;
const POSITIVE_INT_REGEX = /^[1-9]\d*$/;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedKeyPayload {
  ciphertext: Uint8Array;
  byteaHex: string;
  keyVersion: number;
}

export interface DecryptedKeyPayload {
  plaintext: string;
  keyVersion: number;
}

export interface ParsedKeyRingConfig {
  activeVersion: number;
  keyRing: Record<number, string>;
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

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const cleaned =
    hex.startsWith('\\x') || hex.startsWith('\\X') ? hex.slice(2) : hex;
  if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error('Invalid hex payload.');
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function encodeByteaHex(bytes: Uint8Array): string {
  return `\\x${bytesToHex(bytes)}`;
}

export function decodeByteaHex(input: Uint8Array | string): Uint8Array<ArrayBuffer> {
  return typeof input === 'string' ? hexToBytes(input) : toArrayBufferView(input);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function encodeKeyVersionHeader(keyVersion: number): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > MAX_KEY_VERSION) {
    throw new Error('keyVersion must be a positive 32-bit integer.');
  }
  const header = new Uint8Array(KEY_VERSION_HEADER_BYTES);
  new DataView(header.buffer).setUint32(0, keyVersion, false);
  return header;
}

export async function createHmacKey(
  secret: string | Uint8Array,
  label = 'HMAC secret'
): Promise<CryptoKey> {
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

export async function signHmacHex(message: string, key: CryptoKey): Promise<string> {
  const signature = await getSubtleCrypto().sign(
    'HMAC',
    key,
    toArrayBufferView(textEncoder.encode(message))
  );
  return bytesToHex(new Uint8Array(signature));
}

export async function signEmailBlindIndex(
  normalizedEmail: string,
  hmacKey: CryptoKey
): Promise<string> {
  const canonical = normalizedEmail.trim().toLowerCase();
  if (canonical.length === 0) {
    throw new Error('Email must not be empty.');
  }
  return signHmacHex(canonical, hmacKey);
}

export async function signKeyCodeHash(
  rawKeyCode: string,
  hmacKey: CryptoKey
): Promise<string> {
  const canonical = rawKeyCode.trim().toUpperCase();
  if (canonical.length === 0) {
    throw new Error('Key code must not be empty.');
  }
  return signHmacHex(`gmetrix_key:${canonical}`, hmacKey);
}

export async function createAesGcmKey(
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

export async function encryptWithAesKey(
  plaintext: string,
  key: CryptoKey,
  keyVersion = 1
): Promise<EncryptedKeyPayload> {
  const versionHeader = encodeKeyVersionHeader(keyVersion);
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  globalThis.crypto.getRandomValues(iv);

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

export async function decryptWithAesKey(
  ciphertextOrBytea: Uint8Array | string,
  key: CryptoKey
): Promise<DecryptedKeyPayload> {
  const payload = decodeByteaHex(ciphertextOrBytea);
  if (payload.byteLength < MIN_CIPHERTEXT_BYTES) {
    throw new Error('Encrypted payload is truncated or malformed.');
  }

  const versionHeader = payload.slice(0, KEY_VERSION_HEADER_BYTES);
  const keyVersion = new DataView(versionHeader.buffer).getUint32(0, false);
  const iv = payload.slice(
    KEY_VERSION_HEADER_BYTES,
    KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES
  );
  const cipher = payload.slice(KEY_VERSION_HEADER_BYTES + AES_GCM_IV_BYTES);

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

export async function computeEmailBlindIndex(
  normalizedEmail: string,
  blindIndexPepper: string | Uint8Array
): Promise<string> {
  const key = await createHmacKey(blindIndexPepper, 'Blind index pepper');
  return signEmailBlindIndex(normalizedEmail, key);
}

export async function computeKeyCodeHash(
  rawKeyCode: string,
  keyHashPepper: string | Uint8Array
): Promise<string> {
  const key = await createHmacKey(keyHashPepper, 'Key hash pepper');
  return signKeyCodeHash(rawKeyCode, key);
}

export async function encryptKeyCode(
  plaintextKey: string,
  keyMaterial: string | Uint8Array,
  keyVersion = 1
): Promise<EncryptedKeyPayload> {
  if (plaintextKey.length === 0) {
    throw new Error('Plaintext key code must not be empty.');
  }
  const key = await createAesGcmKey(keyMaterial, ['encrypt']);
  return encryptWithAesKey(plaintextKey, key, keyVersion);
}

export async function decryptKeyCode(
  ciphertextOrBytea: Uint8Array | string,
  keyRing: Record<number, string | Uint8Array>
): Promise<DecryptedKeyPayload> {
  const payload = decodeByteaHex(ciphertextOrBytea);
  if (payload.byteLength < MIN_CIPHERTEXT_BYTES) {
    throw new Error('Encrypted payload is truncated or malformed.');
  }

  const keyVersion = new DataView(
    payload.buffer,
    payload.byteOffset,
    KEY_VERSION_HEADER_BYTES
  ).getUint32(0, false);
  const keyMaterial =
    keyVersion >= 1 && Object.prototype.hasOwnProperty.call(keyRing, keyVersion)
      ? keyRing[keyVersion]
      : undefined;
  if (!keyMaterial) {
    throw new Error(`Missing encryption key for key_version ${keyVersion}.`);
  }

  const key = await createAesGcmKey(keyMaterial, ['decrypt']);
  return decryptWithAesKey(payload, key);
}

function parseVersionString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!POSITIVE_INT_REGEX.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_KEY_VERSION) {
    return null;
  }
  return parsed;
}

function isValidKeySecret(value: unknown): value is string {
  return typeof value === 'string' && textEncoder.encode(value).byteLength >= MIN_SECRET_BYTES;
}

export function parseKeyRingEnv(
  readEnv: (key: string) => string | undefined,
  fallbackVaultKey?: string | null
): ParsedKeyRingConfig | null {
  const rawRingJson = readEnv('CERT_KEY_RING_JSON')?.trim() ?? '';
  const rawActiveVersion = readEnv('CERT_KEY_ACTIVE_VERSION')?.trim() ?? '';

  if (rawRingJson.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawRingJson);
    } catch {
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const keyRing: Record<number, string> = {};
    const versions: number[] = [];

    for (const [rawVer, rawKey] of Object.entries(parsed as Record<string, unknown>)) {
      const version = parseVersionString(rawVer);
      if (version === null || !isValidKeySecret(rawKey)) {
        return null;
      }
      keyRing[version] = rawKey;
      versions.push(version);
    }

    if (versions.length === 0) {
      return null;
    }

    if (rawActiveVersion.length > 0) {
      const activeVersion = parseVersionString(rawActiveVersion);
      if (
        activeVersion === null ||
        !Object.prototype.hasOwnProperty.call(keyRing, activeVersion)
      ) {
        return null;
      }
      return { activeVersion, keyRing };
    }

    return {
      activeVersion: Math.max(...versions),
      keyRing,
    };
  }

  const singleEnvKey = readEnv('CERT_KEY_ENCRYPTION_KEY')?.trim() ?? '';
  if (singleEnvKey.length > 0) {
    if (!isValidKeySecret(singleEnvKey)) {
      return null;
    }
    const activeVersion =
      rawActiveVersion.length > 0 ? parseVersionString(rawActiveVersion) : 1;
    if (activeVersion === null) {
      return null;
    }
    return {
      activeVersion,
      keyRing: { [activeVersion]: singleEnvKey },
    };
  }

  const vaultKey = fallbackVaultKey?.trim() ?? '';
  if (!isValidKeySecret(vaultKey)) {
    return null;
  }

  if (rawActiveVersion.length > 0 && parseVersionString(rawActiveVersion) !== 1) {
    return null;
  }

  return {
    activeVersion: 1,
    keyRing: { 1: vaultKey },
  };
}
