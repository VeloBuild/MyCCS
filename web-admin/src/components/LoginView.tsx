import { useState, type FormEvent } from 'react';

interface LoginViewProps {
  notice?: string;
  noticeTone?: 'error' | 'info';
  isSubmitting: boolean;
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
}

export function LoginView({
  notice,
  noticeTone = 'error',
  isSubmitting,
  onSubmit,
}: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ email, password });
  }

  return (
    <main className="auth-layout">
      <section className="card auth-card" aria-labelledby="login-heading">
        <div className="brand-header">
          <span className="brand-badge">LPU · CCS</span>
          <h1 id="login-heading">MyCCS Web Admin</h1>
          <p className="subtitle">
            Department Admin &amp; Faculty portal. Sign in with your verified{' '}
            <code>@lpunetwork.edu.ph</code> institutional account.
          </p>
        </div>

        {notice ? (
          <div
            className={noticeTone === 'info' ? 'alert alert-info' : 'alert alert-error'}
            role={noticeTone === 'info' ? 'status' : 'alert'}
          >
            {notice}
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="admin-email">Institutional Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="faculty@lpunetwork.edu.ph"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Verifying admin access…' : 'Sign in to Web Admin'}
          </button>
        </form>

        <p className="footnote">
          Restricted to authorized CCS Department Admins and Faculty. Student and
          organization officer accounts should use the MyCCS mobile application.
        </p>
      </section>
    </main>
  );
}
