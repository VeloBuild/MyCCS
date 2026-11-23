---
alwaysApply: true
applyTo: "**"
description: MyCCS repo-wide coding rules
---

# MyCCS Repository Rules

- Read [AGENTS.md](../../AGENTS.md) before making changes.
- Use the docs in [docs/jira](../../docs/jira) as policy references instead of duplicating them.
- Keep frontend changes Expo-compatible and narrowly scoped.
- Keep Supabase schema or RLS updates in the same change set as the code that depends on them.
- Add or update tests when the behavior changes.
- Keep the AI workflow contracts in `ai/` synchronized with the agent prompt files in `.github/agents/`.
