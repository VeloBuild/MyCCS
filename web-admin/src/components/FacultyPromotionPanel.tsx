import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { InstitutionalEmailSchema } from '@shared/auth';
import type { AdminDirectoryEntry } from '@shared/gmetrix';
import { formatWebAdminError } from '@shared/web-admin';
import { listAdminProfiles, promoteFacultyByEmail } from '../services/gmetrixAdmin';

interface FacultyPromotionPanelProps {
  supabaseClient: SupabaseClient;
}

export function FacultyPromotionPanel({ supabaseClient }: FacultyPromotionPanelProps) {
  const [admins, setAdmins] = useState<AdminDirectoryEntry[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [promotionNotice, setPromotionNotice] = useState<{
    tone: 'success' | 'info';
    text: string;
  } | null>(null);

  const refreshAdmins = useCallback(async () => {
    const entries = await listAdminProfiles(supabaseClient);
    setAdmins(entries);
    setLoadError(null);
  }, [supabaseClient]);

  useEffect(() => {
    let active = true;
    setIsLoadingAdmins(true);
    setLoadError(null);

    void listAdminProfiles(supabaseClient)
      .then((entries) => {
        if (active) {
          setAdmins(entries);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setLoadError(formatWebAdminError(err, 'Unable to load CCS Department Admins.'));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingAdmins(false);
        }
      });

    return () => {
      active = false;
    };
  }, [supabaseClient]);

  async function handlePromoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromotionError(null);
    setPromotionNotice(null);

    const parsedEmail = InstitutionalEmailSchema.safeParse(emailInput);
    if (!parsedEmail.success) {
      setPromotionError('Faculty email must be a valid @lpunetwork.edu.ph institutional address.');
      return;
    }

    setIsPromoting(true);
    try {
      const result = await promoteFacultyByEmail(supabaseClient, parsedEmail.data);
      if (result.alreadyAdmin) {
        setPromotionNotice({
          tone: 'info',
          text: `${result.fullName} (${result.email}) is already an active CCS Department Admin.`,
        });
      } else {
        setPromotionNotice({
          tone: 'success',
          text: `Promoted ${result.fullName} (${result.email}) to CCS Department Admin.`,
        });
        setEmailInput('');
      }

      try {
        await refreshAdmins();
      } catch (refreshErr: unknown) {
        setLoadError(formatWebAdminError(refreshErr, 'Unable to refresh admin directory.'));
      }
    } catch (err: unknown) {
      setPromotionError(
        formatWebAdminError(
          err,
          'Unable to promote this faculty account. Confirm the account is registered in MyCCS.'
        )
      );
    } finally {
      setIsPromoting(false);
    }
  }

  return (
    <div className="workspace-stack">
      <section className="card ledger-sheet" aria-labelledby="faculty-promotion-heading">
        <div className="ledger-section ledger-header">
          <div>
            <h2 id="faculty-promotion-heading">Faculty Admin Promotion</h2>
            <p className="subtitle">
              Promote a registered <code>@lpunetwork.edu.ph</code> CCS faculty account to Department
              Admin using institutional email blind-index lookup.
            </p>
          </div>
        </div>

        <div className="ledger-section">
          <form className="inline-form" onSubmit={handlePromoteSubmit} noValidate>
            <div className="promote-row">
              <div className="field">
                <label htmlFor="faculty-promote-email">Faculty Institutional Email</label>
                <input
                  id="faculty-promote-email"
                  name="facultyEmail"
                  type="email"
                  autoComplete="off"
                  placeholder="faculty.member@lpunetwork.edu.ph"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  disabled={isPromoting}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary promote-submit"
                disabled={isPromoting}
                aria-busy={isPromoting}
              >
                {isPromoting ? 'Promoting…' : 'Promote to Admin'}
              </button>
            </div>

            {promotionError ? (
              <div className="alert alert-error" role="alert">
                {promotionError}
              </div>
            ) : null}

            {promotionNotice ? (
              <div
                className={
                  promotionNotice.tone === 'success' ? 'alert alert-success' : 'alert alert-info'
                }
                role="status"
              >
                {promotionNotice.text}
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="card ledger-sheet" aria-labelledby="active-admins-heading">
        <div className="ledger-section ledger-header">
          <div>
            <h3 id="active-admins-heading" className="section-subheading">
              Active CCS Department Admins
            </h3>
            <p className="subtitle">
              Accounts currently authorized to access MyCCS Web Admin and distribute certification
              keys.
            </p>
          </div>
          <span className="mono-caption">{admins.length} active</span>
        </div>

        {loadError ? (
          <div className="ledger-section">
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          </div>
        ) : null}

        <div className="ledger-table-wrap">
          <table className="ledger-table" aria-label="Active CCS Department Admins">
            <thead>
              <tr>
                <th scope="col">Full Name</th>
                <th scope="col">Institutional Email</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-cell">
                    {isLoadingAdmins
                      ? 'Loading CCS Department Admins…'
                      : 'No active admin accounts returned.'}
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id}>
                    <td className="admin-name-cell">{admin.fullName}</td>
                    <td className="email-cell">{admin.email}</td>
                    <td>
                      <span className="role-pill">{admin.role}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
