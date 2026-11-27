import type { AdminProfileDto } from '@shared/web-admin';

interface AdminDashboardShellProps {
  profile: AdminProfileDto;
  isSigningOut: boolean;
  onSignOut: () => Promise<void>;
}

export function AdminDashboardShell({
  profile,
  isSigningOut,
  onSignOut,
}: AdminDashboardShellProps) {
  return (
    <div className="dashboard-layout">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-badge">LPU · CCS</span>
          <div>
            <h1 className="topbar-title">MyCCS Web Admin</h1>
            <p className="topbar-subtitle">College of Information Technology &amp; Computer Science · Department Portal</p>
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
            Authenticated as a verified CCS Department Admin. This isolated portal enforces
            PKCE session storage and server-verified role checks before loading administrative
            modules.
          </p>
        </section>

        <section className="module-grid" aria-label="Administrative modules">
          <article className="card module-card">
            <span className="module-tag">Milestone 2 · Spec 05</span>
            <h3>GMetrix Certification Keys</h3>
            <p>
              Bulk CSV upload and HMAC blind-index matching for CCS certification key
              distribution will mount here.
            </p>
          </article>

          <article className="card module-card">
            <span className="module-tag">Milestone 2 · Spec 04</span>
            <h3>Department &amp; Organizations</h3>
            <p>
              Manage College of Information Technology and Computer Science (IT, CS, LIS) profile information, sub-organizations, and
              department announcements.
            </p>
          </article>

          <article className="card module-card">
            <span className="module-tag">Active Guard · ADR-009</span>
            <h3>Session &amp; Security Boundary</h3>
            <p>
              Role verification runs via <code>public.get_my_profile()</code> with zero backend
              secrets exposed to the browser bundle.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
