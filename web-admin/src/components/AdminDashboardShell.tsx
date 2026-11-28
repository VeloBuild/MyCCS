import { useRef, useState, type KeyboardEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminProfileDto } from '@shared/web-admin';
import type { WebAdminSupabaseConfig } from '../lib/supabase';
import { FacultyPromotionPanel } from './FacultyPromotionPanel';
import { GMetrixImportPanel } from './GMetrixImportPanel';

type AdminWorkspaceTab = 'gmetrix' | 'faculty';

interface AdminDashboardShellProps {
  profile: AdminProfileDto;
  supabaseClient: SupabaseClient;
  supabaseConfig: WebAdminSupabaseConfig;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
}

export function AdminDashboardShell({
  profile,
  supabaseClient,
  supabaseConfig,
  isSigningOut,
  onSignOut,
}: AdminDashboardShellProps) {
  const [activeTab, setActiveTab] = useState<AdminWorkspaceTab>('gmetrix');
  const [hasOpenedFacultyTab, setHasOpenedFacultyTab] = useState(false);
  const gmetrixTabRef = useRef<HTMLButtonElement | null>(null);
  const facultyTabRef = useRef<HTMLButtonElement | null>(null);

  function selectTab(nextTab: AdminWorkspaceTab, focusTab = false) {
    setActiveTab(nextTab);
    if (nextTab === 'faculty') {
      setHasOpenedFacultyTab(true);
    }
    if (focusTab) {
      const targetRef = nextTab === 'gmetrix' ? gmetrixTabRef : facultyTabRef;
      targetRef.current?.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      selectTab(activeTab === 'gmetrix' ? 'faculty' : 'gmetrix', true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectTab('gmetrix', true);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectTab('faculty', true);
    }
  }

  return (
    <div className="dashboard-layout">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-badge">LPU · CCS</span>
          <div>
            <h1 className="topbar-title">MyCCS Web Admin</h1>
            <p className="topbar-subtitle">
              College of Information Technology &amp; Computer Science · Department Portal
            </p>
          </div>
        </div>

        <div className="topbar-account">
          <div className="account-meta">
            <span className="account-name">{profile.fullName}</span>
            <span className="account-email">{profile.email}</span>
          </div>
          <span className="role-pill">{profile.role}</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onSignOut()}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="card hero-card" aria-labelledby="welcome-heading">
          <h2 id="welcome-heading">Welcome, {profile.fullName}</h2>
          <p className="subtitle">
            Authenticated as a verified CCS Department Admin. Manage encrypted GMetrix certification
            key batches and authorized faculty access within this isolated portal.
          </p>
        </section>

        <nav className="workspace-tabs" role="tablist" aria-label="Admin workspaces">
          <button
            ref={gmetrixTabRef}
            id="tab-gmetrix"
            type="button"
            role="tab"
            aria-selected={activeTab === 'gmetrix'}
            aria-controls="panel-gmetrix"
            tabIndex={activeTab === 'gmetrix' ? 0 : -1}
            className={
              activeTab === 'gmetrix' ? 'workspace-tab workspace-tab-active' : 'workspace-tab'
            }
            onClick={() => selectTab('gmetrix')}
            onKeyDown={handleTabKeyDown}
          >
            GMetrix Keys
          </button>
          <button
            ref={facultyTabRef}
            id="tab-faculty"
            type="button"
            role="tab"
            aria-selected={activeTab === 'faculty'}
            aria-controls="panel-faculty"
            tabIndex={activeTab === 'faculty' ? 0 : -1}
            className={
              activeTab === 'faculty' ? 'workspace-tab workspace-tab-active' : 'workspace-tab'
            }
            onClick={() => selectTab('faculty')}
            onKeyDown={handleTabKeyDown}
          >
            Faculty Admins
          </button>
        </nav>

        <div
          id="panel-gmetrix"
          role="tabpanel"
          aria-labelledby="tab-gmetrix"
          hidden={activeTab !== 'gmetrix'}
        >
          <GMetrixImportPanel
            supabaseClient={supabaseClient}
            supabaseConfig={supabaseConfig}
          />
        </div>
        {hasOpenedFacultyTab ? (
          <div
            id="panel-faculty"
            role="tabpanel"
            aria-labelledby="tab-faculty"
            hidden={activeTab !== 'faculty'}
          >
            <FacultyPromotionPanel supabaseClient={supabaseClient} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
