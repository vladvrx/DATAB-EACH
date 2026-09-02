# glorb

The playable game is the **Three.js** build at `/three-js` (and `/`).

The recovered Vue HUD remains at `/direct-port` as a visual reference. A standalone copy of only the Three.js game is [datab-each-threejs](https://github.com/vladvrx/datab-each-threejs). This repo keeps `three-js/` as the backup of that version.

The inventory dashboard remains available at `/inventory`.

## Run locally

```bash
npm run dev
```

The reference build is served from the tracked `reference/` folder without
copying its assets into `public/`. Its boot page and all referenced assets are
available at the site root so the original runtime paths continue to work.

---

# glorb reference inventory

Inventory of the retained island reference assets compared with a local `three-rescue` dump layout.

## Answer

The published game is **31.53 MiB uncompressed (33.06 MB)** across **1,309 real files**.

Gzip of that same set (level 6) is **26.64 MiB**. Audio and images barely shrink; JS, HTML, JSON, GLB, and WASM do.

A current browser will not download all of it (one image format per PNG/WebP/AVIF triple, WOFF2 instead of WOFF, WASM Draco instead of the 706 KB JS decoder). A full playthrough is closer to **~26.9 MiB**.

HTML + `main.js` is still only ~275 KB. The rest is `vendor.js`, hundreds of GLBs, terrain textures, and twelve `.m4a` files.

## Were those the files from the 32.4 MB table?

Yes. That table was the live origin, not the Downloads dump.

| Category | Files | Size |
| --- | ---: | ---: |
| Audio (`.m4a`) | 12 | 11.78 MiB |
| PNG | 337 | 7.98 MiB |
| 3D models (`.glb`) | 339 | 5.26 MiB |
| JavaScript (app + Draco JS) | 5 | 2.40 MiB |
| WebP | 290 | 1.55 MiB |
| AVIF | 290 | 0.95 MiB |
| Everything else | 36 | ~1.61 MiB |
| **Total hosted** | **1,309** | **31.53 MiB / 33.06 MB** |

## Your dump folders

I cannot read `C:\Users\user\Downloads\three-rescue-2026-09-01` from this environment. Mapped against the live site:

| Dump path | Live mapping | In the 31.53 MiB? |
| --- | --- | --- |
| `assets/` | `/assets/` — 1,294 files, **29.69 MiB** | Yes. This is the game. |
| `MANIFEST.json` | Dump index | Not a game file |
| `.gltf` | Logical `/blender/Exports/*` names | **Not hosted.** Those URLs return SPA HTML. Real models are hashed `.glb` files in `assets/`. |

`icons/`, `oldBrowser/`, `embedded/`, and `_external/` were dropped from this repo.

### Likely missing from that folder list

- `/vendors/draco/` (1.00 MiB) — decoder JS, WASM, wrapper
- `/share/share_en.png` (226 KB)
- Site root: `index.html`, `favicon.ico`, `manifest.webmanifest`, `sitemap.xml`, `robots.txt`

Quick check that `assets/` is complete: it should contain **12 `.m4a` files** and **339 `.glb` files**. Also look for `dialogs_en.json` (120 KB) — locale JSON is concatenated at runtime (`/assets/partners_en.json`, `characters_en.json`, `dialogs_en.json`, `items_en.json`, `quests_en.json`) and is easy for a static scraper to miss.

## Reference folder

The **`reference/`** folder keeps the retained island, character, audio, model, and interface assets (~35 MB), along with neutralized locale data, the new glorb logo, and replicated `index.html` / `reference.html` boot pages. Serve this folder with `npm run dump:serve` to open the local reference build.

## Run the inventory locally

```bash
npm install
npm run dev
```

Opens on port **43173**.

```bash
npm run build
npm start -- -p 43173
```

## Data

`src/data/inventory.json` is a GET of every candidate URL from the HTML/JS/CSS bundles, keeping only responses that are not the 150,450-byte SPA HTML fallback.
