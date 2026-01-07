# ROM Runner - Quick Reference Card

**Version:** 1.0.0  
**For:** Development in Cursor IDE

---

## 🚀 Quick Start Commands

```bash
# Development
npm run tauri dev          # Start dev server + Tauri
npm run dev                # Frontend only

# Building
npm run build              # Build frontend
npm run tauri build        # Build desktop app

# Testing
npm test                   # Run tests
npm run lint               # ESLint
npm run type-check         # TypeScript check

# Rust
cd src-tauri && cargo build    # Build backend
cd src-tauri && cargo test     # Test backend
cd src-tauri && cargo clippy   # Lint backend
```

---

## 📁 Key File Locations

| What | Where |
|------|-------|
| TypeScript interfaces | `src/stores/types.ts` |
| Zustand stores | `src/stores/` |
| Components | `src/components/[domain]/` |
| Screens | `src/screens/` |
| Design tokens | `src/styles/tokens.css` |
| Tauri commands | `src-tauri/src/commands/` |
| Definition pack | `src-tauri/definition-pack/` |
| Specifications | `docs/specs/` |

---

## 🎨 Design Tokens Quick Reference

### Colors (use Tailwind classes)

| Token | Light | Dark | Class |
|-------|-------|------|-------|
| Background | white | slate-900 | `bg-background` |
| Surface | slate-50 | slate-800 | `bg-surface` |
| Primary | blue-600 | blue-500 | `bg-primary` |
| Accent | purple-600 | purple-500 | `bg-accent` |

### Platform Colors

```
nintendo     → bg-platform-nintendo (blue)
playstation  → bg-platform-playstation (blue)
sega         → bg-platform-sega (red)
arcade       → bg-platform-arcade (yellow)
other        → bg-platform-other (gray)
```

### Compatibility Status

```
excellent   → bg-status-excellent (green)
good        → bg-status-good (lime)
playable    → bg-status-playable (yellow)
poor        → bg-status-poor (orange)
unplayable  → bg-status-unplayable (red)
unknown     → bg-status-unknown (gray)
```

### Spacing Scale

```
0.5 = 2px    4 = 16px    12 = 48px
1 = 4px      6 = 24px    16 = 64px
2 = 8px      8 = 32px    24 = 96px
```

---

## 🏪 Zustand Stores

### libraryStore
```typescript
// State
games, platforms, emulators, filter, sortBy, viewMode

// Actions
loadLibrary(), scanDirectory(), setFilter(), importGames()
```

### deviceStore
```typescript
// State
devices, profiles, connectedDevices, selectedDevice

// Actions
loadDevices(), createProfile(), detectDevices(), selectDevice()
```

### deploymentStore
```typescript
// State
deployments, activeDeployment, queue, progress

// Actions
createDeployment(), startTransfer(), pauseTransfer(), cancelDeployment()
```

### settingsStore
```typescript
// State
theme, language, paths, overrides

// Actions
setTheme(), updatePaths(), resetToDefaults()
```

### biosStore
```typescript
// State
biosFiles, scanResults, verificationStatus

// Actions
scanBiosDirectory(), verifyFile(), copyBiosFile()
```

### uiStore
```typescript
// State
sidebarCollapsed, activeModal, notifications, currentView

// Actions
toggleSidebar(), openModal(), closeModal(), showNotification()
```

---

## 🔧 Common Patterns

### Component with Loading State

```tsx
const MyComponent = () => {
  const { data, isLoading, error } = useTauriQuery(
    ['key'],
    () => invoke('command')
  )

  if (isLoading) return <Skeleton />
  if (error) return <ErrorState error={error} />
  if (!data?.length) return <EmptyState />

  return <Content data={data} />
}
```

### Using Store Selector

```tsx
// ✅ Good - only re-renders when 'games' changes
const games = useLibraryStore(state => state.games)

// ❌ Bad - re-renders on any store change
const store = useLibraryStore()
```

### Tauri Command Call

```tsx
import { invoke } from '@tauri-apps/api/core'

const result = await invoke<ReturnType>('command_name', {
  param1: value1,
  param2: value2
})
```

---

## 📋 Cursor Prompt Templates

### New Component

```
Create [ComponentName] component for ROM Runner.

Requirements:
- [list requirements]
- Use interfaces from src/stores/types.ts
- Support dark mode with Tailwind
- Handle loading/error/empty states

Reference: docs/specs/UI_SCREEN_ARCHITECTURE_v1_0_0.md
Section: [relevant section]
```

### Bug Fix

```
Fix: [describe bug]

Steps to reproduce:
1. [step]
2. [step]

Expected: [what should happen]
Actual: [what happens instead]

Files involved:
- [file paths]
```

### Feature Addition

```
Add [feature] to [component/screen].

Context:
ROM Runner is a Tauri desktop app for ROM management.

Requirements:
- [requirements]

Reference files:
- docs/specs/[relevant doc]
```

---

## 🚨 Escalation Guide

### When to Ask Claude (in Claude.ai)

- Architecture decisions
- Complex business logic
- Performance optimization
- Multi-system bugs
- Security concerns

### When to Use ChatGPT Codex

- Generating many similar components
- Boilerplate code
- Test generation
- Documentation

### When Cursor Can Handle It

- Simple components
- Styling changes
- Config files
- Small refactors

---

## ❌ Don't Do This

1. Create duplicate interfaces (check types.ts first)
2. Subscribe to entire Zustand store
3. Use arbitrary Tailwind values
4. Skip dark mode support
5. Forget loading/error/empty states
6. Use `any` type
7. Commit console.log statements
8. Ignore TypeScript errors

---

## ✅ Do This

1. Check types.ts before creating interfaces
2. Use Zustand selectors
3. Use design tokens
4. Test dark mode
5. Handle all component states
6. Use proper TypeScript types
7. Write basic tests
8. Follow file naming conventions

---

## 🔗 Quick Links

| Resource | Location |
|----------|----------|
| Requirements | `docs/specs/ROM_Runner_Complete_Requirements_v2_5_0.md` |
| JSON Schemas | `docs/specs/ROM_Runner_JSON_Schemas_v1_1_0.json` |
| UI Architecture | `docs/specs/UI_SCREEN_ARCHITECTURE_v1_0_0.md` |
| Store Architecture | `docs/specs/STORES_ARCHITECTURE_v1_0_0.md` |
| File Manifest | `docs/ROM_Runner_File_Manifest_v2_5_0.md` |

---

**End of Quick Reference v1.0.0**
