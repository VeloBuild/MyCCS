import {
  AnnouncementCreateInputSchema,
  AnnouncementSchema,
  AnnouncementUpdateInputSchema,
  DepartmentInfoSchema,
  DepartmentInfoUpdateInputSchema,
  OrganizationCreateInputSchema,
  OrganizationSchema,
  OrganizationUpdateInputSchema,
  OrgMembershipApplyInputSchema,
  OrgMembershipReviewInputSchema,
  OrgMembershipRoleSchema,
  OrgMembershipSchema,
  OrgMembershipStatusSchema,
  canManageDepartmentInfo,
  canManageOrganization,
  canPublishAnnouncement,
  canReviewMembership,
  isAnnouncementVisibleTo,
  type RbacActor,
} from '../../shared/core-schema';

const UUID_1 = '11111111-1111-4111-8111-111111111111';
const UUID_2 = '22222222-2222-4222-8222-222222222222';
const UUID_3 = '33333333-3333-4333-8333-333333333333';
const UUID_4 = '44444444-4444-4444-8444-444444444444';
const ISO_NOW = '2026-11-25T10:00:00Z';
const ISO_LATER = '2026-11-26T10:00:00Z';
const ISO_EARLIER = '2026-11-24T10:00:00Z';

describe('shared/core-schema Zod contracts', () => {
  it('validates DepartmentInfoSchema and rejects empty updates', () => {
    const valid = DepartmentInfoSchema.parse({
      id: UUID_1,
      title: 'College of Computer Studies',
      about_markdown: '# Welcome to CCS',
      leadership_json: [{ name: 'Dr. Reyes', title: 'Dean', email: 'dean@lpunetwork.edu.ph' }],
      contact_json: { office: 'CCS Building 2F' },
      updated_at: ISO_NOW,
    });
    expect(valid.title).toBe('College of Computer Studies');

    expect(
      DepartmentInfoUpdateInputSchema.safeParse({ about_markdown: 'Updated' }).success
    ).toBe(true);
    expect(DepartmentInfoUpdateInputSchema.safeParse({}).success).toBe(false);
  });

  it('validates OrganizationSchema and rejects self-parenting or non-http URLs', () => {
    const subOrg = OrganizationSchema.parse({
      id: UUID_2,
      parent_org_id: UUID_1,
      name: 'CCS Robotics Sub-Org',
      details: 'Sub-org details',
      logo_url: 'https://cdn.example.edu.ph/logo.webp',
      cover_url: null,
      created_at: ISO_NOW,
      deleted_at: null,
    });
    expect(subOrg.parent_org_id).toBe(UUID_1);

    const selfParent = OrganizationSchema.safeParse({
      id: UUID_1,
      parent_org_id: UUID_1,
      name: 'Self Parent',
      details: '',
      logo_url: null,
      cover_url: null,
      created_at: ISO_NOW,
      deleted_at: null,
    });
    expect(selfParent.success).toBe(false);

    const badUrl = OrganizationCreateInputSchema.safeParse({
      name: 'Bad URL Org',
      logo_url: 'javascript:alert(1)',
    });
    expect(badUrl.success).toBe(false);

    const created = OrganizationCreateInputSchema.parse({ name: 'Main Org' });
    expect(created.parent_org_id).toBeNull();
    expect(created.details).toBe('');

    expect(OrganizationUpdateInputSchema.safeParse({ details: 'New' }).success).toBe(true);
    expect(OrganizationUpdateInputSchema.safeParse({}).success).toBe(false);
  });

  it('validates OrgMembership schemas and enums', () => {
    expect(OrgMembershipRoleSchema.parse('member')).toBe('member');
    expect(OrgMembershipRoleSchema.safeParse('admin').success).toBe(false);
    expect(OrgMembershipStatusSchema.parse('pending')).toBe('pending');
    expect(OrgMembershipStatusSchema.safeParse('archived').success).toBe(false);

    const membership = OrgMembershipSchema.parse({
      id: UUID_1,
      profile_id: UUID_2,
      organization_id: UUID_3,
      role: 'member',
      status: 'pending',
      submission_id: null,
      created_at: ISO_NOW,
    });
    expect(membership.status).toBe('pending');

    const apply = OrgMembershipApplyInputSchema.parse({ organization_id: UUID_3 });
    expect(apply.submission_id).toBeNull();

    expect(OrgMembershipReviewInputSchema.parse({ status: 'approved' }).status).toBe('approved');
    expect(OrgMembershipReviewInputSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('validates AnnouncementSchema and enforces scope & expiration invariants', () => {
    const deptWide = AnnouncementSchema.parse({
      id: UUID_1,
      organization_id: null,
      title: 'Enrollment Schedule',
      content: 'Starts Monday',
      global_visibility: true,
      published_at: ISO_NOW,
      expires_at: ISO_LATER,
      deleted_at: null,
    });
    expect(deptWide.global_visibility).toBe(true);

    const orphanNonGlobal = AnnouncementSchema.safeParse({
      id: UUID_1,
      organization_id: null,
      title: 'Invalid Scope',
      content: 'Missing org and not global',
      global_visibility: false,
      published_at: ISO_NOW,
      expires_at: null,
      deleted_at: null,
    });
    expect(orphanNonGlobal.success).toBe(false);

    const badExpiry = AnnouncementCreateInputSchema.safeParse({
      organization_id: UUID_2,
      title: 'Expired Immediately',
      content: 'Invalid window',
      global_visibility: false,
      published_at: ISO_NOW,
      expires_at: ISO_EARLIER,
    });
    expect(badExpiry.success).toBe(false);

    expect(AnnouncementUpdateInputSchema.safeParse({ title: 'Edited' }).success).toBe(true);
    expect(AnnouncementUpdateInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('shared/core-schema RBAC helpers', () => {
  const adminActor: RbacActor = {
    profileId: UUID_1,
    role: 'admin',
    memberships: [],
  };

  const officerActor: RbacActor = {
    profileId: UUID_2,
    role: 'officer',
    memberships: [
      { organization_id: UUID_3, role: 'officer', status: 'approved' },
      { organization_id: UUID_4, role: 'officer', status: 'pending' },
    ],
  };

  const studentActor: RbacActor = {
    profileId: UUID_3,
    role: 'student',
    memberships: [{ organization_id: UUID_3, role: 'member', status: 'approved' }],
  };

  const inactiveAdmin: RbacActor = {
    profileId: UUID_4,
    role: 'admin',
    isActive: false,
    memberships: [],
  };

  it('enforces department_info admin-only governance', () => {
    expect(canManageDepartmentInfo(adminActor)).toBe(true);
    expect(canManageDepartmentInfo(officerActor)).toBe(false);
    expect(canManageDepartmentInfo(studentActor)).toBe(false);
    expect(canManageDepartmentInfo(inactiveAdmin)).toBe(false);
  });

  it('enforces organization management boundaries', () => {
    const activeOrgA = { id: UUID_3, deleted_at: null };
    const deletedOrgA = { id: UUID_3, deleted_at: ISO_NOW };
    const activeOrgB = { id: UUID_4, deleted_at: null };

    expect(canManageOrganization(adminActor, activeOrgA, 'create')).toBe(true);
    expect(canManageOrganization(adminActor, deletedOrgA, 'delete')).toBe(true);
    expect(canManageOrganization(officerActor, activeOrgA, 'update')).toBe(true);
    expect(canManageOrganization(officerActor, activeOrgA, 'create')).toBe(false);
    expect(canManageOrganization(officerActor, activeOrgA, 'delete')).toBe(false);
    expect(canManageOrganization(officerActor, deletedOrgA, 'update')).toBe(false);
    expect(canManageOrganization(officerActor, activeOrgB, 'update')).toBe(false);
    expect(canManageOrganization(studentActor, activeOrgA, 'update')).toBe(false);
    expect(canManageOrganization(inactiveAdmin, activeOrgA, 'update')).toBe(false);
  });

  it('enforces membership review boundaries and blocks officer escalation', () => {
    const memberRowOrgA = { organization_id: UUID_3, role: 'member' as const };
    const officerRowOrgA = { organization_id: UUID_3, role: 'officer' as const };
    const memberRowOrgB = { organization_id: UUID_4, role: 'member' as const };

    expect(canReviewMembership(adminActor, officerRowOrgA, 'officer')).toBe(true);
    expect(canReviewMembership(officerActor, memberRowOrgA, 'member')).toBe(true);
    expect(canReviewMembership(officerActor, memberRowOrgA, 'officer')).toBe(false);
    expect(canReviewMembership(officerActor, officerRowOrgA)).toBe(false);
    expect(canReviewMembership(officerActor, memberRowOrgB)).toBe(false);
    expect(canReviewMembership(studentActor, memberRowOrgA)).toBe(false);
    expect(canReviewMembership(inactiveAdmin, memberRowOrgA)).toBe(false);
  });

  it('enforces announcement publishing and visibility rules', () => {
    expect(
      canPublishAnnouncement(adminActor, { organization_id: null, global_visibility: true })
    ).toBe(true);
    expect(
      canPublishAnnouncement(officerActor, { organization_id: UUID_3, global_visibility: false })
    ).toBe(true);
    expect(
      canPublishAnnouncement(officerActor, { organization_id: null, global_visibility: true })
    ).toBe(false);
    expect(
      canPublishAnnouncement(officerActor, { organization_id: UUID_3, global_visibility: true })
    ).toBe(false);
    expect(
      canPublishAnnouncement(officerActor, { organization_id: UUID_4, global_visibility: false })
    ).toBe(false);
    expect(
      canPublishAnnouncement(studentActor, { organization_id: UUID_3, global_visibility: false })
    ).toBe(false);
    expect(
      canPublishAnnouncement(inactiveAdmin, { organization_id: null, global_visibility: true })
    ).toBe(false);

    const now = new Date('2026-11-25T12:00:00Z');
    const activeGlobal = {
      organization_id: null,
      global_visibility: true,
      expires_at: ISO_LATER,
      deleted_at: null,
    };
    const expiredOrgA = {
      organization_id: UUID_3,
      global_visibility: false,
      expires_at: ISO_EARLIER,
      deleted_at: null,
    };
    const activeOrgA = {
      organization_id: UUID_3,
      global_visibility: false,
      expires_at: null,
      deleted_at: null,
    };
    const activeOrgB = {
      organization_id: UUID_4,
      global_visibility: false,
      expires_at: null,
      deleted_at: null,
    };
    const deletedGlobal = {
      organization_id: null,
      global_visibility: true,
      expires_at: null,
      deleted_at: ISO_NOW,
    };

    expect(isAnnouncementVisibleTo(studentActor, activeGlobal, now)).toBe(true);
    expect(isAnnouncementVisibleTo(studentActor, activeOrgA, now)).toBe(true);
    expect(isAnnouncementVisibleTo(studentActor, activeOrgB, now)).toBe(false);
    expect(isAnnouncementVisibleTo(studentActor, expiredOrgA, now)).toBe(false);
    expect(isAnnouncementVisibleTo(studentActor, deletedGlobal, now)).toBe(false);
    expect(isAnnouncementVisibleTo(officerActor, expiredOrgA, now)).toBe(true);
    expect(isAnnouncementVisibleTo(adminActor, expiredOrgA, now)).toBe(true);
    expect(isAnnouncementVisibleTo(adminActor, deletedGlobal, now)).toBe(false);
    expect(isAnnouncementVisibleTo(inactiveAdmin, activeGlobal, now)).toBe(false);
  });
});

declare const require: (moduleId: string) => {
  readFileSync: (filePath: string, encoding: 'utf8') => string;
  resolve: (...segments: string[]) => string;
  join: (...segments: string[]) => string;
};
declare const __dirname: string;

describe('spec-02 migration, SQL contract, and Postman collection integrity', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const repoRoot = path.resolve(__dirname, '..', '..');
  const migrationSql = fs.readFileSync(
    path.join(repoRoot, 'supabase', 'migrations', '20261125000001_spec02_core_schema_rls.sql'),
    'utf8'
  );
  const rlsTestSql = fs.readFileSync(
    path.join(repoRoot, 'tests', 'api', 'core-schema-rls.sql'),
    'utf8'
  );
  const postmanRaw = fs.readFileSync(
    path.join(repoRoot, 'tests', 'api', 'core-schema-rls.postman_collection.json'),
    'utf8'
  );

  it('enforces RLS, FORCE RLS, explicit grants, zero anon grants, and SECURITY INVOKER guards in migration', () => {
    for (const table of ['department_info', 'organizations', 'org_memberships', 'announcements']) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      expect(migrationSql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`);
      expect(migrationSql).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated;`
      );
    }

    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.department_info TO authenticated;'
    );
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.organizations TO authenticated;'
    );
    expect(migrationSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON TABLE public\.organizations/i);
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_memberships TO authenticated;'
    );
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.announcements TO authenticated;'
    );
    expect(migrationSql).not.toMatch(/GRANT[^;]*DELETE[^;]*ON TABLE public\.announcements/i);
    expect(migrationSql).not.toMatch(/GRANT[^;]+TO\s+anon\b/i);

    for (const helper of ['is_active_profile', 'is_org_officer', 'is_org_member']) {
      expect(migrationSql).toContain(`CREATE OR REPLACE FUNCTION public.${helper}`);
    }
    for (const guard of [
      'guard_organizations_hierarchy',
      'guard_org_memberships_mutation',
      'guard_announcements_mutation',
    ]) {
      expect(migrationSql).toMatch(
        new RegExp(`CREATE OR REPLACE FUNCTION public\\.${guard}\\(\\)\\s+RETURNS trigger\\s+LANGUAGE plpgsql\\s+SECURITY INVOKER`, 'm')
      );
    }
    expect(migrationSql).toContain('-- shortcut: submission_id FK');
    expect(migrationSql).toContain("CHECK (logo_url IS NULL OR logo_url ~* '^https?://')");
    expect(migrationSql).toContain("CHECK (cover_url IS NULL OR cover_url ~* '^https?://')");
    expect(migrationSql).toContain('FOR SHARE');
    expect(migrationSql).toContain('OLD.global_visibility = true');
    expect(migrationSql).toContain('Cannot soft-delete a Main Organization');
    expect(migrationSql).not.toContain('IF NEW.parent_org_id = NEW.id THEN');
  });

  it('keeps SQL RLS test script rolled back, wired in package.json, and covering all 4 tables', () => {
    const pkgRaw = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:test']).toContain('tests/api/core-schema-rls.sql');

    expect(rlsTestSql).toMatch(/^\s*BEGIN;/m);
    expect(rlsTestSql).toMatch(/ROLLBACK;\s*$/);
    for (const table of ['department_info', 'organizations', 'org_memberships', 'announcements']) {
      expect(rlsTestSql).toContain(table);
    }
  });

  it('validates Postman v2.1 collection covers all 4 tables and 4 roles with strict assertions and zero hardcoded secrets', () => {
    type PostmanRequest = {
      name: string;
      request: {
        method: string;
        header?: Array<{ key: string; value: string }>;
      };
      event?: Array<{
        listen: string;
        script: { exec: string[] };
      }>;
    };
    const collection = JSON.parse(postmanRaw) as {
      info: { schema: string };
      variable: Array<{ key: string; value: string }>;
      item: Array<{ name: string; item: PostmanRequest[] }>;
    };

    expect(collection.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    );
    expect(collection.item.map((folder) => folder.name)).toEqual([
      'department_info',
      'organizations',
      'org_memberships',
      'announcements',
    ]);

    const requests = collection.item.flatMap((folder) => folder.item);
    const requestNames = requests.map((request) => request.name);
    for (const role of ['[anon]', '[student]', '[officer]', '[admin]']) {
      expect(requestNames.some((name) => name.includes(role))).toBe(true);
    }

    for (const req of requests) {
      const testScript =
        req.event?.find((e) => e.listen === 'test')?.script.exec.join('\n') ?? '';

      if (req.name.startsWith('[student]') || req.name.startsWith('[officer]')) {
        expect(testScript).not.toContain('[401, 403]');
        if (req.name.includes('403')) {
          expect(testScript).toContain('pm.response.to.have.status(403)');
        }
      }

      if (
        req.name.startsWith('[admin] PATCH department_info') ||
        req.name.startsWith('[officer] PATCH assigned Org A')
      ) {
        const hasReturnRep = req.request.header?.some(
          (h) => h.key === 'Prefer' && h.value === 'return=representation'
        );
        expect(hasReturnRep).toBe(true);
        expect(testScript).toContain('pm.response.to.have.status(200)');
        expect(testScript).toContain('lengthOf(1)');
      }
    }

    for (const variable of collection.variable) {
      expect(variable.value).toBe('');
    }
    expect(postmanRaw).not.toMatch(/sb_secret_|eyJhbGciOi/);
  });
});
