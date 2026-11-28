import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatManilaDate } from '../../shared/dept-org';
import {
  maskCertificationKey,
  parseNotificationDeepLink,
  type Certification,
  type DecryptedCertificationKey,
  type Notification,
  type NotificationType,
} from '../../shared/gmetrix';
import {
  CCS_CREST_COLORS,
  CCS_CREST_RADII,
  CCS_CREST_SIZES,
  CCS_CREST_SPACING,
} from '../theme/ccsCrest';

export type KeysSectionId = 'my_keys' | 'directory' | 'notifications';

export interface CertificationsAndKeysViewProps {
  section: KeysSectionId;
  certifications: readonly Certification[];
  keys: readonly DecryptedCertificationKey[];
  notifications: readonly Notification[];
  loading?: boolean;
  keysError?: string | null;
  certificationsError?: string | null;
  notificationsError?: string | null;
  onSelectSection: (section: KeysSectionId) => void;
  onMarkKeyViewed: (keyId: string) => Promise<void> | void;
  onOpenNotification: (notification: Notification) => Promise<void> | void;
}

const SECTION_TABS: ReadonlyArray<{ id: KeysSectionId; label: string }> = [
  { id: 'my_keys', label: 'My Keys' },
  { id: 'directory', label: 'Directory' },
  { id: 'notifications', label: 'Alerts' },
];

const MONO_FONT_FAMILY = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

function formatNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'gmetrix_key':
      return 'GMetrix Key';
    case 'org_application':
      return 'Organization';
    case 'event':
      return 'Event';
  }
}

export function CertificationsAndKeysView({
  section,
  certifications,
  keys,
  notifications,
  loading = false,
  keysError = null,
  certificationsError = null,
  notificationsError = null,
  onSelectSection,
  onMarkKeyViewed,
  onOpenNotification,
}: CertificationsAndKeysViewProps) {
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>(
    {}
  );
  const viewedTriggeredRef = useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter(
    (item) => item.read_at === null
  ).length;

  const handleToggleReveal = (key: DecryptedCertificationKey) => {
    const nextRevealed = !revealedKeyIds[key.id];
    setRevealedKeyIds((current) => ({
      ...current,
      [key.id]: nextRevealed,
    }));

    if (
      nextRevealed &&
      key.viewedAt === null &&
      !viewedTriggeredRef.current.has(key.id)
    ) {
      viewedTriggeredRef.current.add(key.id);
      void Promise.resolve(onMarkKeyViewed(key.id)).catch(() => {
        viewedTriggeredRef.current.delete(key.id);
      });
    }
  };

  const renderMyKeysSection = () => (
    <View testID="keys-section-view-my_keys">
      {keysError ? (
        <View style={styles.errorBanner} testID="keys-error-banner">
          <Text style={styles.errorBannerText}>{keysError}</Text>
        </View>
      ) : null}

      <View style={styles.sheet} testID="my-keys-list">
        {loading && keys.length === 0 ? (
          <View style={styles.emptyBlock} testID="keys-loading">
            <Text style={styles.mutedText}>Loading your GMetrix keys...</Text>
          </View>
        ) : keys.length === 0 ? (
          <View style={styles.emptyBlock} testID="keys-empty">
            <Text style={styles.emptyTitle}>No GMetrix keys assigned yet</Text>
            <Text style={styles.mutedText}>
              Assigned certification access keys for your institutional account
              will appear here.
            </Text>
          </View>
        ) : (
          keys.map((key, index) => {
            const isRevealed = Boolean(revealedKeyIds[key.id]);
            const isViewed = key.viewedAt !== null;

            return (
              <View
                key={key.id}
                style={[styles.row, index > 0 && styles.rowRule]}
                testID={`cert-key-item-${key.id}`}
              >
                <View style={styles.badgeRow}>
                  <View style={styles.providerBadge}>
                    <Text style={styles.providerBadgeText}>
                      {key.certificationProvider}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isViewed ? styles.viewedBadge : styles.newBadge,
                    ]}
                    testID={`cert-key-status-${key.id}`}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isViewed ? styles.viewedBadgeText : styles.newBadgeText,
                      ]}
                    >
                      {isViewed ? 'Viewed' : 'New'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.itemTitle}>{key.certificationTitle}</Text>

                <View style={styles.keyWell}>
                  <Text
                    style={styles.keyCodeText}
                    selectable={isRevealed}
                    testID={`cert-key-value-${key.id}`}
                  >
                    {isRevealed
                      ? key.keyCode
                      : maskCertificationKey(key.keyCode)}
                  </Text>
                </View>

                <View style={styles.keyFooterRow}>
                  <View style={styles.metaColumn}>
                    <Text style={styles.metaText}>
                      {`Assigned ${formatManilaDate(key.assignedAt)}`}
                    </Text>
                    {key.viewedAt ? (
                      <Text style={styles.metaText}>
                        {`Viewed ${formatManilaDate(key.viewedAt)}`}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    style={
                      isRevealed ? styles.secondaryButton : styles.primaryButton
                    }
                    onPress={() => handleToggleReveal(key)}
                    accessibilityRole="button"
                    testID={`reveal-key-${key.id}`}
                  >
                    <Text
                      style={
                        isRevealed
                          ? styles.secondaryButtonText
                          : styles.primaryButtonText
                      }
                    >
                      {isRevealed ? 'Hide Key' : 'Reveal Key'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );

  const renderDirectorySection = () => (
    <View testID="keys-section-view-directory">
      {certificationsError ? (
        <View style={styles.errorBanner} testID="certifications-error-banner">
          <Text style={styles.errorBannerText}>{certificationsError}</Text>
        </View>
      ) : null}

      <View style={styles.sheet} testID="certifications-directory-list">
        {loading && certifications.length === 0 ? (
          <View style={styles.emptyBlock} testID="certifications-loading">
            <Text style={styles.mutedText}>
              Loading certification directory...
            </Text>
          </View>
        ) : certifications.length === 0 ? (
          <View style={styles.emptyBlock} testID="certifications-empty">
            <Text style={styles.emptyTitle}>No active certifications</Text>
            <Text style={styles.mutedText}>
              Department-supported certification programs will appear here when
              published.
            </Text>
          </View>
        ) : (
          certifications.map((cert, index) => (
            <View
              key={cert.id}
              style={[styles.row, index > 0 && styles.rowRule]}
              testID={`certification-item-${cert.id}`}
            >
              <View style={styles.badgeRow}>
                <View style={styles.providerBadge}>
                  <Text style={styles.providerBadgeText}>{cert.provider}</Text>
                </View>
              </View>
              <Text style={styles.itemTitle}>{cert.title}</Text>
              {cert.description.trim().length > 0 ? (
                <Text style={styles.bodyText}>{cert.description}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderNotificationsSection = () => (
    <View testID="keys-section-view-notifications">
      {notificationsError ? (
        <View style={styles.errorBanner} testID="notifications-error-banner">
          <Text style={styles.errorBannerText}>{notificationsError}</Text>
        </View>
      ) : null}

      <View style={styles.sheet} testID="notifications-list">
        {loading && notifications.length === 0 ? (
          <View style={styles.emptyBlock} testID="notifications-loading">
            <Text style={styles.mutedText}>Loading alerts...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyBlock} testID="notifications-empty">
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.mutedText}>
              Certification key releases and department updates will show up in
              this inbox.
            </Text>
          </View>
        ) : (
          notifications.map((item, index) => {
            const isUnread = item.read_at === null;
            const opensMyKeys =
              parseNotificationDeepLink(item.deep_link) !== null;

            return (
              <Pressable
                key={item.id}
                style={[styles.notificationRow, index > 0 && styles.rowRule]}
                onPress={() => void onOpenNotification(item)}
                accessibilityRole="button"
                testID={`notification-item-${item.id}`}
              >
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      isUnread ? styles.unreadBadge : styles.readBadge,
                    ]}
                    testID={`notification-status-${item.id}`}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isUnread
                          ? styles.unreadBadgeText
                          : styles.readBadgeText,
                      ]}
                    >
                      {isUnread ? 'Unread' : 'Read'}
                    </Text>
                  </View>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {formatNotificationTypeLabel(item.type)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.bodyText}>{item.body}</Text>

                <View style={styles.notificationMetaRow}>
                  <Text style={styles.metaText}>
                    {formatManilaDate(item.created_at)}
                  </Text>
                  {opensMyKeys ? (
                    <Text style={styles.actionLinkText}>Open My Keys</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      testID="certifications-and-keys-view"
    >
      <View style={styles.subTabRow} accessibilityRole="tablist">
        {SECTION_TABS.map((tab) => {
          const active = section === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.subTab, active && styles.subTabActive]}
              onPress={() => onSelectSection(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`keys-section-${tab.id}`}
            >
              <View style={styles.subTabInner}>
                <Text
                  style={[styles.subTabText, active && styles.subTabTextActive]}
                >
                  {tab.label}
                </Text>
                {tab.id === 'notifications' && unreadCount > 0 ? (
                  <View
                    style={styles.unreadCountPill}
                    testID="keys-alerts-unread-badge"
                  >
                    <Text style={styles.unreadCountText}>{unreadCount}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {section === 'my_keys' ? renderMyKeysSection() : null}
      {section === 'directory' ? renderDirectorySection() : null}
      {section === 'notifications' ? renderNotificationsSection() : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: CCS_CREST_SPACING.xl,
    paddingBottom: CCS_CREST_SPACING.xxl,
  },
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: CCS_CREST_COLORS.crestRule,
    marginBottom: CCS_CREST_SPACING.lg,
  },
  subTab: {
    flex: 1,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: CCS_CREST_COLORS.circuitBlue,
  },
  subTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CCS_CREST_SPACING.xs,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  subTabTextActive: {
    color: CCS_CREST_COLORS.crestNavy,
    fontWeight: '700',
  },
  unreadCountPill: {
    backgroundColor: CCS_CREST_COLORS.laurelGoldSoft,
    borderColor: CCS_CREST_COLORS.laurelGoldBorder,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unreadCountText: {
    color: CCS_CREST_COLORS.laurelGoldInk,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    backgroundColor: CCS_CREST_COLORS.absentCrimsonSoft,
    borderColor: CCS_CREST_COLORS.absentCrimson,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.md,
    paddingHorizontal: CCS_CREST_SPACING.md,
    paddingVertical: CCS_CREST_SPACING.sm,
    marginBottom: CCS_CREST_SPACING.md,
  },
  errorBannerText: {
    color: CCS_CREST_COLORS.absentCrimson,
    fontSize: 13,
    fontWeight: '600',
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
    gap: CCS_CREST_SPACING.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
    textAlign: 'center',
  },
  mutedText: {
    fontSize: 14,
    color: CCS_CREST_COLORS.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    paddingVertical: CCS_CREST_SPACING.lg,
  },
  notificationRow: {
    paddingVertical: CCS_CREST_SPACING.lg,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
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
  providerBadge: {
    backgroundColor: CCS_CREST_COLORS.circuitTint,
    borderColor: CCS_CREST_COLORS.circuitBorder,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.sm,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: CCS_CREST_SPACING.xs,
  },
  providerBadgeText: {
    color: CCS_CREST_COLORS.circuitBlue,
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadge: {
    backgroundColor: CCS_CREST_COLORS.slateWell,
    borderColor: CCS_CREST_COLORS.crestRule,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.sm,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: CCS_CREST_SPACING.xs,
  },
  typeBadgeText: {
    color: CCS_CREST_COLORS.crestNavy,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.sm,
    paddingHorizontal: CCS_CREST_SPACING.sm,
    paddingVertical: CCS_CREST_SPACING.xs,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewedBadge: {
    backgroundColor: CCS_CREST_COLORS.presentEmeraldSoft,
    borderColor: CCS_CREST_COLORS.presentEmerald,
  },
  viewedBadgeText: {
    color: CCS_CREST_COLORS.presentEmerald,
  },
  newBadge: {
    backgroundColor: CCS_CREST_COLORS.laurelGoldSoft,
    borderColor: CCS_CREST_COLORS.laurelGoldBorder,
  },
  newBadgeText: {
    color: CCS_CREST_COLORS.laurelGoldInk,
  },
  unreadBadge: {
    backgroundColor: CCS_CREST_COLORS.laurelGoldSoft,
    borderColor: CCS_CREST_COLORS.laurelGoldBorder,
  },
  unreadBadgeText: {
    color: CCS_CREST_COLORS.laurelGoldInk,
  },
  readBadge: {
    backgroundColor: CCS_CREST_COLORS.slateWell,
    borderColor: CCS_CREST_COLORS.crestRule,
  },
  readBadgeText: {
    color: CCS_CREST_COLORS.inkMuted,
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
  keyWell: {
    backgroundColor: CCS_CREST_COLORS.slateWell,
    borderColor: CCS_CREST_COLORS.crestRule,
    borderWidth: 1,
    borderRadius: CCS_CREST_RADII.md,
    paddingHorizontal: CCS_CREST_SPACING.md,
    paddingVertical: CCS_CREST_SPACING.md,
    marginTop: CCS_CREST_SPACING.xs,
    marginBottom: CCS_CREST_SPACING.md,
  },
  keyCodeText: {
    fontFamily: MONO_FONT_FAMILY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: CCS_CREST_COLORS.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  keyFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CCS_CREST_SPACING.md,
  },
  metaColumn: {
    flex: 1,
    gap: 2,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
  },
  notificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: CCS_CREST_SPACING.md,
  },
  actionLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: CCS_CREST_COLORS.circuitBlue,
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
    fontSize: 13,
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
});
