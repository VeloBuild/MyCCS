import { expect, test, type Page } from '@playwright/test';

// shortcut: Playwright smoke test mocks Supabase Auth and get_my_profile RPC via page.route for deterministic CI runs without live credentials; upgrade in spec-08 to run an optional staging-backed E2E smoke check before v1.0.0 cutover.

const SUPABASE_TEST_ORIGIN = 'https://e2e.supabase.test';
const SUPABASE_STORAGE_KEY = 'sb-e2e-auth-token';
const STUDENT_ID_SENTINEL = '2026-0001-PRIVATE';

interface MockPersona {
  id: string;
  email: string;
  fullName: string;
  role: 'student' | 'officer' | 'admin';
  qrToken: string;
}

interface MockRouteOptions {
  persona?: MockPersona;
  profileStatus?: number;
  profileNull?: boolean;
  logoutStatus?: number;
}

interface MockCounters {
  tokenRequests: number;
  logoutRequests: number;
  logoutScopes: Array<string | null>;
  profileRequests: number;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createSyntheticAccessToken(persona: MockPersona): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: 'authenticated',
      exp: nowSec + 3600,
      iat: nowSec,
      sub: persona.id,
      email: persona.email,
      role: 'authenticated',
    })
  );
  return `${header}.${payload}.synthetic-e2e-signature`;
}

function createSyntheticSessionPayload(persona: MockPersona) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: createSyntheticAccessToken(persona),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSec + 3600,
    refresh_token: 'synthetic-e2e-refresh-token',
    user: {
      id: persona.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: persona.email,
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: persona.fullName },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };
}

async function readSessionStorageKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(window.sessionStorage));
}

async function setupSupabaseRoutes(
  page: Page,
  options: MockRouteOptions = {}
): Promise<MockCounters> {
  const { persona, profileStatus = 200, profileNull = false, logoutStatus = 204 } = options;
  const counters: MockCounters = {
    tokenRequests: 0,
    logoutRequests: 0,
    logoutScopes: [],
    profileRequests: 0,
  };

  await page.route(`${SUPABASE_TEST_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/auth/v1/token' && request.method() === 'POST') {
      counters.tokenRequests += 1;
      if (!persona) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error_description: 'Invalid login credentials' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createSyntheticSessionPayload(persona)),
      });
      return;
    }

    if (url.pathname === '/rest/v1/rpc/get_my_profile' && request.method() === 'POST') {
      counters.profileRequests += 1;
      if (profileStatus !== 200) {
        await route.fulfill({
          status: profileStatus,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Database unavailable while reading profile' }),
        });
        return;
      }
      if (!persona || profileNull) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'null',
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: persona.id,
          email: persona.email,
          fullName: persona.fullName,
          role: persona.role,
          qrToken: persona.qrToken,
          keyVersion: 1,
        }),
      });
      return;
    }

    if (url.pathname === '/auth/v1/logout' && request.method() === 'POST') {
      counters.logoutRequests += 1;
      counters.logoutScopes.push(url.searchParams.get('scope'));
      if (logoutStatus === 204) {
        await route.fulfill({ status: 204, body: '' });
      } else {
        await route.fulfill({
          status: logoutStatus,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Upstream logout service error' }),
        });
      }
      return;
    }

    if (url.pathname === '/auth/v1/user' && request.method() === 'GET' && persona) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: persona.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: persona.email,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled test route: ${url.pathname}` }),
    });
  });

  return counters;
}

test.describe('MyCCS Web Admin role guard', () => {
  test('redirects unauthenticated access on / to /login and hides dashboard', async ({ page }) => {
    await setupSupabaseRoutes(page);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'MyCCS Web Admin' })).toBeVisible();
    await expect(page.getByLabel('Institutional Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in to Web Admin' })).toBeVisible();
    await expect(page.getByText('GMetrix Certification Keys')).toHaveCount(0);
  });

  test('blocks non-institutional emails client-side without calling /auth/v1/token', async ({
    page,
  }) => {
    const counters = await setupSupabaseRoutes(page);

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill('student@gmail.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page.getByRole('alert')).toContainText('@lpunetwork.edu.ph');
    expect(counters.tokenRequests).toBe(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows error alert on invalid institutional credentials', async ({ page }) => {
    const counters = await setupSupabaseRoutes(page);

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill('faculty@lpunetwork.edu.ph');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid login credentials');
    expect(counters.tokenRequests).toBe(1);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('blocks verified @lpunetwork.edu.ph student, clears local session even on 500 logout, and returns to /login', async ({
    page,
  }) => {
    const student: MockPersona = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'juan.student@lpunetwork.edu.ph',
      fullName: 'Juan Dela Cruz',
      role: 'student',
      qrToken: 'v1.11111111-1111-4111-8111-111111111111.0123456789abcdef01234567',
    };
    const counters = await setupSupabaseRoutes(page, { persona: student, logoutStatus: 500 });

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill(student.email);
    await page.getByLabel('Password').fill('StudentPass123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByRole('heading', { name: 'Admin Access Required' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('CCS Department Admins');
    await expect(page.getByText(student.email)).toBeVisible();
    await expect(page.getByText('student', { exact: true })).toBeVisible();
    expect(counters.logoutRequests).toBe(1);
    expect(counters.logoutScopes).toEqual(['local']);
    expect(await readSessionStorageKeys(page)).toEqual([]);

    await page.getByRole('button', { name: 'Return to Sign In' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in to Web Admin' })).toBeVisible();

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('blocks pre-seeded non-admin session restored on / and clears sessionStorage', async ({
    page,
  }) => {
    const student: MockPersona = {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'restored.student@lpunetwork.edu.ph',
      fullName: 'Restored Student',
      role: 'student',
      qrToken: 'v1.11111111-1111-4111-8111-111111111111.0123456789abcdef01234567',
    };
    const counters = await setupSupabaseRoutes(page, { persona: student });

    await page.addInitScript(
      ({ key, sessionJson }) => {
        window.sessionStorage.setItem(key, sessionJson);
      },
      {
        key: SUPABASE_STORAGE_KEY,
        sessionJson: JSON.stringify(createSyntheticSessionPayload(student)),
      }
    );

    await page.goto('/');
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByRole('heading', { name: 'Admin Access Required' })).toBeVisible();
    await expect(page.getByText(student.email)).toBeVisible();
    expect(counters.logoutRequests).toBe(1);
    expect(counters.logoutScopes).toEqual(['local']);
    expect(await readSessionStorageKeys(page)).toEqual([]);
  });

  test('blocks verified @lpunetwork.edu.ph officer and revokes local session', async ({ page }) => {
    const officer: MockPersona = {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'maria.officer@lpunetwork.edu.ph',
      fullName: 'Maria Santos',
      role: 'officer',
      qrToken: 'v1.22222222-2222-4222-8222-222222222222.0123456789abcdef01234567',
    };
    const counters = await setupSupabaseRoutes(page, { persona: officer });

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill(officer.email);
    await page.getByLabel('Password').fill('OfficerPass123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByRole('heading', { name: 'Admin Access Required' })).toBeVisible();
    await expect(page.getByText(officer.email)).toBeVisible();
    await expect(page.getByText('officer', { exact: true })).toBeVisible();
    expect(counters.logoutRequests).toBe(1);
    expect(await readSessionStorageKeys(page)).toEqual([]);
  });

  test('blocks unprovisioned account when get_my_profile returns null and clears sessionStorage', async ({
    page,
  }) => {
    const unprovisioned: MockPersona = {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'new.faculty@lpunetwork.edu.ph',
      fullName: 'New Faculty',
      role: 'student',
      qrToken: 'v1.44444444-4444-4444-8444-444444444444.0123456789abcdef01234567',
    };
    const counters = await setupSupabaseRoutes(page, {
      persona: unprovisioned,
      profileNull: true,
    });

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill(unprovisioned.email);
    await page.getByLabel('Password').fill('FacultyPass123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByText('unprovisioned', { exact: true })).toBeVisible();
    expect(counters.logoutRequests).toBe(1);
    expect(await readSessionStorageKeys(page)).toEqual([]);
  });

  test('returns to /login with readable error and clears session when get_my_profile fails with 500', async ({
    page,
  }) => {
    const admin: MockPersona = {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'dean.ccs@lpunetwork.edu.ph',
      fullName: 'Dr. Elena Reyes',
      role: 'admin',
      qrToken: 'v1.33333333-3333-4333-8333-333333333333.0123456789abcdef01234567',
    };
    const counters = await setupSupabaseRoutes(page, { persona: admin, profileStatus: 500 });

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill(admin.email);
    await page.getByLabel('Password').fill('AdminPass123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toContainText('Database unavailable');
    expect(counters.logoutRequests).toBe(1);
    expect(await readSessionStorageKeys(page)).toEqual([]);
  });

  test('admits verified @lpunetwork.edu.ph admin, persists across reload, and clears local session on sign-out even on 500 logout', async ({
    page,
  }) => {
    const admin: MockPersona = {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'dean.ccs@lpunetwork.edu.ph',
      fullName: 'Dr. Elena Reyes',
      role: 'admin',
      qrToken: 'v1.33333333-3333-4333-8333-333333333333.0123456789abcdef01234567',
    };
    const counters = await setupSupabaseRoutes(page, { persona: admin, logoutStatus: 500 });

    await page.goto('/login');
    await page.getByLabel('Institutional Email').fill(admin.email);
    await page.getByLabel('Password').fill('AdminPass123!');
    await page.getByRole('button', { name: 'Sign in to Web Admin' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: `Welcome, ${admin.fullName}` })).toBeVisible();
    await expect(page.getByText(admin.email)).toBeVisible();
    await expect(page.getByText('admin', { exact: true })).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('student_id');
    expect(bodyText).not.toContain(STUDENT_ID_SENTINEL);
    expect(bodyText).not.toContain(admin.qrToken);

    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: `Welcome, ${admin.fullName}` })).toBeVisible();
    expect(counters.profileRequests).toBeGreaterThanOrEqual(2);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('status')).toContainText('signed out');
    expect(counters.logoutRequests).toBeGreaterThanOrEqual(1);
    expect(counters.logoutScopes).toContain('local');
    expect(await readSessionStorageKeys(page)).toEqual([]);
  });
});
