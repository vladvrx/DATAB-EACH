# `.gltf` is not a hosted folder

The live game never serves `/blender/Exports/*`. Those names are keys in
`$manifest`. Requesting them returns the SPA HTML fallback.

Real meshes are hashed `.glb` files under `/assets/`. See
`logical-to-hashed.json` for the 374 mappings extracted from vendor.js.

Scene layout JSON (`Scene_IslandWest.json`, …) is inlined inside
`assets/vendor.75f6e6ae65453426.js`, not hosted as its own file.
