import { createElement } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import App from '../../App';
import type { PublicProfileDto } from '../../shared/auth';
import type {
  Announcement,
  DepartmentInfo,
  Organization,
  OrgMembership,
  RbacActor,
} from '../../shared/core-schema';
import {
  buildOrganizationTree,
  filterAnnouncementsFeed,
  findOrganizationById,
  formatManilaDate,
  getMembershipForOrg,
  getOrganizationPosts,
  getOrgInitials,
  isAnnouncementExpired,
  normalizeDepartmentContacts,
  parseOptionalExpiryInput,
} from '../../shared/dept-org';
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_STORAGE_BUCKET,
  MEDIA_VARIANT_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE,
  type CompressImageResponse,
} from '../../shared/media-upload';
import {
  DepartmentAboutView,
  formatLeadershipLines,
  parseLeadershipLines,
} from '../../src/components/DepartmentAboutView';
import { OrgDetailView } from '../../src/components/OrgDetailView';
import * as supabaseLib from '../../src/lib/supabase';
import { MyCcsHubScreen } from '../../src/screens/MyCcsHubScreen';
import {
  createAnnouncement,
  createDepartmentInfo,
  DEFAULT_ANNOUNCEMENTS_LIMIT,
  fetchActiveOrganizations,
  fetchAnnouncements,
  fetchDepartmentInfo,
  fetchMyOrgMemberships,
  fetchOrganizationAnnouncements,
  loadHubSnapshot,
  ORG_ANNOUNCEMENTS_MAX_PAGE_SIZE,
  ORG_ANNOUNCEMENTS_PAGE_SIZE,
  updateDepartmentInfo,
  updateOrganizationProfile,
  type DeptOrgQueryResult,
  type DeptOrgSupabaseClient,
} from '../../src/services/deptOrg';
import {
  precompressImageForUpload,
  uploadCompressedOrgMedia,
  type ImageManipulatorDriver,
} from '../../src/services/mediaUpload';
import { CCS_CREST_COLORS, CCS_CREST_RADII } from '../../src/theme/ccsCrest';

declare const process: {
  env: Record<string, string | undefined>;
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
  ImageManipulator: {
    manipulate: jest.fn(),
  },
}));

const NOW = new Date('2026-11-27T12:00:00.000Z');
const DEPT_ID = '11111111-1111-4111-8111-111111111111';
const ORG_A_ID = '22222222-2222-4222-8222-222222222222';
const SUB_ORG_A1_ID = '33333333-3333-4333-8333-333333333333';
const ORG_B_ID = '44444444-4444-4444-8444-444444444444';
const DELETED_ORG_ID = '55555555-5555-4555-8555-555555555555';
const ORPHAN_SUB_ORG_ID = '66666666-6666-4666-8666-666666666666';

const STUDENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OFFICER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ADMIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const ANN_DEPT_ACTIVE_ID = '77777777-7777-4777-8777-777777777771';
const ANN_DEPT_EXPIRED_ID = '77777777-7777-4777-8777-777777777772';
const ANN_ORG_A_ACTIVE_ID = '77777777-7777-4777-8777-777777777773';
const ANN_ORG_A_EXPIRED_ID = '77777777-7777-4777-8777-777777777774';
const ANN_ORG_B_GLOBAL_ID = '77777777-7777-4777-8777-777777777775';
const ANN_ORG_B_PRIVATE_ID = '77777777-7777-4777-8777-777777777776';
const ANN_NEW_ID = '77777777-7777-4777-8777-777777777779';

const SAMPLE_DEPT: DepartmentInfo = {
  id: DEPT_ID,
  title: 'College of Information Technology and Computer Science',
  about_markdown: 'Home of BSIT, BSCS, and BLIS programs at LPU Cavite.',
  leadership_json: [
    {
      name: 'Dr. Maria Santos',
      title: 'College Dean',
      email: 'maria.santos@lpunetwork.edu.ph',
    },
    {
      name: 'Prof. Jose Rizalino',
      title: 'CS Program Chair',
    },
  ],
  contact_json: {
    office: 'CCS Faculty Room, 3F',
    email: 'ccs@lpunetwork.edu.ph',
    office_hours: 'Mon-Fri 8:00 AM - 5:00 PM',
  },
  updated_at: '2026-11-20T08:00:00.000Z',
};

const SAMPLE_ORG_A: Organization = {
  id: ORG_A_ID,
  parent_org_id: null,
  name: 'CCS Student Council',
  details: 'Main student governance council for CCS.',
  logo_url: 'https://cdn.example.edu/org-a-logo.webp',
  cover_url: 'https://cdn.example.edu/org-a-cover.webp',
  created_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
};

const SAMPLE_SUB_ORG_A1: Organization = {
  id: SUB_ORG_A1_ID,
  parent_org_id: ORG_A_ID,
  name: 'AI & Robotics Guild',
  details: 'Student research guild under CCS Student Council.',
  logo_url: null,
  cover_url: null,
  created_at: '2026-09-05T00:00:00.000Z',
  deleted_at: null,
};

const SAMPLE_ORG_B: Organization = {
  id: ORG_B_ID,
  parent_org_id: null,
  name: 'ACM Chapter',
  details: 'Competitive programming and systems chapter.',
  logo_url: null,
  cover_url: null,
  created_at: '2026-09-02T00:00:00.000Z',
  deleted_at: null,
};

const SAMPLE_ANNOUNCEMENTS: Announcement[] = [
  {
    id: ANN_DEPT_ACTIVE_ID,
    organization_id: null,
    title: 'CCS General Assembly',
    content: 'All CCS students are invited to the auditorium at 2 PM.',
    global_visibility: true,
    published_at: '2026-11-26T09:00:00.000Z',
    expires_at: '2026-12-10T23:59:59.000Z',
    deleted_at: null,
  },
  {
    id: ANN_DEPT_EXPIRED_ID,
    organization_id: null,
    title: 'Old Midterm Memo',
    content: 'Midterm schedule from last month.',
    global_visibility: true,
    published_at: '2026-10-01T09:00:00.000Z',
    expires_at: '2026-10-15T23:59:59.000Z',
    deleted_at: null,
  },
  {
    id: ANN_ORG_A_ACTIVE_ID,
    organization_id: ORG_A_ID,
    title: 'Council Townhall',
    content: 'Bring your student ID QR for fast attendance check-in.',
    global_visibility: false,
    published_at: '2026-11-27T08:00:00.000Z',
    expires_at: '2026-12-05T23:59:59.000Z',
    deleted_at: null,
  },
  {
    id: ANN_ORG_A_EXPIRED_ID,
    organization_id: ORG_A_ID,
    title: 'Archived Council Poll',
    content: 'Survey closed last week.',
    global_visibility: false,
    published_at: '2026-11-01T08:00:00.000Z',
    expires_at: '2026-11-10T23:59:59.000Z',
    deleted_at: null,
  },
  {
    id: ANN_ORG_B_GLOBAL_ID,
    organization_id: ORG_B_ID,
    title: 'Open Hackathon CFP',
    content: 'ACM Chapter invites all CCS teams to register.',
    global_visibility: true,
    published_at: '2026-11-25T10:00:00.000Z',
    expires_at: null,
    deleted_at: null,
  },
  {
    id: ANN_ORG_B_PRIVATE_ID,
    organization_id: ORG_B_ID,
    title: 'ACM Officers Sync',
    content: 'Internal ACM rehearsal notes.',
    global_visibility: false,
    published_at: '2026-11-24T10:00:00.000Z',
    expires_at: null,
    deleted_at: null,
  },
];

const STUDENT_PROFILE: PublicProfileDto = {
  id: STUDENT_ID,
  email: 'student@lpunetwork.edu.ph',
  fullName: 'Juan Dela Cruz',
  role: 'student',
  qrToken: `v1.${STUDENT_ID}.0123456789abcdef01234567`,
  keyVersion: 1,
};

const OFFICER_PROFILE: PublicProfileDto = {
  id: OFFICER_ID,
  email: 'officer@lpunetwork.edu.ph',
  fullName: 'Ana Officer',
  role: 'officer',
  qrToken: `v1.${OFFICER_ID}.0123456789abcdef01234567`,
  keyVersion: 1,
};

const ADMIN_PROFILE: PublicProfileDto = {
  id: ADMIN_ID,
  email: 'ccs.admin@lpunetwork.edu.ph',
  fullName: 'Dean Admin',
  role: 'admin',
  qrToken: `v1.${ADMIN_ID}.0123456789abcdef01234567`,
  keyVersion: 1,
};

interface MockOrderSpec {
  column: string;
  ascending: boolean;
}

interface MockOrgAnnouncementsQueryParams {
  orFilters: string[];
  orderSpecs: MockOrderSpec[];
  limit: number;
}

interface MockDbState {
  departmentInfo: DepartmentInfo | null;
  organizations: Organization[];
  memberships: OrgMembership[];
  announcements: Announcement[];
  failTable?: string;
  failErrorMessage?: string;
  sessionAccessToken?: string | null;
  onFetchAnnouncements?: () => Promise<{
    data: Announcement[] | null;
    error: { message: string } | null;
  }>;
  onFetchOrgAnnouncements?: (
    orgId: string,
    params: MockOrgAnnouncementsQueryParams
  ) => Promise<
    | {
        data: Announcement[] | null;
        error: { message: string } | null;
      }
    | undefined
  >;
  onInsertAnnouncement?: (values: Record<string, unknown>) => Promise<{
    data: Announcement | null;
    error: { message: string } | null;
  }>;
  onUpdateDepartment?: (
    id: string,
    values: Record<string, unknown>
  ) => Promise<{
    data: DepartmentInfo | null;
    error: { message: string } | null;
  }>;
}

const TIMESTAMP_COLUMNS = new Set([
  'published_at',
  'updated_at',
  'created_at',
  'expires_at',
  'deleted_at',
]);

function compareMockValues(
  column: string,
  a: unknown,
  b: unknown
): number {
  if (a === b) {
    return 0;
  }
  if (a === null || a === undefined) {
    return 1;
  }
  if (b === null || b === undefined) {
    return -1;
  }
  if (
    TIMESTAMP_COLUMNS.has(column) &&
    typeof a === 'string' &&
    typeof b === 'string'
  ) {
    const timeA = Date.parse(a);
    const timeB = Date.parse(b);
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
    }
  }
  const strA = String(a);
  const strB = String(b);
  return strA < strB ? -1 : strA > strB ? 1 : 0;
}

function applyMockOrderSpecs<T extends Record<string, unknown>>(
  rows: readonly T[],
  orderSpecs: readonly MockOrderSpec[]
): T[] {
  const copy = [...rows];
  if (orderSpecs.length === 0) {
    return copy;
  }
  copy.sort((a, b) => {
    for (const spec of orderSpecs) {
      const cmp = compareMockValues(spec.column, a[spec.column], b[spec.column]);
      if (cmp !== 0) {
        return spec.ascending ? cmp : -cmp;
      }
    }
    return 0;
  });
  return copy;
}

function splitPostgrestTopLevel(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let escaping = false;

  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (inQuotes) {
      current += ch;
      if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inQuotes = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      current += ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }
  return parts;
}

function unquotePostgrestValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    let out = '';
    for (let i = 1; i < trimmed.length - 1; i += 1) {
      if (trimmed[i] === '\\' && i + 1 < trimmed.length - 1) {
        out += trimmed[i + 1];
        i += 1;
      } else {
        out += trimmed[i];
      }
    }
    return out;
  }
  return trimmed;
}

function evaluatePostgrestCondition(
  row: Record<string, unknown>,
  clause: string
): boolean {
  const trimmed = clause.trim();
  if (trimmed.startsWith('and(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(4, -1);
    return splitPostgrestTopLevel(inner).every((sub) =>
      evaluatePostgrestCondition(row, sub)
    );
  }
  if (trimmed.startsWith('or(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(3, -1);
    return splitPostgrestTopLevel(inner).some((sub) =>
      evaluatePostgrestCondition(row, sub)
    );
  }

  const firstDot = trimmed.indexOf('.');
  if (firstDot <= 0) {
    throw new Error(`Invalid PostgREST filter clause: ${clause}`);
  }
  const secondDot = trimmed.indexOf('.', firstDot + 1);
  if (secondDot <= firstDot + 1) {
    throw new Error(`Invalid PostgREST filter clause: ${clause}`);
  }
  const column = trimmed.slice(0, firstDot);
  const operator = trimmed.slice(firstDot + 1, secondDot);
  const rawValue = trimmed.slice(secondDot + 1);
  const value = unquotePostgrestValue(rawValue);
  const cmp = compareMockValues(column, row[column], value);

  switch (operator) {
    case 'eq':
      return cmp === 0;
    case 'lt':
      return cmp < 0;
    case 'lte':
      return cmp <= 0;
    case 'gt':
      return cmp > 0;
    case 'gte':
      return cmp >= 0;
    default:
      throw new Error(`Unsupported PostgREST filter operator: ${operator}`);
  }
}

function matchesPostgrestOrFilter(
  row: Record<string, unknown>,
  orExpr: string
): boolean {
  const clauses = splitPostgrestTopLevel(orExpr);
  if (clauses.length === 0) {
    throw new Error(`Empty PostgREST .or() filter expression.`);
  }
  return clauses.some((clause) => evaluatePostgrestCondition(row, clause));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function readFormDataField(formData: FormData, fieldName: string): unknown {
  const standard = formData as FormData & { get?: (name: string) => unknown };
  if (typeof standard.get === 'function') {
    return standard.get(fieldName);
  }
  const rnFormData = formData as FormData & {
    _parts?: Array<[string, unknown]>;
  };
  if (Array.isArray(rnFormData._parts)) {
    const match = rnFormData._parts.find(([name]) => name === fieldName);
    return match ? match[1] : null;
  }
  return null;
}

const MOCK_POSTGREST_MAX_ROWS = 1000;

function createMockDeptOrgClient(initial: MockDbState): {
  client: DeptOrgSupabaseClient;
  state: MockDbState;
  spies: {
    insertDepartment: jest.Mock;
    updateDepartment: jest.Mock;
    updateOrg: jest.Mock;
    insertAnnouncement: jest.Mock;
    announcementsLimit: jest.Mock;
    fetchOrgAnnouncements: jest.Mock;
    orgAnnouncementsOrders: jest.Mock;
    orgAnnouncementsLimits: jest.Mock;
  };
} {
  const state: MockDbState = {
    departmentInfo: initial.departmentInfo,
    organizations: [...initial.organizations],
    memberships: [...initial.memberships],
    announcements: [...initial.announcements],
    failTable: initial.failTable,
    failErrorMessage: initial.failErrorMessage,
    sessionAccessToken:
      initial.sessionAccessToken === undefined
        ? 'jwt-mock-session'
        : initial.sessionAccessToken,
    onFetchAnnouncements: initial.onFetchAnnouncements,
    onFetchOrgAnnouncements: initial.onFetchOrgAnnouncements,
    onInsertAnnouncement: initial.onInsertAnnouncement,
    onUpdateDepartment: initial.onUpdateDepartment,
  };

  const spies = {
    insertDepartment: jest.fn(),
    updateDepartment: jest.fn(),
    updateOrg: jest.fn(),
    insertAnnouncement: jest.fn(),
    announcementsLimit: jest.fn(),
    fetchOrgAnnouncements: jest.fn(),
    orgAnnouncementsOrders: jest.fn(),
    orgAnnouncementsLimits: jest.fn(),
  };

  interface MockQueryState {
    eqCol?: string;
    eqVal?: unknown;
    isNullCols: string[];
    orFilters: string[];
    orderSpecs: MockOrderSpec[];
  }

  const client: DeptOrgSupabaseClient = {
    auth: {
      getSession: jest.fn(async () => ({
        data: {
          session: state.sessionAccessToken
            ? { access_token: state.sessionAccessToken }
            : null,
        },
        error: null,
      })),
    },
    from(table: string) {
      const makeError = () =>
        state.failTable === table
          ? { message: state.failErrorMessage ?? `Failed query on ${table}` }
          : null;

      const resolveRows = async (
        query: MockQueryState
      ): Promise<DeptOrgQueryResult<unknown[]>> => {
        const err = makeError();
        if (err) {
          return { data: null, error: err };
        }
        if (table === 'department_info') {
          const rows = state.departmentInfo ? [state.departmentInfo] : [];
          return {
            data: applyMockOrderSpecs(
              rows as unknown as Array<Record<string, unknown>>,
              query.orderSpecs
            ),
            error: null,
          };
        }
        if (table === 'organizations') {
          const rows = state.organizations.filter((o) =>
            query.isNullCols.every(
              (col) => (o as unknown as Record<string, unknown>)[col] === null
            )
          );
          return {
            data: applyMockOrderSpecs(
              rows as unknown as Array<Record<string, unknown>>,
              query.orderSpecs
            ),
            error: null,
          };
        }
        if (table === 'org_memberships') {
          const rows =
            query.eqCol === 'profile_id'
              ? state.memberships.filter((m) => m.profile_id === query.eqVal)
              : state.memberships;
          return {
            data: applyMockOrderSpecs(
              rows as unknown as Array<Record<string, unknown>>,
              query.orderSpecs
            ),
            error: null,
          };
        }
        if (table === 'announcements') {
          if (query.eqCol === 'organization_id') {
            const rows = state.announcements.filter((a) => {
              const record = a as unknown as Record<string, unknown>;
              if (a.organization_id !== query.eqVal) {
                return false;
              }
              if (!query.isNullCols.every((col) => record[col] === null)) {
                return false;
              }
              return query.orFilters.every((expr) =>
                matchesPostgrestOrFilter(record, expr)
              );
            });
            return {
              data: applyMockOrderSpecs(
                rows as unknown as Array<Record<string, unknown>>,
                query.orderSpecs
              ),
              error: null,
            };
          }
          if (state.onFetchAnnouncements) {
            return state.onFetchAnnouncements();
          }
          const rows = state.announcements.filter((a) => {
            const record = a as unknown as Record<string, unknown>;
            if (!query.isNullCols.every((col) => record[col] === null)) {
              return false;
            }
            return query.orFilters.every((expr) =>
              matchesPostgrestOrFilter(record, expr)
            );
          });
          return {
            data: applyMockOrderSpecs(
              rows as unknown as Array<Record<string, unknown>>,
              query.orderSpecs
            ),
            error: null,
          };
        }
        return { data: [], error: null };
      };

      const makeListTerminal = (query: MockQueryState) => {
        const terminal = {
          then<TResult1 = DeptOrgQueryResult<unknown[]>, TResult2 = never>(
            onfulfilled?:
              | ((
                  value: DeptOrgQueryResult<unknown[]>
                ) => TResult1 | PromiseLike<TResult1>)
              | null,
            onrejected?:
              | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
              | null
          ) {
            return resolveRows(query).then(onfulfilled, onrejected);
          },
          order(column: string, options?: { ascending?: boolean }) {
            return makeListTerminal({
              ...query,
              orderSpecs: [
                ...query.orderSpecs,
                { column, ascending: options?.ascending ?? true },
              ],
            });
          },
          limit: async (count: number) => {
            if (table === 'announcements' && query.eqCol === 'organization_id') {
              spies.fetchOrgAnnouncements(query.eqVal);
              spies.orgAnnouncementsOrders(query.eqVal, [...query.orderSpecs]);
              spies.orgAnnouncementsLimits(query.eqVal, count);
              if (state.onFetchOrgAnnouncements) {
                const override = await state.onFetchOrgAnnouncements(
                  String(query.eqVal),
                  {
                    orFilters: [...query.orFilters],
                    orderSpecs: [...query.orderSpecs],
                    limit: count,
                  }
                );
                if (override !== undefined) {
                  return override;
                }
              }
            } else if (table === 'announcements') {
              spies.announcementsLimit(count);
            }
            const res = await resolveRows(query);
            const serverCappedCount = Math.min(count, MOCK_POSTGREST_MAX_ROWS);
            return {
              data: res.data ? res.data.slice(0, serverCappedCount) : null,
              error: res.error,
            };
          },
        };
        return terminal;
      };

      const makeOrgFilterChain = (query: MockQueryState) => ({
        or(filters: string) {
          return makeOrgFilterChain({
            ...query,
            orFilters: [...query.orFilters, filters],
          });
        },
        order(column: string, options?: { ascending?: boolean }) {
          return makeListTerminal({
            ...query,
            orderSpecs: [
              ...query.orderSpecs,
              { column, ascending: options?.ascending ?? true },
            ],
          });
        },
      });

      return {
        select() {
          return {
            eq(col: string, val: unknown) {
              const baseQuery: MockQueryState = {
                eqCol: col,
                eqVal: val,
                isNullCols: [],
                orFilters: [],
                orderSpecs: [],
              };
              return {
                then<
                  TResult1 = DeptOrgQueryResult<unknown[]>,
                  TResult2 = never,
                >(
                  onfulfilled?:
                    | ((
                        value: DeptOrgQueryResult<unknown[]>
                      ) => TResult1 | PromiseLike<TResult1>)
                    | null,
                  onrejected?:
                    | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
                    | null
                ) {
                  return resolveRows(baseQuery).then(onfulfilled, onrejected);
                },
                is(isCol: string, _val: null) {
                  return makeOrgFilterChain({
                    ...baseQuery,
                    isNullCols: [...baseQuery.isNullCols, isCol],
                  });
                },
              };
            },
            is(isCol: string, _val: null) {
              return {
                order(column: string, options?: { ascending?: boolean }) {
                  return makeListTerminal({
                    isNullCols: [isCol],
                    orFilters: [],
                    orderSpecs: [
                      { column, ascending: options?.ascending ?? true },
                    ],
                  });
                },
              };
            },
            order(column: string, options?: { ascending?: boolean }) {
              return makeListTerminal({
                isNullCols: [],
                orFilters: [],
                orderSpecs: [{ column, ascending: options?.ascending ?? true }],
              });
            },
          };
        },

        update(values: Record<string, unknown>) {
          return {
            eq(_col: string, val: unknown) {
              const targetId = String(val);
              return {
                select() {
                  return {
                    single: async () => {
                      const err = makeError();
                      if (err) {
                        return { data: null, error: err };
                      }
                      if (table === 'department_info') {
                        spies.updateDepartment(targetId, values);
                        if (state.onUpdateDepartment) {
                          return state.onUpdateDepartment(targetId, values);
                        }
                        if (
                          !state.departmentInfo ||
                          state.departmentInfo.id !== targetId
                        ) {
                          return { data: null, error: null };
                        }
                        state.departmentInfo = {
                          ...state.departmentInfo,
                          ...values,
                          updated_at: '2026-11-27T12:30:00.000Z',
                        } as DepartmentInfo;
                        return { data: state.departmentInfo, error: null };
                      }
                      if (table === 'organizations') {
                        spies.updateOrg(targetId, values);
                        const existing = state.organizations.find(
                          (o) => o.id === targetId
                        );
                        if (!existing) {
                          return { data: null, error: null };
                        }
                        const updated = { ...existing, ...values } as Organization;
                        state.organizations = state.organizations.map((o) =>
                          o.id === targetId ? updated : o
                        );
                        return { data: updated, error: null };
                      }
                      return { data: null, error: null };
                    },
                  };
                },
              };
            },
          };
        },

        insert(values: Record<string, unknown>) {
          return {
            select() {
              return {
                single: async () => {
                  const err = makeError();
                  if (err) {
                    return { data: null, error: err };
                  }
                  if (table === 'department_info') {
                    spies.insertDepartment(values);
                    const created: DepartmentInfo = {
                      id: DEPT_ID,
                      title: String(values.title),
                      about_markdown: String(values.about_markdown ?? ''),
                      leadership_json:
                        (values.leadership_json as DepartmentInfo['leadership_json']) ??
                        [],
                      contact_json:
                        (values.contact_json as Record<string, unknown>) ?? {},
                      updated_at: '2026-11-27T12:20:00.000Z',
                    };
                    state.departmentInfo = created;
                    return { data: created, error: null };
                  }
                  spies.insertAnnouncement(values);
                  if (state.onInsertAnnouncement) {
                    return state.onInsertAnnouncement(values);
                  }
                  const created: Announcement = {
                    id: ANN_NEW_ID,
                    organization_id:
                      (values.organization_id as string | null) ?? null,
                    title: String(values.title),
                    content: String(values.content),
                    global_visibility: Boolean(values.global_visibility),
                    published_at:
                      (values.published_at as string | undefined) ??
                      '2026-11-27T12:15:00.000Z',
                    expires_at: (values.expires_at as string | null) ?? null,
                    deleted_at: null,
                  };
                  state.announcements = [created, ...state.announcements];
                  return { data: created, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, state, spies };
}

const SUPABASE_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
] as const;

describe('spec-04-dept-and-org-pages (SCRUM-13) — Mobile & Shared', () => {
  let savedSupabaseEnv: Record<
    (typeof SUPABASE_ENV_KEYS)[number],
    string | undefined
  >;

  beforeEach(() => {
    savedSupabaseEnv = {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    };
    for (const key of SUPABASE_ENV_KEYS) {
      delete process.env[key];
    }
    supabaseLib.resetSupabaseClientForTesting();
  });

  afterEach(() => {
    for (const key of SUPABASE_ENV_KEYS) {
      const original = savedSupabaseEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    supabaseLib.resetSupabaseClientForTesting();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('CCS Crest theme tokens & shared/dept-org helpers', () => {
    it('exports CCS Crest DESIGN.md palette & radii tokens', () => {
      expect(CCS_CREST_COLORS.crestCanvas).toBe('#F6F9FD');
      expect(CCS_CREST_COLORS.crestNavy).toBe('#0B2E59');
      expect(CCS_CREST_COLORS.circuitBlue).toBe('#0052CC');
      expect(CCS_CREST_COLORS.laurelGoldInk).toBe('#856404');
      expect(CCS_CREST_RADII.pill).toBe(999);
      expect(CCS_CREST_RADII.lg).toBe(18);
    });

    it('builds sorted Main -> Sub-Org trees excluding soft-deleted and orphan orgs', () => {
      const deletedMain: Organization = {
        ...SAMPLE_ORG_B,
        id: DELETED_ORG_ID,
        name: 'Archived Club',
        deleted_at: '2026-11-01T00:00:00.000Z',
      };
      const orphanSub: Organization = {
        ...SAMPLE_SUB_ORG_A1,
        id: ORPHAN_SUB_ORG_ID,
        parent_org_id: DELETED_ORG_ID,
        name: 'Orphan Sub-Org',
      };
      const secondSubA: Organization = {
        ...SAMPLE_SUB_ORG_A1,
        id: '33333333-3333-4333-8333-333333333334',
        parent_org_id: ORG_A_ID,
        name: 'Cybersecurity Committee',
      };

      const tree = buildOrganizationTree([
        SAMPLE_SUB_ORG_A1,
        SAMPLE_ORG_A,
        SAMPLE_ORG_B,
        deletedMain,
        orphanSub,
        secondSubA,
      ]);

      expect(tree.map((n) => n.org.name)).toEqual([
        'ACM Chapter',
        'CCS Student Council',
      ]);
      expect(tree[0].subOrgs).toEqual([]);
      expect(tree[1].subOrgs.map((s) => s.name)).toEqual([
        'AI & Robotics Guild',
        'Cybersecurity Committee',
      ]);
      expect(findOrganizationById([SAMPLE_ORG_A], ORG_A_ID)?.name).toBe(
        'CCS Student Council'
      );
      expect(findOrganizationById([SAMPLE_ORG_A], ORG_B_ID)).toBeNull();
    });

    it('filters announcements by role, expiration, and scope (All / Department / My Orgs)', () => {
      const studentActor: RbacActor = {
        profileId: STUDENT_ID,
        role: 'student',
        memberships: [
          {
            organization_id: ORG_A_ID,
            role: 'member',
            status: 'approved',
          },
        ],
      };

      const officerActor: RbacActor = {
        profileId: OFFICER_ID,
        role: 'officer',
        memberships: [
          {
            organization_id: ORG_A_ID,
            role: 'officer',
            status: 'approved',
          },
        ],
      };

      const adminActor: RbacActor = {
        profileId: ADMIN_ID,
        role: 'admin',
        memberships: [],
      };

      expect(
        filterAnnouncementsFeed(SAMPLE_ANNOUNCEMENTS, studentActor, 'all', NOW).map(
          (a) => a.id
        )
      ).toEqual([ANN_ORG_A_ACTIVE_ID, ANN_DEPT_ACTIVE_ID, ANN_ORG_B_GLOBAL_ID]);

      expect(
        filterAnnouncementsFeed(
          SAMPLE_ANNOUNCEMENTS,
          studentActor,
          'department',
          NOW
        ).map((a) => a.id)
      ).toEqual([ANN_DEPT_ACTIVE_ID, ANN_ORG_B_GLOBAL_ID]);

      expect(
        filterAnnouncementsFeed(
          SAMPLE_ANNOUNCEMENTS,
          studentActor,
          'my_orgs',
          NOW
        ).map((a) => a.id)
      ).toEqual([ANN_ORG_A_ACTIVE_ID]);

      expect(
        getOrganizationPosts(SAMPLE_ANNOUNCEMENTS, ORG_A_ID, officerActor, NOW).map(
          (a) => a.id
        )
      ).toEqual([ANN_ORG_A_ACTIVE_ID, ANN_ORG_A_EXPIRED_ID]);

      expect(
        filterAnnouncementsFeed(SAMPLE_ANNOUNCEMENTS, adminActor, 'my_orgs', NOW).map(
          (a) => a.id
        )
      ).toEqual([
        ANN_ORG_A_ACTIVE_ID,
        ANN_ORG_B_GLOBAL_ID,
        ANN_ORG_B_PRIVATE_ID,
        ANN_ORG_A_EXPIRED_ID,
      ]);

      expect(isAnnouncementExpired({ expires_at: null }, NOW)).toBe(false);
      expect(
        isAnnouncementExpired({ expires_at: '2026-12-01T00:00:00.000Z' }, NOW)
      ).toBe(false);
      expect(
        isAnnouncementExpired({ expires_at: '2026-11-27T12:00:00.000Z' }, NOW)
      ).toBe(true);
    });

    it('normalizes department contacts, computes org initials, and parses leadership/expiry helpers', () => {
      expect(
        normalizeDepartmentContacts({
          office_location: '3F CCS Building',
          hotlineNumber: 4641234,
          acceptingWalkIns: true,
          tags: ['IT', 'CS', 'LIS', '  '],
          emptyValue: '   ',
          nestedIgnored: { a: 1 },
          '': 'ignored',
        })
      ).toEqual([
        { label: 'Office Location', value: '3F CCS Building' },
        { label: 'Hotline Number', value: '4641234' },
        { label: 'Accepting Walk Ins', value: 'true' },
        { label: 'Tags', value: 'IT, CS, LIS' },
      ]);

      expect(getOrgInitials('CCS Student Council')).toBe('CS');
      expect(getOrgInitials('ACM')).toBe('AC');
      expect(getOrgInitials('AI-Guild')).toBe('AG');
      expect(getOrgInitials('   ')).toBe('?');

      const membership: OrgMembership = {
        id: '99999999-9999-4999-8999-999999999991',
        profile_id: STUDENT_ID,
        organization_id: ORG_A_ID,
        role: 'member',
        status: 'approved',
        submission_id: null,
        created_at: '2026-10-01T00:00:00.000Z',
      };
      expect(getMembershipForOrg([membership], ORG_A_ID)).toEqual(membership);
      expect(getMembershipForOrg([membership], ORG_B_ID)).toBeNull();

      expect(formatLeadershipLines(SAMPLE_DEPT.leadership_json)).toBe(
        'Dr. Maria Santos | College Dean | maria.santos@lpunetwork.edu.ph\nProf. Jose Rizalino | CS Program Chair'
      );
      expect(
        parseLeadershipLines(
          'Dr. Maria Santos | Dean | maria.santos@lpunetwork.edu.ph\n\nProf. Jose | Chair'
        )
      ).toEqual([
        {
          name: 'Dr. Maria Santos',
          title: 'Dean',
          email: 'maria.santos@lpunetwork.edu.ph',
        },
        { name: 'Prof. Jose', title: 'Chair' },
      ]);
      expect(() => parseLeadershipLines('MissingSeparator')).toThrow(
        /Name \| Title/
      );
      expect(() =>
        parseLeadershipLines(
          'Dr. Maria Santos | Dean | maria@lpunetwork.edu.ph | extra'
        )
      ).toThrow(/Name \| Title/);
      expect(() => parseLeadershipLines('\\n | Dean')).toThrow(/Name \| Title/);

      const specialLeadershipEntries = [
        {
          name: 'Dr. Maria | Santos',
          title: 'College Dean',
        },
        {
          name: 'Prof. Jose\nRizalino',
          title: 'CS Program Chair\r\nAI \\ Systems',
          email: 'jose.rizalino@lpunetwork.edu.ph',
        },
      ];
      const formattedSpecial = formatLeadershipLines(specialLeadershipEntries);
      expect(formattedSpecial.split('\n')).toHaveLength(2);
      expect(parseLeadershipLines(formattedSpecial)).toEqual(
        specialLeadershipEntries
      );

      expect(parseOptionalExpiryInput('')).toBeNull();
      expect(parseOptionalExpiryInput('2026-12-31')).toBe(
        '2026-12-31T23:59:59+08:00'
      );
      expect(parseOptionalExpiryInput('2026-12-31T15:00:00.000Z')).toBe(
        '2026-12-31T15:00:00.000Z'
      );
      expect(parseOptionalExpiryInput('2026-12-31T15:00:00+08:00')).toBe(
        '2026-12-31T15:00:00+08:00'
      );
      expect(() => parseOptionalExpiryInput('2026-02-30')).toThrow(
        /valid calendar date/i
      );
      expect(() => parseOptionalExpiryInput('2026-13-45')).toThrow(
        /valid calendar date/i
      );
      expect(() => parseOptionalExpiryInput('2026-12-31T15:00:00')).toThrow(
        /timezone offset/i
      );
      expect(() => parseOptionalExpiryInput('not-a-date')).toThrow(
        /YYYY-MM-DD/
      );

      expect(formatManilaDate('2026-11-26T16:30:00Z')).toBe('2026-11-27');
      expect(formatManilaDate('2026-11-27T08:00:00+08:00')).toBe('2026-11-27');
      expect(formatManilaDate('not-an-iso')).toBe('not-an-iso');
    });

    it('validates client Supabase config and rejects legacy service_role JWTs (Finding 12)', () => {
      const legacyServiceRoleJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.signature';

      expect(() => supabaseLib.getClientSupabaseConfig()).toThrow(
        /Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/
      );

      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://cfg.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_safe';
      expect(supabaseLib.getClientSupabaseConfig()).toEqual({
        supabaseUrl: 'https://cfg.supabase.co',
        publishableKey: 'sb_publishable_safe',
      });

      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_forbidden';
      expect(() => supabaseLib.getClientSupabaseConfig()).toThrow(
        /SUPABASE_SECRET_KEY must never be used in the mobile client/
      );

      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = legacyServiceRoleJwt;
      expect(() => supabaseLib.getClientSupabaseConfig()).toThrow(
        /service_role JWT must never be used in the mobile client/
      );
      expect(() =>
        supabaseLib.createMyCcsSupabaseClient(
          'https://cfg.supabase.co',
          legacyServiceRoleJwt
        )
      ).toThrow(/service_role JWT must never be used in the mobile client/);
    });
  });

  describe('on-device pre-compression & compress-image upload service (mediaUpload.ts)', () => {
    function makeManipulatorDriver(outputUri = 'file:///cache/out.webp') {
      const saveAsync = jest.fn().mockResolvedValue({
        uri: outputUri,
        width: 512,
        height: 512,
      });
      const renderAsync = jest.fn().mockResolvedValue({ saveAsync });
      const manipulate = jest.fn().mockReturnValue({ renderAsync });
      const driver: ImageManipulatorDriver = { manipulate };
      return { driver, manipulate, renderAsync, saveAsync };
    }

    it('pre-compresses logo, cover, and flyer variants to WebP within variant bounds and rejects blank URIs', async () => {
      for (const kind of ['logo', 'cover', 'flyer'] as const) {
        const { driver, manipulate, saveAsync } = makeManipulatorDriver(
          `file:///cache/${kind}.webp`
        );
        const result = await precompressImageForUpload(
          `  file:///raw/${kind}.jpg  `,
          kind,
          driver
        );

        expect(manipulate).toHaveBeenCalledWith(`file:///raw/${kind}.jpg`, {
          maxWidth: MEDIA_VARIANT_LIMITS[kind].maxWidth,
          maxHeight: MEDIA_VARIANT_LIMITS[kind].maxHeight,
        });
        expect(saveAsync).toHaveBeenCalledWith({
          format: SaveFormat.WEBP,
          compress: MEDIA_VARIANT_LIMITS[kind].compress,
        });
        expect(result).toEqual({
          uri: `file:///cache/${kind}.webp`,
          width: 512,
          height: 512,
          mimeType: OUTPUT_IMAGE_MIME_TYPE,
        });
      }

      const defaultSave = jest
        .fn()
        .mockResolvedValue({ uri: 'file:///default.webp', width: 200, height: 200 });
      (ImageManipulator.manipulate as jest.Mock).mockReturnValueOnce({
        renderAsync: jest.fn().mockResolvedValue({ saveAsync: defaultSave }),
      });
      const defaultRes = await precompressImageForUpload('file:///photo.png', 'logo');
      expect(defaultRes.uri).toBe('file:///default.webp');

      await expect(precompressImageForUpload('   ', 'logo')).rejects.toThrow(
        /Local image URI is required/
      );
    });

    it('rejects >5 MiB payloads, secret keys, and invalid params before calling fetch', async () => {
      const { driver } = makeManipulatorDriver();
      const fetchFn = jest.fn();

      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///huge.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-ok',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
          fileSizeBytes: MAX_MEDIA_UPLOAD_BYTES + 1,
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/5 MiB/);
      expect(fetchFn).not.toHaveBeenCalled();

      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///cover.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-ok',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_secret_never_use_in_mobile',
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/sb_secret_/);
      expect(fetchFn).not.toHaveBeenCalled();

      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///cover.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: '   ',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/access token/i);

      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///cover.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-ok',
          supabaseUrl: 'ftp://invalid.example.com',
          publishableKey: 'sb_publishable_demo',
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/http or https/i);

      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///cover.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-ok',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: '   ',
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/publishable key/i);
    });

    it('sends Bearer token + multipart FormData to /functions/v1/compress-image, parses valid WebP JSON, and surfaces errors', async () => {
      const { driver } = makeManipulatorDriver('file:///cache/cover.webp');
      const expectedPayload: CompressImageResponse = {
        bucket: MEDIA_STORAGE_BUCKET,
        path: `orgs/${ORG_A_ID}/cover/99999999-9999-4999-8999-999999999999.webp`,
        publicUrl: `https://demo.supabase.co/storage/v1/object/public/org-media/orgs/${ORG_A_ID}/cover/99999999-9999-4999-8999-999999999999.webp`,
        mimeType: OUTPUT_IMAGE_MIME_TYPE,
        sizeBytes: 42100,
        width: 1600,
        height: 900,
        exifStripped: true,
      };

      const fetchFn = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue(expectedPayload),
      });

      const uploaded = await uploadCompressedOrgMedia({
        localUri: 'file:///raw/cover.jpg',
        organizationId: ORG_A_ID,
        kind: 'cover',
        accessToken: 'jwt-officer-token',
        supabaseUrl: 'https://demo.supabase.co///',
        publishableKey: 'sb_publishable_demo',
        fileSizeBytes: 250_000,
        fetchFn,
        manipulator: driver,
      });

      expect(uploaded).toEqual(expectedPayload);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchFn.mock.calls[0] as [
        string,
        { method: string; headers: Record<string, string>; body: FormData },
      ];
      expect(calledUrl).toBe(
        'https://demo.supabase.co/functions/v1/compress-image'
      );
      expect(calledInit.method).toBe('POST');
      expect(calledInit.headers).toEqual({
        Authorization: 'Bearer jwt-officer-token',
        apikey: 'sb_publishable_demo',
      });
      expect(calledInit.body).toBeInstanceOf(FormData);

      fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({ error: 'Officer is not assigned to org.' }),
      });
      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///raw/cover.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-officer-token',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/Officer is not assigned to org/);

      fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: jest.fn().mockRejectedValue(new Error('not json')),
      });
      await expect(
        uploadCompressedOrgMedia({
          localUri: 'file:///raw/cover.jpg',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-officer-token',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
          fetchFn,
          manipulator: driver,
        })
      ).rejects.toThrow(/Image upload failed \(502\)/);
    });

    it('releases manipulator resources on success & failure and validates FormData + Web Blobs before fetch (Finding 6)', async () => {
      const renderedReleaseOk = jest.fn();
      const contextReleaseOk = jest.fn();
      const okDriver: ImageManipulatorDriver = {
        manipulate: jest.fn().mockReturnValue({
          renderAsync: jest.fn().mockResolvedValue({
            saveAsync: jest.fn().mockResolvedValue({
              uri: 'blob:https://app.example/out-webp',
              width: 512,
              height: 512,
            }),
            release: renderedReleaseOk,
          }),
          release: contextReleaseOk,
        }),
      };

      const expectedPayload: CompressImageResponse = {
        bucket: MEDIA_STORAGE_BUCKET,
        path: `orgs/${ORG_A_ID}/logo/99999999-9999-4999-8999-999999999998.webp`,
        publicUrl: `https://demo.supabase.co/storage/v1/object/public/org-media/orgs/${ORG_A_ID}/logo/99999999-9999-4999-8999-999999999998.webp`,
        mimeType: OUTPUT_IMAGE_MIME_TYPE,
        sizeBytes: 64,
        width: 512,
        height: 512,
        exifStripped: true,
      };

      const webBlob = new Blob([new Uint8Array(64)], {
        type: OUTPUT_IMAGE_MIME_TYPE,
      });
      const fetchFn = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue(expectedPayload),
      });

      const result = await uploadCompressedOrgMedia({
        localUri: 'blob:https://app.example/raw-logo',
        organizationId: ORG_A_ID,
        kind: 'logo',
        accessToken: 'jwt-web-token',
        supabaseUrl: 'HTTPS://demo.supabase.co',
        publishableKey: 'sb_publishable_demo',
        fetchFn,
        manipulator: okDriver,
        readPreparedBlob: jest.fn().mockResolvedValue(webBlob),
      });

      expect(result).toEqual(expectedPayload);
      expect(renderedReleaseOk).toHaveBeenCalledTimes(1);
      expect(contextReleaseOk).toHaveBeenCalledTimes(1);

      const [, calledInit] = fetchFn.mock.calls[0] as [
        string,
        { body: FormData },
      ];
      expect(readFormDataField(calledInit.body, 'organization_id')).toBe(ORG_A_ID);
      expect(readFormDataField(calledInit.body, 'kind')).toBe('logo');
      const uploadedFile = readFormDataField(calledInit.body, 'file');
      expect(uploadedFile).toBeInstanceOf(Blob);

      const fetchOversized = jest.fn();
      const hugeBlob = new Blob([new Uint8Array(MAX_MEDIA_UPLOAD_BYTES + 1)], {
        type: OUTPUT_IMAGE_MIME_TYPE,
      });
      await expect(
        uploadCompressedOrgMedia({
          localUri: 'blob:https://app.example/huge',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-web-token',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
          fetchFn: fetchOversized,
          manipulator: okDriver,
          readPreparedBlob: jest.fn().mockResolvedValue(hugeBlob),
        })
      ).rejects.toThrow(/5 MiB/);
      expect(fetchOversized).not.toHaveBeenCalled();

      const emptyBlob = new Blob([], { type: OUTPUT_IMAGE_MIME_TYPE });
      await expect(
        uploadCompressedOrgMedia({
          localUri: 'blob:https://app.example/empty',
          organizationId: ORG_A_ID,
          kind: 'cover',
          accessToken: 'jwt-web-token',
          supabaseUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
          fetchFn: fetchOversized,
          manipulator: okDriver,
          readPreparedBlob: jest.fn().mockResolvedValue(emptyBlob),
        })
      ).rejects.toThrow(/empty/i);
      expect(fetchOversized).not.toHaveBeenCalled();

      const renderedReleaseFail = jest.fn();
      const contextReleaseFail = jest.fn();
      const saveFailDriver: ImageManipulatorDriver = {
        manipulate: jest.fn().mockReturnValue({
          renderAsync: jest.fn().mockResolvedValue({
            saveAsync: jest.fn().mockRejectedValue(new Error('disk full')),
            release: renderedReleaseFail,
          }),
          release: contextReleaseFail,
        }),
      };
      await expect(
        precompressImageForUpload('file:///broken.jpg', 'logo', saveFailDriver)
      ).rejects.toThrow(/disk full/);
      expect(renderedReleaseFail).toHaveBeenCalledTimes(1);
      expect(contextReleaseFail).toHaveBeenCalledTimes(1);

      const contextReleaseRenderFail = jest.fn();
      const renderFailDriver: ImageManipulatorDriver = {
        manipulate: jest.fn().mockReturnValue({
          renderAsync: jest.fn().mockRejectedValue(new Error('decode failed')),
          release: contextReleaseRenderFail,
        }),
      };
      await expect(
        precompressImageForUpload('file:///corrupt.jpg', 'logo', renderFailDriver)
      ).rejects.toThrow(/decode failed/);
      expect(contextReleaseRenderFail).toHaveBeenCalledTimes(1);
    });
  });

  describe('typed Supabase CRUD service (deptOrg.ts)', () => {
    it('fetches, updates, inserts, and loads hub snapshots with Zod boundary validation', async () => {
      const memberships: OrgMembership[] = [
        {
          id: '99999999-9999-4999-8999-999999999991',
          profile_id: STUDENT_ID,
          organization_id: ORG_A_ID,
          role: 'member',
          status: 'approved',
          submission_id: null,
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ];
      const { client } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1, SAMPLE_ORG_B],
        memberships,
        announcements: SAMPLE_ANNOUNCEMENTS,
      });

      const snapshot = await loadHubSnapshot(client, STUDENT_ID);
      expect(snapshot.departmentInfo?.id).toBe(DEPT_ID);
      expect(snapshot.organizations).toHaveLength(3);
      expect(snapshot.memberships).toHaveLength(1);
      expect(snapshot.announcements).toHaveLength(SAMPLE_ANNOUNCEMENTS.length);

      const updatedDept = await updateDepartmentInfo(client, DEPT_ID, {
        title: 'CCS Updated',
      });
      expect(updatedDept.title).toBe('CCS Updated');

      const updatedOrg = await updateOrganizationProfile(client, ORG_A_ID, {
        details: 'Refreshed details',
      });
      expect(updatedOrg.details).toBe('Refreshed details');

      const created = await createAnnouncement(client, {
        organization_id: null,
        title: 'Holiday Advisory',
        content: 'No classes tomorrow.',
        global_visibility: true,
        expires_at: null,
      });
      expect(created.title).toBe('Holiday Advisory');

      await expect(updateDepartmentInfo(client, DEPT_ID, {})).rejects.toThrow(
        /At least one department_info field/
      );
      await expect(
        updateOrganizationProfile(client, ORG_A_ID, {})
      ).rejects.toThrow(/At least one organization field/);
      await expect(
        createAnnouncement(client, {
          organization_id: null,
          title: 'Invalid Notice',
          content: 'Must be global',
          global_visibility: false,
          expires_at: null,
        })
      ).rejects.toThrow(/global_visibility = true/);
    });

    it('returns null when department_info is empty and propagates Supabase errors across all operations', async () => {
      const empty = createMockDeptOrgClient({
        departmentInfo: null,
        organizations: [],
        memberships: [],
        announcements: [],
      });
      await expect(fetchDepartmentInfo(empty.client)).resolves.toBeNull();
      await expect(
        updateDepartmentInfo(empty.client, DEPT_ID, { title: 'Missing Row' })
      ).rejects.toThrow(/Failed to update department info/);
      await expect(
        updateOrganizationProfile(empty.client, ORG_A_ID, { name: 'Missing Org' })
      ).rejects.toThrow(/Failed to update organization profile/);

      for (const [table, run] of [
        ['department_info', (c: DeptOrgSupabaseClient) => fetchDepartmentInfo(c)],
        [
          'department_info',
          (c: DeptOrgSupabaseClient) =>
            updateDepartmentInfo(c, DEPT_ID, { title: 'Err' }),
        ],
        [
          'organizations',
          (c: DeptOrgSupabaseClient) => fetchActiveOrganizations(c),
        ],
        [
          'organizations',
          (c: DeptOrgSupabaseClient) =>
            updateOrganizationProfile(c, ORG_A_ID, { name: 'Err' }),
        ],
        [
          'org_memberships',
          (c: DeptOrgSupabaseClient) => fetchMyOrgMemberships(c, STUDENT_ID),
        ],
        ['announcements', (c: DeptOrgSupabaseClient) => fetchAnnouncements(c)],
        [
          'announcements',
          (c: DeptOrgSupabaseClient) =>
            fetchOrganizationAnnouncements(c, ORG_A_ID),
        ],
        [
          'announcements',
          (c: DeptOrgSupabaseClient) =>
            createAnnouncement(c, {
              organization_id: null,
              title: 'Err',
              content: 'Body',
              global_visibility: true,
              expires_at: null,
            }),
        ],
      ] as const) {
        const failing = createMockDeptOrgClient({
          departmentInfo: SAMPLE_DEPT,
          organizations: [SAMPLE_ORG_A],
          memberships: [],
          announcements: [],
          failTable: table,
          failErrorMessage: `RLS denied on ${table}`,
        });
        await expect(run(failing.client)).rejects.toThrow(
          new RegExp(`RLS denied on ${table}`)
        );
      }
    });

    it('creates initial department_info, enforces announcements limit, and accepts uppercase HTTPS URLs (Findings 8 & 10)', async () => {
      const { client, spies } = createMockDeptOrgClient({
        departmentInfo: null,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: SAMPLE_ANNOUNCEMENTS,
      });

      const created = await createDepartmentInfo(client, {
        title: 'College of Computer Studies',
        about_markdown: 'Initial department profile.',
        leadership_json: [
          {
            name: 'Dr. Maria Santos',
            title: 'Dean',
            email: 'maria.santos@lpunetwork.edu.ph',
          },
        ],
        contact_json: { office: 'CCS Building 3F' },
      });
      expect(created.id).toBe(DEPT_ID);
      expect(created.title).toBe('College of Computer Studies');
      expect(spies.insertDepartment).toHaveBeenCalledTimes(1);

      await expect(
        createDepartmentInfo(client, {
          title: '   ',
          about_markdown: '',
          leadership_json: [],
          contact_json: {},
        })
      ).rejects.toThrow(/Department title is required/);

      const failingCreate = createMockDeptOrgClient({
        departmentInfo: null,
        organizations: [],
        memberships: [],
        announcements: [],
        failTable: 'department_info',
        failErrorMessage: 'Admin role required to insert department_info',
      });
      await expect(
        createDepartmentInfo(failingCreate.client, {
          title: 'CCS',
          about_markdown: '',
          leadership_json: [],
          contact_json: {},
        })
      ).rejects.toThrow(/Admin role required/);

      const defaultBatch = await fetchAnnouncements(client);
      expect(defaultBatch).toHaveLength(SAMPLE_ANNOUNCEMENTS.length);
      expect(spies.announcementsLimit).toHaveBeenCalledWith(
        DEFAULT_ANNOUNCEMENTS_LIMIT
      );

      const limitedBatch = await fetchAnnouncements(client, 2);
      expect(limitedBatch).toHaveLength(2);
      expect(spies.announcementsLimit).toHaveBeenLastCalledWith(2);

      const updatedUppercase = await updateOrganizationProfile(client, ORG_A_ID, {
        logo_url: 'HTTPS://CDN.EXAMPLE.EDU/org-a-logo.webp',
      });
      expect(updatedUppercase.logo_url).toBe(
        'HTTPS://CDN.EXAMPLE.EDU/org-a-logo.webp'
      );
    });

    it('fetches uncapped chronological per-org announcements independently of hub feed limit', async () => {
      const bulkGlobalAnnouncements: Announcement[] = Array.from(
        { length: 105 },
        (_, index) => ({
          id: `88888888-8888-4888-8888-${String(index + 1).padStart(12, '0')}`,
          organization_id: null,
          title: `Global Notice #${index + 1}`,
          content: 'Department-wide notice.',
          global_visibility: true,
          published_at: new Date(
            Date.parse('2026-11-27T00:00:00.000Z') - index * 60_000
          ).toISOString(),
          expires_at: null,
          deleted_at: null,
        })
      );
      const olderOrgPost1: Announcement = {
        id: '88888888-8888-4888-8888-999999999901',
        organization_id: ORG_A_ID,
        title: 'Older Council Update #1',
        content: 'Older post pushed past the 100-item hub feed window.',
        global_visibility: false,
        published_at: '2026-10-10T08:00:00.000Z',
        expires_at: null,
        deleted_at: null,
      };
      const olderOrgPost2: Announcement = {
        id: '88888888-8888-4888-8888-999999999902',
        organization_id: ORG_A_ID,
        title: 'Older Council Update #2',
        content: 'Newer than #1 but still outside top 100 global notices.',
        global_visibility: false,
        published_at: '2026-10-15T08:00:00.000Z',
        expires_at: null,
        deleted_at: null,
      };
      const otherOrgPost: Announcement = {
        id: '88888888-8888-4888-8888-999999999903',
        organization_id: ORG_B_ID,
        title: 'ACM Exclusive',
        content: 'Belongs to Org B.',
        global_visibility: false,
        published_at: '2026-10-20T08:00:00.000Z',
        expires_at: null,
        deleted_at: null,
      };

      const { client, spies } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A, SAMPLE_ORG_B],
        memberships: [],
        announcements: [
          ...bulkGlobalAnnouncements,
          olderOrgPost1,
          olderOrgPost2,
          otherOrgPost,
        ],
      });

      const hubFeed = await fetchAnnouncements(client);
      expect(hubFeed).toHaveLength(DEFAULT_ANNOUNCEMENTS_LIMIT);
      expect(hubFeed.some((a) => a.id === olderOrgPost1.id)).toBe(false);
      expect(spies.announcementsLimit).toHaveBeenCalledTimes(1);

      spies.announcementsLimit.mockClear();
      const orgPosts = await fetchOrganizationAnnouncements(client, ORG_A_ID);
      expect(orgPosts.map((a) => a.id)).toEqual([
        olderOrgPost2.id,
        olderOrgPost1.id,
      ]);
      expect(spies.announcementsLimit).not.toHaveBeenCalled();

      await expect(
        fetchOrganizationAnnouncements(client, 'not-a-uuid')
      ).rejects.toThrow();

      const pagedCount = 1005;
      const expectedPagedOrder: Announcement[] = Array.from(
        { length: pagedCount },
        (_, index) => ({
          id: `88888888-8888-4888-9888-${String(index + 1).padStart(12, '0')}`,
          organization_id: ORG_A_ID,
          title: `Paged Org Post #${index + 1}`,
          content: 'Paginated organization announcement.',
          global_visibility: false,
          published_at: new Date(
            Date.parse('2026-11-20T00:00:00.000Z') -
              Math.floor((index + 1) / 2) * 60_000
          ).toISOString(),
          expires_at: null,
          deleted_at: null,
        })
      );
      const outOfIdOrderFixture: Announcement[] = [...expectedPagedOrder];
      for (let i = 1; i + 1 < outOfIdOrderFixture.length; i += 2) {
        const first = outOfIdOrderFixture[i];
        outOfIdOrderFixture[i] = outOfIdOrderFixture[i + 1];
        outOfIdOrderFixture[i + 1] = first;
      }

      const pagedMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: outOfIdOrderFixture,
      });

      const allPaged = await fetchOrganizationAnnouncements(
        pagedMock.client,
        ORG_A_ID
      );
      expect(allPaged).toHaveLength(pagedCount);
      expect(allPaged.map((a) => a.id)).toEqual(
        expectedPagedOrder.map((a) => a.id)
      );
      const expectedOrders: MockOrderSpec[] = [
        { column: 'published_at', ascending: false },
        { column: 'id', ascending: true },
      ];
      expect(pagedMock.spies.orgAnnouncementsOrders).toHaveBeenCalledTimes(2);
      expect(pagedMock.spies.orgAnnouncementsOrders).toHaveBeenNthCalledWith(
        1,
        ORG_A_ID,
        expectedOrders
      );
      expect(pagedMock.spies.orgAnnouncementsOrders).toHaveBeenNthCalledWith(
        2,
        ORG_A_ID,
        expectedOrders
      );
      expect(pagedMock.spies.orgAnnouncementsLimits).toHaveBeenCalledTimes(2);
      expect(pagedMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        1,
        ORG_A_ID,
        ORG_ANNOUNCEMENTS_PAGE_SIZE
      );
      expect(pagedMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        2,
        ORG_A_ID,
        ORG_ANNOUNCEMENTS_PAGE_SIZE
      );

      const overCapMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: outOfIdOrderFixture,
      });
      const overCapResult = await fetchOrganizationAnnouncements(
        overCapMock.client,
        ORG_A_ID,
        1500
      );
      expect(overCapResult).toHaveLength(pagedCount);
      expect(overCapResult.map((a) => a.id)).toEqual(
        expectedPagedOrder.map((a) => a.id)
      );
      expect(overCapMock.spies.orgAnnouncementsLimits).toHaveBeenCalledTimes(2);
      expect(overCapMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        1,
        ORG_A_ID,
        ORG_ANNOUNCEMENTS_MAX_PAGE_SIZE
      );
      expect(overCapMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        2,
        ORG_A_ID,
        ORG_ANNOUNCEMENTS_MAX_PAGE_SIZE
      );

      const expectedSmallOrder = expectedPagedOrder.slice(0, 5);
      const smallFixture = [
        expectedSmallOrder[0],
        expectedSmallOrder[2],
        expectedSmallOrder[1],
        expectedSmallOrder[4],
        expectedSmallOrder[3],
      ];
      const smallPageMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: smallFixture,
      });
      const smallPaged = await fetchOrganizationAnnouncements(
        smallPageMock.client,
        ORG_A_ID,
        2
      );
      expect(smallPaged.map((a) => a.id)).toEqual(
        expectedSmallOrder.map((a) => a.id)
      );
      expect(smallPageMock.spies.orgAnnouncementsLimits).toHaveBeenCalledTimes(
        3
      );
      expect(smallPageMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        1,
        ORG_A_ID,
        2
      );
      expect(smallPageMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        2,
        ORG_A_ID,
        2
      );
      expect(smallPageMock.spies.orgAnnouncementsLimits).toHaveBeenNthCalledWith(
        3,
        ORG_A_ID,
        2
      );

      let pageCalls = 0;
      const midDeleteMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: smallFixture.map((item) => ({ ...item })),
        onFetchOrgAnnouncements: async (_orgId, params) => {
          pageCalls += 1;
          if (pageCalls === 2) {
            expect(params.orFilters).toHaveLength(1);
            midDeleteMock.state.announcements =
              midDeleteMock.state.announcements.map((item) =>
                item.id === expectedSmallOrder[0].id
                  ? { ...item, deleted_at: '2026-11-27T12:05:00.000Z' }
                  : item
              );
          }
          return undefined;
        },
      });
      const midDeleteResult = await fetchOrganizationAnnouncements(
        midDeleteMock.client,
        ORG_A_ID,
        2
      );
      expect(midDeleteResult.map((a) => a.id)).toEqual(
        expectedSmallOrder.map((a) => a.id)
      );
      expect(new Set(midDeleteResult.map((a) => a.id)).size).toBe(5);
      expect(pageCalls).toBe(3);
    });
  });

  describe('MyCcsHubScreen end-to-end role flows & App wiring', () => {
    jest.setTimeout(15_000);

    it('student flow: filters active announcements (expired hidden), views read-only Department About, browses Main->Sub-Org directory, views read-only Org Page (no likes/comments/edit), and checks Identity QR + Sign Out', async () => {
      const memberships: OrgMembership[] = [
        {
          id: '99999999-9999-4999-8999-999999999991',
          profile_id: STUDENT_ID,
          organization_id: ORG_A_ID,
          role: 'member',
          status: 'approved',
          submission_id: null,
          created_at: '2026-10-01T00:00:00.000Z',
        },
        {
          id: '99999999-9999-4999-8999-999999999992',
          profile_id: STUDENT_ID,
          organization_id: SUB_ORG_A1_ID,
          role: 'member',
          status: 'pending',
          submission_id: null,
          created_at: '2026-10-02T00:00:00.000Z',
        },
        {
          id: '99999999-9999-4999-8999-999999999993',
          profile_id: STUDENT_ID,
          organization_id: ORG_B_ID,
          role: 'member',
          status: 'rejected',
          submission_id: null,
          created_at: '2026-10-03T00:00:00.000Z',
        },
      ];

      const { client } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1, SAMPLE_ORG_B],
        memberships,
        announcements: SAMPLE_ANNOUNCEMENTS,
      });
      const onSignOut = jest.fn();

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut,
          deptOrgClient: client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId(`announcement-item-${ANN_DEPT_ACTIVE_ID}`)).toBeTruthy();
      });
      expect(screen.getByTestId(`announcement-item-${ANN_ORG_A_ACTIVE_ID}`)).toBeTruthy();
      expect(screen.getByTestId(`announcement-expires-${ANN_DEPT_ACTIVE_ID}`).props.children).toBe(
        'Expires 2026-12-11'
      );
      expect(screen.queryByTestId(`announcement-item-${ANN_DEPT_EXPIRED_ID}`)).toBeNull();
      expect(screen.queryByTestId(`announcement-item-${ANN_ORG_A_EXPIRED_ID}`)).toBeNull();
      expect(screen.queryByTestId('dept-new-notice-button')).toBeNull();

      await fireEvent.press(screen.getByTestId('feed-filter-department'));
      expect(screen.getByTestId(`announcement-item-${ANN_DEPT_ACTIVE_ID}`)).toBeTruthy();
      expect(screen.queryByTestId(`announcement-item-${ANN_ORG_A_ACTIVE_ID}`)).toBeNull();

      await fireEvent.press(screen.getByTestId('feed-filter-my_orgs'));
      expect(screen.getByTestId(`announcement-item-${ANN_ORG_A_ACTIVE_ID}`)).toBeTruthy();
      expect(screen.queryByTestId(`announcement-item-${ANN_DEPT_ACTIVE_ID}`)).toBeNull();

      await fireEvent.press(screen.getByTestId('tab-department'));
      expect(screen.getByTestId('department-about-view')).toBeTruthy();
      expect(screen.getByTestId('department-title').props.children).toBe(
        SAMPLE_DEPT.title
      );
      expect(screen.getByText('Dr. Maria Santos')).toBeTruthy();
      expect(screen.getByText('CCS Faculty Room, 3F')).toBeTruthy();
      expect(screen.queryByTestId('dept-edit-button')).toBeNull();

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      expect(screen.getByTestId('org-directory-view')).toBeTruthy();
      expect(screen.getByTestId(`org-logo-image-${ORG_A_ID}`)).toBeTruthy();
      expect(screen.getByTestId(`org-monogram-${SUB_ORG_A1_ID}`)).toBeTruthy();
      expect(screen.getByTestId(`org-membership-badge-${ORG_A_ID}`)).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByText('Rejected')).toBeTruthy();

      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      expect(screen.getByTestId('org-detail-view')).toBeTruthy();
      expect(screen.getByTestId('org-detail-cover-image')).toBeTruthy();
      expect(screen.getByTestId('org-detail-logo-image')).toBeTruthy();
      expect(screen.getByTestId('org-detail-tier').props.children).toBe(
        'Main organization'
      );
      expect(screen.getByTestId(`org-post-item-${ANN_ORG_A_ACTIVE_ID}`)).toBeTruthy();
      expect(screen.queryByTestId(`org-post-item-${ANN_ORG_A_EXPIRED_ID}`)).toBeNull();
      expect(screen.queryByTestId('org-customize-button')).toBeNull();
      expect(screen.queryByTestId('org-new-post-button')).toBeNull();
      expect(screen.queryByText(/Like/i)).toBeNull();
      expect(screen.queryByText(/Comment/i)).toBeNull();

      await fireEvent.press(screen.getByTestId(`org-suborg-row-${SUB_ORG_A1_ID}`));
      expect(screen.getByTestId('org-detail-cover-fallback')).toBeTruthy();
      expect(screen.getByTestId('org-detail-logo-monogram')).toBeTruthy();
      expect(screen.getByTestId('org-detail-tier').props.children).toBe(
        'Sub-org of CCS Student Council'
      );
      expect(screen.getByTestId('org-posts-empty')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('org-detail-back-button'));
      expect(screen.getByTestId('org-directory-view')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('tab-identity'));
      expect(screen.getByTestId('identity-card')).toBeTruthy();
      expect(screen.getByTestId('qr-token-text').props.children).toBe(
        STUDENT_PROFILE.qrToken
      );
      await fireEvent.press(screen.getByTestId('signout-button'));
      expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    it('officer flow: customizes assigned Org A (details + cover/logo upload) and posts to Org A, sees Org B strictly read-only, and cannot edit Department About', async () => {
      const memberships: OrgMembership[] = [
        {
          id: '99999999-9999-4999-8999-999999999994',
          profile_id: OFFICER_ID,
          organization_id: ORG_A_ID,
          role: 'officer',
          status: 'approved',
          submission_id: null,
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ];

      const { client, state, spies } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1, SAMPLE_ORG_B],
        memberships,
        announcements: SAMPLE_ANNOUNCEMENTS,
      });

      const onUploadOrgMedia = jest.fn(
        async (
          orgId: string,
          kind: 'logo' | 'cover',
          _localUri: string
        ): Promise<CompressImageResponse> => {
          const path = `orgs/${orgId}/${kind}/88888888-8888-4888-8888-888888888888.webp`;
          const publicUrl = `https://myccs.supabase.co/storage/v1/object/public/${MEDIA_STORAGE_BUCKET}/${path}`;
          state.organizations = state.organizations.map((org) =>
            org.id === orgId
              ? {
                  ...org,
                  ...(kind === 'cover'
                    ? { cover_url: publicUrl }
                    : { logo_url: publicUrl }),
                }
              : org
          );
          return {
            bucket: MEDIA_STORAGE_BUCKET,
            path,
            publicUrl,
            mimeType: OUTPUT_IMAGE_MIME_TYPE,
            sizeBytes: 18000,
            width: kind === 'logo' ? 512 : 1600,
            height: kind === 'logo' ? 512 : 900,
            exifStripped: true,
          };
        }
      );

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: OFFICER_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          onUploadOrgMedia,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId(`announcement-expired-badge-${ANN_ORG_A_EXPIRED_ID}`)).toBeTruthy();
      });
      expect(screen.queryByTestId('dept-new-notice-button')).toBeNull();

      await fireEvent.press(screen.getByTestId('tab-department'));
      expect(screen.queryByTestId('dept-edit-button')).toBeNull();

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));

      expect(screen.getByTestId('org-customize-button')).toBeTruthy();
      expect(screen.getByTestId('org-new-post-button')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('org-customize-button'));
      expect(screen.getByTestId('org-edit-panel')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('org-upload-cover-button'));
      expect(screen.getByTestId('org-edit-error').props.children).toMatch(
        /local cover image URI/i
      );

      await fireEvent.changeText(
        screen.getByTestId('org-cover-uri-input'),
        'file:///tmp/new-cover.jpg'
      );
      await fireEvent.press(screen.getByTestId('org-upload-cover-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-media-status').props.children).toMatch(
          /Cover image compressed/
        );
      });
      expect(onUploadOrgMedia).toHaveBeenCalledWith(
        ORG_A_ID,
        'cover',
        'file:///tmp/new-cover.jpg'
      );
      const expectedCoverUrl = `https://myccs.supabase.co/storage/v1/object/public/${MEDIA_STORAGE_BUCKET}/orgs/${ORG_A_ID}/cover/88888888-8888-4888-8888-888888888888.webp`;
      expect(screen.getByTestId('org-detail-cover-image').props.source).toEqual({
        uri: expectedCoverUrl,
      });

      await fireEvent.changeText(
        screen.getByTestId('org-logo-uri-input'),
        'file:///tmp/new-logo.png'
      );
      await fireEvent.press(screen.getByTestId('org-upload-logo-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-media-status').props.children).toMatch(
          /Logo image compressed/
        );
      });
      const expectedLogoUrl = `https://myccs.supabase.co/storage/v1/object/public/${MEDIA_STORAGE_BUCKET}/orgs/${ORG_A_ID}/logo/88888888-8888-4888-8888-888888888888.webp`;
      expect(screen.getByTestId('org-detail-logo-image').props.source).toEqual({
        uri: expectedLogoUrl,
      });
      expect(spies.updateOrg).not.toHaveBeenCalled();

      await fireEvent.changeText(
        screen.getByTestId('org-edit-details-input'),
        'Updated CCS Student Council mission.'
      );
      await fireEvent.press(screen.getByTestId('org-edit-save-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-detail-about').props.children).toBe(
          'Updated CCS Student Council mission.'
        );
      });
      expect(spies.updateOrg).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('org-detail-cover-image').props.source).toEqual({
        uri: expectedCoverUrl,
      });
      expect(screen.getByTestId('org-detail-logo-image').props.source).toEqual({
        uri: expectedLogoUrl,
      });

      await fireEvent.press(screen.getByTestId('org-new-post-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-post-title-input'),
        'Council Kit Distribution'
      );
      await fireEvent.changeText(
        screen.getByTestId('org-post-content-input'),
        'Claim kits at Room 302.'
      );
      await fireEvent.changeText(
        screen.getByTestId('org-post-expires-input'),
        '2020-01-01'
      );
      await fireEvent.press(screen.getByTestId('org-post-publish-button'));
      expect(screen.getByTestId('org-post-error').props.children).toMatch(
        /future/i
      );

      await fireEvent.changeText(
        screen.getByTestId('org-post-expires-input'),
        '2026-12-20'
      );
      await fireEvent.press(screen.getByTestId('org-post-publish-button'));
      await waitFor(() => {
        expect(screen.getByTestId(`org-post-item-${ANN_NEW_ID}`)).toBeTruthy();
      });
      expect(spies.insertAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: ORG_A_ID,
          global_visibility: false,
          expires_at: '2026-12-20T23:59:59+08:00',
        })
      );

      await fireEvent.press(screen.getByTestId('org-detail-back-button'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_B_ID}`));
      expect(screen.getByTestId('org-detail-name').props.children).toBe(
        'ACM Chapter'
      );
      expect(screen.queryByTestId('org-customize-button')).toBeNull();
      expect(screen.queryByTestId('org-new-post-button')).toBeNull();
    });

    it('admin flow: edits Department About, publishes department-wide notice with expiration, and can customize any organization', async () => {
      const { client, spies } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A, SAMPLE_ORG_B],
        memberships: [],
        announcements: SAMPLE_ANNOUNCEMENTS,
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('dept-new-notice-button')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('dept-new-notice-button'));
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-title-input'),
        'Dean List Release'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-content-input'),
        'Honors list is posted outside the CCS office.'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-expires-input'),
        '2025-01-01'
      );
      await fireEvent.press(screen.getByTestId('dept-notice-publish-button'));
      expect(screen.getByTestId('dept-notice-error').props.children).toMatch(
        /future/i
      );

      await fireEvent.changeText(
        screen.getByTestId('dept-notice-expires-input'),
        '2026-12-30'
      );
      await fireEvent.press(screen.getByTestId('dept-notice-publish-button'));
      await waitFor(() => {
        expect(screen.getByTestId(`announcement-item-${ANN_NEW_ID}`)).toBeTruthy();
      });
      expect(spies.insertAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: null,
          global_visibility: true,
          expires_at: '2026-12-30T23:59:59+08:00',
        })
      );

      await fireEvent.press(screen.getByTestId('tab-department'));
      await fireEvent.press(screen.getByTestId('dept-edit-button'));
      expect(screen.getByTestId('department-edit-form')).toBeTruthy();

      await fireEvent.changeText(
        screen.getByTestId('dept-edit-leadership-input'),
        'Bad Line Without Pipe'
      );
      await fireEvent.press(screen.getByTestId('dept-save-button'));
      expect(screen.getByTestId('dept-form-error').props.children).toMatch(
        /Name \| Title/
      );

      await fireEvent.changeText(
        screen.getByTestId('dept-edit-title-input'),
        'CCS — LPU Cavite'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-about-input'),
        'Updated department mission statement.'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-office-input'),
        'CCS Hub 4F'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-email-input'),
        'office@lpunetwork.edu.ph'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-leadership-input'),
        'Dr. Elena Cruz | Dean | elena.cruz@lpunetwork.edu.ph\nProf. Mark Tan | IT Chair'
      );
      await fireEvent.press(screen.getByTestId('dept-save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('department-title').props.children).toBe(
          'CCS — LPU Cavite'
        );
      });
      expect(screen.getByText('Dr. Elena Cruz')).toBeTruthy();
      expect(screen.getByText('CCS Hub 4F')).toBeTruthy();
      expect(spies.updateDepartment).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_B_ID}`));
      expect(screen.getByTestId('org-customize-button')).toBeTruthy();
      expect(screen.getByTestId('org-new-post-button')).toBeTruthy();
    });

    it('handles empty hub states, load errors with Refresh retry, and App -> AuthIdentityScreen -> MyCcsHubScreen wiring', async () => {
      const failing = createMockDeptOrgClient({
        departmentInfo: null,
        organizations: [],
        memberships: [],
        announcements: [],
        failTable: 'announcements',
        failErrorMessage: 'Temporary network outage',
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: failing.client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('hub-error-banner')).toBeTruthy();
      });
      expect(screen.getByText('Temporary network outage')).toBeTruthy();

      failing.state.failTable = undefined;
      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(screen.queryByTestId('hub-error-banner')).toBeNull();
      });
      expect(screen.getByTestId('announcements-empty')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('tab-department'));
      expect(screen.getByTestId('department-empty-state')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      expect(screen.getByTestId('org-directory-empty')).toBeTruthy();

      const appMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: [SAMPLE_ANNOUNCEMENTS[0]],
      });
      const combinedClient = {
        ...appMock.client,
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: 'jwt-app-restored',
                user: { id: STUDENT_ID, email: STUDENT_PROFILE.email },
              },
            },
            error: null,
          }),
          signUp: jest.fn(),
          verifyOtp: jest.fn(),
          signInWithPassword: jest.fn(),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
        rpc: jest.fn().mockResolvedValue({ data: STUDENT_PROFILE, error: null }),
      };

      jest.spyOn(supabaseLib, 'isSupabaseConfigured').mockReturnValue(true);
      jest
        .spyOn(supabaseLib, 'getSupabaseClient')
        .mockReturnValue(
          combinedClient as unknown as ReturnType<
            typeof supabaseLib.getSupabaseClient
          >
        );

      jest.useFakeTimers({
        now: NOW,
        doNotFake: [
          'nextTick',
          'setImmediate',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'queueMicrotask',
        ],
      });
      try {
        const appTree = await render(createElement(App));
        await waitFor(() => {
          expect(appTree.getByTestId('myccs-hub-screen')).toBeTruthy();
        });
        expect(
          appTree.getByTestId(`announcement-item-${ANN_DEPT_ACTIVE_ID}`)
        ).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });

    it('uses default runtime uploadCompressedOrgMedia path in MyCcsHubScreen when onUploadOrgMedia prop is omitted', async () => {
      const { client, state } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [
          {
            id: '99999999-9999-4999-8999-999999999995',
            profile_id: OFFICER_ID,
            organization_id: ORG_A_ID,
            role: 'officer',
            status: 'approved',
            submission_id: null,
            created_at: '2026-10-01T00:00:00.000Z',
          },
        ],
        announcements: [],
        sessionAccessToken: null,
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: OFFICER_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('announcements-empty')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      await fireEvent.press(screen.getByTestId('org-customize-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-cover-uri-input'),
        'file:///tmp/runtime-cover.jpg'
      );
      await fireEvent.press(screen.getByTestId('org-upload-cover-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-edit-error').props.children).toMatch(
          /Active session token required/i
        );
      });

      state.sessionAccessToken = 'jwt-runtime-officer';
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://runtime.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_runtime';

      const saveAsync = jest.fn().mockResolvedValue({
        uri: 'file:///cache/runtime-cover.webp',
        width: 1600,
        height: 900,
      });
      (ImageManipulator.manipulate as jest.Mock).mockReturnValueOnce({
        renderAsync: jest.fn().mockResolvedValue({ saveAsync }),
      });

      const originalFetch = globalThis.fetch;
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({
          bucket: MEDIA_STORAGE_BUCKET,
          path: `orgs/${ORG_A_ID}/cover/88888888-8888-4888-8888-888888888889.webp`,
          publicUrl: 'https://runtime.supabase.co/storage/v1/object/public/org-media/cover.webp',
          mimeType: OUTPUT_IMAGE_MIME_TYPE,
          sizeBytes: 30000,
          width: 1600,
          height: 900,
          exifStripped: true,
        }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      try {
        await fireEvent.press(screen.getByTestId('org-upload-cover-button'));
        await waitFor(() => {
          expect(screen.getByTestId('org-media-status').props.children).toMatch(
            /Cover image compressed/
          );
        });
        expect(fetchMock).toHaveBeenCalledWith(
          'https://runtime.supabase.co/functions/v1/compress-image',
          expect.objectContaining({
            method: 'POST',
            headers: {
              Authorization: 'Bearer jwt-runtime-officer',
              apikey: 'sb_publishable_runtime',
            },
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('lets admin create initial department_info from empty state and protects mid-edit drafts from refresh overwrites (Findings 8 & 9)', async () => {
      const { client, state, spies } = createMockDeptOrgClient({
        departmentInfo: null,
        organizations: [],
        memberships: [],
        announcements: [],
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('announcements-empty')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('tab-department'));
      expect(screen.getByTestId('department-empty-state')).toBeTruthy();
      expect(screen.getByTestId('dept-create-button')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('dept-create-button'));
      expect(screen.getByTestId('department-edit-form')).toBeTruthy();
      expect(screen.getByText('Add Department Info')).toBeTruthy();
      expect(screen.getByText('Save Department Info')).toBeTruthy();

      await fireEvent.changeText(
        screen.getByTestId('dept-edit-title-input'),
        'College of Computer Studies'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-about-input'),
        'Department mission and degree programs.'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-office-input'),
        'CCS Office 3F'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-email-input'),
        'ccs@lpunetwork.edu.ph'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-leadership-input'),
        'Dr. Maria Santos | Dean | maria.santos@lpunetwork.edu.ph'
      );
      await fireEvent.press(screen.getByTestId('dept-save-button'));

      await waitFor(() => {
        expect(screen.getByTestId('department-about-view')).toBeTruthy();
      });
      expect(screen.getByTestId('department-title').props.children).toBe(
        'College of Computer Studies'
      );
      expect(spies.insertDepartment).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByTestId('dept-edit-button'));
      expect(screen.getByTestId('department-edit-form')).toBeTruthy();
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-title-input'),
        'In-Progress Admin Draft'
      );

      const refreshDeferred = createDeferred<{
        data: Announcement[] | null;
        error: { message: string } | null;
      }>();
      state.departmentInfo = {
        ...state.departmentInfo!,
        title: 'Background Refreshed Title',
        updated_at: '2026-11-27T13:00:00.000Z',
      };
      state.onFetchAnnouncements = () => refreshDeferred.promise;

      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      expect(screen.queryByTestId('hub-loading')).toBeNull();
      expect(screen.getByTestId('department-edit-form')).toBeTruthy();
      expect(screen.getByText('Refreshing...')).toBeTruthy();
      expect(
        screen.getByTestId('hub-refresh-button').props.accessibilityState
          ?.disabled
      ).toBe(true);

      await act(async () => {
        refreshDeferred.resolve({ data: [], error: null });
      });
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeTruthy();
      });
      expect(
        screen.getByTestId('dept-edit-title-input').props.value
      ).toBe('In-Progress Admin Draft');

      await fireEvent.press(screen.getByTestId('dept-cancel-button'));
      expect(screen.getByTestId('department-title').props.children).toBe(
        'Background Refreshed Title'
      );

      const studentActor: RbacActor = {
        profileId: STUDENT_ID,
        role: 'student',
        memberships: [],
      };
      const studentEmpty = await render(
        createElement(DepartmentAboutView, {
          departmentInfo: null,
          actor: studentActor,
          mode: 'view',
          onEnterEdit: jest.fn(),
          onCancelEdit: jest.fn(),
          onCreate: jest.fn(),
          onSave: jest.fn(),
        })
      );
      expect(studentEmpty.getByTestId('department-empty-state')).toBeTruthy();
      expect(studentEmpty.queryByTestId('dept-create-button')).toBeNull();
    });

    it('guards async races: overlapping refreshHub, rapid double-tap publish, tab switch during save, org switch draft reset, and mid-upload unmount (Findings 9, 13, 14, 17)', async () => {
      const firstFetch = createDeferred<{
        data: Announcement[] | null;
        error: { message: string } | null;
      }>();
      const secondFetch = createDeferred<{
        data: Announcement[] | null;
        error: { message: string } | null;
      }>();

      const firstMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: [],
        onFetchAnnouncements: () => firstFetch.promise,
      });
      const secondMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: [],
        onFetchAnnouncements: () => secondFetch.promise,
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: firstMock.client,
          now: NOW,
        })
      );

      await screen.rerender(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: secondMock.client,
          now: NOW,
        })
      );

      const newerNotice: Announcement = {
        ...SAMPLE_ANNOUNCEMENTS[0],
        id: ANN_NEW_ID,
        title: 'Fresh Snapshot Notice',
      };
      await act(async () => {
        secondFetch.resolve({ data: [newerNotice], error: null });
      });
      await waitFor(() => {
        expect(screen.getByTestId(`announcement-item-${ANN_NEW_ID}`)).toBeTruthy();
      });

      await act(async () => {
        firstFetch.resolve({ data: [SAMPLE_ANNOUNCEMENTS[0]], error: null });
      });
      expect(screen.getByTestId(`announcement-item-${ANN_NEW_ID}`)).toBeTruthy();
      expect(
        screen.queryByTestId(`announcement-item-${ANN_DEPT_ACTIVE_ID}`)
      ).toBeNull();

      const publishDeferred = createDeferred<{
        data: Announcement | null;
        error: { message: string } | null;
      }>();
      const createdDoubleTapId = '77777777-7777-4777-8777-777777777780';
      secondMock.state.onInsertAnnouncement = () => publishDeferred.promise;

      await fireEvent.press(screen.getByTestId('dept-new-notice-button'));
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-title-input'),
        'Single Publish Guard'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-content-input'),
        'Must not post twice on rapid taps.'
      );

      const publishButton = screen.getByTestId('dept-notice-publish-button');
      await fireEvent.press(publishButton);
      await fireEvent.press(publishButton);

      expect(secondMock.spies.insertAnnouncement).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByTestId('tab-department'));
      expect(
        screen.getByTestId('dept-edit-button').props.accessibilityState?.disabled
      ).toBe(true);

      await act(async () => {
        publishDeferred.resolve({
          data: {
            id: createdDoubleTapId,
            organization_id: null,
            title: 'Single Publish Guard',
            content: 'Must not post twice on rapid taps.',
            global_visibility: true,
            published_at: '2026-11-27T12:15:00.000Z',
            expires_at: null,
            deleted_at: null,
          },
          error: null,
        });
      });

      await fireEvent.press(screen.getByTestId('tab-feed'));
      await waitFor(() => {
        expect(
          screen.getByTestId(`announcement-item-${createdDoubleTapId}`)
        ).toBeTruthy();
      });

      const deptSaveDeferred = createDeferred<{
        data: DepartmentInfo | null;
        error: { message: string } | null;
      }>();
      secondMock.state.onUpdateDepartment = () => deptSaveDeferred.promise;

      await fireEvent.press(screen.getByTestId('tab-department'));
      await fireEvent.press(screen.getByTestId('dept-edit-button'));
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-title-input'),
        'Saved While Away'
      );
      await fireEvent.press(screen.getByTestId('dept-save-button'));
      await fireEvent.press(screen.getByTestId('tab-feed'));

      await act(async () => {
        deptSaveDeferred.resolve({
          data: {
            ...SAMPLE_DEPT,
            title: 'Saved While Away',
            updated_at: '2026-11-27T13:10:00.000Z',
          },
          error: null,
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('announcements-feed-list')).toBeTruthy();
      });
      expect(screen.queryByTestId('department-about-view')).toBeNull();

      const adminActor: RbacActor = {
        profileId: ADMIN_ID,
        role: 'admin',
        memberships: [],
      };
      const uploadDeferred = createDeferred<CompressImageResponse>();
      const onUpdateOrgMock = jest.fn().mockResolvedValue(undefined);
      const onUploadMediaMock = jest.fn(() => uploadDeferred.promise);

      const orgView = await render(
        createElement(OrgDetailView, {
          organization: SAMPLE_ORG_A,
          allOrganizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1],
          memberships: [],
          announcements: [],
          actor: adminActor,
          panel: 'new_post',
          now: NOW,
          onBack: jest.fn(),
          onSelectOrg: jest.fn(),
          onChangePanel: jest.fn(),
          onUpdateOrg: onUpdateOrgMock,
          onCreatePost: jest.fn(),
          onUploadMedia: onUploadMediaMock,
        })
      );

      await fireEvent.changeText(
        orgView.getByTestId('org-post-title-input'),
        'Draft for Main Org'
      );
      await fireEvent.changeText(
        orgView.getByTestId('org-post-content-input'),
        'Unsent body'
      );
      await fireEvent.changeText(
        orgView.getByTestId('org-post-expires-input'),
        '2026-12-25'
      );

      await orgView.rerender(
        createElement(OrgDetailView, {
          organization: SAMPLE_SUB_ORG_A1,
          allOrganizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1],
          memberships: [],
          announcements: [],
          actor: adminActor,
          panel: 'new_post',
          now: NOW,
          onBack: jest.fn(),
          onSelectOrg: jest.fn(),
          onChangePanel: jest.fn(),
          onUpdateOrg: onUpdateOrgMock,
          onCreatePost: jest.fn(),
          onUploadMedia: onUploadMediaMock,
        })
      );

      expect(orgView.getByTestId('org-post-title-input').props.value).toBe('');
      expect(orgView.getByTestId('org-post-content-input').props.value).toBe('');
      expect(orgView.getByTestId('org-post-expires-input').props.value).toBe('');

      await orgView.rerender(
        createElement(OrgDetailView, {
          organization: SAMPLE_SUB_ORG_A1,
          allOrganizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1],
          memberships: [],
          announcements: [],
          actor: adminActor,
          panel: 'edit_org',
          now: NOW,
          onBack: jest.fn(),
          onSelectOrg: jest.fn(),
          onChangePanel: jest.fn(),
          onUpdateOrg: onUpdateOrgMock,
          onCreatePost: jest.fn(),
          onUploadMedia: onUploadMediaMock,
        })
      );
      await fireEvent.changeText(
        orgView.getByTestId('org-cover-uri-input'),
        'file:///tmp/sub-cover.jpg'
      );
      await fireEvent.press(orgView.getByTestId('org-upload-cover-button'));

      await orgView.rerender(
        createElement(OrgDetailView, {
          organization: SAMPLE_ORG_A,
          allOrganizations: [SAMPLE_ORG_A, SAMPLE_SUB_ORG_A1],
          memberships: [],
          announcements: [],
          actor: adminActor,
          panel: 'edit_org',
          now: NOW,
          onBack: jest.fn(),
          onSelectOrg: jest.fn(),
          onChangePanel: jest.fn(),
          onUpdateOrg: onUpdateOrgMock,
          onCreatePost: jest.fn(),
          onUploadMedia: onUploadMediaMock,
        })
      );

      await act(async () => {
        uploadDeferred.resolve({
          bucket: MEDIA_STORAGE_BUCKET,
          path: `orgs/${SUB_ORG_A1_ID}/cover/99999999-9999-4999-8999-999999999997.webp`,
          publicUrl: 'https://cdn.example.edu/sub-cover.webp',
          mimeType: OUTPUT_IMAGE_MIME_TYPE,
          sizeBytes: 12000,
          width: 1600,
          height: 900,
          exifStripped: true,
        });
      });
      expect(onUpdateOrgMock).not.toHaveBeenCalled();
      expect(orgView.queryByTestId('org-media-status')).toBeNull();
    });

    it('renders inline mutation errors cleanly without crashing or double-rendering errors (Findings 13 & 16)', async () => {
      const { client, state } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: [],
      });

      const onUploadOrgMedia = jest
        .fn()
        .mockRejectedValue(new Error('Storage quota exceeded'));

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          onUploadOrgMedia,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('announcements-empty')).toBeTruthy();
      });

      state.failTable = 'announcements';
      state.failErrorMessage = 'Notice insert rejected by RLS';
      await fireEvent.press(screen.getByTestId('dept-new-notice-button'));
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-title-input'),
        'Failing Notice'
      );
      await fireEvent.changeText(
        screen.getByTestId('dept-notice-content-input'),
        'Should display inline error.'
      );
      await fireEvent.press(screen.getByTestId('dept-notice-publish-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dept-notice-error').props.children).toBe(
          'Notice insert rejected by RLS'
        );
      });
      expect(screen.queryByTestId('hub-error-banner')).toBeNull();
      expect(screen.getAllByText('Notice insert rejected by RLS')).toHaveLength(1);

      state.failTable = 'department_info';
      state.failErrorMessage = 'Department update failed';
      await fireEvent.press(screen.getByTestId('tab-department'));
      await fireEvent.press(screen.getByTestId('dept-edit-button'));
      await fireEvent.changeText(
        screen.getByTestId('dept-edit-title-input'),
        'CCS Title With Error'
      );
      await fireEvent.press(screen.getByTestId('dept-save-button'));
      await waitFor(() => {
        expect(screen.getByTestId('dept-form-error').props.children).toBe(
          'Department update failed'
        );
      });
      expect(screen.queryByTestId('hub-error-banner')).toBeNull();
      expect(screen.getAllByText('Department update failed')).toHaveLength(1);

      state.failTable = 'organizations';
      state.failErrorMessage = 'Org update rejected';
      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      await fireEvent.press(screen.getByTestId('org-customize-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-cover-uri-input'),
        'file:///tmp/fail-cover.jpg'
      );
      await fireEvent.press(screen.getByTestId('org-upload-cover-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-edit-error').props.children).toBe(
          'Storage quota exceeded'
        );
      });

      await fireEvent.press(screen.getByTestId('org-edit-save-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-edit-error').props.children).toBe(
          'Org update rejected'
        );
      });
      expect(screen.queryByTestId('hub-error-banner')).toBeNull();
      expect(screen.getAllByText('Org update rejected')).toHaveLength(1);

      state.failTable = 'announcements';
      state.failErrorMessage = 'Org post rejected';
      await fireEvent.press(screen.getByTestId('org-new-post-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-post-title-input'),
        'Failing Org Post'
      );
      await fireEvent.changeText(
        screen.getByTestId('org-post-content-input'),
        'Should render inline post error.'
      );
      await fireEvent.press(screen.getByTestId('org-post-publish-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-post-error').props.children).toBe(
          'Org post rejected'
        );
      });
      expect(screen.queryByTestId('hub-error-banner')).toBeNull();
      expect(screen.getAllByText('Org post rejected')).toHaveLength(1);
    });

    it('loads uncapped per-org announcements in OrgDetailView, refreshes on hub Refresh, and prepends new org posts', async () => {
      const bulkGlobal: Announcement[] = Array.from(
        { length: 105 },
        (_, index) => ({
          id: `66666666-6666-4666-8666-${String(index + 1).padStart(12, '0')}`,
          organization_id: null,
          title: `Bulk Notice ${index + 1}`,
          content: 'Global department update.',
          global_visibility: true,
          published_at: new Date(
            Date.parse('2026-11-27T11:00:00.000Z') - index * 60_000
          ).toISOString(),
          expires_at: null,
          deleted_at: null,
        })
      );
      const deepOrgPost: Announcement = {
        id: '66666666-6666-4666-8666-999999999901',
        organization_id: ORG_A_ID,
        title: 'Founding Council Charter',
        content: 'Older org announcement outside the hub feed 100-item cap.',
        global_visibility: false,
        published_at: '2026-10-01T08:00:00.000Z',
        expires_at: null,
        deleted_at: null,
      };
      const refreshedOrgPost: Announcement = {
        id: '66666666-6666-4666-8666-999999999902',
        organization_id: ORG_A_ID,
        title: 'Refreshed Org Post',
        content: 'Added on server before Refresh press.',
        global_visibility: false,
        published_at: '2026-10-05T08:00:00.000Z',
        expires_at: null,
        deleted_at: null,
      };

      const { client, state, spies } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: [...bulkGlobal, deepOrgPost],
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(
          screen.getByTestId(`announcement-item-${bulkGlobal[0].id}`)
        ).toBeTruthy();
      });
      expect(
        screen.queryByTestId(`announcement-item-${deepOrgPost.id}`)
      ).toBeNull();

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      await waitFor(() => {
        expect(
          screen.getByTestId(`org-post-item-${deepOrgPost.id}`)
        ).toBeTruthy();
      });
      expect(spies.fetchOrgAnnouncements).toHaveBeenCalledWith(ORG_A_ID);

      state.announcements = [...state.announcements, refreshedOrgPost];
      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(
          screen.getByTestId(`org-post-item-${refreshedOrgPost.id}`)
        ).toBeTruthy();
      });
      expect(
        screen.getByTestId(`org-post-item-${deepOrgPost.id}`)
      ).toBeTruthy();

      await fireEvent.press(screen.getByTestId('org-new-post-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-post-title-input'),
        'Live Org Notice'
      );
      await fireEvent.changeText(
        screen.getByTestId('org-post-content-input'),
        'Appears immediately in org posts.'
      );
      await fireEvent.press(screen.getByTestId('org-post-publish-button'));
      await waitFor(() => {
        expect(screen.getByTestId(`org-post-item-${ANN_NEW_ID}`)).toBeTruthy();
      });
      expect(
        screen.getByTestId(`org-post-item-${deepOrgPost.id}`)
      ).toBeTruthy();

      const pendingOrgPosts = createDeferred<DeptOrgQueryResult<Announcement[]>>();
      const loadingMock = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships: [],
        announcements: bulkGlobal,
        onFetchOrgAnnouncements: () => pendingOrgPosts.promise,
      });

      const loadingScreen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: loadingMock.client,
          now: NOW,
        })
      );
      await waitFor(() => {
        expect(
          loadingScreen.getByTestId(`announcement-item-${bulkGlobal[0].id}`)
        ).toBeTruthy();
      });

      await fireEvent.press(loadingScreen.getByTestId('tab-orgs'));
      await fireEvent.press(loadingScreen.getByTestId(`org-row-${ORG_A_ID}`));
      expect(loadingScreen.getByTestId('org-posts-loading')).toBeTruthy();
      expect(loadingScreen.queryByTestId('org-posts-empty')).toBeNull();

      await act(async () => {
        pendingOrgPosts.resolve({
          data: null,
          error: { message: 'Org posts query timed out' },
        });
      });
      await waitFor(() => {
        expect(loadingScreen.getByTestId('org-posts-error').props.children).toBe(
          'Org posts query timed out'
        );
      });
      expect(loadingScreen.queryByTestId('org-posts-empty')).toBeNull();

      loadingMock.state.onFetchOrgAnnouncements = undefined;
      loadingMock.state.announcements = [...bulkGlobal, deepOrgPost];
      await fireEvent.press(loadingScreen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(
          loadingScreen.getByTestId(`org-post-item-${deepOrgPost.id}`)
        ).toBeTruthy();
      });
      expect(loadingScreen.queryByTestId('org-posts-error')).toBeNull();
    });

    it('updates organization cover_url in MyCcsHubScreen even when navigating back to org directory mid-upload', async () => {
      const uploadDeferred = createDeferred<CompressImageResponse>();
      const onUploadOrgMedia = jest.fn(() => uploadDeferred.promise);
      const { client, spies } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A, SAMPLE_ORG_B],
        memberships: [
          {
            id: '99999999-9999-4999-8999-999999999996',
            profile_id: OFFICER_ID,
            organization_id: ORG_A_ID,
            role: 'officer',
            status: 'approved',
            submission_id: null,
            created_at: '2026-10-01T00:00:00.000Z',
          },
        ],
        announcements: [],
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: OFFICER_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          onUploadOrgMedia,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('announcements-empty')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      await fireEvent.press(screen.getByTestId('org-customize-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-cover-uri-input'),
        'file:///tmp/in-flight-cover.jpg'
      );
      await fireEvent.press(screen.getByTestId('org-upload-cover-button'));

      await fireEvent.press(screen.getByTestId('org-detail-back-button'));
      expect(screen.getByTestId('org-directory-view')).toBeTruthy();

      const path = `orgs/${ORG_A_ID}/cover/77777777-7777-4777-8777-777777777799.webp`;
      const uploadedCoverUrl = `https://myccs.supabase.co/storage/v1/object/public/${MEDIA_STORAGE_BUCKET}/${path}`;
      await act(async () => {
        uploadDeferred.resolve({
          bucket: MEDIA_STORAGE_BUCKET,
          path,
          publicUrl: uploadedCoverUrl,
          mimeType: OUTPUT_IMAGE_MIME_TYPE,
          sizeBytes: 24000,
          width: 1600,
          height: 900,
          exifStripped: true,
        });
      });

      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      await waitFor(() => {
        expect(
          screen.getByTestId('org-detail-cover-image').props.source
        ).toEqual({ uri: uploadedCoverUrl });
      });
      expect(spies.updateOrg).not.toHaveBeenCalled();
    });

    it('preserves non-string contact_json office/email on unrelated edits and allows explicit replacement or removal', async () => {
      const adminActor: RbacActor = {
        profileId: ADMIN_ID,
        role: 'admin',
        memberships: [],
      };
      const nonStringDept: DepartmentInfo = {
        ...SAMPLE_DEPT,
        contact_json: {
          office: ['Room 301', 'Room 302'],
          email: { primary: 'ccs@lpunetwork.edu.ph' },
          hotline: '464-1234',
        },
      };
      const onSave = jest.fn().mockResolvedValue(undefined);

      const view = await render(
        createElement(DepartmentAboutView, {
          departmentInfo: nonStringDept,
          actor: adminActor,
          mode: 'edit',
          onEnterEdit: jest.fn(),
          onCancelEdit: jest.fn(),
          onCreate: jest.fn(),
          onSave,
        })
      );

      await fireEvent.changeText(
        view.getByTestId('dept-edit-title-input'),
        'CCS Updated Title'
      );
      await fireEvent.press(view.getByTestId('dept-save-button'));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
      expect(onSave).toHaveBeenLastCalledWith(DEPT_ID, {
        title: 'CCS Updated Title',
      });

      await fireEvent.changeText(
        view.getByTestId('dept-edit-office-input'),
        'CCS Room 405'
      );
      await fireEvent.press(view.getByTestId('dept-save-button'));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(2);
      });
      expect(onSave).toHaveBeenLastCalledWith(
        DEPT_ID,
        expect.objectContaining({
          contact_json: {
            office: 'CCS Room 405',
            email: { primary: 'ccs@lpunetwork.edu.ph' },
            hotline: '464-1234',
          },
        })
      );

      await fireEvent.changeText(
        view.getByTestId('dept-edit-office-input'),
        '   '
      );
      await fireEvent.changeText(
        view.getByTestId('dept-edit-email-input'),
        ''
      );
      await fireEvent.press(view.getByTestId('dept-save-button'));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(3);
      });
      expect(onSave).toHaveBeenLastCalledWith(
        DEPT_ID,
        expect.objectContaining({
          contact_json: {
            hotline: '464-1234',
          },
        })
      );
    });

    it('submits only edited department fields after background refresh so newer server title and contacts are preserved', async () => {
      const { client, state, spies } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [],
        memberships: [],
        announcements: [],
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: ADMIN_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('announcements-empty')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('tab-department'));
      await fireEvent.press(screen.getByTestId('dept-edit-button'));
      expect(screen.getByTestId('department-edit-form')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('dept-save-button'));
      expect(screen.getByTestId('dept-form-error').props.children).toMatch(
        /At least one department_info field/
      );
      expect(spies.updateDepartment).not.toHaveBeenCalled();

      await fireEvent.changeText(
        screen.getByTestId('dept-edit-office-input'),
        'CCS Innovation Wing 5F'
      );

      state.departmentInfo = {
        ...SAMPLE_DEPT,
        title: 'CCS — Refreshed Server Title',
        contact_json: {
          ...SAMPLE_DEPT.contact_json,
          email: 'updated-ccs@lpunetwork.edu.ph',
          hotline: '464-9999',
        },
        updated_at: '2026-11-27T13:15:00.000Z',
      };

      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeTruthy();
      });
      expect(screen.getByTestId('department-edit-form')).toBeTruthy();
      expect(screen.getByTestId('dept-edit-office-input').props.value).toBe(
        'CCS Innovation Wing 5F'
      );

      await fireEvent.press(screen.getByTestId('dept-save-button'));
      await waitFor(() => {
        expect(screen.getByTestId('department-about-view')).toBeTruthy();
      });

      expect(spies.updateDepartment).toHaveBeenCalledTimes(1);
      expect(spies.updateDepartment).toHaveBeenCalledWith(DEPT_ID, {
        contact_json: {
          office: 'CCS Innovation Wing 5F',
          email: 'updated-ccs@lpunetwork.edu.ph',
          office_hours: 'Mon-Fri 8:00 AM - 5:00 PM',
          hotline: '464-9999',
        },
      });
      expect(state.departmentInfo?.title).toBe('CCS — Refreshed Server Title');
      expect(screen.getByTestId('department-title').props.children).toBe(
        'CCS — Refreshed Server Title'
      );
      expect(screen.getByText('CCS Innovation Wing 5F')).toBeTruthy();
      expect(screen.getByText('updated-ccs@lpunetwork.edu.ph')).toBeTruthy();
      expect(screen.getByText('464-9999')).toBeTruthy();
    });

    it('preserves newly published org posts across pending initial history load and preserves org mutations across in-flight hub refresh', async () => {
      const olderHistoryPost: Announcement = {
        id: '66666666-6666-4666-8666-999999999950',
        organization_id: ORG_A_ID,
        title: 'Earlier Org History Post',
        content: 'Returned by the initial history fetch after publish.',
        global_visibility: false,
        published_at: '2026-10-15T08:00:00.000Z',
        expires_at: null,
        deleted_at: null,
      };
      const pendingOrgHistory = createDeferred<
        DeptOrgQueryResult<Announcement[]> | undefined
      >();

      const memberships: OrgMembership[] = [
        {
          id: '99999999-9999-4999-8999-999999999998',
          profile_id: OFFICER_ID,
          organization_id: ORG_A_ID,
          role: 'officer',
          status: 'approved',
          submission_id: null,
          created_at: '2026-10-01T00:00:00.000Z',
        },
      ];

      const { client, state } = createMockDeptOrgClient({
        departmentInfo: SAMPLE_DEPT,
        organizations: [SAMPLE_ORG_A],
        memberships,
        announcements: [],
        onFetchOrgAnnouncements: () => pendingOrgHistory.promise,
      });

      const uploadedCoverPath = `orgs/${ORG_A_ID}/cover/77777777-7777-4777-8777-777777777755.webp`;
      const uploadedCoverUrl = `https://myccs.supabase.co/storage/v1/object/public/${MEDIA_STORAGE_BUCKET}/${uploadedCoverPath}`;
      const onUploadOrgMedia = jest.fn(
        async (
          orgId: string,
          kind: 'logo' | 'cover',
          _localUri: string
        ): Promise<CompressImageResponse> => {
          state.organizations = state.organizations.map((org) =>
            org.id === orgId
              ? {
                  ...org,
                  ...(kind === 'cover'
                    ? { cover_url: uploadedCoverUrl }
                    : { logo_url: uploadedCoverUrl }),
                }
              : org
          );
          return {
            bucket: MEDIA_STORAGE_BUCKET,
            path: uploadedCoverPath,
            publicUrl: uploadedCoverUrl,
            mimeType: OUTPUT_IMAGE_MIME_TYPE,
            sizeBytes: 21000,
            width: 1600,
            height: 900,
            exifStripped: true,
          };
        }
      );

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: OFFICER_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: client,
          onUploadOrgMedia,
          now: NOW,
        })
      );

      await waitFor(() => {
        expect(screen.getByTestId('announcements-empty')).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('tab-orgs'));
      await fireEvent.press(screen.getByTestId(`org-row-${ORG_A_ID}`));
      expect(screen.getByTestId('org-posts-loading')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('org-new-post-button'));
      await fireEvent.changeText(
        screen.getByTestId('org-post-title-input'),
        'Published Before Initial History'
      );
      await fireEvent.changeText(
        screen.getByTestId('org-post-content-input'),
        'Created before the first history response arrived.'
      );
      await fireEvent.press(screen.getByTestId('org-post-publish-button'));

      await waitFor(() => {
        expect(screen.getByTestId(`org-post-item-${ANN_NEW_ID}`)).toBeTruthy();
      });

      await act(async () => {
        pendingOrgHistory.resolve({
          data: [olderHistoryPost],
          error: null,
        });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId(`org-post-item-${olderHistoryPost.id}`)
        ).toBeTruthy();
      });
      expect(screen.getByTestId(`org-post-item-${ANN_NEW_ID}`)).toBeTruthy();

      state.onFetchOrgAnnouncements = undefined;
      await fireEvent.press(screen.getByTestId('org-customize-button'));
      expect(screen.getByTestId('org-edit-panel')).toBeTruthy();

      const uploadRefreshDeferred =
        createDeferred<DeptOrgQueryResult<Announcement[]>>();
      state.onFetchAnnouncements = () => uploadRefreshDeferred.promise;

      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      expect(screen.getByText('Refreshing...')).toBeTruthy();
      expect(screen.getByTestId('org-edit-panel')).toBeTruthy();

      await fireEvent.changeText(
        screen.getByTestId('org-cover-uri-input'),
        'file:///tmp/race-cover.jpg'
      );
      await fireEvent.press(screen.getByTestId('org-upload-cover-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-media-status').props.children).toMatch(
          /Cover image compressed/
        );
      });
      expect(screen.getByTestId('org-detail-cover-image').props.source).toEqual({
        uri: uploadedCoverUrl,
      });

      await act(async () => {
        uploadRefreshDeferred.resolve({ data: [], error: null });
      });
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeTruthy();
      });
      expect(screen.getByTestId('org-detail-cover-image').props.source).toEqual({
        uri: uploadedCoverUrl,
      });

      const detailsRefreshDeferred =
        createDeferred<DeptOrgQueryResult<Announcement[]>>();
      state.onFetchAnnouncements = () => detailsRefreshDeferred.promise;

      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      expect(screen.getByText('Refreshing...')).toBeTruthy();
      expect(screen.getByTestId('org-edit-panel')).toBeTruthy();

      await fireEvent.changeText(
        screen.getByTestId('org-edit-details-input'),
        'Updated org bio while refresh in flight.'
      );
      await fireEvent.press(screen.getByTestId('org-edit-save-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-detail-about').props.children).toBe(
          'Updated org bio while refresh in flight.'
        );
      });

      await act(async () => {
        detailsRefreshDeferred.resolve({ data: [], error: null });
      });
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeTruthy();
      });

      expect(screen.getByTestId('org-detail-cover-image').props.source).toEqual({
        uri: uploadedCoverUrl,
      });
      expect(screen.getByTestId('org-detail-about').props.children).toBe(
        'Updated org bio while refresh in flight.'
      );

      state.onFetchAnnouncements = undefined;
      state.organizations = state.organizations.map((org) =>
        org.id === ORG_A_ID
          ? { ...org, details: 'Subsequent Server Org Bio' }
          : org
      );
      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(screen.getByTestId('org-detail-about').props.children).toBe(
          'Subsequent Server Org Bio'
        );
      });
    });
  });
});
