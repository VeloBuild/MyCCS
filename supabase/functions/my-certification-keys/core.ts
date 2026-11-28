import {
  authenticateEdgeRequest,
  resolveExpectedJwtIssuer,
  resolveSupabaseRuntimeEnv,
  validateJwtClaims,
  type JwtClaimValidationResult,
  type SupabaseEdgeRuntimeEnv,
} from '../_shared/edge-auth';
import {
  createAesGcmKey,
  decodeByteaHex,
  decryptKeyCode,
  decryptWithAesKey,
  parseKeyRingEnv,
  type ParsedKeyRingConfig,
} from '../_shared/gmetrix-crypto';

export {
  decryptKeyCode,
  parseKeyRingEnv,
  resolveExpectedJwtIssuer,
  resolveSupabaseRuntimeEnv,
  validateJwtClaims,
  type JwtClaimValidationResult,
  type ParsedKeyRingConfig,
  type SupabaseEdgeRuntimeEnv,
};

export const MY_KEYS_VAULT_CACHE_TTL_MS = 60_000;
const MIN_CIPHERTEXT_BYTES = 32;

export interface CallerActiveProfile {
  active: boolean;
}

export interface EncryptedCertificationKeyRow {
  id: string;
  batchId: string;
  certificationId: string;
  certificationTitle: string;
  certificationProvider: string;
  keyCodeEnc: string | Uint8Array;
  keyVersion: number;
  assignedAt: string;
  viewedAt: string | null;
}

export interface DecryptedCertificationKeyDto {
  id: string;
  batchId: string;
  certificationId: string;
  certificationTitle: string;
  certificationProvider: string;
  keyCode: string;
  keyVersion: number;
  assignedAt: string;
  viewedAt: string | null;
}

export interface LoadKeyRingOptions {
  forceRefresh?: boolean;
  requiredVersions?: readonly number[];
}

export interface MyCertificationKeysDeps {
  supabaseUrl: string;
  expectedJwtIssuer?: string;
  allowedOrigins: readonly string[];
  verifyUser: (accessToken: string) => Promise<{ id: string; email?: string } | null>;
  loadCallerProfile: (userId: string) => Promise<CallerActiveProfile>;
  loadKeyRing: (options?: LoadKeyRingOptions) => Promise<Record<number, string> | null>;
  loadOwnEncryptedKeys: (userId: string) => Promise<EncryptedCertificationKeyRow[]>;
  nowSeconds?: () => number;
}

export interface MyKeysRingResolverOptions {
  readEnv: (key: string) => string | undefined;
  fetchVaultSecrets: (params: {
    p_include_blind_pepper: boolean;
    p_include_cert_key: boolean;
  }) => Promise<{ certKeyEncryptionKey?: string | null } | null>;
  cacheTtlMs?: number;
  nowMs?: () => number;
}

export type MyKeysRingResolver = ((
  options?: LoadKeyRingOptions
) => Promise<Record<number, string> | null>) & {
  invalidate: () => void;
};

export function createMyKeysRingResolver(
  options: MyKeysRingResolverOptions
): MyKeysRingResolver {
  const ttlMs = options.cacheTtlMs ?? MY_KEYS_VAULT_CACHE_TTL_MS;
  const nowMs = options.nowMs ?? Date.now;
  let cachedVaultKey: { value: string; expiresAt: number } | null = null;

  const load = async (
    loadOptions?: LoadKeyRingOptions
  ): Promise<Record<number, string> | null> => {
    const envConfig = parseKeyRingEnv(options.readEnv);
    if (envConfig) {
      return envConfig.keyRing;
    }

    const hasExplicitEnvKey = Boolean(
      options.readEnv('CERT_KEY_RING_JSON')?.trim() ||
        options.readEnv('CERT_KEY_ENCRYPTION_KEY')?.trim()
    );
    if (hasExplicitEnvKey) {
      return null;
    }

    const now = nowMs();
    if (!loadOptions?.forceRefresh && cachedVaultKey && cachedVaultKey.expiresAt > now) {
      const cachedConfig = parseKeyRingEnv(options.readEnv, cachedVaultKey.value);
      const hasAllRequired =
        cachedConfig !== null &&
        (loadOptions?.requiredVersions ?? []).every((version) =>
          Object.prototype.hasOwnProperty.call(cachedConfig.keyRing, version)
        );
      if (cachedConfig && hasAllRequired) {
        return cachedConfig.keyRing;
      }
    }

    cachedVaultKey = null;
    const vaultSecrets = await options.fetchVaultSecrets({
      p_include_blind_pepper: false,
      p_include_cert_key: true,
    });
    const fallbackKey =
      vaultSecrets && typeof vaultSecrets.certKeyEncryptionKey === 'string'
        ? vaultSecrets.certKeyEncryptionKey.trim()
        : '';
    const parsed = parseKeyRingEnv(options.readEnv, fallbackKey || null);
    if (!parsed) {
      return null;
    }

    cachedVaultKey = { value: fallbackKey, expiresAt: now + ttlMs };
    return parsed.keyRing;
  };

  load.invalidate = () => {
    cachedVaultKey = null;
  };

  return load;
}

interface JoinedCertification {
  title?: unknown;
  provider?: unknown;
}

function extractCertificationMeta(raw: unknown): { title: string; provider: string } | null {
  const entry = Array.isArray(raw) ? raw[0] : raw;
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const cert = entry as JoinedCertification;
  if (typeof cert.title !== 'string' || typeof cert.provider !== 'string') {
    return null;
  }
  return {
    title: cert.title,
    provider: cert.provider,
  };
}

export function mapPostgrestCertificationKeyRow(raw: unknown): EncryptedCertificationKeyRow {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Unexpected certification_keys query row.');
  }
  const row = raw as Record<string, unknown>;
  const certMeta = extractCertificationMeta(row.certifications);
  if (
    !certMeta ||
    typeof row.id !== 'string' ||
    typeof row.batch_id !== 'string' ||
    typeof row.certification_id !== 'string' ||
    typeof row.key_code_enc !== 'string' ||
    typeof row.key_version !== 'number' ||
    !Number.isInteger(row.key_version) ||
    row.key_version < 1 ||
    typeof row.assigned_at !== 'string'
  ) {
    throw new Error('Unexpected certification_keys query row.');
  }

  return {
    id: row.id,
    batchId: row.batch_id,
    certificationId: row.certification_id,
    certificationTitle: certMeta.title,
    certificationProvider: certMeta.provider,
    keyCodeEnc: row.key_code_enc,
    keyVersion: row.key_version,
    assignedAt: row.assigned_at,
    viewedAt: typeof row.viewed_at === 'string' ? row.viewed_at : null,
  };
}

function readHeaderKeyVersion(payload: Uint8Array): number {
  if (payload.byteLength < MIN_CIPHERTEXT_BYTES) {
    throw new Error('Encrypted payload is truncated or malformed.');
  }
  return new DataView(payload.buffer, payload.byteOffset, 4).getUint32(0, false);
}

export async function handleMyCertificationKeysRequest(
  req: Request,
  deps: MyCertificationKeysDeps
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req, {
    allowedMethod: 'GET',
    allowedOrigins: deps.allowedOrigins,
    supabaseUrl: deps.supabaseUrl,
    expectedJwtIssuer: deps.expectedJwtIssuer,
    verifyUser: deps.verifyUser,
    nowSeconds: deps.nowSeconds,
    defaultResponseHeaders: { 'Cache-Control': 'no-store' },
  });
  if (!auth.ok) {
    return auth.response;
  }
  const { userId: callerUserId, json } = auth;

  let callerProfile: CallerActiveProfile;
  try {
    callerProfile = await deps.loadCallerProfile(callerUserId);
  } catch {
    return json({ error: 'Unable to verify caller profile.' }, 500);
  }

  if (!callerProfile.active) {
    return json(
      { error: 'Active user profile is required to view certification keys.' },
      403
    );
  }

  let keyRing: Record<number, string> | null;
  try {
    keyRing = await deps.loadKeyRing();
  } catch {
    return json({ error: 'Server encryption configuration error.' }, 500);
  }

  if (!keyRing || Object.keys(keyRing).length === 0) {
    return json({ error: 'Server encryption configuration error.' }, 500);
  }

  let encryptedRows: EncryptedCertificationKeyRow[];
  try {
    encryptedRows = await deps.loadOwnEncryptedKeys(callerUserId);
  } catch {
    return json({ error: 'Failed to load certification keys.' }, 500);
  }

  let refreshedRing = false;
  let activeKeyRing = keyRing;
  const decryptKeyCache = new Map<number, CryptoKey>();

  const refreshKeyRingOnce = async (requiredVersions: number[]): Promise<boolean> => {
    if (refreshedRing) {
      return false;
    }
    refreshedRing = true;
    const nextRing = await deps.loadKeyRing({
      forceRefresh: true,
      requiredVersions,
    });
    if (!nextRing || Object.keys(nextRing).length === 0) {
      return false;
    }
    activeKeyRing = nextRing;
    decryptKeyCache.clear();
    return true;
  };

  const getAesDecryptKey = async (version: number): Promise<CryptoKey | null> => {
    const cached = decryptKeyCache.get(version);
    if (cached) {
      return cached;
    }
    const keyMaterial =
      version >= 1 && Object.prototype.hasOwnProperty.call(activeKeyRing, version)
        ? activeKeyRing[version]
        : undefined;
    if (!keyMaterial) {
      return null;
    }
    const imported = await createAesGcmKey(keyMaterial, ['decrypt']);
    decryptKeyCache.set(version, imported);
    return imported;
  };

  const missingRowVersions = Array.from(
    new Set(
      encryptedRows
        .map((row) => row.keyVersion)
        .filter((version) => !Object.prototype.hasOwnProperty.call(activeKeyRing, version))
    )
  );
  if (missingRowVersions.length > 0) {
    try {
      await refreshKeyRingOnce(missingRowVersions);
    } catch {
      return json({ error: 'Unable to decrypt certification keys.' }, 500);
    }
  }

  const keys: DecryptedCertificationKeyDto[] = [];
  for (const row of encryptedRows) {
    try {
      const payloadBytes = decodeByteaHex(row.keyCodeEnc);
      const headerVersion = readHeaderKeyVersion(payloadBytes);

      let aesKey = await getAesDecryptKey(headerVersion);
      if (!aesKey && (await refreshKeyRingOnce([row.keyVersion, headerVersion]))) {
        aesKey = await getAesDecryptKey(headerVersion);
      }
      if (!aesKey) {
        return json({ error: 'Unable to decrypt certification keys.' }, 500);
      }

      let decrypted;
      try {
        decrypted = await decryptWithAesKey(payloadBytes, aesKey);
      } catch {
        if (!(await refreshKeyRingOnce([row.keyVersion, headerVersion]))) {
          return json({ error: 'Unable to decrypt certification keys.' }, 500);
        }
        const retriedKey = await getAesDecryptKey(headerVersion);
        if (!retriedKey) {
          return json({ error: 'Unable to decrypt certification keys.' }, 500);
        }
        decrypted = await decryptWithAesKey(payloadBytes, retriedKey);
      }

      if (decrypted.keyVersion !== row.keyVersion || decrypted.plaintext.length === 0) {
        return json({ error: 'Unable to decrypt certification keys.' }, 500);
      }

      keys.push({
        id: row.id,
        batchId: row.batchId,
        certificationId: row.certificationId,
        certificationTitle: row.certificationTitle,
        certificationProvider: row.certificationProvider,
        keyCode: decrypted.plaintext,
        keyVersion: row.keyVersion,
        assignedAt: row.assignedAt,
        viewedAt: row.viewedAt,
      });
    } catch {
      return json({ error: 'Unable to decrypt certification keys.' }, 500);
    }
  }

  return json({ keys }, 200);
}
