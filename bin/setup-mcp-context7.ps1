$ErrorActionPreference = "Stop"

# Writes a local, secret-bearing Cursor MCP config for Context7.
# This file is intentionally gitignored: .cursor/mcp-config.json
#
# Requirements:
# - 1Password CLI (`op`) installed and signed in
# - $env:OP_CONTEXT7_API_KEY_REF set to a 1Password secret reference, e.g.
#     op://Your Vault/Your Item/CONTEXT7_API_KEY

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$OutFile = Join-Path $RepoRoot ".cursor\mcp-config.json"

if (-not $env:OP_CONTEXT7_API_KEY_REF) {
  throw "OP_CONTEXT7_API_KEY_REF is not set. Example: `$env:OP_CONTEXT7_API_KEY_REF = 'op://Your Vault/Your Item/CONTEXT7_API_KEY'"
}

try {
  $null = Get-Command op -ErrorAction Stop
} catch {
  throw "1Password CLI 'op' not found in PATH. Install it and ensure it's available from your shell."
}

$ApiKey = (op read $env:OP_CONTEXT7_API_KEY_REF).Trim()
if (-not $ApiKey) {
  throw "Retrieved empty API key from 1Password reference."
}

$Json = @"
{
  ""mcpServers"": {
    ""context7"": {
      ""httpUrl"": ""https://mcp.context7.com/mcp"",
      ""headers"": {
        ""CONTEXT7_API_KEY"": ""$ApiKey""
      }
    }
  }
}
"@

New-Item -ItemType Directory -Force -Path (Split-Path $OutFile) | Out-Null
$Json | Set-Content -Path $OutFile -Encoding UTF8

Write-Host "Wrote $OutFile"
