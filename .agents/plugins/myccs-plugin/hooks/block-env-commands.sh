#!/usr/bin/env bash
# block-env-commands.sh
# PreToolUse hook for run_command — blocks shell commands that would print or cat .env files.
#
# Contract:
#   stdin  → JSON: { "tool_name": "run_command", "tool_input": { "CommandLine": "..." } }
#   stdout → JSON: { "allow_tool": true } | { "allow_tool": false, "deny_reason": "..." }
#   exit   → always 0

set -euo pipefail

input=$(cat)

# Extract the CommandLine value
command_line=$(echo "$input" | grep -oE '"CommandLine"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"')

if [ -z "$command_line" ]; then
  echo '{"allow_tool": true}'
  exit 0
fi

cmd_lower=$(echo "$command_line" | tr '[:upper:]' '[:lower:]')

# Block commands that read or print sensitive files
sensitive_patterns=(
  "cat .*\.env"
  "cat.*\.pem"
  "cat.*\.key"
  "type .*\.env"
  "get-content.*\.env"
  "echo.*env"
  "printenv"
  "env | "
  "set | grep"
  "cat.*google-services"
  "cat.*googleservice-info"
  "cat.*service-account"
  "cat.*credentials\."
  "cat.*secrets\."
)

for pattern in "${sensitive_patterns[@]}"; do
  if echo "$cmd_lower" | grep -qE "$pattern"; then
    echo "{\"allow_tool\": false, \"deny_reason\": \"MyCCS Plugin: Command blocked by sensitive-file-guard — shell commands that print credential files are not permitted. Ask the user to share only the specific value needed.\"}"
    exit 0
  fi
done

# Block committing blocked files to git
if echo "$cmd_lower" | grep -qE "git (add|commit).*\.env" ; then
  echo "{\"allow_tool\": false, \"deny_reason\": \"MyCCS Plugin: Committing .env files to Git is blocked. Ensure .env is listed in .gitignore.\"}"
  exit 0
fi

echo '{"allow_tool": true}'
exit 0
