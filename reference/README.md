# reference/

Self-contained Coastal World boot folder: `reference.html` plus every hosted file it loads.

Serve **this folder** as the site root:

```bash
npm run dump:serve
# or from this directory: python3 -m http.server 43180
```

Then open http://127.0.0.1:43180/reference.html

Do not open `reference.html` as `file://`. Scripts fetch `/assets/…` from the origin root.

## Layout

| Path | What it is |
| --- | --- |
| `reference.html` / `index.html` | Rebuilt boot page |
| `assets/` | JS bundles, GLBs, audio, images, fonts, locale JSON |
| `icons/` | Favicons and PWA icons |
| `oldBrowser/` | Fallback JPEG |
| `embedded/` | Cursor SVGs extracted from the original CSS |
| `vendors/draco/` | Draco WASM/JS decoder |
| `share/` | Open Graph image |
| `.gltf/` | Logical Blender export names → hashed `/assets` files |
| `_external/urls.json` | Third-party URLs (not hosted on the game origin) |
| `MANIFEST.json` | URL → local path map |
