import {
  AdminDirectoryEntrySchema,
  buildRejectedRowsCsv as sharedBuildRejectedRowsCsv,
  canonicalizeGMetrixKeyForHash as sharedCanonicalizeKey,
  CertificationKeyBatchSchema,
  DecryptedCertificationKeySchema,
  EXPO_PUSH_BATCH_LIMIT as SHARED_EXPO_PUSH_BATCH_LIMIT,
  ExpoPushTokenSchema,
  GMETRIX_MY_KEYS_DEEP_LINK as SHARED_DEEP_LINK,
  GMETRIX_PUSH_BODY as SHARED_PUSH_BODY,
  GMETRIX_PUSH_TITLE as SHARED_PUSH_TITLE,
  ImportGMetrixKeysResponseSchema,
  isValidGMetrixKeyCode as sharedIsValidKeyCode,
  maskCertificationKey,
  MAX_GMETRIX_CSV_BYTES as SHARED_MAX_CSV_BYTES,
  MAX_GMETRIX_CSV_ROWS as SHARED_MAX_CSV_ROWS,
  NotificationSchema,
  parseGMetrixCsv as sharedParseGMetrixCsv,
  parseNotificationDeepLink,
  PromoteFacultyResultSchema,
  REJECTED_CSV_HEADER as SHARED_REJECTED_CSV_HEADER,
  sanitizeCsvCell as sharedSanitizeCsvCell,
} from '../../shared/gmetrix';
import { computeEmailBlindIndex as sharedComputeEmailBlindIndex } from '../../shared/identity-crypto';
import {
  readStreamWithLimit,
  validateJwtClaims,
} from '../../supabase/functions/_shared/edge-auth';
import {
  computeEmailBlindIndex as edgeComputeEmailBlindIndex,
  computeKeyCodeHash,
  decryptKeyCode,
  encryptKeyCode,
  parseKeyRingEnv,
} from '../../supabase/functions/_shared/gmetrix-crypto';
import {
  buildRejectedRowsCsv as edgeBuildRejectedRowsCsv,
  canonicalizeGMetrixKeyForHash as edgeCanonicalizeKey,
  EXPO_PUSH_BATCH_LIMIT as EDGE_EXPO_PUSH_BATCH_LIMIT,
  GMETRIX_MY_KEYS_DEEP_LINK as EDGE_DEEP_LINK,
  GMETRIX_PUSH_BODY as EDGE_PUSH_BODY,
  GMETRIX_PUSH_TITLE as EDGE_PUSH_TITLE,
  isInstitutionalEmail as edgeIsInstitutionalEmail,
  isValidExpoPushToken,
  isValidGMetrixKeyCode as edgeIsValidKeyCode,
  MAX_GMETRIX_CSV_BYTES as EDGE_MAX_CSV_BYTES,
  MAX_GMETRIX_CSV_ROWS as EDGE_MAX_CSV_ROWS,
  normalizeInstitutionalEmail as edgeNormalizeEmail,
  parseGMetrixCsv as edgeParseGMetrixCsv,
  REJECTED_CSV_HEADER as EDGE_REJECTED_CSV_HEADER,
  sanitizeCsvCell as edgeSanitizeCsvCell,
} from '../../supabase/functions/_shared/gmetrix-csv';
import {
  createImportSecretsResolver,
  createRpcDatabaseAdapter,
  handleImportGMetrixKeysRequest,
  MAX_BODY_BYTES,
  parseExpoPushTickets,
  type CommitGMetrixKeyBatchInput,
  type ExpoPushMessage,
  type ImportGMetrixKeysDeps,
} from '../../supabase/functions/import-gmetrix-keys/core';
import {
  createMyKeysRingResolver,
  handleMyCertificationKeysRequest,
  loadAllPaginatedCertificationKeyRows,
  mapPostgrestCertificationKeyRow,
  type EncryptedCertificationKeyRow,
  type MyCertificationKeysDeps,
} from '../../supabase/functions/my-certification-keys/core';

declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeFs = require('node:fs') as {
  readFileSync(filePath: string, encoding: 'utf8'): string;
};
const nodePath = require('node:path') as {
  resolve(...segments: string[]): string;
  join(...segments: string[]): string;
};
const { ReadableStream: NativeReadableStream } = require('node:stream/web') as {
  ReadableStream: typeof ReadableStream;
};

const REPO_ROOT = nodePath.resolve(__dirname, '..', '..');
const SUPABASE_URL = 'https://myccs-project.supabase.co';
const ALLOWED_ORIGIN = 'https://myccs-admin.pages.dev';
const CERT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_A_ID = '33333333-3333-4333-8333-333333333333';
const STUDENT_B_ID = '44444444-4444-4444-8444-444444444444';
const BATCH_ID = '55555555-5555-4555-8555-555555555555';
const KEY_ROW_1_ID = '66666666-6666-4666-8666-666666666666';
const KEY_ROW_2_ID = '77777777-7777-4777-8777-777777777777';
const NOW_SECONDS = 1_764_250_000;

const TEST_BLIND_PEPPER = 'test-blind-pepper-at-least-32-bytes-long-001';
const TEST_KEY_V1 = 'test-aes-key-version-1-at-least-32-bytes-001';
const TEST_KEY_V2 = 'test-aes-key-version-2-at-least-32-bytes-002';

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeTestJwt(claims: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.synthetic_signature`;
}

function makeValidToken(
  sub: string = ADMIN_ID,
  overrides: Record<string, unknown> = {}
): string {
  return makeTestJwt({
    aud: 'authenticated',
    iss: `${SUPABASE_URL}/auth/v1`,
    sub,
    exp: NOW_SECONDS + 3600,
    ...overrides,
  });
}

function makeJsonImportRequest(
  body: unknown,
  options: {
    method?: string;
    origin?: string | null;
    authorization?: string | null;
    contentType?: string | null;
    contentLength?: string | null;
    rawBody?: string;
  } = {}
): Request {
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set('Origin', options.origin ?? ALLOWED_ORIGIN);
  }
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? `Bearer ${makeValidToken(ADMIN_ID)}`);
  }
  if (options.contentType !== null) {
    headers.set('Content-Type', options.contentType ?? 'application/json');
  }
  if (options.contentLength !== undefined && options.contentLength !== null) {
    headers.set('Content-Length', options.contentLength);
  }

  const method = options.method ?? 'POST';
  const serialized = options.rawBody ?? JSON.stringify(body);
  return new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? undefined : serialized,
  });
}

function makeMultipartImportRequest(
  csvText: string,
  options: {
    certificationId?: string | null;
    origin?: string | null;
    authorization?: string | null;
    file?: Blob | string | null;
    contentLength?: string | null;
  } = {}
): Request {
  const form = new FormData();
  const certId = options.certificationId === undefined ? CERT_ID : options.certificationId;
  if (certId !== null) {
    form.append('certification_id', certId);
  }
  if (options.file !== null) {
    const file =
      options.file ?? new Blob([new TextEncoder().encode(csvText)], { type: 'text/csv' });
    form.append('file', file);
  }

  const headers = new Headers();
  if (options.origin !== null) {
    headers.set('Origin', options.origin ?? ALLOWED_ORIGIN);
  }
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? `Bearer ${makeValidToken(ADMIN_ID)}`);
  }
  headers.set('Content-Type', 'multipart/form-data; boundary=----spec05-test');
  if (options.contentLength !== undefined && options.contentLength !== null) {
    headers.set('Content-Length', options.contentLength);
  }

  const req = new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
    method: 'POST',
    headers,
  });
  Object.defineProperty(req, 'formData', {
    value: async () => form,
    configurable: true,
  });
  return req;
}

function makeImportDeps(
  overrides: Partial<ImportGMetrixKeysDeps> = {}
): ImportGMetrixKeysDeps {
  return {
    supabaseUrl: SUPABASE_URL,
    allowedOrigins: [ALLOWED_ORIGIN],
    verifyUser: jest.fn().mockResolvedValue({
      id: ADMIN_ID,
      email: 'admin@lpunetwork.edu.ph',
    }),
    loadCallerProfile: jest.fn().mockResolvedValue({
      role: 'admin',
      active: true,
    }),
    loadCertification: jest.fn().mockResolvedValue({
      id: CERT_ID,
      isActive: true,
    }),
    loadCryptoSecrets: jest.fn().mockResolvedValue({
      emailBlindPepper: TEST_BLIND_PEPPER,
      activeVersion: 2,
      keyRing: {
        1: TEST_KEY_V1,
        2: TEST_KEY_V2,
      },
    }),
    lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([]),
    commitBatch: jest.fn().mockImplementation(async (input: CommitGMetrixKeyBatchInput) => ({
      batchId: BATCH_ID,
      assignedCount: input.entries.length,
      rejectedCount: input.totalRows - input.entries.length,
      committedHashes: input.entries.map((entry) => entry.key_code_hash),
      notifiedProfileIds: input.entries.map((entry) => entry.student_profile_id),
    })),
    loadPushTokens: jest.fn().mockResolvedValue([]),
    sendExpoPushBatch: jest.fn().mockImplementation(async (messages: readonly ExpoPushMessage[]) =>
      messages.map((_, idx) => ({ status: 'ok' as const, id: `ticket-${idx}` }))
    ),
    deletePushTokens: jest.fn().mockResolvedValue(undefined),
    nowSeconds: () => NOW_SECONDS,
    ...overrides,
  };
}

function makeMyKeysRequest(options: {
  method?: string;
  origin?: string | null;
  authorization?: string | null;
} = {}): Request {
  const headers = new Headers();
  if (options.origin !== null && options.origin !== undefined) {
    headers.set('Origin', options.origin);
  }
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? `Bearer ${makeValidToken(STUDENT_A_ID)}`);
  }
  return new Request(`${SUPABASE_URL}/functions/v1/my-certification-keys`, {
    method: options.method ?? 'GET',
    headers,
  });
}

function makeMyKeysDeps(
  overrides: Partial<MyCertificationKeysDeps> = {}
): MyCertificationKeysDeps {
  return {
    supabaseUrl: SUPABASE_URL,
    allowedOrigins: [ALLOWED_ORIGIN],
    verifyUser: jest.fn().mockResolvedValue({
      id: STUDENT_A_ID,
      email: 'student.a@lpunetwork.edu.ph',
    }),
    loadCallerProfile: jest.fn().mockResolvedValue({ active: true }),
    loadKeyRing: jest.fn().mockResolvedValue({
      1: TEST_KEY_V1,
      2: TEST_KEY_V2,
    }),
    loadOwnEncryptedKeys: jest.fn().mockResolvedValue([]),
    nowSeconds: () => NOW_SECONDS,
    ...overrides,
  };
}

describe('spec-05 shared/gmetrix.ts & _shared/gmetrix-csv.ts parity and schemas', () => {
  it('maintains exact constant parity between shared/gmetrix.ts and _shared/gmetrix-csv.ts', () => {
    expect(EDGE_MAX_CSV_BYTES).toBe(SHARED_MAX_CSV_BYTES);
    expect(EDGE_MAX_CSV_ROWS).toBe(SHARED_MAX_CSV_ROWS);
    expect(EDGE_EXPO_PUSH_BATCH_LIMIT).toBe(SHARED_EXPO_PUSH_BATCH_LIMIT);
    expect(EDGE_DEEP_LINK).toBe(SHARED_DEEP_LINK);
    expect(EDGE_PUSH_TITLE).toBe(SHARED_PUSH_TITLE);
    expect(EDGE_PUSH_BODY).toBe(SHARED_PUSH_BODY);
    expect(EDGE_REJECTED_CSV_HEADER).toBe(SHARED_REJECTED_CSV_HEADER);
  });

  it('parses RFC 4180 CSVs identically (BOM, CRLF/LF, quotes, header aliases, line numbers, row cap)', () => {
    const csvWithBomAndQuotes =
      '\uFEFF"Institutional Email","Access Code","Notes"\r\n' +
      'student.a@lpunetwork.edu.ph,"GMX-1001,A","quoted ""ok"""\r\n' +
      ' , , \r\n' +
      'student.b@lpunetwork.edu.ph,  GMX-1002  ,plain\n';

    const sharedParsed = sharedParseGMetrixCsv(csvWithBomAndQuotes);
    const edgeParsed = edgeParseGMetrixCsv(csvWithBomAndQuotes);
    expect(edgeParsed).toEqual(sharedParsed);
    expect(sharedParsed).toEqual({
      ok: true,
      rows: [
        { rowNumber: 2, email: 'student.a@lpunetwork.edu.ph', keyCode: 'GMX-1001,A' },
        { rowNumber: 4, email: 'student.b@lpunetwork.edu.ph', keyCode: 'GMX-1002' },
      ],
    });

    const errorInputs = [
      '',
      '\uFEFF   \r\n',
      'email,key_code\n"unclosed,GMX-1',
      'email,key_code\nfoo"bar@lpunetwork.edu.ph,GMX-1',
      'email,key_code\n"a@lpunetwork.edu.ph"extra,GMX-1',
      'name,score\nJuan,99',
      'email,key_code\n\n  ,  ',
    ];
    for (const badCsv of errorInputs) {
      const s = sharedParseGMetrixCsv(badCsv);
      const e = edgeParseGMetrixCsv(badCsv);
      expect(s.ok).toBe(false);
      expect(e).toEqual(s);
    }

    const overCapLines = ['email,key_code'];
    for (let i = 0; i < SHARED_MAX_CSV_ROWS + 1; i += 1) {
      overCapLines.push(`student${i}@lpunetwork.edu.ph,GMX-${i}`);
    }
    const overCapCsv = overCapLines.join('\n');
    expect(sharedParseGMetrixCsv(overCapCsv).ok).toBe(false);
    expect(edgeParseGMetrixCsv(overCapCsv)).toEqual(sharedParseGMetrixCsv(overCapCsv));

    const exactCapLines = ['email,key_code'];
    for (let i = 0; i < SHARED_MAX_CSV_ROWS; i += 1) {
      exactCapLines.push(`student${i}@lpunetwork.edu.ph,GMX-${i}`);
    }
    exactCapLines.push('', '  ,  ', '');
    const exactCapParsed = edgeParseGMetrixCsv(exactCapLines.join('\n'));
    expect(exactCapParsed.ok).toBe(true);
    if (exactCapParsed.ok) {
      expect(exactCapParsed.rows).toHaveLength(SHARED_MAX_CSV_ROWS);
    }

    const overCapWithTrailingGarbage = `${overCapCsv}\n"unclosed-quote-never-reached`;
    expect(edgeParseGMetrixCsv(overCapWithTrailingGarbage)).toEqual({
      ok: false,
      error: `CSV exceeds the maximum limit of ${SHARED_MAX_CSV_ROWS} rows.`,
    });

    const dupEmailHeader = edgeParseGMetrixCsv(
      'student_email,email,key_code\na@lpunetwork.edu.ph,b@lpunetwork.edu.ph,GMX-1'
    );
    expect(dupEmailHeader.ok).toBe(false);
    if (!dupEmailHeader.ok) {
      expect(dupEmailHeader.error).toContain('student_email');
      expect(dupEmailHeader.error).toContain('email');
    }
    expect(sharedParseGMetrixCsv('student_email,email,key_code\na@lpunetwork.edu.ph,b@lpunetwork.edu.ph,GMX-1')).toEqual(
      dupEmailHeader
    );

    const dupKeyHeader = edgeParseGMetrixCsv(
      'email,access_key,key_code\na@lpunetwork.edu.ph,GMX-1,GMX-2'
    );
    expect(dupKeyHeader.ok).toBe(false);
    if (!dupKeyHeader.ok) {
      expect(dupKeyHeader.error).toContain('access_key');
      expect(dupKeyHeader.error).toContain('key_code');
    }
  });

  it('neutralizes OWASP spreadsheet formula prefixes (including control-char prefix bypasses) and builds rejected CSV identically', () => {
    const formulaSamples = [
      "=CMD|'/C calc'!A0",
      "\x00=CMD|'/C calc'!A0",
      '\x07+1+1',
      '\x01\x1f-2+3',
      '\x00@SUM(1,2)',
      '+SUM(A1:A2)',
      '-2+3',
      '@HYPERLINK("http://evil")',
      '\t=1+1',
      '\r=1+1',
      '  =IMPORTXML("http://evil")',
      'quoted,"comma"\nline2',
      'normal@lpunetwork.edu.ph',
    ];

    for (const sample of formulaSamples) {
      expect(edgeSanitizeCsvCell(sample)).toBe(sharedSanitizeCsvCell(sample));
    }

    expect(edgeSanitizeCsvCell("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    expect(edgeSanitizeCsvCell("\x00=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    expect(edgeSanitizeCsvCell('\x07+1+1')).toBe("'+1+1");
    expect(edgeSanitizeCsvCell('\x01\x1f-2+3')).toBe("'-2+3");
    expect(edgeSanitizeCsvCell('\x00@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(edgeSanitizeCsvCell('+1+1')).toBe("'+1+1");
    expect(edgeSanitizeCsvCell('-1+1')).toBe("'-1+1");
    expect(edgeSanitizeCsvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(edgeSanitizeCsvCell('\tfoo')).toBe("'\tfoo");
    expect(edgeSanitizeCsvCell('\rfoo')).toBe("' foo");
    expect(edgeSanitizeCsvCell('  =1+1')).toBe("'  =1+1");

    const rejected = [
      { rowNumber: 2, email: "\x00=CMD|'/C calc'!A0", reason: 'invalid_email' as const },
      { rowNumber: 5, email: 'unreg@lpunetwork.edu.ph', reason: 'unregistered_student' as const },
    ];
    expect(edgeBuildRejectedRowsCsv(rejected)).toBe(sharedBuildRejectedRowsCsv(rejected));
    expect(edgeBuildRejectedRowsCsv(rejected)).toBe(
      "row_number,email,reason\n2,'=CMD|'/C calc'!A0,invalid_email\n5,unreg@lpunetwork.edu.ph,unregistered_student"
    );
  });

  it('validates keys, emails, Expo tokens, masking, deep links, and strict Zod DTOs (rejecting student_id)', () => {
    expect(edgeNormalizeEmail('  Juan.DelaCruz@LPUNetwork.EDU.PH ')).toBe(
      'juan.delacruz@lpunetwork.edu.ph'
    );
    expect(edgeIsInstitutionalEmail('juan@lpunetwork.edu.ph')).toBe(true);
    expect(edgeIsInstitutionalEmail('juan@gmail.com')).toBe(false);
    expect(edgeIsInstitutionalEmail('juan@lpunetwork.edu.ph.evil.com')).toBe(false);

    expect(edgeIsValidKeyCode('GMX-2026-ABCD')).toBe(true);
    expect(edgeIsValidKeyCode('')).toBe(false);
    expect(edgeIsValidKeyCode('A'.repeat(129))).toBe(false);
    expect(edgeIsValidKeyCode('GMX-\x07-BAD')).toBe(false);
    expect(edgeIsValidKeyCode('GMX-2026-ABCD')).toBe(sharedIsValidKeyCode('GMX-2026-ABCD'));
    expect(edgeCanonicalizeKey('  gmx-ab-12 ')).toBe(sharedCanonicalizeKey('  gmx-ab-12 '));
    expect(edgeCanonicalizeKey('  gmx-ab-12 ')).toBe('GMX-AB-12');

    expect(isValidExpoPushToken('ExponentPushToken[abcDEF_1234-5678]')).toBe(true);
    expect(isValidExpoPushToken('ExpoPushToken[12345678]')).toBe(true);
    expect(isValidExpoPushToken('ExponentPushToken[short]')).toBe(false);
    expect(isValidExpoPushToken('fcm:raw-token')).toBe(false);
    expect(ExpoPushTokenSchema.safeParse('ExponentPushToken[abcDEF_1234-5678]').success).toBe(
      true
    );

    expect(maskCertificationKey('GMX-9999-ABCD')).toBe('••••-••••-ABCD');
    expect(maskCertificationKey('AB12')).toBe('••••••••');
    expect(maskCertificationKey('')).toBe('••••••••');

    expect(parseNotificationDeepLink('myccs://certifications/my-keys')).toEqual({
      tab: 'keys',
      section: 'my_keys',
    });
    expect(parseNotificationDeepLink('MYCCS://Certifications/My-Keys/?ref=push#top')).toEqual({
      tab: 'keys',
      section: 'my_keys',
    });
    expect(parseNotificationDeepLink('https://evil.example/certifications/my-keys')).toBeNull();
    expect(parseNotificationDeepLink('')).toBeNull();

    const validAdmin = {
      id: ADMIN_ID,
      email: 'ccs.admin@lpunetwork.edu.ph',
      fullName: 'CCS Admin',
      role: 'admin' as const,
      createdAt: '2026-11-28T00:00:00.000Z',
    };
    expect(AdminDirectoryEntrySchema.safeParse(validAdmin).success).toBe(true);
    expect(
      AdminDirectoryEntrySchema.safeParse({ ...validAdmin, student_id: '2026-0001' }).success
    ).toBe(false);
    expect(
      AdminDirectoryEntrySchema.safeParse({ ...validAdmin, studentId: '2026-0001' }).success
    ).toBe(false);

    const validPromote = {
      id: ADMIN_ID,
      email: 'faculty@lpunetwork.edu.ph',
      fullName: 'Prof. Reyes',
      role: 'admin' as const,
      alreadyAdmin: false,
    };
    expect(PromoteFacultyResultSchema.safeParse(validPromote).success).toBe(true);
    expect(
      PromoteFacultyResultSchema.safeParse({ ...validPromote, student_id: 'FAC-1' }).success
    ).toBe(false);

    expect(
      CertificationKeyBatchSchema.safeParse({
        id: BATCH_ID,
        certification_id: CERT_ID,
        uploaded_by_admin_id: ADMIN_ID,
        total_rows: 5,
        assigned_count: 3,
        rejected_count: 1,
        created_at: '2026-11-28T00:00:00.000Z',
      }).success
    ).toBe(false);

    expect(
      NotificationSchema.safeParse({
        id: KEY_ROW_1_ID,
        profile_id: STUDENT_A_ID,
        type: 'gmetrix_key',
        title: SHARED_PUSH_TITLE,
        body: SHARED_PUSH_BODY,
        deep_link: SHARED_DEEP_LINK,
        read_at: null,
        created_at: '2026-11-28T00:00:00.000Z',
      }).success
    ).toBe(true);
  });
});

describe('spec-05 supabase/functions/_shared/gmetrix-crypto.ts', () => {
  it('matches shared/identity-crypto.ts blind index and enforces case-insensitive domain-separated key hashes', async () => {
    const emailRaw = '  Student.Alpha@LPUNetwork.EDU.PH  ';
    const [sharedHash, edgeHash] = await Promise.all([
      sharedComputeEmailBlindIndex(emailRaw, TEST_BLIND_PEPPER),
      edgeComputeEmailBlindIndex(emailRaw, TEST_BLIND_PEPPER),
    ]);
    expect(edgeHash).toBe(sharedHash);
    expect(edgeHash).toMatch(/^[0-9a-f]{64}$/);

    const [lowerKeyHash, upperKeyHash, unprefixedEmailStyleHash] = await Promise.all([
      computeKeyCodeHash('  gmx-2026-abcd  ', TEST_BLIND_PEPPER),
      computeKeyCodeHash('GMX-2026-ABCD', TEST_BLIND_PEPPER),
      edgeComputeEmailBlindIndex('GMX-2026-ABCD', TEST_BLIND_PEPPER),
    ]);
    expect(lowerKeyHash).toBe(upperKeyHash);
    expect(lowerKeyHash).not.toBe(unprefixedEmailStyleHash);
  });

  it('encrypts and decrypts with AES-256-GCM AEAD, supports key_version rotation, and rejects tampering', async () => {
    const encV1A = await encryptKeyCode('GMX-KEY-V1-0001', TEST_KEY_V1, 1);
    const encV1B = await encryptKeyCode('GMX-KEY-V1-0001', TEST_KEY_V1, 1);
    const encV2 = await encryptKeyCode('GMX-KEY-V2-0002', TEST_KEY_V2, 2);

    expect(encV1A.byteaHex).not.toBe(encV1B.byteaHex);
    expect(encV1A.byteaHex.startsWith('\\x00000001')).toBe(true);
    expect(encV2.byteaHex.startsWith('\\x00000002')).toBe(true);

    const keyRing = { 1: TEST_KEY_V1, 2: TEST_KEY_V2 };
    await expect(decryptKeyCode(encV1A.byteaHex, keyRing)).resolves.toEqual({
      plaintext: 'GMX-KEY-V1-0001',
      keyVersion: 1,
    });
    await expect(decryptKeyCode(encV2.ciphertext, keyRing)).resolves.toEqual({
      plaintext: 'GMX-KEY-V2-0002',
      keyVersion: 2,
    });

    const tamperedAad = new Uint8Array(encV1A.ciphertext);
    tamperedAad[3] = 2;
    await expect(
      decryptKeyCode(tamperedAad, { 1: TEST_KEY_V1, 2: TEST_KEY_V1 })
    ).rejects.toThrow();

    const tamperedCipher = new Uint8Array(encV2.ciphertext);
    tamperedCipher[tamperedCipher.length - 1] ^= 0xff;
    await expect(decryptKeyCode(tamperedCipher, keyRing)).rejects.toThrow();

    await expect(decryptKeyCode(encV2.byteaHex, { 1: TEST_KEY_V1 })).rejects.toThrow(
      'Missing encryption key for key_version 2.'
    );

    await expect(decryptKeyCode(new Uint8Array(10), keyRing)).rejects.toThrow();
  });

  it('parses key rings from CERT_KEY_RING_JSON, CERT_KEY_ENCRYPTION_KEY, and Vault fallback fail-closed', () => {
    const readFrom = (env: Record<string, string | undefined>) => (key: string) => env[key];

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '1': TEST_KEY_V1, '2': TEST_KEY_V2 }),
          CERT_KEY_ACTIVE_VERSION: '1',
        })
      )
    ).toEqual({
      activeVersion: 1,
      keyRing: { 1: TEST_KEY_V1, 2: TEST_KEY_V2 },
    });

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '1': TEST_KEY_V1, '3': TEST_KEY_V2 }),
        })
      )
    ).toEqual({
      activeVersion: 3,
      keyRing: { 1: TEST_KEY_V1, 3: TEST_KEY_V2 },
    });

    expect(parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: '{bad-json' }))).toBeNull();
    expect(parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: '[]' }))).toBeNull();
    expect(parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: '{}' }))).toBeNull();
    expect(
      parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: JSON.stringify({ '0': TEST_KEY_V1 }) }))
    ).toBeNull();
    expect(
      parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: JSON.stringify({ '1': 'too-short' }) }))
    ).toBeNull();
    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '1': TEST_KEY_V1 }),
          CERT_KEY_ACTIVE_VERSION: '2',
        })
      )
    ).toBeNull();

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_ENCRYPTION_KEY: TEST_KEY_V1,
        })
      )
    ).toEqual({
      activeVersion: 1,
      keyRing: { 1: TEST_KEY_V1 },
    });

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_ENCRYPTION_KEY: TEST_KEY_V2,
          CERT_KEY_ACTIVE_VERSION: '4',
        })
      )
    ).toEqual({
      activeVersion: 4,
      keyRing: { 4: TEST_KEY_V2 },
    });

    expect(parseKeyRingEnv(readFrom({ CERT_KEY_ENCRYPTION_KEY: 'short' }))).toBeNull();
    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_ENCRYPTION_KEY: TEST_KEY_V1,
          CERT_KEY_ACTIVE_VERSION: '0',
        })
      )
    ).toBeNull();

    expect(parseKeyRingEnv(readFrom({}), TEST_KEY_V1)).toEqual({
      activeVersion: 1,
      keyRing: { 1: TEST_KEY_V1 },
    });
    expect(
      parseKeyRingEnv(readFrom({ CERT_KEY_ACTIVE_VERSION: '1' }), TEST_KEY_V1)
    ).toEqual({
      activeVersion: 1,
      keyRing: { 1: TEST_KEY_V1 },
    });
    expect(
      parseKeyRingEnv(readFrom({ CERT_KEY_ACTIVE_VERSION: '2' }), TEST_KEY_V1)
    ).toBeNull();
    expect(parseKeyRingEnv(readFrom({}), 'short')).toBeNull();
    expect(parseKeyRingEnv(readFrom({}), null)).toBeNull();

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '1': TEST_KEY_V1, ' 1': TEST_KEY_V2 }),
        })
      )
    ).toBeNull();

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '2147483647': TEST_KEY_V1 }),
        })
      )
    ).toEqual({
      activeVersion: 2147483647,
      keyRing: { 2147483647: TEST_KEY_V1 },
    });
    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '2147483648': TEST_KEY_V1 }),
        })
      )
    ).toBeNull();

    expect(
      parseKeyRingEnv(
        readFrom({
          CERT_KEY_RING_JSON: JSON.stringify({ '1': '                ' }),
        })
      )
    ).toBeNull();

    const paddedSecret = `  ${TEST_KEY_V1}  `;
    expect(
      parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: JSON.stringify({ '1': paddedSecret }) }))
    ).toEqual(parseKeyRingEnv(readFrom({ CERT_KEY_ENCRYPTION_KEY: paddedSecret })));
    expect(
      parseKeyRingEnv(readFrom({ CERT_KEY_RING_JSON: JSON.stringify({ '1': paddedSecret }) }))
    ).toEqual(parseKeyRingEnv(readFrom({}), paddedSecret));
  });
});

describe('spec-05 supabase/functions/import-gmetrix-keys/core.ts HTTP handler', () => {
  it('enforces CORS preflight, disallowed Origin 403, omitted Origin allowance, and POST-only 405', async () => {
    const deps = makeImportDeps();

    const okPreflight = await handleImportGMetrixKeysRequest(
      new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
        method: 'OPTIONS',
        headers: { Origin: ALLOWED_ORIGIN },
      }),
      deps
    );
    expect(okPreflight.status).toBe(204);
    expect(okPreflight.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);

    const badPreflight = await handleImportGMetrixKeysRequest(
      new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.com' },
      }),
      deps
    );
    expect(badPreflight.status).toBe(403);
    expect(badPreflight.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const badOriginPost = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest(
        { certification_id: CERT_ID, csv: 'email,key_code\na@lpunetwork.edu.ph,GMX-1' },
        { origin: 'https://evil.example.com' }
      ),
      deps
    );
    expect(badOriginPost.status).toBe(403);
    expect(badOriginPost.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const getRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({}, { method: 'GET' }),
      deps
    );
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get('Allow')).toBe('POST, OPTIONS');

    const noOriginRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest(
        { certification_id: CERT_ID, csv: 'email,key_code\nunreg@lpunetwork.edu.ph,GMX-1' },
        { origin: null }
      ),
      deps
    );
    expect(noOriginRes.status).toBe(201);
    expect(noOriginRes.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(noOriginRes.headers.get('Vary')).toBe('Origin');
  });

  it('rejects missing, invalid, expired, or mismatched JWTs with 401 before loading caller profile', async () => {
    const authCases: Array<{ auth: string | null; deps?: Partial<ImportGMetrixKeysDeps> }> = [
      { auth: null },
      { auth: 'Basic abc' },
      { auth: 'Bearer broken.jwt' },
      { auth: `Bearer ${makeValidToken(ADMIN_ID, { aud: 'anon' })}` },
      { auth: `Bearer ${makeValidToken(ADMIN_ID, { iss: 'https://evil.example/auth/v1' })}` },
      { auth: `Bearer ${makeValidToken(ADMIN_ID, { exp: NOW_SECONDS - 5 })}` },
      {
        auth: `Bearer ${makeValidToken(ADMIN_ID)}`,
        deps: { verifyUser: jest.fn().mockResolvedValue(null) },
      },
      {
        auth: `Bearer ${makeValidToken(ADMIN_ID)}`,
        deps: { verifyUser: jest.fn().mockRejectedValue(new Error('auth outage')) },
      },
      {
        auth: `Bearer ${makeValidToken(ADMIN_ID)}`,
        deps: { verifyUser: jest.fn().mockResolvedValue({ id: STUDENT_A_ID }) },
      },
    ];

    for (const testCase of authCases) {
      const deps = makeImportDeps(testCase.deps);
      const res = await handleImportGMetrixKeysRequest(
        makeJsonImportRequest(
          { certification_id: CERT_ID, csv: 'email,key_code\na@lpunetwork.edu.ph,GMX-1' },
          { authorization: testCase.auth }
        ),
        deps
      );
      expect(res.status).toBe(401);
      expect(deps.loadCallerProfile).not.toHaveBeenCalled();
      expect(deps.commitBatch).not.toHaveBeenCalled();
    }
  });

  it('blocks student, officer, and inactive admin with 403 BEFORE reading or buffering the body', async () => {
    const nonAdminProfiles = [
      { role: 'student' as const, active: true },
      { role: 'officer' as const, active: true },
      { role: 'admin' as const, active: false },
      { role: null, active: false },
    ];

    for (const profile of nonAdminProfiles) {
      const pullSpy = jest.fn();
      const bodyStream = new NativeReadableStream<Uint8Array>(
        {
          pull(controller) {
            pullSpy();
            controller.enqueue(new TextEncoder().encode('{}'));
            controller.close();
          },
        },
        { highWaterMark: 0 }
      );
      const req = new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
        method: 'POST',
        headers: {
          Origin: ALLOWED_ORIGIN,
          Authorization: `Bearer ${makeValidToken(ADMIN_ID)}`,
          'Content-Type': 'application/json',
        },
        body: bodyStream,
        duplex: 'half',
      } as RequestInit);
      const textSpy = jest.spyOn(req, 'text');
      const formDataSpy = jest.spyOn(req, 'formData');

      const deps = makeImportDeps({
        loadCallerProfile: jest.fn().mockResolvedValue(profile),
      });
      const res = await handleImportGMetrixKeysRequest(req, deps);
      expect(res.status).toBe(403);
      expect(req.bodyUsed).toBe(false);
      expect(pullSpy).not.toHaveBeenCalled();
      expect(textSpy).not.toHaveBeenCalled();
      expect(formDataSpy).not.toHaveBeenCalled();
      expect(deps.loadCertification).not.toHaveBeenCalled();
      expect(deps.commitBatch).not.toHaveBeenCalled();
    }
  });

  it('enforces 413 on oversized Content-Length and cancels oversized streaming bodies early', async () => {
    const deps = makeImportDeps();

    const oversizedHeaderRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest(
        { certification_id: CERT_ID, csv: 'email,key_code\na@lpunetwork.edu.ph,GMX-1' },
        { contentLength: String(MAX_BODY_BYTES + 1) }
      ),
      deps
    );
    expect(oversizedHeaderRes.status).toBe(413);

    const cancelSpy = jest.fn();
    let chunksEmitted = 0;
    const chunkSize = 512 * 1024;
    const oversizedStream = new NativeReadableStream<Uint8Array>({
      pull(controller) {
        chunksEmitted += 1;
        if (chunksEmitted <= 8) {
          controller.enqueue(new Uint8Array(chunkSize));
        } else {
          controller.close();
        }
      },
      cancel: cancelSpy,
    });

    const streamingReq = new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${makeValidToken(ADMIN_ID)}`,
        'Content-Type': 'application/json',
      },
      body: oversizedStream,
      duplex: 'half',
    } as RequestInit);

    const streamingRes = await handleImportGMetrixKeysRequest(streamingReq, deps);
    expect(streamingRes.status).toBe(413);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(chunksEmitted).toBeLessThan(8);
    expect(deps.loadCertification).not.toHaveBeenCalled();
  });

  it('validates content-type, payload shape, UUID, certification status, CSV errors, and missing secrets', async () => {
    const deps = makeImportDeps();

    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({}, { contentType: 'text/plain', rawBody: 'hello' }),
          deps
        )
      ).status
    ).toBe(400);

    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({}, { rawBody: '{invalid-json' }),
          deps
        )
      ).status
    ).toBe(400);

    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({ certification_id: 'bad-uuid', csv: 'email,key_code\na@b,1' }),
          deps
        )
      ).status
    ).toBe(400);

    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({ certification_id: CERT_ID, csv: 'foo,bar\n1,2' }),
          deps
        )
      ).status
    ).toBe(400);

    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({ certification_id: CERT_ID, csv: 'email,key_code\n' }),
          deps
        )
      ).status
    ).toBe(400);

    const inactiveCertDeps = makeImportDeps({
      loadCertification: jest.fn().mockResolvedValue({ id: CERT_ID, isActive: false }),
    });
    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({
            certification_id: CERT_ID,
            csv: 'email,key_code\na@lpunetwork.edu.ph,GMX-1',
          }),
          inactiveCertDeps
        )
      ).status
    ).toBe(404);

    const missingCertDeps = makeImportDeps({
      loadCertification: jest.fn().mockResolvedValue(null),
    });
    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({
            certification_id: CERT_ID,
            csv: 'email,key_code\na@lpunetwork.edu.ph,GMX-1',
          }),
          missingCertDeps
        )
      ).status
    ).toBe(404);

    const noSecretsDeps = makeImportDeps({
      loadCryptoSecrets: jest.fn().mockResolvedValue(null),
    });
    expect(
      (
        await handleImportGMetrixKeysRequest(
          makeJsonImportRequest({
            certification_id: CERT_ID,
            csv: 'email,key_code\na@lpunetwork.edu.ph,GMX-1',
          }),
          noSecretsDeps
        )
      ).status
    ).toBe(500);
  });

  it('commits mixed multipart & JSON batches idempotently, encrypts keys, sanitizes formulas, and leaks zero raw keys', async () => {
    const blindA = await edgeComputeEmailBlindIndex('student.a@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const blindB = await edgeComputeEmailBlindIndex('student.b@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const existingDbHash = await computeKeyCodeHash('GMX-EXISTING-0001', TEST_BLIND_PEPPER);

    const committedStore = new Set<string>([existingDbHash]);
    const capturedCommitCalls: CommitGMetrixKeyBatchInput[] = [];
    const capturedPushMessages: ExpoPushMessage[] = [];

    const deps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockImplementation(async (indexes: readonly string[]) => {
        const matches = [];
        if (indexes.includes(blindA)) {
          matches.push({ id: STUDENT_A_ID, emailBlindIndex: blindA });
        }
        if (indexes.includes(blindB)) {
          matches.push({ id: STUDENT_B_ID, emailBlindIndex: blindB });
        }
        return matches;
      }),
      commitBatch: jest.fn().mockImplementation(async (input: CommitGMetrixKeyBatchInput) => {
        capturedCommitCalls.push(input);
        const committedHashes: string[] = [];
        const notifiedProfileIds: string[] = [];
        for (const entry of input.entries) {
          if (!committedStore.has(entry.key_code_hash)) {
            committedStore.add(entry.key_code_hash);
            committedHashes.push(entry.key_code_hash);
            notifiedProfileIds.push(entry.student_profile_id);
          }
        }
        return {
          batchId: BATCH_ID,
          assignedCount: committedHashes.length,
          rejectedCount: input.totalRows - committedHashes.length,
          committedHashes,
          notifiedProfileIds,
        };
      }),
      loadPushTokens: jest.fn().mockResolvedValue([
        'ExponentPushToken[StudentAToken0001]',
        'ExponentPushToken[StudentAToken0001]',
        'not-a-valid-token',
      ]),
      sendExpoPushBatch: jest.fn().mockImplementation(async (chunk: readonly ExpoPushMessage[]) => {
        capturedPushMessages.push(...chunk);
        return chunk.map((_, idx) => ({ status: 'ok' as const, id: `ok-${idx}` }));
      }),
    });

    const rawSecretKeyA = 'GMX-SECRET-ALPHA-7777';
    const rawCsv = [
      'Institutional Email,Access Code',
      `Student.A@LPUNetwork.edu.ph,${rawSecretKeyA}`,
      `=CMD|'/C calc'!A0,GMX-INJECT-0001`,
      'student.a@lpunetwork.edu.ph,   ',
      `student.a@lpunetwork.edu.ph,${'X'.repeat(129)}`,
      `student.b@lpunetwork.edu.ph,${rawSecretKeyA.toLowerCase()}`,
      'unregistered@lpunetwork.edu.ph,GMX-UNREG-0001',
      'student.b@lpunetwork.edu.ph,GMX-EXISTING-0001',
    ].join('\n');

    const firstRes = await handleImportGMetrixKeysRequest(
      makeMultipartImportRequest(rawCsv),
      deps
    );
    expect(firstRes.status).toBe(201);
    const firstRawText = await firstRes.text();
    const firstJson = ImportGMetrixKeysResponseSchema.parse(JSON.parse(firstRawText));

    expect(firstJson.totalRows).toBe(7);
    expect(firstJson.assignedCount).toBe(1);
    expect(firstJson.rejectedCount).toBe(6);
    expect(firstJson.pushNotificationsSent).toBe(1);
    expect(firstJson.pushNotificationsFailed).toBe(0);
    expect(firstJson.rejectedRows).toEqual([
      { rowNumber: 3, email: "=CMD|'/C calc'!A0", reason: 'invalid_email' },
      { rowNumber: 4, email: 'student.a@lpunetwork.edu.ph', reason: 'missing_key_code' },
      { rowNumber: 5, email: 'student.a@lpunetwork.edu.ph', reason: 'invalid_key_code' },
      { rowNumber: 6, email: 'student.b@lpunetwork.edu.ph', reason: 'duplicate_key_in_csv' },
      { rowNumber: 7, email: 'unregistered@lpunetwork.edu.ph', reason: 'unregistered_student' },
      { rowNumber: 8, email: 'student.b@lpunetwork.edu.ph', reason: 'duplicate_key_existing' },
    ]);
    expect(firstJson.rejectedRowsCsv).toContain("3,'=CMD|'/C calc'!A0,invalid_email");

    for (const secretKey of [rawSecretKeyA, 'GMX-INJECT-0001', 'GMX-UNREG-0001', 'GMX-EXISTING-0001']) {
      expect(firstRawText).not.toContain(secretKey);
      expect(JSON.stringify(capturedPushMessages)).not.toContain(secretKey);
    }

    expect(capturedCommitCalls).toHaveLength(1);
    expect(capturedCommitCalls[0].entries).toHaveLength(2);
    const committedEntry = capturedCommitCalls[0].entries[0];
    expect(committedEntry.student_profile_id).toBe(STUDENT_A_ID);
    expect(committedEntry.key_version).toBe(2);
    expect(committedEntry.key_code_hash).toBe(
      await computeKeyCodeHash(rawSecretKeyA, TEST_BLIND_PEPPER)
    );
    await expect(
      decryptKeyCode(committedEntry.key_code_enc_hex, { 1: TEST_KEY_V1, 2: TEST_KEY_V2 })
    ).resolves.toEqual({ plaintext: rawSecretKeyA, keyVersion: 2 });

    expect(capturedPushMessages).toEqual([
      {
        to: 'ExponentPushToken[StudentAToken0001]',
        sound: 'default',
        title: SHARED_PUSH_TITLE,
        body: SHARED_PUSH_BODY,
        data: {
          type: 'gmetrix_key',
          deepLink: SHARED_DEEP_LINK,
          certificationId: CERT_ID,
        },
      },
    ]);

    const secondRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({ certification_id: CERT_ID, csv: rawCsv }),
      deps
    );
    expect(secondRes.status).toBe(201);
    const secondJson = ImportGMetrixKeysResponseSchema.parse(await secondRes.json());
    expect(secondJson.assignedCount).toBe(0);
    expect(secondJson.rejectedCount).toBe(7);
    expect(secondJson.pushNotificationsSent).toBe(0);
    expect(secondJson.rejectedRows[0]).toEqual({
      rowNumber: 2,
      email: 'student.a@lpunetwork.edu.ph',
      reason: 'duplicate_key_existing',
    });
    expect(capturedPushMessages).toHaveLength(1);
  });

  it('chunks Expo Push batches at 100 messages, prunes DeviceNotRegistered tokens, and stays resilient to push outages', async () => {
    const blindA = await edgeComputeEmailBlindIndex('student.a@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const tokens: string[] = [];
    for (let i = 0; i < 125; i += 1) {
      tokens.push(`ExponentPushToken[BatchToken_${String(i).padStart(4, '0')}]`);
    }

    const chunkSizes: number[] = [];
    const deletedTokenBatches: string[][] = [];

    const deps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
      ]),
      loadPushTokens: jest.fn().mockResolvedValue(tokens),
      sendExpoPushBatch: jest.fn().mockImplementation(async (chunk: readonly ExpoPushMessage[]) => {
        chunkSizes.push(chunk.length);
        return chunk.map((msg, index) => {
          if (msg.to === tokens[5] || msg.to === tokens[110]) {
            return {
              status: 'error' as const,
              message: 'Device not registered',
              details: { error: 'DeviceNotRegistered' },
            };
          }
          if (index === 0 && chunk.length === 25) {
            return {
              status: 'error' as const,
              message: 'MessageRateExceeded',
              details: { error: 'MessageRateExceeded' },
            };
          }
          return { status: 'ok' as const, id: `ticket-${index}` };
        });
      }),
      deletePushTokens: jest.fn().mockImplementation(async (dead: readonly string[]) => {
        deletedTokenBatches.push([...dead]);
      }),
    });

    const res = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-CHUNK-125',
      }),
      deps
    );
    expect(res.status).toBe(201);
    const body = ImportGMetrixKeysResponseSchema.parse(await res.json());
    expect(chunkSizes).toEqual([100, 25]);
    expect(body.pushNotificationsSent).toBe(122);
    expect(body.pushNotificationsFailed).toBe(3);
    expect(deletedTokenBatches).toEqual([[tokens[5], tokens[110]]]);

    const outageDeps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
      ]),
      loadPushTokens: jest.fn().mockResolvedValue(tokens.slice(0, 3)),
      sendExpoPushBatch: jest.fn().mockRejectedValue(new Error('Expo 503 outage')),
    });

    const outageRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-OUTAGE-001',
      }),
      outageDeps
    );
    expect(outageRes.status).toBe(201);
    const outageBody = ImportGMetrixKeysResponseSchema.parse(await outageRes.json());
    expect(outageBody.assignedCount).toBe(1);
    expect(outageBody.pushNotificationsSent).toBe(0);
    expect(outageBody.pushNotificationsFailed).toBe(3);

    const deleteFailSpy = jest.fn().mockRejectedValue(new Error('DB transient error'));
    const pruneFailureDeps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
      ]),
      loadPushTokens: jest.fn().mockResolvedValue([tokens[0]]),
      sendExpoPushBatch: jest.fn().mockResolvedValue([
        {
          status: 'error' as const,
          message: 'Device not registered',
          details: { error: 'DeviceNotRegistered' },
        },
      ]),
      deletePushTokens: deleteFailSpy,
    });
    const pruneFailureRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-PRUNE-FAIL-001',
      }),
      pruneFailureDeps
    );
    expect(pruneFailureRes.status).toBe(201);
    expect(deleteFailSpy).toHaveBeenCalledWith([tokens[0]], {
      timeoutMs: expect.any(Number),
    });
    const pruneFailureBody = ImportGMetrixKeysResponseSchema.parse(await pruneFailureRes.json());
    expect(pruneFailureBody.assignedCount).toBe(1);
    expect(pruneFailureBody.pushNotificationsSent).toBe(0);
    expect(pruneFailureBody.pushNotificationsFailed).toBe(1);
  });

  it('maps missingProfileHashes to unregistered_student, accounts loadPushTokens failures, and sanitizes control-char formula cells in rejectedRowsCsv', async () => {
    const blindA = await edgeComputeEmailBlindIndex('student.a@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const blindB = await edgeComputeEmailBlindIndex('student.b@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const hashA = await computeKeyCodeHash('GMX-SOFT-DELETED-A', TEST_BLIND_PEPPER);

    const raceDeps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
        { id: STUDENT_B_ID, emailBlindIndex: blindB },
      ]),
      commitBatch: jest.fn().mockResolvedValue({
        batchId: BATCH_ID,
        assignedCount: 0,
        rejectedCount: 3,
        committedHashes: [],
        missingProfileHashes: [hashA],
        notifiedProfileIds: [],
      }),
    });

    const raceRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: [
          'email,key_code',
          'student.a@lpunetwork.edu.ph,GMX-SOFT-DELETED-A',
          'student.b@lpunetwork.edu.ph,GMX-ALREADY-EXISTS-B',
          "\x00=CMD|'/C calc'!A0,GMX-CTRL-BYPASS",
        ].join('\n'),
      }),
      raceDeps
    );
    expect(raceRes.status).toBe(201);
    const raceBody = ImportGMetrixKeysResponseSchema.parse(await raceRes.json());
    expect(raceBody.rejectedRows).toEqual([
      { rowNumber: 2, email: 'student.a@lpunetwork.edu.ph', reason: 'unregistered_student' },
      { rowNumber: 3, email: 'student.b@lpunetwork.edu.ph', reason: 'duplicate_key_existing' },
      { rowNumber: 4, email: "\x00=CMD|'/C calc'!A0", reason: 'invalid_email' },
    ]);
    expect(raceBody.rejectedRowsCsv).toContain("4,'=CMD|'/C calc'!A0,invalid_email");
    expect(raceBody.rejectedRowsCsv).not.toContain('\x00');

    const loadTokensFailDeps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
        { id: STUDENT_B_ID, emailBlindIndex: blindB },
      ]),
      loadPushTokens: jest.fn().mockRejectedValue(new Error('push_tokens RPC timeout')),
    });
    const loadTokensFailRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: [
          'email,key_code',
          'student.a@lpunetwork.edu.ph,GMX-LOAD-FAIL-1',
          'student.b@lpunetwork.edu.ph,GMX-LOAD-FAIL-2',
        ].join('\n'),
      }),
      loadTokensFailDeps
    );
    expect(loadTokensFailRes.status).toBe(201);
    const loadTokensFailBody = ImportGMetrixKeysResponseSchema.parse(
      await loadTokensFailRes.json()
    );
    expect(loadTokensFailBody.assignedCount).toBe(2);
    expect(loadTokensFailBody.pushNotificationsSent).toBe(0);
    expect(loadTokensFailBody.pushNotificationsFailed).toBe(2);
  });

  it('bounds Expo Push concurrency to 4 in-flight chunks and fails unsent chunks cleanly once shared push budget expires', async () => {
    const blindA = await edgeComputeEmailBlindIndex('student.a@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const tokens: string[] = [];
    for (let i = 0; i < 650; i += 1) {
      tokens.push(`ExponentPushToken[ConcToken_${String(i).padStart(4, '0')}]`);
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const concDeps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
      ]),
      loadPushTokens: jest.fn().mockResolvedValue(tokens),
      sendExpoPushBatch: jest.fn().mockImplementation(async (chunk: readonly ExpoPushMessage[]) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return chunk.map((_, idx) => ({ status: 'ok' as const, id: `ok-${idx}` }));
      }),
    });

    const concRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-CONC-650',
      }),
      concDeps
    );
    expect(concRes.status).toBe(201);
    const concBody = ImportGMetrixKeysResponseSchema.parse(await concRes.json());
    expect(maxInFlight).toBe(4);
    expect(concBody.pushNotificationsSent).toBe(650);
    expect(concBody.pushNotificationsFailed).toBe(0);

    let currentTimeMs = 1_000;
    const observedTimeouts: number[] = [];
    const budgetSendSpy = jest
      .fn()
      .mockImplementation(
        async (chunk: readonly ExpoPushMessage[], opts?: { timeoutMs?: number }) => {
          if (opts?.timeoutMs !== undefined) {
            observedTimeouts.push(opts.timeoutMs);
          }
          await Promise.resolve();
          currentTimeMs += 2_500;
          return chunk.map((_, idx) => ({ status: 'ok' as const, id: `budget-${idx}` }));
        }
      );

    const budgetDeps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
      ]),
      loadPushTokens: jest.fn().mockResolvedValue(tokens),
      sendExpoPushBatch: budgetSendSpy,
      pushBudgetMs: 8_000,
      nowMs: () => currentTimeMs,
    });

    const budgetRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-BUDGET-650',
      }),
      budgetDeps
    );
    expect(budgetRes.status).toBe(201);
    const budgetBody = ImportGMetrixKeysResponseSchema.parse(await budgetRes.json());
    expect(budgetSendSpy).toHaveBeenCalledTimes(4);
    expect(observedTimeouts).toHaveLength(4);
    expect(observedTimeouts.every((t) => t > 0 && t <= 8_000)).toBe(true);
    expect(budgetBody.pushNotificationsSent).toBe(400);
    expect(budgetBody.pushNotificationsFailed).toBe(250);

    const hungLookupRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-HUNG-LOOKUP',
      }),
      makeImportDeps({
        lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
          { id: STUDENT_A_ID, emailBlindIndex: blindA },
        ]),
        loadPushTokens: jest.fn().mockImplementation(() => new Promise<string[]>(() => {})),
        pushBudgetMs: 25,
      })
    );
    expect(hungLookupRes.status).toBe(201);
    const hungLookupBody = ImportGMetrixKeysResponseSchema.parse(await hungLookupRes.json());
    expect(hungLookupBody.assignedCount).toBe(1);
    expect(hungLookupBody.pushNotificationsSent).toBe(0);
    expect(hungLookupBody.pushNotificationsFailed).toBe(1);

    const hungPruneRes = await handleImportGMetrixKeysRequest(
      makeJsonImportRequest({
        certification_id: CERT_ID,
        csv: 'email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-HUNG-PRUNE',
      }),
      makeImportDeps({
        lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
          { id: STUDENT_A_ID, emailBlindIndex: blindA },
        ]),
        loadPushTokens: jest.fn().mockResolvedValue(['ExponentPushToken[DeadHung0001]']),
        sendExpoPushBatch: jest.fn().mockResolvedValue([
          { status: 'error', details: { error: 'DeviceNotRegistered' } },
        ]),
        deletePushTokens: jest.fn().mockImplementation(() => new Promise<void>(() => {})),
        pushBudgetMs: 30,
      })
    );
    expect(hungPruneRes.status).toBe(201);
    const hungPruneBody = ImportGMetrixKeysResponseSchema.parse(await hungPruneRes.json());
    expect(hungPruneBody.assignedCount).toBe(1);
    expect(hungPruneBody.pushNotificationsFailed).toBe(1);
  });

  it('supports non-/auth/v1 expectedJwtIssuer overrides verbatim and returns 413 promptly without awaiting stream cancel', async () => {
    const customIssuer = 'https://auth.myccs.example/custom-issuer';
    const customToken = makeTestJwt({
      aud: 'authenticated',
      iss: customIssuer,
      sub: STUDENT_A_ID,
      exp: NOW_SECONDS + 3600,
    });
    expect(
      validateJwtClaims(customToken, customIssuer, NOW_SECONDS, { exactIssuer: true })
    ).toEqual({ ok: true, sub: STUDENT_A_ID });

    const customIssuerRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({
        origin: null,
        authorization: `Bearer ${customToken}`,
      }),
      makeMyKeysDeps({
        expectedJwtIssuer: customIssuer,
        loadOwnEncryptedKeys: jest.fn().mockResolvedValue([]),
      })
    );
    expect(customIssuerRes.status).toBe(200);

    const cancelInvoked = jest.fn(() => new Promise<void>(() => {}));
    const stallingStream = new NativeReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32));
        controller.enqueue(new Uint8Array(32));
      },
      cancel: cancelInvoked,
    });
    const limited = await readStreamWithLimit(
      stallingStream,
      16,
      'Payload too large.',
      'Malformed body.'
    );
    expect(limited).toEqual({
      ok: false,
      status: 413,
      message: 'Payload too large.',
    });
    expect(cancelInvoked).toHaveBeenCalledTimes(1);
  });

  it('parses a real streamed multipart/form-data Request through ReadableStream + readStreamWithLimit', async () => {
    const blindA = await edgeComputeEmailBlindIndex('student.a@lpunetwork.edu.ph', TEST_BLIND_PEPPER);
    const form = new FormData();
    form.append('certification_id', CERT_ID);
    form.append(
      'file',
      new Blob([new TextEncoder().encode('email,key_code\nstudent.a@lpunetwork.edu.ph,GMX-STREAM-01')], {
        type: 'text/csv',
      }),
      'keys.csv'
    );

    const serialized = new Response(form);
    const realContentType = serialized.headers.get('content-type') ?? '';
    const rawBytes = new Uint8Array(await serialized.arrayBuffer());

    const bodyStream = new NativeReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(0));
        controller.enqueue(rawBytes.subarray(0, 48));
        controller.enqueue(rawBytes.subarray(48));
        controller.close();
      },
    });

    const streamReq = new Request(`${SUPABASE_URL}/functions/v1/import-gmetrix-keys`, {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${makeValidToken(ADMIN_ID)}`,
        'Content-Type': realContentType,
      },
      body: bodyStream,
      duplex: 'half',
    } as RequestInit);

    const deps = makeImportDeps({
      lookupProfilesByBlindIndexes: jest.fn().mockResolvedValue([
        { id: STUDENT_A_ID, emailBlindIndex: blindA },
      ]),
    });

    const res = await handleImportGMetrixKeysRequest(streamReq, deps);
    expect(res.status).toBe(201);
    const body = ImportGMetrixKeysResponseSchema.parse(await res.json());
    expect(body.totalRows).toBe(1);
    expect(body.assignedCount).toBe(1);
    expect(body.rejectedCount).toBe(0);
  });

  it('exercises createImportSecretsResolver (selective Vault + 60s cache), createRpcDatabaseAdapter, and parseExpoPushTickets', async () => {
    let now = 10_000;
    const fetchVaultSecrets = jest.fn().mockResolvedValue({
      emailBlindPepper: TEST_BLIND_PEPPER,
      certKeyEncryptionKey: null,
    });
    const prodEnv: Record<string, string | undefined> = {
      CERT_KEY_RING_JSON: JSON.stringify({ '1': TEST_KEY_V1, '2': TEST_KEY_V2 }),
    };

    const prodResolver = createImportSecretsResolver({
      readEnv: (k) => prodEnv[k],
      fetchVaultSecrets,
      cacheTtlMs: 60_000,
      nowMs: () => now,
    });

    const first = await prodResolver();
    expect(first).toEqual({
      emailBlindPepper: TEST_BLIND_PEPPER,
      activeVersion: 2,
      keyRing: { 1: TEST_KEY_V1, 2: TEST_KEY_V2 },
    });
    expect(fetchVaultSecrets).toHaveBeenCalledTimes(1);
    expect(fetchVaultSecrets).toHaveBeenCalledWith({
      p_include_blind_pepper: true,
      p_include_cert_key: false,
    });

    now += 30_000;
    expect(await prodResolver()).toEqual(first);
    expect(fetchVaultSecrets).toHaveBeenCalledTimes(1);

    now += 31_000;
    expect(await prodResolver()).toEqual(first);
    expect(fetchVaultSecrets).toHaveBeenCalledTimes(2);

    const badEnvVaultSpy = jest.fn();
    const badResolver = createImportSecretsResolver({
      readEnv: (k) => (k === 'CERT_KEY_RING_JSON' ? '{invalid' : undefined),
      fetchVaultSecrets: badEnvVaultSpy,
    });
    await expect(badResolver()).resolves.toBeNull();
    expect(badEnvVaultSpy).not.toHaveBeenCalled();

    const rpcSpy = jest.fn().mockImplementation(async (fn: string, params?: Record<string, unknown>) => {
      if (fn === 'lookup_active_profiles_by_blind_indexes') {
        const list = (params?.p_blind_indexes as string[]) ?? [];
        return {
          data: list.slice(0, 1).map((idx) => ({ id: STUDENT_A_ID, email_blind_index: idx })),
          error: null,
        };
      }
      if (fn === 'load_push_tokens_for_profiles') {
        return { data: [{ expo_push_token: 'ExponentPushToken[RpcToken0001]' }], error: null };
      }
      if (fn === 'delete_push_tokens_by_values') {
        return { data: 1, error: null };
      }
      if (fn === 'commit_gmetrix_key_batch') {
        return {
          data: {
            batchId: BATCH_ID,
            assignedCount: 1,
            rejectedCount: 1,
            committedHashes: ['hash-ok'],
            missingProfileHashes: ['hash-deleted'],
            notifiedProfileIds: [STUDENT_A_ID],
          },
          error: null,
        };
      }
      return { data: null, error: { message: 'unknown rpc' } };
    });

    const adapter = createRpcDatabaseAdapter({ rpc: rpcSpy });
    const manyIndexes = Array.from({ length: 505 }, (_, i) => `idx_${i}`);
    const lookedUp = await adapter.lookupProfilesByBlindIndexes(manyIndexes);
    expect(lookedUp).toHaveLength(2);
    expect(
      rpcSpy.mock.calls.filter(([fn]) => fn === 'lookup_active_profiles_by_blind_indexes')
    ).toHaveLength(2);

    await expect(adapter.loadPushTokens([STUDENT_A_ID])).resolves.toEqual([
      'ExponentPushToken[RpcToken0001]',
    ]);
    await expect(adapter.deletePushTokens(['ExponentPushToken[RpcToken0001]'])).resolves.toBeUndefined();

    const allPagedTokens = Array.from(
      { length: 5 },
      (_, idx) => `ExponentPushToken[PagedToken000${idx}]`
    );
    const observedRanges: Array<[number, number]> = [];
    let abortSignalSeen = false;
    const pagedAdapter = createRpcDatabaseAdapter({
      rpc: (fn) => {
        if (fn === 'load_push_tokens_for_profiles') {
          let rangeStart = 0;
          const builder = {
            order: () => builder,
            range: (from: number, to: number) => {
              rangeStart = from;
              observedRanges.push([from, to]);
              return builder;
            },
            abortSignal: (signal: AbortSignal) => {
              abortSignalSeen = signal instanceof AbortSignal;
              return builder;
            },
            then: (onfulfilled, onrejected) => {
              const cappedPage = allPagedTokens
                .slice(rangeStart, rangeStart + 2)
                .map((expo_push_token) => ({ expo_push_token }));
              return Promise.resolve({
                data: cappedPage,
                error: null,
                count: allPagedTokens.length,
              }).then(onfulfilled, onrejected);
            },
          } as PromiseLike<{ data: unknown; error: null; count: number }> & {
            order: () => unknown;
            range: (from: number, to: number) => unknown;
            abortSignal: (signal: AbortSignal) => unknown;
          };
          return builder;
        }
        return Promise.resolve({ data: null, error: null });
      },
    });
    await expect(
      pagedAdapter.loadPushTokens([STUDENT_A_ID], { timeoutMs: 2_000 })
    ).resolves.toEqual(allPagedTokens);
    expect(observedRanges).toEqual([
      [0, 999],
      [2, 1001],
      [4, 1003],
    ]);
    expect(abortSignalSeen).toBe(true);
    const committed = await adapter.commitBatch({
      certificationId: CERT_ID,
      uploadedByAdminId: ADMIN_ID,
      totalRows: 2,
      entries: [],
      notificationTitle: SHARED_PUSH_TITLE,
      notificationBody: SHARED_PUSH_BODY,
      deepLink: SHARED_DEEP_LINK,
    });
    expect(committed.missingProfileHashes).toEqual(['hash-deleted']);

    expect(
      parseExpoPushTickets({
        data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
          'corrupt-entry',
        ],
      })
    ).toEqual([
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', message: 'Malformed Expo push ticket.' },
    ]);
    expect(() => parseExpoPushTickets({ data: 'not-array' })).toThrow(
      'Unexpected Expo Push API response shape.'
    );
  });
});

describe('spec-05 supabase/functions/my-certification-keys/core.ts HTTP handler', () => {
  it('handles CORS preflight, disallowed Origin 403, omitted Origin mobile calls, GET-only 405, 401, and 403 inactive profile', async () => {
    const deps = makeMyKeysDeps();

    const okOptions = await handleMyCertificationKeysRequest(
      new Request(`${SUPABASE_URL}/functions/v1/my-certification-keys`, {
        method: 'OPTIONS',
        headers: { Origin: ALLOWED_ORIGIN },
      }),
      deps
    );
    expect(okOptions.status).toBe(204);
    expect(okOptions.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);

    const badOptions = await handleMyCertificationKeysRequest(
      new Request(`${SUPABASE_URL}/functions/v1/my-certification-keys`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.com' },
      }),
      deps
    );
    expect(badOptions.status).toBe(403);

    const badOriginGet = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ origin: 'https://evil.example.com' }),
      deps
    );
    expect(badOriginGet.status).toBe(403);

    const postRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ method: 'POST', origin: ALLOWED_ORIGIN }),
      deps
    );
    expect(postRes.status).toBe(405);
    expect(postRes.headers.get('Allow')).toBe('GET, OPTIONS');

    const unauthRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ authorization: null }),
      deps
    );
    expect(unauthRes.status).toBe(401);

    const mismatchRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ authorization: `Bearer ${makeValidToken(STUDENT_B_ID)}` }),
      deps
    );
    expect(mismatchRes.status).toBe(401);

    const inactiveDeps = makeMyKeysDeps({
      loadCallerProfile: jest.fn().mockResolvedValue({ active: false }),
    });
    const inactiveRes = await handleMyCertificationKeysRequest(makeMyKeysRequest(), inactiveDeps);
    expect(inactiveRes.status).toBe(403);
    expect(inactiveDeps.loadOwnEncryptedKeys).not.toHaveBeenCalled();
  });

  it('returns caller-scoped decrypted keys across key versions with Cache-Control: no-store', async () => {
    const encV1 = await encryptKeyCode('GMX-STUDENT-V1-1111', TEST_KEY_V1, 1);
    const encV2 = await encryptKeyCode('GMX-STUDENT-V2-2222', TEST_KEY_V2, 2);

    const rows: EncryptedCertificationKeyRow[] = [
      {
        id: KEY_ROW_2_ID,
        batchId: BATCH_ID,
        certificationId: CERT_ID,
        certificationTitle: 'CompTIA Security+',
        certificationProvider: 'CompTIA',
        keyCodeEnc: encV2.byteaHex,
        keyVersion: 2,
        assignedAt: '2026-11-28T03:00:00.000Z',
        viewedAt: null,
      },
      {
        id: KEY_ROW_1_ID,
        batchId: BATCH_ID,
        certificationId: CERT_ID,
        certificationTitle: 'Cisco CCNA Practice',
        certificationProvider: 'Cisco',
        keyCodeEnc: encV1.byteaHex,
        keyVersion: 1,
        assignedAt: '2026-11-27T01:00:00.000Z',
        viewedAt: '2026-11-27T05:00:00.000Z',
      },
    ];

    const deps = makeMyKeysDeps({
      loadOwnEncryptedKeys: jest.fn().mockResolvedValue(rows),
    });

    const res = await handleMyCertificationKeysRequest(makeMyKeysRequest({ origin: null }), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(deps.loadOwnEncryptedKeys).toHaveBeenCalledWith(STUDENT_A_ID);

    const body = (await res.json()) as { keys: unknown[] };
    expect(body.keys).toHaveLength(2);
    const parsedKeys = body.keys.map((item) => DecryptedCertificationKeySchema.parse(item));
    expect(parsedKeys[0].keyCode).toBe('GMX-STUDENT-V2-2222');
    expect(parsedKeys[0].keyVersion).toBe(2);
    expect(parsedKeys[1].keyCode).toBe('GMX-STUDENT-V1-1111');
    expect(parsedKeys[1].keyVersion).toBe(1);
  });

  it('fails closed with 500 without leaking ciphertext or secrets when key_version mismatches or decryption fails', async () => {
    const encV2 = await encryptKeyCode('GMX-SECRET-LEAK-CHECK', TEST_KEY_V2, 2);

    const versionMismatchRow: EncryptedCertificationKeyRow = {
      id: KEY_ROW_1_ID,
      batchId: BATCH_ID,
      certificationId: CERT_ID,
      certificationTitle: 'CompTIA Security+',
      certificationProvider: 'CompTIA',
      keyCodeEnc: encV2.byteaHex,
      keyVersion: 1,
      assignedAt: '2026-11-28T03:00:00.000Z',
      viewedAt: null,
    };

    const mismatchRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest(),
      makeMyKeysDeps({
        loadOwnEncryptedKeys: jest.fn().mockResolvedValue([versionMismatchRow]),
      })
    );
    expect(mismatchRes.status).toBe(500);
    const mismatchText = await mismatchRes.text();
    expect(mismatchText).not.toContain('GMX-SECRET-LEAK-CHECK');
    expect(mismatchText).not.toContain(encV2.byteaHex);
    expect(mismatchText).not.toContain(TEST_KEY_V2);

    const missingVersionRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest(),
      makeMyKeysDeps({
        loadKeyRing: jest.fn().mockResolvedValue({ 1: TEST_KEY_V1 }),
        loadOwnEncryptedKeys: jest.fn().mockResolvedValue([
          { ...versionMismatchRow, keyVersion: 2 },
        ]),
      })
    );
    expect(missingVersionRes.status).toBe(500);
    const missingText = await missingVersionRes.text();
    expect(missingText).not.toContain(encV2.byteaHex);
    expect(missingText).not.toContain(TEST_KEY_V1);

    const loadKeyRingForEmpty = jest.fn().mockRejectedValue(new Error('vault down'));
    const emptyNoRingRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ origin: null }),
      makeMyKeysDeps({
        loadOwnEncryptedKeys: jest.fn().mockResolvedValue([]),
        loadKeyRing: loadKeyRingForEmpty,
      })
    );
    expect(emptyNoRingRes.status).toBe(200);
    await expect(emptyNoRingRes.json()).resolves.toEqual({ keys: [] });
    expect(loadKeyRingForEmpty).not.toHaveBeenCalled();

    const nonEmptyNoRingRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ origin: null }),
      makeMyKeysDeps({
        loadOwnEncryptedKeys: jest.fn().mockResolvedValue([
          { ...versionMismatchRow, keyVersion: 2 },
        ]),
        loadKeyRing: jest.fn().mockResolvedValue(null),
      })
    );
    expect(nonEmptyNoRingRes.status).toBe(500);
  });

  it('caches Vault cert key selectively for 60s, invalidates on unknown keyVersion during rotation, and maps PostgREST rows', async () => {
    let now = 50_000;
    const fetchVaultSecrets = jest
      .fn()
      .mockResolvedValueOnce({ certKeyEncryptionKey: TEST_KEY_V1 })
      .mockResolvedValueOnce({ certKeyEncryptionKey: TEST_KEY_V2 });

    const ringResolver = createMyKeysRingResolver({
      readEnv: () => undefined,
      fetchVaultSecrets,
      cacheTtlMs: 60_000,
      nowMs: () => now,
    });

    await expect(ringResolver()).resolves.toEqual({ 1: TEST_KEY_V1 });
    expect(fetchVaultSecrets).toHaveBeenCalledTimes(1);
    expect(fetchVaultSecrets).toHaveBeenCalledWith({
      p_include_blind_pepper: false,
      p_include_cert_key: true,
    });

    now += 20_000;
    await expect(ringResolver({ requiredVersions: [1] })).resolves.toEqual({ 1: TEST_KEY_V1 });
    expect(fetchVaultSecrets).toHaveBeenCalledTimes(1);

    await expect(ringResolver({ requiredVersions: [2] })).resolves.toEqual({ 1: TEST_KEY_V2 });
    expect(fetchVaultSecrets).toHaveBeenCalledTimes(2);

    const encV2 = await encryptKeyCode('GMX-ROTATED-KEY-V2', TEST_KEY_V2, 2);
    const loadKeyRing = jest
      .fn()
      .mockResolvedValueOnce({ 1: TEST_KEY_V1 })
      .mockResolvedValueOnce({ 1: TEST_KEY_V1, 2: TEST_KEY_V2 });

    const rotatedRes = await handleMyCertificationKeysRequest(
      makeMyKeysRequest({ origin: null }),
      makeMyKeysDeps({
        loadKeyRing,
        loadOwnEncryptedKeys: jest.fn().mockResolvedValue([
          {
            id: KEY_ROW_2_ID,
            batchId: BATCH_ID,
            certificationId: CERT_ID,
            certificationTitle: 'CompTIA Security+',
            certificationProvider: 'CompTIA',
            keyCodeEnc: encV2.byteaHex,
            keyVersion: 2,
            assignedAt: '2026-11-28T03:00:00.000Z',
            viewedAt: null,
          },
        ]),
      })
    );
    expect(rotatedRes.status).toBe(200);
    expect(loadKeyRing).toHaveBeenCalledTimes(2);
    expect(loadKeyRing).toHaveBeenNthCalledWith(2, {
      forceRefresh: true,
      requiredVersions: [2],
    });
    const rotatedBody = (await rotatedRes.json()) as { keys: Array<{ keyCode: string }> };
    expect(rotatedBody.keys[0].keyCode).toBe('GMX-ROTATED-KEY-V2');

    expect(
      mapPostgrestCertificationKeyRow({
        id: KEY_ROW_1_ID,
        batch_id: BATCH_ID,
        certification_id: CERT_ID,
        key_code_enc: encV2.byteaHex,
        key_version: 2,
        assigned_at: '2026-11-28T03:00:00.000Z',
        viewed_at: null,
        certifications: [{ title: 'Cisco CCNA', provider: 'Cisco' }],
      })
    ).toEqual({
      id: KEY_ROW_1_ID,
      batchId: BATCH_ID,
      certificationId: CERT_ID,
      certificationTitle: 'Cisco CCNA',
      certificationProvider: 'Cisco',
      keyCodeEnc: encV2.byteaHex,
      keyVersion: 2,
      assignedAt: '2026-11-28T03:00:00.000Z',
      viewedAt: null,
    });
    expect(() => mapPostgrestCertificationKeyRow({ id: KEY_ROW_1_ID })).toThrow(
      'Unexpected certification_keys query row.'
    );

    let resolveStaleVault!: (val: { certKeyEncryptionKey: string }) => void;
    let resolveFreshVault!: (val: { certKeyEncryptionKey: string }) => void;
    const racingVaultSpy = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ certKeyEncryptionKey: string }>((resolve) => {
            resolveStaleVault = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<{ certKeyEncryptionKey: string }>((resolve) => {
            resolveFreshVault = resolve;
          })
      );
    const racingResolver = createMyKeysRingResolver({
      readEnv: () => undefined,
      fetchVaultSecrets: racingVaultSpy,
      cacheTtlMs: 60_000,
      nowMs: () => now,
    });
    const stalePromise = racingResolver({ forceRefresh: true });
    const freshPromise = racingResolver({ forceRefresh: true });
    resolveFreshVault({ certKeyEncryptionKey: TEST_KEY_V2 });
    await expect(freshPromise).resolves.toEqual({ 1: TEST_KEY_V2 });
    resolveStaleVault({ certKeyEncryptionKey: TEST_KEY_V1 });
    await expect(stalePromise).resolves.toEqual({ 1: TEST_KEY_V1 });
    await expect(racingResolver()).resolves.toEqual({ 1: TEST_KEY_V2 });
    expect(racingVaultSpy).toHaveBeenCalledTimes(2);

    const makeRawRow = (id: string) => ({
      id,
      batch_id: BATCH_ID,
      certification_id: CERT_ID,
      key_code_enc: encV2.byteaHex,
      key_version: 2,
      assigned_at: '2026-11-28T03:00:00.000Z',
      viewed_at: null,
      certifications: [{ title: 'Cisco CCNA', provider: 'Cisco' }],
    });
    const pagedRawRows = [
      makeRawRow('10000000-0000-4000-8000-000000000001'),
      makeRawRow('10000000-0000-4000-8000-000000000002'),
      makeRawRow('10000000-0000-4000-8000-000000000003'),
    ];
    const fetchedWindows: Array<[number, number]> = [];
    const paginatedRows = await loadAllPaginatedCertificationKeyRows(async (from, to) => {
      fetchedWindows.push([from, to]);
      return {
        rows: pagedRawRows.slice(from, from + 2),
        count: pagedRawRows.length,
      };
    }, 2);
    expect(paginatedRows.map((row) => row.id)).toEqual(pagedRawRows.map((row) => row.id));
    expect(fetchedWindows).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

describe('spec-05 static SQL, config, Edge Function boundary, and Postman contracts', () => {
  const migrationSql = nodeFs.readFileSync(
    nodePath.join(
      REPO_ROOT,
      'supabase',
      'migrations',
      '20261128000001_spec05_gmetrix_csv_and_push.sql'
    ),
    'utf8'
  );
  const configToml = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'supabase', 'config.toml'),
    'utf8'
  );
  const rlsTestSql = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'tests', 'api', 'gmetrix-csv-push-rls.sql'),
    'utf8'
  );
  const postmanRaw = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'tests', 'api', 'import-gmetrix-keys.postman_collection.json'),
    'utf8'
  );

  it('verifies spec-05 SQL migration defines all 5 RLS-forced tables, guards, and RPCs', () => {
    for (const table of [
      'certifications',
      'certification_key_batches',
      'certification_keys',
      'notifications',
      'push_tokens',
    ]) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(migrationSql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`);
      expect(migrationSql).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated;`);
    }

    expect(migrationSql).toContain('ON CONFLICT (key_code_hash) DO NOTHING');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_gmetrix_runtime_secrets(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.lookup_active_profiles_by_blind_indexes(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.load_push_tokens_for_profiles(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.delete_push_tokens_by_values(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.commit_gmetrix_key_batch(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.register_push_token(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_pii_encryption_key_for_version(');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.list_admin_profiles()');
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.promote_faculty_by_email(');
  });

  it('verifies supabase/config.toml disables gateway JWT for explicit in-function verification and Edge Functions respect ESZip boundary', () => {
    expect(configToml).toMatch(/\[functions\.import-gmetrix-keys\]\r?\nverify_jwt = false/);
    expect(configToml).toMatch(/\[functions\.my-certification-keys\]\r?\nverify_jwt = false/);

    const edgeFiles = [
      nodePath.join(REPO_ROOT, 'supabase', 'functions', '_shared', 'gmetrix-csv.ts'),
      nodePath.join(REPO_ROOT, 'supabase', 'functions', 'import-gmetrix-keys', 'core.ts'),
      nodePath.join(REPO_ROOT, 'supabase', 'functions', 'import-gmetrix-keys', 'index.ts'),
      nodePath.join(REPO_ROOT, 'supabase', 'functions', 'my-certification-keys', 'core.ts'),
      nodePath.join(REPO_ROOT, 'supabase', 'functions', 'my-certification-keys', 'index.ts'),
    ];
    for (const filePath of edgeFiles) {
      const content = nodeFs.readFileSync(filePath, 'utf8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/\.\.\/shared/);
    }

    const importDenoJson = JSON.parse(
      nodeFs.readFileSync(
        nodePath.join(REPO_ROOT, 'supabase', 'functions', 'import-gmetrix-keys', 'deno.json'),
        'utf8'
      )
    ) as { imports: Record<string, string> };
    const myKeysDenoJson = JSON.parse(
      nodeFs.readFileSync(
        nodePath.join(REPO_ROOT, 'supabase', 'functions', 'my-certification-keys', 'deno.json'),
        'utf8'
      )
    ) as { imports: Record<string, string> };

    expect(importDenoJson.imports['@supabase/supabase-js']).toBe('npm:@supabase/supabase-js@2.119.2');
    expect(importDenoJson.imports['../_shared/gmetrix-csv']).toBe('../_shared/gmetrix-csv.ts');
    expect(myKeysDenoJson.imports['@supabase/supabase-js']).toBe('npm:@supabase/supabase-js@2.119.2');
    expect(myKeysDenoJson.imports['../_shared/gmetrix-crypto']).toBe('../_shared/gmetrix-crypto.ts');

    const importIndex = nodeFs.readFileSync(
      nodePath.join(REPO_ROOT, 'supabase', 'functions', 'import-gmetrix-keys', 'index.ts'),
      'utf8'
    );
    expect(importIndex).toContain('AbortSignal.timeout(timeoutMs)');
    expect(importIndex).toContain('EXPO_ACCESS_TOKEN');
    expect(importIndex).toContain('createRpcDatabaseAdapter');
    expect(importIndex).toContain('createImportSecretsResolver');
    expect(importIndex).toContain('parseExpoPushTickets');
    expect(importIndex).not.toContain('.in(');
  });

  it('verifies rolled-back gmetrix-csv-push-rls.sql covers tables, grants, guards, and RPCs', () => {
    expect(rlsTestSql).toMatch(/BEGIN;/);
    expect(rlsTestSql).toMatch(/ROLLBACK;\s*$/);
    for (const marker of [
      'relrowsecurity',
      'relforcerowsecurity',
      'guard_certification_keys_mutation',
      'guard_notifications_mutation',
      'guard_push_tokens_mutation',
      'get_gmetrix_runtime_secrets(boolean, boolean)',
      'lookup_active_profiles_by_blind_indexes(text[])',
      'load_push_tokens_for_profiles(uuid[])',
      'delete_push_tokens_by_values(text[])',
      'commit_gmetrix_key_batch(',
      'register_push_token(',
      'list_admin_profiles()',
      'promote_faculty_by_email(',
      'SET LOCAL ROLE service_role',
      'SET LOCAL ROLE authenticated',
      'SET LOCAL ROLE anon',
      'insufficient_privilege',
      'invalid_parameter_value',
      'no_data_found',
    ]) {
      expect(rlsTestSql).toContain(marker);
    }
  });

  it('validates import-gmetrix-keys Postman v2.1 collection structure, empty variables, zero secrets, and valid raw JSON bodies', () => {
    type PostmanItem = {
      name: string;
      request?: { body?: { mode?: string; raw?: string } };
      event?: Array<{ listen: string; script: { exec: string[] } }>;
    };
    const collection = JSON.parse(postmanRaw) as {
      info: { schema: string };
      variable: Array<{ key: string; value: string }>;
      item: Array<{ name: string; item: PostmanItem[] }>;
    };

    expect(collection.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    );
    for (const variable of collection.variable) {
      expect(variable.value).toBe('');
    }
    expect(postmanRaw).not.toMatch(/sb_secret_|eyJhbGciOi/);

    const requests = collection.item.flatMap((folder) => folder.item);
    for (const req of requests) {
      if (req.request?.body?.mode === 'raw' && typeof req.request.body.raw === 'string') {
        const substituted = req.request.body.raw
          .replace(/\{\{CERTIFICATION_ID\}\}/g, CERT_ID)
          .replace(/\{\{STUDENT_EMAIL\}\}/g, 'student.a@lpunetwork.edu.ph')
          .replace(/\{\{STUDENT_B_EMAIL\}\}/g, 'student.b@lpunetwork.edu.ph')
          .replace(/\{\{TEST_GMETRIX_KEY_CODE\}\}/g, 'GMX-TEST-0001')
          .replace(/\{\{RUN_GMETRIX_KEY_CODE\}\}/g, 'GMX-RUN-A-0001')
          .replace(/\{\{RUN_STUDENT_B_KEY_CODE\}\}/g, 'GMX-RUN-B-0001');
        expect(() => JSON.parse(substituted)).not.toThrow();
      }
    }

    const scripts = requests
      .map((r) => r.event?.find((e) => e.listen === 'test')?.script.exec.join('\n') ?? '')
      .join('\n');
    const preScripts = requests
      .map((r) => r.event?.find((e) => e.listen === 'prerequest')?.script.exec.join('\n') ?? '')
      .join('\n');

    for (const expectedStatus of ['403', '401', '400', '201', '200']) {
      expect(scripts).toContain(`have.status(${expectedStatus})`);
    }
    expect(preScripts).toContain('RUN_GMETRIX_KEY_CODE');
    expect(preScripts).toContain('RUN_STUDENT_B_KEY_CODE');
    expect(scripts).toContain('rejectedRowsCsv');
    expect(scripts).toContain("'=CMD|'/C calc'!A0");
    expect(scripts).toContain('duplicate_key_existing');
    expect(scripts).toContain('otherStudentKey');
    expect(scripts).toContain('no-store');
  });
});
