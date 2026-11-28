import { z } from 'zod';
import { InstitutionalEmailSchema } from './auth';
import {
  buildRejectedRowsCsv,
  canonicalizeGMetrixKeyForHash,
  EXPO_PUSH_BATCH_LIMIT,
  EXPO_PUSH_TOKEN_REGEX,
  GMETRIX_MY_KEYS_DEEP_LINK,
  GMETRIX_PUSH_BODY,
  GMETRIX_PUSH_TITLE,
  isValidGMetrixKeyCode,
  MAX_GMETRIX_CSV_BYTES,
  MAX_GMETRIX_CSV_ROWS,
  MAX_KEY_CODE_LENGTH,
  normalizeGMetrixKeyCode,
  parseGMetrixCsv,
  REJECTED_CSV_HEADER,
  sanitizeCsvCell,
  type ParsedGMetrixCsvRow,
  type ParseGMetrixCsvResult,
} from '../supabase/functions/_shared/gmetrix-csv';

export {
  buildRejectedRowsCsv,
  canonicalizeGMetrixKeyForHash,
  EXPO_PUSH_BATCH_LIMIT,
  GMETRIX_MY_KEYS_DEEP_LINK,
  GMETRIX_PUSH_BODY,
  GMETRIX_PUSH_TITLE,
  isValidGMetrixKeyCode,
  MAX_GMETRIX_CSV_BYTES,
  MAX_GMETRIX_CSV_ROWS,
  normalizeGMetrixKeyCode,
  parseGMetrixCsv,
  REJECTED_CSV_HEADER,
  sanitizeCsvCell,
  type ParsedGMetrixCsvRow,
  type ParseGMetrixCsvResult,
};

const IsoTimestampSchema = z.string().datetime({ offset: true });
const DEEP_LINK_REGEX = /^myccs:\/\/[a-z0-9/_-]+$/;

export const CertificationSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, 'Certification title is required.').max(160),
    provider: z.string().trim().min(1, 'Certification provider is required.').max(120),
    description: z.string(),
    is_active: z.boolean(),
    created_at: IsoTimestampSchema,
  })
  .strict();
export type Certification = z.infer<typeof CertificationSchema>;

export const CertificationCreateInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Certification title is required.').max(160),
    provider: z.string().trim().min(1, 'Certification provider is required.').max(120),
    description: z.string().default(''),
    is_active: z.boolean().optional().default(true),
  })
  .strict();
export type CertificationCreateInput = z.input<typeof CertificationCreateInputSchema>;

export const CertificationKeyBatchSchema = z
  .object({
    id: z.string().uuid(),
    certification_id: z.string().uuid(),
    uploaded_by_admin_id: z.string().uuid(),
    total_rows: z.number().int().min(0),
    assigned_count: z.number().int().min(0),
    rejected_count: z.number().int().min(0),
    created_at: IsoTimestampSchema,
  })
  .strict()
  .refine((batch) => batch.assigned_count + batch.rejected_count === batch.total_rows, {
    message: 'assigned_count + rejected_count must equal total_rows.',
    path: ['total_rows'],
  });
export type CertificationKeyBatch = z.infer<typeof CertificationKeyBatchSchema>;

export const DecryptedCertificationKeySchema = z
  .object({
    id: z.string().uuid(),
    batchId: z.string().uuid(),
    certificationId: z.string().uuid(),
    certificationTitle: z.string().trim().min(1),
    certificationProvider: z.string().trim().min(1),
    keyCode: z.string().min(1).max(MAX_KEY_CODE_LENGTH),
    keyVersion: z.number().int().min(1),
    assignedAt: IsoTimestampSchema,
    viewedAt: IsoTimestampSchema.nullable(),
  })
  .strict();
export type DecryptedCertificationKey = z.infer<typeof DecryptedCertificationKeySchema>;

export const NotificationTypeSchema = z.enum(['gmetrix_key', 'org_application', 'event']);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z
  .object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    type: NotificationTypeSchema,
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(500),
    deep_link: z.string().regex(DEEP_LINK_REGEX, 'Invalid MyCCS deep link.'),
    read_at: IsoTimestampSchema.nullable(),
    created_at: IsoTimestampSchema,
  })
  .strict();
export type Notification = z.infer<typeof NotificationSchema>;

export const ExpoPushTokenSchema = z
  .string()
  .trim()
  .regex(EXPO_PUSH_TOKEN_REGEX, 'Invalid Expo Push Token format.');

export const PushPlatformSchema = z.enum(['ios', 'android', 'web']);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

export const RejectedRowReasonSchema = z.enum([
  'invalid_email',
  'missing_key_code',
  'invalid_key_code',
  'duplicate_key_in_csv',
  'unregistered_student',
  'duplicate_key_existing',
]);
export type RejectedRowReason = z.infer<typeof RejectedRowReasonSchema>;

export const RejectedRowSchema = z
  .object({
    rowNumber: z.number().int().min(2),
    email: z.string(),
    reason: RejectedRowReasonSchema,
  })
  .strict();
export type RejectedRow = z.infer<typeof RejectedRowSchema>;

export const ImportGMetrixKeysResponseSchema = z
  .object({
    batchId: z.string().uuid(),
    certificationId: z.string().uuid(),
    totalRows: z.number().int().min(0),
    assignedCount: z.number().int().min(0),
    rejectedCount: z.number().int().min(0),
    pushNotificationsSent: z.number().int().min(0),
    pushNotificationsFailed: z.number().int().min(0),
    rejectedRows: z.array(RejectedRowSchema),
    rejectedRowsCsv: z.string(),
  })
  .strict()
  .refine((res) => res.assignedCount + res.rejectedCount === res.totalRows, {
    message: 'assignedCount + rejectedCount must equal totalRows.',
    path: ['totalRows'],
  })
  .refine((res) => res.rejectedRows.length === res.rejectedCount, {
    message: 'rejectedRows length must match rejectedCount.',
    path: ['rejectedRows'],
  });
export type ImportGMetrixKeysResponse = z.infer<typeof ImportGMetrixKeysResponseSchema>;

export const AdminDirectoryEntrySchema = z
  .object({
    id: z.string().uuid(),
    email: InstitutionalEmailSchema,
    fullName: z.string().trim().min(1),
    role: z.literal('admin'),
    createdAt: IsoTimestampSchema,
  })
  .strict();
export type AdminDirectoryEntry = z.infer<typeof AdminDirectoryEntrySchema>;

export const PromoteFacultyResultSchema = z
  .object({
    id: z.string().uuid(),
    email: InstitutionalEmailSchema,
    fullName: z.string().trim().min(1),
    role: z.literal('admin'),
    alreadyAdmin: z.boolean(),
  })
  .strict();
export type PromoteFacultyResult = z.infer<typeof PromoteFacultyResultSchema>;

export function maskCertificationKey(keyCode: string): string {
  const trimmed = keyCode.trim();
  if (trimmed.length <= 4) {
    return '••••••••';
  }
  return `••••-••••-${trimmed.slice(-4)}`;
}

export function parseNotificationDeepLink(
  deepLink: string
): { tab: 'keys'; section: 'my_keys' } | null {
  const trimmed = deepLink.trim();
  if (!trimmed) {
    return null;
  }
  const withoutFragment = trimmed.split('#', 1)[0] ?? '';
  const withoutQuery = withoutFragment.split('?', 1)[0] ?? '';
  const normalized = withoutQuery.replace(/\/+$/, '').toLowerCase();
  if (normalized === GMETRIX_MY_KEYS_DEEP_LINK) {
    return { tab: 'keys', section: 'my_keys' };
  }
  return null;
}
