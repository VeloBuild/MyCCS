# Test Directories

This directory contains test infrastructure for the MyCCS app.

## Structure

```
tests/
├── api/           # Newman / Postman API test collections
│   ├── collection.json    # Postman collection export
│   └── environment.json   # Postman environment variables
├── e2e/           # Playwright E2E tests (web admin)
│   └── *.spec.ts
└── unit/          # Additional Jest unit tests
    └── *.test.ts
```

## Running Tests

```bash
# Unit tests (Jest)
npm test

# API tests (Newman)
newman run tests/api/collection.json -e tests/api/environment.json

# E2E tests (Playwright)
npx playwright test
```
