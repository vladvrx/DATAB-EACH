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
const outputVendor = path.join(projectRoot, "vendor");
const outputStyles = path.join(outputRoot, "styles");

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

const blockedRuntimeTokens = [
  "youtube",
  "ytimg",
  "recaptcha",
  "googletagmanager",
  "cloudfunctions",
  "gtm.js",
  "gtm-",
  "datalayer",
];

const runtimeAssetPrefixes = new Map([
  ["/assets/", "./reference/assets/"],
  ["/embedded/", "./reference/embedded/"],
  ["/icons/", "./reference/icons/"],
  ["/oldBrowser/", "./reference/oldBrowser/"],
  ["/share/", "./reference/share/"],
  ["/vendors/", "./reference/vendors/"],
]);

function replacementExpression(source) {
  const replacement = parse(`const replacement = ${source};`, { sourceType: "module" });
  return replacement.program.body[0].declarations[0].init;
}

function namedPlugin(pathRef, name) {
  if (!pathRef.isArrayExpression()) return false;
  const [nameNode, factoryNode] = pathRef.node.elements;
  return (
    types.isStringLiteral(nameNode, { value: name }) &&
    (types.isFunctionExpression(factoryNode) || types.isArrowFunctionExpression(factoryNode))
  );
}

function replaceNamedPlugin(ast, name, factorySource) {
  const replacement = replacementExpression(factorySource);
  let replacements = 0;
  traverse(ast, {
    ArrayExpression(pluginPath) {
      if (!namedPlugin(pluginPath, name)) return;
      pluginPath.get("elements")[1].replaceWith(types.cloneNode(replacement, true));
      replacements += 1;
      pluginPath.skip();
    },
  });
  if (replacements !== 1) {
    throw new Error(`Expected one ${name} plugin, found ${replacements}`);
  }
}

function removeNamedPlugin(ast, name) {
  let removals = 0;
  traverse(ast, {
    ArrayExpression(pluginPath) {
      if (!namedPlugin(pluginPath, name)) return;
      if (pluginPath.listKey !== "elements" || !pluginPath.parentPath.isArrayExpression()) {
        throw new Error(`${name} plugin is not inside the runtime plugin list`);
      }
      pluginPath.remove();
      removals += 1;
    },
  });
  if (removals !== 1) throw new Error(`Expected one ${name} plugin, found ${removals}`);
}

function removeRecaptchaIntegration(ast) {
  const offlineRecaptcha = replacementExpression(`({
    load: async function loadOfflineVerification() {},
    token: async function getOfflineVerificationToken() {
      return { token: null, error: "offline" };
    }
  })`);
  const obsoleteBindings = new Set([
    "Cb",
    "Pb",
    "Tb",
    "Eb",
    "Bb",
    "Ib",
    "kb",
    "Db",
    "Lb",
    "Ob",
    "Rb",
    "zb",
  ]);
  const removedBindings = new Set();
  let stubbedInterface = 0;
  let removedCallback = 0;

  traverse(ast, {
    VariableDeclarator(variablePath) {
      if (!variablePath.scope.path.isProgram() || !types.isIdentifier(variablePath.node.id)) return;
      const { name } = variablePath.node.id;
      if (name === "Nb") {
        variablePath.get("init").replaceWith(types.cloneNode(offlineRecaptcha, true));
        stubbedInterface += 1;
      } else if (obsoleteBindings.has(name)) {
        removedBindings.add(name);
        variablePath.remove();
      }
    },
    FunctionDeclaration(functionPath) {
      const name = functionPath.node.id?.name;
      if (!name || !functionPath.scope.parent?.path.isProgram() || !obsoleteBindings.has(name)) return;
      removedBindings.add(name);
      functionPath.remove();
    },
    ExpressionStatement(statementPath) {
      const expression = statementPath.node.expression;
      if (
        types.isAssignmentExpression(expression) &&
        types.isMemberExpression(expression.left) &&
        types.isIdentifier(expression.left.object, { name: "window" }) &&
        types.isIdentifier(expression.left.property, { name: "_onRecaptchaLoaded" })
      ) {
        statementPath.remove();
        removedCallback += 1;
      }
    },
  });

  if (stubbedInterface !== 1 || removedCallback !== 1) {
    throw new Error("The remote verification interface did not match the expected runtime shape");
  }
  for (const name of obsoleteBindings) {
    if (!removedBindings.has(name)) throw new Error(`Remote verification binding ${name} was not removed`);
  }
}

function removeVendorOnlineServices(ast) {
  replaceNamedPlugin(
    ast,
    "analytics",
    `function offlineAnalyticsPlugin() {
      const callbacks = new Set();
      const analytics = {
        type: "NONE",
        init() {},
        enable() {},
        disable() {},
        pageview() {},
        event() {},
        rawEvent() {},
        beforeEventSend(callback) {
          if (typeof callback !== "function") return function noop() {};
          callbacks.add(callback);
          return function removeCallback() { callbacks.delete(callback); };
        },
        onEventSent: null
      };
      return function installOfflineAnalytics(app) {
        app.config.globalProperties.$analytics = analytics;
        app.provide("analytics", analytics);
      };
    }`,
  );
  removeNamedPlugin(ast, "firebaseCF");
  replaceNamedPlugin(
    ast,
    "api",
    `function offlineApiPlugin() {
      const offlineError = { error: "offline", status: "offline" };
      const api = {
        load: async function loadOfflineSave(token) {
          return token ? { ...offlineError } : false;
        },
        save: async function saveLocallyOnly() { return false; },
        enroll: async function disableRemoteEnrollment() {
          return { success: false, ...offlineError };
        },
        auth: async function disableRemoteAuthentication() {
          return { ...offlineError };
        }
      };
      return function installOfflineApi(app) {
        app.config.globalProperties.$api = api;
        app.provide("api", api);
      };
    }`,
  );
  removeRecaptchaIntegration(ast);
  const obsoleteSupportBindings = new Set([
    "Pc",
    "Tc",
    "Ec",
    "Bc",
    "Ic",
    "kc",
    "Dc",
    "Lc",
    "Oc",
    "Rc",
    "zc",
    "Nc",
    "Fc",
  ]);
  const removedSupportBindings = new Set();
  let removedDataLayerInitializer = 0;
  traverse(ast, {
    VariableDeclarator(variablePath) {
      if (
        variablePath.scope.path.isProgram() &&
        types.isIdentifier(variablePath.node.id) &&
        obsoleteSupportBindings.has(variablePath.node.id.name)
      ) {
        removedSupportBindings.add(variablePath.node.id.name);
        variablePath.remove();
      }
    },
    FunctionDeclaration(functionPath) {
      const name = functionPath.node.id?.name;
      if (
        name &&
        functionPath.scope.parent?.path.isProgram() &&
        obsoleteSupportBindings.has(name)
      ) {
        removedSupportBindings.add(name);
        functionPath.remove();
      }
    },
    ExpressionStatement(statementPath) {
      const expression = statementPath.node.expression;
      if (
        types.isAssignmentExpression(expression) &&
        types.isMemberExpression(expression.left) &&
        types.isIdentifier(expression.left.object, { name: "Tc" }) &&
        types.isIdentifier(expression.left.property, { name: "dataLayer" })
      ) {
        statementPath.remove();
        removedDataLayerInitializer += 1;
      }
    },
  });
  for (const name of obsoleteSupportBindings) {
    if (!removedSupportBindings.has(name)) {
      throw new Error(`Online service support binding ${name} was not removed`);
    }
  }
  if (removedDataLayerInitializer !== 1) {
    throw new Error("The analytics queue initializer was not removed");
  }
}

function removeWebglOnlineVideo(ast) {
  let replacements = 0;
  traverse(ast, {
    FunctionDeclaration(functionPath) {
      let handlesOnlineVideo = false;
      functionPath.traverse({
        StringLiteral(stringPath) {
          if (["youtube.com", "youtu.be"].includes(stringPath.node.value)) {
            handlesOnlineVideo = true;
            stringPath.stop();
          }
        },
      });
      if (!handlesOnlineVideo) return;
      functionPath.node.body = types.blockStatement([]);
      replacements += 1;
      functionPath.skip();
    },
  });
  if (replacements !== 1) {
    throw new Error(`Expected one online dialog video handler, found ${replacements}`);
  }
}

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

function replaceVueComponentSetup(ast, oldName, newName) {
  const offlineSetup = replacementExpression(`function offlineVideoSetup() {
    return function renderOfflineVideo() { return null; };
  }`);
  let replacements = 0;

  traverse(ast, {
    VariableDeclarator(variablePath) {
      if (!variablePath.scope.path.isProgram()) return;
      const object = componentObject(variablePath.node.init);
      if (!object || componentName(variablePath.node.init) !== oldName) return;
      const nameProperty = object.properties.find(
        (property) =>
          types.isObjectProperty(property) &&
          !property.computed &&
          types.isIdentifier(property.key, { name: "__name" }),
      );
      const setupIndex = object.properties.findIndex(
        (property) =>
          (types.isObjectMethod(property) || types.isObjectProperty(property)) &&
          !property.computed &&
          types.isIdentifier(property.key, { name: "setup" }),
      );
      if (!nameProperty || setupIndex < 0) {
        throw new Error(`${oldName} component does not have the expected setup method`);
      }
      nameProperty.value = types.stringLiteral(newName);
      object.properties[setupIndex] = types.objectProperty(
        types.identifier("setup"),
        types.cloneNode(offlineSetup, true),
      );
      replacements += 1;
    },
  });

  if (replacements !== 1) {
    throw new Error(`Expected one ${oldName} component, found ${replacements}`);
  }
}

function removeMainOnlineVideo(ast) {
  replaceVueComponentSetup(ast, "PartnerVideo", "OfflineArticleVideoPlaceholder");
  replaceVueComponentSetup(ast, "YoutubePlayer", "OfflineFullscreenVideoPlaceholder");
  const obsoleteBindings = new Set(["ic", "sc"]);
  const removedBindings = new Set();

  traverse(ast, {
    VariableDeclarator(variablePath) {
      if (
        variablePath.scope.path.isProgram() &&
        types.isIdentifier(variablePath.node.id) &&
        obsoleteBindings.has(variablePath.node.id.name)
      ) {
        removedBindings.add(variablePath.node.id.name);
        variablePath.remove();
      }
    },
    FunctionDeclaration(functionPath) {
      const name = functionPath.node.id?.name;
      if (name && functionPath.scope.parent?.path.isProgram() && obsoleteBindings.has(name)) {
        removedBindings.add(name);
        functionPath.remove();
      }
    },
  });

  for (const name of obsoleteBindings) {
    if (!removedBindings.has(name)) throw new Error(`Online video binding ${name} was not removed`);
  }
}

function makeRuntimeAssetPathRelative(value) {
  let relativeValue = value;
  for (const [absolutePrefix, relativePrefix] of runtimeAssetPrefixes) {
    relativeValue = relativeValue.replaceAll(absolutePrefix, relativePrefix);
  }
  return relativeValue;
}

function rewriteRuntimeAssetPaths(ast) {
  traverse(ast, {
    StringLiteral(stringPath) {
      const relativeValue = makeRuntimeAssetPathRelative(stringPath.node.value);
      if (relativeValue !== stringPath.node.value) stringPath.node.value = relativeValue;
    },
    TemplateElement(templatePath) {
      const cooked = templatePath.node.value.cooked;
      const raw = templatePath.node.value.raw;
      if (cooked) templatePath.node.value.cooked = makeRuntimeAssetPathRelative(cooked);
      if (raw) templatePath.node.value.raw = makeRuntimeAssetPathRelative(raw);
    },
  });
}

function assertNoBlockedRuntimeTokens(value, name) {
  const lower = value.toLowerCase();
  const match = blockedRuntimeTokens.find((token) => lower.includes(token));
  if (match) throw new Error(`${name} still contains blocked runtime token ${match}`);
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
  if (name.startsWith("vendor.")) removeVendorOnlineServices(ast);
  if (name.startsWith("main.")) removeMainOnlineVideo(ast);
  if (name.startsWith("webgl.")) {
    removeWebglOnlineVideo(ast);
    recoverWebglSymbols(ast);
  }
  rewriteRuntimeAssetPaths(ast);
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
      shouldPrintComment: (comment) => !comment.includes("http://") && !comment.includes("https://"),
      sourceFileName: `reference/assets/${name}`,
      sourceMaps: true,
    },
    source,
  );
  const code = `${result.code}\n//# sourceMappingURL=${mapName}\n`;
  assertNoBlockedRuntimeTokens(code, name);
  const map = { ...result.map, file: name };
  delete map.sourcesContent;

  await fs.writeFile(path.join(outputVendor, name), code, "utf8");
  await fs.writeFile(path.join(outputVendor, mapName), `${JSON.stringify(map)}\n`, "utf8");

  return {
    name,
    sourceBytes: Buffer.byteLength(source),
    recoveredBytes: Buffer.byteLength(code),
    sourceSha256: sha256(source),
    recoveredSha256: sha256(code),
    sourceMap: `../vendor/${mapName}`,
    recoveredVueComponents,
  };
}

function makeStylesheetAssetPathsRelative(value) {
  return value
    .replaceAll("/assets/", "../../reference/assets/")
    .replaceAll("/embedded/", "../../reference/embedded/")
    .replaceAll("/icons/", "../../reference/icons/")
    .replaceAll("/oldBrowser/", "../../reference/oldBrowser/")
    .replaceAll("/share/", "../../reference/share/")
    .replaceAll("/vendors/", "../../reference/vendors/");
}

function formatCss(source) {
  let output = "";
  let indent = 0;
  let quote = null;
  let inComment = false;
  let parentheses = 0;
  let pendingSpace = false;
  const indentation = () => "  ".repeat(indent);

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (inComment) {
      output += character;
      if (character === "*" && next === "/") {
        output += next;
        index += 1;
        inComment = false;
      }
      continue;
    }
    if (quote) {
      output += character;
      if (character === "\\") {
        output += next ?? "";
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && next === "*") {
      if (pendingSpace && output && !output.endsWith("\n")) output += " ";
      pendingSpace = false;
      output += "/*";
      index += 1;
      inComment = true;
      continue;
    }
    if (character === '"' || character === "'") {
      if (pendingSpace && output && !output.endsWith("\n")) output += " ";
      pendingSpace = false;
      quote = character;
      output += character;
      continue;
    }
    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }
    if (pendingSpace && output && !output.endsWith("\n") && !"{};,:()".includes(character)) {
      output += " ";
    }
    pendingSpace = false;

    if (character === "(") parentheses += 1;
    if (character === ")") parentheses = Math.max(0, parentheses - 1);

    if (parentheses === 0 && character === "{") {
      output = output.trimEnd();
      output += " {\n" + indentation() + "  ";
      indent += 1;
    } else if (parentheses === 0 && character === "}") {
      output = output.trimEnd();
      indent = Math.max(0, indent - 1);
      output += `\n${indentation()}}\n\n${indentation()}`;
    } else if (parentheses === 0 && character === ";") {
      output += `;\n${indentation()}`;
    } else if (parentheses === 0 && character === "," && indent === 0) {
      output += `,\n${indentation()}`;
    } else {
      output += character;
    }
  }

  return `${output.trim()}\n`;
}

function gameHtml(baseHref) {
  return `<!doctype html>
<html lang="en" class="no-js">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; base-uri 'self'; connect-src 'self'; font-src 'self' data:; frame-src 'none'; img-src 'self' data: blob:; media-src 'self' data: blob:; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:">
    <base href="${baseHref}">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover">
    <meta name="theme-color" content="#05051a">
    <meta name="application-name" content="glorb">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <meta name="description" content="Explore the islands, restore their systems, and complete quests.">
    <meta property="og:type" content="website">
    <meta property="og:title" content="glorb">
    <meta property="og:description" content="Explore the islands, restore their systems, and complete quests.">
    <meta property="og:image" content="./reference/share/share_en.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="./reference/share/share_en.png">
    <title>glorb</title>
    <link rel="icon" type="image/png" href="./reference/assets/databeach-logo.png?v=glorb">
    <link rel="apple-touch-icon" href="./reference/assets/databeach-logo.png?v=glorb">
    <link rel="stylesheet" href="./reference/assets/vendor.a83843c365453426.css">
    <link rel="stylesheet" href="./direct-port/styles/recovered-game.css">
    <link rel="stylesheet" href="./reference/assets/game-cursor.css">
    <link rel="stylesheet" href="./direct-port/styles/direct-port-ui.css">
    <link rel="modulepreload" href="./vendor/main.35e6243a65453426.js">
    <link rel="modulepreload" href="./vendor/webgl.3250e36a65453426.js">
  </head>
  <body>
    <aside id="preloader" aria-live="polite">
      <img class="logo" src="./reference/assets/databeach-logo.png?v=glorb" alt="glorb">
      <p class="preloader-counter">0</p>
      <div class="preloader-baseline"><div class="preloader-spinner"></div></div>
      <figure class="preloader-foreground"></figure>
      <canvas class="waves"></canvas>
    </aside>
    <div id="app"></div>
    <noscript>This game requires JavaScript.</noscript>
    <script type="module">
      import { startGame } from "./direct-port/src/bootstrap.js";

      startGame().catch((error) => {
        console.error("glorb could not start", error);
        document.documentElement.classList.add("game-start-failed");
        const counter = document.querySelector(".preloader-counter");
        if (counter) counter.textContent = "START ERROR";
      });
    </script>
  </body>
</html>
`;
}

async function recoverIndex() {
  const source = await fs.readFile(path.join(referenceRoot, "index.html"), "utf8");
  const styles = [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n")
    .replace(/\.grecaptcha-badge\s*\{[^}]*\}/gi, "");
  const recoveredStyles = formatCss(makeStylesheetAssetPathsRelative(styles));
  const directPortHtml = gameHtml("../");
  const rootHtml = gameHtml("./");

  assertNoBlockedRuntimeTokens(recoveredStyles, "recovered-game.css");
  assertNoBlockedRuntimeTokens(directPortHtml, "direct-port/index.html");
  assertNoBlockedRuntimeTokens(rootHtml, "index.html");
  for (const [name, html] of [["direct-port/index.html", directPortHtml], ["index.html", rootHtml]]) {
    if (/(?:src|href)=["']\//i.test(html) || /url\(\s*["']?\//i.test(html)) {
      throw new Error(`${name} contains a root-absolute asset path`);
    }
  }

  await fs.mkdir(outputStyles, { recursive: true });
  await fs.writeFile(path.join(outputStyles, "recovered-game.css"), recoveredStyles, "utf8");
  await fs.writeFile(path.join(outputRoot, "index.html"), directPortHtml, "utf8");
  await fs.writeFile(path.join(projectRoot, "index.html"), rootHtml, "utf8");
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
  data.project.url = "./";
  data.project.origin = "";
  data.project.basepath = "./";
  data.page.route.url = "./";
  data.site.menu.islandlink = "#";
  const dataDirectory = path.join(outputRoot, "data");
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(path.join(dataDirectory, "site.json"), `${JSON.stringify(data, null, 2)}\n`);
}

await fs.mkdir(outputVendor, { recursive: true });
const recoveredBundles = [];
for (const bundle of bundles) {
  console.log(`Recovering ${bundle}`);
  recoveredBundles.push(await recoverBundle(bundle));
}

const staleAssetsDirectory = path.join(outputRoot, "assets");
for (const bundle of bundles) {
  await fs.rm(path.join(staleAssetsDirectory, bundle), { force: true });
  await fs.rm(path.join(staleAssetsDirectory, `${bundle}.map`), { force: true });
}
await fs.rmdir(staleAssetsDirectory).catch((error) => {
  if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
});

await recoverIndex();
await extractSiteData();

const manifest = {
  format: "datab-each-direct-port-v2",
  sourceBuild: "20250626-165126",
  engine: "three.js",
  engineRevision: 150,
  basePath: "./",
  entryPoint: "../index.html",
  mounts: ["/", "/three-port/"],
  vendorDirectory: "../vendor",
  sourceStrategy: "Scope-safe AST recovery from the authoritative ESM production chunks",
  recoveredSymbols: Object.values(webglSymbolNames),
  sharedAssetRoot: "../reference",
  offlineRuntime: true,
  bundles: recoveredBundles,
};
await fs.writeFile(
  path.join(outputRoot, "PORT_MANIFEST.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Direct port written to ${outputRoot}`);
