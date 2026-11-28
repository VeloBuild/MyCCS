import {
  authenticateEdgeRequest,
  readStreamWithLimit,
  resolveExpectedJwtIssuer,
  resolveSupabaseRuntimeEnv,
  validateJwtClaims,
  type JwtClaimValidationResult,
  type SupabaseEdgeRuntimeEnv,
} from '../_shared/edge-auth';
import {
  createAesGcmKey,
  createHmacKey,
  encryptWithAesKey,
  parseKeyRingEnv,
  signEmailBlindIndex,
  signKeyCodeHash,
  type ParsedKeyRingConfig,
} from '../_shared/gmetrix-crypto';
import {
  buildRejectedRowsCsv,
  canonicalizeGMetrixKeyForHash,
  EXPO_PUSH_BATCH_LIMIT,
  GMETRIX_MY_KEYS_DEEP_LINK,
  GMETRIX_PUSH_BODY,
  GMETRIX_PUSH_TITLE,
  isInstitutionalEmail,
  isValidExpoPushToken,
  isValidGMetrixKeyCode,
  MAX_GMETRIX_CSV_BYTES,
  MAX_GMETRIX_CSV_ROWS,
  normalizeGMetrixKeyCode,
  normalizeInstitutionalEmail,
  parseGMetrixCsv,
  REJECTED_CSV_HEADER,
  sanitizeCsvCell,
  type ParsedGMetrixCsvRow,
  type ParseGMetrixCsvResult,
  type RejectedRow,
  type RejectedRowReason,
} from '../_shared/gmetrix-csv';

export {
  buildRejectedRowsCsv,
  EXPO_PUSH_BATCH_LIMIT,
  GMETRIX_MY_KEYS_DEEP_LINK,
  GMETRIX_PUSH_BODY,
  GMETRIX_PUSH_TITLE,
  MAX_GMETRIX_CSV_BYTES,
  MAX_GMETRIX_CSV_ROWS,
  parseGMetrixCsv,
  parseKeyRingEnv,
  REJECTED_CSV_HEADER,
  resolveExpectedJwtIssuer,
  resolveSupabaseRuntimeEnv,
  sanitizeCsvCell,
  validateJwtClaims,
  type JwtClaimValidationResult,
  type ParsedGMetrixCsvRow,
  type ParsedKeyRingConfig,
  type ParseGMetrixCsvResult,
  type RejectedRow,
  type RejectedRowReason,
  type SupabaseEdgeRuntimeEnv,
};

export const MULTIPART_OVERHEAD_BYTES = 65536;
export const MAX_BODY_BYTES = MAX_GMETRIX_CSV_BYTES + MULTIPART_OVERHEAD_BYTES;
export const DEFAULT_PUSH_BUDGET_MS = 8_000;
export const EXPO_PUSH_MAX_CONCURRENCY = 4;
export const VAULT_SECRET_CACHE_TTL_MS = 60_000;

const CRYPTO_CHUNK_SIZE = 50;
const BLIND_INDEX_RPC_CHUNK_SIZE = 500;
const PUSH_TOKEN_PROFILE_RPC_CHUNK_SIZE = 250;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SECRET_BYTES = 16;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface CallerProfileRecord {
  role: 'student' | 'officer' | 'admin' | null;
  active: boolean;
}

export interface CertificationRecord {
  id: string;
  isActive: boolean;
}

export interface GMetrixCryptoSecrets {
  emailBlindPepper: string;
  activeVersion: number;
  keyRing: Record<number, string>;
}

export interface VaultSecretsRpcResult {
  emailBlindPepper?: string | null;
  certKeyEncryptionKey?: string | null;
}

export interface MatchedProfileRecord {
  id: string;
  emailBlindIndex: string;
}

export interface CommitGMetrixKeyEntry {
  student_profile_id: string;
  key_code_enc_hex: string;
  key_code_hash: string;
  key_version: number;
}

export interface CommitGMetrixKeyBatchInput {
  certificationId: string;
  uploadedByAdminId: string;
  totalRows: number;
  entries: CommitGMetrixKeyEntry[];
  notificationTitle: string;
  notificationBody: string;
  deepLink: string;
}

export interface CommitGMetrixKeyBatchResult {
  batchId: string;
  assignedCount: number;
  rejectedCount: number;
  committedHashes: string[];
  missingProfileHashes?: string[];
  notifiedProfileIds: string[];
}

export interface ExpoPushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: {
    type: 'gmetrix_key';
    deepLink: typeof GMETRIX_MY_KEYS_DEEP_LINK;
    certificationId: string;
  };
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

export interface ImportGMetrixKeysDeps {
  supabaseUrl: string;
  expectedJwtIssuer?: string;
  allowedOrigins: readonly string[];
  verifyUser: (accessToken: string) => Promise<{ id: string; email?: string } | null>;
  loadCallerProfile: (userId: string) => Promise<CallerProfileRecord>;
  loadCertification: (certificationId: string) => Promise<CertificationRecord | null>;
  loadCryptoSecrets: () => Promise<GMetrixCryptoSecrets | null>;
  lookupProfilesByBlindIndexes: (
    blindIndexes: readonly string[]
  ) => Promise<MatchedProfileRecord[]>;
  commitBatch: (input: CommitGMetrixKeyBatchInput) => Promise<CommitGMetrixKeyBatchResult>;
  loadPushTokens: (profileIds: readonly string[]) => Promise<string[]>;
  sendExpoPushBatch: (
    messages: readonly ExpoPushMessage[],
    options?: { timeoutMs?: number }
  ) => Promise<ExpoPushTicket[]>;
  deletePushTokens: (tokens: readonly string[]) => Promise<void>;
  pushBudgetMs?: number;
  nowSeconds?: () => number;
  nowMs?: () => number;
}

export interface RpcCallerLike {
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export interface ImportSecretsResolverOptions {
  readEnv: (key: string) => string | undefined;
  fetchVaultSecrets: (params: {
    p_include_blind_pepper: boolean;
    p_include_cert_key: boolean;
  }) => Promise<VaultSecretsRpcResult | null>;
  cacheTtlMs?: number;
  nowMs?: () => number;
}

export function createImportSecretsResolver(
  options: ImportSecretsResolverOptions
): () => Promise<GMetrixCryptoSecrets | null> {
  const ttlMs = options.cacheTtlMs ?? VAULT_SECRET_CACHE_TTL_MS;
  const nowMs = options.nowMs ?? Date.now;
  let cachedBlindPepper: { value: string; expiresAt: number } | null = null;
  let cachedCertKey: { value: string; expiresAt: number } | null = null;

  return async (): Promise<GMetrixCryptoSecrets | null> => {
    const now = nowMs();
    let emailBlindPepper = options.readEnv('EMAIL_BLIND_INDEX_PEPPER')?.trim() ?? '';
    let keyRingConfig = parseKeyRingEnv(options.readEnv);

    const hasExplicitEnvCertKey = Boolean(
      options.readEnv('CERT_KEY_RING_JSON')?.trim() ||
        options.readEnv('CERT_KEY_ENCRYPTION_KEY')?.trim()
    );
    if (hasExplicitEnvCertKey && !keyRingConfig) {
      return null;
    }

    if (!emailBlindPepper && cachedBlindPepper && cachedBlindPepper.expiresAt > now) {
      emailBlindPepper = cachedBlindPepper.value;
    }
    if (!keyRingConfig && cachedCertKey && cachedCertKey.expiresAt > now) {
      keyRingConfig = parseKeyRingEnv(options.readEnv, cachedCertKey.value);
    }

    const needBlindPepper = !emailBlindPepper;
    const needCertKey = !keyRingConfig;

    if (needBlindPepper || needCertKey) {
      const vaultSecrets = await options.fetchVaultSecrets({
        p_include_blind_pepper: needBlindPepper,
        p_include_cert_key: needCertKey,
      });
      if (!vaultSecrets || typeof vaultSecrets !== 'object') {
        return null;
      }

      if (
        needBlindPepper &&
        typeof vaultSecrets.emailBlindPepper === 'string' &&
        vaultSecrets.emailBlindPepper.trim().length > 0
      ) {
        emailBlindPepper = vaultSecrets.emailBlindPepper.trim();
        cachedBlindPepper = { value: emailBlindPepper, expiresAt: now + ttlMs };
      }

      if (needCertKey) {
        const fallbackKey =
          typeof vaultSecrets.certKeyEncryptionKey === 'string'
            ? vaultSecrets.certKeyEncryptionKey.trim()
            : null;
        keyRingConfig = parseKeyRingEnv(options.readEnv, fallbackKey || null);
        if (keyRingConfig && fallbackKey) {
          cachedCertKey = { value: fallbackKey, expiresAt: now + ttlMs };
        }
      }
    }

    if (!emailBlindPepper || !keyRingConfig) {
      return null;
    }

    return {
      emailBlindPepper,
      activeVersion: keyRingConfig.activeVersion,
      keyRing: keyRingConfig.keyRing,
    };
  };
}

export function createRpcDatabaseAdapter(rpcClient: RpcCallerLike) {
  return {
    fetchVaultSecrets: async (params: {
      p_include_blind_pepper: boolean;
      p_include_cert_key: boolean;
    }): Promise<VaultSecretsRpcResult | null> => {
      const { data, error } = await rpcClient.rpc('get_gmetrix_runtime_secrets', params);
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
      }
      return data as VaultSecretsRpcResult;
    },

    lookupProfilesByBlindIndexes: async (
      blindIndexes: readonly string[]
    ): Promise<MatchedProfileRecord[]> => {
      if (blindIndexes.length === 0) {
        return [];
      }
      const results: MatchedProfileRecord[] = [];
      for (let i = 0; i < blindIndexes.length; i += BLIND_INDEX_RPC_CHUNK_SIZE) {
        const chunk = blindIndexes.slice(i, i + BLIND_INDEX_RPC_CHUNK_SIZE);
        const { data, error } = await rpcClient.rpc('lookup_active_profiles_by_blind_indexes', {
          p_blind_indexes: chunk,
        });
        if (error || !Array.isArray(data)) {
          throw new Error('Failed to query profiles by blind index.');
        }
        for (const row of data) {
          if (
            row &&
            typeof row === 'object' &&
            typeof (row as Record<string, unknown>).id === 'string' &&
            typeof (row as Record<string, unknown>).email_blind_index === 'string'
          ) {
            results.push({
              id: (row as Record<string, unknown>).id as string,
              emailBlindIndex: (row as Record<string, unknown>).email_blind_index as string,
            });
          }
        }
      }
      return results;
    },

    commitBatch: async (
      input: CommitGMetrixKeyBatchInput
    ): Promise<CommitGMetrixKeyBatchResult> => {
      const { data, error } = await rpcClient.rpc('commit_gmetrix_key_batch', {
        p_certification_id: input.certificationId,
        p_uploaded_by_admin_id: input.uploadedByAdminId,
        p_total_rows: input.totalRows,
        p_entries: input.entries,
        p_notification_title: input.notificationTitle,
        p_notification_body: input.notificationBody,
        p_deep_link: input.deepLink,
      });

      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(error?.message ?? 'Failed to commit GMetrix key batch.');
      }

      const result = data as Record<string, unknown>;
      if (
        typeof result.batchId !== 'string' ||
        typeof result.assignedCount !== 'number' ||
        typeof result.rejectedCount !== 'number' ||
        !Array.isArray(result.committedHashes) ||
        !Array.isArray(result.notifiedProfileIds)
      ) {
        throw new Error('Unexpected commit_gmetrix_key_batch RPC payload.');
      }

      const missingProfileHashes = Array.isArray(result.missingProfileHashes)
        ? result.missingProfileHashes.filter((item): item is string => typeof item === 'string')
        : [];

      return {
        batchId: result.batchId,
        assignedCount: result.assignedCount,
        rejectedCount: result.rejectedCount,
        committedHashes: result.committedHashes.filter(
          (item): item is string => typeof item === 'string'
        ),
        missingProfileHashes,
        notifiedProfileIds: result.notifiedProfileIds.filter(
          (item): item is string => typeof item === 'string'
        ),
      };
    },

    loadPushTokens: async (profileIds: readonly string[]): Promise<string[]> => {
      if (profileIds.length === 0) {
        return [];
      }
      const tokens: string[] = [];
      for (let i = 0; i < profileIds.length; i += PUSH_TOKEN_PROFILE_RPC_CHUNK_SIZE) {
        const chunk = profileIds.slice(i, i + PUSH_TOKEN_PROFILE_RPC_CHUNK_SIZE);
        const { data, error } = await rpcClient.rpc('load_push_tokens_for_profiles', {
          p_profile_ids: chunk,
        });
        if (error || !Array.isArray(data)) {
          throw new Error('Failed to load push tokens.');
        }
        for (const row of data) {
          if (
            row &&
            typeof row === 'object' &&
            typeof (row as Record<string, unknown>).expo_push_token === 'string'
          ) {
            tokens.push((row as Record<string, unknown>).expo_push_token as string);
          }
        }
      }
      return tokens;
    },

    deletePushTokens: async (tokens: readonly string[]): Promise<void> => {
      if (tokens.length === 0) {
        return;
      }
      const { error } = await rpcClient.rpc('delete_push_tokens_by_values', {
        p_tokens: [...tokens],
      });
      if (error) {
        throw new Error('Failed to delete stale push tokens.');
      }
    },
  };
}

export function parseExpoPushTickets(payload: unknown): ExpoPushTicket[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Unexpected Expo Push API response shape.');
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error('Unexpected Expo Push API response shape.');
  }

  return data.map((item): ExpoPushTicket => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { status: 'error', message: 'Malformed Expo push ticket.' };
    }
    const rec = item as Record<string, unknown>;
    if (rec.status === 'ok') {
      return {
        status: 'ok',
        id: typeof rec.id === 'string' ? rec.id : undefined,
      };
    }
    const rawDetails =
      rec.details && typeof rec.details === 'object' && !Array.isArray(rec.details)
        ? (rec.details as Record<string, unknown>)
        : undefined;
    return {
      status: 'error',
      message: typeof rec.message === 'string' ? rec.message : undefined,
      details:
        rawDetails && typeof rawDetails.error === 'string'
          ? { error: rawDetails.error }
          : undefined,
    };
  });
}

interface FormDataLike {
  get(name: string): unknown;
}

type ParsedRequestBodyResult =
  | { ok: true; certificationId: string; csvText: string }
  | { ok: false; status: 400 | 413; message: string };

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function'
  );
}

function hasValidSecretBytes(value: unknown): value is string {
  return typeof value === 'string' && textEncoder.encode(value).byteLength >= MIN_SECRET_BYTES;
}

async function mapInChunks<T, R>(
  items: readonly T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const slice = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(slice.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function parseImportPayload(
  req: Request,
  rawContentType: string,
  mediaType: 'multipart/form-data' | 'application/json'
): Promise<ParsedRequestBodyResult> {
  let bufferedBytes: Uint8Array | null = null;
  if (req.body !== null && typeof req.body.getReader === 'function') {
    const bodyResult = await readStreamWithLimit(
      req.body,
      MAX_BODY_BYTES,
      'CSV payload exceeds the 2 MiB upload limit.',
      mediaType === 'multipart/form-data'
        ? 'Malformed multipart/form-data request body.'
        : 'Malformed JSON request body.'
    );
    if (!bodyResult.ok) {
      return bodyResult;
    }
    bufferedBytes = bodyResult.bytes;
  }

  if (mediaType === 'multipart/form-data') {
    let formData: FormDataLike;
    try {
      if (bufferedBytes !== null) {
        formData = (await new Response(bufferedBytes as BodyInit, {
          headers: { 'Content-Type': rawContentType },
        }).formData()) as unknown as FormDataLike;
      } else {
        formData = (await req.formData()) as unknown as FormDataLike;
      }
    } catch {
      return {
        ok: false,
        status: 400,
        message: 'Malformed multipart/form-data request body.',
      };
    }

    const rawCertId = formData.get('certification_id');
    if (typeof rawCertId !== 'string' || !UUID_REGEX.test(rawCertId.trim())) {
      return {
        ok: false,
        status: 400,
        message: 'certification_id must be a valid UUID.',
      };
    }

    const fileEntry = formData.get('file');
    if (!isBlobLike(fileEntry)) {
      return {
        ok: false,
        status: 400,
        message: 'CSV file field is required.',
      };
    }

    if (typeof fileEntry.size === 'number' && fileEntry.size > MAX_GMETRIX_CSV_BYTES) {
      return {
        ok: false,
        status: 413,
        message: 'CSV file exceeds the 2 MiB upload limit.',
      };
    }

    let fileBytes: Uint8Array;
    try {
      fileBytes = new Uint8Array(await fileEntry.arrayBuffer());
    } catch {
      return {
        ok: false,
        status: 400,
        message: 'Unable to read uploaded CSV file.',
      };
    }

    if (fileBytes.byteLength === 0) {
      return {
        ok: false,
        status: 400,
        message: 'CSV file is empty.',
      };
    }

    if (fileBytes.byteLength > MAX_GMETRIX_CSV_BYTES) {
      return {
        ok: false,
        status: 413,
        message: 'CSV file exceeds the 2 MiB upload limit.',
      };
    }

    return {
      ok: true,
      certificationId: rawCertId.trim(),
      csvText: textDecoder.decode(fileBytes),
    };
  }

  let rawText: string;
  try {
    rawText = bufferedBytes !== null ? textDecoder.decode(bufferedBytes) : await req.text();
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'Malformed JSON request body.',
    };
  }

  if (bufferedBytes === null && textEncoder.encode(rawText).byteLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      message: 'CSV payload exceeds the 2 MiB upload limit.',
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'Malformed JSON request body.',
    };
  }

  if (typeof parsedJson !== 'object' || parsedJson === null || Array.isArray(parsedJson)) {
    return {
      ok: false,
      status: 400,
      message: 'JSON body must be an object containing certification_id and csv.',
    };
  }

  const record = parsedJson as Record<string, unknown>;
  if (
    typeof record.certification_id !== 'string' ||
    !UUID_REGEX.test(record.certification_id.trim())
  ) {
    return {
      ok: false,
      status: 400,
      message: 'certification_id must be a valid UUID.',
    };
  }

  if (typeof record.csv !== 'string') {
    return {
      ok: false,
      status: 400,
      message: 'csv field must be a string.',
    };
  }

  if (textEncoder.encode(record.csv).byteLength > MAX_GMETRIX_CSV_BYTES) {
    return {
      ok: false,
      status: 413,
      message: 'CSV file exceeds the 2 MiB upload limit.',
    };
  }

  return {
    ok: true,
    certificationId: record.certification_id.trim(),
    csvText: record.csv,
  };
}

export async function handleImportGMetrixKeysRequest(
  req: Request,
  deps: ImportGMetrixKeysDeps
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req, {
    allowedMethod: 'POST',
    allowedOrigins: deps.allowedOrigins,
    supabaseUrl: deps.supabaseUrl,
    expectedJwtIssuer: deps.expectedJwtIssuer,
    verifyUser: deps.verifyUser,
    nowSeconds: deps.nowSeconds,
  });
  if (!auth.ok) {
    return auth.response;
  }
  const { userId: callerUserId, json } = auth;

  let callerProfile: CallerProfileRecord;
  try {
    callerProfile = await deps.loadCallerProfile(callerUserId);
  } catch {
    return json({ error: 'Unable to verify admin authorization.' }, 500);
  }

  if (!callerProfile.active || callerProfile.role !== 'admin') {
    return json(
      { error: 'Only active Department Admins may import GMetrix certification keys.' },
      403
    );
  }

  const rawContentType = req.headers.get('content-type') ?? '';
  const mediaType = rawContentType.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'multipart/form-data' && mediaType !== 'application/json') {
    return json(
      { error: 'Content-Type must be multipart/form-data or application/json.' },
      400
    );
  }

  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const parsedLength = Number.parseInt(contentLengthHeader.trim(), 10);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_BYTES) {
      return json({ error: 'CSV payload exceeds the 2 MiB upload limit.' }, 413);
    }
  }

  const payload = await parseImportPayload(req, rawContentType, mediaType);
  if (!payload.ok) {
    return json({ error: payload.message }, payload.status);
  }

  let certification: CertificationRecord | null;
  try {
    certification = await deps.loadCertification(payload.certificationId);
  } catch {
    return json({ error: 'Unable to verify target certification.' }, 500);
  }

  if (!certification || !certification.isActive) {
    return json({ error: 'Certification not found or inactive.' }, 404);
  }

  const parsedCsv = parseGMetrixCsv(payload.csvText);
  if (!parsedCsv.ok) {
    return json({ error: parsedCsv.error }, 400);
  }

  let secrets: GMetrixCryptoSecrets | null;
  try {
    secrets = await deps.loadCryptoSecrets();
  } catch {
    return json({ error: 'Server encryption configuration error.' }, 500);
  }

  const activeKey =
    secrets &&
    Number.isInteger(secrets.activeVersion) &&
    secrets.activeVersion >= 1 &&
    Object.prototype.hasOwnProperty.call(secrets.keyRing, secrets.activeVersion)
      ? secrets.keyRing[secrets.activeVersion]
      : undefined;

  if (!secrets || !hasValidSecretBytes(secrets.emailBlindPepper) || !hasValidSecretBytes(activeKey)) {
    return json({ error: 'Server encryption configuration error.' }, 500);
  }

  let hmacKey: CryptoKey;
  let aesKey: CryptoKey;
  try {
    [hmacKey, aesKey] = await Promise.all([
      createHmacKey(secrets.emailBlindPepper, 'Blind index pepper'),
      createAesGcmKey(activeKey, ['encrypt']),
    ]);
  } catch {
    return json({ error: 'Server encryption configuration error.' }, 500);
  }

  const rejectedRows: RejectedRow[] = [];
  const candidateRows: Array<{
    rowNumber: number;
    normalizedEmail: string;
    trimmedKey: string;
  }> = [];
  const seenCanonicalKeys = new Set<string>();

  for (const row of parsedCsv.rows) {
    if (!isInstitutionalEmail(row.email)) {
      rejectedRows.push({
        rowNumber: row.rowNumber,
        email: row.email,
        reason: 'invalid_email',
      });
      continue;
    }

    const normalizedEmail = normalizeInstitutionalEmail(row.email);
    const trimmedKey = normalizeGMetrixKeyCode(row.keyCode);

    if (trimmedKey.length === 0) {
      rejectedRows.push({
        rowNumber: row.rowNumber,
        email: normalizedEmail,
        reason: 'missing_key_code',
      });
      continue;
    }

    if (!isValidGMetrixKeyCode(trimmedKey)) {
      rejectedRows.push({
        rowNumber: row.rowNumber,
        email: normalizedEmail,
        reason: 'invalid_key_code',
      });
      continue;
    }

    const canonicalKey = canonicalizeGMetrixKeyForHash(trimmedKey);
    if (seenCanonicalKeys.has(canonicalKey)) {
      rejectedRows.push({
        rowNumber: row.rowNumber,
        email: normalizedEmail,
        reason: 'duplicate_key_in_csv',
      });
      continue;
    }

    seenCanonicalKeys.add(canonicalKey);
    candidateRows.push({
      rowNumber: row.rowNumber,
      normalizedEmail,
      trimmedKey,
    });
  }

  const emailToBlindIndex = new Map<string, string>();
  try {
    const uniqueEmails = Array.from(new Set(candidateRows.map((row) => row.normalizedEmail)));
    const blindIndexes = await mapInChunks(uniqueEmails, CRYPTO_CHUNK_SIZE, (email) =>
      signEmailBlindIndex(email, hmacKey)
    );
    for (let i = 0; i < uniqueEmails.length; i += 1) {
      emailToBlindIndex.set(uniqueEmails[i], blindIndexes[i]);
    }
  } catch {
    return json({ error: 'Failed to compute email blind indexes.' }, 500);
  }

  const blindIndexToProfileId = new Map<string, string>();
  const uniqueBlindIndexes = Array.from(emailToBlindIndex.values());
  if (uniqueBlindIndexes.length > 0) {
    try {
      const matchedProfiles = await deps.lookupProfilesByBlindIndexes(uniqueBlindIndexes);
      for (const profile of matchedProfiles) {
        if (profile.id && profile.emailBlindIndex) {
          blindIndexToProfileId.set(profile.emailBlindIndex, profile.id);
        }
      }
    } catch {
      return json({ error: 'Failed to resolve registered student profiles.' }, 500);
    }
  }

  const matchedCandidates: Array<{
    rowNumber: number;
    email: string;
    trimmedKey: string;
    profileId: string;
  }> = [];

  for (const row of candidateRows) {
    const blindIndex = emailToBlindIndex.get(row.normalizedEmail);
    const profileId = blindIndex ? blindIndexToProfileId.get(blindIndex) : undefined;
    if (!profileId) {
      rejectedRows.push({
        rowNumber: row.rowNumber,
        email: row.normalizedEmail,
        reason: 'unregistered_student',
      });
      continue;
    }
    matchedCandidates.push({
      rowNumber: row.rowNumber,
      email: row.normalizedEmail,
      trimmedKey: row.trimmedKey,
      profileId,
    });
  }

  let matchedEntries: Array<{
    rowNumber: number;
    email: string;
    keyCodeHash: string;
    entry: CommitGMetrixKeyEntry;
  }>;

  try {
    const activeVersion = secrets.activeVersion;
    matchedEntries = await mapInChunks(matchedCandidates, CRYPTO_CHUNK_SIZE, async (row) => {
      const [keyCodeHash, encrypted] = await Promise.all([
        signKeyCodeHash(row.trimmedKey, hmacKey),
        encryptWithAesKey(row.trimmedKey, aesKey, activeVersion),
      ]);
      return {
        rowNumber: row.rowNumber,
        email: row.email,
        keyCodeHash,
        entry: {
          student_profile_id: row.profileId,
          key_code_enc_hex: encrypted.byteaHex,
          key_code_hash: keyCodeHash,
          key_version: encrypted.keyVersion,
        },
      };
    });
  } catch {
    return json({ error: 'Failed to encrypt matched certification keys.' }, 500);
  }

  let commitResult: CommitGMetrixKeyBatchResult;
  try {
    commitResult = await deps.commitBatch({
      certificationId: payload.certificationId,
      uploadedByAdminId: callerUserId,
      totalRows: parsedCsv.rows.length,
      entries: matchedEntries.map((item) => item.entry),
      notificationTitle: GMETRIX_PUSH_TITLE,
      notificationBody: GMETRIX_PUSH_BODY,
      deepLink: GMETRIX_MY_KEYS_DEEP_LINK,
    });
  } catch {
    return json({ error: 'Failed to commit GMetrix key batch.' }, 500);
  }

  const committedHashSet = new Set(commitResult.committedHashes);
  const missingProfileHashSet = new Set(commitResult.missingProfileHashes ?? []);
  for (const item of matchedEntries) {
    if (!committedHashSet.has(item.keyCodeHash)) {
      rejectedRows.push({
        rowNumber: item.rowNumber,
        email: item.email,
        reason: missingProfileHashSet.has(item.keyCodeHash)
          ? 'unregistered_student'
          : 'duplicate_key_existing',
      });
    }
  }

  rejectedRows.sort((a, b) => a.rowNumber - b.rowNumber);
  const rejectedRowsCsv = buildRejectedRowsCsv(rejectedRows);

  let pushNotificationsSent = 0;
  let pushNotificationsFailed = 0;

  const distinctNotifiedProfileIds = Array.from(
    new Set(
      commitResult.notifiedProfileIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  );

  if (distinctNotifiedProfileIds.length > 0) {
    let rawTokens: string[] | null = null;
    try {
      rawTokens = await deps.loadPushTokens(distinctNotifiedProfileIds);
    } catch {
      pushNotificationsFailed += distinctNotifiedProfileIds.length;
    }

    if (rawTokens !== null) {
      const validTokens = Array.from(
        new Set(
          rawTokens
            .map((token) => token.trim())
            .filter((token) => isValidExpoPushToken(token))
        )
      );

      const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token,
        sound: 'default',
        title: GMETRIX_PUSH_TITLE,
        body: GMETRIX_PUSH_BODY,
        data: {
          type: 'gmetrix_key',
          deepLink: GMETRIX_MY_KEYS_DEEP_LINK,
          certificationId: payload.certificationId,
        },
      }));

      const chunks: ExpoPushMessage[][] = [];
      for (let offset = 0; offset < messages.length; offset += EXPO_PUSH_BATCH_LIMIT) {
        chunks.push(messages.slice(offset, offset + EXPO_PUSH_BATCH_LIMIT));
      }

      const nowMs = deps.nowMs ?? Date.now;
      const deadlineMs = nowMs() + (deps.pushBudgetMs ?? DEFAULT_PUSH_BUDGET_MS);
      const deadTokens = new Set<string>();
      let nextChunkIndex = 0;

      const workerCount = Math.min(EXPO_PUSH_MAX_CONCURRENCY, chunks.length);
      const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
          const idx = nextChunkIndex;
          if (idx >= chunks.length) {
            return;
          }
          nextChunkIndex += 1;
          const chunk = chunks[idx];

          const remainingMs = deadlineMs - nowMs();
          if (remainingMs <= 0) {
            pushNotificationsFailed += chunk.length;
            continue;
          }

          try {
            const tickets = await deps.sendExpoPushBatch(chunk, { timeoutMs: remainingMs });
            for (let i = 0; i < chunk.length; i += 1) {
              const ticket = tickets[i];
              if (ticket && ticket.status === 'ok') {
                pushNotificationsSent += 1;
              } else {
                pushNotificationsFailed += 1;
                if (
                  ticket &&
                  ticket.status === 'error' &&
                  ticket.details?.error === 'DeviceNotRegistered'
                ) {
                  deadTokens.add(chunk[i].to);
                }
              }
            }
          } catch {
            pushNotificationsFailed += chunk.length;
          }
        }
      });

      await Promise.all(workers);

      if (deadTokens.size > 0) {
        try {
          await deps.deletePushTokens(Array.from(deadTokens));
        } catch {}
      }
    }
  }

  return json(
    {
      batchId: commitResult.batchId,
      certificationId: payload.certificationId,
      totalRows: parsedCsv.rows.length,
      assignedCount: commitResult.assignedCount,
      rejectedCount: rejectedRows.length,
      pushNotificationsSent,
      pushNotificationsFailed,
      rejectedRows,
      rejectedRowsCsv,
    },
    201
  );
}
