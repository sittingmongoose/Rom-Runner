# /data — ROM Runner data/definition-pack workflow

Use this when working on ingest scripts or definition-pack JSON.

## Checklist
1) Identify the input source and cite where it lives (docs, scripts/ingest, samples/).
2) Make changes deterministic: same input => same output.
3) If changing schemas, update docs/ROM_Runner_JSON_Schemas.json and any callers.
4) Prefer adding tests or validation scripts for new edge cases.

## Guardrails
- Avoid large rewrites; keep diffs small.
- Never commit secrets or API keys.
- Be careful with cross-platform file paths.
