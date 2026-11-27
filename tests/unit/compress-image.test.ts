import {
  ALLOWED_INPUT_IMAGE_MIME_TYPES as SHARED_ALLOWED_MIMES,
  CompressImageRequestMetaSchema,
  CompressImageResponseSchema,
  MAX_MEDIA_UPLOAD_BYTES as SHARED_MAX_BYTES,
  MEDIA_STORAGE_BUCKET as SHARED_BUCKET,
  MEDIA_VARIANT_LIMITS as SHARED_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE as SHARED_OUTPUT_MIME,
} from '../../shared/media-upload';
import {
  ALLOWED_INPUT_IMAGE_MIME_TYPES as CORE_ALLOWED_MIMES,
  detectImageMimeFromMagicBytes as coreDetectMagicBytes,
  handleCompressImageRequest,
  loadWasmBytes,
  MAX_BODY_BYTES,
  MAX_MEDIA_UPLOAD_BYTES as CORE_MAX_BYTES,
  MEDIA_STORAGE_BUCKET as CORE_BUCKET,
  MEDIA_VARIANT_LIMITS as CORE_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE as CORE_OUTPUT_MIME,
  resolveExpectedJwtIssuer,
  resolveRuntimeEnv,
  validateJwtClaims,
  type CompressImageDeps,
} from '../../supabase/functions/compress-image/core';

declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeFs = require('node:fs') as {
  readFileSync(filePath: string, encoding: 'utf8'): string;
};
const nodePath = require('node:path') as {
  resolve(...segments: string[]): string;
  join(...segments: string[]): string;
};

const REPO_ROOT = nodePath.resolve(__dirname, '..', '..');
const SUPABASE_URL = 'https://myccs-project.supabase.co';
const ALLOWED_ORIGIN = 'https://myccs-admin.pages.dev';
const ORG_A_ID = '11111111-1111-4111-8111-111111111111';
const ORG_B_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ASSET_ID = '44444444-4444-4444-8444-444444444444';
const NOW_SECONDS = 1_764_250_000;

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const WEBP_VP8_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x0e, 0x00, 0x00, 0x00,
]);
const WEBP_VP8L_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
]);
const WEBP_VP8X_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x14, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58,
]);
const SVG_BYTES = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const HTML_BYTES = new TextEncoder().encode('<!DOCTYPE html><html></html>');
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n');

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeTestJwt(claims: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify(claims));
  return `${header}.${payload}.synthetic_signature`;
}

function makeValidToken(overrides: Record<string, unknown> = {}): string {
  return makeTestJwt({
    aud: 'authenticated',
    iss: `${SUPABASE_URL}/auth/v1`,
    sub: USER_ID,
    exp: NOW_SECONDS + 3600,
    ...overrides,
  });
}

function makeBlobFile(
  bytes: Uint8Array,
  mimeType: string,
  overrideSize?: number
): Blob {
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: mimeType,
  });
  if (overrideSize !== undefined) {
    Object.defineProperty(blob, 'size', { value: overrideSize });
  }
  return blob;
}

function makeMultipartRequest(options: {
  method?: string;
  origin?: string | null;
  authorization?: string | null;
  contentType?: string | null;
  contentLength?: string | null;
  formData?: FormData | (() => Promise<FormData>);
}): Request {
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set('Origin', options.origin ?? ALLOWED_ORIGIN);
  }
  if (options.authorization !== null) {
    headers.set('Authorization', options.authorization ?? `Bearer ${makeValidToken()}`);
  }
  if (options.contentType !== null) {
    headers.set(
      'Content-Type',
      options.contentType ?? 'multipart/form-data; boundary=----myccs-test'
    );
  }
  if (options.contentLength !== undefined && options.contentLength !== null) {
    headers.set('Content-Length', options.contentLength);
  }

  const req = new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
    method: options.method ?? 'POST',
    headers,
  });

  if (options.formData !== undefined) {
    const resolver =
      typeof options.formData === 'function'
        ? options.formData
        : async () => options.formData as FormData;
    Object.defineProperty(req, 'formData', {
      value: resolver,
      configurable: true,
    });
  }

  return req;
}

function buildValidFormData(
  overrides: {
    organizationId?: string | null;
    kind?: string | null;
    file?: Blob | string | null;
  } = {}
): FormData {
  const form = new FormData();
  const orgId =
    overrides.organizationId === undefined ? ORG_A_ID : overrides.organizationId;
  const kind = overrides.kind === undefined ? 'cover' : overrides.kind;
  const file =
    overrides.file === undefined ? makeBlobFile(PNG_BYTES, 'image/png') : overrides.file;

  if (orgId !== null) {
    form.append('organization_id', orgId);
  }
  if (kind !== null) {
    form.append('kind', kind);
  }
  if (file !== null) {
    form.append('file', file);
  }
  return form;
}

function makeDeps(overrides: Partial<CompressImageDeps> = {}): CompressImageDeps {
  return {
    supabaseUrl: SUPABASE_URL,
    allowedOrigins: [ALLOWED_ORIGIN],
    verifyUser: jest.fn().mockResolvedValue({
      id: USER_ID,
      email: 'officer@lpunetwork.edu.ph',
    }),
    loadAuthorizationContext: jest.fn().mockResolvedValue({
      profileRole: 'officer',
      profileActive: true,
      orgExists: true,
      orgActive: true,
      isApprovedOfficer: true,
    }),
    processImage: jest.fn().mockResolvedValue({
      bytes: WEBP_VP8_BYTES,
      width: 1200,
      height: 675,
    }),
    uploadWebp: jest.fn().mockImplementation(async ({ bucket, path }) => ({
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`,
    })),
    generateAssetId: jest.fn().mockReturnValue(ASSET_ID),
    nowSeconds: () => NOW_SECONDS,
    ...overrides,
  };
}

describe('spec-04 shared/media-upload.ts contracts & parity', () => {
  it('validates CompressImageRequestMetaSchema and CompressImageResponseSchema strictly', () => {
    expect(
      CompressImageRequestMetaSchema.parse({
        organizationId: ORG_A_ID,
        kind: 'flyer',
      })
    ).toEqual({ organizationId: ORG_A_ID, kind: 'flyer' });

    const validResponse = CompressImageResponseSchema.parse({
      bucket: 'org-media',
      path: `orgs/${ORG_A_ID}/cover/${ASSET_ID}.webp`,
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/org-media/orgs/${ORG_A_ID}/cover/${ASSET_ID}.webp`,
      mimeType: 'image/webp',
      sizeBytes: 12345,
      width: 1200,
      height: 675,
      exifStripped: true,
    });
    expect(validResponse.exifStripped).toBe(true);

    expect(
      CompressImageResponseSchema.safeParse({
        ...validResponse,
        publicUrl: 'javascript:alert(1)',
      }).success
    ).toBe(false);

    expect(
      CompressImageResponseSchema.safeParse({
        ...validResponse,
        publicUrl: 'not a url',
      }).success
    ).toBe(false);

    expect(
      CompressImageResponseSchema.safeParse({
        ...validResponse,
        exifStripped: false,
      }).success
    ).toBe(false);
  });

  it('maintains exact constant parity between shared/media-upload.ts and compress-image/core.ts', () => {
    expect(CORE_MAX_BYTES).toBe(SHARED_MAX_BYTES);
    expect(CORE_BUCKET).toBe(SHARED_BUCKET);
    expect(CORE_ALLOWED_MIMES).toEqual(SHARED_ALLOWED_MIMES);
    expect(CORE_OUTPUT_MIME).toBe(SHARED_OUTPUT_MIME);
    expect(CORE_LIMITS).toEqual(SHARED_LIMITS);
  });
});

describe('spec-04 supabase/functions/compress-image/core.ts helpers & HTTP handler', () => {
  it('detects valid JPEG, PNG, and WebP (VP8/VP8L/VP8X) magic bytes and rejects non-images', () => {
    expect(coreDetectMagicBytes(JPEG_BYTES)).toBe('image/jpeg');
    expect(coreDetectMagicBytes(PNG_BYTES)).toBe('image/png');
    expect(coreDetectMagicBytes(WEBP_VP8_BYTES)).toBe('image/webp');
    expect(coreDetectMagicBytes(WEBP_VP8L_BYTES)).toBe('image/webp');
    expect(coreDetectMagicBytes(WEBP_VP8X_BYTES)).toBe('image/webp');

    expect(coreDetectMagicBytes(SVG_BYTES)).toBeNull();
    expect(coreDetectMagicBytes(HTML_BYTES)).toBeNull();
    expect(coreDetectMagicBytes(PDF_BYTES)).toBeNull();
    expect(coreDetectMagicBytes(new Uint8Array([]))).toBeNull();
    expect(coreDetectMagicBytes(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(coreDetectMagicBytes(WEBP_VP8_BYTES.slice(0, 12))).toBeNull();

    const riffNonWebp = new Uint8Array(WEBP_VP8_BYTES);
    riffNonWebp[8] = 0x41;
    expect(coreDetectMagicBytes(riffNonWebp)).toBeNull();

    const webpBadChunk = new Uint8Array(WEBP_VP8_BYTES);
    webpBadChunk[15] = 0x5a;
    expect(coreDetectMagicBytes(webpBadChunk)).toBeNull();
  });

  it('resolves runtime environment variables with empty-string fallbacks and optional JWT issuer', () => {
    const readFrom = (map: Record<string, string | undefined>) => (key: string) => map[key];

    expect(
      resolveRuntimeEnv(
        readFrom({
          SUPABASE_URL: '  http://kong:8000  ',
          SUPABASE_SECRET_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: '  srk-legacy  ',
          SUPABASE_PUBLISHABLE_KEY: '   ',
          SUPABASE_ANON_KEY: '  anon-legacy  ',
          SUPABASE_JWT_ISSUER: '  http://127.0.0.1:54321/auth/v1  ',
        })
      )
    ).toEqual({
      supabaseUrl: 'http://kong:8000',
      serviceRoleKey: 'srk-legacy',
      publishableKey: 'anon-legacy',
      expectedJwtIssuer: 'http://127.0.0.1:54321/auth/v1',
    });

    expect(
      resolveRuntimeEnv(
        readFrom({
          SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SECRET_KEY: 'sb_secret_modern',
          SUPABASE_PUBLISHABLE_KEY: '',
          SUPABASE_ANON_KEY: '',
          SUPABASE_JWT_ISSUER: '   ',
        })
      )
    ).toEqual({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: 'sb_secret_modern',
      publishableKey: 'sb_secret_modern',
      expectedJwtIssuer: undefined,
    });

    expect(
      resolveRuntimeEnv(
        readFrom({
          SUPABASE_URL: '   ',
          SUPABASE_SECRET_KEY: 'sb_secret_modern',
        })
      )
    ).toBeNull();

    expect(
      resolveRuntimeEnv(
        readFrom({
          SUPABASE_URL: SUPABASE_URL,
          SUPABASE_SECRET_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: '   ',
        })
      )
    ).toBeNull();
  });

  it('loads WASM bytes via readFile for file: URLs and fetchFn for https: URLs with status and empty-body checks', async () => {
    const sampleWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    const readFile = jest.fn().mockResolvedValue(sampleWasm);
    const fetchFn = jest.fn() as unknown as typeof fetch;

    const fileUrl = new URL('file:///tmp/magick.wasm');
    await expect(loadWasmBytes(fileUrl, { readFile, fetchFn })).resolves.toEqual(sampleWasm);
    expect(readFile).toHaveBeenCalledWith(fileUrl);
    expect(fetchFn).not.toHaveBeenCalled();

    const httpsUrl = new URL('https://cdn.example.com/magick.wasm');
    const okFetch = jest.fn().mockResolvedValue(new Response(sampleWasm, { status: 200 }));
    const unusedReadFile = jest.fn();
    await expect(
      loadWasmBytes(httpsUrl, {
        readFile: unusedReadFile,
        fetchFn: okFetch as unknown as typeof fetch,
      })
    ).resolves.toEqual(sampleWasm);
    expect(okFetch).toHaveBeenCalledWith(httpsUrl);
    expect(unusedReadFile).not.toHaveBeenCalled();

    const notFoundFetch = jest.fn().mockResolvedValue(new Response('not found', { status: 404 }));
    await expect(
      loadWasmBytes(httpsUrl, {
        readFile: unusedReadFile,
        fetchFn: notFoundFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow('Failed to load ImageMagick WASM (404).');

    const serverErrorFetch = jest.fn().mockResolvedValue(new Response('err', { status: 500 }));
    await expect(
      loadWasmBytes(httpsUrl, {
        readFile: unusedReadFile,
        fetchFn: serverErrorFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow('Failed to load ImageMagick WASM (500).');

    const emptyBodyFetch = jest
      .fn()
      .mockResolvedValue(new Response(new Uint8Array(0), { status: 200 }));
    await expect(
      loadWasmBytes(httpsUrl, {
        readFile: unusedReadFile,
        fetchFn: emptyBodyFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow('Empty ImageMagick WASM binary.');
  });

  it('resolves expected JWT issuer and validates JWT aud, iss, exp, sub, and base64url structure fail-closed', () => {
    expect(resolveExpectedJwtIssuer(SUPABASE_URL)).toBe(`${SUPABASE_URL}/auth/v1`);
    expect(resolveExpectedJwtIssuer(`${SUPABASE_URL}/`, '   ')).toBe(`${SUPABASE_URL}/auth/v1`);
    expect(
      resolveExpectedJwtIssuer('http://kong:8000', ' http://127.0.0.1:54321/auth/v1/ ')
    ).toBe('http://127.0.0.1:54321/auth/v1');

    expect(validateJwtClaims(makeValidToken(), SUPABASE_URL, NOW_SECONDS)).toEqual({
      ok: true,
      sub: USER_ID,
    });
    expect(
      validateJwtClaims(
        makeValidToken({ aud: ['authenticated', 'mobile'] }),
        `${SUPABASE_URL}/`,
        NOW_SECONDS
      )
    ).toEqual({ ok: true, sub: USER_ID });
    expect(
      validateJwtClaims(
        makeValidToken({ iss: 'http://127.0.0.1:54321/auth/v1' }),
        'http://127.0.0.1:54321/auth/v1/',
        NOW_SECONDS
      )
    ).toEqual({ ok: true, sub: USER_ID });

    expect(validateJwtClaims('not-a-jwt', SUPABASE_URL, NOW_SECONDS).ok).toBe(false);
    expect(validateJwtClaims('a..c', SUPABASE_URL, NOW_SECONDS).ok).toBe(false);
    expect(validateJwtClaims('a.!!!.c', SUPABASE_URL, NOW_SECONDS).ok).toBe(false);
    expect(validateJwtClaims('a.A.c', SUPABASE_URL, NOW_SECONDS).ok).toBe(false);
    expect(
      validateJwtClaims(`hdr.${toBase64Url('{bad-json')}.sig`, SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
    expect(
      validateJwtClaims(`hdr.${toBase64Url('[]')}.sig`, SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
    expect(
      validateJwtClaims(makeValidToken({ aud: 'anon' }), SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
    expect(
      validateJwtClaims(makeValidToken({ iss: 'https://evil.example.com/auth/v1' }), SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
    expect(
      validateJwtClaims(makeValidToken({ exp: NOW_SECONDS }), SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
    expect(
      validateJwtClaims(makeValidToken({ exp: 'soon' }), SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
    expect(
      validateJwtClaims(makeValidToken({ sub: '   ' }), SUPABASE_URL, NOW_SECONDS).ok
    ).toBe(false);
  });

  it('handles CORS preflight (204 allowed, 403 disallowed), disallowed POST Origin (403), native mobile without Origin, and non-POST (405)', async () => {
    const deps = makeDeps();

    const okOptions = await handleCompressImageRequest(
      new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
        method: 'OPTIONS',
        headers: { Origin: ALLOWED_ORIGIN },
      }),
      deps
    );
    expect(okOptions.status).toBe(204);
    expect(okOptions.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(okOptions.headers.get('Vary')).toBe('Origin');

    const badOptions = await handleCompressImageRequest(
      new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example.com' },
      }),
      deps
    );
    expect(badOptions.status).toBe(403);
    expect(badOptions.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(badOptions.headers.get('Vary')).toBe('Origin');

    const badPostOrigin = await handleCompressImageRequest(
      makeMultipartRequest({
        origin: 'https://evil.example.com',
        formData: buildValidFormData(),
      }),
      deps
    );
    expect(badPostOrigin.status).toBe(403);
    expect(badPostOrigin.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(badPostOrigin.headers.get('Vary')).toBe('Origin');

    const getRes = await handleCompressImageRequest(
      makeMultipartRequest({ method: 'GET', formData: buildValidFormData() }),
      deps
    );
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get('Allow')).toBe('POST, OPTIONS');

    const nativeMobileRes = await handleCompressImageRequest(
      makeMultipartRequest({
        origin: null,
        formData: buildValidFormData(),
      }),
      deps
    );
    expect(nativeMobileRes.status).toBe(201);
    expect(nativeMobileRes.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(nativeMobileRes.headers.get('Vary')).toBe('Origin');
  });

  it('supports expectedJwtIssuer override when internal supabaseUrl differs from public issuer', async () => {
    const issuerOverride = 'http://127.0.0.1:54321/auth/v1';
    const deps = makeDeps({
      supabaseUrl: 'http://kong:8000',
      expectedJwtIssuer: issuerOverride,
    });
    const token = makeValidToken({ iss: issuerOverride });

    const res = await handleCompressImageRequest(
      makeMultipartRequest({
        authorization: `Bearer ${token}`,
        formData: buildValidFormData(),
      }),
      deps
    );
    expect(res.status).toBe(201);
  });

  it('rejects missing, malformed, wrong-claim, expired, subject-mismatched, or unverified JWTs with 401 before touching Storage', async () => {
    const cases: Array<{ name: string; auth: string | null; deps?: Partial<CompressImageDeps> }> = [
      { name: 'missing Authorization', auth: null },
      { name: 'non-Bearer scheme', auth: 'Basic abc123' },
      { name: 'empty Bearer', auth: 'Bearer   ' },
      { name: 'malformed JWT', auth: 'Bearer broken.token' },
      { name: 'wrong aud', auth: `Bearer ${makeValidToken({ aud: 'anon' })}` },
      { name: 'wrong iss', auth: `Bearer ${makeValidToken({ iss: 'https://other.supabase.co/auth/v1' })}` },
      { name: 'expired exp', auth: `Bearer ${makeValidToken({ exp: NOW_SECONDS - 10 })}` },
      {
        name: 'verifyUser returns null',
        auth: `Bearer ${makeValidToken()}`,
        deps: { verifyUser: jest.fn().mockResolvedValue(null) },
      },
      {
        name: 'verifyUser throws',
        auth: `Bearer ${makeValidToken()}`,
        deps: { verifyUser: jest.fn().mockRejectedValue(new Error('auth outage')) },
      },
      {
        name: 'verifyUser id mismatches token sub',
        auth: `Bearer ${makeValidToken()}`,
        deps: {
          verifyUser: jest.fn().mockResolvedValue({
            id: '99999999-9999-4999-8999-999999999999',
            email: 'other@lpunetwork.edu.ph',
          }),
        },
      },
    ];

    for (const testCase of cases) {
      const deps = makeDeps(testCase.deps);
      const res = await handleCompressImageRequest(
        makeMultipartRequest({
          authorization: testCase.auth,
          formData: buildValidFormData(),
        }),
        deps
      );
      expect(res.status).toBe(401);
      expect(deps.loadAuthorizationContext).not.toHaveBeenCalled();
      expect(deps.processImage).not.toHaveBeenCalled();
      expect(deps.uploadWebp).not.toHaveBeenCalled();
    }
  });

  it('aborts chunked streaming bodies exceeding MAX_BODY_BYTES with 413 before parsing formData and handles stream errors with 400', async () => {
    const deps = makeDeps();
    const cancelSpy = jest.fn();
    let chunksEmitted = 0;
    const chunkSize = 1024 * 1024;
    const oversizedStream = new ReadableStream<Uint8Array>({
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

    const chunkedReq = new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${makeValidToken()}`,
        'Content-Type': 'multipart/form-data; boundary=----chunked-test',
      },
      body: oversizedStream,
      duplex: 'half',
    } as RequestInit);

    const formDataSpy = jest.spyOn(chunkedReq, 'formData');
    const oversizedRes = await handleCompressImageRequest(chunkedReq, deps);
    expect(oversizedRes.status).toBe(413);
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(chunksEmitted).toBeLessThan(8);
    expect(formDataSpy).not.toHaveBeenCalled();
    expect(deps.loadAuthorizationContext).not.toHaveBeenCalled();
    expect(deps.processImage).not.toHaveBeenCalled();

    const erroringStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('network reset'));
      },
    });
    const brokenStreamReq = new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${makeValidToken()}`,
        'Content-Type': 'multipart/form-data; boundary=----broken-stream',
      },
      body: erroringStream,
      duplex: 'half',
    } as RequestInit);
    const brokenStreamRes = await handleCompressImageRequest(brokenStreamReq, deps);
    expect(brokenStreamRes.status).toBe(400);

    const serializedForm = await new Response(
      buildValidFormData({ kind: 'logo', file: makeBlobFile(PNG_BYTES, 'image/png') })
    );
    const rawContentType = serializedForm.headers.get('content-type') ?? '';
    const payloadBytes = new Uint8Array(await serializedForm.arrayBuffer());
    expect(payloadBytes.byteLength).toBeLessThanOrEqual(MAX_BODY_BYTES);
    const validStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(0));
        controller.enqueue(payloadBytes.subarray(0, 64));
        controller.enqueue(payloadBytes.subarray(64));
        controller.close();
      },
    });
    const validStreamReq = new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${makeValidToken()}`,
        'Content-Type': rawContentType,
      },
      body: validStream,
      duplex: 'half',
    } as RequestInit);
    const validStreamRes = await handleCompressImageRequest(validStreamReq, makeDeps());
    expect(validStreamRes.status).toBe(201);
  });

  it('rejects invalid Content-Type (400), oversized Content-Length (413), malformed formData (400), and invalid fields/file bounds', async () => {
    const deps = makeDeps();

    const badCt = await handleCompressImageRequest(
      makeMultipartRequest({
        contentType: 'application/json',
        formData: buildValidFormData(),
      }),
      deps
    );
    expect(badCt.status).toBe(400);

    const formDataSpy = jest.fn();
    const hugeCl = await handleCompressImageRequest(
      makeMultipartRequest({
        contentLength: String(MAX_BODY_BYTES + 1),
        formData: formDataSpy,
      }),
      deps
    );
    expect(hugeCl.status).toBe(413);
    expect(formDataSpy).not.toHaveBeenCalled();

    const brokenForm = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: async () => {
          throw new Error('corrupt multipart stream');
        },
      }),
      deps
    );
    expect(brokenForm.status).toBe(400);

    const badOrg = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ organizationId: 'not-a-uuid' }),
      }),
      deps
    );
    expect(badOrg.status).toBe(400);

    const badKind = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ kind: 'banner' }),
      }),
      deps
    );
    expect(badKind.status).toBe(400);

    const missingFile = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ file: null }),
      }),
      deps
    );
    expect(missingFile.status).toBe(400);

    const stringFile = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ file: 'plain-string-not-blob' }),
      }),
      deps
    );
    expect(stringFile.status).toBe(400);

    const emptyFile = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ file: makeBlobFile(new Uint8Array(0), 'image/png') }),
      }),
      deps
    );
    expect(emptyFile.status).toBe(400);

    const oversizedMeta = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({
          file: makeBlobFile(PNG_BYTES, 'image/png', CORE_MAX_BYTES + 1),
        }),
      }),
      deps
    );
    expect(oversizedMeta.status).toBe(413);

    const oversizedBytes = new Uint8Array(CORE_MAX_BYTES + 1);
    oversizedBytes.set(PNG_BYTES, 0);
    const oversizedBody = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({
          file: makeBlobFile(oversizedBytes, 'image/png', 100),
        }),
      }),
      deps
    );
    expect(oversizedBody.status).toBe(413);
  });

  it('rejects unsupported MIME, spoofed magic bytes, and MIME mismatch with 415', async () => {
    const deps = makeDeps();

    const svgRes = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ file: makeBlobFile(SVG_BYTES, 'image/svg+xml') }),
      }),
      deps
    );
    expect(svgRes.status).toBe(415);

    const spoofedJpeg = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ file: makeBlobFile(SVG_BYTES, 'image/jpeg') }),
      }),
      deps
    );
    expect(spoofedJpeg.status).toBe(415);

    const mismatch = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ file: makeBlobFile(PNG_BYTES, 'image/jpeg') }),
      }),
      deps
    );
    expect(mismatch.status).toBe(415);
    expect(deps.processImage).not.toHaveBeenCalled();
    expect(deps.uploadWebp).not.toHaveBeenCalled();
  });

  it('enforces RBAC before file.arrayBuffer() without leaking 404 org existence to non-admins', async () => {
    const studentFile = makeBlobFile(PNG_BYTES, 'image/png');
    const studentArrayBufferSpy = jest.spyOn(studentFile, 'arrayBuffer');
    const studentDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'student',
        profileActive: true,
        orgExists: true,
        orgActive: true,
        isApprovedOfficer: false,
      }),
    });
    const studentRes = await handleCompressImageRequest(
      makeMultipartRequest({ formData: buildValidFormData({ file: studentFile }) }),
      studentDeps
    );
    expect(studentRes.status).toBe(403);
    expect(studentArrayBufferSpy).not.toHaveBeenCalled();
    await expect(studentRes.json()).resolves.toEqual({
      error: 'Only Department Admins or approved officers of this organization may upload media.',
    });

    const studentMissingOrgFile = makeBlobFile(PNG_BYTES, 'image/png');
    const studentMissingSpy = jest.spyOn(studentMissingOrgFile, 'arrayBuffer');
    const studentMissingOrgDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'student',
        profileActive: true,
        orgExists: false,
        orgActive: false,
        isApprovedOfficer: false,
      }),
    });
    const studentMissingRes = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ organizationId: ORG_B_ID, file: studentMissingOrgFile }),
      }),
      studentMissingOrgDeps
    );
    expect(studentMissingRes.status).toBe(403);
    expect(studentMissingSpy).not.toHaveBeenCalled();

    const deletedProfileDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'admin',
        profileActive: false,
        orgExists: true,
        orgActive: true,
        isApprovedOfficer: false,
      }),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          deletedProfileDeps
        )
      ).status
    ).toBe(403);

    const crossOrgFile = makeBlobFile(PNG_BYTES, 'image/png');
    const crossOrgArrayBufferSpy = jest.spyOn(crossOrgFile, 'arrayBuffer');
    const crossOrgOfficerDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'officer',
        profileActive: true,
        orgExists: true,
        orgActive: true,
        isApprovedOfficer: false,
      }),
    });
    const crossOrgRes = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ organizationId: ORG_B_ID, file: crossOrgFile }),
      }),
      crossOrgOfficerDeps
    );
    expect(crossOrgRes.status).toBe(403);
    expect(crossOrgArrayBufferSpy).not.toHaveBeenCalled();

    const officerDeletedOrgFile = makeBlobFile(PNG_BYTES, 'image/png');
    const officerDeletedSpy = jest.spyOn(officerDeletedOrgFile, 'arrayBuffer');
    const officerDeletedOrgDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'officer',
        profileActive: true,
        orgExists: true,
        orgActive: false,
        isApprovedOfficer: false,
      }),
    });
    const officerDeletedRes = await handleCompressImageRequest(
      makeMultipartRequest({
        formData: buildValidFormData({ organizationId: ORG_B_ID, file: officerDeletedOrgFile }),
      }),
      officerDeletedOrgDeps
    );
    expect(officerDeletedRes.status).toBe(403);
    expect(officerDeletedSpy).not.toHaveBeenCalled();

    const adminMissingFile = makeBlobFile(PNG_BYTES, 'image/png');
    const adminMissingSpy = jest.spyOn(adminMissingFile, 'arrayBuffer');
    const missingOrgDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'admin',
        profileActive: true,
        orgExists: false,
        orgActive: false,
        isApprovedOfficer: false,
      }),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({
            formData: buildValidFormData({ organizationId: ORG_B_ID, file: adminMissingFile }),
          }),
          missingOrgDeps
        )
      ).status
    ).toBe(404);
    expect(adminMissingSpy).not.toHaveBeenCalled();

    const deletedOrgDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'admin',
        profileActive: true,
        orgExists: true,
        orgActive: false,
        isApprovedOfficer: false,
      }),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          deletedOrgDeps
        )
      ).status
    ).toBe(404);

    const authzErrorDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockRejectedValue(new Error('db down')),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          authzErrorDeps
        )
      ).status
    ).toBe(500);
  });

  it('returns 422 on image processing failure and 500 on corrupted WebP output, bad assetId, or upload failure', async () => {
    const decodeErrDeps = makeDeps({
      processImage: jest.fn().mockRejectedValue(new Error('corrupt image stream')),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          decodeErrDeps
        )
      ).status
    ).toBe(422);

    const badWebpDeps = makeDeps({
      processImage: jest.fn().mockResolvedValue({
        bytes: PNG_BYTES,
        width: 512,
        height: 512,
      }),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          badWebpDeps
        )
      ).status
    ).toBe(500);

    const badAssetIdDeps = makeDeps({
      generateAssetId: () => '../traversal',
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          badAssetIdDeps
        )
      ).status
    ).toBe(500);

    const uploadFailDeps = makeDeps({
      uploadWebp: jest.fn().mockRejectedValue(new Error('storage offline')),
    });
    expect(
      (
        await handleCompressImageRequest(
          makeMultipartRequest({ formData: buildValidFormData() }),
          uploadFailDeps
        )
      ).status
    ).toBe(500);
  });

  it('succeeds with 201 WebP payload for assigned officer and admin across logo, cover, and flyer variants', async () => {
    const officerDeps = makeDeps();
    const officerRes = await handleCompressImageRequest(
      makeMultipartRequest({
        authorization: `bearer ${makeValidToken()}`,
        formData: buildValidFormData({
          kind: 'cover',
          file: makeBlobFile(JPEG_BYTES, 'image/jpeg'),
        }),
      }),
      officerDeps
    );

    expect(officerRes.status).toBe(201);
    expect(officerRes.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(officerRes.headers.get('Vary')).toBe('Origin');

    const officerBody = CompressImageResponseSchema.parse(await officerRes.json());
    expect(officerBody).toEqual({
      bucket: 'org-media',
      path: `orgs/${ORG_A_ID}/cover/${ASSET_ID}.webp`,
      publicUrl: `${SUPABASE_URL}/storage/v1/object/public/org-media/orgs/${ORG_A_ID}/cover/${ASSET_ID}.webp`,
      mimeType: 'image/webp',
      sizeBytes: WEBP_VP8_BYTES.byteLength,
      width: 1200,
      height: 675,
      exifStripped: true,
    });
    expect(officerDeps.processImage).toHaveBeenCalledWith({
      bytes: JPEG_BYTES,
      sourceMime: 'image/jpeg',
      kind: 'cover',
      maxWidth: 1600,
      maxHeight: 900,
      quality: 80,
    });
    expect(officerDeps.uploadWebp).toHaveBeenCalledWith({
      bucket: 'org-media',
      path: `orgs/${ORG_A_ID}/cover/${ASSET_ID}.webp`,
      bytes: WEBP_VP8_BYTES,
      contentType: 'image/webp',
    });

    const adminDeps = makeDeps({
      loadAuthorizationContext: jest.fn().mockResolvedValue({
        profileRole: 'admin',
        profileActive: true,
        orgExists: true,
        orgActive: true,
        isApprovedOfficer: false,
      }),
      generateAssetId: undefined,
      nowSeconds: undefined,
    });
    const futureToken = makeTestJwt({
      aud: 'authenticated',
      iss: `${SUPABASE_URL}/auth/v1`,
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const adminRes = await handleCompressImageRequest(
      makeMultipartRequest({
        authorization: `Bearer ${futureToken}`,
        contentLength: '1024',
        formData: buildValidFormData({
          kind: 'flyer',
          file: makeBlobFile(WEBP_VP8X_BYTES, ''),
        }),
      }),
      adminDeps
    );
    expect(adminRes.status).toBe(201);
    const adminBody = CompressImageResponseSchema.parse(await adminRes.json());
    expect(adminBody.path).toMatch(
      new RegExp(`^orgs/${ORG_A_ID}/flyer/[0-9a-f-]{36}\\.webp$`, 'i')
    );
    expect(adminDeps.processImage).toHaveBeenCalledWith({
      bytes: WEBP_VP8X_BYTES,
      sourceMime: 'image/webp',
      kind: 'flyer',
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 82,
    });

    const realForm = buildValidFormData({
      kind: 'logo',
      file: makeBlobFile(PNG_BYTES, 'image/png'),
    });
    const realReq = new Request(`${SUPABASE_URL}/functions/v1/compress-image`, {
      method: 'POST',
      headers: {
        Origin: ALLOWED_ORIGIN,
        Authorization: `Bearer ${futureToken}`,
      },
      body: realForm,
    });
    const realRes = await handleCompressImageRequest(realReq, makeDeps({ nowSeconds: undefined }));
    expect(realRes.status).toBe(201);
    const realBody = CompressImageResponseSchema.parse(await realRes.json());
    expect(realBody.path).toBe(`orgs/${ORG_A_ID}/logo/${ASSET_ID}.webp`);
  });
});

describe('spec-04 migration, config, Deno entrypoint, SQL test, and Postman contracts', () => {
  const migrationSql = nodeFs.readFileSync(
    nodePath.join(
      REPO_ROOT,
      'supabase',
      'migrations',
      '20261127000001_spec04_org_media_storage.sql'
    ),
    'utf8'
  );
  const configToml = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'supabase', 'config.toml'),
    'utf8'
  );
  const denoEntrypoint = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'supabase', 'functions', 'compress-image', 'index.ts'),
    'utf8'
  );
  const denoConfig = JSON.parse(
    nodeFs.readFileSync(
      nodePath.join(REPO_ROOT, 'supabase', 'functions', 'compress-image', 'deno.json'),
      'utf8'
    )
  ) as { imports: Record<string, string> };
  const storageTestSql = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'tests', 'api', 'org-media-storage.sql'),
    'utf8'
  );
  const postmanRaw = nodeFs.readFileSync(
    nodePath.join(REPO_ROOT, 'tests', 'api', 'compress-image.postman_collection.json'),
    'utf8'
  );

  it('provisions org-media bucket with 5 MiB WebP-only limits, zero client write policies, and SECURITY INVOKER media URL trigger', () => {
    expect(migrationSql).toContain("INSERT INTO storage.buckets");
    expect(migrationSql).toContain("'org-media'");
    expect(migrationSql).toContain('5242880');
    expect(migrationSql).toContain("ARRAY['image/webp']::text[]");
    expect(migrationSql).toContain('DROP POLICY IF EXISTS org_media_insert_authenticated ON storage.objects;');
    expect(migrationSql).toContain('DROP POLICY IF EXISTS org_media_update_authenticated ON storage.objects;');
    expect(migrationSql).toContain('DROP POLICY IF EXISTS org_media_delete_authenticated ON storage.objects;');
    expect(migrationSql).toContain('CREATE POLICY org_media_select_authenticated');
    expect(migrationSql).toContain('FOR SELECT');
    expect(migrationSql).toContain('TO authenticated');
    expect(migrationSql).toContain("bucket_id = 'org-media' AND public.is_active_profile()");
    expect(migrationSql).not.toMatch(/CREATE POLICY[\s\S]*FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);

    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.guard_organizations_media_urls()');
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain('SET search_path = public');
    expect(migrationSql).toContain(
      'REVOKE ALL ON FUNCTION public.guard_organizations_media_urls() FROM PUBLIC, anon, authenticated;'
    );
    expect(migrationSql).toContain('CREATE TRIGGER trg_organizations_guard_media_urls');
    expect(migrationSql).toContain('BEFORE INSERT OR UPDATE ON public.organizations');
    expect(migrationSql).toContain('/storage/v1/object/public/org-media/orgs/');
    expect(migrationSql).toContain('/logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$');
    expect(migrationSql).toContain('/cover/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$');
    expect(migrationSql).toContain("USING ERRCODE = '23514'");
  });

  it('configures org-media bucket and compress-image function in supabase/config.toml', () => {
    expect(configToml).toMatch(
      /\[storage\.buckets\.org-media\][\s\S]*public\s*=\s*true[\s\S]*file_size_limit\s*=\s*"5MiB"[\s\S]*allowed_mime_types\s*=\s*\["image\/webp"\]/
    );
    expect(configToml).toMatch(/\[functions\.compress-image\]\s*\r?\nverify_jwt\s*=\s*false/);
  });

  it('wires magick-wasm ResourceLimits, explicit MagickFormat, isolate caching, runtime helpers, and Deno.serve in index.ts & deno.json', () => {
    expect(denoConfig.imports['@supabase/supabase-js']).toMatch(/^npm:@supabase\/supabase-js@/);
    expect(denoConfig.imports['@imagemagick/magick-wasm']).toMatch(/^npm:@imagemagick\/magick-wasm@/);

    expect(denoEntrypoint).toContain('initializeImageMagick');
    expect(denoEntrypoint).toContain('ResourceLimits');
    expect(denoEntrypoint).toContain('ResourceLimits.width = BigInt(8192);');
    expect(denoEntrypoint).toContain('ResourceLimits.height = BigInt(8192);');
    expect(denoEntrypoint).toContain('ResourceLimits.area = BigInt(32_000_000);');
    expect(denoEntrypoint).toContain('ResourceLimits.memory = BigInt(64 * 1024 * 1024);');
    expect(denoEntrypoint).toContain('ResourceLimits.disk = BigInt(0);');
    expect(denoEntrypoint).toContain('ResourceLimits.listLength = BigInt(1);');
    expect(denoEntrypoint).toContain('ResourceLimits.time = BigInt(15);');
    expect(denoEntrypoint).toContain('MagickFormat.Jpeg');
    expect(denoEntrypoint).toContain('MagickFormat.Png');
    expect(denoEntrypoint).toContain('MagickFormat.WebP');
    expect(denoEntrypoint).toContain('ImageMagick.read(input.bytes, sourceFormat, (image) => {');
    expect(denoEntrypoint).toContain('image.autoOrient()');
    expect(denoEntrypoint).toContain('image.strip()');
    expect(denoEntrypoint).toContain('geometry.greater = true');
    expect(denoEntrypoint).toContain('resolveRuntimeEnv');
    expect(denoEntrypoint).toContain('loadWasmBytes');
    expect(denoEntrypoint).toContain('cachedRuntime');
    expect(denoEntrypoint).toContain('expectedJwtIssuer: runtimeEnv.expectedJwtIssuer');
    expect(denoEntrypoint).toContain('authClient.auth.getUser');
    expect(denoEntrypoint).toContain('handleCompressImageRequest');
    expect(denoEntrypoint).toContain('Deno.serve');
  });

  it('verifies rolled-back org-media SQL storage RLS & media URL guard trigger test script', () => {
    expect(storageTestSql).toMatch(/^\s*BEGIN;/m);
    expect(storageTestSql).toMatch(/ROLLBACK;\s*$/);
    expect(storageTestSql).toContain('storage.buckets');
    expect(storageTestSql).toContain('pg_policies');
    expect(storageTestSql).toContain('org_media_select_authenticated');
    expect(storageTestSql).toContain('guard_organizations_media_urls');
    expect(storageTestSql).toContain('prosecdef');
    expect(storageTestSql).toContain('trg_organizations_guard_media_urls');
    expect(storageTestSql).toContain('https://evil.example/track.png');
    expect(storageTestSql).toContain('Cross-org org-media logo_url');
    expect(storageTestSql).toContain('SET LOCAL ROLE authenticated');
    expect(storageTestSql).toContain('insufficient_privilege');
    expect(storageTestSql).toContain('check_violation');
  });

  it('validates compress-image Postman v2.1 collection structure, assertions, and zero secrets', () => {
    type PostmanItem = {
      name: string;
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
    expect(collection.item.map((folder) => folder.name)).toEqual([
      'CORS & Auth (JWT)',
      'RBAC (Role & Org Scope)',
      'MIME & Size Validation',
      'Authorized WebP Upload',
    ]);

    const variableKeys = collection.variable.map((v) => v.key);
    for (const requiredVar of [
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
      'ALLOWED_ORIGIN',
      'STUDENT_JWT',
      'OFFICER_A_JWT',
      'OFFICER_B_JWT',
      'ADMIN_JWT',
      'ORG_A_ID',
      'VALID_PNG_PATH',
      'OVERSIZED_FILE_PATH',
      'SPOOFED_SVG_PATH',
    ]) {
      expect(variableKeys).toContain(requiredVar);
    }
    for (const variable of collection.variable) {
      expect(variable.value).toBe('');
    }
    expect(postmanRaw).not.toMatch(/sb_secret_|eyJhbGciOi/);

    const requests = collection.item.flatMap((folder) => folder.item);
    const scripts = requests
      .map((r) => r.event?.find((e) => e.listen === 'test')?.script.exec.join('\n') ?? '')
      .join('\n');

    for (const expectedStatus of ['403', '401', '415', '413', '400', '201']) {
      expect(scripts).toContain(`have.status(${expectedStatus})`);
    }
    expect(scripts).toContain("to.equal('image/webp')");
    expect(scripts).toContain("to.equal('org-media')");
    expect(scripts).toContain('exifStripped');
    expect(scripts).toContain('5242880');
  });
});
