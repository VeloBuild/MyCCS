import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { InstitutionalEmailSchema } from '@shared/auth';
import {
  AdminDirectoryEntrySchema,
  CertificationCreateInputSchema,
  CertificationKeyBatchSchema,
  CertificationSchema,
  ImportGMetrixKeysResponseSchema,
  MAX_GMETRIX_CSV_BYTES,
  PromoteFacultyResultSchema,
  type AdminDirectoryEntry,
  type Certification,
  type CertificationCreateInput,
  type CertificationKeyBatch,
  type ImportGMetrixKeysResponse,
  type PromoteFacultyResult,
  type RejectedRowReason,
} from '@shared/gmetrix';

const CertificationListSchema = z.array(CertificationSchema);
const BatchListSchema = z.array(CertificationKeyBatchSchema);
const AdminDirectoryListSchema = z.array(AdminDirectoryEntrySchema);
const CertificationIdSchema = z
  .string()
  .trim()
  .uuid('Select an active certification program before uploading.');

const REJECTED_REASON_LABELS: Record<RejectedRowReason, string> = {
  invalid_email: 'Invalid @lpunetwork.edu.ph email',
  missing_key_code: 'Missing key code',
  invalid_key_code: 'Invalid key code format',
  duplicate_key_in_csv: 'Duplicate key in CSV',
  unregistered_student: 'Student not registered',
  duplicate_key_existing: 'Key already assigned',
};

export interface UploadGMetrixCsvBatchParams {
  client: SupabaseClient;
  supabaseUrl: string;
  publishableKey: string;
  certificationId: string;
  file: File;
  fetchFn?: typeof fetch;
}

export function formatRejectedRowReason(reason: RejectedRowReason): string {
  return REJECTED_REASON_LABELS[reason];
}

export function formatLedgerTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractEdgeErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim().length > 0) {
      return record.error.trim();
    }
    if (typeof record.message === 'string' && record.message.trim().length > 0) {
      return record.message.trim();
    }
  }
  return `Failed to import GMetrix keys (HTTP ${status}).`;
}

export async function listCertifications(client: SupabaseClient): Promise<Certification[]> {
  const { data, error } = await client
    .from('certifications')
    .select('id, title, provider, description, is_active, created_at')
    .order('is_active', { ascending: false })
    .order('provider', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return CertificationListSchema.parse(data ?? []);
}

export async function createCertification(
  client: SupabaseClient,
  input: CertificationCreateInput
): Promise<Certification> {
  const parsed = CertificationCreateInputSchema.parse(input);
  const { data, error } = await client
    .from('certifications')
    .insert({
      title: parsed.title,
      provider: parsed.provider,
      description: parsed.description,
      is_active: parsed.is_active,
    })
    .select('id, title, provider, description, is_active, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return CertificationSchema.parse(data);
}

export async function listRecentBatches(
  client: SupabaseClient,
  limit = 15
): Promise<CertificationKeyBatch[]> {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 15;
  const { data, error } = await client
    .from('certification_key_batches')
    .select(
      'id, certification_id, uploaded_by_admin_id, total_rows, assigned_count, rejected_count, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message);
  }

  return BatchListSchema.parse(data ?? []);
}

export async function uploadGMetrixCsvBatch({
  client,
  supabaseUrl,
  publishableKey,
  certificationId,
  file,
  fetchFn = fetch,
}: UploadGMetrixCsvBatchParams): Promise<ImportGMetrixKeysResponse> {
  const validCertificationId = CertificationIdSchema.parse(certificationId);

  if (file.size <= 0) {
    throw new Error('CSV file is empty.');
  }
  if (file.size > MAX_GMETRIX_CSV_BYTES) {
    throw new Error('CSV file exceeds the 2 MiB upload limit.');
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const accessToken = sessionData.session?.access_token?.trim();
  if (!accessToken) {
    throw new Error('Your admin session expired. Sign in again to upload GMetrix keys.');
  }

  const formData = new FormData();
  formData.append('certification_id', validCertificationId);
  formData.append('file', file, file.name || 'gmetrix-keys.csv');

  const endpoint = `${supabaseUrl.trim().replace(/\/+$/, '')}/functions/v1/import-gmetrix-keys`;
  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
    },
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(extractEdgeErrorMessage(payload, response.status));
  }

  return ImportGMetrixKeysResponseSchema.parse(payload);
}

export async function listAdminProfiles(client: SupabaseClient): Promise<AdminDirectoryEntry[]> {
  const { data, error } = await client.rpc('list_admin_profiles');
  if (error) {
    throw new Error(error.message);
  }

  return AdminDirectoryListSchema.parse(data ?? []);
}

export async function promoteFacultyByEmail(
  client: SupabaseClient,
  rawEmail: string
): Promise<PromoteFacultyResult> {
  const parsedEmail = InstitutionalEmailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    throw new Error('Faculty email must be a valid @lpunetwork.edu.ph institutional address.');
  }

  const { data, error } = await client.rpc('promote_faculty_by_email', {
    p_email: parsedEmail.data,
  });

  if (error) {
    throw new Error(error.message);
  }

  return PromoteFacultyResultSchema.parse(data);
}

export function downloadRejectedRowsCsv(batchId: string, rejectedRowsCsv: string): void {
  const shortBatchId = batchId.trim().slice(0, 8) || 'batch';
  const blob = new Blob([rejectedRowsCsv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `gmetrix-rejected-rows-${shortBatchId}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 5000);
}
