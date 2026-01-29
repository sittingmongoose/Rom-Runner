# ROM Runner - Cursor Development Setup Guide

**Version:** 1.0.0  
**Created:** January 6, 2026  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pre-Cursor Setup](#2-pre-cursor-setup)
3. [Project Structure](#3-project-structure)
4. [Cursor Configuration](#4-cursor-configuration)
5. [Development Phases](#5-development-phases)
6. [Task Templates](#6-task-templates)
7. [Working with AI Models](#7-working-with-ai-models)
8. [Quality Assurance](#8-quality-assurance)
9. [File Tracking Protocol](#9-file-tracking-protocol)

---

## 1. Overview

ROM Runner is a Tauri 2.0 desktop application for managing retro gaming ROM collections and deploying them to handheld gaming devices. This guide explains how to set up and develop the project using Cursor IDE.

### Tech Stack
- **Frontend:** React 18+ with TypeScript, Zustand, TanStack Query, TailwindCSS
- **Backend:** Rust with tokio, serde, rusqlite
- **Framework:** Tauri 2.0
- **Database:** SQLite

### Development Timeline
- **Phase 0-1:** Foundation & Library (7-10 days)
- **Phase 2-3:** Devices & BIOS (7-9 days)
- **Phase 4-5:** Deployment & Settings (10-14 days)
- **Phase 6:** Compatibility (5-7 days)
- **Total:** ~30-40 days to MVP

---

## 2. Pre-Cursor Setup

### Step 1: Initialize Tauri Project

```bash
# Create new Tauri project with React TypeScript template
npm create tauri-app@latest rom-runner -- --template react-ts
cd rom-runner

# Verify it works
npm install
npm run tauri dev
```

### Step 2: Create Folder Structure

```bash
# Frontend directories
mkdir -p src/{components,hooks,stores,types,utils,styles}
mkdir -p src/components/{layout,library,devices,deployment,bios,settings,common,icons,providers}

# Backend directories (in src-tauri/src)
mkdir -p src-tauri/src/{commands,database,transfer,device,bios}

# Definition pack (runtime data)
mkdir -p src-tauri/definition-pack/{compatibility,retrocatalog}

# Documentation
mkdir -p docs/{specs,guides,integration}

# Scripts
mkdir -p scripts/{ingest,layerC,bios}
```

### Step 3: Copy Specification Files

From your project archives, copy to `docs/specs/`:
- `ROM_Runner_Complete_Requirements_v2_5_0.md`
- `ROM_Runner_JSON_Schemas_v1_1_0.json`
- `UI_SCREEN_ARCHITECTURE_v1_0_0.md`
- `STORES_ARCHITECTURE_v1_0_0.md`

### Step 4: Copy Zustand Stores

Copy to `src/stores/` (rename to remove version suffix):
```
types_v1_0_0.ts → types.ts
libraryStore_v1_0_0.ts → libraryStore.ts
deviceStore_v1_0_0.ts → deviceStore.ts
deploymentStore_v1_0_0.ts → deploymentStore.ts
settingsStore_v1_0_0.ts → settingsStore.ts
biosStore_v1_0_0.ts → biosStore.ts
uiStore_v1_0_0.ts → uiStore.ts
index_v1_0_0.ts → index.ts
```

### Step 5: Copy Definition Pack Files

Copy to `src-tauri/definition-pack/`:
- `platforms_v2_0_0.json` → `platforms.json`
- `emulators_v2_1_0.json` → `emulators.json`
- `devices.json`
- `bios-hashes_v2_0_1.json` → `bios-hashes.json`
- `operating-systems_v2_1_0.json` → `operating-systems.json`
- All other JSON data files

### Step 6: Copy Design System

- `tailwind_config.ts` → `tailwind.config.ts` (root)
- `tokens.css` → `src/styles/tokens.css`

---

## 3. Project Structure

```
rom-runner/
├── .cursorrules                  # Cursor configuration
├── .cursorignore                 # Files to exclude from AI context
├── docs/
│   ├── specs/                    # Specification documents
│   │   ├── ROM_Runner_Complete_Requirements_v2_5_0.md
│   │   ├── ROM_Runner_JSON_Schemas_v1_1_0.json
│   │   ├── UI_SCREEN_ARCHITECTURE_v1_0_0.md
│   │   └── STORES_ARCHITECTURE_v1_0_0.md
│   └── guides/                   # Development guides
├── src/
│   ├── components/
│   │   ├── layout/               # AppShell, Sidebar, Titlebar
│   │   ├── library/              # GameCard, GameGrid, GameList
│   │   ├── devices/              # DeviceCard, DeviceWizard
│   │   ├── deployment/           # DeploymentConfig, Progress
│   │   ├── bios/                 # BiosStatus, BiosManager
│   │   ├── settings/             # PreferencesForm, ThemeToggle
│   │   ├── common/               # Button, Card, Modal, etc.
│   │   └── icons/                # Platform and UI icons
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand stores
│   ├── types/                    # TypeScript interfaces
│   ├── utils/                    # Helper functions
│   └── styles/                   # CSS files
├── src-tauri/
│   ├── src/
│   │   ├── commands/             # Tauri IPC commands
│   │   ├── database/             # SQLite operations
│   │   ├── transfer/             # File transfer engine
│   │   ├── device/               # Device detection
│   │   └── bios/                 # BIOS verification
│   └── definition-pack/          # Runtime JSON data
├── scripts/                      # Python ingestor scripts
└── resources/                    # Static assets
```

---

## 4. Cursor Configuration

### .cursorrules File

Create `.cursorrules` in project root:

```markdown
# ROM Runner - Cursor Rules

## Project Overview
ROM Runner is a Tauri 2.0 desktop app for managing retro gaming ROM collections.

## Tech Stack
- Frontend: React 18, TypeScript 5, Zustand, TailwindCSS
- Backend: Rust, Tauri 2.0, SQLite
- Key Libraries: TanStack Query, TanStack Virtual, Radix UI

## Code Standards

### TypeScript
- Use interfaces from `src/stores/types.ts` - never create duplicates
- Use `import type` for type-only imports
- Prefer `const` assertions for string literals

### React Components
- Functional components only with hooks
- Props interfaces named `{Component}Props`
- Use Zustand selectors, never full store subscriptions
- Support both light and dark themes

### Styling
- Use TailwindCSS classes only
- Use design tokens from `tokens.css`
- No inline styles except dynamic values
- Follow spacing scale: 0.5, 1, 2, 4, 6, 8, 12, 16, 24

### File Naming
- Components: PascalCase.tsx
- Hooks: camelCase.ts (useWhatever.ts)
- Utils: camelCase.ts
- Types: types.ts (one per domain)

## Reference Files
- `docs/specs/ROM_Runner_JSON_Schemas_v1_1_0.json` - All TypeScript interfaces
- `docs/specs/UI_SCREEN_ARCHITECTURE_v1_0_0.md` - Component wireframes
- `docs/specs/STORES_ARCHITECTURE_v1_0_0.md` - State management

## Patterns to Follow
- Use `invoke()` for all Tauri commands
- Handle loading/error/empty states for all async operations
- Use optimistic updates where appropriate
- Implement keyboard navigation (Tab, Arrow keys, Enter, Escape)

## Do Not
- Create new TypeScript interfaces if one exists in types.ts
- Use the full Zustand store - use specific selectors
- Hardcode data that should come from definition-pack
- Skip dark mode support
- Use arbitrary Tailwind values - use design tokens
```

### .cursorignore File

Create `.cursorignore` to exclude large files from AI context:

```
# Large JSON definition files
src-tauri/definition-pack/*.json
!src-tauri/definition-pack/platformPolicies.json

# Build outputs
target/
dist/
node_modules/

# Logs and caches
*.log
.cache/

# Test fixtures
tests/fixtures/
```

---

## 5. Development Phases

### Phase 0: Foundation (2-3 days)
**Goal:** Working app shell with navigation

| Task | Priority | Assignee |
|------|----------|----------|
| Initialize Tauri project | 🔴 | You |
| Apply .cursorrules | 🔴 | You |
| Set up Tailwind + design tokens | 🔴 | Cursor |
| Create AppShell component | 🔴 | Cursor |
| Create Sidebar navigation | 🔴 | Cursor |
| Set up React Router | 🔴 | Cursor |
| Initialize SQLite database | 🟡 | Claude Code |
| Create placeholder screens | 🟢 | Cursor |

### Phase 1: Library (5-7 days)
**Goal:** ROM scanning and display

| Task | Priority | Assignee |
|------|----------|----------|
| Implement ROM scanning (Rust) | 🔴 | Claude Code |
| Create GameCard component | 🔴 | Cursor |
| Create GameGrid/GameList views | 🔴 | Cursor |
| Implement filtering/sorting | 🟡 | Cursor |
| Add metadata scraping | 🟡 | Claude Code |
| Create ImportWizard | 🟡 | Cursor |

### Phase 2: Devices (4-5 days)
**Goal:** Device profiles and path configuration

| Task | Priority | Assignee |
|------|----------|----------|
| Create DeviceCard component | 🔴 | Cursor |
| Create DeviceWizard (6 steps) | 🔴 | Cursor/Codex |
| Implement device detection | 🟡 | Claude Code |
| Create profile management | 🟡 | Cursor |

### Phase 3: BIOS (3-4 days)
**Goal:** BIOS verification and status

| Task | Priority | Assignee |
|------|----------|----------|
| Implement BIOS scanner (Rust) | 🔴 | Claude Code |
| Create BiosStatusGrid | 🔴 | Cursor |
| Create BiosDetailModal | 🟡 | Cursor |
| Add file copy functionality | 🟡 | Cursor |

### Phase 4: Deployment (7-10 days)
**Goal:** Full deployment pipeline

| Task | Priority | Assignee |
|------|----------|----------|
| Create DeploymentConfig wizard | 🔴 | Cursor |
| Implement transfer engine (Rust) | 🔴 | Claude Code |
| Create progress tracking UI | 🔴 | Cursor |
| Add resume capability | 🟡 | Claude Code |
| Implement format conversion | 🟡 | Claude Code |

### Phase 5: Settings (3-4 days)
**Goal:** Preferences and polish

| Task | Priority | Assignee |
|------|----------|----------|
| Create Settings screen | 🔴 | Cursor |
| Implement theme switching | 🟡 | Cursor |
| Add path overrides | 🟡 | Cursor |
| Create About modal | 🟢 | Cursor |

### Phase 6: Compatibility (5-7 days)
**Goal:** Performance-aware filtering

| Task | Priority | Assignee |
|------|----------|----------|
| Load compatibility data | 🔴 | Cursor |
| Create compatibility indicators | 🔴 | Cursor |
| Implement smart filtering | 🟡 | Cursor |
| Add performance tooltips | 🟢 | Cursor |

---

## 6. Task Templates

### For Cursor Plan Mode

```markdown
## Task: [Component Name]

### Context
ROM Runner is a Tauri desktop app for managing ROMs.
See `docs/specs/UI_SCREEN_ARCHITECTURE_v1_0_0.md` for wireframes.

### Requirements
- [Specific requirements from specs]

### Files to Create/Modify
- `src/components/[path]/ComponentName.tsx`
- `src/components/[path]/ComponentName.test.tsx`

### Interfaces (from types.ts)
- Use `GameEntry` interface for game data
- Use `DeviceProfile` interface for device data

### Acceptance Criteria
- [ ] Component renders correctly
- [ ] Dark/light theme support
- [ ] Keyboard accessible
- [ ] Loading/error/empty states handled
```

### For Claude Code (Complex Tasks)

```markdown
## Task: [Rust Feature]

### Context
ROM Runner backend uses Rust with Tauri 2.0, rusqlite, and tokio.

### Requirements
- [Technical requirements]

### Files
- `src-tauri/src/[module]/mod.rs`

### Expected Behavior
- [Detailed behavior spec]

### Error Handling
- Handle [specific error cases]
```

---

## 7. Working with AI Models

### Model Assignment Guide

| Task Type | Best Model | Reason |
|-----------|------------|--------|
| Complex Rust algorithms | Claude Code | Deep reasoning |
| UI components (bulk) | ChatGPT Codex | Fast generation |
| Simple components | Cursor | Quick iterations |
| Debugging | Claude Code | Systematic analysis |
| Config/boilerplate | Cursor | Pattern following |
| Documentation | Any | All capable |

### Cursor Plan Mode Tips

1. **Be specific:** Include file paths and interface names
2. **Reference specs:** Point to relevant documentation
3. **Set constraints:** Specify what NOT to do
4. **Check interfaces:** Ensure it uses existing types

### Escalation Criteria

**Escalate to Claude (in Claude.ai) when:**
- Architecture decisions needed
- Complex business logic
- Cross-cutting concerns
- Bug affecting multiple systems
- Performance optimization

**Use ChatGPT Codex when:**
- Generating many similar components
- API integration boilerplate
- Test file generation
- Documentation generation

---

## 8. Quality Assurance

### Per-Component Checklist

- [ ] TypeScript: No `any` types
- [ ] Styling: Uses Tailwind + design tokens
- [ ] Themes: Works in light and dark mode
- [ ] Accessibility: Keyboard navigable
- [ ] States: Loading, error, empty handled
- [ ] Tests: Basic test file exists

### Before Phase Completion

- [ ] All components render without errors
- [ ] No console warnings/errors
- [ ] Responsive at 1024px+ widths
- [ ] File names follow conventions
- [ ] Imports use types.ts interfaces

---

## 9. File Tracking Protocol

### When Creating Files

Report format:
```
CREATED: ComponentName_v1_0_0.tsx
Location: src/components/[path]/
```

### When Modifying Files

Report format:
```
MODIFIED: ComponentName.tsx
Changes: Added dark mode support
Version: 1.0.0 → 1.0.1
```

### When Deprecating Files

Report format:
```
DEPRECATED: OldComponent.tsx
Replaced by: NewComponent.tsx
```

### Session Summary Template

At end of each session, provide:
```
## Session Summary [Date]

### Files Created
- [list]

### Files Modified
- [list with version changes]

### Files Deprecated
- [list with replacements]

### Outstanding Issues
- [any blockers or questions]
```

---

## Quick Commands Reference

```bash
# Development
npm run tauri dev          # Start dev server
npm run build              # Build frontend
npm run tauri build        # Build desktop app

# Testing
npm test                   # Run frontend tests
cd src-tauri && cargo test # Run Rust tests

# Linting
npm run lint               # ESLint
npm run type-check         # TypeScript check
cd src-tauri && cargo clippy # Rust linting
```

---

**End of Setup Guide v1.0.0**
