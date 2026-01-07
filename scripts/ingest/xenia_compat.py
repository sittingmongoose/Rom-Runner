"""Fetch Xenia (Xbox 360) compatibility data.

Xenia maintains a public game-compatibility tracker as a GitHub repository that
uses issues to track per-title status.

Repo (canary): https://github.com/xenia-canary/game-compatibility

We use the GitHub Issues API to pull issue titles + labels and map them to a
coarse status.

Output: out/compat/xenia.compat-source.json
"""

from __future__ import annotations

import argparse
import re
from typing import Any, Dict, List, Optional

import requests

from .common import DEFAULT_HEADERS, ensure_dirs, json_dump, now_iso

REPO_OWNER = "xenia-canary"
REPO_NAME = "game-compatibility"

ISSUES_API = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/issues"

TITLEID_RE = re.compile(r"\b[0-9A-Fa-f]{8}\b")


def normalize_status_from_labels(labels: List[Dict[str, Any]]) -> str:
    names = [str(l.get("name") or "").lower() for l in labels]

    # Common patterns: "state: playable", "state: ingame", "state: intro", "state: nothing"
    joined = " | ".join(names)
    for key, norm in [
        ("perfect", "perfect"),
        ("playable", "playable"),
        ("in-game", "ingame"),
        ("ingame", "ingame"),
        ("intro", "intro"),
        ("menu", "intro"),
        ("nothing", "broken"),
        ("broken", "broken"),
        ("won't boot", "broken"),
        ("wont boot", "broken"),
    ]:
        if key in joined:
            return norm

    return "unknown"


def extract_titleid(issue_title: str) -> Optional[str]:
    m = TITLEID_RE.search(issue_title or "")
    return m.group(0).upper() if m else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out/compat")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument("--max-pages", type=int, default=0, help="Limit pages fetched (0 = no limit)")
    args = ap.parse_args()

    ensure_dirs(args.out_dir)

    records: List[Dict[str, Any]] = []

    page = 1
    while True:
        if args.max_pages and page > args.max_pages:
            break
        resp = requests.get(
            ISSUES_API,
            headers={**DEFAULT_HEADERS, "Accept": "application/vnd.github+json"},
            params={"state": "open", "per_page": 100, "page": page},
            timeout=args.timeout,
        )
        resp.raise_for_status()
        items = resp.json()
        if not isinstance(items, list) or not items:
            break

        for it in items:
            # Skip PRs
            if isinstance(it, dict) and "pull_request" in it:
                continue
            title = it.get("title")
            labels = it.get("labels") or []
            status_norm = normalize_status_from_labels(labels if isinstance(labels, list) else [])
            status_raw = ", ".join([str(l.get("name")) for l in labels if isinstance(l, dict) and l.get("name")])

            title_id = extract_titleid(title or "")

            records.append(
                {
                    "emulatorId": "xenia",
                    "platformId": "xbox360",
                    "externalIdType": "title_id" if title_id else "issue",
                    "externalGameId": title_id or str(it.get("number")),
                    "title": title,
                    "status": {"raw": status_raw, "normalized": status_norm},
                    "lastUpdated": (it.get("updated_at") or None),
                    "links": {
                        "source": f"https://github.com/{REPO_OWNER}/{REPO_NAME}",
                        "detail": it.get("html_url"),
                    },
                    "raw": it,
                }
            )

        # Pagination: if <100 returned, stop.
        if len(items) < 100:
            break
        page += 1

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {
            "id": "xenia",
            "name": "Xenia Game Compatibility (GitHub Issues)",
            "kind": "official",
            "url": f"https://github.com/{REPO_OWNER}/{REPO_NAME}",
        },
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/xenia.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/xenia.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
