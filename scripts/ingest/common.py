"""
Common utilities for ROM Runner compatibility ingestors.
This module provides shared helpers for caching, fetching, and output formatting.
"""

import hashlib
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import requests

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ROMRunner/1.0)"
}

@dataclass
class FetchResult:
    content: bytes
    status_code: int
    headers: dict

def ensure_dirs(*paths: str) -> None:
    for p in paths:
        Path(p).mkdir(parents=True, exist_ok=True)

def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def slugify(s: str) -> str:
    import re
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def requests_get_cached(url: str, cache_dir: str, headers: Optional[dict] = None, timeout: int = 60):
    """Fetch with simple file-based caching."""
    ensure_dirs(cache_dir)
    cache_key = hashlib.md5(url.encode()).hexdigest()
    cache_file = Path(cache_dir) / f"{cache_key}.cache"
    
    if cache_file.exists():
        # Simple age check (24 hours)
        age = time.time() - cache_file.stat().st_mtime
        if age < 86400:
            return FetchResult(
                content=cache_file.read_bytes(),
                status_code=200,
                headers={}
            )
    
    hdrs = DEFAULT_HEADERS.copy()
    if headers:
        hdrs.update(headers)
    
    resp = requests.get(url, headers=hdrs, timeout=timeout)
    resp.raise_for_status()
    
    cache_file.write_bytes(resp.content)
    
    class RespProxy:
        def __init__(self, resp):
            self._resp = resp
            self.content = resp.content
            self.text = resp.text
            self.status_code = resp.status_code
            self.headers = dict(resp.headers)
        def json(self):
            return self._resp.json()
    
    return RespProxy(resp)

def fetch_cached(url: str, cache_dir: str, suffix: str = ".cache", max_age_days: int = 7):
    """Fetch with caching, returning FetchResult-like object."""
    ensure_dirs(cache_dir)
    cache_key = hashlib.md5(url.encode()).hexdigest()
    cache_file = Path(cache_dir) / f"{cache_key}{suffix}"
    
    if cache_file.exists():
        age_days = (time.time() - cache_file.stat().st_mtime) / 86400
        if age_days < max_age_days:
            return FetchResult(
                content=cache_file.read_bytes(),
                status_code=200,
                headers={}
            )
    
    resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=60)
    resp.raise_for_status()
    cache_file.write_bytes(resp.content)
    
    return FetchResult(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))

def json_dump(obj: Any, path: str) -> None:
    ensure_dirs(os.path.dirname(path) or ".")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)

def write_items(path: str, version: str, generated_at: str, items: list) -> None:
    ensure_dirs(os.path.dirname(path) or ".")
    payload = {
        "schemaVersion": version,
        "generatedAt": generated_at,
        "items": items,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
