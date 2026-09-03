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
const extraArgs = process.argv
  .slice(2)
  .filter((value) =>
    value !== "--slim-only" && value !== "--stubby-only" && value !== "--retune-face"
  );
const sourcePath = resolve(extraArgs[0] || defaultAsset);
const outputPath = resolve(extraArgs[1] || defaultAsset);
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
  const designStats = alienizeCharacter(decoded, {
    slimOnly: process.argv.includes("--slim-only"),
    retuneFaceOnly: process.argv.includes("--retune-face"),
  });
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
      `Collapsed upper-head vertices: ${designStats.collapsedUpperHeadVertices}`,
      `Retuned face vertices: ${designStats.retunedFaceVertices}`,
      `Slimmed leg vertices: ${designStats.slimmedLegVertices}`,
      `Stubby foot vertices: ${designStats.stubbyFootVertices}`,
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

function alienizeCharacter(glb, { slimOnly = false, retuneFaceOnly = false } = {}) {
  const { json } = glb;
  const bodyNodeIndex = json.nodes.findIndex(
    (node) => node.name === "Chara_Low_Rig:BODY_01",
  );
  if (bodyNodeIndex < 0) throw new Error("Could not find the shared character body.");

  const bodyNode = json.nodes[bodyNodeIndex];
  const primitive = json.meshes[bodyNode.mesh]?.primitives?.[0];
  if (!primitive) throw new Error("The shared character body has no mesh primitive.");
  if (primitive.extras?.databEachStubbyFeet && !retuneFaceOnly) {
    throw new Error("This character already has stubby feet.");
  }
  const alreadySlimmed = Boolean(primitive.extras?.databEachSlimLegs);
  if (primitive.extras?.databEachAlienDesign != null) {
    slimOnly = true;
  }
  if (process.argv.includes("--stubby-only")) {
    slimOnly = true;
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
  const chestJoint = jointNames.findIndex((name) => name.endsWith("Chest_M"));
  if (chestJoint < 0) throw new Error("Could not find the character's chest joint.");

  let collapsedUpperHeadVertices = 0;
  let retunedFaceVertices = 0;
  if (retuneFaceOnly) {
    retunedFaceVertices = retuneFaceOnBody({ positions, uvs });
    writeBodyPrimitive(glb, primitive, { positions, uvs, joints, weights, indices });
    return {
      originalVertexCount,
      addedVertexCount: 0,
      collapsedUpperHeadVertices: 0,
      retunedFaceVertices,
      slimmedLegVertices: 0,
      stubbyFootVertices: 0,
    };
  }
  if (!slimOnly) {
    collapsedUpperHeadVertices = collapseUpperHeadGeometry({
      positions,
      uvs,
      joints,
      weights,
      jointNames,
      chestJoint,
    });
    addCollapsedFacePatch({
      positions,
      uvs,
      joints,
      weights,
      indices,
      chestJoint,
      originalVertexCount,
    });
    moveFaceToTorso({
      positions,
      uvs,
      joints,
      weights,
      chestJoint,
      originalVertexCount,
    });
    lowerArms({
      positions,
      joints,
      weights,
      jointNames,
      originalVertexCount,
    });
    addTorsoCap(positions, uvs, joints, weights, indices, chestJoint);
    addAntenna(positions, uvs, joints, weights, indices, chestJoint, -1);
    addAntenna(positions, uvs, joints, weights, indices, chestJoint, 1);
    addEarFin(positions, uvs, joints, weights, indices, chestJoint, -1);
    addEarFin(positions, uvs, joints, weights, indices, chestJoint, 1);
  }

  const slimmedLegVertices = alreadySlimmed
    ? 0
    : slimLegs({
        positions,
        joints,
        weights,
        jointNames,
      });
  const stubbyFootVertices = stubbyFeet({
    positions,
    joints,
    weights,
    jointNames,
  });

  writeBodyPrimitive(glb, primitive, { positions, uvs, joints, weights, indices });

  return {
    originalVertexCount,
    addedVertexCount: positions.length / 3 - originalVertexCount,
    collapsedUpperHeadVertices,
    retunedFaceVertices,
    slimmedLegVertices,
    stubbyFootVertices,
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

function collapseUpperHeadGeometry({
  positions,
  uvs,
  joints,
  weights,
  jointNames,
  chestJoint,
}) {
  const vertexCount = positions.length / 3;
  let collapsedVertexCount = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (uvs[vertex * 2] < 0.7) continue;

    let headWeight = 0;
    for (let component = 0; component < 4; component += 1) {
      const offset = vertex * 4 + component;
      const jointName = jointNames[joints[offset]] || "";
      if (jointName.endsWith("Head_M")) {
        headWeight += weights[offset];
      }
    }
    if (headWeight <= 0.15) continue;

    const offset = vertex * 3;
    const collapsed = collapseHeadPosition(
      positions[offset],
      positions[offset + 1],
      positions[offset + 2],
    );
    positions[offset] = collapsed[0];
    positions[offset + 1] = collapsed[1];
    positions[offset + 2] = collapsed[2];
    uvs[vertex * 2] = 0.876;
    uvs[vertex * 2 + 1] = 0.3;
    bindVertexToJoint(joints, weights, vertex, chestJoint);
    collapsedVertexCount += 1;
  }

  return collapsedVertexCount;
}

function collapseHeadPosition(x, y, z) {
  const t = Math.max(0, Math.min(1, (y - 1.5) / 0.9));
  const horizontalScale = 0.82 - t * 0.22;
  return [
    x * horizontalScale,
    1.37 + t * 0.19,
    0.04 + (z - 0.04) * horizontalScale,
  ];
}

function addCollapsedFacePatch({
  positions,
  uvs,
  joints,
  weights,
  indices,
  chestJoint,
  originalVertexCount,
}) {
  const originalIndices = indices.slice();
  const replacements = new Map();
  const duplicateFaceVertex = (vertex) => {
    if (replacements.has(vertex)) return replacements.get(vertex);
    const offset = vertex * 3;
    const duplicate = appendVertex(
      positions,
      uvs,
      joints,
      weights,
      collapseHeadPosition(
        positions[offset],
        positions[offset + 1],
        positions[offset + 2],
      ),
      [0.876, 0.3],
      chestJoint,
    );
    replacements.set(vertex, duplicate);
    return duplicate;
  };

  for (let index = 0; index < originalIndices.length; index += 3) {
    const a = originalIndices[index];
    const b = originalIndices[index + 1];
    const c = originalIndices[index + 2];
    if (a >= originalVertexCount || b >= originalVertexCount || c >= originalVertexCount) {
      continue;
    }
    if (uvs[a * 2] >= 0.7 || uvs[b * 2] >= 0.7 || uvs[c * 2] >= 0.7) {
      continue;
    }
    indices.push(
      duplicateFaceVertex(a),
      duplicateFaceVertex(b),
      duplicateFaceVertex(c),
    );
  }
}

function moveFaceToTorso({
  positions,
  uvs,
  joints,
  weights,
  chestJoint,
  originalVertexCount,
}) {
  for (let vertex = 0; vertex < originalVertexCount; vertex += 1) {
    if (uvs[vertex * 2] >= 0.7) continue;

    const offset = vertex * 3;
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];
    positions[offset] = x * 0.56;
    positions[offset + 1] = 1.29 + (y - 1.9605) * 0.55;
    positions[offset + 2] = 0.45 + (z - 0.32) * 0.2;
    bindVertexToJoint(joints, weights, vertex, chestJoint);
  }
}

function retuneFaceOnBody({ positions, uvs }) {
  const vertexCount = positions.length / 3;
  const faceVertices = [];
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    if (uvs[vertex * 2] >= 0.7) continue;
    faceVertices.push(vertex);
  }
  if (faceVertices.length === 0) {
    throw new Error("No face vertices found to centre on the body.");
  }

  let meanX = 0;
  let meanY = 0;
  for (const vertex of faceVertices) {
    meanX += positions[vertex * 3];
    meanY += positions[vertex * 3 + 1];
  }
  meanX /= faceVertices.length;
  meanY /= faceVertices.length;

  const stretchY = 1.38;
  const dropY = 0.05;
  for (const vertex of faceVertices) {
    const offset = vertex * 3;
    positions[offset] -= meanX;
    positions[offset + 1] = meanY + (positions[offset + 1] - meanY) * stretchY - dropY;
  }
  return faceVertices.length;
}

function slimLegs({ positions, joints, weights, jointNames }) {
  const vertexCount = positions.length / 3;
  const influenceFor = (name) => {
    if (/(?:Hip)_[LR]$/.test(name)) return 0.6;
    if (/(?:Knee)_[LR]$/.test(name)) return 1;
    if (/(?:Ankle)_[LR]$/.test(name)) return 1;
    if (/(?:Toes)_[LR]$/.test(name)) return 0.28;
    return 0;
  };

  const axis = {
    L: { x: 0, z: 0, weight: 0 },
    R: { x: 0, z: 0, weight: 0 },
  };
  const perVertex = new Array(vertexCount);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let left = 0;
    let right = 0;
    for (let component = 0; component < 4; component += 1) {
      const name = jointNames[joints[vertex * 4 + component]] || "";
      const influence = weights[vertex * 4 + component] * influenceFor(name);
      if (name.endsWith("_L")) left += influence;
      if (name.endsWith("_R")) right += influence;
    }
    perVertex[vertex] = { left, right };
    const side = left >= right ? "L" : "R";
    const weight = side === "L" ? left : right;
    if (weight < 0.12) continue;
    axis[side].x += positions[vertex * 3] * weight;
    axis[side].z += positions[vertex * 3 + 2] * weight;
    axis[side].weight += weight;
  }

  for (const side of ["L", "R"]) {
    if (axis[side].weight <= 0) continue;
    axis[side].x /= axis[side].weight;
    axis[side].z /= axis[side].weight;
  }

  const slim = 0.4;
  let slimmed = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const { left, right } = perVertex[vertex];
    const side = left >= right ? "L" : "R";
    const weight = Math.min(1, side === "L" ? left : right);
    if (weight < 0.12 || axis[side].weight <= 0) continue;
    const amount = (1 - slim) * weight;
    const x = positions[vertex * 3];
    const z = positions[vertex * 3 + 2];
    positions[vertex * 3] = x + (axis[side].x - x) * amount;
    positions[vertex * 3 + 2] = z + (axis[side].z - z) * amount;
    slimmed += 1;
  }
  return slimmed;
}

function stubbyFeet({ positions, joints, weights, jointNames }) {
  const vertexCount = positions.length / 3;
  const axis = {
    L: { x: 0, z: 0, weight: 0 },
    R: { x: 0, z: 0, weight: 0 },
  };
  const perVertex = new Array(vertexCount);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    let leftToes = 0;
    let rightToes = 0;
    let leftAnkle = 0;
    let rightAnkle = 0;
    for (let component = 0; component < 4; component += 1) {
      const name = jointNames[joints[vertex * 4 + component]] || "";
      const weight = weights[vertex * 4 + component];
      if (name.endsWith("Toes_L")) leftToes += weight;
      if (name.endsWith("Toes_R")) rightToes += weight;
      if (name.endsWith("Ankle_L")) leftAnkle += weight;
      if (name.endsWith("Ankle_R")) rightAnkle += weight;
    }

    const y = positions[vertex * 3 + 1];
    const ankleGate = Math.max(0, Math.min(1, (0.11 - y) / 0.08));
    const left = leftToes * 1.05 + leftAnkle * ankleGate;
    const right = rightToes * 1.05 + rightAnkle * ankleGate;
    const side = left >= right ? "L" : "R";
    const footWeight = side === "L" ? left : right;
    const toesWeight = side === "L" ? leftToes : rightToes;
    const ankleWeight = side === "L" ? leftAnkle : rightAnkle;
    perVertex[vertex] = { side, footWeight, toesWeight, ankleGate };

    const axisWeight = ankleWeight * (0.35 + (1 - ankleGate) * 0.65);
    if (axisWeight >= 0.18 && y > 0.02 && y < 0.22) {
      axis[side].x += positions[vertex * 3] * axisWeight;
      axis[side].z += positions[vertex * 3 + 2] * axisWeight;
      axis[side].weight += axisWeight;
    }
  }

  for (const side of ["L", "R"]) {
    if (axis[side].weight <= 0) continue;
    axis[side].x /= axis[side].weight;
    axis[side].z /= axis[side].weight;
  }

  const widthScale = 1.68;
  const lengthScale = 0.34;
  const stubHeight = 0.044;
  const stubForward = 0.03;
  let reshaped = 0;

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const { side, footWeight, toesWeight, ankleGate } = perVertex[vertex];
    if (footWeight < 0.12 || axis[side].weight <= 0) continue;

    const amount = Math.min(1, footWeight);
    const x = positions[vertex * 3];
    const y = positions[vertex * 3 + 1];
    const z = positions[vertex * 3 + 2];
    const padX = axis[side].x;
    const padZ = axis[side].z + stubForward;

    positions[vertex * 3] = x + (padX + (x - padX) * widthScale - x) * amount;
    positions[vertex * 3 + 2] = z + (padZ + (z - padZ) * lengthScale - z) * amount;

    if (y > stubHeight) {
      const flatten = amount * Math.max(0.4, toesWeight, ankleGate * 0.85);
      positions[vertex * 3 + 1] = y + (stubHeight - y) * flatten * 0.88;
    }
    if (positions[vertex * 3 + 1] < 0) {
      positions[vertex * 3 + 1] = 0;
    }
    reshaped += 1;
  }
  return reshaped;
}

function writeBodyPrimitive(glb, primitive, { positions, uvs, joints, weights, indices }) {
  const { json, bin } = glb;
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
    databEachAlienDesign: primitive.extras?.databEachAlienDesign ?? 2,
    databEachSlimLegs: primitive.extras?.databEachSlimLegs ?? 1,
    databEachStubbyFeet: 1,
    databEachFaceRetune: 1,
  };
  json.buffers[0].byteLength = combinedBin.length;
}

function lowerArms({
  positions,
  joints,
  weights,
  jointNames,
  originalVertexCount,
}) {
  const armJointPattern = /(?:Shoulder|Elbow|Wrist)_[LR]$/;
  const verticalOffset = 0.35;

  for (let vertex = 0; vertex < originalVertexCount; vertex += 1) {
    let armWeight = 0;
    for (let component = 0; component < 4; component += 1) {
      const skinOffset = vertex * 4 + component;
      if (armJointPattern.test(jointNames[joints[skinOffset]] || "")) {
        armWeight += weights[skinOffset];
      }
    }
    positions[vertex * 3 + 1] -= verticalOffset * armWeight;
  }
}

function bindVertexToJoint(joints, weights, vertex, jointIndex) {
  const offset = vertex * 4;
  joints[offset] = jointIndex;
  joints[offset + 1] = 0;
  joints[offset + 2] = 0;
  joints[offset + 3] = 0;
  weights[offset] = 1;
  weights[offset + 1] = 0;
  weights[offset + 2] = 0;
  weights[offset + 3] = 0;
}

function addTorsoCap(positions, uvs, joints, weights, indices, chestJoint) {
  const segmentCount = 16;
  const center = appendVertex(
    positions,
    uvs,
    joints,
    weights,
    [0, 1.66, 0.04],
    [0.876, 0.3],
    chestJoint,
  );
  const innerRing = [];
  const outerRing = [];
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const angle = (segment / segmentCount) * Math.PI * 2;
    innerRing.push(
      appendVertex(
        positions,
        uvs,
        joints,
        weights,
        [
          Math.cos(angle) * 0.18,
          1.615,
          0.04 + Math.sin(angle) * 0.15,
        ],
        [0.876, 0.3],
        chestJoint,
      ),
    );
    outerRing.push(
      appendVertex(
        positions,
        uvs,
        joints,
        weights,
        [
          Math.cos(angle) * 0.37,
          1.4,
          0.04 + Math.sin(angle) * 0.31,
        ],
        [0.876, 0.3],
        chestJoint,
      ),
    );
  }

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const next = (segment + 1) % segmentCount;
    indices.push(center, innerRing[next], innerRing[segment]);
    indices.push(
      innerRing[segment],
      innerRing[next],
      outerRing[segment],
      innerRing[next],
      outerRing[next],
      outerRing[segment],
    );
  }
}

function addAntenna(positions, uvs, joints, weights, indices, jointIndex, side) {
  const ringCount = 6;
  const sideCount = 8;
  const rings = [];

  for (let ring = 0; ring < ringCount; ring += 1) {
    const t = ring / (ringCount - 1);
    const centerX = side * (0.16 + 0.085 * t);
    const centerY = 1.45 + 0.25 * t + Math.sin(t * Math.PI) * 0.02;
    const centerZ = 0.015 - 0.01 * t;
    const radius = 0.045 - 0.022 * t;
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
          [0.876, 0.3],
          jointIndex,
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

  const tipCenter = [side * 0.245, 1.74, 0.005];
  addUvEllipsoid(
    positions,
    uvs,
    joints,
    weights,
    indices,
    jointIndex,
    tipCenter,
    [0.06, 0.06, 0.06],
    5,
    8,
    [0.876, 0.3],
  );
}

function addEarFin(positions, uvs, joints, weights, indices, jointIndex, side) {
  const innerX = side * 0.33;
  const outerX = side * 0.55;
  const frontZ = 0.13;
  const backZ = -0.02;
  const points = [
    [innerX, 1.27, frontZ],
    [outerX, 1.39, frontZ],
    [innerX, 1.53, frontZ],
    [innerX, 1.27, backZ],
    [outerX, 1.39, backZ],
    [innerX, 1.53, backZ],
  ];
  const vertices = points.map((point) =>
    appendVertex(
      positions,
      uvs,
      joints,
      weights,
      point,
      [0.876, 0.3],
      jointIndex,
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

function addUvEllipsoid(
  positions,
  uvs,
  joints,
  weights,
  indices,
  jointIndex,
  center,
  radii,
  latitudeCount,
  longitudeCount,
  fixedUv,
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
            center[0] + Math.sin(phi) * Math.cos(theta) * radii[0],
            center[1] + Math.cos(phi) * radii[1],
            center[2] + Math.sin(phi) * Math.sin(theta) * radii[2],
          ],
          fixedUv || [u, v],
          jointIndex,
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
      indices.push(a, b, c, b, d, c);
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

function align4(value) {
  return (value + 3) & ~3;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message);
}
