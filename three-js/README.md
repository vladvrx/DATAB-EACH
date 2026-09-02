# Data B-each — Three.js

Playable recreation of DATAB-EACH on the original **Three.js r150** engine (`loadWebGL`) plus a HUD for the start screen, dialogue, and menus. There is no in-game phone and no map.

This is not the archived `prototypes/threejs-recreation` placeholder. The island, shaders, splats, cameras, NPCs, and intro boat are the recovered WebGL runtime loading the same hashed GLBs from `reference/assets`.

## Run

From the repo root:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43173/three-js/](http://127.0.0.1:43173/three-js/).

The recovered Vue HUD build remains at `/`. Use it as the visual reference while playing this port.

## What boots

1. Original Vue plugins (`savestate`, `manifest`, `quests`, `dialogs`, `items`, `characters`, `router`, `preloader`, `webgl`) so the Three.js runtime gets the same `app.$` contracts.
2. `loadWebGL` from `vendor/webgl.3250e36a65453426.js` — Three.js r150, original shaders, IslandIntro → IslandWest.
3. Vue `WebGL` wrapper, `NiceRouterView` (intro **Start the journey**), and `NotificationCenter`.
4. Vanilla HUD in `src/hud/` that talks to `$webgl.store`, `$dialogs`, and `$router`:
   - Start overlay if the intro route is late
   - Dialogue bubbles, typewriter, Yes / No thanks choices
   - Header, pause menu, joystick, interaction button

The intro Data B-each logo only stays on screen while **Start the journey** is visible.

## Files

| Path | Role |
| --- | --- |
| `index.html` | Preloader + original CSS |
| `src/boot.js` | `__DATA`, then engine import |
| `src/engine.js` | Plugin install and the same load order as recovered `main.js` |
| `src/root.js` | Three.js canvas + router + notifications |
| `src/hud/` | Start, dialogue, menus |

Locales stay in `reference/assets/dialogs_en.json`, `quests_en.json`, `characters_en.json`.

Studio still edits this build: **Apply to game** writes island props, quests, characters, and dialogue into `reference/assets` and patches the same `loadWebGL` bundles. Open `/three-js` after Apply. A Three.js-only copy also lives at [github.com/vladvrx/datab-each-threejs](https://github.com/vladvrx/datab-each-threejs); this `three-js/` folder is the in-repo backup.
