# glorb direct Three.js port

This is the fidelity build. It comes from the game's authoritative ESM runtime rather than a
recreated scene. The recovery process preserves the original module graph and behavior while
expanding the production chunks into readable JavaScript with source maps. High-confidence engine
subsystems and Vue components are renamed through Babel scope bindings, so references cannot drift.

The original build uses Three.js revision 150. The repository pins `three` and `@types/three` to
`0.150.1` so extracted modules do not change renderer, animation, color-management, or loader
behavior during source recovery.

Run `npm run port:recover`, then open `/direct-port`. The recovered Vue HUD is the
reference mount; `/` and `/three-js` serve the playable Three.js game. `/three-port/`
remains as a compatibility mount. Both Vue entry points load the same readable bootstrap,
formatted stylesheets, and recovered runtime. The authoritative game remains at `/reference.html`
for side-by-side checks, and the rejected prototype is inactive under
`prototypes/threejs-recreation`.

The port extracts exact scene manifests, GLSL chunks, character animation frame ranges, and the
audio-sprite table into `direct-port/data` and `direct-port/src`. Recovered production chunks live
under the root `vendor/` directory. First-party startup code stays readable in
`direct-port/src`, while formatted recovered CSS lives in `direct-port/styles`. All page and runtime
asset URLs are relative. Both builds share the canonical GLB, texture, audio, locale, and Draco
assets under `reference`; `analysis/asset-inventory.json` pins every file by SHA-256.

The active port is local-only. Its recovery pass removes remote analytics, verification, account
services, and hosted video code, then installs inert compatibility objects for legacy call sites.
The generated page also restricts connections and frames to local content through its content
security policy. Source maps omit embedded copies of the unsanitized reference chunks.

`npm run test:port` verifies the root entry point, start view, alien color-only
customization, Map/Quests phone, complete intro dialogue and island handoff, actual keyboard
movement, original Walk/Run clips, and reload-safe routes. It also fails the suite if an active port
page requests a remote host, a root-absolute asset path returns, or blocked online-service code
returns to the generated runtime.
