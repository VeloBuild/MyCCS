import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CertificationCreateInputSchema,
  MAX_GMETRIX_CSV_BYTES,
  parseGMetrixCsv,
  type Certification,
  type CertificationKeyBatch,
  type ImportGMetrixKeysResponse,
} from '@shared/gmetrix';
import { formatWebAdminError } from '@shared/web-admin';
import type { WebAdminSupabaseConfig } from '../lib/supabase';
import {
  createCertification,
  downloadRejectedRowsCsv,
  formatLedgerTimestamp,
  formatRejectedRowReason,
  listCertifications,
  listRecentBatches,
  uploadGMetrixCsvBatch,
} from '../services/gmetrixAdmin';

interface GMetrixImportPanelProps {
  supabaseClient: SupabaseClient;
  supabaseConfig: WebAdminSupabaseConfig;
}

type CsvPreviewState =
  | { status: 'idle' }
  | { status: 'valid'; fileName: string; sizeBytes: number; rowCount: number }
  | { status: 'invalid'; fileName: string; error: string };

function sortCertifications(items: readonly Certification[]): Certification[] {
  return [...items].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      a.provider.localeCompare(b.provider) ||
      a.title.localeCompare(b.title)
  );
}

function mergeCertifications(
  fetched: readonly Certification[],
  existing: readonly Certification[]
): Certification[] {
  const byId = new Map<string, Certification>();
  for (const cert of fetched) {
    byId.set(cert.id, cert);
  }
  for (const cert of existing) {
    byId.set(cert.id, cert);
  }
  return sortCertifications(Array.from(byId.values()));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function GMetrixImportPanel({
  supabaseClient,
  supabaseConfig,
}: GMetrixImportPanelProps) {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [batches, setBatches] = useState<CertificationKeyBatch[]>([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreatingCert, setIsCreatingCert] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewState>({ status: 'idle' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportGMetrixKeysResponse | null>(null);
  const fileParseIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCertifications = useMemo(
    () => certifications.filter((cert) => cert.is_active),
    [certifications]
  );

  const certLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cert of certifications) {
      map.set(cert.id, `${cert.provider} — ${cert.title}`);
    }
    return map;
  }, [certifications]);

  useEffect(() => {
    let active = true;
    setIsLoadingInitial(true);
    setLoadWarning(null);

    void Promise.allSettled([
      listCertifications(supabaseClient),
      listRecentBatches(supabaseClient),
    ]).then(([certResult, batchResult]) => {
      if (!active) {
        return;
      }

      const warnings: string[] = [];

      if (certResult.status === 'fulfilled') {
        const sorted = sortCertifications(certResult.value);
        setCertifications((current) => mergeCertifications(sorted, current));
        const firstActive = sorted.find((cert) => cert.is_active);
        setSelectedCertId((current) => current || firstActive?.id || '');
      } else {
        warnings.push(
          formatWebAdminError(certResult.reason, 'Unable to load certification programs.')
        );
      }

      if (batchResult.status === 'fulfilled') {
        setBatches(batchResult.value);
      } else {
        warnings.push(
          formatWebAdminError(batchResult.reason, 'Unable to load recent import batches.')
        );
      }

      setLoadWarning(warnings.length > 0 ? warnings.join(' ') : null);
      setIsLoadingInitial(false);
    });

    return () => {
      active = false;
    };
  }, [supabaseClient]);

  async function handleCreateCertification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoadingInitial || isCreatingCert) {
      return;
    }
    setCreateError(null);
    setCreateNotice(null);

    const parsed = CertificationCreateInputSchema.safeParse({
      title: newTitle,
      provider: newProvider,
      description: newDescription,
      is_active: true,
    });

    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? 'Enter a valid certification title and provider.');
      return;
    }

    setIsCreatingCert(true);
    try {
      const created = await createCertification(supabaseClient, parsed.data);
      setCertifications((current) => mergeCertifications(current, [created]));
      setSelectedCertId(created.id);
      setNewTitle('');
      setNewProvider('');
      setNewDescription('');
      setIsCreateFormOpen(false);
      setCreateNotice(`Added certification "${created.provider} — ${created.title}".`);
    } catch (err: unknown) {
      setCreateError(formatWebAdminError(err, 'Unable to create certification program.'));
    } finally {
      setIsCreatingCert(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    const parseId = ++fileParseIdRef.current;
    setUploadError(null);
    setSelectedFile(file);
    setCsvPreview({ status: 'idle' });

    if (!file) {
      return;
    }

    if (file.size <= 0) {
      setCsvPreview({ status: 'invalid', fileName: file.name, error: 'CSV file is empty.' });
      return;
    }

    if (file.size > MAX_GMETRIX_CSV_BYTES) {
      setCsvPreview({
        status: 'invalid',
        fileName: file.name,
        error: 'CSV file exceeds the 2 MiB upload limit.',
      });
      return;
    }

    try {
      const rawText = await file.text();
      if (fileParseIdRef.current !== parseId) {
        return;
      }

      const parsed = parseGMetrixCsv(rawText);
      if (!parsed.ok) {
        setCsvPreview({ status: 'invalid', fileName: file.name, error: parsed.error });
        return;
      }

      setCsvPreview({
        status: 'valid',
        fileName: file.name,
        sizeBytes: file.size,
        rowCount: parsed.rows.length,
      });
    } catch {
      if (fileParseIdRef.current === parseId) {
        setCsvPreview({
          status: 'invalid',
          fileName: file.name,
          error: 'Unable to read the selected CSV file.',
        });
      }
    }
  }

  async function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    if (!selectedCertId) {
      setUploadError('Select an active certification program before uploading.');
      return;
    }

    if (!selectedFile || csvPreview.status !== 'valid') {
      setUploadError('Select a valid GMetrix CSV file before uploading.');
      return;
    }

    setIsUploading(true);
    let uploadSucceeded = false;
    try {
      const result = await uploadGMetrixCsvBatch({
        client: supabaseClient,
        supabaseUrl: supabaseConfig.supabaseUrl,
        publishableKey: supabaseConfig.publishableKey,
        certificationId: selectedCertId,
        file: selectedFile,
      });
      uploadSucceeded = true;
      setImportResult(result);
      fileParseIdRef.current += 1;
      setSelectedFile(null);
      setCsvPreview({ status: 'idle' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: unknown) {
      setUploadError(formatWebAdminError(err, 'Failed to upload GMetrix CSV batch.'));
    } finally {
      setIsUploading(false);
    }

    if (uploadSucceeded) {
      try {
        const latestBatches = await listRecentBatches(supabaseClient);
        setBatches(latestBatches);
        setLoadWarning(null);
      } catch (err: unknown) {
        setLoadWarning(
          formatWebAdminError(err, 'Batch uploaded, but unable to refresh recent import batches.')
        );
      }
    }
  }

  const canUpload =
    !isUploading &&
    selectedCertId.length > 0 &&
    selectedFile !== null &&
    csvPreview.status === 'valid';

  return (
    <div className="workspace-stack">
      <section className="card ledger-sheet" aria-labelledby="gmetrix-keys-heading">
        <div className="ledger-section ledger-header">
          <div>
            <h2 id="gmetrix-keys-heading">GMetrix Certification Keys</h2>
            <p className="subtitle">
              Upload a GMetrix CSV roster to match registered institutional accounts via blind
              index, encrypt keys server-side, and send content-free push alerts.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setIsCreateFormOpen((open) => !open);
              setCreateError(null);
            }}
            disabled={isLoadingInitial}
            aria-expanded={isCreateFormOpen}
          >
            {isCreateFormOpen ? 'Cancel' : 'Add Certification'}
          </button>
        </div>

        {loadWarning ? (
          <div className="ledger-section">
            <div className="alert alert-info" role="alert">
              {loadWarning}
            </div>
          </div>
        ) : null}

        {createNotice ? (
          <div className="ledger-section">
            <div className="alert alert-success" role="status">
              {createNotice}
            </div>
          </div>
        ) : null}

        {isCreateFormOpen ? (
          <div className="ledger-section">
            <h3 className="section-subheading">New Certification Program</h3>
            <form className="inline-form" onSubmit={handleCreateCertification} noValidate>
              <div className="form-row-2">
                <div className="field">
                  <label htmlFor="cert-title">Title</label>
                  <input
                    id="cert-title"
                    name="title"
                    type="text"
                    placeholder="e.g., CompTIA IT Fundamentals (ITF+)"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    disabled={isLoadingInitial || isCreatingCert}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="cert-provider">Provider</label>
                  <input
                    id="cert-provider"
                    name="provider"
                    type="text"
                    placeholder="e.g., CompTIA"
                    value={newProvider}
                    onChange={(event) => setNewProvider(event.target.value)}
                    disabled={isLoadingInitial || isCreatingCert}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="cert-description">Description</label>
                <textarea
                  id="cert-description"
                  name="description"
                  rows={2}
                  placeholder="Optional overview shown in the mobile certification directory"
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  disabled={isLoadingInitial || isCreatingCert}
                />
              </div>

              {createError ? (
                <div className="alert alert-error" role="alert">
                  {createError}
                </div>
              ) : null}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoadingInitial || isCreatingCert}
                  aria-busy={isCreatingCert}
                >
                  {isCreatingCert ? 'Saving…' : 'Save Certification'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="ledger-section">
          <form className="inline-form" onSubmit={handleUploadSubmit} noValidate>
            <div className="form-row-2">
              <div className="field">
                <label htmlFor="gmetrix-certification-select">Certification Program</label>
                <select
                  id="gmetrix-certification-select"
                  name="certificationId"
                  value={selectedCertId}
                  onChange={(event) => setSelectedCertId(event.target.value)}
                  disabled={isLoadingInitial || isUploading || activeCertifications.length === 0}
                >
                  {activeCertifications.length === 0 ? (
                    <option value="">
                      {isLoadingInitial
                        ? 'Loading active certifications…'
                        : 'No active certifications available'}
                    </option>
                  ) : (
                    activeCertifications.map((cert) => (
                      <option key={cert.id} value={cert.id}>
                        {cert.provider} — {cert.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="field">
                <label htmlFor="gmetrix-csv-file">GMetrix CSV File</label>
                <input
                  ref={fileInputRef}
                  id="gmetrix-csv-file"
                  name="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => void handleFileChange(event)}
                  disabled={isUploading}
                />
                <span className="field-hint">
                  Columns: <code>email</code> and <code>key_code</code> · max 2 MiB / 2,000 rows.
                </span>
              </div>
            </div>

            {csvPreview.status === 'valid' ? (
              <div className="preview-strip" role="status">
                <span className="status-badge status-badge-success">CSV Validated</span>
                <span>
                  <strong>{csvPreview.fileName}</strong> ({formatFileSize(csvPreview.sizeBytes)}) ·{' '}
                  <span className="mono-inline">{csvPreview.rowCount}</span>{' '}
                  {csvPreview.rowCount === 1 ? 'data row' : 'data rows'} detected. Raw key values
                  are never rendered in the portal.
                </span>
              </div>
            ) : null}

            {csvPreview.status === 'invalid' ? (
              <div className="alert alert-error" role="alert">
                {csvPreview.error}
              </div>
            ) : null}

            {uploadError ? (
              <div className="alert alert-error" role="alert">
                {uploadError}
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canUpload}
                aria-busy={isUploading}
              >
                {isUploading ? 'Uploading & Distributing…' : 'Upload & Distribute Keys'}
              </button>
            </div>
          </form>
        </div>

        {importResult ? (
          <div className="ledger-section" aria-labelledby="upload-summary-heading">
            <div className="section-header-row">
              <h3 id="upload-summary-heading" className="section-subheading">
                Latest Batch Summary
              </h3>
              <span className="mono-caption">Batch {importResult.batchId.slice(0, 8)}</span>
            </div>

            <div className="metric-strip" role="region" aria-label="Import summary counts">
              <div className="metric-cell">
                <span className="metric-label">Total Rows</span>
                <span className="metric-value" data-testid="metric-total-rows">
                  {importResult.totalRows}
                </span>
              </div>
              <div className="metric-cell">
                <span className="metric-label">Assigned</span>
                <span
                  className="metric-value metric-value-present"
                  data-testid="metric-assigned-count"
                >
                  {importResult.assignedCount}
                </span>
              </div>
              <div className="metric-cell">
                <span className="metric-label">Rejected</span>
                <span
                  className={
                    importResult.rejectedCount > 0
                      ? 'metric-value metric-value-danger'
                      : 'metric-value'
                  }
                  data-testid="metric-rejected-count"
                >
                  {importResult.rejectedCount}
                </span>
              </div>
              <div className="metric-cell">
                <span className="metric-label">Push Alerts Sent</span>
                <span className="metric-value" data-testid="metric-push-sent">
                  {importResult.pushNotificationsSent}
                </span>
                {importResult.pushNotificationsFailed > 0 ? (
                  <span className="metric-sublabel">
                    {importResult.pushNotificationsFailed} failed
                  </span>
                ) : null}
              </div>
            </div>

            {importResult.rejectedCount > 0 ? (
              <div className="rejected-block">
                <div className="callout-warning" role="status">
                  <div className="callout-warning-copy">
                    <p className="callout-warning-title">
                      Manual Distribution Required for Rejected Rows
                    </p>
                    <p>
                      Distribute keys for unregistered or rejected students manually via direct{' '}
                      <code>@lpunetwork.edu.ph</code> email or MS Teams. Exported CSV cells are
                      sanitized against spreadsheet formulas and exclude raw GMetrix keys.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      downloadRejectedRowsCsv(importResult.batchId, importResult.rejectedRowsCsv)
                    }
                  >
                    Download Rejected Rows CSV
                  </button>
                </div>

                <div className="ledger-table-wrap">
                  <table className="ledger-table" aria-label="Rejected CSV rows">
                    <thead>
                      <tr>
                        <th scope="col">Row #</th>
                        <th scope="col">Email</th>
                        <th scope="col">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.rejectedRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.reason}-${row.email}`}>
                          <td className="mono-cell">{row.rowNumber}</td>
                          <td className="email-cell">{row.email || '—'}</td>
                          <td>
                            <span
                              className={
                                row.reason === 'unregistered_student'
                                  ? 'status-badge status-badge-warning'
                                  : 'status-badge status-badge-danger'
                              }
                            >
                              {formatRejectedRowReason(row.reason)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="alert alert-success" role="status">
                All {importResult.assignedCount} GMetrix keys were encrypted and assigned with zero
                rejected rows.
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="card ledger-sheet" aria-labelledby="recent-batches-heading">
        <div className="ledger-section ledger-header">
          <div>
            <h3 id="recent-batches-heading" className="section-subheading">
              Recent Import Batches
            </h3>
            <p className="subtitle">
              Audit ledger of the latest GMetrix CSV distributions across active CCS certifications.
            </p>
          </div>
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table" aria-label="Recent GMetrix import batches">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Certification</th>
                <th scope="col" className="numeric-col">
                  Total
                </th>
                <th scope="col" className="numeric-col">
                  Assigned
                </th>
                <th scope="col" className="numeric-col">
                  Rejected
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    {isLoadingInitial
                      ? 'Loading recent import batches…'
                      : 'No GMetrix import batches recorded yet.'}
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{formatLedgerTimestamp(batch.created_at)}</td>
                    <td>
                      {certLabelById.get(batch.certification_id) ??
                        `Certification ${batch.certification_id.slice(0, 8)}`}
                    </td>
                    <td className="mono-cell numeric-col">{batch.total_rows}</td>
                    <td className="mono-cell numeric-col cell-present">{batch.assigned_count}</td>
                    <td
                      className={
                        batch.rejected_count > 0
                          ? 'mono-cell numeric-col cell-danger'
                          : 'mono-cell numeric-col'
                      }
                    >
                      {batch.rejected_count}
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
