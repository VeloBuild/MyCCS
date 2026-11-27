import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Organization, OrgMembership } from '../../shared/core-schema';
import {
  buildOrganizationTree,
  getMembershipForOrg,
  getOrgInitials,
} from '../../shared/dept-org';
import {
  CCS_CREST_COLORS,
  CCS_CREST_RADII,
  CCS_CREST_SIZES,
  CCS_CREST_SPACING,
} from '../theme/ccsCrest';

export interface OrgDirectoryViewProps {
  organizations: readonly Organization[];
  memberships: readonly OrgMembership[];
  onSelectOrg: (orgId: string) => void;
}

interface MembershipBadgeConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

export function resolveMembershipBadge(
  membership: OrgMembership | null
): MembershipBadgeConfig | null {
  if (!membership) {
    return null;
  }

  if (membership.status === 'pending') {
    return {
      label: 'Pending',
      backgroundColor: CCS_CREST_COLORS.laurelGoldSoft,
      textColor: CCS_CREST_COLORS.laurelGoldInk,
      borderColor: CCS_CREST_COLORS.laurelGoldBorder,
    };
  }

  if (membership.status === 'rejected') {
    return {
      label: 'Rejected',
      backgroundColor: CCS_CREST_COLORS.absentCrimsonSoft,
      textColor: CCS_CREST_COLORS.absentCrimson,
      borderColor: CCS_CREST_COLORS.absentCrimson,
    };
  }

  if (membership.role === 'officer') {
    return {
      label: 'Officer',
      backgroundColor: CCS_CREST_COLORS.circuitTint,
      textColor: CCS_CREST_COLORS.circuitBlue,
      borderColor: CCS_CREST_COLORS.circuitBorder,
    };
  }

  return {
    label: 'Member',
    backgroundColor: CCS_CREST_COLORS.presentEmeraldSoft,
    textColor: CCS_CREST_COLORS.presentEmerald,
    borderColor: CCS_CREST_COLORS.presentEmerald,
  };
}

function OrgRow({
  org,
  membership,
  isSubOrg,
  onSelectOrg,
}: {
  org: Organization;
  membership: OrgMembership | null;
  isSubOrg: boolean;
  onSelectOrg: (orgId: string) => void;
}) {
  const badge = resolveMembershipBadge(membership);

  return (
    <Pressable
      style={[styles.orgRow, isSubOrg && styles.subOrgRow]}
      onPress={() => onSelectOrg(org.id)}
      testID={`org-row-${org.id}`}
    >
      {org.logo_url ? (
        <Image
          source={{ uri: org.logo_url }}
          style={styles.logoImage}
          accessibilityLabel={`${org.name} logo`}
          testID={`org-logo-image-${org.id}`}
        />
      ) : (
        <View
          style={[
            styles.monogramBadge,
            isSubOrg ? styles.subOrgMonogram : styles.mainOrgMonogram,
          ]}
          testID={`org-monogram-${org.id}`}
        >
          <Text
            style={[
              styles.monogramText,
              isSubOrg ? styles.subOrgMonogramText : styles.mainOrgMonogramText,
            ]}
          >
            {getOrgInitials(org.name)}
          </Text>
        </View>
      )}

      <View style={styles.orgMeta}>
        <View style={styles.titleRow}>
          <Text style={styles.orgName}>{org.name}</Text>
          {badge ? (
            <View
              style={[
                styles.membershipBadge,
                {
                  backgroundColor: badge.backgroundColor,
                  borderColor: badge.borderColor,
                },
              ]}
              testID={`org-membership-badge-${org.id}`}
            >
              <Text
                style={[styles.membershipBadgeText, { color: badge.textColor }]}
              >
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.tierLabel}>
          {isSubOrg ? 'Sub-organization' : 'Main organization'}
        </Text>
        {org.details.trim().length > 0 ? (
          <Text style={styles.detailsPreview} numberOfLines={2}>
            {org.details}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function OrgDirectoryView({
  organizations,
  memberships,
  onSelectOrg,
}: OrgDirectoryViewProps) {
  const tree = buildOrganizationTree(organizations);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="org-directory-view">
      {tree.length === 0 ? (
        <View style={styles.sheet} testID="org-directory-empty">
          <Text style={styles.emptyText}>No active organizations found.</Text>
        </View>
      ) : (
        tree.map((node) => (
          <View
            key={node.org.id}
            style={styles.sheet}
            testID={`org-tree-group-${node.org.id}`}
          >
            <OrgRow
              org={node.org}
              membership={getMembershipForOrg(memberships, node.org.id)}
              isSubOrg={false}
              onSelectOrg={onSelectOrg}
            />
            {node.subOrgs.map((subOrg) => (
              <View key={subOrg.id} style={styles.subOrgWrapper}>
                <OrgRow
                  org={subOrg}
                  membership={getMembershipForOrg(memberships, subOrg.id)}
                  isSubOrg
                  onSelectOrg={onSelectOrg}
                />
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: CCS_CREST_SPACING.xl,
    paddingBottom: CCS_CREST_SPACING.xxl,
    gap: CCS_CREST_SPACING.lg,
  },
  sheet: {
    backgroundColor: CCS_CREST_COLORS.paperWhite,
    borderRadius: CCS_CREST_RADII.lg,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
    paddingHorizontal: CCS_CREST_SPACING.lg,
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: CCS_CREST_SPACING.md,
    paddingVertical: CCS_CREST_SPACING.md,
    minHeight: CCS_CREST_SIZES.minTouchHeight,
  },
  subOrgWrapper: {
    borderTopWidth: 1,
    borderTopColor: CCS_CREST_COLORS.crestRule,
    paddingLeft: CCS_CREST_SPACING.lg,
  },
  subOrgRow: {
    borderLeftWidth: 2,
    borderLeftColor: CCS_CREST_COLORS.crestRuleStrong,
    paddingLeft: CCS_CREST_SPACING.md,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: CCS_CREST_RADII.md,
    borderWidth: 1,
    borderColor: CCS_CREST_COLORS.crestRule,
  },
  monogramBadge: {
    width: 44,
    height: 44,
    borderRadius: CCS_CREST_RADII.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  mainOrgMonogram: {
    backgroundColor: CCS_CREST_COLORS.crestNavy,
    borderColor: CCS_CREST_COLORS.crestNavy,
  },
  subOrgMonogram: {
    backgroundColor: CCS_CREST_COLORS.circuitTint,
    borderColor: CCS_CREST_COLORS.circuitBorder,
  },
  monogramText: {
    fontSize: 15,
    fontWeight: '700',
  },
  mainOrgMonogramText: {
    color: CCS_CREST_COLORS.paperWhite,
  },
  subOrgMonogramText: {
    color: CCS_CREST_COLORS.circuitBlue,
  },
  orgMeta: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: CCS_CREST_SPACING.sm,
    marginBottom: 2,
  },
  orgName: {
    fontSize: 15,
    fontWeight: '700',
    color: CCS_CREST_COLORS.inkPrimary,
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CCS_CREST_COLORS.inkMuted,
    marginBottom: CCS_CREST_SPACING.xs,
  },
  detailsPreview: {
    fontSize: 13,
    lineHeight: 19,
    color: CCS_CREST_COLORS.inkSecondary,
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
  emptyText: {
    paddingVertical: CCS_CREST_SPACING.xl,
    textAlign: 'center',
    fontSize: 14,
    color: CCS_CREST_COLORS.inkMuted,
  },
});
