#!/usr/bin/env bash
# sensitive-file-guard.sh
# PreToolUse hook for read_file — blocks access to .env and credential files.
#
# Contract:
#   stdin  → JSON: { "tool_name": "read_file", "tool_input": { "AbsolutePath": "..." } }
#   stdout → JSON: { "allow_tool": true } | { "allow_tool": false, "deny_reason": "..." }
#   exit   → always 0

set -euo pipefail

input=$(cat)

# Extract the file path from tool input
file_path=$(echo "$input" | grep -oE '"AbsolutePath"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"')

if [ -z "$file_path" ]; then
  echo '{"allow_tool": true}'
  exit 0
fi

# Normalise to basename and extension for pattern matching
basename_lower=$(basename "$file_path" | tr '[:upper:]' '[:lower:]')
ext="${basename_lower##*.}"

# --- Blocked exact filenames ---
blocked_names=(
  ".env"
  ".env.local"
  ".env.development"
  ".env.production"
  ".env.staging"
  ".env.test"
  "secrets.json"
  "secrets.yaml"
  "secrets.yml"
  "credentials.json"
  "google-services.json"
  "googleservice-info.plist"
)

for blocked in "${blocked_names[@]}"; do
  if [ "$basename_lower" = "$blocked" ]; then
    echo "{\"allow_tool\": false, \"deny_reason\": \"MyCCS Plugin: Reading '$basename_lower' is blocked. Sensitive credential files must not be accessed by agents. Use .env.example to inspect available keys.\"}"
    exit 0
  fi
done

# --- .env.*.local pattern ---
if echo "$basename_lower" | grep -qE '^\.env\..+\.local$'; then
  echo "{\"allow_tool\": false, \"deny_reason\": \"MyCCS Plugin: Reading environment override file '$basename_lower' is blocked.\"}"
  exit 0
fi

# --- Blocked file extensions ---
blocked_exts=("pem" "key" "p12" "pfx" "cer" "crt" "jks" "keystore")
for blocked_ext in "${blocked_exts[@]}"; do
  if [ "$ext" = "$blocked_ext" ]; then
    echo "{\"allow_tool\": false, \"deny_reason\": \"MyCCS Plugin: Reading '.$ext' certificate/key files is blocked by the sensitive-file-guard hook.\"}"
    exit 0
  fi
done

# --- service-account*.json pattern ---
if echo "$basename_lower" | grep -qE '^service-account.*\.json$'; then
  echo "{\"allow_tool\": false, \"deny_reason\": \"MyCCS Plugin: Reading service account credential files is blocked.\"}"
  exit 0
fi

echo '{"allow_tool": true}'
exit 0
