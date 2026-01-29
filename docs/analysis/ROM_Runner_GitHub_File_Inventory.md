# ROM Runner - GitHub File Inventory

**Version:** 1.0.0  
**Date:** January 6, 2026  
**Purpose:** Complete inventory of files needed for GitHub repository setup

---

## Repository Structure

```
rom-runner/
├── 📁 .cursor/
│   └── environment.json              # Cursor cloud agent config
├── 📁 .github/
│   └── 📁 workflows/
│       └── ci.yml                    # CI/CD pipeline
├── 📁 .vscode/
│   ├── settings.json                 # Editor settings
│   └── extensions.json               # Recommended extensions
├── 📁 docs/
│   ├── 📁 specs/                     # Specification documents
│   │   ├── ROM_Runner_Complete_Requirements_v2_5_0.md
│   │   ├── ROM_Runner_JSON_Schemas_v1_1_0.json
│   │   ├── UI_SCREEN_ARCHITECTURE_v1_0_0.md
│   │   ├── STORES_ARCHITECTURE_v1_0_0.md
│   │   └── ChatGPT_Work_Package_Review_v1_0_0.md
│   ├── 📁 guides/                    # Development guides
│   │   ├── ROM_Runner_Cursor_Setup_Guide_v1_0_0.md
│   │   ├── ROM_Runner_Phase0_Tasks_v1_0_0.md
│   │   └── ROM_Runner_Quick_Reference_v1_0_0.md
│   ├── 📁 integration/
│   │   ├── INTEGRATION_SUMMARY.md
│   │   ├── README_bios_tools.md
│   │   └── README_layerC.md
│   ├── ROM_Runner_File_Manifest_v2_5_0.md
│   └── ROM_Runner_GitHub_File_Inventory_v1_0_0.md
├── 📁 resources/
│   └── 📁 branding/
│       ├── Rom_Runner__Full_12x.png
│       └── Rom_Runner__Badge_12x.png
├── 📁 scripts/
│   ├── 📁 ingest/                    # Compatibility ingestors
│   ├── 📁 layerC/                    # Community sheet scripts
│   └── 📁 bios/                      # BIOS verification tools
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 layout/
│   │   ├── 📁 library/
│   │   ├── 📁 devices/
│   │   ├── 📁 deployment/
│   │   ├── 📁 bios/
│   │   ├── 📁 settings/
│   │   ├── 📁 common/
│   │   └── 📁 icons/
│   ├── 📁 hooks/
│   ├── 📁 screens/
│   ├── 📁 stores/
│   │   ├── types.ts
│   │   ├── libraryStore.ts
│   │   ├── deviceStore.ts
│   │   ├── deploymentStore.ts
│   │   ├── settingsStore.ts
│   │   ├── biosStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   ├── 📁 styles/
│   │   ├── tokens.css
│   │   └── index.css
│   ├── 📁 types/
│   └── 📁 utils/
├── 📁 src-tauri/
│   ├── 📁 src/
│   │   ├── 📁 commands/
│   │   ├── 📁 database/
│   │   ├── 📁 transfer/
│   │   ├── 📁 device/
│   │   └── 📁 bios/
│   ├── 📁 definition-pack/
│   │   ├── 📁 compatibility/
│   │   └── [all JSON data files]
│   ├── Cargo.toml
│   └── tauri.conf.json
├── .cursorrules
├── .cursorignore
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
├── README.md
├── CONTRIBUTING.md
├── SETUP_GUIDE.md
├── QUICK_START.md
└── LICENSE
```

---

## File Status by Source

### ✅ From Claude Project (Ready to Copy)

| File | Version | Destination |
|------|---------|-------------|
| ROM_Runner_Complete_Requirements_v2_5_0.md | 2.5.0 | docs/specs/ |
| ROM_Runner_File_Manifest_v2_5_0.md | 2.5.0 | docs/ |
| ROM_Runner_JSON_Schemas_v1_1_0.json | 1.1.0 | docs/specs/ |
| STORES_ARCHITECTURE_v1_0_0.md | 1.0.0 | docs/specs/ |
| UI_SCREEN_ARCHITECTURE_v1_0_0.md | 1.0.0 | docs/specs/ |
| ChatGPT_Work_Package_Review_v1_0_0.md | 1.0.0 | docs/specs/ |
| INTEGRATION_SUMMARY.md | - | docs/integration/ |
| README_bios_tools.md | - | docs/integration/ |
| README_layerC.md | - | docs/integration/ |
| types_v1_0_0.ts | 1.0.0 | src/stores/ |
| libraryStore_v1_0_0.ts | 1.0.0 | src/stores/ |
| deviceStore_v1_0_0.ts | 1.0.0 | src/stores/ |
| deploymentStore_v1_0_0.ts | 1.0.0 | src/stores/ |
| settingsStore_v1_0_0.ts | 1.0.0 | src/stores/ |
| biosStore_v1_0_0.ts | 1.0.0 | src/stores/ |
| uiStore_v1_0_0.ts | 1.0.0 | src/stores/ |
| index_v1_0_0.ts | 1.0.0 | src/stores/ |
| tailwind_config.ts | 1.0.0 | / (rename) |
| tokens.css | 1.0.0 | src/styles/ |
| index.ts (components) | - | src/components/ |
| operating-systems_v2_1_0.json | 2.1.0 | src-tauri/definition-pack/ |
| layoutDetectionProfiles_v0_2_0.json | 0.2.0 | src-tauri/definition-pack/ |
| platformPolicies_v0_2_0.json | 0.2.0 | src-tauri/definition-pack/ |
| compatibilitySources.json | - | src-tauri/definition-pack/compatibility/ |
| communityPerformanceSources_layerC_seed_v0_2_0.json | 0.2.0 | src-tauri/definition-pack/compatibility/ |
| emulatorCompatibility_seed.json | 0.1.0 | src-tauri/definition-pack/compatibility/ |
| emulatorGameSettings_seed.json | 0.1.0 | src-tauri/definition-pack/compatibility/ |
| All Python ingestor scripts (21 files) | 1.0.0 | scripts/ingest/ |

### ✅ From New Cursor Setup (This Session)

| File | Version | Destination |
|------|---------|-------------|
| ROM_Runner_Cursor_Setup_Guide_v1_0_0.md | 1.0.0 | docs/guides/ |
| ROM_Runner_Phase0_Tasks_v1_0_0.md | 1.0.0 | docs/guides/ |
| ROM_Runner_Quick_Reference_v1_0_0.md | 1.0.0 | docs/guides/ |
| ROM_Runner_GitHub_File_Inventory_v1_0_0.md | 1.0.0 | docs/ |
| ROM_Runner_Task_Assignments_v1_0_0.md | 1.0.0 | docs/guides/ |
| cursorrules_v1_0_0.md | 1.0.0 | / (rename to .cursorrules) |

### ⚠️ From Google Drive (Verify Present)

#### GitHub Setup Files
| File | Source Thread |
|------|---------------|
| README.md | Setting up GitHub for Cursor |
| CONTRIBUTING.md | Setting up GitHub for Cursor |
| SETUP_GUIDE.md | Setting up GitHub for Cursor |
| QUICK_START.md | Setting up GitHub for Cursor |
| .cursor/environment.json | Setting up GitHub for Cursor |
| .github/workflows/ci.yml | Setting up GitHub for Cursor |
| .gitignore | Setting up GitHub for Cursor |
| .env.example | Setting up GitHub for Cursor |
| package.json | Setting up GitHub for Cursor |
| .vscode/settings.json | Setting up GitHub for Cursor |
| .vscode/extensions.json | Setting up GitHub for Cursor |

#### Definition Pack Data
| File | Records | Size |
|------|---------|------|
| devices.json | 622 | 202KB |
| platforms_v2_0_0.json | 69 | ~50KB |
| emulators_v2_1_0.json | 279 | ~100KB |
| bios-hashes_v2_0_1.json | 319 | ~350KB |
| frontends.json | 33 | ~35KB |
| chipsets.json | ~50 | ~20KB |
| deviceOsMatrix_v2_0_0.json | 459 | 32KB |
| osEmulatorProfiles_v0_3_0.json | 68 | ~40KB |
| curated-lists.json | - | ~10KB |
| retrocatalogPlatformScores.json | 253 | 143KB |
| gamePerformance_baseline.json | 4,461 | 1.1MB |

#### Backend Files
| File | Source |
|------|--------|
| schema_v1_0_1.sql | ChatGPT Work Package |
| migration_v1_0_0_to_v1_0_1.sql | ChatGPT Work Package |
| commands_v1_0_0.rs | ChatGPT Work Package |
| commands_v1_0_0.ts | ChatGPT Work Package |

#### BIOS Tools
| File | Source |
|------|--------|
| bios_verifier.py | BIOS Tools Thread |
| bios_requirements.py | BIOS Tools Thread |
| validate_bios_database.py | BIOS Tools Thread |
| test_bios_verifier.py | BIOS Tools Thread |
| bios.ts | BIOS Tools Thread |
| mod.rs (bios) | BIOS Tools Thread |

---

## Setup Checklist

### Before Creating GitHub Repo

- [ ] Verify all Claude Project files are downloaded
- [ ] Verify all Google Drive files are present
- [ ] Create new directory for project
- [ ] Initialize Tauri project with template

### After Tauri Init

- [ ] Copy .cursorrules (rename from cursorrules_v1_0_0.md)
- [ ] Create .cursorignore
- [ ] Copy docs/ folder structure
- [ ] Copy src/stores/ files (rename to remove versions)
- [ ] Copy src/styles/ files
- [ ] Copy src-tauri/definition-pack/ files
- [ ] Copy scripts/ folder

### Before First Commit

- [ ] Verify .gitignore excludes:
  - node_modules/
  - target/
  - dist/
  - .env (but not .env.example)
- [ ] Verify package.json has all dependencies
- [ ] Run `npm install` successfully
- [ ] Run `npm run tauri dev` successfully

---

## File Renaming Guide

When copying to repo, rename these files:

| Original | Rename To |
|----------|-----------|
| cursorrules_v1_0_0.md | .cursorrules |
| tailwind_config.ts | tailwind.config.ts |
| types_v1_0_0.ts | types.ts |
| libraryStore_v1_0_0.ts | libraryStore.ts |
| deviceStore_v1_0_0.ts | deviceStore.ts |
| deploymentStore_v1_0_0.ts | deploymentStore.ts |
| settingsStore_v1_0_0.ts | settingsStore.ts |
| biosStore_v1_0_0.ts | biosStore.ts |
| uiStore_v1_0_0.ts | uiStore.ts |
| index_v1_0_0.ts | index.ts |
| platforms_v2_0_0.json | platforms.json |
| emulators_v2_1_0.json | emulators.json |
| operating-systems_v2_1_0.json | operating-systems.json |
| bios-hashes_v2_0_1.json | bios-hashes.json |
| layoutDetectionProfiles_v0_2_0.json | layoutDetectionProfiles.json |
| platformPolicies_v0_2_0.json | platformPolicies.json |
| osEmulatorProfiles_v0_3_0.json | osEmulatorProfiles.json |
| deviceOsMatrix_v2_0_0.json | deviceOsMatrix.json |

---

## Total File Count

| Category | Count |
|----------|-------|
| Documentation | 15 |
| Zustand Stores | 8 |
| Design System | 3 |
| Python Scripts | 21+ |
| Definition Pack JSONs | 15+ |
| Config Files | 10 |
| GitHub Workflow | 1 |
| Backend Stubs | 6 |
| **TOTAL** | **79+** |

---

**End of Inventory v1.0.0**
