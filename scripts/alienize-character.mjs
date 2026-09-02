import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_BYTE = 5121;
const UNSIGNED_SHORT = 5123;
const GLTF_TRANSFORM_VERSION = "4.5.0";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const defaultAsset = resolve(
  projectRoot,
  "reference/assets/character.df6ab95f65453426.glb",
);
const sourcePath = resolve(process.argv[2] || defaultAsset);
const outputPath = resolve(process.argv[3] || defaultAsset);
const workDirectory = mkdtempSync(join(tmpdir(), "datab-each-alien-"));
const decodedPath = join(workDirectory, "character-decoded.glb");
const rebuiltPath = join(workDirectory, "character-alien-uncompressed.glb");
const prunedPath = join(workDirectory, "character-alien-pruned.glb");
const compressedPath = join(workDirectory, "character-alien-draco.glb");

try {
  const original = parseGlb(readFileSync(sourcePath));
  const originalAnimationSignature = animationSignature(original);
  const originalRigSignature = rigSignature(original);

  decodeGeometry(sourcePath, decodedPath);
  const decoded = parseGlb(readFileSync(decodedPath));
  const customizationStats = stripCustomizationNodes(decoded);
  const normalizedWeightAccessors = normalizeAllSkinWeights(decoded);
  const designStats = alienizeCharacter(decoded);
  writeFileSync(rebuiltPath, encodeGlb(decoded));
  pruneGeometry(rebuiltPath, prunedPath);
  compressGeometry(prunedPath, compressedPath);
  writeFileSync(outputPath, readFileSync(compressedPath));

  const result = parseGlb(readFileSync(outputPath));
  assertEqual(
    animationSignature(result),
    originalAnimationSignature,
    "Animation data changed while rebuilding the character.",
  );
  assertEqual(
    rigSignature(result),
    originalRigSignature,
    "Skeleton data changed while rebuilding the character.",
  );
  assertNoCustomizationGeometry(result);

  validateAsset(outputPath);
  console.log(
    [
      `Alien character written to ${outputPath}`,
      `Base vertices: ${designStats.originalVertexCount}`,
      `Alien detail vertices: ${designStats.addedVertexCount}`,
      `Removed customization nodes: ${customizationStats.removedNodeCount}`,
      `Removed shoe nodes: ${customizationStats.removedShoeNodeCount}`,
      `Removed belt-bag nodes: ${customizationStats.removedBeltBagNodeCount}`,
      `Normalized skin-weight accessors: ${normalizedWeightAccessors}`,
      `Animation signature: ${originalAnimationSignature}`,
      `Rig signature: ${originalRigSignature}`,
    ].join("\n"),
  );
} finally {
  const resolvedTempRoot = resolve(tmpdir());
  const resolvedWorkDirectory = resolve(workDirectory);
  if (resolvedWorkDirectory.startsWith(`${resolvedTempRoot}\\`)) {
    rmSync(resolvedWorkDirectory, { recursive: true, force: true });
  }
}

function pruneGeometry(input, output) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npx,
    [
      "--yes",
      `@gltf-transform/cli@${GLTF_TRANSFORM_VERSION}`,
      "prune",
      input,
      output,
      "--keep-attributes",
      "false",
      "--keep-leaves",
      "false",
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Could not remove the detached customization geometry.${
        result.error ? ` ${result.error.message}` : ""
      }`,
    );
  }
}

function decodeGeometry(input, output) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npx,
    [
      "--yes",
      `@gltf-transform/cli@${GLTF_TRANSFORM_VERSION}`,
      "copy",
      input,
      output,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Could not decode the character's Draco-compressed geometry.${
        result.error ? ` ${result.error.message}` : ""
      }`,
    );
  }
}

function compressGeometry(input, output) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npx,
    [
      "--yes",
      `@gltf-transform/cli@${GLTF_TRANSFORM_VERSION}`,
      "draco",
      input,
      output,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Could not recompress the alien character geometry.${
        result.error ? ` ${result.error.message}` : ""
      }`,
    );
  }
}

function validateAsset(assetPath) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    npx,
    [
      "--yes",
      `@gltf-transform/cli@${GLTF_TRANSFORM_VERSION}`,
      "validate",
      assetPath,
      "--ignore",
      "UNSUPPORTED_EXTENSION,UNUSED_OBJECT,NODE_SKINNED_MESH_NON_ROOT",
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    throw new Error("The rebuilt character did not pass glTF validation.");
  }
}

function stripCustomizationNodes(glb) {
  const customizationPattern = /(?:^|:)(?:Head|Body|Bottom)-/i;
  const shoePattern = /(?:sneaker|shoe|boot|sandal|palm|fin)/i;
  const beltBagPattern = /(?:bumbag|belt.?bag)/i;
  const removableNodeIndices = new Set();
  const removableNodeNames = [];

  for (let index = 0; index < (glb.json.nodes || []).length; index += 1) {
    const name = glb.json.nodes[index]?.name || "";
    if (!customizationPattern.test(name)) continue;
    removableNodeIndices.add(index);
    removableNodeNames.push(name);
  }

  for (const animation of glb.json.animations || []) {
    for (const channel of animation.channels || []) {
      if (removableNodeIndices.has(channel.target.node)) {
        throw new Error(
          `Customization node ${glb.json.nodes[channel.target.node]?.name} is animated and cannot be removed without changing the animation data.`,
        );
      }
    }
  }

  for (const node of glb.json.nodes || []) {
    if (!node.children) continue;
    node.children = node.children.filter(
      (childIndex) => !removableNodeIndices.has(childIndex),
    );
    if (node.children.length === 0) delete node.children;
  }

  for (const scene of glb.json.scenes || []) {
    if (!scene.nodes) continue;
    scene.nodes = scene.nodes.filter(
      (nodeIndex) => !removableNodeIndices.has(nodeIndex),
    );
  }

  return {
    removedNodeCount: removableNodeNames.length,
    removedShoeNodeCount: removableNodeNames.filter((name) => shoePattern.test(name))
      .length,
    removedBeltBagNodeCount: removableNodeNames.filter((name) =>
      beltBagPattern.test(name),
    ).length,
  };
}

function assertNoCustomizationGeometry(glb) {
  const forbiddenPattern = /(?:^|:)(?:Head|Body|Bottom)-/i;
  const forbiddenNames = (glb.json.nodes || [])
    .map((node) => node.name || "")
    .filter((name) => forbiddenPattern.test(name));
  if (forbiddenNames.length > 0) {
    throw new Error(
      `Customization geometry remains in the rebuilt character: ${forbiddenNames.join(", ")}`,
    );
  }
}

function alienizeCharacter(glb) {
  const { json, bin } = glb;
  const bodyNodeIndex = json.nodes.findIndex(
    (node) => node.name === "Chara_Low_Rig:BODY_01",
  );
  if (bodyNodeIndex < 0) throw new Error("Could not find the shared character body.");

  const bodyNode = json.nodes[bodyNodeIndex];
  const primitive = json.meshes[bodyNode.mesh]?.primitives?.[0];
  if (!primitive) throw new Error("The shared character body has no mesh primitive.");
  if (primitive.extras?.databEachAlienDesign === 1) {
    throw new Error("This character already contains the alien design.");
  }

  const requiredAttributes = [
    "POSITION",
    "NORMAL",
    "TEXCOORD_0",
    "JOINTS_0",
    "WEIGHTS_0",
  ];
  for (const semantic of requiredAttributes) {
    if (primitive.attributes[semantic] == null) {
      throw new Error(`The shared body is missing ${semantic}.`);
    }
  }

  const positions = readAccessor(glb, primitive.attributes.POSITION);
  const uvs = readAccessor(glb, primitive.attributes.TEXCOORD_0);
  const joints = readAccessor(glb, primitive.attributes.JOINTS_0);
  const weights = readAccessor(glb, primitive.attributes.WEIGHTS_0);
  const indices = readAccessor(glb, primitive.indices);
  const originalVertexCount = positions.length / 3;
  const skin = json.skins[bodyNode.skin];
  const jointNames = skin.joints.map((nodeIndex) => json.nodes[nodeIndex]?.name || "");
  const headJoint = jointNames.findIndex((name) => name.endsWith("Head_M"));
  if (headJoint < 0) throw new Error("Could not find the character's head joint.");

  deformBody({ positions, joints, weights, jointNames });
  addAntenna(positions, uvs, joints, weights, indices, headJoint, -1);
  addAntenna(positions, uvs, joints, weights, indices, headJoint, 1);
  addEarFin(positions, uvs, joints, weights, indices, headJoint, -1);
  addEarFin(positions, uvs, joints, weights, indices, headJoint, 1);

  const normals = recomputeNormals(positions, indices);
  const vertexCount = positions.length / 3;
  const vertexBuffer = createVertexBuffer({
    positions,
    normals,
    uvs,
    joints,
    weights,
  });
  const indexBuffer = createIndexBuffer(indices);
  const vertexOffset = align4(bin.length);
  const indexOffset = align4(vertexOffset + vertexBuffer.length);
  const combinedBin = Buffer.alloc(indexOffset + indexBuffer.length);
  bin.copy(combinedBin);
  vertexBuffer.copy(combinedBin, vertexOffset);
  indexBuffer.copy(combinedBin, indexOffset);
  glb.bin = combinedBin;

  const vertexView = json.bufferViews.push({
    buffer: 0,
    byteOffset: vertexOffset,
    byteLength: vertexBuffer.length,
    byteStride: 52,
    target: 34962,
  }) - 1;
  const indexView = json.bufferViews.push({
    buffer: 0,
    byteOffset: indexOffset,
    byteLength: indexBuffer.length,
    target: 34963,
  }) - 1;
  const positionBounds = vectorBounds(positions, 3);

  primitive.attributes.POSITION = json.accessors.push({
    bufferView: vertexView,
    byteOffset: 0,
    componentType: FLOAT,
    count: vertexCount,
    type: "VEC3",
    min: positionBounds.min,
    max: positionBounds.max,
  }) - 1;
  primitive.attributes.NORMAL = json.accessors.push({
    bufferView: vertexView,
    byteOffset: 12,
    componentType: FLOAT,
    count: vertexCount,
    type: "VEC3",
  }) - 1;
  primitive.attributes.TEXCOORD_0 = json.accessors.push({
    bufferView: vertexView,
    byteOffset: 24,
    componentType: FLOAT,
    count: vertexCount,
    type: "VEC2",
  }) - 1;
  primitive.attributes.JOINTS_0 = json.accessors.push({
    bufferView: vertexView,
    byteOffset: 32,
    componentType: UNSIGNED_BYTE,
    count: vertexCount,
    type: "VEC4",
  }) - 1;
  primitive.attributes.WEIGHTS_0 = json.accessors.push({
    bufferView: vertexView,
    byteOffset: 36,
    componentType: FLOAT,
    count: vertexCount,
    type: "VEC4",
  }) - 1;
  primitive.indices = json.accessors.push({
    bufferView: indexView,
    byteOffset: 0,
    componentType: UNSIGNED_SHORT,
    count: indices.length,
    type: "SCALAR",
    min: [0],
    max: [vertexCount - 1],
  }) - 1;
  primitive.extras = {
    ...(primitive.extras || {}),
    databEachAlienDesign: 1,
  };
  json.buffers[0].byteLength = combinedBin.length;

  return {
    originalVertexCount,
    addedVertexCount: vertexCount - originalVertexCount,
  };
}

function normalizeAllSkinWeights(glb) {
  const weightAccessors = new Set();
  for (const mesh of glb.json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      if (primitive.attributes?.WEIGHTS_0 != null) {
        weightAccessors.add(primitive.attributes.WEIGHTS_0);
      }
    }
  }

  for (const accessorIndex of weightAccessors) {
    const accessor = glb.json.accessors[accessorIndex];
    if (accessor.componentType !== FLOAT || accessor.type !== "VEC4") {
      throw new Error("Expected decoded skin weights to use floating-point VEC4 accessors.");
    }
    const values = readAccessor(glb, accessorIndex);
    for (let vertex = 0; vertex < accessor.count; vertex += 1) {
      const offset = vertex * 4;
      const sum =
        values[offset] +
        values[offset + 1] +
        values[offset + 2] +
        values[offset + 3];
      if (sum <= 0) continue;

      const normalized = [0, 1, 2, 3].map((component) =>
        Math.fround(values[offset + component] / sum),
      );
      let largestComponent = 0;
      for (let component = 1; component < 4; component += 1) {
        if (normalized[component] > normalized[largestComponent]) {
          largestComponent = component;
        }
      }
      const otherSum = normalized.reduce(
        (total, value, component) =>
          component === largestComponent ? total : total + value,
        0,
      );
      normalized[largestComponent] = Math.fround(1 - otherSum);
      for (let component = 0; component < 4; component += 1) {
        values[offset + component] = normalized[component];
      }
    }
    writeAccessor(glb, accessorIndex, values);
  }
  return weightAccessors.size;
}

function deformBody({ positions, joints, weights, jointNames }) {
  const jointGroups = jointNames.map((name) => ({
    head: name.endsWith("Head_M"),
    torso:
      name.endsWith("Root_M") ||
      name.endsWith("Spine1_M") ||
      name.endsWith("Chest_M"),
    hip: name.includes("Hip_"),
  }));

  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    let headWeight = 0;
    let torsoWeight = 0;
    let hipWeight = 0;
    for (let component = 0; component < 4; component += 1) {
      const offset = vertex * 4 + component;
      const group = jointGroups[joints[offset]];
      if (!group) continue;
      if (group.head) headWeight += weights[offset];
      if (group.torso) torsoWeight += weights[offset];
      if (group.hip) hipWeight += weights[offset];
    }

    const offset = vertex * 3;
    let x = positions[offset];
    let y = positions[offset + 1];
    let z = positions[offset + 2];

    if (headWeight > 0.001) {
      const upperCranium = smoothstep(1.78, 2.28, y);
      const lowerFace = 1 - smoothstep(1.68, 1.94, y);
      const widthScale =
        1 + headWeight * (0.08 + 0.27 * upperCranium - 0.1 * lowerFace);
      x *= widthScale;
      z = 0.05 + (z - 0.05) * (1 + headWeight * (0.08 + 0.15 * upperCranium));
      y += headWeight * (0.025 + 0.095 * upperCranium);
      y -= headWeight * lowerFace * (1 - Math.min(1, Math.abs(x) / 0.45)) * 0.025;
    }

    if (torsoWeight > 0.001) {
      const torsoScale = 1 - 0.11 * torsoWeight;
      x *= torsoScale;
      z = 0.04 + (z - 0.04) * (1 - 0.06 * torsoWeight);
    }

    if (hipWeight > 0.001) x *= 1 - 0.045 * hipWeight;

    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
  }
}

function addAntenna(positions, uvs, joints, weights, indices, headJoint, side) {
  const ringCount = 6;
  const sideCount = 8;
  const rings = [];

  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ring / (ringCount - 1);
    const centerX = side * (0.205 + 0.115 * t);
    const centerY = 2.205 + 0.35 * t + Math.sin(t * Math.PI) * 0.035;
    const centerZ = 0.015 - 0.015 * t;
    const radius = 0.065 - 0.033 * t;
    const ringVertices = [];
    for (let segment = 0; segment < sideCount; segment += 1) {
      const angle = (segment / sideCount) * Math.PI * 2;
      ringVertices.push(
        appendVertex(
          positions,
          uvs,
          joints,
          weights,
          [
            centerX + Math.cos(angle) * radius,
            centerY,
            centerZ + Math.sin(angle) * radius,
          ],
          [segment / sideCount, t],
          headJoint,
        ),
      );
    }
    rings.push(ringVertices);
  }

  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    for (let segment = 0; segment < sideCount; segment += 1) {
      const next = (segment + 1) % sideCount;
      const a = rings[ring][segment];
      const b = rings[ring][next];
      const c = rings[ring + 1][segment];
      const d = rings[ring + 1][next];
      indices.push(a, c, b, b, c, d);
    }
  }

  const tipCenter = [side * 0.33, 2.59, 0];
  addUvSphere(
    positions,
    uvs,
    joints,
    weights,
    indices,
    headJoint,
    tipCenter,
    0.082,
    5,
    8,
  );
}

function addEarFin(positions, uvs, joints, weights, indices, headJoint, side) {
  const innerX = side * 0.43;
  const outerX = side * 0.69;
  const frontZ = 0.105;
  const backZ = -0.035;
  const points = [
    [innerX, 1.86, frontZ],
    [outerX, 2.025, frontZ],
    [innerX, 2.18, frontZ],
    [innerX, 1.86, backZ],
    [outerX, 2.025, backZ],
    [innerX, 2.18, backZ],
  ];
  const vertices = points.map((point, index) =>
    appendVertex(
      positions,
      uvs,
      joints,
      weights,
      point,
      [index === 1 || index === 4 ? 1 : 0, index % 3 === 2 ? 1 : 0],
      headJoint,
    ),
  );
  const [a, b, c, d, e, f] = vertices;

  if (side > 0) {
    indices.push(a, b, c, d, f, e);
  } else {
    indices.push(a, c, b, d, e, f);
  }
  indices.push(a, d, b, b, d, e);
  indices.push(b, e, c, c, e, f);
  indices.push(c, f, a, a, f, d);
}

function addUvSphere(
  positions,
  uvs,
  joints,
  weights,
  indices,
  headJoint,
  center,
  radius,
  latitudeCount,
  longitudeCount,
) {
  const rows = [];
  for (let latitude = 0; latitude <= latitudeCount; latitude += 1) {
    const v = latitude / latitudeCount;
    const phi = v * Math.PI;
    const row = [];
    for (let longitude = 0; longitude < longitudeCount; longitude += 1) {
      const u = longitude / longitudeCount;
      const theta = u * Math.PI * 2;
      row.push(
        appendVertex(
          positions,
          uvs,
          joints,
          weights,
          [
            center[0] + Math.sin(phi) * Math.cos(theta) * radius,
            center[1] + Math.cos(phi) * radius,
            center[2] + Math.sin(phi) * Math.sin(theta) * radius,
          ],
          [u, v],
          headJoint,
        ),
      );
    }
    rows.push(row);
  }

  for (let latitude = 0; latitude < latitudeCount; latitude += 1) {
    for (let longitude = 0; longitude < longitudeCount; longitude += 1) {
      const next = (longitude + 1) % longitudeCount;
      const a = rows[latitude][longitude];
      const b = rows[latitude][next];
      const c = rows[latitude + 1][longitude];
      const d = rows[latitude + 1][next];
      indices.push(a, c, b, b, c, d);
    }
  }
}

function appendVertex(positions, uvs, joints, weights, position, uv, headJoint) {
  const index = positions.length / 3;
  positions.push(...position);
  uvs.push(...uv);
  joints.push(headJoint, 0, 0, 0);
  weights.push(1, 0, 0, 0);
  return index;
}

function recomputeNormals(positions, indices) {
  const normals = new Array(positions.length).fill(0);
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index] * 3;
    const ib = indices[index + 1] * 3;
    const ic = indices[index + 2] * 3;
    const ab = [
      positions[ib] - positions[ia],
      positions[ib + 1] - positions[ia + 1],
      positions[ib + 2] - positions[ia + 2],
    ];
    const ac = [
      positions[ic] - positions[ia],
      positions[ic + 1] - positions[ia + 1],
      positions[ic + 2] - positions[ia + 2],
    ];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    for (const vertexOffset of [ia, ib, ic]) {
      normals[vertexOffset] += normal[0];
      normals[vertexOffset + 1] += normal[1];
      normals[vertexOffset + 2] += normal[2];
    }
  }

  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
    if (length > 0) {
      normals[index] /= length;
      normals[index + 1] /= length;
      normals[index + 2] /= length;
    }
  }
  return normals;
}

function createVertexBuffer({ positions, normals, uvs, joints, weights }) {
  const vertexCount = positions.length / 3;
  const buffer = Buffer.alloc(vertexCount * 52);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 52;
    for (let component = 0; component < 3; component += 1) {
      buffer.writeFloatLE(positions[vertex * 3 + component], offset + component * 4);
      buffer.writeFloatLE(normals[vertex * 3 + component], offset + 12 + component * 4);
    }
    for (let component = 0; component < 2; component += 1) {
      buffer.writeFloatLE(uvs[vertex * 2 + component], offset + 24 + component * 4);
    }
    for (let component = 0; component < 4; component += 1) {
      buffer.writeUInt8(joints[vertex * 4 + component], offset + 32 + component);
      buffer.writeFloatLE(weights[vertex * 4 + component], offset + 36 + component * 4);
    }
  }
  return buffer;
}

function createIndexBuffer(indices) {
  const buffer = Buffer.alloc(indices.length * 2);
  indices.forEach((index, offset) => buffer.writeUInt16LE(index, offset * 2));
  return buffer;
}

function readAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  const componentCount = typeComponentCount(accessor.type);
  const componentSize = componentByteSize(accessor.componentType);
  const stride = view.byteStride || componentCount * componentSize;
  const baseOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = [];

  if (accessor.sparse) throw new Error("Sparse accessors are not supported.");
  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = baseOffset + element * stride;
    for (let component = 0; component < componentCount; component += 1) {
      values.push(
        readComponent(
          glb.bin,
          elementOffset + component * componentSize,
          accessor.componentType,
        ),
      );
    }
  }
  return values;
}

function writeAccessor(glb, accessorIndex, values) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  const componentCount = typeComponentCount(accessor.type);
  const componentSize = componentByteSize(accessor.componentType);
  const stride = view.byteStride || componentCount * componentSize;
  const baseOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  if (values.length !== accessor.count * componentCount) {
    throw new Error("Accessor write has the wrong number of values.");
  }
  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = baseOffset + element * stride;
    for (let component = 0; component < componentCount; component += 1) {
      writeComponent(
        glb.bin,
        elementOffset + component * componentSize,
        accessor.componentType,
        values[element * componentCount + component],
      );
    }
  }
}

function animationSignature(glb) {
  const canonical = (glb.json.animations || []).map((animation) => ({
    name: animation.name || "",
    channels: animation.channels.map((channel) => ({
      path: channel.target.path,
      node: glb.json.nodes[channel.target.node]?.name || channel.target.node,
      sampler: channel.sampler,
    })),
    samplers: animation.samplers.map((sampler) => ({
      interpolation: sampler.interpolation || "LINEAR",
      input: readAccessor(glb, sampler.input),
      output: readAccessor(glb, sampler.output),
    })),
  }));
  return digest(canonical);
}

function rigSignature(glb) {
  const canonical = (glb.json.skins || []).map((skin) => ({
    name: skin.name || "",
    skeleton: skin.skeleton == null ? null : glb.json.nodes[skin.skeleton]?.name,
    joints: skin.joints.map((nodeIndex) => glb.json.nodes[nodeIndex]?.name || nodeIndex),
    inverseBindMatrices:
      skin.inverseBindMatrices == null ? [] : readAccessor(glb, skin.inverseBindMatrices),
  }));
  return digest(canonical);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error("Not a GLB file.");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 is supported.");
  let offset = 12;
  let json;
  let bin;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === JSON_CHUNK) {
      json = JSON.parse(chunk.toString("utf8").replace(/[\u0000 ]+$/, ""));
    } else if (chunkType === BIN_CHUNK) {
      bin = Buffer.from(chunk);
    }
    offset += 8 + chunkLength;
  }
  if (!json || !bin) throw new Error("GLB is missing its JSON or binary chunk.");
  return { json, bin };
}

function encodeGlb({ json, bin }) {
  const jsonSource = Buffer.from(JSON.stringify(json));
  const paddedJsonLength = align4(jsonSource.length);
  const paddedBinLength = align4(bin.length);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const result = Buffer.alloc(totalLength);
  result.writeUInt32LE(GLB_MAGIC, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(totalLength, 8);
  result.writeUInt32LE(paddedJsonLength, 12);
  result.writeUInt32LE(JSON_CHUNK, 16);
  result.fill(0x20, 20, 20 + paddedJsonLength);
  jsonSource.copy(result, 20);
  const binHeader = 20 + paddedJsonLength;
  result.writeUInt32LE(paddedBinLength, binHeader);
  result.writeUInt32LE(BIN_CHUNK, binHeader + 4);
  bin.copy(result, binHeader + 8);
  return result;
}

function vectorBounds(values, componentCount) {
  const min = new Array(componentCount).fill(Infinity);
  const max = new Array(componentCount).fill(-Infinity);
  for (let index = 0; index < values.length; index += componentCount) {
    for (let component = 0; component < componentCount; component += 1) {
      min[component] = Math.min(min[component], values[index + component]);
      max[component] = Math.max(max[component], values[index + component]);
    }
  }
  return { min, max };
}

function typeComponentCount(type) {
  return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }[type];
}

function componentByteSize(componentType) {
  return {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4,
  }[componentType];
}

function readComponent(buffer, offset, componentType) {
  switch (componentType) {
    case 5120:
      return buffer.readInt8(offset);
    case 5121:
      return buffer.readUInt8(offset);
    case 5122:
      return buffer.readInt16LE(offset);
    case 5123:
      return buffer.readUInt16LE(offset);
    case 5125:
      return buffer.readUInt32LE(offset);
    case 5126:
      return buffer.readFloatLE(offset);
    default:
      throw new Error(`Unsupported accessor component type ${componentType}.`);
  }
}

function writeComponent(buffer, offset, componentType, value) {
  switch (componentType) {
    case 5120:
      buffer.writeInt8(value, offset);
      break;
    case 5121:
      buffer.writeUInt8(value, offset);
      break;
    case 5122:
      buffer.writeInt16LE(value, offset);
      break;
    case 5123:
      buffer.writeUInt16LE(value, offset);
      break;
    case 5125:
      buffer.writeUInt32LE(value, offset);
      break;
    case 5126:
      buffer.writeFloatLE(value, offset);
      break;
    default:
      throw new Error(`Unsupported accessor component type ${componentType}.`);
  }
}

function smoothstep(min, max, value) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function align4(value) {
  return (value + 3) & ~3;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message);
}
