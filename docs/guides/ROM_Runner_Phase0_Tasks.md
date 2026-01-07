# ROM Runner - Phase 0 Tasks

**Version:** 1.0.0  
**Phase:** Foundation  
**Duration:** 2-3 days  
**Goal:** Working app shell with navigation and database

---

## Task Overview

| # | Task | Priority | Assignee | Est. Time |
|---|------|----------|----------|-----------|
| 0.1 | Initialize Tauri Project | 🔴 | You | 30 min |
| 0.2 | Apply Cursor Configuration | 🔴 | You | 15 min |
| 0.3 | Set Up TailwindCSS | 🔴 | Cursor | 30 min |
| 0.4 | Create Design Tokens | 🔴 | Cursor | 20 min |
| 0.5 | Create AppShell Component | 🔴 | Cursor | 45 min |
| 0.6 | Create Sidebar Component | 🔴 | Cursor | 30 min |
| 0.7 | Create Titlebar Component | 🔴 | Cursor | 30 min |
| 0.8 | Set Up React Router | 🔴 | Cursor | 20 min |
| 0.9 | Initialize SQLite Database | 🟡 | Claude Code | 1 hr |
| 0.10 | Create Placeholder Screens | 🟢 | Cursor | 30 min |
| 0.11 | Load Definition Pack | 🟡 | Cursor | 45 min |
| 0.12 | Integration Test | 🟢 | You | 30 min |

---

## Task 0.1: Initialize Tauri Project

**Assignee:** You (manual)

```bash
npm create tauri-app@latest rom-runner -- --template react-ts
cd rom-runner
npm install
npm run tauri dev
```

**Acceptance:** App window opens with default Tauri template.

---

## Task 0.2: Apply Cursor Configuration

**Assignee:** You (manual)

1. Create `.cursorrules` file in project root (see Setup Guide)
2. Create `.cursorignore` file
3. Copy specification files to `docs/specs/`
4. Copy Zustand stores to `src/stores/`

**Acceptance:** Cursor recognizes project context.

---

## Task 0.3: Set Up TailwindCSS

**Assignee:** Cursor

**Prompt:**
```
Set up TailwindCSS for the ROM Runner Tauri project.

Requirements:
1. Install tailwindcss, postcss, autoprefixer
2. Create tailwind.config.ts with:
   - Custom colors for platform badges (nintendo: blue, playstation: blue, sega: red, etc.)
   - Custom colors for compatibility status (excellent: green, good: lime, playable: yellow, poor: orange, unplayable: red)
   - Font family: Inter for sans
   - Extended spacing scale
3. Update src/styles/index.css with Tailwind directives
4. Verify dark mode class strategy

Reference: docs/specs/UI_SCREEN_ARCHITECTURE_v1_1_0.md, Section 10 (Design System)
```

**Files Created:**
- `tailwind.config.ts`
- `postcss.config.js`
- `src/styles/index.css` (modified)

---

## Task 0.4: Create Design Tokens

**Assignee:** Cursor

**Prompt:**
```
Create CSS custom properties (design tokens) for ROM Runner.

Requirements:
1. Create src/styles/tokens.css with:
   - Color tokens for light/dark themes
   - Spacing tokens matching Tailwind scale
   - Typography tokens (font sizes, weights, line heights)
   - Border radius tokens
   - Shadow tokens for cards and modals
2. Import tokens.css in main stylesheet
3. Use CSS variables that can be toggled via .dark class on html

Reference: docs/specs/UI_SCREEN_ARCHITECTURE_v1_1_0.md, Section 10
```

**Files Created:**
- `src/styles/tokens.css`

---

## Task 0.5: Create AppShell Component

**Assignee:** Cursor

**Prompt:**
```
Create the AppShell layout component for ROM Runner.

Requirements:
1. Create src/components/layout/AppShell.tsx
2. Layout structure:
   - Fixed left sidebar (240px)
   - Top titlebar (40px)
   - Main content area (fills remaining space)
3. Use CSS Grid or Flexbox
4. Support collapsible sidebar (store state in uiStore)
5. Apply design tokens for colors and spacing
6. Support dark mode via TailwindCSS

Interface (from types.ts):
- Use uiStore's sidebarCollapsed state

Reference: docs/specs/UI_SCREEN_ARCHITECTURE_v1_1_0.md, Section 1 (App Shell)
```

**Files Created:**
- `src/components/layout/AppShell.tsx`
- `src/components/layout/index.ts`

---

## Task 0.6: Create Sidebar Component

**Assignee:** Cursor

**Prompt:**
```
Create the Sidebar navigation component for ROM Runner.

Requirements:
1. Create src/components/layout/Sidebar.tsx
2. Navigation items:
   - Library (icon: grid, route: /library)
   - Devices (icon: hard-drive, route: /devices)
   - BIOS Manager (icon: chip, route: /bios)
   - Settings (icon: settings, route: /settings)
3. Active state indicator (left border + background)
4. Collapse button at bottom
5. App logo at top (placeholder for now)
6. Use Lucide React icons
7. Keyboard navigation support

Reference: docs/specs/UI_SCREEN_ARCHITECTURE_v1_1_0.md, Section 1.3 (Sidebar)
```

**Files Created:**
- `src/components/layout/Sidebar.tsx`

---

## Task 0.7: Create Titlebar Component

**Assignee:** Cursor

**Prompt:**
```
Create a custom titlebar component for ROM Runner.

Requirements:
1. Create src/components/layout/Titlebar.tsx
2. Features:
   - Draggable region for window movement
   - Minimize, maximize, close buttons (use Tauri window API)
   - Current view title (from uiStore)
   - Search input (placeholder for now)
   - Quick actions dropdown (placeholder)
3. Height: 40px
4. Style: Match native titlebar appearance
5. Use @tauri-apps/api/window for window controls

Reference: docs/specs/UI_SCREEN_ARCHITECTURE_v1_1_0.md, Section 1.2 (Titlebar)
```

**Files Created:**
- `src/components/layout/Titlebar.tsx`

---

## Task 0.8: Set Up React Router

**Assignee:** Cursor

**Prompt:**
```
Set up React Router for ROM Runner navigation.

Requirements:
1. Install react-router-dom
2. Create src/router.tsx with routes:
   - / → redirect to /library
   - /library → LibraryScreen (placeholder)
   - /library/:gameId → GameDetailModal
   - /devices → DevicesScreen (placeholder)
   - /devices/new → DeviceWizard
   - /bios → BiosScreen (placeholder)
   - /settings → SettingsScreen (placeholder)
3. Wrap App in BrowserRouter
4. Use Outlet in AppShell for nested routes

Create placeholder components for each screen in src/screens/.
```

**Files Created:**
- `src/router.tsx`
- `src/screens/LibraryScreen.tsx`
- `src/screens/DevicesScreen.tsx`
- `src/screens/BiosScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/screens/index.ts`

---

## Task 0.9: Initialize SQLite Database

**Assignee:** Claude Code (complex)

**Prompt:**
```
Initialize the SQLite database for ROM Runner Tauri backend.

Requirements:
1. Use rusqlite crate
2. Create database at app data directory
3. Apply schema from docs/schema_v1_0_1.sql
4. Create Tauri commands:
   - init_database() → initialize on app start
   - get_db_stats() → return table counts
5. Run migrations on version mismatch
6. Handle errors gracefully

Tables needed (from schema):
- roms
- platforms
- emulators
- devices
- device_profiles
- bios_files
- deployments
- settings

Reference: ChatGPT_Work_Package_Review_v1_0_0.md for schema details
```

**Files Created:**
- `src-tauri/src/database/mod.rs`
- `src-tauri/src/database/schema.rs`
- `src-tauri/src/database/migrations.rs`
- Update `src-tauri/src/main.rs`

---

## Task 0.10: Create Placeholder Screens

**Assignee:** Cursor

**Prompt:**
```
Create placeholder screen components for ROM Runner.

For each screen, create a component that shows:
- Screen title
- Brief description
- "Coming soon" message
- Placeholder content area

Screens to create:
1. LibraryScreen - "Your ROM collection"
2. DevicesScreen - "Manage your devices"
3. BiosScreen - "BIOS file status"
4. SettingsScreen - "Application preferences"

All screens should:
- Fill the content area
- Use consistent styling
- Support dark mode
```

**Files Modified:**
- `src/screens/LibraryScreen.tsx`
- `src/screens/DevicesScreen.tsx`
- `src/screens/BiosScreen.tsx`
- `src/screens/SettingsScreen.tsx`

---

## Task 0.11: Load Definition Pack

**Assignee:** Cursor

**Prompt:**
```
Create a definition pack loader for ROM Runner.

Requirements:
1. Create src/utils/definitionPack.ts
2. Create Tauri command to load JSON files from definition-pack directory
3. Load on app startup:
   - platforms.json → store in library store
   - emulators.json → store in library store
4. Create TypeScript types matching JSON structure
5. Handle missing files gracefully
6. Cache loaded data

Create Rust command:
- load_definition_pack(filename: String) → Result<String, String>

Create TypeScript wrapper:
- loadPlatforms(): Promise<Platform[]>
- loadEmulators(): Promise<Emulator[]>
```

**Files Created:**
- `src/utils/definitionPack.ts`
- `src-tauri/src/commands/definition_pack.rs`

---

## Task 0.12: Integration Test

**Assignee:** You (manual)

**Checklist:**
- [ ] App launches without errors
- [ ] Sidebar navigation works
- [ ] All routes accessible
- [ ] Dark/light mode toggles
- [ ] No console errors
- [ ] Database initializes
- [ ] Window controls work

---

## Completion Criteria

Phase 0 is complete when:
1. ✅ App shell renders correctly
2. ✅ Navigation between screens works
3. ✅ Database is initialized
4. ✅ Design system is applied
5. ✅ Dark mode works
6. ✅ Definition pack loads

---

## Files Created This Phase

| Category | Files |
|----------|-------|
| Layout | AppShell.tsx, Sidebar.tsx, Titlebar.tsx |
| Screens | LibraryScreen.tsx, DevicesScreen.tsx, BiosScreen.tsx, SettingsScreen.tsx |
| Config | tailwind.config.ts, tokens.css, router.tsx |
| Backend | database/mod.rs, commands/definition_pack.rs |
| Utils | definitionPack.ts |

---

**End of Phase 0 Tasks v1.0.0**
