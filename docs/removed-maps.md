# Removed island content

The game now keeps only Cove Island (`IslandWest`). Palm Bay (`IslandFour`), Lake Island (`IslandNorth`), and Wild Island (`IslandEast`) are no longer available from the main map, scene loader, routes, quests, dialogue, or audio systems.

## Main map

- Replaced the six full-world map variants with six Cove-only crops:
  - `map_2048.cove-only-final.avif`
  - `map_2048.cove-only-final.jpeg`
  - `map_2048.cove-only-final.webp`
  - `map_1024.cove-only-final.avif`
  - `map_1024.cove-only-final.jpg`
  - `map_1024.cove-only-final.webp`
- Removed the old full-world map variants from the bundle and inventory:
  - `map_2048.d4dad17265453426.avif`
  - `map_2048.2dad9e1b65453426.jpeg`
  - `map_2048.2019f73165453426.webp`
  - `map_1024.34b3fa8d65453426.avif`
  - `map_1024.77eab7f965453426.jpg`
  - `map_1024.9797afed65453426.webp`
- Removed the Palm Bay, Lake Island, and Wild Island map bounds, labels, pins, and navigation state. The map now contains only Cove Island coordinates and pins.

## Island scenes and collectibles

The complete scene manifests were removed, including all of their non-collectible actors: Wild Island had 61 actors, Palm Bay had 71, and Lake Island had 67.

Collectible chest actors removed from those manifests:

- Wild Island: `Chest.003`, `Chest.004`, `Chest.009`, `Chest.010`, `Chest.011`, `Chest.012`, `Chest.013`, `Chest.014`, `ChestBig.001` (9)
- Palm Bay: `Chest.009`, `Chest.010`, `Chest.011`, `Chest.012`, `Chest.013`, `Chest.014`, `Chest.015`, `Chest.016`, `ChestBig.002` (9)
- Lake Island: `Chest.004`, `Chest.005`, `Chest.006`, `Chest.007`, `Chest.008`, `Chest.009`, `Chest.010`, `Chest.011`, `Chest.012`, `ChestBig.001` (10)

That removes 28 island collectible chest actors in total. The shared chest model assets remain because Cove Island still uses them.

Scene/support files deleted:

- Wild Island: `Scene_IslandEast.4497a58f65453426.glb`, `Scene_IslandEast_GrassSplatting.e9566d4f65453426.png`, `Scene_IslandEast_TerrainSplatting.3817f8d365453426.png`, `Scene_IslandEast_ao.2922a83e65453426.bin`
- Palm Bay: `Scene_IslandFour.be2bdbac65453426.glb`, `Scene_IslandFour_GrassSplatting.500297cf65453426.png`, `Scene_IslandFour_TerrainSplatting.84e5b45665453426.png`, `Scene_IslandFour_ao.7d9ace1165453426.bin`
- Lake Island: `Scene_IslandNorth.47fff9a965453426.glb`, `Scene_IslandNorth_GrassSplatting.3cfaa81165453426.png`, `Scene_IslandNorth_TerrainSplatting.91c2283d65453426.png`, `Scene_IslandNorth_ao.495b911a65453426.bin`

## Related game content

- Removed fintech definitions: `aspiration`, `bluevine`, `coastal`, `greenwood`, `kikoff`, `lendingpoint`, `one`, `possible`, `prosper`, `tempkey`, `till`, and `x1`.
- Removed every main and side quest belonging to those fintechs.
- Removed aggregate `SupermainQuest6`, `SupermainQuest12`, and `SupermainQuest16`, which depended on the removed island fintechs.
- Removed their NPCs, ambassadors, hints, and dialogue entries, plus the island-specific `Sailor_*` and `Citizen_*` dialogue/character entries.
- Removed the retained Cove NPC dialogue that pointed players toward the deleted islands and rewrote the remaining Cove hints so they no longer mention deleted content.
- Removed the `CircuitBoat`, `CircuitCar`, and `CircuitJetski` race routes, presets, targets, loader entries, and associated assets. `CircuitBike` on Cove Island remains.
- Deleted race scene/support files: `Scene_CircuitBoat.f37bd2f565453426.glb`, `Scene_CircuitBoat_TerrainSplatting.f45d480865453426.png`, `Scene_CircuitCar.1056b1e665453426.glb`, `Scene_CircuitCar_GrassSplatting.52488daf65453426.png`, `Scene_CircuitCar_TerrainSplatting.b3a15bf165453426.png`, `Scene_CircuitJetski.e8d5065365453426.glb`, `Scene_CircuitJetski_GrassSplatting.d644a61565453426.png`, and `Scene_CircuitJetski_TerrainSplatting.a811533465453426.png`.
- Deleted the three island soundtrack files: `music_island_east.39dc426365453426.m4a`, `music_island_four.4cbbfea965453426.m4a`, and `music_island_north.cb7f8dae65453426.m4a`.
- Removed all corresponding manifest, GLTF logical-to-hashed, route, bundle, and inventory references.

Kept: Cove Island, its nine collectible chests, Aven/Brigit/Pomelo/Zenda content, the Bike race, shared collectible models, and avatar cosmetics.
