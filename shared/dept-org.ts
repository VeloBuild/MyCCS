import {
  isAnnouncementVisibleTo,
  type Announcement,
  type Organization,
  type OrgMembership,
  type RbacActor,
} from './core-schema';

export type AnnouncementFilter = 'all' | 'department' | 'my_orgs';

export type DepartmentContactEntry = {
  label: string;
  value: string;
};

export type OrganizationTreeNode = {
  org: Organization;
  subOrgs: Organization[];
};

export type MobileHubRoute =
  | { tab: 'feed' }
  | { tab: 'department'; mode: 'view' | 'edit' }
  | {
      tab: 'orgs';
      view:
        | { kind: 'directory' }
        | { kind: 'detail'; orgId: string; panel: 'posts' | 'edit_org' | 'new_post' };
    }
  | { tab: 'keys'; section: 'my_keys' | 'directory' | 'notifications' }
  | { tab: 'identity' };

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_OFFSET_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const TIMESTAMP_PRECISION_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/;

function parseIsoInstantParts(
  iso: string
): { wholeSeconds: number; nanoseconds: number } | null {
  const match = TIMESTAMP_PRECISION_REGEX.exec(iso.trim());
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const second = match[6] ? Number.parseInt(match[6], 10) : 0;
  if (
    !isValidCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const fracRaw = match[7] ?? '';
  const tz = match[8];
  let offsetSeconds = 0;
  if (tz !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1;
    const tzDigits = tz.slice(1).replace(':', '');
    const tzHours = Number.parseInt(tzDigits.slice(0, 2), 10);
    const tzMinutes = tzDigits.length >= 4 ? Number.parseInt(tzDigits.slice(2, 4), 10) : 0;
    if (tzHours > 23 || tzMinutes > 59) {
      return null;
    }
    offsetSeconds = sign * (tzHours * 3600 + tzMinutes * 60);
  }
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const wholeSeconds = Math.floor(utcMs / 1000) - offsetSeconds;
  const nanoseconds = Number.parseInt(fracRaw.padEnd(9, '0'), 10);
  return { wholeSeconds, nanoseconds };
}

export function compareIsoTimestamps(a: string, b: string): number {
  const parsedA = parseIsoInstantParts(a);
  const parsedB = parseIsoInstantParts(b);
  if (parsedA && parsedB) {
    if (parsedA.wholeSeconds !== parsedB.wholeSeconds) {
      return parsedA.wholeSeconds < parsedB.wholeSeconds ? -1 : 1;
    }
    if (parsedA.nanoseconds !== parsedB.nanoseconds) {
      return parsedA.nanoseconds < parsedB.nanoseconds ? -1 : 1;
    }
    return 0;
  }
  const msA = Date.parse(a);
  const msB = Date.parse(b);
  if (!Number.isNaN(msA) && !Number.isNaN(msB)) {
    return msA < msB ? -1 : msA > msB ? 1 : 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseOptionalExpiryInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_REGEX.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1], 10);
    const month = Number.parseInt(dateOnlyMatch[2], 10);
    const day = Number.parseInt(dateOnlyMatch[3], 10);
    if (!isValidCalendarDate(year, month, day)) {
      throw new Error('Expiration date is not a valid calendar date.');
    }
    return `${trimmed}T23:59:59+08:00`;
  }

  const isoMatch = ISO_OFFSET_REGEX.exec(trimmed);
  if (!isoMatch) {
    throw new Error(
      'Expiration must use YYYY-MM-DD or an ISO-8601 timestamp with timezone offset.'
    );
  }

  const year = Number.parseInt(isoMatch[1], 10);
  const month = Number.parseInt(isoMatch[2], 10);
  const day = Number.parseInt(isoMatch[3], 10);
  const hour = Number.parseInt(isoMatch[4], 10);
  const minute = Number.parseInt(isoMatch[5], 10);
  const second = isoMatch[6] ? Number.parseInt(isoMatch[6], 10) : 0;

  if (
    !isValidCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    Number.isNaN(Date.parse(trimmed))
  ) {
    throw new Error('Expiration timestamp is not a valid date/time.');
  }

  return trimmed;
}

export function formatManilaDate(iso: string): string {
  const parsedMs = Date.parse(iso);
  if (Number.isNaN(parsedMs)) {
    return iso.slice(0, 10);
  }
  return new Date(parsedMs + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

function compareAnnouncementsNewestFirst(a: Announcement, b: Announcement): number {
  const diff = compareIsoTimestamps(b.published_at, a.published_at);
  if (diff !== 0) {
    return diff;
  }

  return a.id.localeCompare(b.id);
}

function compareOrgsByName(a: Organization, b: Organization): number {
  const nameDiff = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return nameDiff !== 0 ? nameDiff : a.id.localeCompare(b.id);
}

function formatContactLabel(rawKey: string): string {
  const spaced = rawKey
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (spaced.length === 0) {
    return '';
  }

  return spaced
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function serializeContactPrimitive(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function serializeContactValue(value: unknown): string | null {
  const primitive = serializeContactPrimitive(value);
  if (primitive !== null) {
    return primitive;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map(serializeContactPrimitive)
      .filter((entry): entry is string => entry !== null);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  return null;
}

export function isAnnouncementExpired(
  announcement: Pick<Announcement, 'expires_at'>,
  now: Date = new Date()
): boolean {
  return (
    announcement.expires_at !== null &&
    Date.parse(announcement.expires_at) <= now.getTime()
  );
}

export function filterAnnouncementsFeed(
  announcements: readonly Announcement[],
  actor: RbacActor,
  filter: AnnouncementFilter,
  now: Date = new Date()
): Announcement[] {
  return announcements
    .filter((item) => {
      if (!isAnnouncementVisibleTo(actor, item, now)) {
        return false;
      }

      switch (filter) {
        case 'department':
          return item.global_visibility;
        case 'my_orgs':
          return (
            item.organization_id !== null &&
            (!item.global_visibility ||
              actor.role === 'admin' ||
              actor.memberships.some(
                (membership) =>
                  membership.organization_id === item.organization_id &&
                  membership.status === 'approved'
              ))
          );
        case 'all':
          return true;
      }
    })
    .sort(compareAnnouncementsNewestFirst);
}

export function getOrganizationPosts(
  announcements: readonly Announcement[],
  organizationId: string,
  actor: RbacActor,
  now: Date = new Date()
): Announcement[] {
  return announcements
    .filter(
      (item) =>
        item.organization_id === organizationId &&
        isAnnouncementVisibleTo(actor, item, now)
    )
    .sort(compareAnnouncementsNewestFirst);
}

export function buildOrganizationTree(
  organizations: readonly Organization[]
): OrganizationTreeNode[] {
  const activeOrgs = organizations.filter((org) => org.deleted_at === null);
  const mainOrgs = activeOrgs
    .filter((org) => org.parent_org_id === null)
    .sort(compareOrgsByName);

  const subOrgsByParent = new Map<string, Organization[]>();
  for (const mainOrg of mainOrgs) {
    subOrgsByParent.set(mainOrg.id, []);
  }

  for (const org of activeOrgs) {
    if (org.parent_org_id === null) {
      continue;
    }

    const siblings = subOrgsByParent.get(org.parent_org_id);
    if (siblings !== undefined) {
      siblings.push(org);
    }
  }

  return mainOrgs.map((org) => {
    const subOrgs = subOrgsByParent.get(org.id) ?? [];
    subOrgs.sort(compareOrgsByName);
    return { org, subOrgs };
  });
}

export function findOrganizationById(
  organizations: readonly Organization[],
  orgId: string
): Organization | null {
  return organizations.find((org) => org.id === orgId) ?? null;
}

export function getMembershipForOrg(
  memberships: readonly OrgMembership[],
  organizationId: string
): OrgMembership | null {
  return memberships.find((membership) => membership.organization_id === organizationId) ?? null;
}

export function normalizeDepartmentContacts(
  contactJson: Record<string, unknown>
): DepartmentContactEntry[] {
  const entries: DepartmentContactEntry[] = [];

  for (const [rawKey, rawValue] of Object.entries(contactJson)) {
    const label = formatContactLabel(rawKey);
    const value = serializeContactValue(rawValue);
    if (label.length > 0 && value !== null) {
      entries.push({ label, value });
    }
  }

  return entries;
}

export function getOrgInitials(name: string): string {
  const tokens = name
    .trim()
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((part) => part.length > 0);

  const [first, second] = tokens;
  if (!first) {
    return '?';
  }

  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }

  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
}
