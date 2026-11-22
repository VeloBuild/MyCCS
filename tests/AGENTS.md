# Tests Directory Agent Instructions (`tests/`)

## Purpose

Houses the multi-tiered automated QA suite aligned with CI Phase 3:
- `tests/unit/` — Jest + `jest-expo` unit/component tests (mobile UI, offline SQLite queue/reconciliation, conditional form Zod schemas).
- `tests/api/` — Postman/Newman collections testing Supabase REST endpoints, RLS policies, `compress-image`, and `import-gmetrix-keys`.
- `tests/e2e/` — Playwright headless browser E2E tests for the standalone `web-admin/` portal.

## Commands

- Run Jest unit tests: `npm test`
- Run CI-mode Jest with coverage: `npm test -- --coverage --ci`

## Conventions

- Add or update tests whenever behavior, RLS policies, Zod schemas, or Edge Functions change.
- Test offline edge cases explicitly: `clock_offset_ms`, cooldown duplicate suppression, officer rescan check-out, and auto-checkout timeout.
- Test GMetrix CSV edge cases explicitly: partial commit on unregistered emails, duplicate `key_code` idempotency, formula-injection sanitization (`=`, `+`, `-`, `@`), and content-free push payloads.
- Never hardcode real secrets or institutional credentials in test fixtures or Postman environments.

## References

- [tests/README.md](README.md)
- [CI/CD Pipeline Specification](../docs/jira/CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)
- [Repo Rules](../rules.md)
