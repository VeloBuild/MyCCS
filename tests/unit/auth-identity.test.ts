import { createElement } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import App from '../../App';
import {
  InstitutionalEmailSchema,
  isInstitutionalEmail,
  normalizeInstitutionalEmail,
  OtpCodeSchema,
  PublicProfileDtoSchema,
  RoleSchema,
  SignupRequestSchema,
  SupabaseClientEnvSchema,
  SupabaseServerEnvSchema,
  toPublicProfileDto,
} from '../../shared/auth';
import {
  computeEmailBlindIndex,
  decodeByteaHex,
  decryptPii,
  encryptPii,
  generateOpaqueQrToken,
  rotateEncryptedPii,
  verifyOpaqueQrToken,
} from '../../shared/identity-crypto';
import {
  chunkUtf8,
  createMyCcsSupabaseClient,
  createSecureStoreAdapter,
  expoSecureStoreAdapter,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClientForTesting,
  SECURE_STORE_CHUNK_BYTES,
  type SecureStoreLike,
} from '../../src/lib/supabase';
import { AuthIdentityScreen } from '../../src/screens/AuthIdentityScreen';
import {
  type AuthSupabaseClient,
  fetchCurrentProfile,
  provisionCurrentUserProfile,
  restoreAuthenticatedSession,
  signInWithInstitutionalEmail,
  signOutCurrentSession,
  signUpWithInstitutionalEmail,
  verifySignupOtpAndProvisionProfile,
} from '../../src/services/auth';

declare const require: (id: string) => unknown;
declare const __dirname: string;
declare const process: {
  env: Record<string, string | undefined>;
};

const nodeFs = require('node:fs') as {
  readFileSync(path: string, encoding: string): string;
};
const nodePath = require('node:path') as {
  resolve(...segments: string[]): string;
  join(...segments: string[]): string;
};
const nodeCrypto = require('node:crypto') as {
  webcrypto: Crypto;
};

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
  });
}

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const TEST_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_PEPPER = 'test-blind-index-pepper-material';
const TEST_QR_SECRET = 'test-qr-hmac-secret-material';
const TEST_PII_KEY_V1 = 'test-pii-encryption-key-v1';
const TEST_PII_KEY_V2 = 'test-pii-encryption-key-v2-rotated';

function createMockSupabaseClient(): {
  client: AuthSupabaseClient;
  mocks: {
    signUp: jest.Mock;
    verifyOtp: jest.Mock;
    signInWithPassword: jest.Mock;
    signOut: jest.Mock;
    getSession: jest.Mock;
    rpc: jest.Mock;
  };
} {
  const signUp = jest.fn();
  const verifyOtp = jest.fn();
  const signInWithPassword = jest.fn();
  const signOut = jest.fn();
  const getSession = jest.fn();
  const rpc = jest.fn();

  return {
    client: {
      auth: {
        signUp,
        verifyOtp,
        signInWithPassword,
        signOut,
        getSession,
      } as unknown as AuthSupabaseClient['auth'],
      rpc,
    },
    mocks: { signUp, verifyOtp, signInWithPassword, signOut, getSession, rpc },
  };
}

describe('spec-01-auth-identity (SCRUM-10)', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    resetSupabaseClientForTesting();
    jest.clearAllMocks();
  });

  describe('institutional email normalization & domain restriction (FR-AUTH-01)', () => {
    it('normalizes whitespace/case and accepts @lpunetwork.edu.ph emails', () => {
      expect(normalizeInstitutionalEmail('  Juan.DelaCruz@LPUNetwork.edu.ph  ')).toBe(
        'juan.delacruz@lpunetwork.edu.ph'
      );
      expect(isInstitutionalEmail('  Juan.DelaCruz@LPUNetwork.edu.ph  ')).toBe(true);
      expect(
        InstitutionalEmailSchema.parse('  Juan.DelaCruz@LPUNetwork.edu.ph  ')
      ).toBe('juan.delacruz@lpunetwork.edu.ph');
    });

    it('rejects non-institutional and spoofed suffix domains', () => {
      for (const badEmail of [
        'student@gmail.com',
        'user@lpunetwork.edu.ph.evil.com',
        'user@sub.lpunetwork.edu.ph',
        'not-an-email',
      ]) {
        expect(isInstitutionalEmail(badEmail)).toBe(false);
        expect(() => InstitutionalEmailSchema.parse(badEmail)).toThrow(
          /@lpunetwork\.edu\.ph/
        );
      }
    });

    it('validates 6-digit OTPs and 3-role RBAC enum', () => {
      expect(OtpCodeSchema.parse(' 123456 ')).toBe('123456');
      expect(() => OtpCodeSchema.parse('12345')).toThrow();
      expect(() => OtpCodeSchema.parse('12ab56')).toThrow();
      expect(RoleSchema.options).toEqual(['student', 'officer', 'admin']);
    });
  });

  describe('PII encryption, key rotation, blind index & opaque QR privacy (ADR-008)', () => {
    it('computes deterministic HMAC-SHA256 email_blind_index across casing and whitespace', async () => {
      const idxA = await computeEmailBlindIndex(
        '  Maria.Santos@LPUNetwork.edu.ph ',
        TEST_PEPPER
      );
      const idxB = await computeEmailBlindIndex(
        'maria.santos@lpunetwork.edu.ph',
        TEST_PEPPER
      );
      const idxOther = await computeEmailBlindIndex(
        'other.student@lpunetwork.edu.ph',
        TEST_PEPPER
      );

      expect(idxA).toMatch(/^[0-9a-f]{64}$/);
      expect(idxA).toBe(idxB);
      expect(idxA).not.toBe(idxOther);
    });

    it('encrypts, decrypts, and rotates PII with key_version AAD binding and raw 32-byte keys', async () => {
      const encryptedV1 = await encryptPii('2026-00421', TEST_PII_KEY_V1, 1);
      expect(encryptedV1.keyVersion).toBe(1);
      expect(encryptedV1.byteaHex.startsWith('\\x')).toBe(true);
      expect(encryptedV1.byteaHex).not.toContain('2026-00421');

      const decryptedV1 = await decryptPii(encryptedV1.byteaHex, {
        1: TEST_PII_KEY_V1,
      });
      expect(decryptedV1).toEqual({ plaintext: '2026-00421', keyVersion: 1 });

      const raw32Key = new Uint8Array(32).fill(7);
      const rotatedV2 = await rotateEncryptedPii(
        encryptedV1.ciphertext,
        { 1: TEST_PII_KEY_V1, 2: raw32Key },
        2
      );
      expect(rotatedV2.keyVersion).toBe(2);

      const decryptedV2 = await decryptPii(rotatedV2.ciphertext, {
        2: raw32Key,
      });
      expect(decryptedV2).toEqual({ plaintext: '2026-00421', keyVersion: 2 });

      const tampered = new Uint8Array(encryptedV1.ciphertext);
      tampered[tampered.length - 1] ^= 0xff;
      await expect(
        decryptPii(tampered, { 1: TEST_PII_KEY_V1 })
      ).rejects.toThrow();
    });

    it('rejects short secrets, invalid hex, out-of-range key_version, truncated ciphertexts, and missing keyRing keys', async () => {
      await expect(
        computeEmailBlindIndex('a@lpunetwork.edu.ph', 'too-short')
      ).rejects.toThrow(/16 bytes/);
      await expect(encryptPii('secret', 'short-key', 1)).rejects.toThrow(/16 bytes/);
      await expect(encryptPii('secret', TEST_PII_KEY_V1, 0)).rejects.toThrow(
        /positive 32-bit/
      );
      await expect(
        encryptPii('secret', TEST_PII_KEY_V1, 0x1_0000_0000)
      ).rejects.toThrow(/positive 32-bit/);

      expect(() => decodeByteaHex('zz')).toThrow(/Invalid hex/);
      expect(() => decodeByteaHex('\\xabc')).toThrow(/Invalid hex/);
      expect(decodeByteaHex(new Uint8Array([1, 2]))).toEqual(new Uint8Array([1, 2]));

      await expect(
        decryptPii(new Uint8Array(8), { 1: TEST_PII_KEY_V1 })
      ).rejects.toThrow(/truncated/);

      const enc = await encryptPii('2026-00001', TEST_PII_KEY_V1, 1);
      await expect(decryptPii(enc.ciphertext, { 2: TEST_PII_KEY_V2 })).rejects.toThrow(
        /Missing encryption key for key_version 1/
      );
      await expect(
        rotateEncryptedPii(enc.ciphertext, { 1: TEST_PII_KEY_V1 }, 99)
      ).rejects.toThrow(/Missing target encryption key/);

      const zeroVersionPayload = new Uint8Array(enc.ciphertext);
      zeroVersionPayload.set([0, 0, 0, 0], 0);
      await expect(
        decryptPii(zeroVersionPayload, { 0: TEST_PII_KEY_V1 } as Record<number, string>)
      ).rejects.toThrow(/Missing encryption key/);

      const savedCrypto = globalThis.crypto;
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
      });
      await expect(
        computeEmailBlindIndex('a@lpunetwork.edu.ph', TEST_PEPPER)
      ).rejects.toThrow(/WebCrypto subtle API/);
      Object.defineProperty(globalThis, 'crypto', {
        value: savedCrypto,
        configurable: true,
      });
    });

    it('issues opaque permanent QR tokens omitting raw student_id, email, and name and rejects invalid/tampered tokens', async () => {
      const studentId = '2026-99887';
      const email = 'juan.delacruz@lpunetwork.edu.ph';
      const fullName = 'Juan Dela Cruz';

      const qrToken = await generateOpaqueQrToken(TEST_PROFILE_ID, TEST_QR_SECRET);
      expect(qrToken).toMatch(/^v1\.[0-9a-f-]{36}\.[0-9a-f]{24}$/);
      expect(qrToken).not.toContain(studentId);
      expect(qrToken).not.toContain(email);
      expect(qrToken).not.toContain('Juan');

      await expect(verifyOpaqueQrToken(qrToken, TEST_QR_SECRET)).resolves.toEqual({
        valid: true,
        profileId: TEST_PROFILE_ID,
      });
      await expect(verifyOpaqueQrToken('invalid-qr', TEST_QR_SECRET)).resolves.toEqual({
        valid: false,
        profileId: null,
      });

      const lastChar = qrToken.endsWith('0') ? '1' : '0';
      const tamperedQr = `${qrToken.slice(0, -1)}${lastChar}`;
      await expect(
        verifyOpaqueQrToken(tamperedQr, TEST_QR_SECRET)
      ).resolves.toEqual({
        valid: false,
        profileId: null,
      });

      const dto = toPublicProfileDto({
        id: TEST_PROFILE_ID,
        email,
        fullName,
        role: 'student',
        qrToken,
        keyVersion: 1,
        studentId,
        student_id: studentId,
      });
      expect(dto).not.toHaveProperty('studentId');
      expect(dto).not.toHaveProperty('student_id');
      expect(JSON.stringify(dto)).not.toContain(studentId);
      expect(() =>
        PublicProfileDtoSchema.parse({ ...dto, student_id: studentId })
      ).toThrow();
    });
  });

  describe('Expo SecureStore adapter, Supabase factory & auth service flow (FR-AUTH-01 / FR-AUTH-02)', () => {
    it('persists, reads, removes, and transparently chunks >2048-byte UTF-8 sessions in SecureStore', async () => {
      const backingMap = new Map<string, string>();
      const store: SecureStoreLike = {
        getItemAsync: jest.fn(async (key) => backingMap.get(key) ?? null),
        setItemAsync: jest.fn(async (key, val) => {
          backingMap.set(key, val);
        }),
        deleteItemAsync: jest.fn(async (key) => {
          backingMap.delete(key);
        }),
      };

      const adapter = createSecureStoreAdapter(store);
      await adapter.setItem('sb-session', '{"access_token":"jwt-123"}');
      await expect(adapter.getItem('sb-session')).resolves.toBe(
        '{"access_token":"jwt-123"}'
      );
      await adapter.removeItem('sb-session');
      await expect(adapter.getItem('sb-session')).resolves.toBeNull();

      // Realistic >2048-byte Supabase Auth session with 1/2/3/4-byte UTF-8 characters.
      const largeSession = JSON.stringify({
        access_token: 'a'.repeat(1500),
        refresh_token: 'r'.repeat(120),
        user: {
          email: 'juan.delacruz@lpunetwork.edu.ph',
          user_metadata: { full_name: 'Peña ₱ 🎓 '.repeat(160) },
          identities: [{ provider: 'email', blob: 'b'.repeat(1600) }],
        },
      });
      expect(new TextEncoder().encode(largeSession).byteLength).toBeGreaterThan(2048);

      await adapter.setItem('sb-large', largeSession);
      expect(backingMap.has('sb-large')).toBe(false);
      const chunkCount = Number(backingMap.get('sb-large.__chunks'));
      expect(chunkCount).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < chunkCount; i += 1) {
        const chunkVal = backingMap.get(`sb-large.__chunk_${i}`);
        expect(chunkVal).toBeDefined();
        expect(new TextEncoder().encode(chunkVal).byteLength).toBeLessThanOrEqual(
          SECURE_STORE_CHUNK_BYTES
        );
      }
      await expect(adapter.getItem('sb-large')).resolves.toBe(largeSession);

      // Shrinking from >=3 chunks to 2 chunks deletes stale tail chunks.
      const mediumSession = 'm'.repeat(2500);
      await adapter.setItem('sb-large', mediumSession);
      expect(backingMap.get('sb-large.__chunks')).toBe('2');
      expect(backingMap.has('sb-large.__chunk_2')).toBe(false);
      await expect(adapter.getItem('sb-large')).resolves.toBe(mediumSession);

      // Missing chunk or invalid chunk count returns null instead of partial corruption.
      backingMap.delete('sb-large.__chunk_1');
      await expect(adapter.getItem('sb-large')).resolves.toBeNull();
      backingMap.set('sb-large.__chunks', 'corrupt');
      await expect(adapter.getItem('sb-large')).resolves.toBeNull();

      // Overwriting chunked entry with short value cleans up chunk keys.
      await adapter.setItem('sb-large', mediumSession);
      await adapter.setItem('sb-large', 'short');
      expect(backingMap.get('sb-large')).toBe('short');
      expect(backingMap.has('sb-large.__chunks')).toBe(false);
      expect(backingMap.has('sb-large.__chunk_0')).toBe(false);

      // removeItem deletes chunked keys cleanly.
      await adapter.setItem('sb-large', mediumSession);
      await adapter.removeItem('sb-large');
      expect(backingMap.size).toBe(0);

      expect(() => chunkUtf8('abc', 0)).toThrow(RangeError);
      expect(() => chunkUtf8('🎓', 2)).toThrow(RangeError);
      expect(chunkUtf8('abc', 10)).toEqual(['abc']);

      await expoSecureStoreAdapter.setItem('k', 'v');
      await expoSecureStoreAdapter.getItem('k');
      await expoSecureStoreAdapter.removeItem('k');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('k', 'v');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('k');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('k');
    });

    it('validates env configuration, rejects secret keys in mobile client, and caches the Supabase client singleton', () => {
      expect(isSupabaseConfigured()).toBe(false);
      expect(() => createMyCcsSupabaseClient()).toThrow(
        /Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/
      );

      expect(() =>
        createMyCcsSupabaseClient(
          'https://example.supabase.co',
          'sb_secret_synthetic_key_never_allowed_in_client'
        )
      ).toThrow(/SUPABASE_SECRET_KEY must never be used in the mobile client/);

      expect(() =>
        SupabaseClientEnvSchema.parse({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic_key_never_allowed_in_client',
        })
      ).toThrow(/SUPABASE_SECRET_KEY/);

      const parsedServerEnv = SupabaseServerEnvSchema.parse({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_key',
        SUPABASE_SECRET_KEY: 'sb_secret_synthetic_server_only',
        SUPABASE_JWKS_URL: 'https://example.supabase.co/auth/v1/.well-known/jwks.json',
      });
      expect(parsedServerEnv.SUPABASE_JWKS_URL).toMatch(/jwks\.json$/);

      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_synthetic_key';
      expect(isSupabaseConfigured()).toBe(true);

      const first = getSupabaseClient();
      const second = getSupabaseClient();
      expect(first).toBe(second);
      resetSupabaseClientForTesting();
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_PUBLISHABLE_KEY;

      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://expo-public.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_expo_synthetic';
      expect(isSupabaseConfigured()).toBe(true);

      const third = createMyCcsSupabaseClient(
        'https://explicit.supabase.co',
        'sb_publishable_explicit_synthetic'
      );
      expect(third).not.toBe(first);
    });

    it('enforces @lpunetwork.edu.ph, omits student_id from signUp metadata, and handles all auth service happy & error paths', async () => {
      const { client, mocks } = createMockSupabaseClient();

      await expect(
        signUpWithInstitutionalEmail(client, {
          email: 'outsider@gmail.com',
          password: 'Password123!',
          fullName: 'Outsider',
          studentId: '2026-0001',
        })
      ).rejects.toThrow(/@lpunetwork\.edu\.ph/);
      expect(mocks.signUp).not.toHaveBeenCalled();

      mocks.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });
      await expect(
        signUpWithInstitutionalEmail(client, {
          email: 'ana@lpunetwork.edu.ph',
          password: 'Password123!',
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        })
      ).rejects.toThrow(/already registered/i);

      mocks.signUp.mockResolvedValueOnce({
        data: { user: { id: TEST_PROFILE_ID, email: 'ana@lpunetwork.edu.ph' }, session: null },
        error: null,
      });
      const signupRes = await signUpWithInstitutionalEmail(client, {
        email: '  Ana@LPUNetwork.edu.ph ',
        password: 'Password123!',
        fullName: 'Ana Reyes',
        studentId: '2026-0011',
      });
      expect(signupRes).toEqual({
        email: 'ana@lpunetwork.edu.ph',
        requiresOtpVerification: true,
      });
      expect(mocks.signUp).toHaveBeenLastCalledWith({
        email: 'ana@lpunetwork.edu.ph',
        password: 'Password123!',
        options: { data: { full_name: 'Ana Reyes' } },
      });
      expect(
        JSON.stringify(mocks.signUp.mock.calls[mocks.signUp.mock.calls.length - 1])
      ).not.toContain('2026-0011');
      expect(
        SignupRequestSchema.parse({
          email: '  Ana@LPUNetwork.edu.ph ',
          password: 'Password123!',
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        }).email
      ).toBe('ana@lpunetwork.edu.ph');

      const qrToken = await generateOpaqueQrToken(TEST_PROFILE_ID, TEST_QR_SECRET);
      const provisionedRow = {
        id: TEST_PROFILE_ID,
        email: 'ana@lpunetwork.edu.ph',
        fullName: 'Ana Reyes',
        role: 'student' as const,
        qrToken,
        keyVersion: 1,
      };

      mocks.verifyOtp.mockResolvedValueOnce({
        data: {
          user: { id: TEST_PROFILE_ID, email: 'ana@lpunetwork.edu.ph' },
          session: { access_token: 'jwt-verified' },
        },
        error: null,
      });
      mocks.rpc.mockResolvedValueOnce({ data: provisionedRow, error: null });

      const profile = await verifySignupOtpAndProvisionProfile(client, {
        email: 'ana@lpunetwork.edu.ph',
        token: '654321',
        fullName: 'Ana Reyes',
        studentId: '2026-0011',
      });
      expect(profile.role).toBe('student');
      expect(profile.qrToken).toBe(qrToken);
      expect(mocks.rpc).toHaveBeenCalledWith('provision_profile', {
        p_full_name: 'Ana Reyes',
        p_student_id: '2026-0011',
      });

      mocks.verifyOtp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Token has expired or is invalid' },
      });
      await expect(
        verifySignupOtpAndProvisionProfile(client, {
          email: 'ana@lpunetwork.edu.ph',
          token: '000000',
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        })
      ).rejects.toThrow(/expired|invalid/i);

      mocks.verifyOtp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });
      await expect(
        verifySignupOtpAndProvisionProfile(client, {
          email: 'ana@lpunetwork.edu.ph',
          token: '654321',
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        })
      ).rejects.toThrow(/Invalid or expired 6-digit OTP/);

      mocks.verifyOtp.mockResolvedValueOnce({
        data: {
          user: { id: TEST_PROFILE_ID, email: 'ana@lpunetwork.edu.ph' },
          session: { access_token: 'jwt-verified' },
        },
        error: null,
      });
      mocks.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Vault secret missing' },
      });
      await expect(
        verifySignupOtpAndProvisionProfile(client, {
          email: 'ana@lpunetwork.edu.ph',
          token: '654321',
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        })
      ).rejects.toThrow(/Vault secret missing/);

      mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
      await expect(fetchCurrentProfile(client)).resolves.toBeNull();

      mocks.rpc.mockResolvedValueOnce({ data: provisionedRow, error: null });
      await expect(
        provisionCurrentUserProfile(client, {
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        })
      ).resolves.toEqual(provisionedRow);

      mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
      await expect(
        provisionCurrentUserProfile(client, {
          fullName: 'Ana Reyes',
          studentId: '2026-0011',
        })
      ).rejects.toThrow(/Failed to provision encrypted profile/);

      mocks.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });
      await expect(fetchCurrentProfile(client)).rejects.toThrow(/RPC failed/);

      mocks.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });
      await expect(
        signInWithInstitutionalEmail(client, {
          email: 'ana@lpunetwork.edu.ph',
          password: 'wrong',
        })
      ).rejects.toThrow(/Invalid login credentials/);

      mocks.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: null,
      });
      await expect(
        signInWithInstitutionalEmail(client, {
          email: 'ana@lpunetwork.edu.ph',
          password: 'Password123!',
        })
      ).rejects.toThrow(/Invalid institutional credentials/);

      mocks.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: TEST_PROFILE_ID, email: 'ana@lpunetwork.edu.ph' },
          session: { access_token: 'jwt-login' },
        },
        error: null,
      });
      mocks.rpc.mockResolvedValueOnce({ data: provisionedRow, error: null });
      const loginRes = await signInWithInstitutionalEmail(client, {
        email: 'ana@lpunetwork.edu.ph',
        password: 'Password123!',
      });
      expect(loginRes.session.access_token).toBe('jwt-login');
      expect(loginRes.profile?.qrToken).toBe(qrToken);

      mocks.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      await expect(restoreAuthenticatedSession(client)).resolves.toEqual({
        session: null,
        profile: null,
      });

      mocks.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'SecureStore read failure' },
      });
      await expect(restoreAuthenticatedSession(client)).rejects.toThrow(
        /SecureStore read failure/
      );

      mocks.getSession.mockResolvedValueOnce({
        data: { session: { access_token: 'jwt-restored' } },
        error: null,
      });
      mocks.rpc.mockResolvedValueOnce({ data: provisionedRow, error: null });
      await expect(restoreAuthenticatedSession(client)).resolves.toEqual({
        session: { access_token: 'jwt-restored' },
        profile: provisionedRow,
      });

      mocks.signOut.mockResolvedValueOnce({ error: { message: 'Sign out failed' } });
      await expect(signOutCurrentSession(client)).rejects.toThrow(/Sign out failed/);

      mocks.signOut.mockResolvedValueOnce({ error: null });
      await expect(signOutCurrentSession(client)).resolves.toBeUndefined();
    });
  });

  describe('AuthIdentityScreen & App mobile UI flow', () => {
    it('restores persisted session on mount across app restarts', async () => {
      const { client, mocks } = createMockSupabaseClient();
      const qrToken = await generateOpaqueQrToken(TEST_PROFILE_ID, TEST_QR_SECRET);

      mocks.getSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'jwt-persisted',
            user: { id: TEST_PROFILE_ID, email: 'restored@lpunetwork.edu.ph' },
          },
        },
        error: null,
      });
      mocks.rpc.mockResolvedValueOnce({
        data: {
          id: TEST_PROFILE_ID,
          email: 'restored@lpunetwork.edu.ph',
          fullName: 'Restored Student',
          role: 'student',
          qrToken,
          keyVersion: 1,
        },
        error: null,
      });

      const screen = await render(createElement(AuthIdentityScreen, { client }));
      await waitFor(() => {
        expect(screen.getByTestId('identity-card')).toBeTruthy();
      });
      expect(screen.getByTestId('qr-token-text').props.children).toBe(qrToken);
    });

    it('surfaces mount restore errors gracefully', async () => {
      const { client, mocks } = createMockSupabaseClient();
      mocks.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'Corrupted keystore session' },
      });

      const screen = await render(createElement(AuthIdentityScreen, { client }));
      await waitFor(() => {
        expect(screen.getByTestId('error-text').props.children).toBe(
          'Corrupted keystore session'
        );
      });
    });

    it('renders App, completes signup -> OTP -> opaque QR -> signout -> sign-in without exposing student_id, and handles UI errors', async () => {
      const appTree = await render(createElement(App));
      expect(appTree.getByText('MyCCS Institutional Auth')).toBeTruthy();

      const { client, mocks } = createMockSupabaseClient();
      const qrToken = await generateOpaqueQrToken(TEST_PROFILE_ID, TEST_QR_SECRET);
      const profileRow = {
        id: TEST_PROFILE_ID,
        email: 'stu@lpunetwork.edu.ph',
        fullName: 'Student UI',
        role: 'student' as const,
        qrToken,
        keyVersion: 1,
      };

      mocks.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      mocks.signUp.mockResolvedValueOnce({
        data: { user: { id: TEST_PROFILE_ID, email: 'stu@lpunetwork.edu.ph' }, session: null },
        error: null,
      });
      mocks.verifyOtp
        .mockResolvedValueOnce({
          data: { user: null, session: null },
          error: { message: 'Invalid OTP code' },
        })
        .mockResolvedValueOnce({
          data: {
            user: { id: TEST_PROFILE_ID, email: 'stu@lpunetwork.edu.ph' },
            session: { access_token: 'jwt-ui' },
          },
          error: null,
        });
      mocks.rpc
        .mockResolvedValueOnce({ data: profileRow, error: null })
        .mockResolvedValueOnce({ data: profileRow, error: null });
      mocks.signOut
        .mockResolvedValueOnce({ error: { message: 'Network unavailable' } })
        .mockResolvedValueOnce({ error: null });
      mocks.signInWithPassword
        .mockResolvedValueOnce({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        })
        .mockResolvedValueOnce({
          data: {
            user: { id: TEST_PROFILE_ID, email: 'stu@lpunetwork.edu.ph' },
            session: { access_token: 'jwt-signin' },
          },
          error: null,
        });

      const screen = await render(createElement(AuthIdentityScreen, { client }));

      await fireEvent.changeText(screen.getByTestId('email-input'), 'stu@gmail.com');
      await fireEvent.changeText(screen.getByTestId('password-input'), 'Password123!');
      await fireEvent.changeText(screen.getByTestId('fullname-input'), 'Student UI');
      await fireEvent.changeText(screen.getByTestId('student-id-input'), '2026-7777');
      await fireEvent.press(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-text').props.children).toMatch(
          /@lpunetwork\.edu\.ph/
        );
      });

      await fireEvent.press(screen.getByTestId('switch-signin-tab'));
      expect(screen.getByTestId('signin-button')).toBeTruthy();
      expect(screen.getByTestId('password-input').props.value).toBe('');

      await fireEvent.press(screen.getByTestId('switch-signup-tab'));
      await fireEvent.changeText(screen.getByTestId('email-input'), 'stu@lpunetwork.edu.ph');
      await fireEvent.changeText(screen.getByTestId('password-input'), 'Password123!');
      await fireEvent.changeText(screen.getByTestId('fullname-input'), 'Student UI');
      await fireEvent.changeText(screen.getByTestId('student-id-input'), '2026-7777');
      await fireEvent.press(screen.getByTestId('signup-button'));

      await waitFor(() => {
        expect(screen.getByTestId('otp-input')).toBeTruthy();
      });

      await fireEvent.changeText(screen.getByTestId('otp-input'), '999999');
      await fireEvent.press(screen.getByTestId('verify-otp-button'));
      await waitFor(() => {
        expect(screen.getByTestId('error-text').props.children).toBe('Invalid OTP code');
      });

      await fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
      await fireEvent.press(screen.getByTestId('verify-otp-button'));

      await waitFor(() => {
        expect(screen.getByTestId('identity-card')).toBeTruthy();
      });
      expect(screen.getByTestId('qr-token-text').props.children).toBe(qrToken);
      expect(screen.queryByText(/2026-7777/)).toBeNull();

      await fireEvent.press(screen.getByTestId('signout-button'));
      await waitFor(() => {
        expect(screen.getByTestId('error-text').props.children).toBe('Network unavailable');
      });

      await fireEvent.press(screen.getByTestId('signout-button'));
      await waitFor(() => {
        expect(screen.getByTestId('signin-button')).toBeTruthy();
      });

      await fireEvent.changeText(screen.getByTestId('email-input'), 'stu@lpunetwork.edu.ph');
      await fireEvent.changeText(screen.getByTestId('password-input'), 'wrongpass');
      await fireEvent.press(screen.getByTestId('signin-button'));
      await waitFor(() => {
        expect(screen.getByTestId('error-text').props.children).toBe(
          'Invalid login credentials'
        );
      });

      await fireEvent.changeText(screen.getByTestId('password-input'), 'Password123!');
      await fireEvent.press(screen.getByTestId('signin-button'));
      await waitFor(() => {
        expect(screen.getByTestId('identity-card')).toBeTruthy();
      });
      expect(screen.getByTestId('qr-token-text').props.children).toBe(qrToken);
    });

    it('recovers from interrupted OTP via enter-otp-link and from unprovisioned session via complete-profile-form', async () => {
      const qrToken = await generateOpaqueQrToken(TEST_PROFILE_ID, TEST_QR_SECRET);
      const profileRow = {
        id: TEST_PROFILE_ID,
        email: 'recover@lpunetwork.edu.ph',
        fullName: 'Recovered Student',
        role: 'student' as const,
        qrToken,
        keyVersion: 1,
      };

      // Case A: User returns to app after OS kill with an existing 6-digit OTP.
      const otpFlow = createMockSupabaseClient();
      otpFlow.mocks.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      otpFlow.mocks.verifyOtp.mockResolvedValueOnce({
        data: {
          user: { id: TEST_PROFILE_ID, email: 'recover@lpunetwork.edu.ph' },
          session: { access_token: 'jwt-otp-recover' },
        },
        error: null,
      });
      otpFlow.mocks.rpc.mockResolvedValueOnce({ data: profileRow, error: null });

      const otpScreen = await render(
        createElement(AuthIdentityScreen, { client: otpFlow.client })
      );
      await fireEvent.press(otpScreen.getByTestId('enter-otp-link'));
      await fireEvent.changeText(
        otpScreen.getByTestId('email-input'),
        'recover@lpunetwork.edu.ph'
      );
      await fireEvent.changeText(otpScreen.getByTestId('otp-input'), '654321');
      await fireEvent.changeText(
        otpScreen.getByTestId('fullname-input'),
        'Recovered Student'
      );
      await fireEvent.changeText(
        otpScreen.getByTestId('student-id-input'),
        '2026-4321'
      );
      await fireEvent.press(otpScreen.getByTestId('verify-otp-button'));

      await waitFor(() => {
        expect(otpScreen.getByTestId('identity-card')).toBeTruthy();
      });
      expect(otpScreen.getByTestId('qr-token-text').props.children).toBe(qrToken);
      expect(otpScreen.queryByText(/2026-4321/)).toBeNull();

      // Case B: Session restored on mount but profile is null (failed provision_profile earlier).
      const completeFlow = createMockSupabaseClient();
      completeFlow.mocks.getSession.mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'jwt-unprovisioned',
            user: { id: TEST_PROFILE_ID, email: 'recover@lpunetwork.edu.ph' },
          },
        },
        error: null,
      });
      completeFlow.mocks.rpc
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Temporary DB timeout' } })
        .mockResolvedValueOnce({ data: profileRow, error: null });

      const completeScreen = await render(
        createElement(AuthIdentityScreen, { client: completeFlow.client })
      );
      await waitFor(() => {
        expect(completeScreen.getByTestId('complete-profile-form')).toBeTruthy();
      });

      await fireEvent.changeText(
        completeScreen.getByTestId('complete-fullname-input'),
        'Recovered Student'
      );
      await fireEvent.changeText(
        completeScreen.getByTestId('complete-student-id-input'),
        '2026-4321'
      );
      await fireEvent.press(completeScreen.getByTestId('complete-profile-button'));
      await waitFor(() => {
        expect(completeScreen.getByTestId('error-text').props.children).toBe(
          'Temporary DB timeout'
        );
      });

      await fireEvent.press(completeScreen.getByTestId('complete-profile-button'));
      await waitFor(() => {
        expect(completeScreen.getByTestId('identity-card')).toBeTruthy();
      });
      expect(completeScreen.getByTestId('qr-token-text').props.children).toBe(qrToken);
      expect(completeScreen.queryByText(/2026-4321/)).toBeNull();
    });
  });

  describe('Supabase SQL migration, config, seed, CI & scripts contracts', () => {
    const repoRoot = nodePath.resolve(__dirname, '../..');
    const migrationSql = nodeFs.readFileSync(
      nodePath.join(repoRoot, 'supabase/migrations/20261123000001_spec01_auth_identity.sql'),
      'utf8'
    );
    const seedSql = nodeFs.readFileSync(
      nodePath.join(repoRoot, 'supabase/seed.sql'),
      'utf8'
    );
    const configToml = nodeFs.readFileSync(
      nodePath.join(repoRoot, 'supabase/config.toml'),
      'utf8'
    );
    const rlsTestSql = nodeFs.readFileSync(
      nodePath.join(repoRoot, 'tests/api/auth-identity-rls.sql'),
      'utf8'
    );
    const protectBranchesSh = nodeFs.readFileSync(
      nodePath.join(repoRoot, 'scripts/protect-branches.sh'),
      'utf8'
    );
    const ghReleaseSh = nodeFs.readFileSync(
      nodePath.join(repoRoot, '.agents/skills/myccs-workflow/scripts/gh-release.sh'),
      'utf8'
    );
    const ciYml = nodeFs.readFileSync(
      nodePath.join(repoRoot, '.github/workflows/ci.yml'),
      'utf8'
    );
    const gitattributes = nodeFs.readFileSync(
      nodePath.join(repoRoot, '.gitattributes'),
      'utf8'
    );

    it('configures 6-digit OTP, burst email rate limit, password length >= 8, Resend SMTP env placeholder, and before-user-created hook in config.toml', () => {
      expect(configToml).toContain('minimum_password_length = 8');
      expect(configToml).toContain('secure_password_change = true');
      expect(configToml).toContain('email_sent = 100');
      expect(configToml).toContain('enable_signup = true');
      expect(configToml).toContain('enable_confirmations = true');
      expect(configToml).toContain('otp_length = 6');
      expect(configToml).toContain('host = "smtp.resend.com"');
      expect(configToml).toContain('pass = "env(RESEND_API_KEY)"');
      expect(configToml).toContain('[auth.hook.before_user_created]');
      expect(configToml).toContain('pg-functions://postgres/public/hook_restrict_signup_domain');
    });

    it('enforces fail-closed Vault secrets, RLS, SECURITY INVOKER column guard trigger, narrow GRANTs, and domain hook privileges in migration', () => {
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.hook_restrict_signup_domain');
      expect(migrationSql).toContain('@lpunetwork\\.edu\\.ph');
      expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.hook_restrict_signup_domain(jsonb) TO supabase_auth_admin');
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_identity_secret');
      expect(migrationSql).toContain('vault.decrypted_secrets');
      expect(migrationSql).not.toContain('app.settings.');
      expect(migrationSql).toContain('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY');
      expect(migrationSql).toContain('ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY');
      expect(migrationSql).toContain('GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated');
      expect(migrationSql).not.toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated');
      expect(migrationSql).toMatch(/guard_profiles_immutable_columns\(\)[\s\S]{0,120}SECURITY INVOKER/);
      expect(migrationSql).toContain('CREATE TRIGGER trg_profiles_guard_immutable');
      expect(migrationSql).toContain('IF NOT FOUND THEN');
      expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_my_profile()');
      expect(migrationSql).toContain('shortcut:');
    });

    it('seeds initial Department Admin idempotently with email_verified, ships SQL RLS assertions, and keeps CI/branch scripts aligned', () => {
      expect(seedSql).toContain("'admin'");
      expect(seedSql).toContain('auth.identities');
      expect(seedSql).toContain("'email_verified', true");
      expect(seedSql).toContain('vault.create_secret');
      expect(seedSql).toContain('ccs.admin@lpunetwork.edu.ph');
      expect(rlsTestSql).toContain('hook_restrict_signup_domain');
      expect(rlsTestSql).toContain('promote_faculty_to_admin');
      expect(rlsTestSql).toContain('profiles_select_admin');
      expect(rlsTestSql).toContain('prosecdef');
      expect(rlsTestSql).toContain('ROLLBACK;');
      expect(protectBranchesSh).toContain('--input scripts/branch-protection-body.json');
      expect(protectBranchesSh).not.toContain('STATUS_CHECKS');
      expect(ghReleaseSh).not.toContain('\\n\\n');
      expect(ciYml).toContain('HAS_SNYK_TOKEN');
      expect(ciYml).not.toMatch(/snyk\/actions\/node@master[\s\S]{0,200}continue-on-error:\s*true/);
      expect(gitattributes).toContain('.husky/* text eol=lf');
    });
  });
});
