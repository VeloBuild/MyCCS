import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AnnouncementCreateInputSchema,
  canManageOrganization,
  canPublishAnnouncement,
  OrganizationUpdateInputSchema,
  type Announcement,
  type AnnouncementCreateInput,
  type Organization,
  type OrganizationUpdateInput,
  type OrgMembership,
  type RbacActor,
} from '../../shared/core-schema';
import {
  findOrganizationById,
  formatManilaDate,
  getMembershipForOrg,
  getOrganizationPosts,
  getOrgInitials,
  isAnnouncementExpired,
  parseOptionalExpiryInput,
} from '../../shared/dept-org';
import type { CompressImageResponse } from '../../shared/media-upload';
import {
  CCS_CREST_COLORS,
  CCS_CREST_RADII,
  CCS_CREST_SIZES,
  CCS_CREST_SPACING,
} from '../theme/ccsCrest';
import { resolveMembershipBadge } from './OrgDirectoryView';

export interface OrgDetailViewProps {
  organization: Organization;
  allOrganizations: readonly Organization[];
  memberships: readonly OrgMembership[];
  announcements: readonly Announcement[];
  actor: RbacActor;
  panel: 'posts' | 'edit_org' | 'new_post';
  busy?: boolean;
  now?: Date;
  onBack: () => void;
  onSelectOrg: (orgId: string) => void;
  onChangePanel: (panel: 'posts' | 'edit_org' | 'new_post') => void;
  onUpdateOrg: (
    organizationId: string,
    input: OrganizationUpdateInput
  ) => Promise<void>;
  onCreatePost: (input: AnnouncementCreateInput) => Promise<void>;
  onUploadMedia?: (
    organizationId: string,
    kind: 'logo' | 'cover',
    localUri: string
  ) => Promise<CompressImageResponse>;
}

interface OrgEditPanelProps {
  organization: Organization;
  busy: boolean;
  onChangePanel: (panel: 'posts' | 'edit_org' | 'new_post') => void;
  onUpdateOrg: (
    organizationId: string,
    input: OrganizationUpdateInput
  ) => Promise<void>;
  onUploadMedia?: (
    organizationId: string,
    kind: 'logo' | 'cover',
    localUri: string
  ) => Promise<CompressImageResponse>;
}

function OrgEditPanel({
  organization,
  busy,
  onChangePanel,
  onUpdateOrg,
  onUploadMedia,
}: OrgEditPanelProps) {
  const [name, setName] = useState(organization.name);
  const [details, setDetails] = useState(organization.details);
  const [coverLocalUri, setCoverLocalUri] = useState('');
  const [logoLocalUri, setLogoLocalUri] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<'logo' | 'cover' | null>(
    null
  );

  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const controlsDisabled = busy || uploadingKind !== null;

  const handleSaveOrgDetails = async () => {
    if (controlsDisabled || submittingRef.current) {
      return;
    }

    setEditError(null);
    setMediaStatus(null);

    const parsed = OrganizationUpdateInputSchema.safeParse({
      name,
      details,
    });
    if (!parsed.success) {
      setEditError(
        parsed.error.issues[0]?.message ?? 'Invalid organization profile.'
      );
      return;
    }

    submittingRef.current = true;
    try {
      await onUpdateOrg(organization.id, parsed.data);
      if (mountedRef.current) {
        onChangePanel('posts');
      }
    } catch (err) {
      if (mountedRef.current) {
        setEditError(
          err instanceof Error ? err.message : 'Failed to update organization.'
        );
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const handleUploadAsset = async (kind: 'cover' | 'logo') => {
    if (controlsDisabled || submittingRef.current) {
      return;
    }

    setEditError(null);
    setMediaStatus(null);

    if (!onUploadMedia) {
      setEditError('Image upload handler is unavailable.');
      return;
    }

    const rawUri = kind === 'cover' ? coverLocalUri : logoLocalUri;
    const trimmedUri = rawUri.trim();
    if (trimmedUri.length === 0) {
      setEditError(
        kind === 'cover'
          ? 'Enter a local cover image URI to upload.'
          : 'Enter a local logo image URI to upload.'
      );
      return;
    }

    submittingRef.current = true;
    setUploadingKind(kind);
    try {
      const uploaded = await onUploadMedia(organization.id, kind, trimmedUri);
      if (!mountedRef.current) {
        return;
      }
      await onUpdateOrg(
        organization.id,
        kind === 'cover'
          ? { cover_url: uploaded.publicUrl }
          : { logo_url: uploaded.publicUrl }
      );
      if (!mountedRef.current) {
        return;
      }
      if (kind === 'cover') {
        setCoverLocalUri('');
        setMediaStatus('Cover image compressed and updated.');
      } else {
        setLogoLocalUri('');
        setMediaStatus('Logo image compressed and updated.');
      }
    } catch (err) {
      if (mountedRef.current) {
        setEditError(
          err instanceof Error ? err.message : 'Failed to upload image.'
        );
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setUploadingKind(null);
      }
    }
  };

  return (
    <View
      style={[styles.sectionBlock, styles.sectionRule]}
      testID="org-edit-panel"
    >
      <Text style={styles.sectionHeading}>Customize Organization</Text>

      <Text style={styles.fieldLabel}>Organization Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Organization name"
        testID="org-edit-name-input"
      />

      <Text style={styles.fieldLabel}>Details</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={details}
        onChangeText={setDetails}
        multiline
        placeholder="Describe the organization's mission and activities"
        testID="org-edit-details-input"
      />

      <Text style={styles.fieldLabel}>Cover Image Local URI</Text>
      <View style={styles.uploadRow}>
        <TextInput
          style={[styles.input, styles.uploadInput]}
          value={coverLocalUri}
          onChangeText={setCoverLocalUri}
          autoCapitalize="none"
          placeholder="file:///path/to/cover.jpg"
          testID="org-cover-uri-input"
        />
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void handleUploadAsset('cover')}
          disabled={controlsDisabled}
          testID="org-upload-cover-button"
        >
          <Text style={styles.secondaryButtonText}>
            {uploadingKind === 'cover' ? 'Uploading...' : 'Upload Cover'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>Logo Image Local URI</Text>
      <View style={styles.uploadRow}>
        <TextInput
          style={[styles.input, styles.uploadInput]}
          value={logoLocalUri}
          onChangeText={setLogoLocalUri}
          autoCapitalize="none"
          placeholder="file:///path/to/logo.png"
          testID="org-logo-uri-input"
        />
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void handleUploadAsset('logo')}
          disabled={controlsDisabled}
          testID="org-upload-logo-button"
        >
          <Text style={styles.secondaryButtonText}>
            {uploadingKind === 'logo' ? 'Uploading...' : 'Upload Logo'}
          </Text>
        </Pressable>
      </View>

      {mediaStatus ? (
        <Text style={styles.successText} testID="org-media-status">
          {mediaStatus}
        </Text>
      ) : null}

      {editError ? (
        <Text style={styles.errorText} testID="org-edit-error">
          {editError}
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleSaveOrgDetails()}
          disabled={controlsDisabled}
          testID="org-edit-save-button"
        >
          <Text style={styles.primaryButtonText}>Save Changes</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => onChangePanel('posts')}
          disabled={controlsDisabled}
          testID="org-edit-cancel-button"
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface OrgPostComposerProps {
  organizationId: string;
  busy: boolean;
  referenceNow: Date;
  onChangePanel: (panel: 'posts' | 'edit_org' | 'new_post') => void;
  onCreatePost: (input: AnnouncementCreateInput) => Promise<void>;
}

function OrgPostComposer({
  organizationId,
  busy,
  referenceNow,
  onChangePanel,
  onCreatePost,
}: OrgPostComposerProps) {
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postExpiresInput, setPostExpiresInput] = useState('');
  const [postError, setPostError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handlePublishOrgPost = async () => {
    if (busy || submittingRef.current) {
      return;
    }

    setPostError(null);

    let expiresAt: string | null;
    try {
      expiresAt = parseOptionalExpiryInput(postExpiresInput);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Invalid expiration.');
      return;
    }

    if (expiresAt !== null && Date.parse(expiresAt) <= referenceNow.getTime()) {
      setPostError('Expiration date must be in the future.');
      return;
    }

    const parsed = AnnouncementCreateInputSchema.safeParse({
      organization_id: organizationId,
      title: postTitle,
      content: postContent,
      global_visibility: false,
      expires_at: expiresAt,
    });

    if (!parsed.success) {
      setPostError(parsed.error.issues[0]?.message ?? 'Invalid post fields.');
      return;
    }

    submittingRef.current = true;
    try {
      await onCreatePost(parsed.data);
      if (mountedRef.current) {
        setPostTitle('');
        setPostContent('');
        setPostExpiresInput('');
        onChangePanel('posts');
      }
    } catch (err) {
      if (mountedRef.current) {
        setPostError(
          err instanceof Error ? err.message : 'Failed to publish post.'
        );
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <View
      style={[styles.sectionBlock, styles.sectionRule]}
      testID="org-new-post-panel"
    >
      <Text style={styles.sectionHeading}>New Organization Post</Text>

      <Text style={styles.fieldLabel}>Title</Text>
      <TextInput
        style={styles.input}
        value={postTitle}
        onChangeText={setPostTitle}
        placeholder="Post headline"
        testID="org-post-title-input"
      />

      <Text style={styles.fieldLabel}>Content</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={postContent}
        onChangeText={setPostContent}
        multiline
        placeholder="Share an update with members..."
        testID="org-post-content-input"
      />

      <Text style={styles.fieldLabel}>Expiration (optional)</Text>
      <TextInput
        style={styles.input}
        value={postExpiresInput}
        onChangeText={setPostExpiresInput}
        autoCapitalize="none"
        placeholder="YYYY-MM-DD or ISO timestamp"
        testID="org-post-expires-input"
      />

      {postError ? (
        <Text style={styles.errorText} testID="org-post-error">
          {postError}
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handlePublishOrgPost()}
          disabled={busy}
          testID="org-post-publish-button"
        >
          <Text style={styles.primaryButtonText}>Publish Post</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => onChangePanel('posts')}
          disabled={busy}
          testID="org-post-cancel-button"
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function OrgDetailView({
  organization,
  allOrganizations,
  memberships,
  announcements,
  actor,
  panel,
  busy = false,
  now,
  onBack,
  onSelectOrg,
  onChangePanel,
  onUpdateOrg,
  onCreatePost,
  onUploadMedia,
}: OrgDetailViewProps) {
  const referenceNow = now ?? new Date();
  const canCustomize = canManageOrganization(actor, organization, 'update');
  const canPost = canPublishAnnouncement(actor, {
    organization_id: organization.id,
    global_visibility: false,
  });

  const parentOrg = organization.parent_org_id
    ? findOrganizationById(allOrganizations, organization.parent_org_id)
    : null;
  const tierLabel = organization.parent_org_id
    ? parentOrg
      ? `Sub-org of ${parentOrg.name}`
      : 'Sub-organization'
    : 'Main organization';

  const membership = getMembershipForOrg(memberships, organization.id);
  const badge = resolveMembershipBadge(membership);

  const subOrgs =
    organization.parent_org_id === null
      ? allOrganizations
          .filter(
            (org) =>
              org.deleted_at === null && org.parent_org_id === organization.id
          )
          .sort((a, b) => {
            const nameDiff = a.name.localeCompare(b.name, undefined, {
              sensitivity: 'base',
            });
            return nameDiff !== 0 ? nameDiff : a.id.localeCompare(b.id);
          })
      : [];

  // shortcut: Org pages render read-only chronological posts with no likes, comments, or drag-and-drop builder; upgrade in Phase 2 if orgs request interactive discussions
  const posts = getOrganizationPosts(
    announcements,
    organization.id,
    actor,
    referenceNow
  );

  return (
    <ScrollView contentContainerStyle={styles.content} testID="org-detail-view">
      <Pressable
        style={styles.backButton}
        onPress={onBack}
        testID="org-detail-back-button"
      >
        <Text style={styles.backButtonText}>Back to Organizations</Text>
      </Pressable>

      <View style={styles.sheet}>
        {organization.cover_url ? (
          <Image
            source={{ uri: organization.cover_url }}
            style={styles.coverImage}
            accessibilityLabel={`${organization.name} cover`}
            testID="org-detail-cover-image"
          />
        ) : (
          <View
            style={styles.coverFallback}
            testID="org-detail-cover-fallback"
          >
            <View style={styles.crestAccentRow}>
              <View style={styles.crestCyanStrip} />
              <View style={styles.crestGoldStrip} />
            </View>
            <Text style={styles.coverFallbackLabel}>CCS Organization</Text>
          </View>
        )}

        <View style={styles.profileHeader}>
          {organization.logo_url ? (
            <Image
              source={{ uri: organization.logo_url }}
              style={styles.logoImage}
              accessibilityLabel={`${organization.name} logo`}
              testID="org-detail-logo-image"
            />
          ) : (
            <View style={styles.logoMonogram} testID="org-detail-logo-monogram">
              <Text style={styles.logoMonogramText}>
                {getOrgInitials(organization.name)}
              </Text>
            </View>
          )}

          <View style={styles.headerMeta}>
            <View style={styles.titleRow}>
              <Text style={styles.orgTitle} testID="org-detail-name">
                {organization.name}
              </Text>
              {badge ? (
                <View
                  style={[
                    styles.membershipBadge,
                    {
                      backgroundColor: badge.backgroundColor,
                      borderColor: badge.borderColor,
                    },
                  ]}
                  testID="org-detail-membership-badge"
                >
                  <Text
                    style={[
                      styles.membershipBadgeText,
                      { color: badge.textColor },
                    ]}
                  >
                    {badge.label}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.tierText} testID="org-detail-tier">
              {tierLabel}
            </Text>
          </View>
        </View>

        <View style={[styles.sectionBlock, styles.sectionRule]}>
          <Text style={styles.sectionHeading}>About</Text>
          <Text style={styles.bodyText} testID="org-detail-about">
            {organization.details.trim().length > 0
              ? organization.details
              : 'No organization details provided yet.'}
          </Text>
        </View>

        {canCustomize || canPost ? (
          <View style={[styles.sectionBlock, styles.sectionRule]}>
            <View style={styles.actionRow}>
              {canCustomize ? (
                <Pressable
                  style={styles.primaryButton}
                  onPress={() =>
                    onChangePanel(panel === 'edit_org' ? 'posts' : 'edit_org')
                  }
                  disabled={busy}
                  testID="org-customize-button"
                >
                  <Text style={styles.primaryButtonText}>
                    Customize Org Page
                  </Text>
                </Pressable>
              ) : null}
              {canPost ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    onChangePanel(panel === 'new_post' ? 'posts' : 'new_post')
                  }
                  disabled={busy}
                  testID="org-new-post-button"
                >
                  <Text style={styles.secondaryButtonText}>New Org Post</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {canCustomize && panel === 'edit_org' ? (
          <OrgEditPanel
            key={organization.id}
            organization={organization}
            busy={busy}
            onChangePanel={onChangePanel}
            onUpdateOrg={onUpdateOrg}
            onUploadMedia={onUploadMedia}
          />
        ) : null}

        {canPost && panel === 'new_post' ? (
          <OrgPostComposer
            key={organization.id}
            organizationId={organization.id}
            busy={busy}
            referenceNow={referenceNow}
            onChangePanel={onChangePanel}
            onCreatePost={onCreatePost}
          />
        ) : null}
      </View>

      {subOrgs.length > 0 ? (
        <View style={styles.sheet} testID="org-suborgs-section">
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Sub-organizations</Text>
            {subOrgs.map((subOrg, index) => (
              <Pressable
                key={subOrg.id}
                style={[styles.subOrgRow, index > 0 && styles.sectionRule]}
                onPress={() => onSelectOrg(subOrg.id)}
                testID={`org-suborg-row-${subOrg.id}`}
              >
                <Text style={styles.rowTitle}>{subOrg.name}</Text>
                {subOrg.details.trim().length > 0 ? (
                  <Text style={styles.mutedText} numberOfLines={2}>
                    {subOrg.details}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.sheet} testID="org-posts-section">
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Posts</Text>
          {posts.length === 0 ? (
            <Text style={styles.mutedText} testID="org-posts-empty">
              No organization posts yet.
            </Text>
          ) : (
            posts.map((post, index) => {
              const expired = isAnnouncementExpired(post, referenceNow);
              return (
                <View
                  key={post.id}
                  style={[styles.postRow, index > 0 && styles.sectionRule]}
                  testID={`org-post-item-${post.id}`}
                >
                  <View style={styles.titleRow}>
                    <Text style={styles.rowTitle}>{post.title}</Text>
                    {expired ? (
                      <View style={styles.expiredBadge}>
                        <Text style={styles.expiredBadgeText}>Expired</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.bodyText}>{post.content}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {`Published ${formatManilaDate(post.published_at)}`}
                    </Text>
                    {post.expires_at ? (
                      <Text style={styles.metaText}>
                        {`Expires ${formatManilaDate(post.expires_at)}`}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: CCS_CREST_SPACING.xl,
    paddingBottom: CCS_CREST_SPACING.xxl,
    gap: CCS_CREST_SPACING.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderColor: CCS_CREST_COLORS.crestRuleStrong,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.pill,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    paddingHorizontal: CCS_CREST_SPACING.lg,
    justifyContent: 'center',
  },
  backButtonText: {
    color: CCS_CREST_COLORS.crestNavy,
    fontWeight: '700',
    fontSize: 13,
  },
  sheet: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderRadius: CCS_CREST_RADII.lg,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 150,
    backgroundColor: CCS_CREST_COLORS.slateWell,
  },
  coverFallback: {
    height: 112,
    backgroundColor: CCS_CREST_COLORS.crestNavy,
    justifyContent: 'space-between',
    padding: CCS_CREST_SPACING.lg,
  },
  crestAccentRow: {
    flexDirection: 'row',
    gap: CCS_CREST_SPACING.sm,
  },
  crestCyanStrip: {
    width: 36,
    height: 4,
    borderRadius: CCS_CREST_RADII.pill,
    backgroundColor: CCS_CREST_COLORS.shieldCyan,
  },
  crestGoldStrip: {
    width: 24,
    height: 4,
    borderRadius: CCS_CREST_RADII.pill,
    backgroundColor: CCS_CREST_COLORS.laurelGold,
  },
  coverFallbackLabel: {
    color: CCS_CREST_COLORS.paperWhite,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CCS_CREST_SPACING.md,
    padding: CCS_CREST_SPACING.lg,
  },
  logoImage: {
    width: 56,
    height: 56,
    borderRadius: CCS_CREST_RADII.md,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
  },
  logoMonogram: {
    width: 56,
    height: 56,
    borderRadius: CCS_CREST_RADII.md,
    backgroundColor: CCS_CREST_COLORS.crestNavy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoMonogramText: {
    color: CCS_CREST_COLORS.paperWhite,
    fontSize: 18,
    fontWeight: '700',
  },
  headerMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: CCS_CREST_SPACING.sm,
  },
  orgTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
  },
  tierText: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
    marginTop: 2,
  },
  sectionBlock: {
    padding: CCS_CREST_SPACING.lg,
  },
  sectionRule: {
    borderTopWidth: 1,
    borderTopColor: CCS_CREST_COLORS.crestRule,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.crestNavy,
    marginBottom: CCS_CREST_SPACING.sm,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: 2,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: CCS_CREST_COLORS.inkSecondary,
  },
  mutedText: {
    fontSize: 13,
    color: CCS_CREST_COLORS.inkMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CCS_CREST_SPACING.md,
    marginTop: CCS_CREST_SPACING.xs,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  subOrgRow: {
    paddingVertical: CCS_CREST_SPACING.md,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    justifyContent: 'center',
  },
  postRow: {
    paddingVertical: CCS_CREST_SPACING.md,
  },
  membershipBadge: {
    borderRadius: CCS_CREST_RADII.sm,
    borderWidth: 1,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: 2,
  },
  membershipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expiredBadge: {
    backgroundColor: CCS_CREST_COLORS.laurelGoldSoft,
    borderColor: CCS_CREST_COLORS.laurelGoldBorder,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.sm,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: 2,
  },
  expiredBadgeText: {
    color: CCS_CREST_COLORS.laurelGoldInk,
    fontSize: 11,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: CCS_CREST_SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRuleStrong,
    borderRadius: CCS_CREST_RADII.md,
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    color: CCS_CREST_COLORS.inkPrimary,
    paddingHorizontal: CCS_CREST_SPACING.md,
    paddingVertical: 10,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    marginBottom: CCS_CREST_SPACING.md,
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CCS_CREST_SPACING.sm,
    marginBottom: CCS_CREST_SPACING.md,
  },
  uploadInput: {
    flex: 1,
    marginBottom: 0,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CCS_CREST_SPACING.sm,
  },
  primaryButton: {
    backgroundColor: CCS_CREST_COLORS.crestNavy,
    borderRadius: CCS_CREST_RADII.pill,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    paddingHorizontal: CCS_CREST_SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: CCS_CREST_COLORS.paperWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderColor: CCS_CREST_COLORS.crestRuleStrong,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.pill,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    paddingHorizontal: CCS_CREST_SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: CCS_CREST_COLORS.inkPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  errorText: {
    color: CCS_CREST_COLORS.absentCrimson,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: CCS_CREST_SPACING.sm,
  },
  successText: {
    color: CCS_CREST_COLORS.presentEmerald,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: CCS_CREST_SPACING.sm,
  },
});
