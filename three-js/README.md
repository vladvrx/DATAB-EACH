# Data B-each — Three.js

Playable 1:1 recreation of DATAB-EACH on the original **Three.js r150** engine (`loadWebGL`) plus a vanilla HUD that clones the recovered start screen, phone, quests, dialogue, and menus.

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
4. Vanilla HUD in `src/hud/` that talks to `$webgl.store`, `$dialogs`, `$quests`, `$store.phone`, and `$router`:
   - Start overlay if the intro route is late
   - Dialogue bubbles, typewriter, Yes / No thanks choices
   - Phone HUD, in-hand phone, Map with pins, Quests list
   - Header, pause menu, joystick, interaction button

## Files

| Path | Role |
| --- | --- |
| `index.html` | Preloader + original CSS |
| `src/boot.js` | `__DATA`, plugin install, same load order as recovered `main.js` |
| `src/root.js` | Three.js canvas + router + notifications |
| `src/hud/` | Start, phone, dialogue, menus |

Locales stay in `reference/assets/dialogs_en.json`, `quests_en.json`, `characters_en.json`.
