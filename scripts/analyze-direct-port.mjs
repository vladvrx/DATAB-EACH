#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import traversePackage from "@babel/traverse";

const traverse = traversePackage.default ?? traversePackage;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const referenceRoot = path.join(projectRoot, "reference");
const portRoot = path.join(projectRoot, "direct-port");
const vendorRoot = path.join(projectRoot, "vendor");
const analysisRoot = path.join(portRoot, "analysis");

const bundles = [
  "vendor.75f6e6ae65453426.js",
  "webgl.3250e36a65453426.js",
  "main.35e6243a65453426.js",
];

const pluginNamesByProperty = new Map([
  ["time", "time"],
  ["viewport", "viewport"],
  ["quality", "adaptive-quality"],
  ["fbo", "framebuffer-pool"],
  ["renderer", "renderer"],
  ["resources", "resources"],
  ["atlas", "sprite-atlas"],
  ["transitions", "transitions"],
  ["scenes", "scene-manager"],
  ["store", "runtime-store"],
  ["initPhysics", "physics"],
  ["particles", "particles"],
  ["audio", "audio"],
  ["input", "input"],
]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function propertyName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "StringLiteral" || node.type === "NumericLiteral") {
    return String(node.value);
  }
  return null;
}

function bindingNames(node) {
  if (!node) return [];
  if (node.type === "Identifier") return [node.name];
  if (node.type === "RestElement") return bindingNames(node.argument);
  if (node.type === "AssignmentPattern") return bindingNames(node.left);
  if (node.type === "ObjectPattern") {
    return node.properties.flatMap((property) =>
      property.type === "RestElement" ? bindingNames(property.argument) : bindingNames(property.value),
    );
  }
  if (node.type === "ArrayPattern") return node.elements.flatMap(bindingNames);
  return [];
}

function declarationSummary(node) {
  if (node.type === "ImportDeclaration") {
    return {
      type: node.type,
      names: node.specifiers.map((specifier) => specifier.local.name),
      source: node.source.value,
    };
  }
  if (node.type === "VariableDeclaration") {
    return {
      type: node.type,
      kind: node.kind,
      names: node.declarations.flatMap((declaration) => bindingNames(declaration.id)),
    };
  }
  if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
    return {
      type: node.type,
      names: node.id ? [node.id.name] : [],
      methods:
        node.type === "ClassDeclaration"
          ? node.body.body
              .filter((member) => member.type === "ClassMethod" || member.type === "ClassPrivateMethod")
              .map((member) => propertyName(member.key))
              .filter(Boolean)
          : undefined,
    };
  }
  if (node.type === "ExportNamedDeclaration") {
    return {
      type: node.type,
      names: node.specifiers.map((specifier) => propertyName(specifier.exported)).filter(Boolean),
    };
  }
  return { type: node.type, names: [] };
}

function stringAnchors(functionPath) {
  const strings = new Set();
  functionPath.traverse({
    StringLiteral(stringPath) {
      const value = stringPath.node.value.trim();
      if (
        value.length >= 3 &&
        value.length <= 90 &&
        !value.includes("\n") &&
        !value.startsWith("#define") &&
        !value.startsWith("precision ")
      ) {
        strings.add(value);
      }
    },
  });
  return [...strings].slice(0, 24);
}

function rootProperties(functionPath) {
  const root = functionPath.node.params[0];
  if (!root || root.type !== "Identifier") return [];
  const rootName = root.name;
  const properties = new Set();

  function collectMember(member) {
    if (member?.type !== "MemberExpression") return;
    if (member.object.type !== "Identifier" || member.object.name !== rootName) return;
    const name = propertyName(member.property);
    if (name) properties.add(name);
  }

  functionPath.traverse({
    AssignmentExpression(assignmentPath) {
      collectMember(assignmentPath.node.left);
    },
    CallExpression(callPath) {
      const { callee, arguments: args } = callPath.node;
      if (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "Object" &&
        propertyName(callee.property) === "assign" &&
        args[0]?.type === "Identifier" &&
        args[0].name === rootName &&
        args[1]?.type === "ObjectExpression"
      ) {
        for (const property of args[1].properties) {
          if (property.type === "ObjectProperty" || property.type === "ObjectMethod") {
            const name = propertyName(property.key);
            if (name) properties.add(name);
          }
        }
      }
    },
  });

  return [...properties].sort();
}

function inferPluginName(properties, index) {
  for (const property of properties) {
    const name = pluginNamesByProperty.get(property);
    if (name) return name;
  }
  return `runtime-plugin-${String(index + 1).padStart(2, "0")}`;
}

function analyzeBundle(name, source) {
  const ast = parse(source, {
    sourceType: "module",
    allowAwaitOutsideFunction: true,
    createImportExpressions: true,
  });
  const declarations = ast.program.body.map((node) => ({
    ...declarationSummary(node),
    startLine: node.loc?.start.line ?? null,
    endLine: node.loc?.end.line ?? null,
  }));
  const runtimePluginCandidates = [];

  traverse(ast, {
    VariableDeclarator(variablePath) {
      const { id, init } = variablePath.node;
      if (id.type !== "Identifier" || init?.type !== "ArrayExpression") return;
      const functions = init.elements.filter(
        (element) => element?.type === "FunctionExpression" || element?.type === "ArrowFunctionExpression",
      );
      if (functions.length < 8 || functions.length !== init.elements.length) return;
      runtimePluginCandidates.push({ variablePath, id: id.name, count: functions.length });
    },
  });

  let plugins = [];
  const runtimePlugins = runtimePluginCandidates.sort((left, right) => right.count - left.count)[0];
  if (runtimePlugins) {
    const arrayPath = runtimePlugins.variablePath.get("init");
    plugins = arrayPath.get("elements").map((functionPath, index) => {
      const properties = rootProperties(functionPath);
      return {
        index,
        inferredName: inferPluginName(properties, index),
        startLine: functionPath.node.loc?.start.line ?? null,
        endLine: functionPath.node.loc?.end.line ?? null,
        rootProperties: properties,
        stringAnchors: stringAnchors(functionPath),
      };
    });
  }

  return {
    name,
    bytes: Buffer.byteLength(source),
    lines: source.split(/\r?\n/).length,
    declarations,
    runtimePluginArray: runtimePlugins?.id ?? null,
    plugins,
  };
}

async function inventoryAssets() {
  const assetRoot = path.join(referenceRoot, "assets");
  const names = (await fs.readdir(assetRoot)).sort((left, right) => left.localeCompare(right));
  const files = [];
  const byExtension = {};
  let totalBytes = 0;

  for (const name of names) {
    const filePath = path.join(assetRoot, name);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    const contents = await fs.readFile(filePath);
    const extension = path.extname(name).toLowerCase() || "[none]";
    totalBytes += stat.size;
    byExtension[extension] = (byExtension[extension] ?? 0) + 1;
    files.push({
      path: `assets/${name}`,
      bytes: stat.size,
      sha256: sha256(contents),
    });
  }

  return {
    root: "reference/assets",
    fileCount: files.length,
    totalBytes,
    byExtension: Object.fromEntries(
      Object.entries(byExtension).sort((left, right) => right[1] - left[1]),
    ),
    files,
  };
}

function markdownRuntimeMap(bundleAnalysis, assetInventory) {
  const webgl = bundleAnalysis.find((bundle) => bundle.name.startsWith("webgl."));
  const rows = (webgl?.plugins ?? [])
    .map(
      (plugin) =>
        `| ${plugin.index + 1} | \`${plugin.inferredName}\` | ${plugin.startLine}-${plugin.endLine} | ${plugin.rootProperties.map((value) => `\`${value}\``).join(", ") || "-"} |`,
    )
    .join("\n");

  return `# DATAB-EACH recovered runtime map

This map is generated from the authoritative production ESM chunks. Line ranges refer to the
readable files in \`vendor\`. High-confidence engine and Vue component symbols receive
scope-safe names; all other compiler aliases remain untouched.

## Runtime boundaries

| Order | Recovered subsystem | WebGL lines | Root contracts |
| ---: | --- | ---: | --- |
${rows}

## Build inventory

- Engine: Three.js r150 (pinned as \`three@0.150.1\`)
- Runtime chunks: ${bundleAnalysis.length}
- Canonical game assets: ${assetInventory.fileCount}
- Canonical asset bytes: ${assetInventory.totalBytes}
- Source strategy: scope-safe AST recovery with generated source maps
- Fidelity rule: the recovered runtime remains active until each extracted subsystem passes the
  same browser journey against the authoritative build.
`;
}

await fs.mkdir(analysisRoot, { recursive: true });

const bundleAnalysis = [];
for (const name of bundles) {
  const source = await fs.readFile(path.join(vendorRoot, name), "utf8");
  bundleAnalysis.push(analyzeBundle(name, source));
}

const assetInventory = await inventoryAssets();
await fs.writeFile(
  path.join(analysisRoot, "module-inventory.json"),
  `${JSON.stringify({ format: "datab-each-runtime-inventory-v1", bundles: bundleAnalysis }, null, 2)}\n`,
  "utf8",
);
await fs.writeFile(
  path.join(analysisRoot, "asset-inventory.json"),
  `${JSON.stringify({ format: "datab-each-asset-inventory-v1", ...assetInventory }, null, 2)}\n`,
  "utf8",
);
await fs.writeFile(
  path.join(analysisRoot, "runtime-map.md"),
  markdownRuntimeMap(bundleAnalysis, assetInventory),
  "utf8",
);

const webgl = bundleAnalysis.find((bundle) => bundle.name.startsWith("webgl."));
console.log(
  `Mapped ${webgl?.plugins.length ?? 0} runtime plugins and hashed ${assetInventory.fileCount} canonical assets.`,
);
