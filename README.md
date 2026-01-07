# ROM Runner - Development Bundle

**Bundle Version:** 1.1.0  
**Generated:** 2026-01-07  
**Status:** Ready for Cursor IDE development

## Quick Start

1. Extract this bundle to your project root
2. Run `npm create tauri-app@latest rom-runner` (or use existing Tauri project)
3. Copy these files into your project structure
4. Follow `docs/guides/ROM_Runner_Cursor_Setup_Guide.md`

## Cursor MCP (Context7) — keep keys out of git

- Template committed: `.cursor/mcp-config.example.json`
- Local secret file (gitignored): `.cursor/mcp-config.json`

Generate the local file from 1Password on each machine:

If an API key was ever committed to git history, rotate it (history can retain secrets even after deletion).

macOS/Linux:
```sh
export OP_CONTEXT7_API_KEY_REF='op://Your Vault/Your Item/CONTEXT7_API_KEY'
./bin/setup-mcp-context7.sh
```

Windows (PowerShell):
```powershell
$env:OP_CONTEXT7_API_KEY_REF = 'op://Your Vault/Your Item/CONTEXT7_API_KEY'
.\bin\setup-mcp-context7.ps1
```

## Directory Structure

```
rom-runner-bundle/
├── .cursor/                    # Cursor IDE configuration
│   └── rules                   # AI rules for Cursor
├── docs/                       # Documentation
│   ├── ROM_Runner_Complete_Requirements.md
│   ├── ROM_Runner_File_Manifest.md
│   ├── ROM_Runner_JSON_Schemas.json
│   ├── specs/                  # Detailed specifications
│   │   └── ROM_Runner_Theme_System_Specification_v1_0_0.md
│   ├── architecture/           # Architecture docs
│   ├── guides/                 # Setup & task guides
│   ├── analysis/               # Reviews & inventories
│   └── prompts/                # AI prompts for development
├── resources/                  # Static assets
│   └── branding/               # Logo files (NEW in v1.1.0)
│       ├── Rom_Runner_-_Badge_1.svg
│       ├── Rom_Runner_-_Badge_1_2x.png
│       ├── Rom_Runner_-_Full_1.svg
│       └── Rom_Runner_-_Full_1_2x.png
├── src/                        # Frontend (React/TypeScript)
│   ├── stores/                 # Zustand state management
│   ├── bindings/               # Tauri IPC bindings
│   ├── components/             # React components
│   └── styles/                 # CSS & Tailwind config
│       └── tokens.css          # Theme CSS custom properties
├── src-tauri/                  # Backend (Rust)
│   ├── src/
│   │   ├── database/           # SQLite schema & migrations
│   │   ├── commands/           # Tauri IPC commands
│   │   └── bios/               # BIOS verification types
│   └── definition-pack/        # Static data catalogs
│       ├── platforms.json      # 70+ gaming platforms
│       ├── emulators.json      # 100+ emulators
│       ├── devices.json        # 600+ handheld devices
│       ├── bios-hashes.json    # BIOS verification data
│       └── compatibility/      # Compatibility framework
├── scripts/                    # Python ingestor scripts
│   └── ingest/                 # Community data ingestors
└── samples/                    # Sample data files
```

## Key Files

| File | Purpose |
|------|---------|
| `docs/guides/ROM_Runner_Cursor_Setup_Guide.md` | Main setup instructions |
| `docs/guides/ROM_Runner_Phase0_Tasks.md` | Phase 0 task breakdown |
| `docs/specs/ROM_Runner_Theme_System_Specification_v1_0_0.md` | Theme system spec (NEW) |
| `src/stores/index.ts` | Zustand store exports |
| `src/styles/tokens.css` | Theme CSS custom properties |
| `src/bindings/commands.ts` | TypeScript IPC wrappers |
| `src-tauri/src/commands/mod.rs` | Rust command handlers |
| `src-tauri/src/database/schema.sql` | SQLite schema v1.0.1 |
| `resources/branding/` | Logo assets (NEW) |

## Version Summary

| Component | Version |
|-----------|---------|
| Requirements | v2.6.0 |
| JSON Schemas | v1.1.0 |
| SQLite Schema | v1.0.1 |
| Zustand Stores | v1.1.0 |
| Tauri Commands | v1.0.0 |
| Definition Pack | v2.x |
| Theme System | v1.0.0 |
| Cursor Rules | v1.1.0 |
| UI Architecture | v1.1.0 |
| Stores Architecture | v1.1.0 |

## What's Included

### Frontend (76+ files)
- 6 Zustand stores with full TypeScript types
- Tauri IPC bindings for 76 commands
- CSS design tokens & Tailwind configuration
- Theme system with 4 built-in themes (NEW in v1.1.0)

### Backend Stubs (3 files)
- Rust command signatures (stubs)
- SQLite schema + migration

### Definition Pack (9 files)
- platforms.json - 70+ platforms
- emulators.json - 100+ emulators
- devices.json - 600+ devices
- operating-systems.json - 60+ OS entries
- bios-hashes.json - Verification database
- Plus compatibility framework files

### Theme System (NEW in v1.1.0)
- 4 built-in theme families (Default, Neumorphism, Retro, Terminal)
- Light/dark/system color modes
- Custom theme import/export support
- WCAG 2.1 AA accessibility compliance
- Complete CSS custom properties

### Branding Assets (NEW in v1.1.0)
- Full logo (SVG + PNG @2x)
- Badge logo (SVG + PNG @2x)
- Brand color definitions

### Python Scripts (20+ files)
- Layer A: Official emulator compatibility scrapers
- Layer B: Emulator game settings parsers
- Layer C: Community sheet ingestors

## Theme Support

ROM Runner supports multiple visual themes:

| Theme | Description | Light | Dark |
|-------|-------------|:-----:|:----:|
| Default | Clean, modern professional | ✓ | ✓ |
| Neumorphism | Soft shadows, extruded UI | ✓ | ✓ |
| Retro | Vintage gaming aesthetic | ✓ | ✓ |
| Terminal | Green phosphor CRT style | — | Fixed |

See `docs/specs/ROM_Runner_Theme_System_Specification_v1_0_0.md` for details.

## Next Steps

1. Review `docs/guides/ROM_Runner_Cursor_Setup_Guide.md`
2. Complete Phase 0 tasks in `docs/guides/ROM_Runner_Phase0_Tasks.md`
3. Use `docs/guides/ROM_Runner_Quick_Reference.md` during development
4. Review theme system in `docs/specs/ROM_Runner_Theme_System_Specification_v1_0_0.md`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | Jan 7, 2026 | Added theme system, branding assets, updated stores/UI architecture |
| 1.0.0 | Jan 7, 2026 | Initial bundle release |
