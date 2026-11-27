import {
  handleCorsPreflight,
  resolveCorsHeaders,
  withCorsJson,
} from '../_shared/cors';

export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MULTIPART_OVERHEAD_BYTES = 65536;
export const MAX_BODY_BYTES = MAX_MEDIA_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES;
export const MEDIA_STORAGE_BUCKET = 'org-media' as const;
export const ALLOWED_INPUT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const OUTPUT_IMAGE_MIME_TYPE = 'image/webp' as const;

export const MEDIA_VARIANT_LIMITS = {
  logo: { maxWidth: 512, maxHeight: 512, compress: 0.8 },
  cover: { maxWidth: 1600, maxHeight: 900, compress: 0.8 },
  flyer: { maxWidth: 1600, maxHeight: 1600, compress: 0.82 },
} as const;

export type MediaKind = keyof typeof MEDIA_VARIANT_LIMITS;
export type AllowedInputImageMime = (typeof ALLOWED_INPUT_IMAGE_MIME_TYPES)[number];

export interface CompressImageRuntimeEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  publishableKey: string;
  expectedJwtIssuer?: string;
}

export interface CompressImageAuthContext {
  profileRole: 'student' | 'officer' | 'admin' | null;
  profileActive: boolean;
  orgExists: boolean;
  orgActive: boolean;
  isApprovedOfficer: boolean;
}

export interface CompressImageDeps {
  supabaseUrl: string;
  expectedJwtIssuer?: string;
  allowedOrigins: readonly string[];
  verifyUser: (accessToken: string) => Promise<{ id: string; email?: string } | null>;
  loadAuthorizationContext: (
    userId: string,
    organizationId: string
  ) => Promise<CompressImageAuthContext>;
  processImage: (input: {
    bytes: Uint8Array;
    sourceMime: AllowedInputImageMime;
    kind: MediaKind;
    maxWidth: number;
    maxHeight: number;
    quality: number;
  }) => Promise<{ bytes: Uint8Array; width: number; height: number }>;
  uploadWebp: (input: {
    bucket: typeof MEDIA_STORAGE_BUCKET;
    path: string;
    bytes: Uint8Array;
    contentType: typeof OUTPUT_IMAGE_MIME_TYPE;
  }) => Promise<{ publicUrl: string }>;
  generateAssetId?: () => string;
  nowSeconds?: () => number;
}

export type JwtClaimValidationResult =
  | { ok: true; sub: string }
  | { ok: false; message: string };

type PayloadValidationResult =
  | { ok: true; mimeType: AllowedInputImageMime }
  | { ok: false; status: 400 | 413 | 415; message: string };

type BoundedBodyReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 413; message: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;
const BEARER_HEADER_REGEX = /^bearer\s+(\S+)$/i;

export function resolveRuntimeEnv(
  readEnv: (key: string) => string | undefined
): CompressImageRuntimeEnv | null {
  const supabaseUrl = readEnv('SUPABASE_URL')?.trim() || '';
  const serviceRoleKey =
    readEnv('SUPABASE_SECRET_KEY')?.trim() ||
    readEnv('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    '';

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const publishableKey =
    readEnv('SUPABASE_PUBLISHABLE_KEY')?.trim() ||
    readEnv('SUPABASE_ANON_KEY')?.trim() ||
    serviceRoleKey;
  const expectedJwtIssuer = readEnv('SUPABASE_JWT_ISSUER')?.trim() || undefined;

  return {
    supabaseUrl,
    serviceRoleKey,
    publishableKey,
    expectedJwtIssuer,
  };
}

export async function loadWasmBytes(
  wasmUrl: URL,
  deps: {
    readFile: (url: URL) => Promise<Uint8Array>;
    fetchFn: typeof fetch;
  }
): Promise<Uint8Array> {
  if (wasmUrl.protocol === 'file:') {
    return deps.readFile(wasmUrl);
  }

  const res = await deps.fetchFn(wasmUrl);
  if (!res.ok) {
    throw new Error(`Failed to load ImageMagick WASM (${res.status}).`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('Empty ImageMagick WASM binary.');
  }

  return bytes;
}

export function resolveExpectedJwtIssuer(
  supabaseUrl: string,
  configuredIssuer?: string | null
): string {
  const trimmedOverride = configuredIssuer?.trim().replace(/\/+$/, '') ?? '';
  if (trimmedOverride.length > 0) {
    return trimmedOverride;
  }
  return `${supabaseUrl.trim().replace(/\/+$/, '')}/auth/v1`;
}

function isMediaKind(value: string): value is MediaKind {
  return value === 'logo' || value === 'cover' || value === 'flyer';
}

function isAllowedInputMime(value: string): value is AllowedInputImageMime {
  return (
    value === 'image/jpeg' ||
    value === 'image/png' ||
    value === 'image/webp'
  );
}

function normalizeImageMime(rawMime: string | null | undefined): string | null {
  if (rawMime == null) {
    return null;
  }

  const [base = ''] = rawMime.split(';', 1);
  const normalized = base.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function detectImageMimeFromMagicBytes(
  bytes: Uint8Array
): AllowedInputImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    bytes.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((expected, index) => bytes[index] === expected)
  ) {
    return 'image/png';
  }

  if (
    bytes.length >= 16 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 &&
    bytes[12] === 0x56 &&
    bytes[13] === 0x50 &&
    bytes[14] === 0x38 &&
    (bytes[15] === 0x20 || bytes[15] === 0x4c || bytes[15] === 0x58)
  ) {
    return 'image/webp';
  }

  return null;
}

function validateImagePayload(
  bytes: Uint8Array,
  claimedMime: string | null | undefined
): PayloadValidationResult {
  if (bytes.byteLength === 0) {
    return {
      ok: false,
      status: 400,
      message: 'Image file must not be empty.',
    };
  }

  if (bytes.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      message: 'Image exceeds the 5 MB upload limit.',
    };
  }

  const normalizedClaimed = normalizeImageMime(claimedMime);
  if (normalizedClaimed !== null && !isAllowedInputMime(normalizedClaimed)) {
    return {
      ok: false,
      status: 415,
      message: 'Only JPEG, PNG, and WebP images are supported.',
    };
  }

  const detected = detectImageMimeFromMagicBytes(bytes);
  if (detected === null) {
    return {
      ok: false,
      status: 415,
      message: 'File contents do not match a valid JPEG, PNG, or WebP image.',
    };
  }

  if (normalizedClaimed !== null && normalizedClaimed !== detected) {
    return {
      ok: false,
      status: 415,
      message: 'Image Content-Type does not match file signature.',
    };
  }

  return { ok: true, mimeType: detected };
}

function decodeBase64UrlUtf8(segment: string): string | null {
  if (!BASE64URL_SEGMENT_REGEX.test(segment)) {
    return null;
  }

  const remainder = segment.length % 4;
  if (remainder === 1) {
    return null;
  }

  const padded = segment
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(segment.length + (remainder === 0 ? 0 : 4 - remainder), '=');

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function validateJwtClaims(
  token: string,
  expectedIssuer: string,
  nowSeconds: number
): JwtClaimValidationResult {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return { ok: false, message: 'Malformed JWT token.' };
  }

  const decodedPayload = decodeBase64UrlUtf8(parts[1]);
  if (decodedPayload === null) {
    return { ok: false, message: 'Invalid JWT payload encoding.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedPayload);
  } catch {
    return { ok: false, message: 'Invalid JWT payload JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, message: 'Invalid JWT claims structure.' };
  }

  const claims = parsed as Record<string, unknown>;

  const audValid =
    claims.aud === 'authenticated' ||
    (Array.isArray(claims.aud) && claims.aud.includes('authenticated'));
  if (!audValid) {
    return { ok: false, message: 'Invalid token audience.' };
  }

  const trimmedIssuer = expectedIssuer.trim().replace(/\/+$/, '');
  const normalizedIssuer = trimmedIssuer.endsWith('/auth/v1')
    ? trimmedIssuer
    : `${trimmedIssuer}/auth/v1`;
  if (typeof claims.iss !== 'string' || claims.iss !== normalizedIssuer) {
    return { ok: false, message: 'Invalid token issuer.' };
  }

  if (
    typeof claims.exp !== 'number' ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= nowSeconds
  ) {
    return { ok: false, message: 'Token is expired or missing exp claim.' };
  }

  if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
    return { ok: false, message: 'Token is missing subject claim.' };
  }

  return { ok: true, sub: claims.sub.trim() };
}

interface FormDataLike {
  get(name: string): unknown;
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function'
  );
}

async function readStreamWithLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<BoundedBodyReadResult> {
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'Malformed multipart/form-data request body.',
    };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value.byteLength === 0) {
        continue;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return {
          ok: false,
          status: 413,
          message: 'Image exceeds the 5 MB upload limit.',
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      message: 'Malformed multipart/form-data request body.',
    };
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes: combined };
}

export async function handleCompressImageRequest(
  req: Request,
  deps: CompressImageDeps
): Promise<Response> {
  const preflight = handleCorsPreflight(req, deps.allowedOrigins);
  if (preflight) {
    return preflight;
  }

  const origin = req.headers.get('origin');
  const json = (
    body: unknown,
    status: number,
    headers?: Record<string, string>
  ): Response =>
    withCorsJson(body, { status, headers }, origin, deps.allowedOrigins);

  if (origin !== null && !resolveCorsHeaders(origin, deps.allowedOrigins).allowed) {
    return json({ error: 'Origin not allowed.' }, 403);
  }

  if (req.method.toUpperCase() !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, {
      Allow: 'POST, OPTIONS',
    });
  }

  const authHeader = req.headers.get('authorization');
  const bearerMatch = authHeader ? BEARER_HEADER_REGEX.exec(authHeader.trim()) : null;
  if (!bearerMatch) {
    return json({ error: 'Missing or invalid Authorization bearer token.' }, 401);
  }

  const accessToken = bearerMatch[1];
  const nowSeconds = deps.nowSeconds
    ? deps.nowSeconds()
    : Math.floor(Date.now() / 1000);
  const expectedIssuer = resolveExpectedJwtIssuer(
    deps.supabaseUrl,
    deps.expectedJwtIssuer
  );
  const claimsResult = validateJwtClaims(accessToken, expectedIssuer, nowSeconds);
  if (!claimsResult.ok) {
    return json({ error: claimsResult.message }, 401);
  }

  let verifiedUser: { id: string; email?: string } | null = null;
  try {
    verifiedUser = await deps.verifyUser(accessToken);
  } catch {
    return json({ error: 'Authentication verification failed.' }, 401);
  }

  if (!verifiedUser || typeof verifiedUser.id !== 'string' || verifiedUser.id.trim().length === 0) {
    return json({ error: 'Invalid or revoked authentication token.' }, 401);
  }

  if (verifiedUser.id.trim() !== claimsResult.sub) {
    return json({ error: 'Token subject mismatch.' }, 401);
  }

  const rawContentType = req.headers.get('content-type') ?? '';
  if (!rawContentType.toLowerCase().includes('multipart/form-data')) {
    return json({ error: 'Content-Type must be multipart/form-data.' }, 400);
  }

  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const parsedLength = Number.parseInt(contentLengthHeader.trim(), 10);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_BYTES) {
      return json({ error: 'Image exceeds the 5 MB upload limit.' }, 413);
    }
  }

  let formData: FormDataLike;
  try {
    if (req.body !== null && typeof req.body.getReader === 'function') {
      const bodyResult = await readStreamWithLimit(req.body, MAX_BODY_BYTES);
      if (!bodyResult.ok) {
        return json({ error: bodyResult.message }, bodyResult.status);
      }
      formData = (await new Response(bodyResult.bytes as BodyInit, {
        headers: { 'Content-Type': rawContentType },
      }).formData()) as unknown as FormDataLike;
    } else {
      formData = (await req.formData()) as unknown as FormDataLike;
    }
  } catch {
    return json({ error: 'Malformed multipart/form-data request body.' }, 400);
  }

  const rawOrgId = formData.get('organization_id');
  if (typeof rawOrgId !== 'string' || !UUID_REGEX.test(rawOrgId.trim())) {
    return json({ error: 'organization_id must be a valid UUID.' }, 400);
  }
  const organizationId = rawOrgId.trim();

  const rawKind = formData.get('kind');
  if (typeof rawKind !== 'string' || !isMediaKind(rawKind.trim())) {
    return json({ error: 'kind must be one of logo, cover, or flyer.' }, 400);
  }
  const kind = rawKind.trim() as MediaKind;

  let authContext: CompressImageAuthContext;
  try {
    authContext = await deps.loadAuthorizationContext(verifiedUser.id, organizationId);
  } catch {
    return json({ error: 'Unable to verify upload authorization.' }, 500);
  }

  if (!authContext.profileActive || authContext.profileRole === null) {
    return json({ error: 'Active user profile is required to upload media.' }, 403);
  }

  if (authContext.profileRole === 'admin') {
    if (!authContext.orgExists || !authContext.orgActive) {
      return json({ error: 'Organization not found or inactive.' }, 404);
    }
  } else if (
    !authContext.isApprovedOfficer ||
    !authContext.orgExists ||
    !authContext.orgActive
  ) {
    return json(
      {
        error:
          'Only Department Admins or approved officers of this organization may upload media.',
      },
      403
    );
  }

  const fileEntry = formData.get('file');
  if (!isBlobLike(fileEntry)) {
    return json({ error: 'Image file field is required.' }, 400);
  }

  if (typeof fileEntry.size === 'number' && fileEntry.size > MAX_MEDIA_UPLOAD_BYTES) {
    return json({ error: 'Image exceeds the 5 MB upload limit.' }, 413);
  }

  const inputBytes = new Uint8Array(await fileEntry.arrayBuffer());
  const payloadValidation = validateImagePayload(inputBytes, fileEntry.type);
  if (!payloadValidation.ok) {
    return json({ error: payloadValidation.message }, payloadValidation.status);
  }

  const variantLimits = MEDIA_VARIANT_LIMITS[kind];
  const quality = Math.round(variantLimits.compress * 100);
  let processed: { bytes: Uint8Array; width: number; height: number };
  try {
    processed = await deps.processImage({
      bytes: inputBytes,
      sourceMime: payloadValidation.mimeType,
      kind,
      maxWidth: variantLimits.maxWidth,
      maxHeight: variantLimits.maxHeight,
      quality,
    });
  } catch {
    return json({ error: 'Unable to decode or process image.' }, 422);
  }

  const outputMime = detectImageMimeFromMagicBytes(processed.bytes);
  if (
    processed.bytes.byteLength === 0 ||
    processed.bytes.byteLength > MAX_MEDIA_UPLOAD_BYTES ||
    outputMime !== OUTPUT_IMAGE_MIME_TYPE ||
    !Number.isInteger(processed.width) ||
    processed.width <= 0 ||
    !Number.isInteger(processed.height) ||
    processed.height <= 0
  ) {
    return json({ error: 'Processed image failed WebP validation.' }, 500);
  }

  const assetId = (
    deps.generateAssetId ? deps.generateAssetId() : globalThis.crypto.randomUUID()
  ).trim();
  if (!UUID_REGEX.test(assetId)) {
    return json({ error: 'Invalid generated media asset identifier.' }, 500);
  }

  const storagePath = `orgs/${organizationId}/${kind}/${assetId}.webp`;

  let uploaded: { publicUrl: string };
  try {
    uploaded = await deps.uploadWebp({
      bucket: MEDIA_STORAGE_BUCKET,
      path: storagePath,
      bytes: processed.bytes,
      contentType: OUTPUT_IMAGE_MIME_TYPE,
    });
  } catch {
    return json({ error: 'Failed to upload normalized image to Storage.' }, 500);
  }

  return json(
    {
      bucket: MEDIA_STORAGE_BUCKET,
      path: storagePath,
      publicUrl: uploaded.publicUrl,
      mimeType: OUTPUT_IMAGE_MIME_TYPE,
      sizeBytes: processed.bytes.byteLength,
      width: processed.width,
      height: processed.height,
      exifStripped: true,
    },
    201
  );
}
