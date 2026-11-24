import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  type PublicProfileDto,
  SignInRequestSchema,
  type SignInRequest,
  SignupRequestSchema,
  type SignupRequest,
  toPublicProfileDto,
  type UserRole,
  VerifyOtpRequestSchema,
  type VerifyOtpRequest,
} from '../../shared/auth';

export type AuthSessionUser = Pick<User, 'id' | 'email'>;
export type AuthSession = Partial<Pick<Session, 'access_token'>> & {
  user?: AuthSessionUser;
};

export interface AuthSupabaseClient {
  auth: Pick<
    SupabaseClient['auth'],
    'signUp' | 'verifyOtp' | 'signInWithPassword' | 'signOut' | 'getSession'
  >;
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

const ProvisionProfileInputSchema = SignupRequestSchema.pick({
  fullName: true,
  studentId: true,
});

interface ProvisionedProfileRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  qrToken: string;
  keyVersion: number;
}

export async function provisionCurrentUserProfile(
  client: AuthSupabaseClient,
  input: { fullName: string; studentId: string }
): Promise<PublicProfileDto> {
  const parsed = ProvisionProfileInputSchema.parse(input);
  const { data: rpcData, error: rpcError } = await client.rpc('provision_profile', {
    p_full_name: parsed.fullName,
    p_student_id: parsed.studentId,
  });

  if (rpcError || !rpcData) {
    throw new Error(rpcError?.message ?? 'Failed to provision encrypted profile.');
  }

  return toPublicProfileDto(rpcData as ProvisionedProfileRow);
}

export async function signUpWithInstitutionalEmail(
  client: AuthSupabaseClient,
  input: SignupRequest
): Promise<{ email: string; requiresOtpVerification: boolean }> {
  const parsed = SignupRequestSchema.parse(input);
  const { data, error } = await client.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: {
      data: { full_name: parsed.fullName },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    email: parsed.email,
    requiresOtpVerification: !data.session,
  };
}

export async function verifySignupOtpAndProvisionProfile(
  client: AuthSupabaseClient,
  input: VerifyOtpRequest & { fullName: string; studentId: string }
): Promise<PublicProfileDto> {
  const verified = VerifyOtpRequestSchema.parse({
    email: input.email,
    token: input.token,
  });
  const profileInput = ProvisionProfileInputSchema.parse({
    fullName: input.fullName,
    studentId: input.studentId,
  });

  const { data: otpData, error: otpError } = await client.auth.verifyOtp({
    email: verified.email,
    token: verified.token,
    type: 'signup',
  });

  if (otpError || !otpData.session || !otpData.user) {
    throw new Error(otpError?.message ?? 'Invalid or expired 6-digit OTP.');
  }

  return provisionCurrentUserProfile(client, profileInput);
}

export async function fetchCurrentProfile(
  client: AuthSupabaseClient
): Promise<PublicProfileDto | null> {
  const { data, error } = await client.rpc('get_my_profile');
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return toPublicProfileDto(data as ProvisionedProfileRow);
}

export async function signInWithInstitutionalEmail(
  client: AuthSupabaseClient,
  input: SignInRequest
): Promise<{
  session: AuthSession;
  user: AuthSessionUser;
  profile: PublicProfileDto | null;
}> {
  const parsed = SignInRequestSchema.parse(input);
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? 'Invalid institutional credentials.');
  }

  const profile = await fetchCurrentProfile(client);
  return { session: data.session, user: data.user, profile };
}

export async function signOutCurrentSession(
  client: AuthSupabaseClient
): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function restoreAuthenticatedSession(
  client: AuthSupabaseClient
): Promise<{ session: AuthSession | null; profile: PublicProfileDto | null }> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  if (!data.session) {
    return { session: null, profile: null };
  }
  const profile = await fetchCurrentProfile(client);
  return { session: data.session, profile };
}
