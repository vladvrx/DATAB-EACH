#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEBGL_CACHE = "west-music-wipe";

const CHARACTER_URL_SWAPS = [];

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

const RUN_FX_SWAPS = [
  [
    "e.alphaFrom=1,e.alphaTo=1,e.colorFrom.copy(new V(16777215)).multiplyScalar(1),e.colorTo.copy(new V(7327214)).multiplyScalar(1)",
    "e.alphaFrom=1,e.alphaTo=1,e.colorFrom.copy(new V(6211839)).multiplyScalar(1),e.colorTo.copy(new V(2854890)).multiplyScalar(1)",
  ],
  [
    "e.alphaFrom = 1, e.alphaTo = 1, e.colorFrom.copy(new V(16777215)).multiplyScalar(1), e.colorTo.copy(new V(7327214)).multiplyScalar(1)",
    "e.alphaFrom = 1, e.alphaTo = 1, e.colorFrom.copy(new V(6211839)).multiplyScalar(1), e.colorTo.copy(new V(2854890)).multiplyScalar(1)",
  ],
  [
    "e.scaleFrom.copy(i),e.scaleTo.setScalar(0),e.alpha=1}",
    "e.scaleFrom.copy(i),e.scaleTo.setScalar(0),e.alpha=1,e.colorFrom.copy(new V(6211839)).multiplyScalar(1),e.colorTo.copy(new V(2854890)).multiplyScalar(1)}",
  ],
  [
    "e.scaleFrom.copy(i), e.scaleTo.setScalar(0), e.alpha = 1;",
    "e.scaleFrom.copy(i), e.scaleTo.setScalar(0), e.alpha = 1, e.colorFrom.copy(new V(6211839)).multiplyScalar(1), e.colorTo.copy(new V(2854890)).multiplyScalar(1);",
  ],
];

const INTRO_CAM_SWAPS = [
  [
    "introFrom:{position:[-7.900966,76.942503,124.816482],quaternion:[-.17203494,-.38932646,-.07426799,.90183876]},introTo:{position:[-39.199139,39.079015,-39.791217],quaternion:[-.06789136,-.70262188,-.06765479,.70507878]}",
    "introFrom:{position:[-55.296578,76.942503,-308.65067],quaternion:[.01040273,.98944982,.11040314,-.09323084]},introTo:{position:[-23.998405,39.079015,-144.042971],quaternion:[-.02222519,.94912906,.30646747,.06883137]}",
  ],
  [
    "introFrom:{position:[-55.296578,76.942503,-308.65067],quaternion:[-.07426799,.90183876,.17203494,.38932646]},introTo:{position:[-23.998405,39.079015,-144.042971],quaternion:[-.06765479,.70507878,.06789136,.70262188]}",
    "introFrom:{position:[-55.296578,76.942503,-308.65067],quaternion:[.01040273,.98944982,.11040314,-.09323084]},introTo:{position:[-23.998405,39.079015,-144.042971],quaternion:[-.02222519,.94912906,.30646747,.06883137]}",
  ],
  [
    `introFrom: {
    position: [-7.900966, 76.942503, 124.816482],
    quaternion: [-.17203494, -.38932646, -.07426799, .90183876]
  },
  introTo: {
    position: [-39.199139, 39.079015, -39.791217],
    quaternion: [-.06789136, -.70262188, -.06765479, .70507878]
  }`,
    `introFrom: {
    position: [-55.296578, 76.942503, -308.65067],
    quaternion: [.01040273, .98944982, .11040314, -.09323084]
  },
  introTo: {
    position: [-23.998405, 39.079015, -144.042971],
    quaternion: [-.02222519, .94912906, .30646747, .06883137]
  }`,
  ],
  [
    `introFrom: {
    position: [-55.296578, 76.942503, -308.65067],
    quaternion: [-.07426799, .90183876, .17203494, .38932646]
  },
  introTo: {
    position: [-23.998405, 39.079015, -144.042971],
    quaternion: [-.06765479, .70507878, .06789136, .70262188]
  }`,
    `introFrom: {
    position: [-55.296578, 76.942503, -308.65067],
    quaternion: [.01040273, .98944982, .11040314, -.09323084]
  },
  introTo: {
    position: [-23.998405, 39.079015, -144.042971],
    quaternion: [-.02222519, .94912906, .30646747, .06883137]
  }`,
  ],
];

function applySwaps(source, swaps) {
  let next = source;
  for (const [from, to] of swaps) {
    if (next.includes(to) || !next.includes(from)) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function patchWaterColors(source) {
  let next = source;
  for (const [from, to] of WATER_COLOR_SWAPS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

function patchRunFx(source) {
  return applySwaps(source, RUN_FX_SWAPS);
}

function patchCharacterUrl(source) {
  return applySwaps(source, CHARACTER_URL_SWAPS);
}

function patchIntroCam(source) {
  return applySwaps(source, INTRO_CAM_SWAPS);
}

function bustWebgl(source) {
  return source
    .replace(
      /import\("(\.\/webgl\.[a-z0-9]+)\.js(?:\?[^"]*)?"\)/g,
      `import("$1.js?v=${WEBGL_CACHE}")`,
    )
    .replace(
      /webgl\.([a-z0-9]+)\.js(?:\?v=[^"&\s]*)?/g,
      `webgl.$1.js?v=${WEBGL_CACHE}`,
    );
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
  if (patchFile(file, (source) => patchCharacterUrl(patchRunFx(patchWaterColors(source))))) {
    patched.push(path.relative(projectRoot, file));
  }
}

for (const file of vendorFiles) {
  if (patchFile(file, (source) => bustWebgl(patchIntroCam(source)))) {
    patched.push(path.relative(projectRoot, file));
  }
}

const indexFiles = [
  path.join(projectRoot, "three-js", "index.html"),
  path.join(projectRoot, "index.html"),
];
for (const file of indexFiles) {
  if (patchFile(file, bustWebgl)) patched.push(path.relative(projectRoot, file));
}

if (!patched.length) {
  console.log("Neon water, blue run FX, and intro camera were already applied.");
} else {
  console.log(`Patched:\n- ${patched.join("\n- ")}`);
}
