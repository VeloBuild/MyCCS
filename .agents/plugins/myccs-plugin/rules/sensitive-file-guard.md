---
trigger: always_on
description: Block any agent from reading, printing, or logging the contents of .env or other credential files.
---

## Sensitive File Guard

Never read, print, log, or include the contents of any file that may contain secrets or credentials. This applies in every context without exception.

### Blocked files — exact match

- `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.test`
- Any file matching `.env.*.local`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.cer`, `*.crt`
- Files named `secrets.*`, `credentials.*`, `service-account*.json`
- `**/google-services.json`, `**/GoogleService-Info.plist`

### Behaviour

- If a task requires knowing an environment variable's **value**, ask the user to paste only that value into the chat — never read the file.
- If a task requires knowing what **keys** exist, read `.env.example` or `.env.sample` only.
- If secret content is accidentally encountered, do not reproduce it — stop and notify the user.
- Never suggest committing any of the above files to Git.
