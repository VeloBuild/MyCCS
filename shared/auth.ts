import { z } from 'zod';

const INSTITUTIONAL_EMAIL_DOMAIN = '@lpunetwork.edu.ph' as const;
const INSTITUTIONAL_EMAIL_REGEX = /^[a-z0-9._%+-]+@lpunetwork\.edu\.ph$/;
const OTP_CODE_REGEX = /^\d{6}$/;
const OPAQUE_QR_TOKEN_REGEX =
  /^v1\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{24}$/;

export function normalizeInstitutionalEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

export function isInstitutionalEmail(rawEmail: string): boolean {
  return INSTITUTIONAL_EMAIL_REGEX.test(normalizeInstitutionalEmail(rawEmail));
}

export const InstitutionalEmailSchema = z
  .string()
  .transform((value) => normalizeInstitutionalEmail(value))
  .refine((value) => INSTITUTIONAL_EMAIL_REGEX.test(value), {
    message: `Signup restricted to verified ${INSTITUTIONAL_EMAIL_DOMAIN} institutional accounts.`,
  });

export const RoleSchema = z.enum(['student', 'officer', 'admin']);
export type UserRole = z.infer<typeof RoleSchema>;

export const OtpCodeSchema = z
  .string()
  .trim()
  .regex(OTP_CODE_REGEX, 'OTP must be a 6-digit numeric code.');

export const QrTokenSchema = z
  .string()
  .regex(OPAQUE_QR_TOKEN_REGEX, 'Invalid opaque QR token format.');

export const SignupRequestSchema = z.object({
  email: InstitutionalEmailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  fullName: z.string().trim().min(2, 'Full name is required.').max(120),
  studentId: z.string().trim().min(4, 'Student ID is required.').max(32),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const SignInRequestSchema = z.object({
  email: InstitutionalEmailSchema,
  password: z.string().min(1, 'Password is required.'),
});
export type SignInRequest = z.infer<typeof SignInRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  email: InstitutionalEmailSchema,
  token: OtpCodeSchema,
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const PublicProfileDtoSchema = z
  .object({
    id: z.string().uuid(),
    email: InstitutionalEmailSchema,
    fullName: z.string().trim().min(1),
    role: RoleSchema,
    qrToken: QrTokenSchema,
    keyVersion: z.number().int().min(1),
  })
  .strict();
export type PublicProfileDto = z.infer<typeof PublicProfileDtoSchema>;

export interface ProfileProjectionInput {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  qrToken: string;
  keyVersion: number;
  studentId?: string;
  student_id?: string;
}

/**
 * Projects a verified profile into a public/QR-safe DTO, stripping any private student_id.
 */
export function toPublicProfileDto(record: ProfileProjectionInput): PublicProfileDto {
  return PublicProfileDtoSchema.parse({
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    qrToken: record.qrToken,
    keyVersion: record.keyVersion,
  });
}

export const SupabaseClientEnvSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL.'),
  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'SUPABASE_PUBLISHABLE_KEY is required.')
    .refine(
      (value) => !value.startsWith('sb_secret_'),
      'SUPABASE_SECRET_KEY must never be used as a publishable client key.'
    ),
});
export type SupabaseClientEnv = z.infer<typeof SupabaseClientEnvSchema>;

export const SupabaseServerEnvSchema = SupabaseClientEnvSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required.'),
  SUPABASE_JWKS_URL: z.string().url('SUPABASE_JWKS_URL must be a valid URL.'),
});
export type SupabaseServerEnv = z.infer<typeof SupabaseServerEnvSchema>;
