export const WEB_ADMIN_ALLOWED_ORIGINS_ENV = 'WEB_ADMIN_ALLOWED_ORIGINS';

const DEFAULT_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type';
const DEFAULT_ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

export interface CorsResolution {
  allowed: boolean;
  origin: string | null;
  headers: Record<string, string>;
}

interface DenoEnvGlobal {
  Deno?: {
    env?: {
      get(key: string): string | undefined;
    };
  };
}

function validateAndNormalizeOrigin(rawOrigin: string): string {
  const entry = rawOrigin.trim();
  if (entry === '*' || entry.includes('*')) {
    throw new Error('Wildcard CORS origins (*) are not permitted.');
  }
  if (entry.includes('?') || entry.includes('#')) {
    throw new Error(`CORS origin must not contain query or hash components: ${entry}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(entry);
  } catch {
    throw new Error(`Malformed CORS origin: ${entry}`);
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(`CORS origin must not include credentials: ${entry}`);
  }

  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`CORS origin must not contain a path, query, or hash: ${entry}`);
  }

  const isHttps = parsed.protocol === 'https:';
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

  if (!isHttps && !isLocalHttp) {
    throw new Error(
      `CORS origin must use https:// (except http://localhost or http://127.0.0.1): ${entry}`
    );
  }

  return parsed.origin;
}

export function parseAllowedOrigins(raw: string | undefined | null): string[] {
  if (!raw || raw.trim() === '') {
    return [];
  }

  const uniqueOrigins = new Set<string>();
  for (const segment of raw.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }
    uniqueOrigins.add(validateAndNormalizeOrigin(trimmed));
  }

  return Array.from(uniqueOrigins);
}

export function getAllowedOriginsFromEnv(
  readEnv?: (name: string) => string | undefined
): string[] {
  const raw = readEnv
    ? readEnv(WEB_ADMIN_ALLOWED_ORIGINS_ENV)
    : (globalThis as DenoEnvGlobal).Deno?.env?.get(WEB_ADMIN_ALLOWED_ORIGINS_ENV);

  return parseAllowedOrigins(raw);
}

function tryNormalizeOrigin(rawOrigin: string): string | null {
  try {
    return validateAndNormalizeOrigin(rawOrigin);
  } catch {
    return null;
  }
}

export function resolveCorsHeaders(
  requestOrigin: string | null,
  allowedOrigins: readonly string[]
): CorsResolution {
  if (!requestOrigin) {
    return {
      allowed: false,
      origin: null,
      headers: { Vary: 'Origin' },
    };
  }

  const normalizedRequestOrigin = tryNormalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) {
    return {
      allowed: false,
      origin: null,
      headers: { Vary: 'Origin' },
    };
  }

  const matched = allowedOrigins.some((origin) => {
    const normalizedAllowed = tryNormalizeOrigin(origin);
    return normalizedAllowed !== null && normalizedAllowed === normalizedRequestOrigin;
  });

  if (!matched) {
    return {
      allowed: false,
      origin: null,
      headers: { Vary: 'Origin' },
    };
  }

  return {
    allowed: true,
    origin: normalizedRequestOrigin,
    headers: {
      'Access-Control-Allow-Origin': normalizedRequestOrigin,
      'Access-Control-Allow-Headers': DEFAULT_ALLOW_HEADERS,
      'Access-Control-Allow-Methods': DEFAULT_ALLOW_METHODS,
      Vary: 'Origin',
    },
  };
}

export function handleCorsPreflight(
  req: Request,
  allowedOrigins: readonly string[]
): Response | null {
  if (req.method.toUpperCase() !== 'OPTIONS') {
    return null;
  }

  const resolution = resolveCorsHeaders(req.headers.get('origin'), allowedOrigins);
  if (resolution.allowed) {
    return new Response(null, {
      status: 204,
      headers: resolution.headers,
    });
  }

  return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
    headers: {
      ...resolution.headers,
      'Content-Type': 'application/json',
    },
  });
}

function appendVaryOrigin(headers: Headers): void {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', 'Origin');
    return;
  }
  const values = existing.split(',').map((item) => item.trim().toLowerCase());
  if (!values.includes('origin')) {
    headers.set('Vary', `${existing}, Origin`);
  }
}

export function withCorsJson(
  body: unknown,
  init: ResponseInit,
  requestOrigin: string | null,
  allowedOrigins: readonly string[]
): Response {
  const resolution = resolveCorsHeaders(requestOrigin, allowedOrigins);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (resolution.allowed) {
    headers.set('Access-Control-Allow-Origin', resolution.headers['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Headers', resolution.headers['Access-Control-Allow-Headers']);
    headers.set('Access-Control-Allow-Methods', resolution.headers['Access-Control-Allow-Methods']);
  } else {
    headers.delete('Access-Control-Allow-Origin');
  }

  appendVaryOrigin(headers);

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}
