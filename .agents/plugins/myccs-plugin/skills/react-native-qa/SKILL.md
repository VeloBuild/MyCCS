---
name: react-native-qa
description: Skill to evaluate Jest coverage, Playwright traces, and AsyncStorage security in React Native.
---

# React Native QA Skill

Instructions for executing QA checks on the MyCCS Expo React Native app.

## 1. Parse Jest Coverage
- Read the `coverage/coverage-summary.json` file.
- Validate that coverage meets the strict thresholds:
  - Statements: >= 80%
  - Branches: >= 75%
  - Functions: >= 80%
  - Lines: >= 80%
- Report precise numbers. Fail the check if any threshold is not met.

## 2. Evaluate Playwright Traces
- Playwright E2E results are usually stored in `playwright-report/` or `test-results/`.
- Look for failure events in traces. A trace with zero assertions is considered an incomplete test (warn the user).
- Extract the exact step failure and error logs for the user.

## 3. Review AsyncStorage Usage
- Scan React Native source code (`src/` or `app/`) for usages of `@react-native-async-storage/async-storage`.
- Ensure no sensitive keys (`token`, `password`, `secret`, `jwt`) are used. Advise switching to `expo-secure-store` for these.
- Ensure every `AsyncStorage.getItem` or `setItem` is wrapped in a `try/catch` block for proper error handling.
