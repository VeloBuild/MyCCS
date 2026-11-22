#!/usr/bin/env bash
set -euo pipefail

# Mirrors canonical Agent Skill from .agents/skills/myccs-workflow (Antigravity & Codex)
# into .claude/skills/myccs-workflow (Claude Code) so all three harnesses stay in sync.
SKILL="myccs-workflow"

mkdir -p .claude/skills
rm -rf ".claude/skills/${SKILL}"
cp -R ".agents/skills/${SKILL}" ".claude/skills/${SKILL}"
rm -rf ".claude/skills/${SKILL}/agents"

echo "Synced ${SKILL} from .agents/skills/ -> .claude/skills/."
