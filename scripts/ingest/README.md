# Layer C Community Performance Ingestors (ROM Runner)

This folder contains standalone Python ingestors that fetch community-maintained compatibility/performance lists
and output standardized `layerC-v1` JSON.

## Files

- `layerC_common.py` â€” shared utilities (fetching, caching, status normalization, sheet tab discovery)
- `odin2_sheet.py` â€” Odin 2 (Snapdragon 8 Gen 2) Google Sheet ingestor
- `rp4pro_sheet.py` â€” Retroid Pocket 4 Pro (Dimensity 1100) Google Sheet ingestor (supports official + community tests via `--variant`)
- `emudeck_compat.py` â€” EmuDeck/Steam Deck compatibility site ingestor
- `requirements_layerC.txt` â€” minimal pip requirements

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements_layerC.txt

# List tabs (names + gids) to help create mappings if auto-pick fails:
python odin2_sheet.py --list-tabs
python rp4pro_sheet.py --list-tabs

# Ingest (auto-picks tabs when possible):
python odin2_sheet.py --out out/layerC.odin2.json
python rp4pro_sheet.py --out out/layerC.rp4pro.json
python emudeck_compat.py --out out/layerC.emudeck.json

# If a platform can't be mapped automatically, override:
python odin2_sheet.py --gid ps2=0 --gid wii=123456 --out out/layerC.odin2.json
python odin2_sheet.py --sheet-name ps2=PS2 --out out/layerC.odin2.json
```

## Output schema

Each script writes:

```json
{
  "schemaVersion": "layerC-v1",
  "source": { "...": "..." },
  "generatedAt": "ISO-8601 UTC",
  "items": [ ... ]
}
```

## Notes

- These are community sources; treat as lower confidence than emulator DBs.
- Sheets are cached by URL hash under `.cache/layerC/` by default.
