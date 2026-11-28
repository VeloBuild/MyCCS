import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicProfileDto } from '../../shared/auth';
import type {
  Announcement,
  AnnouncementCreateInput,
  DepartmentInfo,
  DepartmentInfoCreateInput,
  DepartmentInfoUpdateInput,
  Organization,
  OrganizationUpdateInput,
  OrgMembership,
  RbacActor,
} from '../../shared/core-schema';
import {
  compareIsoTimestamps,
  findOrganizationById,
  type MobileHubRoute,
} from '../../shared/dept-org';
import type { CompressImageResponse } from '../../shared/media-upload';
import { AnnouncementsFeedView } from '../components/AnnouncementsFeedView';
import { DepartmentAboutView } from '../components/DepartmentAboutView';
import { IdentityCard } from '../components/IdentityCard';
import { OrgDetailView } from '../components/OrgDetailView';
import { OrgDirectoryView } from '../components/OrgDirectoryView';
import {
  getClientSupabaseConfig,
  getSupabaseClient,
  isSupabaseConfigured,
} from '../lib/supabase';
import {
  adaptSupabaseClient,
  createAnnouncement,
  createDepartmentInfo,
  fetchOrganizationAnnouncements,
  loadHubSnapshot,
  updateDepartmentInfo,
  updateOrganizationProfile,
  type DeptOrgSupabaseClient,
} from '../services/deptOrg';
import { uploadCompressedOrgMedia } from '../services/mediaUpload';
import {
  CCS_CREST_COLORS,
  CCS_CREST_RADII,
  CCS_CREST_SIZES,
  CCS_CREST_SPACING,
} from '../theme/ccsCrest';

export interface MyCcsHubScreenProps {
  profile: PublicProfileDto;
  busy: boolean;
  errorMessage: string | null;
  onSignOut: () => void;
  deptOrgClient?: DeptOrgSupabaseClient;
  onUploadOrgMedia?: (
    organizationId: string,
    kind: 'logo' | 'cover',
    localUri: string
  ) => Promise<CompressImageResponse>;
  now?: Date;
}

type HubTabId = MobileHubRoute['tab'];

const TAB_ITEMS: ReadonlyArray<{ id: HubTabId; label: string }> = [
  { id: 'feed', label: 'Feed' },
  { id: 'department', label: 'Department' },
  { id: 'orgs', label: 'Orgs' },
  { id: 'identity', label: 'Identity' },
];

function getHeaderTitle(route: MobileHubRoute): string {
  switch (route.tab) {
    case 'feed':
      return 'Announcements';
    case 'department':
      return 'Department';
    case 'orgs':
      return 'Organizations';
    case 'identity':
      return 'Identity';
  }
}

function compareAnnouncementsNewestFirst(
  a: Announcement,
  b: Announcement
): number {
  const timeDiff = compareIsoTimestamps(b.published_at, a.published_at);
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return a.id.localeCompare(b.id);
}

type OrgMutableField = keyof OrganizationUpdateInput;
type PendingOrgFieldMap = Partial<{
  [K in OrgMutableField]: { seq: number; value: Organization[K] };
}>;

function mergeAcknowledgedAnnouncements(
  fetched: Announcement[],
  acknowledged: ReadonlyArray<{ seq: number; post: Announcement }>,
  startSeq: number
): Announcement[] {
  const extras = acknowledged.filter((entry) => entry.seq > startSeq);
  if (extras.length === 0) {
    return fetched;
  }
  const byId = new Map<string, Announcement>();
  for (const item of fetched) {
    byId.set(item.id, item);
  }
  let added = false;
  for (const entry of extras) {
    if (!byId.has(entry.post.id)) {
      byId.set(entry.post.id, entry.post);
      added = true;
    }
  }
  if (!added) {
    return fetched;
  }
  return Array.from(byId.values()).sort(compareAnnouncementsNewestFirst);
}

export function MyCcsHubScreen({
  profile,
  busy,
  errorMessage,
  onSignOut,
  deptOrgClient,
  onUploadOrgMedia,
  now,
}: MyCcsHubScreenProps) {
  const [route, setRoute] = useState<MobileHubRoute>({ tab: 'feed' });
  const [departmentInfo, setDepartmentInfo] = useState<DepartmentInfo | null>(
    null
  );
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [orgAnnouncementsByOrgId, setOrgAnnouncementsByOrgId] = useState<
    Record<string, Announcement[]>
  >({});
  const [orgPostsLoading, setOrgPostsLoading] = useState(false);
  const [orgPostsError, setOrgPostsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const refreshIdRef = useRef(0);
  const orgPostsReqIdRef = useRef(0);
  const mutatingRef = useRef(false);
  const annMutationSeqRef = useRef(0);
  const acknowledgedOrgPostsRef = useRef<
    Record<string, Array<{ seq: number; post: Announcement }>>
  >({});
  const acknowledgedHubPostsRef = useRef<
    Array<{ seq: number; post: Announcement }>
  >([]);
  const orgMutationSeqRef = useRef(0);
  const mutatedOrgsRef = useRef<Map<string, PendingOrgFieldMap>>(new Map());
  const deptMutationSeqRef = useRef(0);
  const mutatedDeptRef = useRef<{ seq: number; value: DepartmentInfo } | null>(
    null
  );
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveClient = useCallback((): DeptOrgSupabaseClient => {
    return deptOrgClient ?? adaptSupabaseClient(getSupabaseClient());
  }, [deptOrgClient]);

  const loadOrgAnnouncements = useCallback(
    async (orgId: string) => {
      if (!deptOrgClient && !isSupabaseConfigured()) {
        if (mountedRef.current) {
          setOrgPostsLoading(false);
          setOrgPostsError(null);
        }
        return;
      }

      const requestId = ++orgPostsReqIdRef.current;
      const startAnnSeq = annMutationSeqRef.current;
      if (mountedRef.current) {
        setOrgPostsLoading(true);
        setOrgPostsError(null);
      }

      try {
        const posts = await fetchOrganizationAnnouncements(
          resolveClient(),
          orgId
        );
        if (!mountedRef.current || orgPostsReqIdRef.current !== requestId) {
          return;
        }
        const orgAck = acknowledgedOrgPostsRef.current[orgId] ?? [];
        const mergedPosts = mergeAcknowledgedAnnouncements(
          posts,
          orgAck,
          startAnnSeq
        );
        const remainingAck = orgAck.filter((entry) => entry.seq > startAnnSeq);
        if (remainingAck.length > 0) {
          acknowledgedOrgPostsRef.current[orgId] = remainingAck;
        } else {
          delete acknowledgedOrgPostsRef.current[orgId];
        }
        setOrgAnnouncementsByOrgId((current) => ({
          ...current,
          [orgId]: mergedPosts,
        }));
      } catch (err) {
        if (mountedRef.current && orgPostsReqIdRef.current === requestId) {
          setOrgPostsError(
            err instanceof Error
              ? err.message
              : 'Failed to load organization announcements.'
          );
        }
      } finally {
        if (mountedRef.current && orgPostsReqIdRef.current === requestId) {
          setOrgPostsLoading(false);
        }
      }
    },
    [deptOrgClient, resolveClient]
  );

  const refreshHub = useCallback(async () => {
    if (!deptOrgClient && !isSupabaseConfigured()) {
      hasLoadedRef.current = true;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    const requestId = ++refreshIdRef.current;
    const isInitialLoad = !hasLoadedRef.current;
    const startOrgSeq = orgMutationSeqRef.current;
    const startDeptSeq = deptMutationSeqRef.current;
    const startAnnSeq = annMutationSeqRef.current;
    if (mountedRef.current) {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setHubError(null);
    }

    try {
      const currentRoute = routeRef.current;
      const activeDetailOrgId =
        currentRoute.tab === 'orgs' && currentRoute.view.kind === 'detail'
          ? currentRoute.view.orgId
          : null;
      const [snapshot] = await Promise.all([
        loadHubSnapshot(resolveClient(), profile.id),
        activeDetailOrgId
          ? loadOrgAnnouncements(activeDetailOrgId)
          : Promise.resolve(),
      ]);
      if (!mountedRef.current || refreshIdRef.current !== requestId) {
        return;
      }

      const pendingDept = mutatedDeptRef.current;
      if (pendingDept && pendingDept.seq > startDeptSeq) {
        setDepartmentInfo(pendingDept.value);
      } else {
        mutatedDeptRef.current = null;
        setDepartmentInfo(snapshot.departmentInfo);
      }

      const mergedOrganizations = snapshot.organizations.map((org) => {
        const pendingFields = mutatedOrgsRef.current.get(org.id);
        if (!pendingFields) {
          return org;
        }
        let nextOrg: Organization = org;
        for (const key of Object.keys(pendingFields) as OrgMutableField[]) {
          const entry = pendingFields[key];
          if (entry && entry.seq > startOrgSeq) {
            nextOrg = { ...nextOrg, [key]: entry.value };
          }
        }
        return nextOrg;
      });
      for (const [orgId, pendingFields] of mutatedOrgsRef.current.entries()) {
        let remainingCount = 0;
        for (const key of Object.keys(pendingFields) as OrgMutableField[]) {
          const entry = pendingFields[key];
          if (!entry || entry.seq <= startOrgSeq) {
            delete pendingFields[key];
          } else {
            remainingCount += 1;
          }
        }
        if (remainingCount === 0) {
          mutatedOrgsRef.current.delete(orgId);
        }
      }
      setOrganizations(mergedOrganizations);
      setMemberships(snapshot.memberships);

      const mergedAnnouncements = mergeAcknowledgedAnnouncements(
        snapshot.announcements,
        acknowledgedHubPostsRef.current,
        startAnnSeq
      );
      acknowledgedHubPostsRef.current = acknowledgedHubPostsRef.current.filter(
        (entry) => entry.seq > startAnnSeq
      );
      setAnnouncements(mergedAnnouncements);
    } catch (err) {
      if (mountedRef.current && refreshIdRef.current === requestId) {
        setHubError(
          err instanceof Error ? err.message : 'Failed to load MyCCS hub data.'
        );
      }
    } finally {
      if (mountedRef.current && refreshIdRef.current === requestId) {
        hasLoadedRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [deptOrgClient, loadOrgAnnouncements, profile.id, resolveClient]);

  useEffect(() => {
    void refreshHub();
  }, [refreshHub]);

  const activeOrgId =
    route.tab === 'orgs' && route.view.kind === 'detail'
      ? route.view.orgId
      : null;

  useEffect(() => {
    if (!activeOrgId) {
      orgPostsReqIdRef.current += 1;
      setOrgPostsLoading(false);
      setOrgPostsError(null);
      return;
    }
    void loadOrgAnnouncements(activeOrgId);
  }, [activeOrgId, loadOrgAnnouncements]);

  const actor: RbacActor = {
    profileId: profile.id,
    role: profile.role,
    memberships,
  };

  const runMutation = async <T,>(work: () => Promise<T>): Promise<T> => {
    if (mutatingRef.current) {
      throw new Error('Another update is already in progress.');
    }
    mutatingRef.current = true;
    setMutating(true);
    setHubError(null);
    try {
      return await work();
    } finally {
      mutatingRef.current = false;
      if (mountedRef.current) {
        setMutating(false);
      }
    }
  };

  const handleCreateDepartmentInfo = async (
    input: DepartmentInfoCreateInput
  ) => {
    await runMutation(async () => {
      const created = await createDepartmentInfo(resolveClient(), input);
      if (mountedRef.current) {
        const seq = ++deptMutationSeqRef.current;
        mutatedDeptRef.current = { seq, value: created };
        setDepartmentInfo(created);
        if (routeRef.current.tab === 'department') {
          setRoute({ tab: 'department', mode: 'view' });
        }
      }
    });
  };

  const handleSaveDepartmentInfo = async (
    id: string,
    input: DepartmentInfoUpdateInput
  ) => {
    await runMutation(async () => {
      const updated = await updateDepartmentInfo(resolveClient(), id, input);
      if (mountedRef.current) {
        const seq = ++deptMutationSeqRef.current;
        mutatedDeptRef.current = { seq, value: updated };
        setDepartmentInfo(updated);
        if (routeRef.current.tab === 'department') {
          setRoute({ tab: 'department', mode: 'view' });
        }
      }
    });
  };

  const handlePublishAnnouncement = async (input: AnnouncementCreateInput) => {
    await runMutation(async () => {
      const created = await createAnnouncement(resolveClient(), input);
      if (mountedRef.current) {
        const seq = ++annMutationSeqRef.current;
        acknowledgedHubPostsRef.current.push({ seq, post: created });
        setAnnouncements((current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ]);
        if (created.organization_id !== null) {
          const orgId = created.organization_id;
          const existingAck = acknowledgedOrgPostsRef.current[orgId] ?? [];
          acknowledgedOrgPostsRef.current[orgId] = [
            ...existingAck,
            { seq, post: created },
          ];
          setOrgAnnouncementsByOrgId((current) => ({
            ...current,
            [orgId]: [
              created,
              ...(current[orgId] ?? []).filter((item) => item.id !== created.id),
            ],
          }));
        }
      }
    });
  };

  const handleUpdateOrganization = async (
    organizationId: string,
    input: OrganizationUpdateInput
  ) => {
    await runMutation(async () => {
      const updated = await updateOrganizationProfile(
        resolveClient(),
        organizationId,
        input
      );
      if (mountedRef.current) {
        const seq = ++orgMutationSeqRef.current;
        const nextFields: PendingOrgFieldMap = {
          ...(mutatedOrgsRef.current.get(organizationId) ?? {}),
        };
        const appliedPatch: Partial<Organization> = {};
        const recordField = <K extends OrgMutableField>(key: K) => {
          (nextFields as Record<OrgMutableField, { seq: number; value: unknown }>)[key] = {
            seq,
            value: updated[key],
          };
          (appliedPatch as Record<OrgMutableField, unknown>)[key] = updated[key];
        };
        for (const key of Object.keys(input) as OrgMutableField[]) {
          if (input[key] !== undefined) {
            recordField(key);
          }
        }
        mutatedOrgsRef.current.set(organizationId, nextFields);
        setOrganizations((current) =>
          current.map((org) =>
            org.id === updated.id ? { ...org, ...appliedPatch } : org
          )
        );
      }
    });
  };

  const handleUploadMedia = async (
    organizationId: string,
    kind: 'logo' | 'cover',
    localUri: string
  ): Promise<CompressImageResponse> => {
    return runMutation(async () => {
      let uploaded: CompressImageResponse;
      if (onUploadOrgMedia) {
        uploaded = await onUploadOrgMedia(organizationId, kind, localUri);
      } else {
        const client = resolveClient();
        const sessionResult = await client.auth?.getSession();
        const accessToken = sessionResult?.data.session?.access_token ?? '';
        if (!accessToken) {
          throw new Error(
            'Active session token required before uploading media.'
          );
        }

        const { supabaseUrl, publishableKey } = getClientSupabaseConfig();
        uploaded = await uploadCompressedOrgMedia({
          localUri,
          organizationId,
          kind,
          accessToken,
          supabaseUrl,
          publishableKey,
        });
      }

      if (mountedRef.current) {
        const seq = ++orgMutationSeqRef.current;
        const mediaPatch: Partial<Organization> =
          kind === 'cover'
            ? { cover_url: uploaded.publicUrl }
            : { logo_url: uploaded.publicUrl };
        const nextFields: PendingOrgFieldMap = {
          ...(mutatedOrgsRef.current.get(organizationId) ?? {}),
        };
        if (kind === 'cover') {
          nextFields.cover_url = { seq, value: uploaded.publicUrl };
        } else {
          nextFields.logo_url = { seq, value: uploaded.publicUrl };
        }
        mutatedOrgsRef.current.set(organizationId, nextFields);
        setOrganizations((current) =>
          current.map((org) =>
            org.id === organizationId ? { ...org, ...mediaPatch } : org
          )
        );
      }

      return uploaded;
    });
  };

  const handleSelectTab = (tab: HubTabId) => {
    switch (tab) {
      case 'feed':
        setRoute({ tab: 'feed' });
        break;
      case 'department':
        setRoute({ tab: 'department', mode: 'view' });
        break;
      case 'orgs':
        setRoute({ tab: 'orgs', view: { kind: 'directory' } });
        break;
      case 'identity':
        setRoute({ tab: 'identity' });
        break;
    }
  };

  const renderBody = () => {
    if (route.tab === 'identity') {
      return (
        <IdentityCard
          profile={profile}
          busy={busy}
          errorMessage={errorMessage}
          onSignOut={onSignOut}
        />
      );
    }

    if (loading) {
      return (
        <View style={styles.loadingState} testID="hub-loading">
          <Text style={styles.loadingText}>Loading MyCCS hub...</Text>
        </View>
      );
    }

    switch (route.tab) {
      case 'feed':
        return (
          <AnnouncementsFeedView
            announcements={announcements}
            organizations={organizations}
            actor={actor}
            busy={mutating}
            now={now}
            onPublishDepartmentAnnouncement={handlePublishAnnouncement}
          />
        );
      case 'department':
        return (
          <DepartmentAboutView
            departmentInfo={departmentInfo}
            actor={actor}
            mode={route.mode}
            busy={mutating}
            onEnterEdit={() => setRoute({ tab: 'department', mode: 'edit' })}
            onCancelEdit={() => setRoute({ tab: 'department', mode: 'view' })}
            onCreate={handleCreateDepartmentInfo}
            onSave={handleSaveDepartmentInfo}
          />
        );
      case 'orgs': {
        if (route.view.kind === 'detail') {
          const selectedOrg = findOrganizationById(
            organizations,
            route.view.orgId
          );
          if (selectedOrg) {
            const hasLoadedOrgPosts = Object.prototype.hasOwnProperty.call(
              orgAnnouncementsByOrgId,
              selectedOrg.id
            );
            const canFetchOrgPosts =
              Boolean(deptOrgClient) || isSupabaseConfigured();
            const isLoadingOrgPosts =
              orgPostsLoading ||
              (!hasLoadedOrgPosts && canFetchOrgPosts && orgPostsError === null);
            return (
              <OrgDetailView
                organization={selectedOrg}
                allOrganizations={organizations}
                memberships={memberships}
                announcements={orgAnnouncementsByOrgId[selectedOrg.id] ?? []}
                actor={actor}
                panel={route.view.panel}
                busy={mutating}
                postsLoading={isLoadingOrgPosts}
                postsError={orgPostsError}
                now={now}
                onBack={() =>
                  setRoute({ tab: 'orgs', view: { kind: 'directory' } })
                }
                onSelectOrg={(orgId) =>
                  setRoute({
                    tab: 'orgs',
                    view: { kind: 'detail', orgId, panel: 'posts' },
                  })
                }
                onChangePanel={(panel) =>
                  setRoute({
                    tab: 'orgs',
                    view: { kind: 'detail', orgId: selectedOrg.id, panel },
                  })
                }
                onUpdateOrg={handleUpdateOrganization}
                onCreatePost={handlePublishAnnouncement}
                onUploadMedia={handleUploadMedia}
              />
            );
          }
        }

        return (
          <OrgDirectoryView
            organizations={organizations}
            memberships={memberships}
            onSelectOrg={(orgId) =>
              setRoute({
                tab: 'orgs',
                view: { kind: 'detail', orgId, panel: 'posts' },
              })
            }
          />
        );
      }
    }
  };

  return (
    <View style={styles.screen} testID="myccs-hub-screen">
      {route.tab !== 'identity' ? (
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>MyCCS</Text>
            <Text style={styles.sectionSubtitle}>{getHeaderTitle(route)}</Text>
          </View>
          <Pressable
            style={styles.refreshButton}
            onPress={() => void refreshHub()}
            disabled={loading || refreshing || mutating}
            testID="hub-refresh-button"
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {hubError && route.tab !== 'identity' ? (
        <View style={styles.errorBanner} testID="hub-error-banner">
          <Text style={styles.errorBannerText}>{hubError}</Text>
        </View>
      ) : null}

      <View style={styles.body}>{renderBody()}</View>

      <View
        style={styles.bottomNav}
        accessibilityRole="tablist"
        testID="hub-bottom-nav"
      >
        {TAB_ITEMS.map((item) => {
          const isActive = route.tab === item.id;
          return (
            <Pressable
              key={item.id}
              style={styles.tabButton}
              onPress={() => handleSelectTab(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              testID={`tab-${item.id}`}
            >
              <View
                style={[
                  styles.activeBar,
                  isActive ? styles.activeBarVisible : styles.activeBarHidden,
                ]}
              />
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CCS_CREST_COLORS.crestCanvas,
  },
  topBar: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderBottomWidth: 1,
    borderBottomColor: CCS_CREST_COLORS.crestRule,
    paddingHorizontal: CCS_CREST_SPACING.xl,
    paddingVertical: CCS_CREST_SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CCS_CREST_COLORS.crestNavy,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  refreshButton: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderColor: CCS_CREST_COLORS.crestRuleStrong,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.pill,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    paddingHorizontal: CCS_CREST_SPACING.lg,
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: CCS_CREST_COLORS.inkPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: CCS_CREST_COLORS.absentCrimsonSoft,
    borderBottomWidth: 1,
    borderBottomColor: CCS_CREST_COLORS.absentCrimson,
    paddingHorizontal: CCS_CREST_SPACING.xl,
    paddingVertical: CCS_CREST_SPACING.sm,
  },
  errorBannerText: {
    color: CCS_CREST_COLORS.absentCrimson,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: CCS_CREST_SPACING.xl,
  },
  loadingText: {
    color: CCS_CREST_COLORS.inkSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomNav: {
    height: CCS_CREST_SIZES.bottomNavHeight,
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderTopWidth: 1,
    borderTopColor: CCS_CREST_COLORS.crestRule,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 6,
  },
  activeBar: {
    width: 26,
    height: 3,
    borderRadius: CCS_CREST_RADII.pill,
  },
  activeBarVisible: {
    backgroundColor: CCS_CREST_COLORS.circuitBlue,
  },
  activeBarHidden: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  tabLabelActive: {
    color: CCS_CREST_COLORS.circuitBlue,
    fontWeight: '700',
  },
});
