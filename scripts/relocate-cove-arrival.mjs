#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const assetsDir = path.join(projectRoot, "reference", "assets");
const vendorPath = path.join(assetsDir, "vendor.75f6e6ae65453426.js");
const webglPath = path.join(assetsDir, "webgl.3250e36a65453426.js");
const islandPath = path.join(assetsDir, "Scene_IslandWest.68c3fec765453426.glb");

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Could not uniquely patch ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let webgl = fs.readFileSync(webglPath, "utf8");
webgl = replaceOnce(
  webgl,
  'onLoad:e=>{for(let t=0;t<e.scene.children.length;t++){const s=e.scene.children[t],i=s.userData.name.toLowerCase(),o=i.split(".")[0],a=s.geometry;',
  'onLoad:e=>{e.scene.updateMatrixWorld(!0);for(let t=0;t<e.scene.children.length;t++){const s=e.scene.children[t],i=s.userData.name.toLowerCase(),o=i.split(".")[0],a=s.geometry&&s.geometry.clone();a&&a.applyMatrix4(s.matrixWorld);',
  "IslandWest root transform",
);
webgl = replaceOnce(
  webgl,
  "const i=t[s],o=i.scale,a=i.position.clone().add(s.position),n=i.quaternion;",
  "const i=t[s],o=i.scale,a=i.position.clone().add(i.parent.position),n=i.quaternion;",
  "IslandWest corrected prop transform",
);
webgl = replaceOnce(
  webgl,
  "const i=t[s],o=i.scale,a=i.position,n=i.quaternion;",
  "const i=t[s],o=i.scale,a=i.position.clone().add(i.parent.position),n=i.quaternion;",
  "IslandWest prop transform",
);
webgl = replaceOnce(
  webgl,
  "const i=n,o=w(i[0],i[2]),l=t.assets[s.asset].geometry,c=o.getPositionLength(),h=l.attributes.position.array.length;",
  "const i=n,o=w(i[0],i[2]),l=t.assets[s.asset]&&t.assets[s.asset].geometry;if(!l)continue;const c=o.getPositionLength(),h=l.attributes.position.array.length;",
  "missing dynamic prop geometry",
);
webgl = replaceOnce(
  webgl,
  'const l=t.uid+"_"+i,c=e.resources.assets[a].collider;o.physicsLayer=s[r]=l,S.push([c,l,n])',
  'const l=t.uid+"_"+i,c=e.resources.assets[a]&&e.resources.assets[a].collider;if(!c)continue;o.physicsLayer=s[r]=l,S.push([c,l,n])',
  "missing dynamic prop collider",
);
webgl = replaceOnce(
  webgl,
  'const S=[];r.groundCollider&&S.push([r.groundCollider,"ground"]);if(!1)for(let n in l.actors)',
  'const S=[];r.propsCollider&&S.push([r.propsCollider,"props"]),r.groundCollider&&S.push([r.groundCollider,"ground"]);if(!1)for(let n in l.actors)',
  "Cove static prop physics batch",
);
webgl = replaceOnce(
  webgl,
  'const S=[];S.push([r.propsCollider,"props"]),S.push([r.groundCollider,"ground"]);for(let n in l.actors)',
  'const S=[];r.propsCollider&&S.push([r.propsCollider,"props"]),r.groundCollider&&S.push([r.groundCollider,"ground"]);if(!1)for(let n in l.actors)',
  "Cove safe physics batch",
);
fs.writeFileSync(webglPath, webgl);

let patchedVendor = fs.readFileSync(vendorPath, "utf8");
patchedVendor = replaceOnce(
  patchedVendor,
  "Promise.resolve(this.resources.physicsBatchPromise).then((()=>{if(!this.destroyed&&this.physics)return this.physics.run()}))",
  "Promise.resolve().then((()=>{if(!this.destroyed&&this.physics)return this.physics.run()}))",
  "nonblocking physics startup",
);
fs.writeFileSync(vendorPath, patchedVendor);

const manifestMarker = "tv=JSON.parse('";
const vendor = patchedVendor;
const manifestStart = vendor.indexOf(manifestMarker) + manifestMarker.length;
const manifestEnd = vendor.indexOf("')", manifestStart);

if (manifestStart < manifestMarker.length || manifestEnd < 0) {
  throw new Error("Could not locate the IslandWest scene manifest");
}

const manifest = JSON.parse(vendor.slice(manifestStart, manifestEnd));
if (manifest.name !== "IslandWest") {
  throw new Error(`Expected IslandWest, found ${manifest.name}`);
}
if (manifest.dataBeachIslandOffset) {
  console.log("Cove island is already aligned with the arrival point.");
  process.exit(0);
}

const arrivalNames = new Set(["Spawn.001", "PortSpawnB.001"]);
const arrival = manifest.points["Spawn.001"];
const safeLand = manifest.points["PartnerSpawnPomelo.001"];
const offset = [arrival[0] - safeLand[0], 0, arrival[2] - safeLand[2]];

function shiftPosition(position) {
  position[0] += offset[0];
  position[1] += offset[1];
  position[2] += offset[2];
}

for (const bound of manifest.bounds) shiftPosition(bound);

for (const [name, point] of Object.entries(manifest.points)) {
  if (arrivalNames.has(name)) {
    point[1] = safeLand[1] + 0.4;
  } else {
    shiftPosition(point);
  }
}

for (const area of Object.values(manifest.areas ?? {})) {
  if (area.position) shiftPosition(area.position);
}

for (const curve of Object.values(manifest.curves ?? {})) {
  for (const point of curve.points ?? []) {
    for (let index = 0; index + 2 < point.length; index += 3) {
      point[index] += offset[0];
      point[index + 1] += offset[1];
      point[index + 2] += offset[2];
    }
  }
}

for (const actor of manifest.actors ?? []) {
  if (actor.transforms) shiftPosition(actor.transforms);
}

manifest.dataBeachIslandOffset = offset;
const encodedManifest = JSON.stringify(manifest).replaceAll("'", "\\'");
const updatedVendor =
  vendor.slice(0, manifestStart) + encodedManifest + vendor.slice(manifestEnd);
fs.writeFileSync(vendorPath, updatedVendor);

const glb = fs.readFileSync(islandPath);
if (glb.toString("ascii", 0, 4) !== "glTF") {
  throw new Error("IslandWest file is not a binary glTF");
}

const jsonLength = glb.readUInt32LE(12);
const jsonType = glb.readUInt32LE(16);
const jsonStart = 20;
const jsonEnd = jsonStart + jsonLength;
const gltf = JSON.parse(glb.subarray(jsonStart, jsonEnd).toString("utf8").trimEnd());

if (gltf.asset?.extras?.dataBeachIslandOffset) {
  throw new Error("Island GLB was already moved but its manifest was not marked");
}

for (const nodeIndex of gltf.scenes[gltf.scene ?? 0].nodes ?? []) {
  const node = gltf.nodes[nodeIndex];
  const translation = node.translation ?? [0, 0, 0];
  node.translation = [
    translation[0] + offset[0],
    translation[1] + offset[1],
    translation[2] + offset[2],
  ];
}

gltf.asset.extras = {
  ...(gltf.asset.extras ?? {}),
  dataBeachIslandOffset: offset,
};

const encodedJson = Buffer.from(JSON.stringify(gltf), "utf8");
const paddedJsonLength = Math.ceil(encodedJson.length / 4) * 4;
const paddedJson = Buffer.alloc(paddedJsonLength, 0x20);
encodedJson.copy(paddedJson);

const remainingChunks = glb.subarray(jsonEnd);
const rebuilt = Buffer.alloc(12 + 8 + paddedJsonLength + remainingChunks.length);
glb.copy(rebuilt, 0, 0, 12);
rebuilt.writeUInt32LE(rebuilt.length, 8);
rebuilt.writeUInt32LE(paddedJsonLength, 12);
rebuilt.writeUInt32LE(jsonType, 16);
paddedJson.copy(rebuilt, 20);
remainingChunks.copy(rebuilt, 20 + paddedJsonLength);
fs.writeFileSync(islandPath, rebuilt);

console.log(
  `Moved IslandWest by x=${offset[0].toFixed(3)}, z=${offset[2].toFixed(3)}.`,
);
console.log(
  `Arrival remains at x=${arrival[0].toFixed(3)}, y=${manifest.points["Spawn.001"][1].toFixed(3)}, z=${arrival[2].toFixed(3)}.`,
);
