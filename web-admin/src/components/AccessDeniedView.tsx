import type { BlockedAdminRole } from '@shared/web-admin';

interface AccessDeniedViewProps {
  email: string;
  role: BlockedAdminRole;
  reason: string;
  onReturnToLogin: () => void;
}

export function AccessDeniedView({
  email,
  role,
  reason,
  onReturnToLogin,
}: AccessDeniedViewProps) {
  return (
    <main className="auth-layout">
      <section className="card auth-card" aria-labelledby="access-denied-heading">
        <div className="brand-header">
          <span className="brand-badge brand-badge-danger">Access Restricted</span>
          <h1 id="access-denied-heading">Admin Access Required</h1>
        </div>

        <div className="alert alert-error" role="alert">
          <p className="alert-title">You do not have permission to access MyCCS Web Admin.</p>
          <p>{reason}</p>
        </div>

        <dl className="detail-list">
          <div className="detail-row">
            <dt>Signed-in account</dt>
            <dd>{email || 'Unknown institutional account'}</dd>
          </div>
          <div className="detail-row">
            <dt>Verified role</dt>
            <dd>
              <span className="role-pill role-pill-muted">{role}</span>
            </dd>
          </div>
          <div className="detail-row">
            <dt>Session status</dt>
            <dd>Signed out automatically</dd>
          </div>
        </dl>

        <button type="button" className="btn btn-secondary" onClick={onReturnToLogin}>
          Return to Sign In
        </button>
      </section>
    </main>
  );
}
