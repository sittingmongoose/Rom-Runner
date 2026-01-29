# ROM Runner BIOS Verification Tools (v1.1.0)

This bundle implements the deliverables from **BIOS_Verification_Tools_Prompt_v1.1.0**.

## Deliverables

- `ROM_Runner_JSON_Schemas_v1.1.0.json`
- `scripts/bios_verifier.py`
- `scripts/bios_requirements.py`
- `scripts/validate_bios_database.py`
- `src/types/bios.ts`
- `src-tauri/src/bios/mod.rs`
- `tests/test_bios_verifier.py`

## Quick start

### Validate the BIOS database (structure + references)

```bash
python scripts/validate_bios_database.py bios-hashes_v2.0.0.json \
  --platforms platforms_v2.0.0.json \
  --emulators emulators_v2.0.0.json
```

### Scan a BIOS folder and generate a report

```bash
python scripts/bios_verifier.py /path/to/bios \
  --database bios-hashes_v2.0.0.json \
  --recursive \
  --format markdown \
  --output bios_report.md
```

Statuses:
- `exact_match` Ã¢â‚¬â€ hash matches a preferred knownHashes entry (or filename match for presence-only items)
- `alternate_hash` Ã¢â‚¬â€ hash matches a non-preferred knownHashes entry
- `wrong_hash` Ã¢â‚¬â€ filename matches a BIOS entry but hash doesn't match any knownHashes
- `wrong_size` Ã¢â‚¬â€ filename matches a BIOS entry but fileSize differs
- `unknown` Ã¢â‚¬â€ no match found

### Generate requirements documentation

```bash
python scripts/bios_requirements.py --platform psx ps2 --format markdown --output bios_requirements.md
python scripts/bios_requirements.py --emulator pcsx2 flycast --format markdown --output bios_requirements_by_emu.md
python scripts/bios_requirements.py --all --format checklist --check /path/to/bios --output bios_checklist.md
```

## Tests

These are lightweight pytest-style tests:

```bash
pip install pytest
pytest -q
```
