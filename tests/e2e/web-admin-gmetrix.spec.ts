import { expect, test, type Page } from '@playwright/test';

declare const require: (id: string) => unknown;

const { readFile } = require('node:fs/promises') as {
  readFile(filePath: string, encoding: 'utf-8'): Promise<string>;
};
const { Buffer: NodeBuffer } = require('node:buffer') as {
  Buffer: {
    from(input: string, encoding: 'utf-8'): Uint8Array;
  };
};

const SUPABASE_TEST_ORIGIN = 'https://e2e.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_e2e_synthetic_key';
const SUPABASE_STORAGE_KEY = 'sb-e2e-auth-token';

const ADMIN_PERSONA = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'dean.ccs@lpunetwork.edu.ph',
  fullName: 'Dr. Elena Reyes',
  role: 'admin' as const,
  qrToken: 'v1.33333333-3333-4333-8333-333333333333.0123456789abcdef01234567',
};

const CERT_COMPTIA_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CERT_CISCO_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const CERT_CREATED_ID = 'cccccccc-3333-4333-8333-333333333333';
const BATCH_PRIOR_ID = 'dddddddd-4444-4444-8444-444444444444';
const BATCH_IMPORTED_ID = 'eeeeeeee-5555-4555-8555-555555555555';
const FACULTY_NEW_ID = 'ffffffff-6666-4666-8666-666666666666';

const RAW_KEYS = [
  'GMX-VALID-9999-SECRET',
  'GMX-UNREG-8888-SECRET',
  'GMX-DUP-7777-SECRET',
  'GMX-FORM-6666-SECRET',
] as const;

interface MockCertification {
  id: string;
  title: string;
  provider: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface MockBatch {
  id: string;
  certification_id: string;
  uploaded_by_admin_id: string;
  total_rows: number;
  assigned_count: number;
  rejected_count: number;
  created_at: string;
}

interface MockAdminEntry {
  id: string;
  email: string;
  fullName: string;
  role: 'admin';
  createdAt: string;
}

interface CapturedImportRequest {
  authorization: string | null;
  apikey: string | null;
  contentType: string | null;
  bodyText: string;
}

interface MockGMetrixOptions {
  importStatus?: number;
  importErrorMessage?: string;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createSyntheticAccessToken(): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: 'authenticated',
      exp: nowSec + 3600,
      iat: nowSec,
      sub: ADMIN_PERSONA.id,
      email: ADMIN_PERSONA.email,
      role: 'authenticated',
    })
  );
  return `${header}.${payload}.synthetic-e2e-signature`;
}

function createSyntheticSessionPayload(accessToken: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSec + 3600,
    refresh_token: 'synthetic-e2e-refresh-token',
    user: {
      id: ADMIN_PERSONA.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: ADMIN_PERSONA.email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: ADMIN_PERSONA.fullName },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };
}

async function setupGMetrixRoutes(page: Page, options: MockGMetrixOptions = {}) {
  const accessToken = createSyntheticAccessToken();

  const certifications: MockCertification[] = [
    {
      id: CERT_CISCO_ID,
      title: 'CCNA Routing & Switching',
      provider: 'Cisco',
      description: 'Networking fundamentals track',
      is_active: true,
      created_at: '2026-11-01T08:00:00Z',
    },
    {
      id: CERT_COMPTIA_ID,
      title: 'IT Fundamentals (ITF+)',
      provider: 'CompTIA',
      description: 'Foundational IT certification',
      is_active: true,
      created_at: '2026-11-02T08:00:00Z',
    },
  ];

  const batches: MockBatch[] = [
    {
      id: BATCH_PRIOR_ID,
      certification_id: CERT_COMPTIA_ID,
      uploaded_by_admin_id: ADMIN_PERSONA.id,
      total_rows: 12,
      assigned_count: 10,
      rejected_count: 2,
      created_at: '2026-11-20T09:30:00Z',
    },
  ];

  const admins: MockAdminEntry[] = [
    {
      id: ADMIN_PERSONA.id,
      email: ADMIN_PERSONA.email,
      fullName: ADMIN_PERSONA.fullName,
      role: 'admin',
      createdAt: '2026-10-01T08:00:00Z',
    },
  ];

  const state = {
    accessToken,
    createdCertificationBodies: [] as Array<Record<string, unknown>>,
    importRequests: [] as CapturedImportRequest[],
    promotePayloads: [] as Array<Record<string, unknown>>,
    listAdminsCalls: 0,
  };

  await page.route(`${SUPABASE_TEST_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createSyntheticSessionPayload(accessToken)),
      });
      return;
    }

    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ADMIN_PERSONA.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: ADMIN_PERSONA.email,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/get_my_profile' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ADMIN_PERSONA.id,
          email: ADMIN_PERSONA.email,
          fullName: ADMIN_PERSONA.fullName,
          role: ADMIN_PERSONA.role,
          qrToken: ADMIN_PERSONA.qrToken,
          keyVersion: 1,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/certifications' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(certifications),
      });
      return;
    }

    if (url.pathname === '/rest/v1/certifications' && method === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.createdCertificationBodies.push(body);
      const created: MockCertification = {
        id: CERT_CREATED_ID,
        title: String(body.title ?? ''),
        provider: String(body.provider ?? ''),
        description: String(body.description ?? ''),
        is_active: body.is_active !== false,
        created_at: '2026-11-28T06:00:00Z',
      };
      certifications.push(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
      return;
    }

    if (url.pathname === '/rest/v1/certification_key_batches' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(batches),
      });
      return;
    }

    if (url.pathname === '/functions/v1/import-gmetrix-keys' && method === 'POST') {
      const headers = request.headers();
      const rawBuffer = request.postDataBuffer();
      state.importRequests.push({
        authorization: headers['authorization'] ?? null,
        apikey: headers['apikey'] ?? null,
        contentType: headers['content-type'] ?? null,
        bodyText: rawBuffer ? rawBuffer.toString('utf-8') : (request.postData() ?? ''),
      });

      if (options.importStatus && options.importStatus >= 400) {
        await route.fulfill({
          status: options.importStatus,
          contentType: 'application/json',
          body: JSON.stringify({
            error: options.importErrorMessage ?? 'Certification batch import rejected.',
          }),
        });
        return;
      }

      const rejectedRows = [
        {
          rowNumber: 3,
          email: 'unregistered@lpunetwork.edu.ph',
          reason: 'unregistered_student',
        },
        {
          rowNumber: 4,
          email: 'maria.student@lpunetwork.edu.ph',
          reason: 'duplicate_key_existing',
        },
        {
          rowNumber: 5,
          email: '=HYPERLINK("https://evil.example","Click")@lpunetwork.edu.ph',
          reason: 'invalid_email',
        },
      ];

      const rejectedRowsCsv = [
        'row_number,email,reason',
        '3,unregistered@lpunetwork.edu.ph,unregistered_student',
        '4,maria.student@lpunetwork.edu.ph,duplicate_key_existing',
        '5,"\'=HYPERLINK(""https://evil.example"",""Click"")@lpunetwork.edu.ph",invalid_email',
      ].join('\n');

      batches.unshift({
        id: BATCH_IMPORTED_ID,
        certification_id: CERT_CISCO_ID,
        uploaded_by_admin_id: ADMIN_PERSONA.id,
        total_rows: 4,
        assigned_count: 1,
        rejected_count: 3,
        created_at: '2026-11-28T06:15:00Z',
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: BATCH_IMPORTED_ID,
          certificationId: CERT_CISCO_ID,
          totalRows: 4,
          assignedCount: 1,
          rejectedCount: 3,
          pushNotificationsSent: 1,
          pushNotificationsFailed: 0,
          rejectedRows,
          rejectedRowsCsv,
        }),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/list_admin_profiles' && method === 'POST') {
      state.listAdminsCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(admins),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/promote_faculty_by_email' && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.promotePayloads.push(payload);
      const email = String(payload.p_email ?? '').toLowerCase();

      if (email === 'prof.carlos@lpunetwork.edu.ph') {
        const alreadyAdmin = admins.some((entry) => entry.email === email);
        if (!alreadyAdmin) {
          admins.push({
            id: FACULTY_NEW_ID,
            email,
            fullName: 'Prof. Carlos Mendoza',
            role: 'admin',
            createdAt: '2026-11-28T06:20:00Z',
          });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: FACULTY_NEW_ID,
            email,
            fullName: 'Prof. Carlos Mendoza',
            role: 'admin',
            alreadyAdmin,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Target institutional profile not found' }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled test route: ${url.pathname}` }),
    });
  });

  return state;
}

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Institutional Email').fill(ADMIN_PERSONA.email);
  await page.getByLabel('Password').fill('AdminPass123!');
  await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: `Welcome, ${ADMIN_PERSONA.fullName}` })
  ).toBeVisible();
}

test.describe('MyCCS Web Admin GMetrix CSV distribution & faculty promotion', () => {
  test('loads certifications and recent batches, then creates and selects a new certification', async ({
    page,
  }) => {
    const state = await setupGMetrixRoutes(page);
    await signInAsAdmin(page);

    const certSelect = page.getByLabel('Certification Program');
    await expect(certSelect).toHaveValue(CERT_CISCO_ID);
    await expect(certSelect).toContainText('Cisco — CCNA Routing & Switching');
    await expect(certSelect).toContainText('CompTIA — IT Fundamentals (ITF+)');

    const batchesTable = page.getByRole('table', { name: 'Recent GMetrix import batches' });
    await expect(batchesTable).toContainText('CompTIA — IT Fundamentals (ITF+)');
    await expect(batchesTable).toContainText('12');
    await expect(batchesTable).toContainText('10');

    await page.getByRole('button', { name: 'Add Certification' }).click();
    await page.getByLabel('Title').fill('Microsoft Office Specialist — Excel');
    await page.getByLabel('Provider').fill('Certiport');
    await page.getByLabel('Description').fill('Spreadsheet certification exam voucher track');
    await page.getByRole('button', { name: 'Save Certification' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Certiport — Microsoft Office Specialist — Excel'
    );
    await expect(certSelect).toHaveValue(CERT_CREATED_ID);
    expect(state.createdCertificationBodies).toEqual([
      {
        title: 'Microsoft Office Specialist — Excel',
        provider: 'Certiport',
        description: 'Spreadsheet certification exam voucher track',
        is_active: true,
      },
    ]);
  });

  test('uploads mixed CSV with multipart auth headers, renders summary and manual fallback, and downloads formula-safe rejected CSV with zero raw keys', async ({
    page,
  }) => {
    const state = await setupGMetrixRoutes(page);
    await signInAsAdmin(page);

    const csvContent = [
      'email,key_code',
      `juan.student@lpunetwork.edu.ph,${RAW_KEYS[0]}`,
      `unregistered@lpunetwork.edu.ph,${RAW_KEYS[1]}`,
      `maria.student@lpunetwork.edu.ph,${RAW_KEYS[2]}`,
      `"=HYPERLINK(""https://evil.example"",""Click"")@lpunetwork.edu.ph",${RAW_KEYS[3]}`,
    ].join('\n');

    const fileInput = page.getByLabel('GMetrix CSV File');
    await fileInput.setInputFiles({
      name: 'gmetrix-batch-spring.csv',
      mimeType: 'text/csv',
      buffer: NodeBuffer.from(csvContent, 'utf-8') as never,
    });

    await expect(page.getByText('gmetrix-batch-spring.csv')).toBeVisible();
    await expect(page.getByText('4 data rows detected')).toBeVisible();

    await page.getByRole('button', { name: 'Upload & Distribute Keys' }).click();

    await expect(page.getByTestId('metric-total-rows')).toHaveText('4');
    await expect(page.getByTestId('metric-assigned-count')).toHaveText('1');
    await expect(page.getByTestId('metric-rejected-count')).toHaveText('3');
    await expect(page.getByTestId('metric-push-sent')).toHaveText('1');
    await expect(fileInput).toHaveValue('');
    await expect(page.getByText('4 data rows detected')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Upload & Distribute Keys' })).toBeDisabled();

    expect(state.importRequests).toHaveLength(1);
    const captured = state.importRequests[0];
    expect(captured.authorization).toBe(`Bearer ${state.accessToken}`);
    expect(captured.apikey).toBe(SUPABASE_PUBLISHABLE_KEY);
    expect(captured.contentType).toContain('multipart/form-data');
    expect(captured.bodyText).toContain('name="certification_id"');
    expect(captured.bodyText).toContain(CERT_CISCO_ID);
    expect(captured.bodyText).toContain('name="file"');
    expect(captured.bodyText).toContain('gmetrix-batch-spring.csv');

    await expect(page.getByText('Manual Distribution Required for Rejected Rows')).toBeVisible();
    await expect(page.getByText(/MS Teams/i)).toBeVisible();
    await expect(page.getByText(/@lpunetwork\.edu\.ph/i).first()).toBeVisible();

    const rejectedTable = page.getByRole('table', { name: 'Rejected CSV rows' });
    await expect(rejectedTable).toContainText('unregistered@lpunetwork.edu.ph');
    await expect(rejectedTable).toContainText('Student not registered');
    await expect(rejectedTable).toContainText('maria.student@lpunetwork.edu.ph');
    await expect(rejectedTable).toContainText('Key already assigned');
    await expect(rejectedTable).toContainText('Invalid @lpunetwork.edu.ph email');

    const bodyText = await page.locator('body').innerText();
    for (const rawKey of RAW_KEYS) {
      expect(bodyText).not.toContain(rawKey);
    }

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Rejected Rows CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`gmetrix-rejected-rows-${BATCH_IMPORTED_ID.slice(0, 8)}.csv`);
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const downloadedCsv = await readFile(downloadedPath!, 'utf-8');

    expect(downloadedCsv.startsWith('row_number,email,reason\n')).toBe(true);
    expect(downloadedCsv).toContain('3,unregistered@lpunetwork.edu.ph,unregistered_student');
    expect(downloadedCsv).toContain('4,maria.student@lpunetwork.edu.ph,duplicate_key_existing');
    expect(downloadedCsv).toContain("'=HYPERLINK(");
    for (const rawKey of RAW_KEYS) {
      expect(downloadedCsv).not.toContain(rawKey);
    }

    await fileInput.setInputFiles({
      name: 'gmetrix-batch-spring.csv',
      mimeType: 'text/csv',
      buffer: NodeBuffer.from(
        'email,key_code\njuan.student@lpunetwork.edu.ph,GMX-RESELECT-1111\n',
        'utf-8'
      ) as never,
    });
    await expect(page.getByText('1 data row detected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload & Distribute Keys' })).toBeEnabled();

    await fileInput.setInputFiles({
      name: 'bad-header.csv',
      mimeType: 'text/csv',
      buffer: NodeBuffer.from('student_name,voucher\nJuan,ABC-123\n', 'utf-8') as never,
    });
    await expect(page.getByText('1 data row detected')).toBeHidden();
    await expect(page.getByRole('alert')).toContainText('email and key_code');
    await expect(page.getByRole('button', { name: 'Upload & Distribute Keys' })).toBeDisabled();
  });

  test('lists active admins without student_id, blocks non-institutional promotion client-side, and promotes verified faculty', async ({
    page,
  }) => {
    const state = await setupGMetrixRoutes(page);
    await signInAsAdmin(page);

    await page.getByRole('tab', { name: 'Faculty Admins' }).click();

    const adminTable = page.getByRole('table', { name: 'Active CCS Department Admins' });
    await expect(adminTable).toContainText(ADMIN_PERSONA.fullName);
    await expect(adminTable).toContainText(ADMIN_PERSONA.email);
    await expect(adminTable.getByText('admin', { exact: true })).toBeVisible();

    const initialBody = await page.locator('body').innerText();
    expect(initialBody).not.toContain('student_id');
    expect(initialBody).not.toContain(ADMIN_PERSONA.qrToken);

    await page.getByLabel('Faculty Institutional Email').fill('external.faculty@gmail.com');
    await page.getByRole('button', { name: 'Promote to Admin' }).click();
    await expect(page.getByRole('alert')).toContainText('@lpunetwork.edu.ph');
    expect(state.promotePayloads).toHaveLength(0);

    await page.getByLabel('Faculty Institutional Email').fill('  PROF.CARLOS@LPUNETWORK.EDU.PH ');
    await page.getByRole('button', { name: 'Promote to Admin' }).click();

    await expect(page.getByRole('status')).toContainText('Promoted Prof. Carlos Mendoza');
    expect(state.promotePayloads).toEqual([{ p_email: 'prof.carlos@lpunetwork.edu.ph' }]);
    await expect(adminTable).toContainText('Prof. Carlos Mendoza');
    await expect(adminTable).toContainText('prof.carlos@lpunetwork.edu.ph');

    const refreshedBody = await page.locator('body').innerText();
    expect(refreshedBody).not.toContain('student_id');
    expect(refreshedBody).not.toContain(ADMIN_PERSONA.qrToken);
  });

  test('surfaces server errors from import-gmetrix-keys without clearing the admin session', async ({
    page,
  }) => {
    await setupGMetrixRoutes(page, {
      importStatus: 400,
      importErrorMessage: 'Certification is inactive and cannot accept new key batches.',
    });
    await signInAsAdmin(page);

    await page.getByLabel('GMetrix CSV File').setInputFiles({
      name: 'inactive-cert.csv',
      mimeType: 'text/csv',
      buffer: NodeBuffer.from(
        `email,key_code\njuan.student@lpunetwork.edu.ph,${RAW_KEYS[0]}\n`,
        'utf-8'
      ) as never,
    });

    await page.getByRole('button', { name: 'Upload & Distribute Keys' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Certification is inactive and cannot accept new key batches.'
    );
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: `Welcome, ${ADMIN_PERSONA.fullName}` })
    ).toBeVisible();

    const storageKeys = await page.evaluate(() => Object.keys(window.sessionStorage));
    expect(storageKeys).toContain(SUPABASE_STORAGE_KEY);
  });

  test('preserves import report and rejected-row download across workspace tab switches and moves keyboard focus on Arrow keys', async ({
    page,
  }) => {
    await setupGMetrixRoutes(page);
    await signInAsAdmin(page);

    const gmetrixTab = page.getByRole('tab', { name: 'GMetrix Keys' });
    const facultyTab = page.getByRole('tab', { name: 'Faculty Admins' });

    const csvContent = [
      'email,key_code',
      `juan.student@lpunetwork.edu.ph,${RAW_KEYS[0]}`,
      `unregistered@lpunetwork.edu.ph,${RAW_KEYS[1]}`,
    ].join('\n');

    await page.getByLabel('GMetrix CSV File').setInputFiles({
      name: 'switch-tab-batch.csv',
      mimeType: 'text/csv',
      buffer: NodeBuffer.from(csvContent, 'utf-8') as never,
    });
    await page.getByRole('button', { name: 'Upload & Distribute Keys' }).click();
    await expect(page.getByTestId('metric-assigned-count')).toHaveText('1');
    await expect(page.getByTestId('metric-rejected-count')).toHaveText('3');

    await gmetrixTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(facultyTab).toHaveAttribute('aria-selected', 'true');
    await expect(facultyTab).toBeFocused();
    await expect(page.getByRole('table', { name: 'Active CCS Department Admins' })).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(gmetrixTab).toHaveAttribute('aria-selected', 'true');
    await expect(gmetrixTab).toBeFocused();

    await expect(page.getByTestId('metric-assigned-count')).toHaveText('1');
    await expect(page.getByTestId('metric-rejected-count')).toHaveText('3');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Rejected Rows CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      `gmetrix-rejected-rows-${BATCH_IMPORTED_ID.slice(0, 8)}.csv`
    );
  });
});
