#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const assetsDir = path.join(projectRoot, "reference", "assets");
const ufoDir = path.join(assetsDir, "ufos");
const suppliedDir = "C:\\Users\\user\\AppData\\Local\\Temp";
const webglPath = path.join(assetsDir, "webgl.3250e36a65453426.js");

const rawMeshLoaderBefore = 'case"rawmesh":i.isRawMesh=!0,i.mesh=t.clone();break;';
const rawMeshLoaderAfter =
  'case"rawmesh":i.isRawMesh=!0,i.isMesh=!0,i.mesh=t.clone(),i.geometry=t.geometry;break;';
let webgl = fs.readFileSync(webglPath, "utf8");
if (webgl.includes(rawMeshLoaderAfter)) {
  webgl = webgl.replace(rawMeshLoaderAfter, rawMeshLoaderBefore);
  fs.writeFileSync(webglPath, webgl);
} else if (!webgl.includes(rawMeshLoaderBefore)) {
  throw new Error("Could not safely restore the standard asset loader");
}

const ships = ["shipBeige.png", "shipBlue.png", "shipGreen.png", "shipPink.png", "shipYellow.png"];
fs.mkdirSync(ufoDir, { recursive: true });
for (const ship of ships) {
  const destination = path.join(ufoDir, ship);
  if (!fs.existsSync(destination)) {
    const supplied = path.join(suppliedDir, ship);
    if (!fs.existsSync(supplied)) throw new Error(`Missing supplied UFO sprite: ${supplied}`);
    fs.copyFileSync(supplied, destination);
  }
}

const suppliedUfoPath = "C:\\Users\\user\\Downloads\\ufo (1).glb";
const projectUfoPath = path.join(ufoDir, "ufo.glb");
if (fs.existsSync(suppliedUfoPath)) fs.copyFileSync(suppliedUfoPath, projectUfoPath);
if (!fs.existsSync(projectUfoPath)) throw new Error(`Missing supplied UFO mesh: ${suppliedUfoPath}`);
const sourceAsset = JSON.parse(fs.readFileSync(projectUfoPath).subarray(20, 20 + fs.readFileSync(projectUfoPath).readUInt32LE(12)));
const sourceExtras = sourceAsset.asset?.extras || {};
fs.writeFileSync(path.join(ufoDir, "ATTRIBUTION.txt"), [
  "UFO mesh attribution",
  `Title: ${sourceExtras.title || "Ufo"}`,
  `Author: ${sourceExtras.author || "yanix (https://sketchfab.com/yanix)"}`,
  `Source: ${sourceExtras.source || "https://sketchfab.com/3d-models/ufo-2d55eec1da344c9a9943abafbd07f0f9"}`,
  `License: ${sourceExtras.license || "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)"}`,
  "",
].join("\n"));

const sourceUfo = readSourceUfo(projectUfoPath);

const replacements = [
  {
    file: "Asset_Boat.b9447a8a65453426.glb",
    sprite: "shipBlue.png",
    imageSize: [124, 90],
    colorPixel: [48, 192],
    bounds: [[-2.8484983, -0.5167043, -1.15125], [2.4300218, 3.0860608, 1.1512502]],
    collider: null,
    meshName: "Mesh.008",
  },
  {
    file: "Asset_BoatYellow.9ec7874765453426.glb",
    sprite: "shipYellow.png",
    imageSize: [124, 62],
    colorPixel: [69, 117],
    bounds: [[-2.8484983, -0.5167043, -1.15125], [2.4300218, 3.0860608, 1.1512502]],
    collider: [[-2.8575399, -0.485, -1], [2.8575399, 2.8341799, 1]],
    meshName: "Mesh",
    colliderName: "Collider",
  },
  {
    file: "Asset_BoatA.7f88b4a765453426.glb",
    sprite: "shipPink.png",
    imageSize: [124, 72],
    colorPixel: [153, 65],
    bounds: [[-1.828401, -0.2047482, -1.7847373], [1.8284005, 1.0617869, 1.784735]],
    collider: [[-1.8570328, -0.2485865, -1.6968284], [1.8570328, 0.8811336, 1.687773]],
    meshName: "Mesh.015",
    colliderName: "Collider.014",
  },
  {
    file: "Asset_BoatB.a72bf2bb65453426.glb",
    sprite: "shipGreen.png",
    imageSize: [124, 68],
    colorPixel: [140, 77],
    bounds: [[-1.864429, -0.2124112, -0.890441], [1.8644282, 0.6822087, 0.8904431]],
    collider: [[-1.8225521, -0.1866631, -0.8715898], [1.9470048, 0.688991, 0.8715898]],
    meshName: "Mesh.016",
    colliderName: "Collider.015",
  },
  {
    file: "Asset_RaceBoat.277c6ff065453426.glb",
    sprite: "shipBlue.png",
    colorPixel: [48, 192],
    bounds: [[-1.146, -1.081, -2.386], [1.157, 2.522, 2.893]],
    collider: [[-1.14, -0.88, -2.86], [1.14, 2.44, 2.86]],
    meshName: "Mesh.028",
    colliderName: "Collider",
  },
  {
    file: "Asset_RaceBoatRaw.69c765fb65453426.glb",
    sprite: "shipGreen.png",
    colorPixel: [140, 77],
    bounds: [[-1.146, -1.081, -2.386], [1.157, 2.522, 2.893]],
    collider: [[-1.14, -0.88, -2.86], [1.14, 2.44, 2.86]],
    meshName: "RawMesh.001",
    colliderName: "Collider",
  },
  {
    file: "Asset_FishingShip.52fb2b8765453426.glb",
    sprite: "shipBlue.png",
    colorPixel: [48, 192],
    bounds: [[-2.691, -0.447, -1.465], [3.257, 3.236, 1.439]],
    collider: [[-2.731, -0.294, -1.393], [2.864, 3.112, 1.393]],
    meshName: "Mesh.039",
    colliderName: "Collider.034",
  },
  {
    file: "Asset_Jetski.dbd32c7865453426.glb",
    sprite: "shipGreen.png",
    colorPixel: [140, 77],
    bounds: [[-1.034, 0, -1.409], [1.034, 1.547, 2.196]],
    collider: [[-1.14, 0, -1.409], [1.14, 1.546, 2.196]],
    meshName: "Mesh.007",
    colliderName: "Collider.006",
  },
  {
    file: "Asset_ShipA.7be9263f65453426.glb",
    sprite: "shipPink.png",
    colorPixel: [153, 65],
    bounds: [[-2.997, -0.517, -1.151], [2.43, 3.086, 1.151]],
    collider: [[-2.858, -0.485, -1], [2.858, 2.834, 1]],
    meshName: "Mesh.117",
    colliderName: "Collider.103",
  },
  {
    file: "Asset_ShipAVerB.002ae3ca65453426.glb",
    sprite: "shipPink.png",
    colorPixel: [153, 65],
    bounds: [[-2.997, -0.517, -1.151], [2.43, 3.086, 1.151]],
    collider: [[-2.858, -0.485, -1], [2.858, 2.834, 1]],
    meshName: "Mesh.118",
    colliderName: "Collider.104",
  },
  {
    file: "Asset_ShipB.e35fa5c765453426.glb",
    sprite: "shipYellow.png",
    colorPixel: [69, 117],
    bounds: [[-2.914, -0.52, -1.088], [3.44, 5.411, 1.088]],
    collider: [[-3.456, -0.558, -1.068], [3.456, 4.709, 1.068]],
    meshName: "Mesh.119",
    colliderName: "Collider.105",
  },
  {
    file: "Asset_ShipC.1766a31165453426.glb",
    sprite: "shipBeige.png",
    colorPixel: [6, 0],
    bounds: [[-2.848, -0.517, -1.151], [2.43, 3.086, 1.151]],
    collider: [[-2.858, -0.485, -1], [2.858, 2.834, 1]],
    meshName: "Mesh.120",
    colliderName: "Collider.106",
  },
  {
    file: "Asset_ShipOnWheels.9e048d2965453426.glb",
    sprite: "shipYellow.png",
    colorPixel: [69, 117],
    bounds: [[-1.405, 0, -2.947], [1.405, 3.616, 2.518]],
    collider: [[-1.405, 0, -2.947], [1.405, 3.616, 3.184]],
    meshName: "Mesh.121",
    colliderName: "Collider.107",
  },
];

function align4(value) {
  return (value + 3) & ~3;
}

function floatBuffer(values) {
  return Buffer.from(new Float32Array(values).buffer);
}

function indexBuffer(values) {
  return Buffer.from(new Uint16Array(values).buffer);
}

function readSourceUfo(file) {
  const glb = fs.readFileSync(file);
  if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error(`Invalid UFO GLB: ${file}`);
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength));
  let cursor = 12 + 8 + jsonLength;
  const binLength = glb.readUInt32LE(cursor);
  cursor += 8;
  return { json, bin: glb.subarray(cursor, cursor + binLength) };
}

function identityMatrix() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMatrix(a, b) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      result[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const t = node.translation || [0, 0, 0];
  const s = node.scale || [1, 1, 1];
  const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function transformPoint(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function transformDirection(matrix, x, y, z) {
  const nx = matrix[0] * x + matrix[4] * y + matrix[8] * z;
  const ny = matrix[1] * x + matrix[5] * y + matrix[9] * z;
  const nz = matrix[2] * x + matrix[6] * y + matrix[10] * z;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function readSourceAccessor(source, accessorIndex) {
  const { json, bin } = source;
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const components = accessor.type === "VEC2" ? 2 : accessor.type === "VEC3" ? 3 : 1;
  const componentBytes = accessor.componentType === 5126 ? 4 : accessor.componentType === 5125 ? 4 : 2;
  const stride = view.byteStride || components * componentBytes;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Array(accessor.count * components);
  for (let index = 0; index < accessor.count; index++) {
    const offset = start + index * stride;
    for (let component = 0; component < components; component++) {
      const componentOffset = offset + component * componentBytes;
      values[index * components + component] = accessor.componentType === 5126
        ? bin.readFloatLE(componentOffset)
        : accessor.componentType === 5125
          ? bin.readUInt32LE(componentOffset)
          : bin.readUInt16LE(componentOffset);
    }
  }
  return values;
}

function sourceColorUv(config, materialName) {
  const bodyUv = [(config.colorPixel[0] + 0.5) / 1024, (config.colorPixel[1] + 0.5) / 256];
  const darkUv = [133.5 / 1024, 116.5 / 256];
  const paleUv = [6.5 / 1024, 0.5 / 256];
  const glassUv = [160.5 / 1024, 150.5 / 256];
  if (materialName === "Glass") return glassUv;
  if (materialName === "Bottom.001" || materialName === "Bottom") return darkUv;
  if (materialName === "Dome.belt") return paleUv;
  if (materialName === "Glass.mini") return bodyUv;
  return bodyUv;
}

function makeSourceUfoGeometry(config) {
  const positions = [];
  const normals = [];
  const texcoords = [];
  const indices = [];
  const sourceMin = [Infinity, Infinity, Infinity];
  const sourceMax = [-Infinity, -Infinity, -Infinity];
  const rootMatrix = identityMatrix();

  function visit(nodeIndex, parentMatrix) {
    const node = sourceUfo.json.nodes[nodeIndex];
    const matrix = multiplyMatrix(parentMatrix, nodeMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = sourceUfo.json.meshes[node.mesh];
      for (const primitive of mesh.primitives || []) {
        if (primitive.mode !== undefined && primitive.mode !== 4) continue;
        const sourcePositions = readSourceAccessor(sourceUfo, primitive.attributes.POSITION);
        const sourceNormals = primitive.attributes.NORMAL === undefined
          ? null
          : readSourceAccessor(sourceUfo, primitive.attributes.NORMAL);
        const materialName = sourceUfo.json.materials[primitive.material || 0]?.name || "Body";
        const uv = sourceColorUv(config, materialName);
        const baseVertex = positions.length / 3;
        for (let vertex = 0; vertex < sourcePositions.length / 3; vertex++) {
          const point = transformPoint(matrix, sourcePositions[vertex * 3], sourcePositions[vertex * 3 + 1], sourcePositions[vertex * 3 + 2]);
          positions.push(...point);
          sourceMin[0] = Math.min(sourceMin[0], point[0]);
          sourceMin[1] = Math.min(sourceMin[1], point[1]);
          sourceMin[2] = Math.min(sourceMin[2], point[2]);
          sourceMax[0] = Math.max(sourceMax[0], point[0]);
          sourceMax[1] = Math.max(sourceMax[1], point[1]);
          sourceMax[2] = Math.max(sourceMax[2], point[2]);
          const normal = sourceNormals
            ? transformDirection(matrix, sourceNormals[vertex * 3], sourceNormals[vertex * 3 + 1], sourceNormals[vertex * 3 + 2])
            : [0, 1, 0];
          normals.push(...normal);
          texcoords.push(...uv);
        }
        const sourceIndices = primitive.indices === undefined
          ? Array.from({ length: sourcePositions.length / 3 }, (_, index) => index)
          : readSourceAccessor(sourceUfo, primitive.indices);
        for (let index = 0; index < sourceIndices.length; index += 3) {
          indices.push(baseVertex + sourceIndices[index], baseVertex + sourceIndices[index + 1], baseVertex + sourceIndices[index + 2]);
        }
      }
    }
    for (const child of node.children || []) visit(child, matrix);
  }

  for (const sceneNode of sourceUfo.json.scenes[sourceUfo.json.scene || 0].nodes || []) visit(sceneNode, rootMatrix);

  const [[targetMinX, targetMinY, targetMinZ], [targetMaxX, targetMaxY, targetMaxZ]] = config.bounds;
  const sourceSize = [sourceMax[0] - sourceMin[0], sourceMax[1] - sourceMin[1], sourceMax[2] - sourceMin[2]];
  const targetSize = [targetMaxX - targetMinX, Math.min(targetMaxY - targetMinY, (targetMaxX - targetMinX) * 0.42), targetMaxZ - targetMinZ];
  const sourceCenter = sourceMin.map((min, index) => (min + sourceMax[index]) / 2);
  const targetCenter = [(targetMinX + targetMaxX) / 2, targetMinY + targetSize[1] / 2, (targetMinZ + targetMaxZ) / 2];
  const scale = targetSize.map((size, index) => size / sourceSize[index]);
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] = (positions[index] - sourceCenter[0]) * scale[0] + targetCenter[0];
    positions[index + 1] = (positions[index + 1] - sourceCenter[1]) * scale[1] + targetCenter[1];
    positions[index + 2] = (positions[index + 2] - sourceCenter[2]) * scale[2] + targetCenter[2];
  }
  return { positions, normals, texcoords, indices };
}

function boxGeometry(bounds) {
  const [[x0, y0, z0], [x1, y1, z1]] = bounds;
  const positions = [
    x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
    x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
    0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ];
  return { positions, indices };
}

function makeSaucerGeometry(config) {
  const [[minX, minY, minZ], [maxX, maxY, maxZ]] = config.bounds;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const radiusX = width / 2;
  const radiusZ = Math.max(depth / 2, width * 0.22);
  const centerY = Math.max(minY + width * 0.12, Math.min((minY + maxY) / 2, 0.65));
  const segments = 24;
  const positions = [];
  const normals = [];
  const texcoords = [];
  const indices = [];
  const bodyUv = [(config.colorPixel[0] + 0.5) / 1024, (config.colorPixel[1] + 0.5) / 256];
  const darkUv = [(133.5) / 1024, (116.5) / 256];
  const paleUv = [(6.5) / 1024, (0.5) / 256];

  function addRing(rx, rz, y, uv, normalY = 0) {
    const start = positions.length / 3;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.push(centerX + cos * rx, y, centerZ + sin * rz);
      const nx = rx ? cos / rx : 0;
      const nz = rz ? sin / rz : 0;
      const length = Math.hypot(nx, normalY, nz) || 1;
      normals.push(nx / length, normalY / length, nz / length);
      texcoords.push(...uv);
    }
    return start;
  }

  function connectRings(lower, upper) {
    for (let segment = 0; segment < segments; segment++) {
      const a = lower + segment;
      const b = lower + segment + 1;
      const c = upper + segment + 1;
      const d = upper + segment;
      indices.push(a, b, c, a, c, d);
    }
  }

  const profile = [
    [radiusX * 0.18, radiusZ * 0.18, centerY - width * 0.105, -1.4],
    [radiusX * 0.66, radiusZ * 0.66, centerY - width * 0.085, -0.7],
    [radiusX, radiusZ, centerY - width * 0.015, 0],
    [radiusX * 0.88, radiusZ * 0.88, centerY + width * 0.055, 0.55],
    [radiusX * 0.57, radiusZ * 0.57, centerY + width * 0.095, 1.2],
  ];
  const bodyRings = profile.map(([rx, rz, y, normalY]) => addRing(rx, rz, y, bodyUv, normalY));
  for (let ring = 0; ring < bodyRings.length - 1; ring++) connectRings(bodyRings[ring], bodyRings[ring + 1]);

  const highlightLower = addRing(radiusX * 0.92, radiusZ * 0.92, centerY + width * 0.008, paleUv, 0.15);
  const highlightUpper = addRing(radiusX * 0.88, radiusZ * 0.88, centerY + width * 0.025, paleUv, 0.2);
  connectRings(highlightLower, highlightUpper);

  const cockpitRing = addRing(radiusX * 0.48, radiusZ * 0.48, centerY + width * 0.102, darkUv, 1);
  const cockpitCenter = positions.length / 3;
  positions.push(centerX, centerY + width * 0.104, centerZ);
  normals.push(0, 1, 0);
  texcoords.push(...darkUv);
  for (let segment = 0; segment < segments; segment++) {
    indices.push(cockpitCenter, cockpitRing + segment + 1, cockpitRing + segment);
  }

  const domeProfile = [
    [radiusX * 0.43, radiusZ * 0.43, centerY + width * 0.105, 0.25],
    [radiusX * 0.37, radiusZ * 0.37, centerY + width * 0.15, 0.8],
    [radiusX * 0.24, radiusZ * 0.24, centerY + width * 0.205, 1.4],
    [radiusX * 0.06, radiusZ * 0.06, centerY + width * 0.24, 2],
  ];
  const domeRings = domeProfile.map(([rx, rz, y, normalY]) => addRing(rx, rz, y, paleUv, normalY));
  for (let ring = 0; ring < domeRings.length - 1; ring++) connectRings(domeRings[ring], domeRings[ring + 1]);

  return { positions, normals, texcoords, indices };
}

function makeUfoGlb(config) {
  const [[minX, minY, minZ], [maxX, maxY, maxZ]] = config.bounds;
  const { positions, normals, texcoords, indices } = makeSourceUfoGeometry(config);
  const collider = config.collider ? boxGeometry(config.collider) : null;
  const image = fs.readFileSync(path.join(ufoDir, config.sprite));

  const chunks = [];
  const bufferViews = [];
  let byteLength = 0;
  function addChunk(data, target) {
    const offset = align4(byteLength);
    if (offset > byteLength) chunks.push(Buffer.alloc(offset - byteLength));
    const index = bufferViews.length;
    chunks.push(data);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(target ? { target } : {}) });
    byteLength = offset + data.length;
    return index;
  }

  const positionView = addChunk(floatBuffer(positions), 34962);
  const normalView = addChunk(floatBuffer(normals), 34962);
  const texcoordView = addChunk(floatBuffer(texcoords), 34962);
  const indexView = addChunk(indexBuffer(indices), 34963);
  let colliderPositionView;
  let colliderIndexView;
  if (collider) {
    colliderPositionView = addChunk(floatBuffer(collider.positions), 34962);
    colliderIndexView = addChunk(indexBuffer(collider.indices), 34963);
  }
  const imageView = addChunk(image);
  const finalLength = align4(byteLength);
  if (finalLength > byteLength) chunks.push(Buffer.alloc(finalLength - byteLength));
  const binary = Buffer.concat(chunks);

  const positionXs = positions.filter((_, index) => index % 3 === 0);
  const positionYs = positions.filter((_, index) => index % 3 === 1);
  const positionZs = positions.filter((_, index) => index % 3 === 2);
  const vertexCount = positions.length / 3;
  const maxIndex = vertexCount - 1;

  const accessors = [
    { bufferView: positionView, componentType: 5126, count: vertexCount, type: "VEC3", min: [Math.min(...positionXs), Math.min(...positionYs), Math.min(...positionZs)], max: [Math.max(...positionXs), Math.max(...positionYs), Math.max(...positionZs)] },
    { bufferView: normalView, componentType: 5126, count: vertexCount, type: "VEC3" },
    { bufferView: texcoordView, componentType: 5126, count: vertexCount, type: "VEC2", min: [0, 0], max: [1, 1] },
    { bufferView: indexView, componentType: 5123, count: indices.length, type: "SCALAR", min: [0], max: [maxIndex] },
  ];
  const meshes = [{ name: "Data B-each UFO", primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4 }] }];
  const nodes = [{ name: config.meshName, mesh: 0 }];
  if (collider) {
    const positionAccessor = accessors.length;
    accessors.push({ bufferView: colliderPositionView, componentType: 5126, count: 8, type: "VEC3", min: config.collider[0], max: config.collider[1] });
    const indexAccessor = accessors.length;
    accessors.push({ bufferView: colliderIndexView, componentType: 5123, count: collider.indices.length, type: "SCALAR", min: [0], max: [7] });
    meshes.push({ name: "UFO collider", primitives: [{ attributes: { POSITION: positionAccessor }, indices: indexAccessor, mode: 4 }] });
    nodes.push({ name: config.colliderName, mesh: 1 });
  }
  const boundsName = `Bounds_${minX}|${minY}|${minZ}|${maxX}|${maxY}|${maxZ}_`;
  nodes.push({ name: boundsName });

  const gltf = {
    asset: { version: "2.0", generator: "Data B-each UFO mesh builder" },
    extensionsUsed: ["KHR_materials_unlit"],
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials: [{
      name: `UFO ${path.parse(config.sprite).name}`,
      extensions: { KHR_materials_unlit: {} },
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
      alphaMode: "BLEND",
      alphaCutoff: 0.05,
      doubleSided: true,
    }],
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: [{ name: config.sprite, mimeType: "image/png", bufferView: imageView }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
  };

  let json = Buffer.from(JSON.stringify(gltf));
  const paddedJsonLength = align4(json.length);
  if (paddedJsonLength > json.length) json = Buffer.concat([json, Buffer.alloc(paddedJsonLength - json.length, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binaryHeader, binary]);
}

for (const replacement of replacements) {
  fs.writeFileSync(path.join(assetsDir, replacement.file), makeUfoGlb(replacement));
  console.log(`${replacement.file} -> ${replacement.sprite}`);
}
