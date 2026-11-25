import { z } from 'zod';
import {
  normalizeInstitutionalEmail,
  PublicProfileDtoSchema,
  type PublicProfileDto,
  toPublicProfileDto,
} from './auth';

function isValidSupabaseUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return false;
  }

  if (parsed.protocol === 'https:') {
    return true;
  }

  return (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  );
}

function isServiceRoleJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const payloadSegment = parts[1];
  if (!payloadSegment || !/^[A-Za-z0-9_-]+$/.test(payloadSegment)) {
    return false;
  }

  const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return (
      typeof decoded === 'object' &&
      decoded !== null &&
      (decoded as { role?: unknown }).role === 'service_role'
    );
  } catch {
    return false;
  }
}

export const WebAdminEnvSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .trim()
    .url('VITE_SUPABASE_URL must be a valid URL.')
    .refine(
      isValidSupabaseUrl,
      'VITE_SUPABASE_URL must use https:// (or http://localhost / http://127.0.0.1 for local development).'
    ),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is required.')
    .refine(
      (value) => !value.toLowerCase().startsWith('sb_secret_'),
      'Backend secret keys (sb_secret_*) must never be used in web-admin.'
    )
    .refine(
      (value) => !isServiceRoleJwt(value),
      'Supabase service_role JWTs must never be used in web-admin.'
    ),
});
export type WebAdminEnv = z.infer<typeof WebAdminEnvSchema>;

export const AdminProfileDtoSchema = PublicProfileDtoSchema.extend({
  role: z.literal('admin'),
}).strict();
export type AdminProfileDto = z.infer<typeof AdminProfileDtoSchema>;

export const WebAdminRouteSchema = z.enum(['/', '/login', '/access-denied']);
export type WebAdminRoute = z.infer<typeof WebAdminRouteSchema>;

export type BlockedAdminRole = 'student' | 'officer' | 'unprovisioned';

export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; message?: string; noticeTone?: 'error' | 'info' }
  | {
      status: 'forbidden';
      email: string;
      role: BlockedAdminRole;
      reason: string;
    }
  | { status: 'authenticated'; profile: AdminProfileDto };

export function formatWebAdminError(err: unknown, fallback: string): string {
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? fallback;
  }
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message;
  }
  return fallback;
}

export type AdminAccessEvaluation =
  | { allowed: true; profile: AdminProfileDto }
  | {
      allowed: false;
      email: string;
      role: BlockedAdminRole;
      reason: string;
    };

export interface WebAdminRouteResolution {
  route: WebAdminRoute;
  redirectTo: WebAdminRoute | null;
}

export function evaluateAdminAccess(
  profile: PublicProfileDto | null,
  fallbackEmail?: string
): AdminAccessEvaluation {
  if (!profile) {
    return {
      allowed: false,
      email: fallbackEmail ? normalizeInstitutionalEmail(fallbackEmail) : '',
      role: 'unprovisioned',
      reason: 'Your institutional account does not have an active MyCCS profile provisioned yet.',
    };
  }

  const safeProfile = toPublicProfileDto(profile);

  if (safeProfile.role === 'admin') {
    return {
      allowed: true,
      profile: AdminProfileDtoSchema.parse(safeProfile),
    };
  }

  if (safeProfile.role === 'officer') {
    return {
      allowed: false,
      email: safeProfile.email,
      role: 'officer',
      reason:
        'MyCCS Web Admin is restricted to CCS Department Admins and Faculty. Organization officers must use the MyCCS mobile app.',
    };
  }

  return {
    allowed: false,
    email: safeProfile.email,
    role: 'student',
    reason:
      'MyCCS Web Admin is restricted to CCS Department Admins and Faculty. Student accounts must use the MyCCS mobile app.',
  };
}

function normalizePathname(rawPathname: string): string {
  const trimmed = rawPathname.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  const withoutTrailingSlashes = trimmed.replace(/\/+$/, '');
  if (!withoutTrailingSlashes) {
    return '/';
  }
  return withoutTrailingSlashes.startsWith('/')
    ? withoutTrailingSlashes
    : `/${withoutTrailingSlashes}`;
}

export function resolveWebAdminRoute(
  pathname: string,
  state: AdminSessionState
): WebAdminRouteResolution {
  const normalized = normalizePathname(pathname);
  const parsedRoute = WebAdminRouteSchema.safeParse(normalized);
  const knownRoute: WebAdminRoute | null = parsedRoute.success ? parsedRoute.data : null;

  switch (state.status) {
    case 'loading':
      return {
        route: knownRoute ?? '/',
        redirectTo: null,
      };
    case 'unauthenticated':
      if (knownRoute === '/login') {
        return { route: '/login', redirectTo: null };
      }
      return { route: '/login', redirectTo: '/login' };
    case 'forbidden':
      if (knownRoute === '/access-denied') {
        return { route: '/access-denied', redirectTo: null };
      }
      return { route: '/access-denied', redirectTo: '/access-denied' };
    case 'authenticated':
      if (knownRoute === '/') {
        return { route: '/', redirectTo: null };
      }
      return { route: '/', redirectTo: '/' };
  }
}
