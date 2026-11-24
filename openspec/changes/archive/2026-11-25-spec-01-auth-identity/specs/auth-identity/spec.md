# Spec Delta: Auth & Privacy-First Identity (`auth-identity`)

## Purpose

Provides verified `@lpunetwork.edu.ph` institutional authentication, 6-digit email OTP verification, encrypted PII profile storage with key versioning and blind-index lookups, private student ID protection with opaque permanent QR tokens, and role-enforced mobile session persistence (`SCRUM-10`, `FR-AUTH`, `ADR-008`, `ADR-011`).

## ADDED Requirements

### Requirement: Server-side institutional email domain restriction
The authentication system SHALL enforce a server-side pre-creation check (`FR-AUTH-01`, `ADR-011`) that normalizes incoming email addresses by trimming whitespace and lowercasing, permits account creation only for the `@lpunetwork.edu.ph` domain, and rejects all other domains regardless of client validation.

#### Scenario: Institutional email signup is accepted
- **WHEN** a user submits a signup request with `"  Juan.DelaCruz@LPUNetwork.edu.ph  "` and a valid password
- **THEN** the server-side domain check normalizes the email to `"juan.delacruz@lpunetwork.edu.ph"` and allows user creation to proceed

#### Scenario: Non-institutional email signup is rejected server-side
- **WHEN** a direct API signup request is submitted with `"student@gmail.com"` or `"user@lpunetwork.edu.ph.evil.com"`
- **THEN** the server-side pre-creation hook rejects the signup with an authorization error and creates no user or profile record

### Requirement: Mandatory 6-digit email OTP verification
The authentication system SHALL require Email + Password signups to complete 6-digit email OTP verification delivered over custom SMTP (`FR-AUTH-01`, `ADR-011`) before issuing an active authenticated session.

#### Scenario: Unconfirmed signup cannot establish an active session
- **WHEN** a `@lpunetwork.edu.ph` user completes initial password signup before entering the 6-digit OTP
- **THEN** the account remains unconfirmed, a 6-digit verification OTP is dispatched via custom SMTP, and no active session token is granted

#### Scenario: Valid 6-digit OTP confirms account and issues session
- **WHEN** the user submits the valid 6-digit signup OTP for their institutional email before expiry
- **THEN** the system marks the email verified and returns an authenticated JWT session

#### Scenario: Invalid or expired OTP is rejected
- **WHEN** the user submits an incorrect or expired 6-digit OTP code
- **THEN** verification fails with an invalid-token error and the account remains unverified

### Requirement: Encrypted student profile provisioning and key versioning
Upon verified signup (`FR-AUTH-02`, `ADR-008`), the system SHALL provision an identity profile defaulting to role `student` with `email`, `full_name`, and `student_id` encrypted at rest and tagged with an integer `key_version` starting at `1`.

#### Scenario: Verified signup provisions encrypted profile with default student role
- **WHEN** a newly verified `@lpunetwork.edu.ph` user provisions their profile with full name and student ID
- **THEN** the persisted profile stores `email_enc`, `full_name_enc`, and `student_id_enc` as ciphertext, sets `key_version` to `1`, and assigns `role` equal to `'student'`

#### Scenario: Key version supports staged rotation
- **WHEN** a profile row is encrypted or re-encrypted under a newer key version
- **THEN** the profile records the active `key_version` integer alongside the updated ciphertext so prior and rotated rows remain distinguishable

### Requirement: Deterministic institutional email blind-index lookup
The system SHALL store a deterministic keyed HMAC-SHA256 `email_blind_index` computed over the trimmed, lowercased institutional email (`FR-AUTH-03`, `ADR-008`) so downstream imports match registered profiles without table-wide decryption.

#### Scenario: Equivalent email casing and whitespace produce identical blind index
- **WHEN** the blind index is computed for `"  Maria.Santos@LPUNetwork.edu.ph "` and `"maria.santos@lpunetwork.edu.ph"` using the same secret key
- **THEN** both computations yield the identical deterministic HMAC-SHA256 digest and match the stored `email_blind_index`

#### Scenario: Different emails produce distinct blind indexes
- **WHEN** blind indexes are computed for two distinct `@lpunetwork.edu.ph` emails
- **THEN** the system produces distinct unique `email_blind_index` values constrained against duplicates

### Requirement: Permanent opaque QR token and student ID privacy
The system SHALL issue each profile a unique permanent opaque QR token formatted as `v1.<profile_id>.<short_hmac>` (`FR-AUTH-02`, `FR-AUTH-03`) and MUST keep `student_id` private, never encoding raw PII inside QR tokens or public profile payloads.

#### Scenario: Permanent QR token omits all raw PII
- **WHEN** a profile's permanent QR token is generated for a student with a known `student_id`, `email`, and `full_name`
- **THEN** the token matches `^v1\.[0-9a-f-]{36}\.[0-9a-f]{16,}$`, passes HMAC signature verification, and contains no substring of `student_id`, `email`, or `full_name`

#### Scenario: Tampered QR token fails verification
- **WHEN** any character of the profile ID or signature segment in a `v1.<profile_id>.<short_hmac>` token is altered
- **THEN** signature verification rejects the QR token as invalid

#### Scenario: Public and QR DTO projections exclude raw student ID
- **WHEN** a profile payload is projected for mobile identity display or officer scan rosters
- **THEN** the serialized payload omits raw `student_id` and exposes only non-sensitive display metadata and `qr_token`

### Requirement: Profile access control, role immutability, and admin bootstrapping
The database SHALL enforce Row Level Security and explicit `authenticated` grants on profiles (`FR-AUTH-02`), preventing cross-student PII access and self-role escalation while supporting SQL-seeded admins and admin-driven faculty promotion.

#### Scenario: Student reads own profile but cannot read peers or escalate role
- **WHEN** an authenticated `student` queries or updates profiles directly through the data API
- **THEN** they can read and update non-role fields on their own active row only, receive zero rows for other users, and are rejected if attempting to modify `role`

#### Scenario: Initial admin bootstrap and faculty promotion
- **WHEN** an initial Department Admin exists from idempotent SQL seeding and promotes a verified `@lpunetwork.edu.ph` faculty profile to `'admin'`
- **THEN** the database policy permits the admin-initiated role update while continuing to block non-admin role changes

### Requirement: Persistent mobile session storage
The mobile client SHALL store and restore authenticated Supabase JWT sessions inside encrypted native device secure storage (`FR-AUTH-01`) rather than unencrypted storage.

#### Scenario: Authenticated session persists across app restarts
- **WHEN** a verified user signs in on the mobile app and restarts the application
- **THEN** the session adapter reads the stored session from Expo SecureStore and restores the authenticated user session without requiring re-login

#### Scenario: Sign-out clears persisted session
- **WHEN** the authenticated user signs out on the mobile app
- **THEN** the stored session entries are removed from Expo SecureStore and the client returns to the unauthenticated state
