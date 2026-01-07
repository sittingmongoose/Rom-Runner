#!/usr/bin/env sh
set -eu

# Writes a local, secret-bearing Cursor MCP config for Context7.
# This file is intentionally gitignored: .cursor/mcp-config.json
#
# Requirements:
# - 1Password CLI (`op`) installed and signed in
# - OP_CONTEXT7_API_KEY_REF env var set to a 1Password secret reference, e.g.
#     op://Your Vault/Your Item/CONTEXT7_API_KEY

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_FILE="$REPO_ROOT/.cursor/mcp-config.json"

if [ -z "${OP_CONTEXT7_API_KEY_REF:-}" ]; then
  echo "ERROR: OP_CONTEXT7_API_KEY_REF is not set." >&2
  echo "Example: export OP_CONTEXT7_API_KEY_REF='op://Your Vault/Your Item/CONTEXT7_API_KEY'" >&2
  exit 1
fi

if ! command -v op >/dev/null 2>&1; then
  echo "ERROR: 1Password CLI 'op' not found in PATH." >&2
  exit 1
fi

API_KEY="$(op read "$OP_CONTEXT7_API_KEY_REF" | tr -d '\r\n')"
if [ -z "$API_KEY" ]; then
  echo "ERROR: Retrieved empty API key from 1Password reference." >&2
  exit 1
fi

tmp="$(mktemp)"
cat >"$tmp" <<EOF
{
  "mcpServers": {
    "context7": {
      "httpUrl": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "${API_KEY}"
      }
    }
  }
}
EOF

mkdir -p "$(dirname "$OUT_FILE")"
mv "$tmp" "$OUT_FILE"

# Best-effort: restrict permissions on POSIX systems.
chmod 600 "$OUT_FILE" 2>/dev/null || true

echo "Wrote $OUT_FILE"
