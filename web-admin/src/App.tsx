import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AdminSessionState,
  type WebAdminRoute,
  formatWebAdminError,
  resolveWebAdminRoute,
} from '@shared/web-admin';
import { AccessDeniedView } from './components/AccessDeniedView';
import { AdminDashboardShell } from './components/AdminDashboardShell';
import { LoginView } from './components/LoginView';
import {
  getWebAdminSupabaseClient,
  getWebAdminSupabaseConfig,
  type WebAdminSupabaseConfig,
} from './lib/supabase';
import {
  isInternalAdminSignOut,
  restoreAdminSession,
  signInAsAdmin,
  signOutAdmin,
} from './services/adminAuth';

function syncBrowserPath(target: WebAdminRoute, replace: boolean): void {
  if (window.location.pathname === target) {
    return;
  }
  if (replace) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }
}

export function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [sessionState, setSessionState] = useState<AdminSessionState>({ status: 'loading' });
  const [isBusy, setIsBusy] = useState(false);
  const authOpIdRef = useRef(0);

  const clientResult = useMemo<{
    client: SupabaseClient | null;
    config: WebAdminSupabaseConfig | null;
    error: string | null;
  }>(() => {
    try {
      return {
        client: getWebAdminSupabaseClient(),
        config: getWebAdminSupabaseConfig(),
        error: null,
      };
    } catch (err) {
      return {
        client: null,
        config: null,
        error: formatWebAdminError(
          err,
          'Invalid web-admin Supabase environment configuration.'
        ),
      };
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname;
      setPathname(nextPath);
      if (nextPath === '/login') {
        setSessionState((current) =>
          current.status === 'forbidden' ? { status: 'unauthenticated' } : current
        );
      }
    };
    window.addEventListener('popstate', handlePopState);
    handlePopState();
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const client = clientResult.client;
    if (!client) {
      return;
    }

    let active = true;
    const opId = ++authOpIdRef.current;

    void restoreAdminSession(client)
      .then((nextState) => {
        if (active && authOpIdRef.current === opId) {
          setSessionState(nextState);
        }
      })
      .catch((err: unknown) => {
        if (active && authOpIdRef.current === opId) {
          setSessionState({
            status: 'unauthenticated',
            message: formatWebAdminError(err, 'Unable to verify your institutional session.'),
            noticeTone: 'error',
          });
        }
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (!active) {
        return;
      }
      if (event === 'SIGNED_OUT' && !isInternalAdminSignOut()) {
        authOpIdRef.current += 1;
        setIsBusy(false);
        setSessionState((current) =>
          current.status === 'forbidden' ? current : { status: 'unauthenticated' }
        );
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [clientResult.client]);

  const resolution = resolveWebAdminRoute(pathname, sessionState);

  useEffect(() => {
    if (!clientResult.client) {
      return;
    }
    if (resolution.redirectTo) {
      syncBrowserPath(resolution.redirectTo, true);
      setPathname(resolution.redirectTo);
    } else if (sessionState.status !== 'loading' && window.location.pathname !== resolution.route) {
      syncBrowserPath(resolution.route, true);
    }
  }, [clientResult.client, resolution.redirectTo, resolution.route, sessionState.status]);

  if (clientResult.error || !clientResult.client || !clientResult.config) {
    return (
      <main className="auth-layout">
        <section className="card auth-card" aria-labelledby="config-error-heading">
          <div className="brand-header">
            <span className="brand-badge brand-badge-danger">Configuration Error</span>
            <h1 id="config-error-heading">MyCCS Web Admin Unavailable</h1>
          </div>
          <div className="alert alert-error" role="alert">
            {clientResult.error ?? 'Web Admin client configuration is missing.'}
          </div>
        </section>
      </main>
    );
  }

  const supabaseClient = clientResult.client;
  const supabaseConfig = clientResult.config;

  async function handleSignIn(credentials: { email: string; password: string }) {
    const opId = ++authOpIdRef.current;
    setIsBusy(true);
    try {
      const nextState = await signInAsAdmin(supabaseClient, credentials);
      if (authOpIdRef.current !== opId) {
        return;
      }
      setSessionState(nextState);
      if (nextState.status === 'authenticated') {
        syncBrowserPath('/', false);
        setPathname('/');
      } else if (nextState.status === 'forbidden') {
        syncBrowserPath('/access-denied', false);
        setPathname('/access-denied');
      }
    } catch (err: unknown) {
      if (authOpIdRef.current !== opId) {
        return;
      }
      setSessionState({
        status: 'unauthenticated',
        message: formatWebAdminError(err, 'Unable to complete sign-in.'),
        noticeTone: 'error',
      });
    } finally {
      if (authOpIdRef.current === opId) {
        setIsBusy(false);
      }
    }
  }

  async function handleSignOut() {
    const opId = ++authOpIdRef.current;
    setIsBusy(true);
    try {
      const nextState = await signOutAdmin(supabaseClient);
      if (authOpIdRef.current !== opId) {
        return;
      }
      setSessionState(nextState);
      syncBrowserPath('/login', false);
      setPathname('/login');
    } finally {
      if (authOpIdRef.current === opId) {
        setIsBusy(false);
      }
    }
  }

  function handleReturnToLogin() {
    authOpIdRef.current += 1;
    setSessionState({ status: 'unauthenticated' });
    syncBrowserPath('/login', false);
    setPathname('/login');
  }

  if (sessionState.status === 'loading') {
    return (
      <main className="auth-layout">
        <section className="card auth-card" aria-busy="true" aria-live="polite">
          <div className="brand-header">
            <span className="brand-badge">LPU · CCS</span>
            <h1>MyCCS Web Admin</h1>
            <p className="subtitle">Checking your institutional admin session…</p>
          </div>
        </section>
      </main>
    );
  }

  if (resolution.route === '/access-denied' && sessionState.status === 'forbidden') {
    return (
      <AccessDeniedView
        email={sessionState.email}
        role={sessionState.role}
        reason={sessionState.reason}
        onReturnToLogin={handleReturnToLogin}
      />
    );
  }

  if (resolution.route === '/' && sessionState.status === 'authenticated') {
    return (
      <AdminDashboardShell
        profile={sessionState.profile}
        supabaseClient={supabaseClient}
        supabaseConfig={supabaseConfig}
        isSigningOut={isBusy}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <LoginView
      notice={sessionState.status === 'unauthenticated' ? sessionState.message : undefined}
      noticeTone={sessionState.status === 'unauthenticated' ? sessionState.noticeTone : undefined}
      isSubmitting={isBusy}
      onSubmit={handleSignIn}
    />
  );
}
