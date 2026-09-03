#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boatPath = path.join(
  projectRoot,
  "reference/assets/Asset_BoatYellow.9ec7874765453426.glb",
);

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const ATLAS = [1024, 256];
const YELLOW_UV = [(69 + 0.5) / ATLAS[0], (117 + 0.5) / ATLAS[1]];
const RED_UV = [(0 + 0.5) / ATLAS[0], (76 + 0.5) / ATLAS[1]];

function align4(value) {
  return (value + 3) & ~3;
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error("Not a GLB");
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  const binLength = buffer.readUInt32LE(binHeader);
  const bin = Buffer.from(buffer.subarray(binHeader + 8, binHeader + 8 + binLength));
  return { json, bin };
}

function encodeGlb(json, binary) {
  let jsonBuffer = Buffer.from(JSON.stringify(json));
  const paddedJsonLength = align4(jsonBuffer.length);
  if (paddedJsonLength > jsonBuffer.length) {
    jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(paddedJsonLength - jsonBuffer.length, 0x20)]);
  }
  const paddedBinLength = align4(binary.length);
  const paddedBin = paddedBinLength > binary.length
    ? Buffer.concat([binary, Buffer.alloc(paddedBinLength - binary.length)])
    : binary;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.length + 8 + paddedBin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, paddedBin]);
}

function readAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  const components = accessor.type === "VEC3" ? 3 : accessor.type === "VEC2" ? 2 : 1;
  const bytes = accessor.componentType === 5126 ? 4 : 2;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = [];
  for (let index = 0; index < accessor.count; index++) {
    const offset = start + index * components * bytes;
    for (let component = 0; component < components; component++) {
      const at = offset + component * bytes;
      values.push(accessor.componentType === 5126 ? glb.bin.readFloatLE(at) : glb.bin.readUInt16LE(at));
    }
  }
  return { accessor, view, values, components, start, bytes };
}

function writeFloats(bin, start, values) {
  for (let index = 0; index < values.length; index++) {
    bin.writeFloatLE(values[index], start + index * 4);
  }
}

function atlasUv(x, z, minX, spanX, minZ, spanZ) {
  const u = (x - minX) / spanX;
  const v = (z - minZ) / spanZ;
  const cell = 0.2;
  const lx = Math.abs(((u % cell) + cell) % cell) / cell;
  const ly = Math.abs(((v % cell) + cell) % cell) / cell;
  const diamond = Math.abs(lx - 0.5) + Math.abs(ly - 0.5) < 0.42;
  const left = u < 0.5;
  const yellow = left ? !diamond : diamond;
  return yellow ? YELLOW_UV : RED_UV;
}

const glb = parseGlb(fs.readFileSync(boatPath));
if (glb.json.asset?.extras?.databEachIntroShipPaint === 1 && process.argv[2] !== "--force") {
  console.log("Intro ship already painted.");
  process.exit(0);
}

const primitive = glb.json.meshes[0].primitives[0];
const positions = readAccessor(glb, primitive.attributes.POSITION);
const texcoords = readAccessor(glb, primitive.attributes.TEXCOORD_0);
const xs = [];
const zs = [];
for (let index = 0; index < positions.values.length; index += 3) {
  xs.push(positions.values[index]);
  zs.push(positions.values[index + 2]);
}
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minZ = Math.min(...zs);
const maxZ = Math.max(...zs);
const spanX = maxX - minX || 1;
const spanZ = maxZ - minZ || 1;

const uvs = [];
for (let index = 0; index < positions.values.length; index += 3) {
  uvs.push(...atlasUv(
    positions.values[index],
    positions.values[index + 2],
    minX,
    spanX,
    minZ,
    spanZ,
  ));
}

writeFloats(glb.bin, texcoords.start, uvs);
texcoords.accessor.min = [Math.min(...uvs.filter((_, i) => i % 2 === 0)), Math.min(...uvs.filter((_, i) => i % 2 === 1))];
texcoords.accessor.max = [Math.max(...uvs.filter((_, i) => i % 2 === 0)), Math.max(...uvs.filter((_, i) => i % 2 === 1))];
glb.json.asset = glb.json.asset || { version: "2.0" };
glb.json.asset.extras = {
  ...(glb.json.asset.extras || {}),
  databEachIntroShipPaint: 1,
  databEachIntroShipYellowUv: YELLOW_UV,
  databEachIntroShipRedUv: RED_UV,
};

fs.writeFileSync(boatPath, encodeGlb(glb.json, glb.bin));
const yellowCount = uvs.filter((_, i) => i % 2 === 0 && Math.abs(uvs[i] - YELLOW_UV[0]) < 1e-6).length;
const redCount = uvs.length / 2 - yellowCount;
console.log(
  `Painted intro ship ${path.relative(projectRoot, boatPath)} (${fs.statSync(boatPath).size} bytes, yellow=${yellowCount} red=${redCount})`,
);
