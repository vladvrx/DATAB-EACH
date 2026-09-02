#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const webglPath = path.join(
  projectRoot,
  "reference",
  "assets",
  "webgl.3250e36a65453426.js",
);

const anchor = "for(let Nu in Fr){const e=Fr[Nu];";
const nightMode =
  'const nightModeDefines={SKY_TOP_COLOR:zt(new V("#030a24")),SKY_BOTTOM_COLOR:zt(new V("#183968")),SKY_HORIZON_FADE:Ut(.44),SKY_HORIZON_STRENGTH:Ut(.7),SKY_CLOUDS_ALPHA:Ut(.55),SKY_CLOUDS_MULT:Bt(.42,.5,.78),CLOUDS_COLOR:Bt(.7,.85,1.15),WATER_TOP_COLOR:zt(new V("#0a2a52")),WATER_COLOR:zt(new V("#164a73")),UNDERWATER_MULT:Ut(.45),FOG_FAR:zt(new V("#07162f")),FOG_NEAR:zt(new V("#193a61")),SHADOW_COLOR:zt(new V("#020617")),RIM_COLOR:Bt(.35,.55,1),CHAR_RIM_COLOR:Bt(.5,.72,1.2),GRASS_BOTTOM_COLOR:zt(new V("#173d35")),GRASS_TOP_COLOR:zt(new V("#376f59")),TERRAIN_BASE_COLOR:zt(new V("#315f50")),TERRAIN_BASE_NUANCE_COLOR:zt(new V("#254f48")),TERRAIN_HIGHGRASS_COLOR:zt(new V("#214f40")),TERRAIN_PAVE_COLOR:zt(new V("#56647a")),TERRAIN_ROAD_COLOR:zt(new V("#536477")),TERRAIN_SAND_LIGHT_COLOR:zt(new V("#a6a58a")),TERRAIN_SAND_DARK_COLOR:zt(new V("#777653")),FAKE_AO_MULT:Bt(.8,.9,1.2),AO_MULT_BOTTOM_TINT:Bt(.02,.06,.16),AO_MULT_UP_TINT:Bt(.55,.7,1),AO_ILLUM_LOW:Ut(.58),AO_ILLUM_HIGH:Ut(1.05)};for(const nightBiome of Object.values(Fr))Object.assign(nightBiome.defines,nightModeDefines);';

let source = fs.readFileSync(webglPath, "utf8");

if (!source.includes(nightMode)) {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new Error("Could not uniquely locate the biome definitions");
  }
  source = source.slice(0, first) + nightMode + source.slice(first);
  fs.writeFileSync(webglPath, source);
}

console.log("Applied the moonlit night palette to every game biome.");
