import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  AnnouncementCreateInputSchema,
  AnnouncementSchema,
  DepartmentInfoCreateInputSchema,
  DepartmentInfoSchema,
  DepartmentInfoUpdateInputSchema,
  OrganizationSchema,
  OrganizationUpdateInputSchema,
  OrgMembershipSchema,
  type Announcement,
  type AnnouncementCreateInput,
  type DepartmentInfo,
  type DepartmentInfoCreateInput,
  type DepartmentInfoUpdateInput,
  type Organization,
  type OrganizationUpdateInput,
  type OrgMembership,
} from '../../shared/core-schema';

const UuidSchema = z.string().uuid();

export const DEFAULT_ANNOUNCEMENTS_LIMIT = 100;

export interface DeptOrgQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface DeptOrgSingleTerminal {
  single(): PromiseLike<DeptOrgQueryResult<unknown>>;
}

export interface DeptOrgListTerminal
  extends PromiseLike<DeptOrgQueryResult<unknown[]>> {
  limit(count: number): PromiseLike<DeptOrgQueryResult<unknown[]>>;
}

export interface DeptOrgSelectChain {
  eq(column: string, value: unknown): PromiseLike<DeptOrgQueryResult<unknown[]>>;
  is(
    column: string,
    value: null
  ): {
    order(
      column: string,
      options?: { ascending?: boolean }
    ): DeptOrgListTerminal;
  };
  order(
    column: string,
    options?: { ascending?: boolean }
  ): DeptOrgListTerminal;
}

export interface DeptOrgTableBuilder {
  select(columns?: string): DeptOrgSelectChain;
  insert(values: Record<string, unknown>): {
    select(columns?: string): DeptOrgSingleTerminal;
  };
  update(values: Record<string, unknown>): {
    eq(
      column: string,
      value: unknown
    ): {
      select(columns?: string): DeptOrgSingleTerminal;
    };
  };
}

export interface DeptOrgSupabaseClient {
  from(relation: string): DeptOrgTableBuilder;
  auth?: {
    getSession(): Promise<{
      data: { session: { access_token?: string } | null };
      error: { message: string } | null;
    }>;
  };
}

export function adaptSupabaseClient(
  client: SupabaseClient
): DeptOrgSupabaseClient {
  return client as unknown as DeptOrgSupabaseClient;
}

export interface HubSnapshot {
  departmentInfo: DepartmentInfo | null;
  organizations: Organization[];
  memberships: OrgMembership[];
  announcements: Announcement[];
}

const DEPARTMENT_INFO_COLUMNS =
  'id, title, about_markdown, leadership_json, contact_json, updated_at';
const ORGANIZATION_COLUMNS =
  'id, parent_org_id, name, details, logo_url, cover_url, created_at, deleted_at';
const MEMBERSHIP_COLUMNS =
  'id, profile_id, organization_id, role, status, submission_id, created_at';
const ANNOUNCEMENT_COLUMNS =
  'id, organization_id, title, content, global_visibility, published_at, expires_at, deleted_at';

export async function fetchDepartmentInfo(
  client: DeptOrgSupabaseClient
): Promise<DepartmentInfo | null> {
  const { data, error } = await client
    .from('department_info')
    .select(DEPARTMENT_INFO_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return DepartmentInfoSchema.parse(data[0]);
}

export async function createDepartmentInfo(
  client: DeptOrgSupabaseClient,
  input: DepartmentInfoCreateInput
): Promise<DepartmentInfo> {
  const parsedInput = DepartmentInfoCreateInputSchema.parse(input);

  const { data, error } = await client
    .from('department_info')
    .insert(parsedInput)
    .select(DEPARTMENT_INFO_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create department info.');
  }

  return DepartmentInfoSchema.parse(data);
}

export async function updateDepartmentInfo(
  client: DeptOrgSupabaseClient,
  id: string,
  input: DepartmentInfoUpdateInput
): Promise<DepartmentInfo> {
  const parsedId = UuidSchema.parse(id);
  const parsedInput = DepartmentInfoUpdateInputSchema.parse(input);

  const { data, error } = await client
    .from('department_info')
    .update(parsedInput)
    .eq('id', parsedId)
    .select(DEPARTMENT_INFO_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update department info.');
  }

  return DepartmentInfoSchema.parse(data);
}

export async function fetchActiveOrganizations(
  client: DeptOrgSupabaseClient
): Promise<Organization[]> {
  const { data, error } = await client
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => OrganizationSchema.parse(row));
}

export async function updateOrganizationProfile(
  client: DeptOrgSupabaseClient,
  organizationId: string,
  input: OrganizationUpdateInput
): Promise<Organization> {
  const parsedOrgId = UuidSchema.parse(organizationId);
  const parsedInput = OrganizationUpdateInputSchema.parse(input);

  const { data, error } = await client
    .from('organizations')
    .update(parsedInput)
    .eq('id', parsedOrgId)
    .select(ORGANIZATION_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to update organization profile.');
  }

  return OrganizationSchema.parse(data);
}

export async function fetchMyOrgMemberships(
  client: DeptOrgSupabaseClient,
  profileId: string
): Promise<OrgMembership[]> {
  const parsedProfileId = UuidSchema.parse(profileId);

  const { data, error } = await client
    .from('org_memberships')
    .select(MEMBERSHIP_COLUMNS)
    .eq('profile_id', parsedProfileId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => OrgMembershipSchema.parse(row));
}

export async function fetchAnnouncements(
  client: DeptOrgSupabaseClient,
  limit = DEFAULT_ANNOUNCEMENTS_LIMIT
): Promise<Announcement[]> {
  const { data, error } = await client
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => AnnouncementSchema.parse(row));
}

export async function createAnnouncement(
  client: DeptOrgSupabaseClient,
  input: AnnouncementCreateInput
): Promise<Announcement> {
  const parsedInput = AnnouncementCreateInputSchema.parse(input);

  const { data, error } = await client
    .from('announcements')
    .insert(parsedInput)
    .select(ANNOUNCEMENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to publish announcement.');
  }

  return AnnouncementSchema.parse(data);
}

export async function loadHubSnapshot(
  client: DeptOrgSupabaseClient,
  profileId: string
): Promise<HubSnapshot> {
  const [departmentInfo, organizations, memberships, announcements] =
    await Promise.all([
      fetchDepartmentInfo(client),
      fetchActiveOrganizations(client),
      fetchMyOrgMemberships(client, profileId),
      fetchAnnouncements(client),
    ]);

  return {
    departmentInfo,
    organizations,
    memberships,
    announcements,
  };
}
