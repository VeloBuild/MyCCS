import { handleCorsPreflight, resolveCorsHeaders, withCorsJson } from './cors';

export interface SupabaseEdgeRuntimeEnv {
  supabaseUrl: string;
  publicStorageBaseUrl: string;
  serviceRoleKey: string;
  publishableKey: string;
  expectedJwtIssuer?: string;
}

export type JwtClaimValidationResult =
  | { ok: true; sub: string }
  | { ok: false; message: string };

export type BoundedBodyReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 413; message: string };

export type EdgeJsonResponder = (
  body: unknown,
  status: number,
  headers?: Record<string, string>
) => Response;

export interface EdgeAuthOptions {
  allowedMethod: string;
  allowedOrigins: readonly string[];
  supabaseUrl: string;
  expectedJwtIssuer?: string;
  verifyUser: (accessToken: string) => Promise<{ id: string; email?: string } | null>;
  nowSeconds?: () => number;
  defaultResponseHeaders?: Record<string, string>;
}

export type EdgeAuthResult =
  | {
      ok: true;
      userId: string;
      email?: string;
      origin: string | null;
      json: EdgeJsonResponder;
    }
  | { ok: false; response: Response };

const BASE64URL_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;
const BEARER_HEADER_REGEX = /^bearer\s+(\S+)$/i;

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }
  const match = BEARER_HEADER_REGEX.exec(authHeader.trim());
  return match ? match[1] : null;
}

export function resolvePublicStorageBaseUrl(
  supabaseUrl: string,
  configuredPublicUrl?: string | null,
  configuredJwtIssuer?: string | null
): string {
  const trimmedPublicUrl = configuredPublicUrl?.trim().replace(/\/+$/, '') ?? '';
  if (trimmedPublicUrl.length > 0) {
    return trimmedPublicUrl;
  }

  const trimmedJwtIssuer = configuredJwtIssuer?.trim().replace(/\/+$/, '') ?? '';
  if (trimmedJwtIssuer.length > 0) {
    const strippedIssuer = trimmedJwtIssuer
      .replace(/\/auth\/v1$/i, '')
      .replace(/\/+$/, '');
    if (strippedIssuer.length > 0) {
      return strippedIssuer;
    }
  }

  return supabaseUrl.trim().replace(/\/+$/, '');
}

export function resolveSupabaseRuntimeEnv(
  readEnv: (key: string) => string | undefined
): SupabaseEdgeRuntimeEnv | null {
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
  const configuredPublicUrl = readEnv('SUPABASE_PUBLIC_URL')?.trim() || undefined;
  const publicStorageBaseUrl = resolvePublicStorageBaseUrl(
    supabaseUrl,
    configuredPublicUrl,
    expectedJwtIssuer
  );

  return {
    supabaseUrl,
    publicStorageBaseUrl,
    serviceRoleKey,
    publishableKey,
    expectedJwtIssuer,
  };
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
  nowSeconds: number,
  options?: { exactIssuer?: boolean }
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
  const normalizedIssuer =
    options?.exactIssuer || trimmedIssuer.endsWith('/auth/v1')
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

export async function authenticateEdgeRequest(
  req: Request,
  opts: EdgeAuthOptions
): Promise<EdgeAuthResult> {
  const preflight = handleCorsPreflight(req, opts.allowedOrigins);
  if (preflight) {
    return { ok: false, response: preflight };
  }

  const origin = req.headers.get('origin');
  const defaultHeaders = opts.defaultResponseHeaders;
  const json: EdgeJsonResponder = (body, status, headers) =>
    withCorsJson(
      body,
      {
        status,
        headers: defaultHeaders ? { ...defaultHeaders, ...headers } : headers,
      },
      origin,
      opts.allowedOrigins
    );

  if (origin !== null && !resolveCorsHeaders(origin, opts.allowedOrigins).allowed) {
    return { ok: false, response: json({ error: 'Origin not allowed.' }, 403) };
  }

  const expectedMethod = opts.allowedMethod.toUpperCase();
  if (req.method.toUpperCase() !== expectedMethod) {
    return {
      ok: false,
      response: json({ error: 'Method not allowed.' }, 405, {
        Allow: `${expectedMethod}, OPTIONS`,
      }),
    };
  }

  const accessToken = extractBearerToken(req.headers.get('authorization'));
  if (!accessToken) {
    return {
      ok: false,
      response: json({ error: 'Missing or invalid Authorization bearer token.' }, 401),
    };
  }

  const nowSeconds = opts.nowSeconds
    ? opts.nowSeconds()
    : Math.floor(Date.now() / 1000);
  const expectedIssuer = resolveExpectedJwtIssuer(
    opts.supabaseUrl,
    opts.expectedJwtIssuer
  );
  const claimsResult = validateJwtClaims(accessToken, expectedIssuer, nowSeconds, {
    exactIssuer: true,
  });
  if (!claimsResult.ok) {
    return { ok: false, response: json({ error: claimsResult.message }, 401) };
  }

  let verifiedUser: { id: string; email?: string } | null = null;
  try {
    verifiedUser = await opts.verifyUser(accessToken);
  } catch {
    return {
      ok: false,
      response: json({ error: 'Authentication verification failed.' }, 401),
    };
  }

  if (
    !verifiedUser ||
    typeof verifiedUser.id !== 'string' ||
    verifiedUser.id.trim().length === 0
  ) {
    return {
      ok: false,
      response: json({ error: 'Invalid or revoked authentication token.' }, 401),
    };
  }

  const userId = verifiedUser.id.trim();
  if (userId !== claimsResult.sub) {
    return { ok: false, response: json({ error: 'Token subject mismatch.' }, 401) };
  }

  return {
    ok: true,
    userId,
    email: verifiedUser.email,
    origin,
    json,
  };
}

export async function readStreamWithLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  tooLargeMessage: string,
  malformedMessage: string
): Promise<BoundedBodyReadResult> {
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return {
      ok: false,
      status: 400,
      message: malformedMessage,
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
        void reader.cancel().catch(() => {});
        return {
          ok: false,
          status: 413,
          message: tooLargeMessage,
        };
      }
      chunks.push(value);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      message: malformedMessage,
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
