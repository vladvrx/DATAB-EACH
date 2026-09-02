# DATAB-EACH direct Three.js port

This is the fidelity build. It comes from the game's authoritative ESM runtime rather than a
recreated scene. The recovery process preserves the original module graph and behavior while
expanding the production chunks into readable JavaScript with source maps. High-confidence engine
subsystems and Vue components are renamed through Babel scope bindings, so references cannot drift.

The original build uses Three.js revision 150. The repository pins `three` and `@types/three` to
`0.150.1` so extracted modules do not change renderer, animation, color-management, or loader
behavior during source recovery.

Run `npm run port:recover`, then open `/three-port/`. The root URL now redirects to this port. The
authoritative game remains at `/reference.html` for side-by-side checks, and the rejected prototype
is inactive under `prototypes/threejs-recreation`.

The port extracts exact scene manifests, GLSL chunks, character animation frame ranges, and the
audio-sprite table into `direct-port/data` and `direct-port/src`. Both builds share the canonical
GLB, texture, audio, locale, and Draco assets under `reference`; `analysis/asset-inventory.json`
pins every file by SHA-256.

`npm run test:port` verifies the start view, alien color-only customization, Map/Quests phone,
complete intro dialogue and island handoff, actual keyboard movement, original Walk/Run clips, and
reload-safe port routes.
