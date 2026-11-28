# gmetrix-csv-and-push Specification

## Purpose

Defines the database schema, RLS and explicit GRANT controls, `import-gmetrix-keys` and `my-certification-keys` Edge Functions, `web-admin/` CSV upload and faculty promotion portal modules, content-free Expo Push Notifications, and authenticated mobile Certification Directory and My Keys flows (`FR-CERT-01`, `FR-CERT-02`, `FR-CERT-03`, `FR-CERT-04`, `FR-CERT-05`, `FR-AUTH-02`, `ADR-008`, `ADR-009`).

## Requirements

### Requirement: Certification, Encrypted Key, Notification & Push Token Schema with RLS (`FR-CERT-01`, `ADR-008`, `SAB §6`)
The database MUST provide `public.certifications`, `public.certification_key_batches`, `public.certification_keys` (`key_code_enc`, unique `key_code_hash`, `key_version`), `public.notifications`, and `public.push_tokens` with RLS enabled and forced, explicit `GRANT`s for `authenticated`, zero `anon` privileges, and `SECURITY INVOKER` update guards.

#### Scenario: Active student queries own keys, notifications, and directory while cross-user access is blocked
- **WHEN** an authenticated `student` queries `public.certifications`, `public.certification_keys`, `public.notifications`, and `public.push_tokens`
- **THEN** the student reads active certifications and only their own `certification_keys`, `notifications`, and `push_tokens`, cannot read another student's rows or `certification_key_batches`, and cannot insert or forge `certification_keys`, `certification_key_batches`, or `notifications` directly

#### Scenario: Student marks own key viewed or notification read without altering immutable columns
- **WHEN** an authenticated `student` updates `viewed_at` on their own `certification_keys` row or `read_at` on their own `notifications` row
- **THEN** the update succeeds while any attempt by `authenticated` to modify `key_code_enc`, `key_code_hash`, `student_profile_id`, `title`, `body`, or `deep_link` fails with privilege error `42501`

### Requirement: Blind-Index Matching, Idempotent Partial Commit & Sanitized Fallback CSV (`FR-CERT-02`, `FR-CERT-03`, `FR-CERT-04`)
`POST /functions/v1/import-gmetrix-keys` MUST verify CORS, caller JWT, and active `admin` role, match `@lpunetwork.edu.ph` rows via HMAC-SHA256 `email_blind_index`, encrypt keys with AES-256-GCM AEAD, commit valid rows idempotently (`UNIQUE(key_code_hash)`), and return counts plus a formula-sanitized rejected-rows CSV.

#### Scenario: Non-admin or invalid JWT invokes `import-gmetrix-keys`
- **WHEN** an unauthenticated caller, a caller with an invalid JWT, or an authenticated `student` or `officer` calls `POST /functions/v1/import-gmetrix-keys`
- **THEN** the Edge Function returns `401 Unauthorized` for missing or invalid auth and `403 Forbidden` for non-admin roles without writing database rows or sending push alerts

#### Scenario: Admin uploads a mixed CSV with registered, unregistered, duplicate, and formula-injection rows
- **WHEN** an active `admin` uploads a CSV targeting an active certification containing registered student emails, unregistered institutional emails, duplicate `key_code` values (in-file or already committed), and cells beginning with `=`, `+`, `-`, or `@`
- **THEN** valid matched keys are encrypted and committed atomically in `certification_keys` with corresponding `notifications`, re-uploading the same CSV commits zero duplicate keys or duplicate notifications, raw key values are absent from the HTTP response, and `rejectedRowsCsv` neutralizes formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) with a leading apostrophe

### Requirement: Content-Free Expo Push Notifications (`FR-CERT-05`, `SAB §7.2`)
For each newly committed GMetrix key whose recipient has registered Expo Push Tokens, the backend MUST send a content-free alert via Expo Push API v2 in chunks of at most 100 messages with only a generic message and `myccs://certifications/my-keys` deep link, never raw keys or PII, and prune `DeviceNotRegistered` tokens.

#### Scenario: Newly assigned key triggers content-free Expo Push alert and prunes dead tokens
- **WHEN** `import-gmetrix-keys` commits keys for registered students with valid Expo Push Tokens and Expo returns a `DeviceNotRegistered` error for one stale token
- **THEN** every dispatched push message omits `key_code`, `key_code_hash`, and student PII, carries `deepLink: "myccs://certifications/my-keys"`, respects the 100-message chunk limit, and deletes the `DeviceNotRegistered` token from `public.push_tokens`

### Requirement: Web Admin GMetrix Distribution & Faculty-to-Admin Promotion UI (`FR-CERT-02`, `FR-CERT-04`, `FR-AUTH-02`, `ADR-009`)
`web-admin/` MUST provide verified `admin` users a GMetrix CSV upload workspace (certification selector, summary counts, manual email/MS Teams fallback prompt, sanitized rejected-rows CSV download, and batch history) and a Faculty Admin Promotion panel using blind-index RPC lookup without exposing `student_id`.

#### Scenario: Admin uploads a GMetrix CSV in `web-admin/` and downloads the sanitized fallback CSV
- **WHEN** a verified `admin` signs into `web-admin/`, selects a certification, uploads a CSV containing registered and unregistered rows, and submits
- **THEN** the portal displays total, assigned, rejected, and push-alert counts, prompts the admin to send rejected keys via email or MS Teams, renders the rejected rows table, and enables downloading the sanitized rejected-rows CSV

#### Scenario: Admin promotes a verified `@lpunetwork.edu.ph` faculty account in `web-admin/`
- **WHEN** a verified `admin` enters a registered faculty `@lpunetwork.edu.ph` email in the Faculty Admin Promotion panel and submits
- **THEN** the portal validates the institutional domain, calls `promote_faculty_by_email`, displays promotion confirmation, and refreshes the admin directory without displaying any `student_id`

### Requirement: Authenticated Mobile Certification Directory, My Keys & In-App Alerts (`FR-CERT-01`, `FR-CERT-05`)
The mobile app MUST provide an authenticated `Keys` hub tab showing active certifications, caller-scoped decrypted keys from `GET /functions/v1/my-certification-keys` masked until revealed (recording `viewed_at`), an in-app `Alerts` inbox, and deep-link routing for `myccs://certifications/my-keys`.

#### Scenario: Student opens a GMetrix alert and reveals their assigned key on mobile
- **WHEN** an authenticated `student` opens the `Keys` tab or activates a `myccs://certifications/my-keys` deep link
- **THEN** the app fetches decrypted keys strictly for the signed-in user over HTTPS, renders each key masked in monospace by default, reveals the plaintext key and persists `viewed_at` when the student taps Reveal Key, and allows marking `gmetrix_key` alerts read
