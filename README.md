# ROM Runner

A future **desktop ROM + BIOS organizer** aimed at making it easy to prepare curated retro libraries for handhelds and other emulation setups.

This repo is **early-stage**: it’s a design-and-data foundation (requirements, schemas, catalogs, scaffolding).  
**There is no working application yet.**

---

## Why this exists

Building a “ROM manager” gets messy fast: different devices want different folder layouts, BIOS files vary by core, and collections grow into thousands of files. ROM Runner’s goal is to become a simple desktop tool that can:

- Inventory ROMs and BIOS files from one or more sources
- Validate BIOS presence and hashes
- Apply target-specific organization rules (per device / OS / emulator)
- Copy/sync a curated subset to a destination (microSD/USB/network), efficiently and safely

---

## What’s in the repository (today)

This repo contains the **groundwork** that implementation will be built from:

- **Requirements and planning docs**  
  Product requirements, architecture notes, and supporting analysis.

- **Data catalogs (“definition pack”)**  
  JSON catalogs describing platforms, emulators, operating systems, devices, BIOS hashes, and compatibility metadata.

- **Scaffolding / stubs**  
  Early frontend/backend structure to align future implementation with the documented models.

- **Ingestion scripts**  
  Python tooling used to generate/maintain the catalogs.

---

## How to navigate

If you’re trying to understand the project, start here:

- **Requirements (source of truth):** `docs/ROM_Runner_Complete_Requirements_v2_6_0.md`
- **File map of the bundle:** `docs/ROM_Runner_File_Manifest.md`
- **Schemas / models:** `docs/ROM_Runner_JSON_Schemas.json`

If you want to inspect the data foundation:

- **Definition pack:** `src-tauri/definition-pack/`
  - platforms, emulators, devices, operating systems
  - BIOS hashes
  - compatibility framework + compatibility data

---

## Current scope

**In scope (being defined/built toward):**
- Device-aware organization rules (platform folders, BIOS placement rules, etc.)
- BIOS verification via hashes
- Catalog-driven behavior (schemas + definition pack)
- A desktop UX for selecting sources, targets, and curated sets

**Not in scope (for now):**
- Shipping a full ROM scraper / metadata front-end (box art, descriptions, etc.)
- Bundling copyrighted ROM/BIOS content
- A cloud service (this is intended to be a local desktop app)

---

## Roadmap (high level)

- Turn the requirements + schemas into an implemented desktop app UI and workflow
- Wire the definition pack into runtime logic and validation
- Implement scanning + incremental sync/copy (minimize writes, resumable jobs)
- Add device/OS-specific target layouts and deployment rules
- Expand compatibility/performance metadata over time

---

## Contributing

This project is at an early foundation stage. Useful contributions right now include:

- Improving the definition pack data quality (platforms/emulators/devices/BIOS hashes)
- Tightening schemas and validation rules
- Identifying edge cases in device layouts and BIOS requirements
- UX flow feedback based on the requirements doc

If you’re opening a PR, keep changes **small and focused** and reference the relevant doc/schema where possible.

---

## License

License information will be added as the project solidifies.
