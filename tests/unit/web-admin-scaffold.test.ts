import {
  AdminProfileDtoSchema,
  assertPublishableClientKey,
  DepartmentInfoSchema,
  evaluateAdminAccess,
  formatWebAdminError,
  generateOpaqueQrToken,
  InstitutionalEmailSchema,
  resolveWebAdminRoute,
  WebAdminEnvSchema,
  WebAdminRouteSchema,
  type AdminSessionState,
} from '../../shared';
import type { PublicProfileDto } from '../../shared/auth';
import {
  getAllowedOriginsFromEnv,
  handleCorsPreflight,
  parseAllowedOrigins,
  resolveCorsHeaders,
  WEB_ADMIN_ALLOWED_ORIGINS_ENV,
  withCorsJson,
} from '../../supabase/functions/_shared/cors';

declare const require: (id: string) => unknown;
declare const __dirname: string;

const nodeFs = require('node:fs') as {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
};
const nodePath = require('node:path') as {
  resolve(...segments: string[]): string;
};

const REPO_ROOT = nodePath.resolve(__dirname, '../..');
const PROFILE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_QR_TOKEN = `v1.${PROFILE_ID}.0123456789abcdef01234567`;

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.synthetic_signature`;
}

function buildProfile(role: PublicProfileDto['role']): PublicProfileDto {
  return {
    id: PROFILE_ID,
    email: `${role}@lpunetwork.edu.ph`,
    fullName: `CCS ${role}`,
    role,
    qrToken: VALID_QR_TOKEN,
    keyVersion: 1,
  };
}

describe('spec-03-web-admin-scaffold (SCRUM-12)', () => {
  describe('shared/web-admin contracts & shared/index re-exports', () => {
    it('re-exports core shared modules from shared/index.ts', () => {
      expect(InstitutionalEmailSchema.parse('Dean@LPUNetwork.edu.ph')).toBe(
        'dean@lpunetwork.edu.ph'
      );
      expect(typeof DepartmentInfoSchema.parse).toBe('function');
      expect(typeof generateOpaqueQrToken).toBe('function');
      expect(WebAdminRouteSchema.options).toEqual(['/', '/login', '/access-denied']);
    });

    it('accepts valid Supabase-hosted HTTPS and local HTTP env configs with publishable or anon keys', () => {
      const prodCo = WebAdminEnvSchema.parse({
        VITE_SUPABASE_URL: 'https://myccs-project.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_client_key',
      });
      expect(prodCo.VITE_SUPABASE_URL).toBe('https://myccs-project.supabase.co');

      const prodIn = WebAdminEnvSchema.parse({
        VITE_SUPABASE_URL: 'https://myccs-project.supabase.in:443',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_client_key',
      });
      expect(prodIn.VITE_SUPABASE_URL).toBe('https://myccs-project.supabase.in:443');

      const local = WebAdminEnvSchema.parse({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: makeFakeJwt({ role: 'anon', iss: 'supabase' }),
      });
      expect(local.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321');

      const localhost = WebAdminEnvSchema.parse({
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'not.valid-json-payload.segment',
      });
      expect(localhost.VITE_SUPABASE_URL).toBe('http://localhost:54321');
    });

    it('rejects non-Supabase HTTPS hosts, insecure URLs, embedded credentials, sb_secret_* keys, and service_role JWTs', () => {
      for (const badUrl of [
        'https://custom.example.com',
        'https://supabase.co',
        'https://evil-supabase.co',
        'https://myccs-project.supabase.co:8443',
        'https://myccs-project.supabase.in:8443',
        'https://myccs-project.supabase.co/extra',
        'https://myccs-project.supabase.co?foo=bar',
        'https://myccs-project.supabase.co#section',
        'http://myccs-project.supabase.co',
        'http://localhost.evil.com',
        'https://user:pass@myccs-project.supabase.co',
        'not-a-url',
      ]) {
        expect(
          WebAdminEnvSchema.safeParse({
            VITE_SUPABASE_URL: badUrl,
            VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ok',
          }).success
        ).toBe(false);
      }

      const serviceRoleJwt = makeFakeJwt({
        role: 'service_role',
        iss: 'supabase',
      });

      expect(
        WebAdminEnvSchema.safeParse({
          VITE_SUPABASE_URL: 'https://myccs-project.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_ship_to_browser',
        }).success
      ).toBe(false);

      expect(
        WebAdminEnvSchema.safeParse({
          VITE_SUPABASE_URL: 'https://myccs-project.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: serviceRoleJwt,
        }).success
      ).toBe(false);

      expect(
        WebAdminEnvSchema.safeParse({
          VITE_SUPABASE_URL: 'https://myccs-project.supabase.co',
          VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
        }).success
      ).toBe(false);

      expect(() => assertPublishableClientKey(undefined)).not.toThrow();
      expect(() => assertPublishableClientKey('   ')).not.toThrow();
      expect(() => assertPublishableClientKey('sb_publishable_ok')).not.toThrow();
      expect(() => assertPublishableClientKey('a..c')).not.toThrow();
      expect(() => assertPublishableClientKey('sb_secret_build_leak')).toThrow(/sb_secret_/);
      expect(() => assertPublishableClientKey(serviceRoleJwt)).toThrow(/service_role/);
    });

    it('enforces strict admin profile schema without student_id', () => {
      const admin = AdminProfileDtoSchema.parse(buildProfile('admin'));
      expect(admin.role).toBe('admin');

      expect(AdminProfileDtoSchema.safeParse(buildProfile('student')).success).toBe(false);
      expect(
        AdminProfileDtoSchema.safeParse({
          ...buildProfile('admin'),
          student_id: '2026-0001',
        }).success
      ).toBe(false);
    });

    it('evaluates admin access strictly and strips private student_id', () => {
      const adminInput = {
        ...buildProfile('admin'),
        student_id: '2026-9999',
      } as PublicProfileDto;
      const allowed = evaluateAdminAccess(adminInput);
      expect(allowed.allowed).toBe(true);
      if (allowed.allowed) {
        expect(allowed.profile.role).toBe('admin');
        expect('student_id' in allowed.profile).toBe(false);
      }

      const studentResult = evaluateAdminAccess(buildProfile('student'));
      expect(studentResult).toEqual({
        allowed: false,
        email: 'student@lpunetwork.edu.ph',
        role: 'student',
        reason: expect.stringContaining('Student'),
      });

      const officerResult = evaluateAdminAccess(buildProfile('officer'));
      expect(officerResult).toEqual({
        allowed: false,
        email: 'officer@lpunetwork.edu.ph',
        role: 'officer',
        reason: expect.stringContaining('officer'),
      });

      const unprovisioned = evaluateAdminAccess(null, '  NewFaculty@LPUNetwork.edu.ph ');
      expect(unprovisioned).toEqual({
        allowed: false,
        email: 'newfaculty@lpunetwork.edu.ph',
        role: 'unprovisioned',
        reason: expect.stringContaining('provisioned'),
      });

      const unprovisionedNoEmail = evaluateAdminAccess(null);
      expect(unprovisionedNoEmail.allowed).toBe(false);
      if (!unprovisionedNoEmail.allowed) {
        expect(unprovisionedNoEmail.email).toBe('');
      }
    });

    it('resolves routes deterministically for all AdminSessionState variants', () => {
      const loading: AdminSessionState = { status: 'loading' };
      expect(resolveWebAdminRoute('/login/', loading)).toEqual({
        route: '/login',
        redirectTo: null,
      });
      expect(resolveWebAdminRoute('/unknown', loading)).toEqual({
        route: '/',
        redirectTo: null,
      });
      expect(resolveWebAdminRoute('///', loading)).toEqual({
        route: '/',
        redirectTo: null,
      });

      const unauthenticated: AdminSessionState = { status: 'unauthenticated' };
      expect(resolveWebAdminRoute('/login', unauthenticated)).toEqual({
        route: '/login',
        redirectTo: null,
      });
      expect(resolveWebAdminRoute('login', unauthenticated)).toEqual({
        route: '/login',
        redirectTo: null,
      });
      expect(resolveWebAdminRoute('/', unauthenticated)).toEqual({
        route: '/login',
        redirectTo: '/login',
      });
      expect(resolveWebAdminRoute('/access-denied', unauthenticated)).toEqual({
        route: '/login',
        redirectTo: '/login',
      });

      const forbidden: AdminSessionState = {
        status: 'forbidden',
        email: 'student@lpunetwork.edu.ph',
        role: 'student',
        reason: 'Admin only',
      };
      expect(resolveWebAdminRoute('/access-denied', forbidden)).toEqual({
        route: '/access-denied',
        redirectTo: null,
      });
      expect(resolveWebAdminRoute('/login', forbidden)).toEqual({
        route: '/access-denied',
        redirectTo: '/access-denied',
      });
      expect(resolveWebAdminRoute('/', forbidden)).toEqual({
        route: '/access-denied',
        redirectTo: '/access-denied',
      });

      const authenticated: AdminSessionState = {
        status: 'authenticated',
        profile: AdminProfileDtoSchema.parse(buildProfile('admin')),
      };
      expect(resolveWebAdminRoute('/', authenticated)).toEqual({
        route: '/',
        redirectTo: null,
      });
      expect(resolveWebAdminRoute('/login', authenticated)).toEqual({
        route: '/',
        redirectTo: '/',
      });
      expect(resolveWebAdminRoute('/access-denied', authenticated)).toEqual({
        route: '/',
        redirectTo: '/',
      });
      expect(resolveWebAdminRoute('/does-not-exist', authenticated)).toEqual({
        route: '/',
        redirectTo: '/',
      });
    });

    it('formats ZodError, Error, and unknown throwables without leaking raw Zod JSON', () => {
      const badEnv = WebAdminEnvSchema.safeParse({
        VITE_SUPABASE_URL: 'http://remote.example.com',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ok',
      });
      expect(badEnv.success).toBe(false);
      if (!badEnv.success) {
        const formatted = formatWebAdminError(badEnv.error, 'Fallback');
        expect(formatted).toContain('https://');
        expect(formatted.trim().startsWith('[')).toBe(false);
      }

      expect(formatWebAdminError(new Error('Network down'), 'Fallback')).toBe('Network down');
      expect(formatWebAdminError(new Error('   '), 'Fallback')).toBe('Fallback');
      expect(formatWebAdminError('unexpected', 'Fallback')).toBe('Fallback');
    });
  });

  describe('supabase/functions/_shared/cors.ts fail-closed CORS allowlist', () => {
    it('parses, normalizes, and deduplicates valid HTTPS and local HTTP origins', () => {
      expect(parseAllowedOrigins(undefined)).toEqual([]);
      expect(parseAllowedOrigins(null)).toEqual([]);
      expect(parseAllowedOrigins('  ,  ')).toEqual([]);

      expect(
        parseAllowedOrigins(
          'https://myccs-admin.pages.dev/, http://localhost:5173, http://127.0.0.1:4173, https://myccs-admin.pages.dev'
        )
      ).toEqual([
        'https://myccs-admin.pages.dev',
        'http://localhost:5173',
        'http://127.0.0.1:4173',
      ]);
    });

    it('rejects wildcards, malformed URLs, credentials, paths, queries, hashes, and remote HTTP', () => {
      const invalidInputs = [
        '*',
        'https://*.pages.dev',
        'not-a-valid-url',
        'https://user:pass@myccs-admin.pages.dev',
        'https://myccs-admin.pages.dev/admin',
        'https://myccs-admin.pages.dev?foo=bar',
        'https://myccs-admin.pages.dev#section',
        'http://myccs-admin.pages.dev',
        'http://localhost.evil.com:5173',
      ];

      for (const badOrigin of invalidInputs) {
        expect(() => parseAllowedOrigins(badOrigin)).toThrow();
      }
    });

    it('reads WEB_ADMIN_ALLOWED_ORIGINS from custom reader or Deno.env fallback', () => {
      expect(
        getAllowedOriginsFromEnv((name) =>
          name === WEB_ADMIN_ALLOWED_ORIGINS_ENV
            ? 'https://myccs-admin.pages.dev'
            : undefined
        )
      ).toEqual(['https://myccs-admin.pages.dev']);

      const originalDeno = (globalThis as { Deno?: unknown }).Deno;
      try {
        (globalThis as { Deno?: unknown }).Deno = {
          env: {
            get: (key: string) =>
              key === WEB_ADMIN_ALLOWED_ORIGINS_ENV
                ? 'http://127.0.0.1:5173'
                : undefined,
          },
        };
        expect(getAllowedOriginsFromEnv()).toEqual(['http://127.0.0.1:5173']);

        delete (globalThis as { Deno?: unknown }).Deno;
        expect(getAllowedOriginsFromEnv()).toEqual([]);
      } finally {
        if (originalDeno !== undefined) {
          (globalThis as { Deno?: unknown }).Deno = originalDeno;
        } else {
          delete (globalThis as { Deno?: unknown }).Deno;
        }
      }
    });

    it('resolves exact matches and fails closed for missing, unlisted, or wildcard origins', () => {
      const allowed = ['https://myccs-admin.pages.dev', 'http://localhost:5173'];

      const ok = resolveCorsHeaders('https://myccs-admin.pages.dev', allowed);
      expect(ok.allowed).toBe(true);
      expect(ok.headers['Access-Control-Allow-Origin']).toBe('https://myccs-admin.pages.dev');
      expect(ok.headers.Vary).toBe('Origin');
      expect(ok.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');

      const missing = resolveCorsHeaders(null, allowed);
      expect(missing.allowed).toBe(false);
      expect(missing.headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(missing.headers.Vary).toBe('Origin');

      const unlisted = resolveCorsHeaders('https://evil.example.com', allowed);
      expect(unlisted.allowed).toBe(false);
      expect(unlisted.headers['Access-Control-Allow-Origin']).toBeUndefined();

      const wildcardAttempt = resolveCorsHeaders('*', ['*']);
      expect(wildcardAttempt.allowed).toBe(false);
      expect(wildcardAttempt.headers['Access-Control-Allow-Origin']).toBeUndefined();

      const normalizedMatch = resolveCorsHeaders('https://MYCCS-ADMIN.pages.dev/', [
        'https://myccs-admin.pages.dev/',
      ]);
      expect(normalizedMatch.allowed).toBe(true);
      expect(normalizedMatch.headers['Access-Control-Allow-Origin']).toBe(
        'https://myccs-admin.pages.dev'
      );

      const badRequestOrigin = resolveCorsHeaders('http://evil.example.com', [
        'http://evil.example.com',
      ]);
      expect(badRequestOrigin.allowed).toBe(false);
      expect(badRequestOrigin.headers['Access-Control-Allow-Origin']).toBeUndefined();

      const rawInvalidAllowed = resolveCorsHeaders('https://myccs-admin.pages.dev', [
        '*',
        'not-a-url',
        'https://myccs-admin.pages.dev',
      ]);
      expect(rawInvalidAllowed.allowed).toBe(true);
    });

    it('handles OPTIONS preflight with 204 for allowed and 403 for disallowed origins', async () => {
      const allowed = ['https://myccs-admin.pages.dev'];

      const getReq = new Request('https://api.supabase.test/functions/v1/demo', {
        method: 'GET',
        headers: { Origin: 'https://myccs-admin.pages.dev' },
      });
      expect(handleCorsPreflight(getReq, allowed)).toBeNull();

      const allowedPreflight = handleCorsPreflight(
        new Request('https://api.supabase.test/functions/v1/demo', {
          method: 'OPTIONS',
          headers: { Origin: 'https://myccs-admin.pages.dev' },
        }),
        allowed
      );
      expect(allowedPreflight?.status).toBe(204);
      expect(allowedPreflight?.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://myccs-admin.pages.dev'
      );
      expect(allowedPreflight?.headers.get('Vary')).toBe('Origin');

      const deniedPreflight = handleCorsPreflight(
        new Request('https://api.supabase.test/functions/v1/demo', {
          method: 'OPTIONS',
          headers: { Origin: 'https://evil.example.com' },
        }),
        allowed
      );
      expect(deniedPreflight?.status).toBe(403);
      expect(deniedPreflight?.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(deniedPreflight?.headers.get('Vary')).toBe('Origin');
      await expect(deniedPreflight?.json()).resolves.toEqual({
        error: 'Origin not allowed.',
      });
    });

    it('wraps JSON responses with CORS headers and merges Vary safely', async () => {
      const allowed = ['https://myccs-admin.pages.dev'];

      const okRes = withCorsJson(
        { ok: true },
        { status: 200, headers: { Vary: 'Accept-Encoding' } },
        'https://myccs-admin.pages.dev',
        allowed
      );
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://myccs-admin.pages.dev'
      );
      expect(okRes.headers.get('Vary')).toBe('Accept-Encoding, Origin');
      await expect(okRes.json()).resolves.toEqual({ ok: true });

      const deniedRes = withCorsJson(
        { ok: false },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            Vary: 'Origin',
          },
        },
        'https://evil.example.com',
        allowed
      );
      expect(deniedRes.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(deniedRes.headers.get('Vary')).toBe('Origin');
    });
  });

  describe('mobile isolation, Supabase config, and Cloudflare Pages hardening', () => {
    it('blocks web-admin paths in metro.config.js without blocking mobile or shared files', () => {
      const metroConfig = require(nodePath.resolve(REPO_ROOT, 'metro.config.js')) as {
        resolver: { blockList: RegExp[] };
      };
      const patterns = metroConfig.resolver.blockList;
      expect(Array.isArray(patterns)).toBe(true);

      const isBlocked = (candidatePath: string) =>
        patterns.some((pattern) => pattern.test(candidatePath));

      const webAdminPosix = `${REPO_ROOT.replace(/\\/g, '/')}/web-admin/index.html`;
      const webAdminWin = `${REPO_ROOT.replace(/\//g, '\\')}\\web-admin\\src\\main.tsx`;

      expect(isBlocked(nodePath.resolve(REPO_ROOT, 'web-admin', 'src', 'App.tsx'))).toBe(true);
      expect(isBlocked(webAdminWin)).toBe(true);
      expect(isBlocked(webAdminPosix)).toBe(true);

      expect(isBlocked('/worktrees/web-admin/MyCCS/App.tsx')).toBe(false);
      expect(isBlocked('D:\\worktrees\\web-admin\\MyCCS\\src\\services\\auth.ts')).toBe(false);
      expect(isBlocked(nodePath.resolve(REPO_ROOT, 'shared', 'web-admin.ts'))).toBe(false);
      expect(isBlocked(nodePath.resolve(REPO_ROOT, 'App.tsx'))).toBe(false);
      expect(isBlocked(nodePath.resolve(REPO_ROOT, 'src', 'services', 'auth.ts'))).toBe(false);
      expect(
        isBlocked(nodePath.resolve(REPO_ROOT, 'tests', 'unit', 'web-admin-scaffold.test.ts'))
      ).toBe(false);
    });

    it('preserves secret ignores and excludes web-admin and E2E artifacts in .easignore', () => {
      const easignore = nodeFs.readFileSync(nodePath.resolve(REPO_ROOT, '.easignore'), 'utf8');
      const lines = easignore.split(/\r?\n/).map((line) => line.trim());

      expect(lines).toContain('.env');
      expect(lines).toContain('.env.*');
      expect(lines).toContain('!.env.example');
      expect(lines).toContain('*.key');
      expect(lines).toContain('*.pem');
      expect(lines).toContain('*.p12');
      expect(lines).toContain('/web-admin/');
      expect(lines).toContain('/tests/e2e/');
      expect(lines).toContain('/playwright-report/');
      expect(lines).toContain('/test-results/');
    });

    it('registers local Vite redirect URLs and development seed glob in supabase/config.toml', () => {
      const configToml = nodeFs.readFileSync(
        nodePath.resolve(REPO_ROOT, 'supabase/config.toml'),
        'utf8'
      );
      expect(configToml).toContain('"http://127.0.0.1:5173"');
      expect(configToml).toContain('"http://localhost:5173"');
      expect(configToml).toContain('sql_paths = ["./seed.sql", "./development/*.sql"]');

      const devSeedSql = nodeFs.readFileSync(
        nodePath.resolve(REPO_ROOT, 'supabase/development/01_web_admin_placeholder_data.sql'),
        'utf8'
      );
      expect(devSeedSql).toContain('LOCAL DEVELOPMENT ONLY');
      expect(devSeedSql).toContain('dev.admin@lpunetwork.edu.ph');
      expect(devSeedSql).toContain('dev.student@lpunetwork.edu.ph');
      expect(devSeedSql).toContain('dev.officer@lpunetwork.edu.ph');
      expect(devSeedSql).toContain('dev.unprovisioned@lpunetwork.edu.ph');
      expect(devSeedSql).toContain('public.get_identity_secret');
      expect(devSeedSql).toContain('extensions.pgp_sym_encrypt');
      expect(
        nodeFs.existsSync(nodePath.resolve(REPO_ROOT, 'supabase/migrations/development'))
      ).toBe(false);
    });

    it('configures Cloudflare Pages deployment securely with zero backend secrets', () => {
      const wrangler = JSON.parse(
        nodeFs.readFileSync(nodePath.resolve(REPO_ROOT, 'web-admin/wrangler.jsonc'), 'utf8')
      ) as { name: string; pages_build_output_dir: string };
      expect(wrangler.name).toBe('myccs-web-admin');
      expect(wrangler.pages_build_output_dir).toBe('./dist');

      const headersFile = nodeFs.readFileSync(
        nodePath.resolve(REPO_ROOT, 'web-admin/public/_headers'),
        'utf8'
      );
      expect(headersFile).toContain('X-Frame-Options: DENY');
      expect(headersFile).toContain('X-Content-Type-Options: nosniff');
      expect(headersFile).toContain('Referrer-Policy:');
      expect(headersFile).toContain('Permissions-Policy:');
      expect(headersFile).toContain('X-Robots-Tag: noindex, nofollow');
      expect(headersFile).toContain("frame-ancestors 'none'");

      expect(
        nodeFs.existsSync(nodePath.resolve(REPO_ROOT, 'web-admin/public/404.html'))
      ).toBe(false);

      const viteConfig = nodeFs.readFileSync(
        nodePath.resolve(REPO_ROOT, 'web-admin/vite.config.ts'),
        'utf8'
      );
      expect(viteConfig).toContain('assertPublishableClientKey');
      expect(viteConfig).toContain('loadEnv');
    });
  });
});
