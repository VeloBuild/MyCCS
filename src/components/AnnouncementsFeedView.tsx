import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AnnouncementCreateInputSchema,
  canPublishAnnouncement,
  type Announcement,
  type AnnouncementCreateInput,
  type Organization,
  type RbacActor,
} from '../../shared/core-schema';
import {
  filterAnnouncementsFeed,
  formatManilaDate,
  isAnnouncementExpired,
  parseOptionalExpiryInput,
  type AnnouncementFilter,
} from '../../shared/dept-org';
import {
  CCS_CREST_COLORS,
  CCS_CREST_RADII,
  CCS_CREST_SIZES,
  CCS_CREST_SPACING,
} from '../theme/ccsCrest';

export interface AnnouncementsFeedViewProps {
  announcements: readonly Announcement[];
  organizations: readonly Organization[];
  actor: RbacActor;
  busy?: boolean;
  now?: Date;
  onPublishDepartmentAnnouncement?: (
    input: AnnouncementCreateInput
  ) => Promise<void>;
}

const FILTER_OPTIONS: ReadonlyArray<{ id: AnnouncementFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'department', label: 'Department' },
  { id: 'my_orgs', label: 'My Orgs' },
];

export function AnnouncementsFeedView({
  announcements,
  organizations,
  actor,
  busy = false,
  now,
  onPublishDepartmentAnnouncement,
}: AnnouncementsFeedViewProps) {
  const [filter, setFilter] = useState<AnnouncementFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [expiresInput, setExpiresInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const referenceNow = now ?? new Date();
  const canPublishDepartment =
    Boolean(onPublishDepartmentAnnouncement) &&
    canPublishAnnouncement(actor, {
      organization_id: null,
      global_visibility: true,
    });

  const organizationsById = new Map<string, Organization>(
    organizations.map((org) => [org.id, org])
  );

  const visibleAnnouncements = filterAnnouncementsFeed(
    announcements,
    actor,
    filter,
    referenceNow
  );

  const handlePublish = async () => {
    if (!onPublishDepartmentAnnouncement || busy || submittingRef.current) {
      return;
    }

    setFormError(null);
    let expiresAt: string | null;
    try {
      expiresAt = parseOptionalExpiryInput(expiresInput);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid expiration.');
      return;
    }

    if (expiresAt !== null && Date.parse(expiresAt) <= referenceNow.getTime()) {
      setFormError('Expiration date must be in the future.');
      return;
    }

    const parsed = AnnouncementCreateInputSchema.safeParse({
      organization_id: null,
      title,
      content,
      global_visibility: true,
      expires_at: expiresAt,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? 'Invalid announcement fields.'
      );
      return;
    }

    submittingRef.current = true;
    try {
      await onPublishDepartmentAnnouncement(parsed.data);
      if (mountedRef.current) {
        setTitle('');
        setContent('');
        setExpiresInput('');
        setComposerOpen(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setFormError(
          err instanceof Error ? err.message : 'Failed to publish notice.'
        );
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.filterRow} accessibilityRole="tablist">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.filterTab, active && styles.filterTabActive]}
              onPress={() => setFilter(option.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`feed-filter-${option.id}`}
            >
              <Text
                style={[
                  styles.filterTabText,
                  active && styles.filterTabTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {canPublishDepartment ? (
        <View style={styles.composerTriggerRow}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setFormError(null);
              setComposerOpen((open) => !open);
            }}
            disabled={busy}
            testID="dept-new-notice-button"
          >
            <Text style={styles.primaryButtonText}>
              {composerOpen ? 'Close Notice Composer' : 'New Department Notice'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {canPublishDepartment && composerOpen ? (
        <View style={styles.composerSheet} testID="dept-notice-composer">
          <Text style={styles.headline}>New Department Notice</Text>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Announcement headline"
            testID="dept-notice-title-input"
          />

          <Text style={styles.fieldLabel}>Details</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Share department-wide details..."
            testID="dept-notice-content-input"
          />

          <Text style={styles.fieldLabel}>Expiration (optional)</Text>
          <TextInput
            style={styles.input}
            value={expiresInput}
            onChangeText={setExpiresInput}
            placeholder="YYYY-MM-DD or ISO timestamp"
            autoCapitalize="none"
            testID="dept-notice-expires-input"
          />

          {formError ? (
            <Text style={styles.errorText} testID="dept-notice-error">
              {formError}
            </Text>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => void handlePublish()}
              disabled={busy}
              testID="dept-notice-publish-button"
            >
              <Text style={styles.primaryButtonText}>Publish Notice</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setFormError(null);
                setComposerOpen(false);
              }}
              disabled={busy}
              testID="dept-notice-cancel-button"
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.sheet} testID="announcements-feed-list">
        {visibleAnnouncements.length === 0 ? (
          <View style={styles.emptyBlock} testID="announcements-empty">
            <Text style={styles.mutedText}>
              No announcements match this filter.
            </Text>
          </View>
        ) : (
          visibleAnnouncements.map((item, index) => {
            const org = item.organization_id
              ? (organizationsById.get(item.organization_id) ?? null)
              : null;
            const scopeLabel =
              item.organization_id === null
                ? 'Department-wide'
                : org
                  ? item.global_visibility
                    ? `${org.name} · Department-wide`
                    : org.name
                  : 'Organization';
            const expired = isAnnouncementExpired(item, referenceNow);

            return (
              <View
                key={item.id}
                style={[styles.announcementRow, index > 0 && styles.rowRule]}
                testID={`announcement-item-${item.id}`}
              >
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.scopeBadge,
                      item.organization_id === null
                        ? styles.deptBadge
                        : styles.orgBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeBadgeText,
                        item.organization_id === null
                          ? styles.deptBadgeText
                          : styles.orgBadgeText,
                      ]}
                    >
                      {scopeLabel}
                    </Text>
                  </View>

                  {expired ? (
                    <View
                      style={styles.expiredBadge}
                      testID={`announcement-expired-badge-${item.id}`}
                    >
                      <Text style={styles.expiredBadgeText}>Expired</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.bodyText}>{item.content}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {`Published ${formatManilaDate(item.published_at)}`}
                  </Text>
                  {item.expires_at ? (
                    <Text
                      style={styles.metaText}
                      testID={`announcement-expires-${item.id}`}
                    >
                      {`Expires ${formatManilaDate(item.expires_at)}`}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: CCS_CREST_SPACING.xl,
    paddingBottom: CCS_CREST_SPACING.xxl,
  },
  filterRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: CCS_CREST_COLORS.crestRule,
    marginBottom: CCS_CREST_SPACING.lg,
  },
  filterTab: {
    flex: 1,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: CCS_CREST_COLORS.circuitBlue,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  filterTabTextActive: {
    color: CCS_CREST_COLORS.crestNavy,
    fontWeight: '700',
  },
  composerTriggerRow: {
    marginBottom: CCS_CREST_SPACING.md,
    alignItems: 'flex-start',
  },
  composerSheet: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderRadius: CCS_CREST_RADII.lg,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
    padding: CCS_CREST_SPACING.lg,
    marginBottom: CCS_CREST_SPACING.lg,
  },
  sheet: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderRadius: CCS_CREST_RADII.lg,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
    paddingHorizontal: CCS_CREST_SPACING.lg,
  },
  emptyBlock: {
    paddingVertical: CCS_CREST_SPACING.xl,
    alignItems: 'center',
  },
  announcementRow: {
    paddingVertical: CCS_CREST_SPACING.lg,
  },
  rowRule: {
    borderTopWidth: 1,
    borderTopColor: CCS_CREST_COLORS.crestRule,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CCS_CREST_SPACING.sm,
    marginBottom: CCS_CREST_SPACING.sm,
  },
  scopeBadge: {
    borderRadius: CCS_CREST_RADII.sm,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: CCS_CREST_SPACING.xs,
    borderWidth: 1,
  },
  deptBadge: {
    backgroundColor: CCS_CREST_COLORS.circuitTint,
    borderColor: CCS_CREST_COLORS.circuitBorder,
  },
  orgBadge: {
    backgroundColor: CCS_CREST_COLORS.slateWell,
    borderColor: CCS_CREST_COLORS.crestRule,
  },
  scopeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deptBadgeText: {
    color: CCS_CREST_COLORS.circuitBlue,
  },
  orgBadgeText: {
    color: CCS_CREST_COLORS.crestNavy,
  },
  expiredBadge: {
    backgroundColor: CCS_CREST_COLORS.laurelGoldSoft,
    borderColor: CCS_CREST_COLORS.laurelGoldBorder,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.sm,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: CCS_CREST_SPACING.xs,
  },
  expiredBadgeText: {
    color: CCS_CREST_COLORS.laurelGoldInk,
    fontSize: 12,
    fontWeight: '600',
  },
  headline: {
    fontSize: 17,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: CCS_CREST_SPACING.md,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
    marginBottom: CCS_CREST_SPACING.xs,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    color: CCS_CREST_COLORS.inkSecondary,
    marginBottom: CCS_CREST_SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CCS_CREST_SPACING.md,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  mutedText: {
    fontSize: 14,
    color: CCS_CREST_COLORS.inkMuted,
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
    minHeight: 88,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
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
    fontSize: 14,
  },
  errorText: {
    color: CCS_CREST_COLORS.absentCrimson,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: CCS_CREST_SPACING.sm,
  },
});
