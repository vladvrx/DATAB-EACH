#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const vendorPath = path.join(
  projectRoot,
  "reference",
  "assets",
  "vendor.75f6e6ae65453426.js",
);
const outputPath = path.join(
  projectRoot,
  "src",
  "game",
  "data",
  "island-west.json",
);

const vendor = fs.readFileSync(vendorPath, "utf8");
const marker = "tv=JSON.parse('";
const start = vendor.indexOf(marker) + marker.length;
const end = vendor.indexOf("')", start);

if (start < marker.length || end < 0) {
  throw new Error("Could not locate the IslandWest manifest in the retained bundle");
}

const manifest = JSON.parse(vendor.slice(start, end));
if (manifest.name !== "IslandWest") {
  throw new Error(`Expected IslandWest, found ${manifest.name}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Extracted ${manifest.actors.length} actors and ${Object.keys(manifest.points).length} points to ${outputPath}`,
);
