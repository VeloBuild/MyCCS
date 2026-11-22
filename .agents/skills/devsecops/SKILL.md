---
name: devsecops
description: Skill to parse Snyk/CodeQL outputs and verify JWT validation in Edge Functions.
---

# DevSecOps Skill

This skill provides instructions for executing security reviews on dependencies and edge functions.

## 1. Parse Snyk & CodeQL Outputs
- Look for `snyk-report.json` or `.sarif` outputs from CodeQL in the CI artifacts or local workspace.
- Parse these files to extract vulnerabilities.
- For Snyk: Focus on `critical` and `high` severity vulnerabilities. Note the `fixedIn` version if available.
- For CodeQL: Extract rule IDs and remediation advice. Any `critical` or `high` finding must be surfaced as a release blocker.

## 2. Verify Edge Function JWT Validation
- Edge functions are located in `supabase/functions/`.
- Inspect `.ts` files inside these folders.
- Ensure each function securely validates the caller by checking for `supabaseClient.auth.getUser()` or manual JWKS verification.
- Verify that both `aud` (audience) and `iss` (issuer) claims are validated.
- Search for hardcoded secrets or passwords and flag them immediately as `critical`.
