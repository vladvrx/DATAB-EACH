#!/usr/bin/env python3
"""Download hosted Coastal World files into coastal-world-dump/."""
from __future__ import annotations

import json
import ssl
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DUMP = ROOT / "coastal-world-dump"
INVENTORY = ROOT / "src/data/inventory.json"
ORIGIN = "https://coastalworld.merci-michel.com"
ctx = ssl.create_default_context()
SKIP = {"/", "/sitemap.xml", "/robots.txt"}


def fetch(path: str, dest: Path) -> tuple[str, int]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = ORIGIN + path
    req = Request(url, headers={"User-Agent": "coastal-world-dump/1.0"})
    with urlopen(req, context=ctx, timeout=60) as resp:
        body = resp.read()
    dest.write_bytes(body)
    return path, len(body)


def main() -> None:
    inventory = json.loads(INVENTORY.read_text())
    jobs = []
    for item in inventory["files"]:
        path = item["path"]
        if path in SKIP:
            continue
        local = DUMP / path.lstrip("/")
        jobs.append((path, local))

    print(f"downloading {len(jobs)} files into {DUMP}")
    done = 0
    with ThreadPoolExecutor(max_workers=32) as pool:
        futs = [pool.submit(fetch, path, dest) for path, dest in jobs]
        for fut in as_completed(futs):
            path, size = fut.result()
            done += 1
            if done % 150 == 0:
                print(f"  {done}/{len(jobs)} last {path} ({size} bytes)")
    print("done")


if __name__ == "__main__":
    main()
