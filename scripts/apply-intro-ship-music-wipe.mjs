#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WAVE_COLORS_MIN = [
  [
    'waves:[{color:"rgb(255, 255, 255)",bleed:.3,offset:-.3,height:.9},{color:"rgb(186, 226, 245)",bleed:.24,offset:1,height:.75},{color:"rgb(137, 206, 237)",bleed:.2,offset:-.3,height:.75},{color:"rgb(112, 191, 228)",bleed:.5,offset:0,height:.6}]',
    'waves:[{color:"rgb(255, 64, 96)",bleed:.3,offset:-.3,height:.9},{color:"rgb(255, 214, 0)",bleed:.24,offset:1,height:.75},{color:"rgb(48, 220, 120)",bleed:.2,offset:-.3,height:.75},{color:"rgb(112, 191, 228)",bleed:.5,offset:0,height:.6}]',
  ],
];

const WAVE_COLORS_PRETTY = [
  [
    `    waves: [{
      color: "rgb(255, 255, 255)",
      bleed: .3,
      offset: -.3,
      height: .9
    }, {
      color: "rgb(186, 226, 245)",
      bleed: .24,
      offset: 1,
      height: .75
    }, {
      color: "rgb(137, 206, 237)",
      bleed: .2,
      offset: -.3,
      height: .75
    }, {
      color: "rgb(112, 191, 228)",
      bleed: .5,
      offset: 0,
      height: .6
    }]`,
    `    waves: [{
      color: "rgb(255, 64, 96)",
      bleed: .3,
      offset: -.3,
      height: .9
    }, {
      color: "rgb(255, 214, 0)",
      bleed: .24,
      offset: 1,
      height: .75
    }, {
      color: "rgb(48, 220, 120)",
      bleed: .2,
      offset: -.3,
      height: .75
    }, {
      color: "rgb(112, 191, 228)",
      bleed: .5,
      offset: 0,
      height: .6
    }]`,
  ],
];

const WIPE_FLIP_MIN = [
  [
    "g=p*f,v=m+(u+1)*c*m;let b=f;const y=e+1;if(y<self.waves.length){const e=a*(n-y);b=dG(cG(i,e,e+r,0,1))*f}",
    "g=(1-p)*f,v=m+(u+1)*c*m;let b=0;const y=e+1;if(y<self.waves.length){const e=a*(n-y);b=(1-dG(cG(i,e,e+r,0,1)))*f}",
  ],
];

const WIPE_FLIP_PRETTY = [
  [
    `      const m = self.canvas.width,
        f = self.canvas.height,
        g = p * f,
        v = m + (u + 1) * c * m;
      let b = f;
      const y = e + 1;
      if (y < self.waves.length) {
        const e = a * (n - y);
        b = dG(cG(i, e, e + r, 0, 1)) * f;
      }`,
    `      const m = self.canvas.width,
        f = self.canvas.height,
        g = (1 - p) * f,
        v = m + (u + 1) * c * m;
      let b = 0;
      const y = e + 1;
      if (y < self.waves.length) {
        const e = a * (n - y);
        b = (1 - dG(cG(i, e, e + r, 0, 1))) * f;
      }`,
  ],
];

const BGM_SWAPS = [
  ['bgm: "music_minigame_loop"', 'bgm: "music_island_west"'],
  ['bgm: "music_secret"', 'bgm: "music_island_west"'],
  ['bgm: "music_intro"', 'bgm: "music_island_west"'],
  ['bgm:"music_minigame_loop"', 'bgm:"music_island_west"'],
  ['bgm:"music_secret"', 'bgm:"music_island_west"'],
  ['bgm:"music_intro"', 'bgm:"music_island_west"'],
];

const PLAYSOUND_SWAPS = [
  [
    "function M(e, t = {}) {\n    if (t.delay, !mu.isUnlocked()) return;",
    'function M(e, t = {}) {\n    if ("string" == typeof e && e.startsWith("music_") && "music_island_west" !== e) return;\n    if (t.delay, !mu.isUnlocked()) return;',
  ],
  [
    "function M(e,t={}){if(t.delay,!mu.isUnlocked())return;",
    'function M(e,t={}){if("string"==typeof e&&e.startsWith("music_")&&"music_island_west"!==e)return;if(t.delay,!mu.isUnlocked())return;',
  ],
];

const WEBGL_CACHE = "west-music-wipe";

function applySwaps(source, swaps) {
  let next = source;
  for (const [from, to] of swaps) {
    if (next.includes(to) && !next.includes(from)) continue;
    if (!next.includes(from)) continue;
    next = next.split(from).join(to);
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

function bustWebgl(source) {
  return source.replace(
    /webgl\.([a-z0-9]+)\.js(?:\?v=[^"&\s]*)?/g,
    `webgl.$1.js?v=${WEBGL_CACHE}`,
  );
}

const vendorFiles = [
  ...listHashed(path.join(projectRoot, "vendor"), "vendor."),
  ...listHashed(path.join(projectRoot, "reference", "assets"), "vendor."),
];
const webglFiles = [
  ...listHashed(path.join(projectRoot, "vendor"), "webgl."),
  ...listHashed(path.join(projectRoot, "reference", "assets"), "webgl."),
];

const vendorSwaps = [
  ...WAVE_COLORS_MIN,
  ...WAVE_COLORS_PRETTY,
  ...WIPE_FLIP_MIN,
  ...WIPE_FLIP_PRETTY,
  ...BGM_SWAPS,
];

const patched = [];
for (const file of vendorFiles) {
  if (patchFile(file, (source) => bustWebgl(applySwaps(source, vendorSwaps)))) {
    patched.push(path.relative(projectRoot, file));
  }
}
for (const file of webglFiles) {
  if (patchFile(file, (source) => applySwaps(source, PLAYSOUND_SWAPS))) {
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
  console.log("Intro ship music and loader wipe patches were already applied.");
} else {
  console.log(`Patched:\n- ${patched.join("\n- ")}`);
}
