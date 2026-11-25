import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type ProfileProjectionInput,
  type PublicProfileDto,
  SignInRequestSchema,
  toPublicProfileDto,
} from '@shared/auth';
import {
  type AdminSessionState,
  evaluateAdminAccess,
  formatWebAdminError,
} from '@shared/web-admin';

export interface WebAdminSupabaseClient {
  auth: Pick<
    SupabaseClient['auth'],
    'getSession' | 'signInWithPassword' | 'signOut' | 'onAuthStateChange'
  >;
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

let internalSignOutDepth = 0;

export function isInternalAdminSignOut(): boolean {
  return internalSignOutDepth > 0;
}

async function revokeLocalSessionSafely(client: WebAdminSupabaseClient): Promise<void> {
  internalSignOutDepth += 1;
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    return;
  } finally {
    internalSignOutDepth -= 1;
  }
}

async function fetchVerifiedProfile(
  client: WebAdminSupabaseClient
): Promise<PublicProfileDto | null> {
  const { data, error } = await client.rpc('get_my_profile');
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Unexpected profile payload returned by server.');
  }
  return toPublicProfileDto(data as ProfileProjectionInput);
}

async function resolveProfileSession(
  client: WebAdminSupabaseClient,
  fallbackEmail?: string
): Promise<AdminSessionState> {
  let profile: PublicProfileDto | null;
  try {
    profile = await fetchVerifiedProfile(client);
  } catch (err) {
    await revokeLocalSessionSafely(client);
    return {
      status: 'unauthenticated',
      message: formatWebAdminError(err, 'Unable to verify institutional profile.'),
      noticeTone: 'error',
    };
  }

  const access = evaluateAdminAccess(profile, fallbackEmail);
  if (access.allowed) {
    return { status: 'authenticated', profile: access.profile };
  }

  await revokeLocalSessionSafely(client);
  return {
    status: 'forbidden',
    email: access.email,
    role: access.role,
    reason: access.reason,
  };
}

export async function restoreAdminSession(
  client: WebAdminSupabaseClient
): Promise<AdminSessionState> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      return { status: 'unauthenticated', message: error.message, noticeTone: 'error' };
    }
    if (!data.session) {
      return { status: 'unauthenticated' };
    }
    return resolveProfileSession(client, data.session.user?.email);
  } catch (err) {
    return {
      status: 'unauthenticated',
      message: formatWebAdminError(err, 'Unable to read browser session storage.'),
      noticeTone: 'error',
    };
  }
}

export async function signInAsAdmin(
  client: WebAdminSupabaseClient,
  input: { email: string; password: string }
): Promise<AdminSessionState> {
  const parsed = SignInRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: 'unauthenticated',
      message:
        parsed.error.issues[0]?.message ??
        'Enter a valid @lpunetwork.edu.ph institutional email and password.',
      noticeTone: 'error',
    };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.session || !data.user) {
      return {
        status: 'unauthenticated',
        message: error?.message ?? 'Invalid institutional credentials.',
        noticeTone: 'error',
      };
    }

    return resolveProfileSession(client, data.user.email ?? parsed.data.email);
  } catch (err) {
    return {
      status: 'unauthenticated',
      message: formatWebAdminError(err, 'Unable to complete sign-in.'),
      noticeTone: 'error',
    };
  }
}

export async function signOutAdmin(
  client: WebAdminSupabaseClient
): Promise<AdminSessionState> {
  await revokeLocalSessionSafely(client);
  return {
    status: 'unauthenticated',
    message: 'You have been signed out of MyCCS Web Admin.',
    noticeTone: 'info',
  };
}
