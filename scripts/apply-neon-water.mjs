#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WATER_COLOR_SWAPS = [
  ["#3fbfff", "#39ff14"],
  ["#6db6e4", "#00e83a"],
  ["#4189fd", "#39ff14"],
  ["#7992ff", "#00e83a"],
  ["#0a2a52", "#39ff14"],
  ["#164a73", "#00e83a"],
  ["#0ad64a", "#39ff14"],
  ["#00b83a", "#00e83a"],
  ["#07162f", "#39ff14"],
  ["#193a61", "#00e83a"],
  ["#183968", "#00e83a"],
];

function patchWaterColors(source) {
  let next = source;
  for (const [from, to] of WATER_COLOR_SWAPS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

function patchFile(file, transform) {
  if (!fs.existsSync(file)) return false;
  const original = fs.readFileSync(file, "utf8");
  const next = transform(original);
  if (next === original) return false;
  fs.writeFileSync(file, next);
  return true;
}

function listHashed(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".js") && !name.includes(".map"))
    .map((name) => path.join(dir, name));
}

const webglFiles = [
  ...listHashed(path.join(projectRoot, "vendor"), "webgl."),
  ...listHashed(path.join(projectRoot, "reference", "assets"), "webgl."),
];
const vendorFiles = [
  ...listHashed(path.join(projectRoot, "vendor"), "vendor."),
  ...listHashed(path.join(projectRoot, "reference", "assets"), "vendor."),
];

const patched = [];
for (const file of webglFiles) {
  if (patchFile(file, patchWaterColors)) patched.push(path.relative(projectRoot, file));
}

for (const file of vendorFiles) {
  if (
    patchFile(file, (source) =>
      source.replace(
        /import\("(\.\/webgl\.[a-z0-9]+)\.js(?:\?[^"]*)?"\)/g,
        'import("$1.js?v=neon-water")',
      ),
    )
  ) {
    patched.push(path.relative(projectRoot, file));
  }
}

const indexFiles = [
  path.join(projectRoot, "three-js", "index.html"),
  path.join(projectRoot, "index.html"),
];
for (const file of indexFiles) {
  if (
    patchFile(file, (source) =>
      source.replace(
        /webgl\.([a-z0-9]+)\.js(?:\?v=[^"&\s]*)?/g,
        "webgl.$1.js?v=neon-water",
      ),
    )
  ) {
    patched.push(path.relative(projectRoot, file));
  }
}

if (!patched.length) {
  console.log("Neon water colors were already applied.");
} else {
  console.log(`Restored neon water in:\n- ${patched.join("\n- ")}`);
}
