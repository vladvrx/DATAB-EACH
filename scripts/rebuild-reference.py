#!/usr/bin/env python3
"""Rebuild Data B-each's reference.html for a three-rescue dump layout."""
from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DUMP = ROOT / "reference"
SRC_HTML = Path("/tmp/cw/index.html")
INVENTORY = ROOT / "src/data/inventory.json"
BLENDER_MAP = Path("/tmp/cw/blender-map.json")
ORIGIN = "https://databeach.local/"

CURSOR_NAMES = [
    "cursor-auto",
    "cursor-crosshair",
    "cursor-pointer",
    "cursor-pointer-active",
    "cursor-grab",
    "cursor-grabbing",
]


def extract_parts(html: str) -> dict[str, str]:
    style = re.search(r"<style[^>]*>(.*?)</style>", html, re.S).group(1)
    scripts = re.findall(r"<script([^>]*)>(.*?)</script>", html, re.S)
    locale_js, old_detect_js, old_body_js, data_js, _mod = scripts
    head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
    title = re.search(r"<title>(.*?)</title>", head, re.S)
    title_text = title.group(1) if title else "Data B-each"
    head_no_style = re.sub(r"<style[\s\S]*?</style>", "", head)
    head_no_style = re.sub(r"<script[\s\S]*?</script>", "", head_no_style)
    head_no_style = re.sub(r"<title>[\s\S]*?</title>", "", head_no_style)
    head_no_style = re.sub(r"<noscript>[\s\S]*?</noscript>", "", head_no_style)
    head_tags = re.findall(r"<[^>]+/?>", head_no_style)
    head_tags = [t for t in head_tags if t.lower() not in {"<noscript>", "</noscript>"}]
    body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
    body_html = re.sub(r"<script[\s\S]*?</script>", "", body).strip()
    return {
        "style": style,
        "locale_js": locale_js[1],
        "old_detect_js": old_detect_js[1],
        "old_body_js": old_body_js[1],
        "data_js": data_js[1],
        "head_tags": head_tags,
        "title": title_text,
        "body_html": body_html,
        "main_src": "/assets/main.35e6243a65453426.js",
    }


def extract_embedded(style: str, dest: Path) -> str:
    dest.mkdir(parents=True, exist_ok=True)
    datas = list(
        re.finditer(r"url\(data:image/svg\+xml;base64,([A-Za-z0-9+/=]+)\)", style)
    )
    out = style
    # replace from the end so offsets stay valid
    for i, match in reversed(list(enumerate(datas))):
        name = CURSOR_NAMES[i] if i < len(CURSOR_NAMES) else f"embedded-{i}"
        raw = base64.b64decode(match.group(1))
        (dest / f"{name}.svg").write_bytes(raw)
        replacement = f"url(/embedded/{name}.svg)"
        out = out[: match.start()] + replacement + out[match.end() :]
    return out


def rewrite_head_href(tag: str) -> str:
    tag = tag.replace("/favicon.ico?v=918eafe8", "/favicon.ico")
    tag = re.sub(r"(/icons/[^\"'?]+)\?v=[^\"']+", r"\1", tag)
    tag = re.sub(r"(/assets/[^\"'?]+)\?v=[^\"']+", r"\1", tag)
    tag = re.sub(r"(/manifest\.webmanifest)\?v=[^\"']+", r"\1", tag)
    tag = tag.replace(
        "https://databeach.local/share/share_en.png?v=918eafe8",
        "/share/share_en.png",
    )
    return tag


def build_html(parts: dict[str, str], style: str) -> str:
    head_lines = []
    for tag in parts["head_tags"]:
        if tag.lower().startswith("<base"):
            head_lines.append('<base href="/">')
            head_lines.append(f"<script>{parts['locale_js']}</script>")
            head_lines.append(f"<title>{parts['title']}</title>")
            continue
        head_lines.append(rewrite_head_href(tag))

    comment = f"""<!--
  Data B-each reference HTML
  Rebuilt {datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")} from
  {ORIGIN} to sit at the root of a three-rescue dump.

  Serve THIS folder as the site root (not as a subpath, not as file://).
  Sibling folders this file expects:

    assets/       hashed JS, GLB, audio, images, fonts, locale JSON
    icons/        favicon SVGs and PWA PNGs
    oldBrowser/   oldBrowser.jpg
    embedded/     cursor SVGs extracted from the original inline CSS
    _external/    Cookie Law / GTM / reCAPTCHA / YouTube (optional)
    .gltf/        logical /blender/Exports names → hashed /assets files
    MANIFEST.json URL → local path map

  The boot file is still assets/main.35e6243a65453426.js. Vendor, WebGL,
  Draco, GLBs, and audio load after that.
-->"""

    head = "\n    ".join(head_lines)
    return f"""<!DOCTYPE html>
<html lang="en">
  {comment}
  <head>
    {head}
    <style>
{style}
    </style>
    <link rel="stylesheet" href="/assets/game-cursor.css">
    <script src="/assets/game-cursor.js" defer></script>
    <noscript></noscript>
    <script>{parts["old_detect_js"]}</script>
  </head>
  <body>
    <script>{parts["old_body_js"]}</script>
    {parts["body_html"]}
    <script>{parts["data_js"]}</script>
    <script type="module" src="{parts["main_src"]}" defer></script>
  </body>
</html>
"""


def write_manifest(dump: Path) -> None:
    inventory = json.loads((ROOT / "src/data/inventory.json").read_text())
    files = []
    for item in inventory["files"]:
        path = item["path"]
        local = "index.html" if path == "/" else path.lstrip("/")
        files.append(
            {
                "url": ORIGIN + ("" if path == "/" else path),
                "local": local,
                "bytes": item["bytes"],
                "folder": local.split("/")[0],
            }
        )
    blender = {}
    if BLENDER_MAP.exists():
        blender = json.loads(BLENDER_MAP.read_text())
    payload = {
        "origin": ORIGIN,
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "reference": "reference.html",
        "entry": "index.html",
        "dump_folders": [
            "assets",
            "icons",
            "oldBrowser",
            "embedded",
            "_external",
            ".gltf",
        ],
        "hosted_files": len(files),
        "hosted_bytes": inventory["totals"]["bytes"],
        "blender_logical_files": len(blender),
        "files": files,
    }
    (dump / "MANIFEST.json").write_text(json.dumps(payload, indent=2) + "\n")
    gltf_dir = dump / ".gltf"
    gltf_dir.mkdir(parents=True, exist_ok=True)
    (gltf_dir / "logical-to-hashed.json").write_text(
        json.dumps(blender, indent=2) + "\n"
    )
    (gltf_dir / "README.md").write_text(
        """# `.gltf` is not a hosted folder

The live game never serves `/blender/Exports/*`. Those names are keys in
`$manifest`. Requesting them returns the SPA HTML fallback.

Real meshes are hashed `.glb` files under `/assets/`. See
`logical-to-hashed.json` for the 374 mappings extracted from vendor.js.

Scene layout JSON (`Scene_IslandWest.json`, …) is inlined inside
`assets/vendor.75f6e6ae65453426.js`, not hosted as its own file.
"""
    )
    external = dump / "_external"
    external.mkdir(parents=True, exist_ok=True)
    (external / "urls.json").write_text(
        json.dumps(
            {
                "note": "Third-party URLs the game loads at runtime. Not part of the 31.53 MiB origin payload.",
                "urls": [
                    "https://cdn.cookielaw.org/scripttemplates/otSDKStub.js",
                    "https://www.googletagmanager.com/gtm.js?id=GTM-5P852C7",
                    "https://www.recaptcha.net/recaptcha/api.js?onload=_onRecaptchaLoaded",
                    "https://www.youtube.com/iframe_api",
                    "https://www.youtube-nocookie.com/embed/",
                    "https://databeach.local/privacy-notice/",
                    "https://databeach.local/wp-content/uploads/databeach-terms-of-use.pdf",
                ],
            },
            indent=2,
        )
        + "\n"
    )


def main() -> None:
    DUMP.mkdir(parents=True, exist_ok=True)
    html = SRC_HTML.read_text()
    parts = extract_parts(html)
    style = extract_embedded(parts["style"], DUMP / "embedded")
    rebuilt = build_html(parts, style)
    (DUMP / "reference.html").write_text(rebuilt)
    (DUMP / "index.html").write_text(rebuilt)
    write_manifest(DUMP)
    print(f"wrote {DUMP / 'reference.html'} ({len(rebuilt)} bytes)")
    print(f"embedded SVGs: {len(list((DUMP / 'embedded').glob('*.svg')))}")


if __name__ == "__main__":
    main()
