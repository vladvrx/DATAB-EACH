# Coastal World dump (rebuilt)

`reference.html` is the original Coastal World boot page, rebuilt to sit at the root of a three-rescue dump.

Drop **this file** into `three-rescue-2026-09-01/` next to your existing folders (`assets`, `icons`, `oldBrowser`, `embedded`, `_external`, `.gltf`, `MANIFEST.json`) and serve that folder as the site root:

```bash
node scripts/serve-dump.mjs
# or: python3 -m http.server 43180
```

Open http://127.0.0.1:43180/reference.html

Do not open it as `file://`. The JS bundles fetch `/assets/…` from the origin root.

## What this file points at

| Path in HTML | Dump folder |
| --- | --- |
| `/assets/main.35e6243a65453426.js` and the rest of `/assets/` | `assets/` |
| `/icons/*`, `/favicon.ico` | `icons/` and dump-root favicon |
| `/oldBrowser/oldBrowser.jpg` | `oldBrowser/` |
| `/embedded/cursor-*.svg` | `embedded/` (extracted from the original inline CSS) |
| `/share/share_en.png` | not in the original dump list; downloaded here |
| `/vendors/draco/*` | not in the original dump list; required to run |

`.gltf` is not referenced by the HTML. Those names live in `vendor.js` as `/blender/Exports/…` keys. See `.gltf/logical-to-hashed.json`.

## Local copy in this repo

`scripts/download-dump.py` filled `assets/`, `icons/`, `oldBrowser/`, `vendors/`, and `share/` from the live origin so the rebuilt HTML can boot here. Those binaries are gitignored.
