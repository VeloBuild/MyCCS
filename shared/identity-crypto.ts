import { z } from 'zod';
import { InstitutionalEmailSchema, QrTokenSchema } from './auth';
import {
  constantTimeEqual,
  createAesGcmKey,
  createHmacKey,
  decodeByteaHex,
  decryptKeyCode,
  encryptWithAesKey,
  signEmailBlindIndex,
  signHmacHex,
} from '../supabase/functions/_shared/gmetrix-crypto';

export { decodeByteaHex };

const QR_HMAC_HEX_LENGTH = 24;
const textEncoder = new TextEncoder();
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

export async function computeEmailBlindIndex(
  rawEmail: string,
  blindIndexPepper: string | Uint8Array
): Promise<string> {
  const normalizedEmail = InstitutionalEmailSchema.parse(rawEmail);
  const key = await createHmacKey(blindIndexPepper, 'Blind index pepper');
  return signEmailBlindIndex(normalizedEmail, key);
}

export async function encryptPii(
  plaintext: string,
  keyMaterial: string | Uint8Array,
  keyVersion = 1
): Promise<EncryptedPiiPayload> {
  const key = await createAesGcmKey(keyMaterial, ['encrypt']);
  return encryptWithAesKey(plaintext, key, keyVersion);
}

export async function decryptPii(
  ciphertextOrBytea: Uint8Array | string,
  keyRing: Record<number, string | Uint8Array>
): Promise<DecryptedPiiPayload> {
  return decryptKeyCode(ciphertextOrBytea, keyRing);
}

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

export async function generateOpaqueQrToken(
  profileId: string,
  qrSecret: string | Uint8Array
): Promise<string> {
  const normalizedId = UuidSchema.parse(profileId).toLowerCase();
  const key = await createHmacKey(qrSecret, 'QR signing secret');
  const signatureHex = await signHmacHex(`v1:${normalizedId}`, key);
  return `v1.${normalizedId}.${signatureHex.slice(0, QR_HMAC_HEX_LENGTH)}`;
}

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
