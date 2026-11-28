import {
  authenticateEdgeRequest,
  readStreamWithLimit,
  resolveExpectedJwtIssuer,
  resolvePublicStorageBaseUrl,
  resolveSupabaseRuntimeEnv,
  validateJwtClaims,
  type JwtClaimValidationResult,
  type SupabaseEdgeRuntimeEnv,
} from '../_shared/edge-auth';
import {
  ALLOWED_INPUT_IMAGE_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_STORAGE_BUCKET,
  MEDIA_VARIANT_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE,
  type AllowedInputImageMime,
  type MediaKind,
} from '../_shared/media-upload-constants';

export {
  ALLOWED_INPUT_IMAGE_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_STORAGE_BUCKET,
  MEDIA_VARIANT_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE,
  resolveExpectedJwtIssuer,
  resolvePublicStorageBaseUrl,
  validateJwtClaims,
  type AllowedInputImageMime,
  type JwtClaimValidationResult,
  type MediaKind,
};

export const MULTIPART_OVERHEAD_BYTES = 65536;
export const MAX_BODY_BYTES = MAX_MEDIA_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES;

export type CompressImageRuntimeEnv = SupabaseEdgeRuntimeEnv;
export const resolveRuntimeEnv = resolveSupabaseRuntimeEnv;

export interface CompressImageAuthContext {
  profileRole: 'student' | 'officer' | 'admin' | null;
  profileActive: boolean;
  orgExists: boolean;
  orgActive: boolean;
  isApprovedOfficer: boolean;
}

export type PersistOrganizationMediaResult =
  | { ok: true }
  | { ok: false; outcome: 'rejected' | 'unknown'; message?: string };

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
  persistOrganizationMediaUrl: (input: {
    organizationId: string;
    kind: 'logo' | 'cover';
    publicUrl: string;
  }) => Promise<PersistOrganizationMediaResult | void>;
  deleteUploadedWebp?: (input: {
    bucket: typeof MEDIA_STORAGE_BUCKET;
    path: string;
  }) => Promise<void>;
  generateAssetId?: () => string;
  nowSeconds?: () => number;
}

type PayloadValidationResult =
  | { ok: true; mimeType: AllowedInputImageMime }
  | { ok: false; status: 400 | 413 | 415; message: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFINITE_REJECTION_CODE_REGEX = /^(PGRST1\d\d|22[0-9A-Z]{3}|23[0-9A-Z]{3}|42[0-9A-Z]{3})$/;

export function classifyPersistenceFailure(
  status: number | undefined,
  error: { code?: string; message?: string } | null,
  hasData: boolean
): 'rejected' | 'unknown' {
  if (!error && !hasData) {
    return 'rejected';
  }
  if (typeof status === 'number' && status >= 500) {
    return 'unknown';
  }
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return 'rejected';
  }
  if (typeof error?.code === 'string' && DEFINITE_REJECTION_CODE_REGEX.test(error.code)) {
    return 'rejected';
  }
  return 'unknown';
}

export function buildPublicStorageObjectUrl(
  publicStorageBaseUrl: string,
  bucket: string,
  path: string
): string {
  return `${publicStorageBaseUrl.trim().replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, '')}`;
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

export async function handleCompressImageRequest(
  req: Request,
  deps: CompressImageDeps
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
  const { userId, json } = auth;

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
      const bodyResult = await readStreamWithLimit(
        req.body,
        MAX_BODY_BYTES,
        'Image exceeds the 5 MB upload limit.',
        'Malformed multipart/form-data request body.'
      );
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
    authContext = await deps.loadAuthorizationContext(userId, organizationId);
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
    authContext.profileRole !== 'officer' ||
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

  if (kind === 'logo' || kind === 'cover') {
    let persistResult: PersistOrganizationMediaResult | void;
    try {
      persistResult = await deps.persistOrganizationMediaUrl({
        organizationId,
        kind,
        publicUrl: uploaded.publicUrl,
      });
    } catch {
      return json({ error: 'Failed to update organization media URL.' }, 500);
    }

    if (persistResult && !persistResult.ok) {
      if (persistResult.outcome === 'rejected') {
        try {
          await deps.deleteUploadedWebp?.({
            bucket: MEDIA_STORAGE_BUCKET,
            path: storagePath,
          });
        } catch {}
      }
      return json({ error: 'Failed to update organization media URL.' }, 500);
    }
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
