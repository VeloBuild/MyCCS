# dept-and-org-pages Specification

## Purpose

Defines the mobile Department About screen (admin-editable), expiration-aware Announcements feed, two-tier Main Organization and Sub-Organization directory, simplified read-only organization pages, and the on-device plus server-side (`compress-image`) EXIF-stripping WebP image upload pipeline (`FR-DEPT-01`, `FR-DEPT-02`, `FR-ORG-01`, `FR-ORG-02`, `ADR-007`).

## Requirements

### Requirement: Department About Screen & Admin Governance (`FR-DEPT-01`)
The system MUST display the CCS Department About section (department title, overview content, leadership/faculty directory, and contact details) to all authenticated active users and MUST expose inline edit controls exclusively to `admin` users, validating updates with `DepartmentInfoUpdateInputSchema` before saving to `public.department_info`.

#### Scenario: Authenticated student views Department About
- **WHEN** an authenticated `student` or `officer` opens the Department tab
- **THEN** the app displays the department title, overview copy, leadership directory, and contact details without showing any edit controls

#### Scenario: Admin edits Department About content
- **WHEN** an authenticated `admin` updates the department title, overview, leadership entries, or contact details and saves
- **THEN** the app validates the payload against `DepartmentInfoUpdateInputSchema`, persists the update to `public.department_info`, and renders the updated content

### Requirement: Expiration-Aware Department & Organization Announcements Feed (`FR-DEPT-02`)
The system MUST render a chronological newest-first announcements feed combining department-wide notices and announcements from organizations the user belongs to, filtering by All, Department, or My Orgs, hiding expired notices (`expires_at <= now`) for students, and displaying expiration dates when present.

#### Scenario: Student filters announcements and hides expired notices
- **WHEN** an authenticated `student` views the Announcements feed with active global, active joined-org, and expired announcements present
- **THEN** expired announcements are excluded, remaining notices appear newest-first with expiration metadata, and switching between All, Department, and My Orgs filters the list accurately

#### Scenario: Admin or assigned officer publishes an announcement with optional expiration
- **WHEN** an `admin` publishes a department-wide announcement (`global_visibility = true`, `organization_id = null`) or an approved `officer` publishes an announcement for their assigned organization (`global_visibility = false`) with an optional future `expires_at`
- **THEN** the app validates the input with `AnnouncementCreateInputSchema` and inserts the announcement into `public.announcements`

### Requirement: Two-Tier Organization Directory & Simplified Read-Only Org Page (`FR-ORG-01`, `FR-ORG-02`)
The system MUST display a directory of active Main Organizations (`parent_org_id IS NULL`) with their nested Sub-Organizations (`parent_org_id = main.id`) and MUST render a simplified organization page showing cover image, logo, details, nested sub-organizations, and chronological posts with zero likes or comments.

#### Scenario: Student browses Main Organizations and nested Sub-Organizations
- **WHEN** an authenticated user opens the Organizations directory and selects a Main Organization or Sub-Organization
- **THEN** the directory groups Sub-Organizations under their parent Main Organization and the selected organization page renders its cover image, logo, details, nested sub-organizations, and chronological posts without like or comment controls

#### Scenario: Assigned officer customizes their organization profile
- **WHEN** an approved `officer` of an active organization (or an `admin`) opens that organization's page
- **THEN** the app shows customization controls for name, details, cover image, logo image, and publishing organization posts, while students and officers of other organizations see the page read-only

### Requirement: On-Device Image Pre-Compression (`SAB §7.3`, `ADR-007`)
The mobile client MUST pre-compress selected organization logos, cover images, and flyers on-device using `expo-image-manipulator` to bounded dimensions and WebP format before invoking `POST /functions/v1/compress-image`, enforcing the 5 MiB upload cap before transmission.

#### Scenario: Officer selects a cover or logo image on mobile
- **WHEN** an officer or admin runs the media upload helper with a local image URI for `logo`, `cover`, or `flyer`
- **THEN** the helper resizes the image within variant bounds via `expo-image-manipulator`, saves as WebP, rejects payloads exceeding 5 MiB, and sends a `multipart/form-data` request to `POST /functions/v1/compress-image` with the caller's Bearer JWT

### Requirement: Server-Side `compress-image` Edge Function & EXIF-Stripped WebP Pipeline (`FR-ORG-02`, `SAB §7.3`, `ADR-007`)
The system MUST expose `POST /functions/v1/compress-image` writing exclusively via the service role to the `org-media` bucket. It MUST enforce CORS allowlists, verify caller JWTs (`aud`, `iss`, and `auth.getUser`) and active `admin` or assigned `officer` access, reject disallowed MIME types, spoofed magic bytes, or payloads over 5 MiB, strip EXIF metadata, and store normalized WebP output.

#### Scenario: Unauthenticated or invalid JWT caller invokes `compress-image`
- **WHEN** a request reaches `POST /functions/v1/compress-image` with a missing, malformed, wrong-issuer/audience, or invalid Bearer token
- **THEN** the Edge Function returns `401 Unauthorized` without processing the file or touching Storage

#### Scenario: Unauthorized role or cross-organization officer invokes `compress-image`
- **WHEN** an authenticated `student` or an `officer` of Organization B uploads media targeting Organization A
- **THEN** the Edge Function returns `403 Forbidden` without writing to Storage

#### Scenario: Disallowed MIME type, spoofed magic bytes, or oversized payload reaches `compress-image`
- **WHEN** an authorized caller submits an unsupported MIME type (such as `image/svg+xml` or `text/plain`), mismatched magic bytes, or a file larger than 5 MiB (`5,242,880` bytes)
- **THEN** the Edge Function rejects the upload with `415 Unsupported Media Type` or `413 Payload Too Large`

#### Scenario: Authorized officer or admin uploads a valid JPEG, PNG, or WebP image
- **WHEN** an active `admin` or approved `officer` of Organization A submits a valid image within 5 MiB to `POST /functions/v1/compress-image`
- **THEN** the Edge Function strips EXIF metadata, normalizes the image to WebP, uploads it to `org-media/orgs/<organization_id>/<kind>/<asset_id>.webp` via the service role, and returns `201 Created` with the verified WebP URL and `exifStripped: true`
