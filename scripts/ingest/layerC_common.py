#!/usr/bin/env python3
"""
layerC_common.py â€” shared utilities for ROM Runner "Layer C" community performance ingestors.

Design goals:
- Work without Google API keys (use public export endpoints).
- Be resilient to minor sheet structure changes.
- Cache aggressively (default 48h) to reduce load / avoid rate-limits.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import requests


USER_AGENT = "Mozilla/5.0 (compatible; ROMRunner/1.0; +https://example.invalid)"
DEFAULT_TIMEOUT_SECS = 30
DEFAULT_CACHE_TTL_SECS = 48 * 3600  # 48 hours
DEFAULT_SLEEP_BETWEEN_REQUESTS_SECS = 0.35


STATUS_MAP: dict[str, str] = {
    # Excellent tier
    "perfect": "excellent",
    "excellent": "excellent",
    "flawless": "excellent",

    # Good tier
    "great": "good",
    "good": "good",
    "playable": "playable",
    "works": "playable",

    # Playable with issues
    "ok": "playable",
    "runs": "playable",
    "minor issues": "playable",

    # Poor tier
    "poor": "poor",
    "bad": "poor",
    "major issues": "poor",

    # Unplayable
    "unplayable": "unplayable",
    "broken": "unplayable",
    "doesn't work": "unplayable",
    "does not work": "unplayable",
    "crash": "unplayable",
    "crashes": "unplayable",
}


def now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dirs(*paths: str | os.PathLike[str]) -> None:
    """Ensure parent directories exist for output paths and cache dirs."""
    for p in paths:
        path = Path(p)
        if path.suffix:  # looks like a file path
            path.parent.mkdir(parents=True, exist_ok=True)
        else:  # directory path
            path.mkdir(parents=True, exist_ok=True)


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def cache_path_for_url(url: str, cache_dir: str | os.PathLike[str]) -> Path:
    cache_dir = Path(cache_dir)
    return cache_dir / f"{_sha1(url)}.cache"


def read_cache(url: str, cache_dir: str | os.PathLike[str], ttl_secs: int = DEFAULT_CACHE_TTL_SECS) -> Optional[str]:
    p = cache_path_for_url(url, cache_dir)
    if not p.exists():
        return None
    try:
        age = time.time() - p.stat().st_mtime
        if age > ttl_secs:
            return None
        return p.read_text(encoding="utf-8")
    except Exception:
        return None


def write_cache(url: str, cache_dir: str | os.PathLike[str], text: str) -> None:
    p = cache_path_for_url(url, cache_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def fetch_text(
    url: str,
    *,
    headers: Optional[dict[str, str]] = None,
    timeout_secs: int = DEFAULT_TIMEOUT_SECS,
    retries: int = 3,
    backoff_secs: float = 1.25,
    sleep_between_requests_secs: float = DEFAULT_SLEEP_BETWEEN_REQUESTS_SECS,
) -> str:
    """Fetch a URL as text with basic retry/backoff."""
    hdrs = {"User-Agent": USER_AGENT}
    if headers:
        hdrs.update(headers)

    last_exc: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            if sleep_between_requests_secs:
                time.sleep(sleep_between_requests_secs)
            resp = requests.get(url, headers=hdrs, timeout=timeout_secs)
            resp.raise_for_status()
            # Respect response encoding if present; fallback to utf-8
            resp.encoding = resp.encoding or "utf-8"
            return resp.text
        except Exception as e:
            last_exc = e
            if attempt < retries:
                time.sleep(backoff_secs * attempt)
                continue
            raise
    raise last_exc or RuntimeError("Unknown fetch error")


def cache_response(url: str, cache_dir: str | os.PathLike[str], *, ttl_secs: int = DEFAULT_CACHE_TTL_SECS) -> str:
    """Fetch with caching (text)."""
    cached = read_cache(url, cache_dir, ttl_secs=ttl_secs)
    if cached is not None:
        return cached
    text = fetch_text(url)
    write_cache(url, cache_dir, text)
    return text


def fetch_sheet_csv(
    sheet_id: str,
    gid: str = "0",
    *,
    cache_dir: Optional[str] = None,
    ttl_secs: int = DEFAULT_CACHE_TTL_SECS,
) -> str:
    """
    Fetch Google Sheet tab as CSV using the 'export' endpoint.

    NOTE: Many sheets allow either gid=... or sheet=<tab name>. We stick to gid in this helper.
    """
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
    if cache_dir:
        return cache_response(url, cache_dir, ttl_secs=ttl_secs)
    return fetch_text(url)


def fetch_sheet_csv_by_name(
    sheet_id: str,
    sheet_name: str,
    *,
    cache_dir: Optional[str] = None,
    ttl_secs: int = DEFAULT_CACHE_TTL_SECS,
) -> str:
    """
    Fetch Google Sheet tab as CSV using sheet=<tab name>.
    Some sheets are more stable to access by name than by gid.
    """
    # sheet name must be URL-encoded; requests will do it if we pass params, but we build url directly for simplicity.
    import urllib.parse
    sheet_q = urllib.parse.quote(sheet_name)
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&sheet={sheet_q}"
    if cache_dir:
        return cache_response(url, cache_dir, ttl_secs=ttl_secs)
    return fetch_text(url)


@dataclass(frozen=True)
class SheetTab:
    name: str
    gid: str


def discover_sheet_tabs(sheet_id: str, *, cache_dir: Optional[str] = None, ttl_secs: int = DEFAULT_CACHE_TTL_SECS) -> list[SheetTab]:
    """
    Best-effort discovery of tab names + gids by scraping the public sheet HTML.

    This is intentionally "best effort" â€” if the sheet is not publicly readable,
    Google may return login/consent pages that don't include metadata.
    """
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit?usp=sharing"
    html = cache_response(url, cache_dir, ttl_secs=ttl_secs) if cache_dir else fetch_text(url)

    tabs: dict[str, str] = {}

    # Pattern A: JSON-ish objects containing gid and name/title.
    patterns = [
        r'"gid"\s*:\s*(\d+)\s*,\s*"name"\s*:\s*"([^"]+)"',
        r'"name"\s*:\s*"([^"]+)"\s*,\s*"gid"\s*:\s*(\d+)',
        r'"sheetId"\s*:\s*(\d+)\s*,\s*"title"\s*:\s*"([^"]+)"',
        r'"title"\s*:\s*"([^"]+)"\s*,\s*"sheetId"\s*:\s*(\d+)',
    ]
    for pat in patterns:
        for m in re.finditer(pat, html):
            a, b = m.group(1), m.group(2)
            # normalize captures depending on which group is gid
            if a.isdigit():
                gid, name = a, b
            else:
                name, gid = a, b
            name = name.strip()
            if gid and name:
                tabs[name] = str(gid)

    # Pattern B: query-like fragments 'gid=12345' + nearby label; weaker, but can help.
    # We won't try to infer names from this; just collect gids to allow manual mapping.
    if not tabs:
        gids = sorted(set(re.findall(r'gid=(\d+)', html)))
        for g in gids:
            tabs[f"gid_{g}"] = g

    return [SheetTab(name=k, gid=v) for k, v in sorted(tabs.items(), key=lambda kv: kv[0].lower())]


def normalize_status(raw: str) -> tuple[str, str]:
    """Returns (normalized_status, performance_tier)."""
    s = (raw or "").strip().lower()
    if not s:
        return "unknown", "unknown"

    # Exact match
    if s in STATUS_MAP:
        normalized = STATUS_MAP[s]
        return normalized, normalized

    # Heuristics: look for keywords inside longer strings (e.g. "Playable (minor stutter)")
    # Order matters: detect unplayable/broken first.
    if any(k in s for k in ["unplayable", "broken", "doesn't work", "does not work", "crash", "crashes", "black screen"]):
        return "unplayable", "unplayable"
    if any(k in s for k in ["poor", "bad", "major issue", "major issues", "very slow", "slideslow", "stuttery", "unstable"]):
        return "poor", "poor"
    if any(k in s for k in ["perfect", "flawless", "excellent"]):
        return "excellent", "excellent"
    if any(k in s for k in ["great", "good"]):
        return "good", "good"
    if any(k in s for k in ["playable", "works", "ok", "runs", "minor issue", "minor issues"]):
        return "playable", "playable"

    return "unknown", "unknown"


def find_column(headers: list[str], aliases: list[str]) -> Optional[int]:
    """Find column index by checking multiple possible names (case/whitespace-insensitive)."""
    headers_norm = [h.strip().lower() for h in headers]
    for a in aliases:
        a_norm = a.strip().lower()
        if a_norm in headers_norm:
            return headers_norm.index(a_norm)
    return None


def read_csv_rows(csv_text: str) -> tuple[list[str], list[list[str]]]:
    """Parse CSV into (headers, rows). Handles BOM + weird newlines."""
    if csv_text.startswith("\ufeff"):
        csv_text = csv_text.lstrip("\ufeff")
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        return [], []
    headers = rows[0]
    data_rows = rows[1:]
    return headers, data_rows


def clean_text(s: Optional[str]) -> str:
    return (s or "").strip()


def is_probably_header_row(row: list[str]) -> bool:
    """Heuristic to detect repeated header rows inside the sheet."""
    joined = " ".join([c.strip().lower() for c in row if c.strip()])
    return any(k in joined for k in ["game", "title", "compat", "status", "rating"]) and len(joined) < 120


def choose_best_text(*candidates: Optional[str]) -> Optional[str]:
    for c in candidates:
        c = (c or "").strip()
        if c:
            return c
    return None


def normalize_platform_token(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s
