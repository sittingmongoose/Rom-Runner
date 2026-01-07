# /design — ROM Runner architecture & UX guidance

Goal: help evolve ROM Runner's design without drifting from the docs.

## How to respond
1) Start by citing which doc sections you used (README + docs/...).
2) Provide a short, actionable plan (bullets).
3) Call out any assumptions or unknowns explicitly.

## Repo priors
- Cross-platform: macOS + Windows + Linux.
- Dev happens on multiple machines and sometimes over SSH to an Unraid server.
- GitHub is the source of truth; project settings should be reproducible.

## Guardrails
- Keep changes minimal and reviewable.
- Do not introduce secrets into git.
- Prefer clear naming + schema evolution patterns over large refactors.