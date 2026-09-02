#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import generatorPackage from "@babel/generator";
import { parse } from "@babel/parser";
import traversePackage from "@babel/traverse";
import * as types from "@babel/types";

const generate = generatorPackage.default ?? generatorPackage;
const traverse = traversePackage.default ?? traversePackage;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const referenceRoot = path.join(projectRoot, "reference");
const outputRoot = path.join(projectRoot, "direct-port");
const outputAssets = path.join(outputRoot, "assets");

const bundles = [
  "vendor.75f6e6ae65453426.js",
  "webgl.3250e36a65453426.js",
  "main.35e6243a65453426.js",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const webglSymbolNames = {
  Cs: "shaderChunks",
  Ds: "TimersMixin",
  Us: "ReactivityMixin",
  js: "DynamicPropsMixin",
  ei: "InteractiveZonesController",
  ii: "InteractiveZone",
  ri: "InteractiveActorMixin",
  yi: "PropsTransitionMixin",
  wi: "NpcController",
  xi: "characterAnimationFrames",
  Pi: "CharacterMixin",
  Ni: "DialogMixin",
  eo: "CharacterAnimationMixin",
  Fo: "SceneTransitionController",
  Uo: "RafStateMachineMixin",
  da: "initializeGameRuntime",
  zu: "runtimePlugins",
  Bu: "loadWebGL",
};

const runtimePluginNames = [
  "timePlugin",
  "rendererPlugin",
  "viewportPlugin",
  "adaptiveQualityPlugin",
  "framebufferPoolPlugin",
  "resourcesPlugin",
  "transitionsPlugin",
  "sceneManagerPlugin",
  "runtimeStorePlugin",
  "physicsPlugin",
  "particlesPlugin",
  "audioPlugin",
  "inputPlugin",
];

function recoverWebglSymbols(ast) {
  let programPath = null;
  traverse(ast, {
    Program(currentPath) {
      programPath = currentPath;
      currentPath.stop();
    },
  });
  if (!programPath) throw new Error("WebGL program scope was not found");

  for (const [compiledName, recoveredName] of Object.entries(webglSymbolNames)) {
    if (!programPath.scope.hasBinding(compiledName)) continue;
    if (programPath.scope.hasBinding(recoveredName)) {
      throw new Error(`Cannot recover ${compiledName}; ${recoveredName} is already bound`);
    }
    programPath.scope.rename(compiledName, recoveredName);
  }

  const binding = programPath.scope.getBinding("runtimePlugins");
  const array = binding?.path.isVariableDeclarator() ? binding.path.get("init") : null;
  if (!array?.isArrayExpression() || array.node.elements.length !== runtimePluginNames.length) {
    throw new Error("The recovered runtime plugin array does not match the expected 13 subsystems");
  }
  array.get("elements").forEach((pluginPath, index) => {
    if (pluginPath.isFunctionExpression()) {
      pluginPath.node.id = types.identifier(runtimePluginNames[index]);
    }
  });
}

function componentObject(init) {
  if (types.isObjectExpression(init)) return init;
  if (!types.isCallExpression(init)) return null;
  return init.arguments.find((argument) => types.isObjectExpression(argument)) ?? null;
}

function componentName(init) {
  const object = componentObject(init);
  if (!object) return null;
  const property = object.properties.find(
    (candidate) =>
      types.isObjectProperty(candidate) &&
      !candidate.computed &&
      ((types.isIdentifier(candidate.key) && candidate.key.name === "__name") ||
        (types.isStringLiteral(candidate.key) && candidate.key.value === "__name")),
  );
  return property && types.isStringLiteral(property.value) ? property.value.value : null;
}

function safePascalCase(value) {
  const name = value
    .split(/[^A-Za-z0-9_$]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
  return /^[$A-Z_a-z]/.test(name) ? name : `Component${name}`;
}

function recoverVueComponentSymbols(ast) {
  let programPath = null;
  const candidates = [];
  traverse(ast, {
    Program(currentPath) {
      programPath = currentPath;
    },
    VariableDeclarator(variablePath) {
      if (!variablePath.scope.path.isProgram()) return;
      const { id, init } = variablePath.node;
      if (!types.isIdentifier(id)) return;
      const name = componentName(init);
      if (name) candidates.push({ compiledName: id.name, componentName: name });
    },
  });
  if (!programPath) return [];

  const recovered = [];
  const usedNames = new Set(Object.keys(programPath.scope.bindings));
  for (const candidate of candidates) {
    const baseName = `Vue${safePascalCase(candidate.componentName)}Component`;
    let recoveredName = baseName;
    let suffix = 2;
    while (usedNames.has(recoveredName)) recoveredName = `${baseName}${suffix++}`;
    if (!programPath.scope.hasBinding(candidate.compiledName)) continue;
    programPath.scope.rename(candidate.compiledName, recoveredName);
    usedNames.add(recoveredName);
    recovered.push({ ...candidate, recoveredName });
  }
  return recovered;
}

async function recoverBundle(name) {
  const sourcePath = path.join(referenceRoot, "assets", name);
  const source = await fs.readFile(sourcePath, "utf8");
  const ast = parse(source, {
    sourceType: "module",
    allowAwaitOutsideFunction: true,
    createImportExpressions: true,
  });
  if (name.startsWith("webgl.")) recoverWebglSymbols(ast);
  const recoveredVueComponents = recoverVueComponentSymbols(ast);
  const mapName = `${name}.map`;
  const result = generate(
    ast,
    {
      comments: true,
      compact: false,
      concise: false,
      minified: false,
      retainLines: false,
      sourceFileName: `reference/assets/${name}`,
      sourceMaps: true,
    },
    source,
  );
  const code = `${result.code}\n//# sourceMappingURL=${mapName}\n`;
  const map = {
    ...result.map,
    file: name,
    sourcesContent: [source],
  };

  await fs.writeFile(path.join(outputAssets, name), code, "utf8");
  await fs.writeFile(path.join(outputAssets, mapName), `${JSON.stringify(map)}\n`, "utf8");

  return {
    name,
    sourceBytes: Buffer.byteLength(source),
    recoveredBytes: Buffer.byteLength(code),
    sourceSha256: sha256(source),
    recoveredSha256: sha256(code),
    sourceMap: `assets/${mapName}`,
    recoveredVueComponents,
  };
}

async function recoverIndex() {
  const source = await fs.readFile(path.join(referenceRoot, "index.html"), "utf8");
  const recovered = source
    .replace('"basepath":"/"', '"basepath":"/three-port/"')
    .replaceAll(
      "/assets/main.35e6243a65453426.js",
      "/three-port/assets/main.35e6243a65453426.js",
    )
    .replaceAll(
      "/assets/webgl.3250e36a65453426.js",
      "/three-port/assets/webgl.3250e36a65453426.js",
    );
  await fs.writeFile(path.join(outputRoot, "index.html"), recovered, "utf8");
}

async function extractSiteData() {
  const html = await fs.readFile(path.join(referenceRoot, "index.html"), "utf8");
  const marker = "window.__DATA=JSON.parse('";
  const start = html.indexOf(marker) + marker.length;
  const end = html.indexOf("')</script>", start);
  if (start < marker.length || end < 0) throw new Error("Embedded site data was not found");
  const encoded = html.slice(start, end);
  const decoded = Function(`\"use strict\"; return '${encoded}';`)();
  const data = JSON.parse(decoded);
  const dataDirectory = path.join(outputRoot, "data");
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(path.join(dataDirectory, "site.json"), `${JSON.stringify(data, null, 2)}\n`);
}

await fs.mkdir(outputAssets, { recursive: true });
const recoveredBundles = [];
for (const bundle of bundles) {
  console.log(`Recovering ${bundle}`);
  recoveredBundles.push(await recoverBundle(bundle));
}
await recoverIndex();
await extractSiteData();

const manifest = {
  format: "datab-each-direct-port-v1",
  sourceBuild: "20250626-165126",
  engine: "three.js",
  engineRevision: 150,
  basePath: "/three-port/",
  sourceStrategy: "Scope-safe AST recovery from the authoritative ESM production chunks",
  recoveredSymbols: Object.values(webglSymbolNames),
  sharedAssetRoot: "../reference",
  bundles: recoveredBundles,
};
await fs.writeFile(
  path.join(outputRoot, "PORT_MANIFEST.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Direct port written to ${outputRoot}`);
