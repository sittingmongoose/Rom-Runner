# ROM Runner Definition Files Manifest
**Version:** 2.6.0  
**Last Updated:** January 7, 2026  
**Purpose:** Comprehensive tracking of files in the ROM Runner development bundle (definition pack + stubs + scripts + docs)
---
## Summary of Changes (v2.6.0)
This update aligns the manifest with the current bundle layout (filenames, folders, and newly added docs/scripts).
### Notable Updates
- Updated requirements to **v2.6.0** (`docs/ROM_Runner_Complete_Requirements_v2_6_0.md`).
- Standardized on **stable filenames** for definition-pack JSON (versions live inside the JSON `version` field).
- Updated architecture docs to **v1.1.0**.
- Added bundle tooling docs and Cursor command templates.

### Key Renames from prior manifest
| Area | Old Name (examples) | Current Name |
|------|----------------------|--------------|
| Docs | `ROM_Runner_JSON_Schemas_v1_1_0.json` | `docs/ROM_Runner_JSON_Schemas.json` |
| Stores | `*_v1_0_0.ts` | `src/stores/*.ts` (unversioned filenames) |
| IPC bindings | `commands_v1_0_0.ts` | `src/bindings/commands.ts` |
| Tauri commands | `commands_v1_0_0.rs` | `src-tauri/src/commands/mod.rs` |
| SQLite schema | `schema_v1_0_1.sql` | `src-tauri/src/database/schema.sql` |
| Definition pack | `platforms_v2_0_0.json` etc. | `src-tauri/definition-pack/platforms.json` etc. |

---
## Bundle Root Structure
Paths below are **relative to the bundle root**.

```
.
├── README.md
├── .cursorrules
├── .cursor/
├── .claude/
├── .codex/
├── .vscode/
├── bin/
├── docs/
├── resources/
├── samples/
├── scripts/
├── src/
└── src-tauri/
```

---
## Current Active Files
### Core Documentation
| Path | Version | Status | Notes |
|------|---------|--------|------|
| `docs/ROM_Runner_Complete_Requirements_v2_6_0.md` | 2.6.0 | ✅ ACTIVE | Source-of-truth requirements |
| `docs/ROM_Runner_File_Manifest.md` | 2.6.0 | ✅ ACTIVE | This manifest |
| `docs/ROM_Runner_JSON_Schemas.json` | 1.1.0 | ✅ ACTIVE | JSON Schema definitions (`version` field inside) |
| `docs/analysis/INTEGRATION_SUMMARY.md` | - | ✅ ACTIVE | RetroCatalog / integration notes |
| `docs/analysis/ChatGPT_Work_Package_Review.md` | - | ✅ ACTIVE | Deliverables review |
| `docs/analysis/ROM_Runner_GitHub_File_Inventory.md` | 1.0.0 | 📋 REFERENCE | Inventory doc (may include planned files) |
| `docs/analysis/ROM_Runner_Missing_Files_Analysis.md` | - | 📋 REFERENCE | Gaps/next steps |

### Architecture & Specs
| Path | Version | Status | Notes |
|------|---------|--------|------|
| `docs/architecture/STORES_ARCHITECTURE_v1_1_0.md` | 1.1.0 | ✅ ACTIVE | Zustand architecture |
| `docs/architecture/UI_SCREEN_ARCHITECTURE_v1_1_0.md` | 1.1.0 | ✅ ACTIVE | UI screen/component architecture |
| `docs/specs/ROM_Runner_Theme_System_Specification_v1_0_0.md` | 1.0.0 | ✅ ACTIVE | Theme/tokens specification |

### Guides & Prompts
| Path | Status | Notes |
|------|--------|------|
| `docs/guides/ROM_Runner_Cursor_Setup_Guide.md` | ✅ ACTIVE | Primary workflow/setup guide |
| `docs/guides/ROM_Runner_Phase0_Tasks.md` | ✅ ACTIVE | Phase 0 checklist |
| `docs/guides/ROM_Runner_Quick_Reference.md` | ✅ ACTIVE | Day-to-day reference |
| `docs/prompts/PROMPT_Claude_Schema_Performance_Review.md` | ✅ ACTIVE | Prompt to review schema/perf |

---
## Definition Pack (Static Catalogs)
All static catalogs live in `src-tauri/definition-pack/`. Filenames are stable; **versions are stored inside each JSON file** under the `version` field.

| Path | Version | Entries | Notes |
|------|---------|---------|------|
| `src-tauri/definition-pack/bios-hashes.json` | 2.0.1 | 319 |  |
| `src-tauri/definition-pack/compatibility/communityPerformanceSources.json` | 0.2.0 | 6 |  |
| `src-tauri/definition-pack/compatibility/compatibilitySources.json` | 1.1.0 | 30 |  |
| `src-tauri/definition-pack/compatibility/emulatorCompatibility_seed.json` | 0.1.0 | 7 |  |
| `src-tauri/definition-pack/compatibility/emulatorGameSettings_seed.json` | 0.1.0 | 4 |  |
| `src-tauri/definition-pack/devices.json` | 1.0.0 | 622 |  |
| `src-tauri/definition-pack/emulators.json` | 2.1.0 | 279 |  |
| `src-tauri/definition-pack/layoutDetectionProfiles.json` | 0.2.0 | 29 |  |
| `src-tauri/definition-pack/operating-systems.json` | 2.1.0 | 65 |  |
| `src-tauri/definition-pack/osEmulatorProfiles.json` | 0.3.0 | 67 | 69 OS IDs |
| `src-tauri/definition-pack/platformPolicies.json` | 0.2.0 | 18 |  |
| `src-tauri/definition-pack/platforms.json` | 2.0.0 | 69 |  |

---
## Backend Stubs (Tauri / Rust / SQLite)
| Path | Version | Status | Notes |
|------|---------|--------|------|
| `src-tauri/src/commands/mod.rs` | 1.0.0 | ✅ STUB | Command handlers (signatures / scaffolding) |
| `src-tauri/src/commands/README.md` | - | ✅ ACTIVE | Command organization notes |
| `src-tauri/src/bios/types.ts` | - | ✅ ACTIVE | BIOS type definitions (TS shared) |
| `src-tauri/src/database/schema.sql` | 1.0.1 | ✅ ACTIVE | SQLite schema |
| `src-tauri/src/database/schema.md` | 1.0.1 | ✅ ACTIVE | Human-readable schema docs |
| `src-tauri/src/database/migrations/migration_v1_0_0_to_v1_0_1.sql` | - | ✅ ACTIVE | Migration script |

---
## Frontend Stubs (React / TypeScript)
| Path | Version | Status | Notes |
|------|---------|--------|------|
| `src/bindings/commands.ts` | 1.0.0 | ✅ STUB | Tauri IPC wrapper stubs |
| `src/components/index.ts` | 1.0.0 | ✅ STUB | Component barrel exports |
| `src/styles/tailwind.config.ts` | 1.0.0 | ✅ STUB | Tailwind config (bundle copy) |
| `src/styles/tokens.css` | 1.0.0 | ✅ ACTIVE | CSS design tokens |
| `src/stores/types.ts` | 1.0.0 | ✅ ACTIVE | Shared store types |
| `src/stores/*.ts` | 1.0.0 | ✅ STUB | Zustand store slices (`libraryStore.ts`, `deviceStore.ts`, etc.) |

---
## Python Ingestor Scripts
Located in `scripts/ingest/`.

### Layer A — Official/Primary Compatibility Sources
| Script | Target |
|--------|--------|
| `rpcs3_compat.py` | RPCS3 compatibility list (PS3) |
| `pcsx2_compat.py` | PCSX2 compatibility (PS2) |
| `dolphin_compat.py` | Dolphin compatibility (GC/Wii) |
| `cemu_compat.py` | Cemu compatibility (Wii U) |
| `ppsspp_reports.py` | PPSSPP reports (PSP) |
| `duckstation_gamedb.py` | DuckStation GameDB (PS1) |
| `vita3k_compat.py` | Vita3K compatibility (PS Vita) |
| `xemu_xdb.py` | xemu compatibility DB (Xbox) |
| `xenia_compat.py` | Xenia compatibility (Xbox 360) |
| `azahar_compat.py` | Azahar compatibility (3DS) |
| `redream_compat.py` | Redream compatibility (Dreamcast) |
| `scummvm_compat.py` | ScummVM compatibility (ScummVM) |

### Layer B — Per-Game Settings Extractors
| Script | Target |
|--------|--------|
| `dolphin_gameini.py` | Dolphin GameINI settings |
| `pcsx2_gamedb.py` | PCSX2 GameIndex/GameDB parsing |
| `rpcs3_wiki_settings.py` | RPCS3 Wiki settings |

### Layer C — Community Sources
| Script | Target |
|--------|--------|
| `layerC_common.py` | Shared Layer C utilities |
| `odin2_sheet.py` | Odin 2 community sheet |
| `rp4pro_sheet.py` | Retroid Pocket 4 Pro sheet |
| `emudeck_compat.py` | EmuDeck / Steam Deck community compat |

### Utilities
| Script/File | Purpose |
|-------------|---------|
| `common.py` | Shared HTTP/parsing helpers |
| `merge_outputs.py` | Merge ingestor outputs |
| `run_all.py` | Batch runner |
| `requirements.txt` | Python dependencies |
| `README.md` | How to run ingestors |
| `RPCS3_Wiki_Settings_Parser_Notes.md` | Parser notes |

---
## Tooling & IDE Configuration
### Cursor
| Path | Notes |
|------|------|
| `.cursorrules` | Project rules (committed) |
| `.cursor/rules/rules` | Bundle rules file (committed) |
| `.cursor/commands/*.md` | Command templates (`build`, `design`, `design2`) |
| `.cursor/mcp-config.example.json` | Template (no secrets) |
| `.cursor/mcp-config.json` | **Local secrets** (gitignored) |

### Claude / Codex / VS Code
| Path | Notes |
|------|------|
| `.claude/` | Claude Code agents + settings |
| `.codex/` | Codex configuration |
| `.vscode/` | Editor settings (includes `settings.local.json`) |

### Bootstrap scripts
| Path | Purpose |
|------|---------|
| `bin/setup-mcp-context7.sh` | Generate `.cursor/mcp-config.json` from 1Password (macOS/Linux) |
| `bin/setup-mcp-context7.ps1` | Generate `.cursor/mcp-config.json` from 1Password (Windows) |
| `bin/codex` / `bin/codex.ps1` | Codex launcher helpers |

---
## Resources & Samples
### Branding Assets
| Path | Notes |
|------|------|
| `resources/Rom Runner - Badge_1.svg` | Branding asset |
| `resources/Rom Runner - Badge_1@2x.png` | Branding asset |
| `resources/Rom Runner - Full_1.svg` | Branding asset |
| `resources/Rom Runner - Full_1@2x.png` | Branding asset |

### Sample Data
| Path | Notes |
|------|------|
| `samples/GameIndex_sample.yaml` | Sample input/output reference |
| `samples/settings_dolphin-gameini_example.json` | Sample input/output reference |
| `samples/settings_pcsx2-gameindex_sample.json` | Sample input/output reference |
| `samples/settings_pcsx2-gameindex_sample_stats.json` | Sample input/output reference |
| `samples/settings_rpcs3-wiki_sample.json` | Sample input/output reference |

---
## Version History
### ROM_Runner_Complete_Requirements
| Version | Date | Key Changes |
|---------|------|-------------|
| 2.6.0 | 2026-01-07 | Theme system, updated architecture docs, bundle alignment |
| 2.5.0 | 2026-01-04 | Destination scanning, layout detection profiles |
| 2.4.0 | 2026-01-03 | OS emulator profiles, platform policies, Layer C sources |
| 2.3.0 | 2026-01-02 | RetroCatalog integration, three-tier data model |

### ROM_Runner_File_Manifest
| Version | Date | Key Changes |
|---------|------|-------------|
| 2.6.0 | 2026-01-07 | Updated for stable filenames + new bundle files |
| 2.5.0 | 2026-01-05 | Prior comprehensive update (versioned filenames) |
| 2.4.0 | 2026-01-05 | Added layout detection, SQLite schema, UI architecture |
| 2.3.0 | 2026-01-04 | Android ES files, requirements v2.5 |
