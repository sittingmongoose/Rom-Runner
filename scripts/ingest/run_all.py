"""Run a batch of ingestion scripts.

Usage:
  python -m scripts.ingest.run_all --out-dir out --cache-dir .cache/compat

This will execute each ingestor as a module (so relative imports work) and place outputs in out/.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass(frozen=True)
class Job:
    module: str
    out: str


DEFAULT_JOBS: List[Job] = [
    Job("scripts.ingest.rpcs3_compat", "compat.rpcs3.json"),
    Job("scripts.ingest.dolphin_compat", "compat.dolphin.json"),
    Job("scripts.ingest.cemu_compat", "compat.cemu.json"),
    Job("scripts.ingest.pcsx2_compat", "compat.pcsx2.json"),
    Job("scripts.ingest.vita3k_compat", "compat.vita3k.json"),
    Job("scripts.ingest.xemu_xdb", "compat.xemu.json"),
    Job("scripts.ingest.xenia_compat", "compat.xenia.json"),
    Job("scripts.ingest.ppsspp_reports", "compat.ppsspp.json"),
    # Added v0.3:
    Job("scripts.ingest.redream_compat", "compat.redream.json"),
    Job("scripts.ingest.scummvm_compat", "compat.scummvm.json"),
    Job("scripts.ingest.azahar_compat", "compat.azahar.json"),
    Job("scripts.ingest.cdi_emulator_theworldofcdi", "compat.cdi-emulator.json"),
    Job("scripts.ingest.portmaster_info", "compat.portmaster.json"),
    Job("scripts.ingest.fbneo_dat_arcade", "compat.fbneo.dat.json"),
    Job("scripts.ingest.mame2003plus_xml", "compat.mame2003plus.xml.json"),
    Job("scripts.ingest.mame2003_xml", "compat.mame2003.xml.json"),
    Job("scripts.ingest.duckstation_gamedb", "settings.duckstation.gamedb.json"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out", help="Directory to write outputs into")
    ap.add_argument("--cache-dir", default=".cache/compat", help="Cache directory used by ingestors")
    ap.add_argument("--max-age-days", type=int, default=None, help="Override max-age-days for ingestors (optional)")
    ap.add_argument("--only", nargs="*", default=None, help="Only run jobs whose module contains one of these substrings")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    jobs = DEFAULT_JOBS
    if args.only:
        jobs = [j for j in jobs if any(s in j.module for s in args.only)]

    failures = 0
    for job in jobs:
        out_path = out_dir / job.out
        cmd = [sys.executable, "-m", job.module, "--out", str(out_path), "--cache-dir", args.cache_dir]
        if args.max_age_days is not None:
            cmd += ["--max-age-days", str(args.max_age_days)]
        print("==>", " ".join(cmd))
        r = subprocess.run(cmd)
        if r.returncode != 0:
            print(f"!! FAILED: {job.module} (exit {r.returncode})")
            failures += 1

    if failures:
        print(f"{failures} job(s) failed.")
        return 1
    print("All jobs succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
