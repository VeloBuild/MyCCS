import { z } from 'zod';
import type { UserRole } from './auth';

const IsoTimestampSchema = z.string().datetime({ offset: true });

const SafeHttpUrlSchema = z
  .string()
  .url('Must be a valid URL.')
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('http://'),
    'URL must use http or https protocol.'
  );

export const DepartmentLeadershipEntrySchema = z
  .object({
    name: z.string().trim().min(1, 'Leader name is required.').max(120),
    title: z.string().trim().min(1, 'Leader title is required.').max(120),
    email: z.string().trim().email('Invalid email address.').optional(),
  })
  .strict();
export type DepartmentLeadershipEntry = z.infer<typeof DepartmentLeadershipEntrySchema>;

export const DepartmentInfoSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, 'Department title is required.').max(200),
    about_markdown: z.string(),
    leadership_json: z.array(DepartmentLeadershipEntrySchema),
    contact_json: z.record(z.string(), z.unknown()),
    updated_at: IsoTimestampSchema,
  })
  .strict();
export type DepartmentInfo = z.infer<typeof DepartmentInfoSchema>;

export const DepartmentInfoUpdateInputSchema = DepartmentInfoSchema.pick({
  title: true,
  about_markdown: true,
  leadership_json: true,
  contact_json: true,
})
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one department_info field is required for update.',
  });
export type DepartmentInfoUpdateInput = z.infer<typeof DepartmentInfoUpdateInputSchema>;

export const OrganizationSchema = z
  .object({
    id: z.string().uuid(),
    parent_org_id: z.string().uuid().nullable(),
    name: z.string().trim().min(1, 'Organization name is required.').max(160),
    details: z.string(),
    logo_url: SafeHttpUrlSchema.nullable(),
    cover_url: SafeHttpUrlSchema.nullable(),
    created_at: IsoTimestampSchema,
    deleted_at: IsoTimestampSchema.nullable(),
  })
  .strict()
  .refine((org) => org.parent_org_id === null || org.parent_org_id !== org.id, {
    message: 'Organization cannot reference itself as parent.',
    path: ['parent_org_id'],
  });
export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizationCreateInputSchema = z
  .object({
    parent_org_id: z.string().uuid().nullable().default(null),
    name: z.string().trim().min(1, 'Organization name is required.').max(160),
    details: z.string().default(''),
    logo_url: SafeHttpUrlSchema.nullable().default(null),
    cover_url: SafeHttpUrlSchema.nullable().default(null),
  })
  .strict();
export type OrganizationCreateInput = z.infer<typeof OrganizationCreateInputSchema>;

export const OrganizationUpdateInputSchema = z
  .object({
    parent_org_id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, 'Organization name is required.').max(160).optional(),
    details: z.string().optional(),
    logo_url: SafeHttpUrlSchema.nullable().optional(),
    cover_url: SafeHttpUrlSchema.nullable().optional(),
    deleted_at: IsoTimestampSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one organization field is required for update.',
  });
export type OrganizationUpdateInput = z.infer<typeof OrganizationUpdateInputSchema>;

export const OrgMembershipRoleSchema = z.enum(['member', 'officer']);
export type OrgMembershipRole = z.infer<typeof OrgMembershipRoleSchema>;

export const OrgMembershipStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type OrgMembershipStatus = z.infer<typeof OrgMembershipStatusSchema>;

export const OrgMembershipSchema = z
  .object({
    id: z.string().uuid(),
    profile_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    role: OrgMembershipRoleSchema,
    status: OrgMembershipStatusSchema,
    submission_id: z.string().uuid().nullable(),
    created_at: IsoTimestampSchema,
  })
  .strict();
export type OrgMembership = z.infer<typeof OrgMembershipSchema>;

export const OrgMembershipApplyInputSchema = z
  .object({
    organization_id: z.string().uuid(),
    submission_id: z.string().uuid().nullable().default(null),
  })
  .strict();
export type OrgMembershipApplyInput = z.infer<typeof OrgMembershipApplyInputSchema>;

export const OrgMembershipReviewInputSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
  })
  .strict();
export type OrgMembershipReviewInput = z.infer<typeof OrgMembershipReviewInputSchema>;

function validateAnnouncementInvariants(
  data: {
    organization_id: string | null;
    global_visibility: boolean;
    published_at?: string;
    expires_at: string | null;
  },
  ctx: z.RefinementCtx
): void {
  if (data.organization_id === null && !data.global_visibility) {
    ctx.addIssue({
      code: 'custom',
      path: ['global_visibility'],
      message: 'Department-wide announcements without an organization_id must have global_visibility = true.',
    });
  }

  if (data.expires_at !== null && data.published_at !== undefined) {
    if (Date.parse(data.expires_at) <= Date.parse(data.published_at)) {
      ctx.addIssue({
        code: 'custom',
        path: ['expires_at'],
        message: 'expires_at must be later than published_at.',
      });
    }
  }
}

export const AnnouncementSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid().nullable(),
    title: z.string().trim().min(1, 'Announcement title is required.').max(200),
    content: z.string().trim().min(1, 'Announcement content is required.'),
    global_visibility: z.boolean(),
    published_at: IsoTimestampSchema,
    expires_at: IsoTimestampSchema.nullable(),
    deleted_at: IsoTimestampSchema.nullable(),
  })
  .strict()
  .superRefine(validateAnnouncementInvariants);
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const AnnouncementCreateInputSchema = z
  .object({
    organization_id: z.string().uuid().nullable().default(null),
    title: z.string().trim().min(1, 'Announcement title is required.').max(200),
    content: z.string().trim().min(1, 'Announcement content is required.'),
    global_visibility: z.boolean().default(false),
    published_at: IsoTimestampSchema.optional(),
    expires_at: IsoTimestampSchema.nullable().default(null),
  })
  .strict()
  .superRefine(validateAnnouncementInvariants);
export type AnnouncementCreateInput = z.infer<typeof AnnouncementCreateInputSchema>;

export const AnnouncementUpdateInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Announcement title is required.').max(200).optional(),
    content: z.string().trim().min(1, 'Announcement content is required.').optional(),
    global_visibility: z.boolean().optional(),
    expires_at: IsoTimestampSchema.nullable().optional(),
    deleted_at: IsoTimestampSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one announcement field is required for update.',
  });
export type AnnouncementUpdateInput = z.infer<typeof AnnouncementUpdateInputSchema>;

export interface RbacActor {
  profileId: string;
  role: UserRole;
  isActive?: boolean;
  memberships: ReadonlyArray<Pick<OrgMembership, 'organization_id' | 'role' | 'status'>>;
}

function isActorActive(actor: RbacActor): boolean {
  return actor.isActive !== false;
}

function isApprovedOrgOfficer(actor: RbacActor, organizationId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.organization_id === organizationId &&
      membership.role === 'officer' &&
      membership.status === 'approved'
  );
}

function isApprovedOrgMember(actor: RbacActor, organizationId: string): boolean {
  return actor.memberships.some(
    (membership) =>
      membership.organization_id === organizationId && membership.status === 'approved'
  );
}

export function canManageDepartmentInfo(actor: RbacActor): boolean {
  return isActorActive(actor) && actor.role === 'admin';
}

export function canManageOrganization(
  actor: RbacActor,
  organization: Pick<Organization, 'id' | 'deleted_at'>,
  action: 'create' | 'update' | 'delete' = 'update'
): boolean {
  if (!isActorActive(actor)) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (action !== 'update' || organization.deleted_at !== null) {
    return false;
  }

  return isApprovedOrgOfficer(actor, organization.id);
}

export function canReviewMembership(
  actor: RbacActor,
  membership: Pick<OrgMembership, 'organization_id' | 'role'>,
  targetRole?: OrgMembershipRole
): boolean {
  if (!isActorActive(actor)) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (membership.role !== 'member') {
    return false;
  }

  if (targetRole !== undefined && targetRole !== 'member') {
    return false;
  }

  return isApprovedOrgOfficer(actor, membership.organization_id);
}

export function canPublishAnnouncement(
  actor: RbacActor,
  target: Pick<Announcement, 'organization_id' | 'global_visibility'>
): boolean {
  if (!isActorActive(actor)) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (target.global_visibility || target.organization_id === null) {
    return false;
  }

  return isApprovedOrgOfficer(actor, target.organization_id);
}

export function isAnnouncementVisibleTo(
  actor: RbacActor,
  announcement: Pick<Announcement, 'organization_id' | 'global_visibility' | 'expires_at' | 'deleted_at'>,
  now: Date = new Date()
): boolean {
  if (!isActorActive(actor) || announcement.deleted_at !== null) {
    return false;
  }

  if (actor.role === 'admin') {
    return true;
  }

  if (
    announcement.organization_id !== null &&
    isApprovedOrgOfficer(actor, announcement.organization_id)
  ) {
    return true;
  }

  if (
    announcement.expires_at !== null &&
    Date.parse(announcement.expires_at) <= now.getTime()
  ) {
    return false;
  }

  if (announcement.global_visibility) {
    return true;
  }

  return (
    announcement.organization_id !== null &&
    isApprovedOrgMember(actor, announcement.organization_id)
  );
}
