#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traversePackage from "@babel/traverse";

const traverse = traversePackage.default ?? traversePackage;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const portRoot = path.join(projectRoot, "direct-port");
const vendorRoot = path.join(projectRoot, "vendor");
const dataRoot = path.join(portRoot, "data");
const sourceRoot = path.join(portRoot, "src");

const bundleNames = {
  vendor: "vendor.75f6e6ae65453426.js",
  webgl: "webgl.3250e36a65453426.js",
};

function parseModule(source) {
  return parse(source, {
    sourceType: "module",
    allowAwaitOutsideFunction: true,
    createImportExpressions: true,
  });
}

function keyName(node) {
  if (node?.type === "Identifier") return node.name;
  if (node?.type === "StringLiteral" || node?.type === "NumericLiteral") {
    return String(node.value);
  }
  return null;
}

function jsonValue(node) {
  if (!node) throw new Error("Cannot recover an empty literal");
  switch (node.type) {
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return node.value;
    case "NullLiteral":
      return null;
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "NumericLiteral") {
        return -node.argument.value;
      }
      break;
    case "ArrayExpression":
      return node.elements.map((element) => jsonValue(element));
    case "ObjectExpression":
      return Object.fromEntries(
        node.properties.map((property) => {
          if (property.type !== "ObjectProperty" || property.computed) {
            throw new Error(`Unsupported object member ${property.type}`);
          }
          return [keyName(property.key), jsonValue(property.value)];
        }),
      );
  }
  throw new Error(`Unsupported literal node ${node.type}`);
}

function parsedJsonBindings(ast) {
  const values = new Map();
  traverse(ast, {
    VariableDeclarator(bindingPath) {
      const { id, init } = bindingPath.node;
      if (
        id.type !== "Identifier" ||
        init?.type !== "CallExpression" ||
        init.callee.type !== "MemberExpression" ||
        init.callee.object.type !== "Identifier" ||
        init.callee.object.name !== "JSON" ||
        keyName(init.callee.property) !== "parse" ||
        init.arguments[0]?.type !== "StringLiteral"
      ) {
        return;
      }
      try {
        values.set(id.name, JSON.parse(init.arguments[0].value));
      } catch {
        // Other JSON.parse calls are outside the extracted runtime contracts.
      }
    },
  });
  return values;
}

function moduleDefaults(ast) {
  const defaults = new Map();
  traverse(ast, {
    VariableDeclarator(bindingPath) {
      const { id, init } = bindingPath.node;
      if (id.type !== "Identifier" || init?.type !== "CallExpression") return;
      let moduleObject = null;
      bindingPath.traverse({
        ObjectExpression(objectPath) {
          if (!moduleObject) moduleObject = objectPath.node;
        },
      });
      if (!moduleObject) return;
      const defaultProperty = moduleObject.properties.find(
        (property) => property.type === "ObjectProperty" && keyName(property.key) === "default",
      );
      if (defaultProperty?.type === "ObjectProperty") {
        defaults.set(id.name, defaultProperty.value);
      }
    },
  });
  return defaults;
}

async function recoverSceneManifests(vendorAst) {
  const parsedBindings = parsedJsonBindings(vendorAst);
  const defaults = moduleDefaults(vendorAst);
  const scenes = new Map();

  traverse(vendorAst, {
    ObjectProperty(propertyPath) {
      const sourcePath = keyName(propertyPath.node.key);
      const value = propertyPath.node.value;
      if (
        !sourcePath?.startsWith("/blender/Exports/") ||
        !sourcePath.endsWith(".json") ||
        value.type !== "Identifier"
      ) {
        return;
      }
      const defaultNode = defaults.get(value.name);
      if (defaultNode?.type !== "Identifier") return;
      const recovered = parsedBindings.get(defaultNode.name);
      if (recovered === undefined) return;
      scenes.set(path.basename(sourcePath), recovered);
    },
  });

  const destination = path.join(dataRoot, "scenes");
  await fs.mkdir(destination, { recursive: true });
  for (const [name, contents] of scenes) {
    await fs.writeFile(path.join(destination, name), `${JSON.stringify(contents, null, 2)}\n`, "utf8");
  }
  return [...scenes.keys()].sort();
}

async function recoverShaders(webglAst) {
  const defaults = moduleDefaults(webglAst);
  const shaders = new Map();

  traverse(webglAst, {
    ObjectProperty(propertyPath) {
      const sourcePath = keyName(propertyPath.node.key);
      const value = propertyPath.node.value;
      if (!sourcePath?.endsWith(".glsl") || value.type !== "Identifier") return;
      const defaultNode = defaults.get(value.name);
      if (defaultNode?.type === "StringLiteral") {
        shaders.set(path.basename(sourcePath), defaultNode.value);
      }
    },
  });

  const destination = path.join(sourceRoot, "shaders");
  await fs.mkdir(destination, { recursive: true });
  for (const [name, contents] of shaders) {
    const normalizedContents = contents.replace(/[ \t]+$/gm, "").trimEnd();
    await fs.writeFile(path.join(destination, name), `${normalizedContents}\n`, "utf8");
  }
  return [...shaders.keys()].sort();
}

async function recoverAnimationClips(webglAst) {
  let clips = null;
  traverse(webglAst, {
    VariableDeclarator(bindingPath) {
      if (clips || bindingPath.node.init?.type !== "ObjectExpression") return;
      const keys = new Set(
        bindingPath.node.init.properties
          .filter((property) => property.type === "ObjectProperty")
          .map((property) => keyName(property.key)),
      );
      if (!["Walk", "Run", "Idle", "Jetpack", "ZiplineFall"].every((name) => keys.has(name))) return;
      clips = jsonValue(bindingPath.node.init);
    },
  });
  if (!clips) throw new Error("Character animation frame table was not found");
  await fs.writeFile(
    path.join(dataRoot, "character-animation-clips.json"),
    `${JSON.stringify({ fps: 30, clips }, null, 2)}\n`,
    "utf8",
  );
  return clips;
}

async function recoverAudioSprite(webglAst) {
  let clips = null;
  traverse(webglAst, {
    CallExpression(callPath) {
      if (clips) return;
      const { callee, arguments: args } = callPath.node;
      if (
        callee.type !== "MemberExpression" ||
        callee.object.type !== "Identifier" ||
        callee.object.name !== "JSON" ||
        keyName(callee.property) !== "parse" ||
        args[0]?.type !== "StringLiteral"
      ) {
        return;
      }
      try {
        const value = JSON.parse(args[0].value);
        if (
          Array.isArray(value) &&
          value.some((entry) => Array.isArray(entry) && entry[0] === "sfx_player_footsteps")
        ) {
          clips = value;
        }
      } catch {
        // Ignore JSON calls outside the audio sprite table.
      }
    },
  });
  if (!clips) throw new Error("Audio sprite table was not found");
  await fs.writeFile(
    path.join(dataRoot, "audio-sprite-clips.json"),
    `${JSON.stringify(clips, null, 2)}\n`,
    "utf8",
  );
  return clips;
}

const [vendorSource, webglSource] = await Promise.all([
  fs.readFile(path.join(vendorRoot, bundleNames.vendor), "utf8"),
  fs.readFile(path.join(vendorRoot, bundleNames.webgl), "utf8"),
]);
const vendorAst = parseModule(vendorSource);
const webglAst = parseModule(webglSource);

const [scenes, shaders, animationClips, audioClips] = await Promise.all([
  recoverSceneManifests(vendorAst),
  recoverShaders(webglAst),
  recoverAnimationClips(webglAst),
  recoverAudioSprite(webglAst),
]);

const extractionManifest = {
  format: "datab-each-extracted-modules-v1",
  sources: bundleNames,
  scenes,
  shaders,
  animationClips: Object.keys(animationClips),
  audioClipCount: audioClips.length,
};
await fs.writeFile(
  path.join(portRoot, "EXTRACTED_MODULES.json"),
  `${JSON.stringify(extractionManifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `Extracted ${scenes.length} scene manifests, ${shaders.length} shaders, ${Object.keys(animationClips).length} animation clips, and ${audioClips.length} audio clips.`,
);
