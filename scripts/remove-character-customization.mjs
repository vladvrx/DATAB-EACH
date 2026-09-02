import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const referenceRoot = path.join(projectRoot, "reference");
const assetsRoot = path.join(referenceRoot, "assets");
const vendorPath = path.join(
  assetsRoot,
  "vendor.75f6e6ae65453426.js",
);
const logicalMapPath = path.join(
  referenceRoot,
  ".gltf",
  "logical-to-hashed.json",
);
const itemAssetPattern = /^item-(?:Head|Body|Bottom)-/i;
const retiredLogoFiles = new Set([
  "Asset_DataBeach.e8c2b2cb65453426.glb",
  "Asset_LogoMM.081e9f3265453426.glb",
  "Asset_StandDataBeach.9ccfc6f365453426.glb",
]);
const retiredLogicalModels = new Set([
  "/blender/Exports/Asset_DataBeach.glb",
  "/blender/Exports/Asset_LogoMM.glb",
  "/blender/Exports/Asset_StandDataBeach.glb",
]);

const removedAssets = removeRetiredAssets();
const removedNpcFields = removeNpcCustomization();
writeJson(path.join(assetsRoot, "items_en.json"), {});
patchRuntimeBundle();
patchBootPage(path.join(referenceRoot, "index.html"));
patchBootPage(path.join(referenceRoot, "reference.html"));
const logicalMap = removeLogicalModelReferences();
syncManifest(logicalMap);
syncInventory(path.join(projectRoot, "public", "inventory.json"), logicalMap);
syncInventory(path.join(projectRoot, "src", "data", "inventory.json"), logicalMap);

console.log(
  [
    `Deleted customization thumbnail assets: ${removedAssets.itemCount}`,
    `Removed NPC customization fields: ${removedNpcFields}`,
    `Deleted retired logo models: ${removedAssets.logoCount}`,
    "Kept the five character color choices and removed the other customization controls.",
  ].join("\n"),
);

function removeRetiredAssets() {
  let removedItemCount = 0;
  let removedLogoCount = 0;
  for (const entry of fs.readdirSync(assetsRoot, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const isItemAsset = itemAssetPattern.test(entry.name);
    const isRetiredLogo = retiredLogoFiles.has(entry.name);
    if (!isItemAsset && !isRetiredLogo) continue;

    const target = path.resolve(assetsRoot, entry.name);
    assertInside(target, assetsRoot);
    fs.rmSync(target);
    if (isItemAsset) removedItemCount += 1;
    if (isRetiredLogo) removedLogoCount += 1;
  }
  return { itemCount: removedItemCount, logoCount: removedLogoCount };
}

function removeNpcCustomization() {
  const charactersPath = path.join(assetsRoot, "characters_en.json");
  const characters = readJson(charactersPath);
  let removedFieldCount = 0;
  for (const npc of Object.values(characters.npcs || {})) {
    for (const field of ["head", "body", "bottom"]) {
      if (!Object.hasOwn(npc, field)) continue;
      delete npc[field];
      removedFieldCount += 1;
    }
  }
  writeJson(charactersPath, characters);
  return removedFieldCount;
}

function patchRuntimeBundle() {
  let source = fs.readFileSync(vendorPath, "utf8");

  source = replaceOnceOrAlready(
    source,
    'ub={color:0,face:0,head:0,body:0,bottom:0}',
    'ub={color:0,face:0}',
    "player customization save schema",
  );
  source = replaceOnceOrAlready(
    source,
    'cv.$items.head[o.head]||(o.head=cv.$items.headDefault),cv.$items.body[o.body]||(o.body=cv.$items.bodyDefault),cv.$items.bottom[o.bottom]||(o.bottom=cv.$items.bottomDefault),o.face=lb(0|o.face,0,1);',
    'o.head=o.body=o.bottom=null,o.face=0;',
    "player accessory normalization",
  );
  source = replaceOnceOrAlready(
    source,
    'l=yt(!0),c=["head","body","bottom"],h=',
    'l=yt(!0),c=[],h=',
    "customization selector list",
  );
  source = replaceOnceOrAlready(
    source,
    "this.logo=this.add(LU),",
    "this.logo=null,",
    "retired intro logo component",
  );
  source = replaceOnceOrAlready(
    source,
    'rn("div",iH,[rn("div",nH,',
    'false&&rn("div",iH,[rn("div",nH,',
    "face selector",
  );
  source = replaceOnceOrAlready(
    source,
    'on(lH,{onUpdateColor:g,onUpdateGender:v})',
    'on(lH,{onUpdateColor:g})',
    "face update binding",
  );
  source = replaceOnceOrAlready(
    source,
    'on(l_,{"aria-label":e.$l("arialabel.random"),class:"button",action:"random",onClick:_},null,8,["aria-label"]),',
    'false&&on(l_,{"aria-label":e.$l("arialabel.random"),class:"button",action:"random",onClick:_},null,8,["aria-label"]),',
    "randomize button",
  );

  source = source.replace(
    /function v\(e\)\{cv\.\$savestate\.game\.player\.face=[\s\S]*?\}async function b\(e,t,s\)\{[\s\S]*?\}function y\(e\)/,
    "function v(){}async function b(){}function y(e)",
  );
  source = source.replace(
    /function _\(\)\{const e=Math\.floor\(Math\.random\(\)\*f\.head\.length\);[\s\S]*?\}return Rs/,
    "function _(){}return Rs",
  );

  source = source.replace(
    /,"\.\/images\/icons-(?:64|128|256)-assets\/item-(?:Head|Body|Bottom)-[^"]+":"\/assets\/item-(?:Head|Body|Bottom)-[^"]+"/gi,
    "",
  );

  for (const file of retiredLogoFiles) {
    source = source.replaceAll(`"/assets/${file}"`, '""');
  }
  for (const logicalName of retiredLogicalModels) {
    const escapedName = escapeRegExp(logicalName);
    source = source.replace(
      new RegExp(`,"${escapedName}":[A-Za-z_$][\\w$]*`, "g"),
      "",
    );
  }

  fs.writeFileSync(vendorPath, source, "utf8");
}

function patchBootPage(file) {
  if (!fs.existsSync(file)) return;
  let source = fs.readFileSync(file, "utf8");
  source = source.replace(
    "Click here to customize your&nbsp;character&nbsp;appearance.",
    "Click here to change your alien color.",
  );
  source = source.replace(
    "<strong>Adjust your style by swiping the accessories unlocked with your Data B-each Points.</strong>",
    "<strong>Choose your alien color.</strong>",
  );
  source = source.replace(
    "<strong>Complete quests to earn Data B-each Points. Go to the customization menu to unlock new accessories!</strong>",
    "<strong>Complete quests to earn Data B-each Points.</strong>",
  );

  const retiredUiScript = `<script id="databeach-retired-customization-ui">
    (() => {
      const removeRetiredControls = (root = document) => {
        const removePhoneEntry = (element) => {
          const entry =
            element.closest("li.nav-item") ||
            element.closest(".icons > div") ||
            element;
          entry.remove();
        };
        const retiredPhoneLabels = ["Accessories", "Fintechs", "Customization"];
        for (const label of retiredPhoneLabels) {
          root
            .querySelectorAll?.('button[aria-label="' + label + '"]')
            .forEach(removePhoneEntry);
          root
            .querySelectorAll?.('img[alt="' + label + '"]')
            .forEach(removePhoneEntry);
        }
        root
          .querySelectorAll?.('img[alt="Customize"]')
          .forEach(removePhoneEntry);
      };
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) removeRetiredControls(node);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
      addEventListener("DOMContentLoaded", () => removeRetiredControls());
    })();
  </script>`;
  const existingBlock = /<script id="databeach-retired-customization-ui">[\s\S]*?<\/script>/;
  if (existingBlock.test(source)) source = source.replace(existingBlock, retiredUiScript);
  else source = source.replace("</body>", `${retiredUiScript}\n</body>`);

  const twoTabStyle = `<style id="databeach-two-tab-phone">
    .phone-navigation[data-v-ad29435e] {
      left: calc(50% - (62px * var(--phone-scale)));
      width: calc(124px * var(--phone-scale));
      margin: calc(20px * var(--phone-scale)) 0 0;
    }
    .nav[data-v-ad29435e] {
      justify-content: center;
    }
    .nav-items[data-v-ad29435e] {
      justify-content: center;
      width: auto;
      gap: calc(18px * var(--phone-scale));
    }
    .icons[data-v-3d9fa6fd] {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .65em;
    }
    .icons[data-v-3d9fa6fd] > div {
      position: relative;
      width: 2em;
      align-self: center;
      justify-self: auto;
    }
  </style>`;
  const existingStyle = /<style id="databeach-two-tab-phone">[\s\S]*?<\/style>/;
  if (existingStyle.test(source)) source = source.replace(existingStyle, twoTabStyle);
  else source = source.replace("</body>", `${twoTabStyle}\n</body>`);
  fs.writeFileSync(file, source, "utf8");
}

function removeLogicalModelReferences() {
  const logicalMap = readJson(logicalMapPath);
  for (const logicalName of retiredLogicalModels) delete logicalMap[logicalName];
  writeJson(logicalMapPath, logicalMap);
  return logicalMap;
}

function syncManifest(logicalMap) {
  const manifestPath = path.join(referenceRoot, "MANIFEST.json");
  const manifest = readJson(manifestPath);
  manifest.files = (manifest.files || []).filter((entry) => {
    if (!entry.local) return true;
    const localPath = path.resolve(referenceRoot, entry.local);
    assertInside(localPath, referenceRoot);
    if (!fs.existsSync(localPath)) return false;
    entry.bytes = fs.statSync(localPath).size;
    return true;
  });
  manifest.hosted_files = manifest.files.length;
  manifest.hosted_bytes = manifest.files.reduce(
    (total, entry) => total + (entry.bytes || 0),
    0,
  );
  manifest.blender_logical_files = Object.keys(logicalMap).length;
  writeJson(manifestPath, manifest);
}

function syncInventory(inventoryPath, logicalMap) {
  const inventory = readJson(inventoryPath);
  inventory.files = (inventory.files || []).filter((entry) => {
    const relativePath = entry.path === "/" ? "index.html" : entry.path.replace(/^\//, "");
    const localPath = path.resolve(referenceRoot, relativePath);
    assertInside(localPath, referenceRoot);
    if (!fs.existsSync(localPath)) return false;
    const contents = fs.readFileSync(localPath);
    entry.bytes = contents.length;
    entry.gzip_bytes = gzipSync(contents).length;
    return true;
  });

  inventory.totals = {
    ...(inventory.totals || {}),
    candidates: inventory.files.length,
    real_files: inventory.files.length,
    spa_fallbacks: 0,
    failed: 0,
    bytes: sum(inventory.files, "bytes"),
    gzip_bytes: sum(inventory.files, "gzip_bytes"),
  };
  inventory.by_category = groupStats(inventory.files, (entry) => entry.category);
  inventory.by_extension = groupStats(inventory.files, (entry) => {
    if (entry.path === "/") return "html";
    return path.extname(entry.path).slice(1).toLowerCase();
  });
  inventory.by_dump_bucket = groupStats(
    inventory.files,
    (entry) => entry.dump_bucket,
  );
  inventory.blender_export_key_count = Object.keys(logicalMap).length;
  inventory.blender_export_keys_sample = (
    inventory.blender_export_keys_sample || []
  ).filter((key) => !retiredLogicalModels.has(key));
  inventory.unhashed_aliases = (inventory.unhashed_aliases || []).filter(
    (alias) =>
      ![...retiredLogoFiles].some((file) =>
        JSON.stringify(alias).includes(file),
      ),
  );
  inventory.unhashed_alias_count = inventory.unhashed_aliases.length;
  writeJson(inventoryPath, inventory);
}

function groupStats(files, keyFor) {
  const grouped = {};
  for (const entry of files) {
    const key = keyFor(entry);
    if (!key) continue;
    grouped[key] ||= { files: 0, bytes: 0, gzip_bytes: 0 };
    grouped[key].files += 1;
    grouped[key].bytes += entry.bytes || 0;
    grouped[key].gzip_bytes += entry.gzip_bytes || 0;
  }
  return grouped;
}

function sum(entries, field) {
  return entries.reduce((total, entry) => total + (entry[field] || 0), 0);
}

function replaceOnceOrAlready(source, before, after, label) {
  if (source.includes(after)) return source;
  const matches = source.split(before).length - 1;
  if (matches !== 1) {
    throw new Error(`Expected one ${label} pattern in the runtime bundle; found ${matches}.`);
  }
  return source.replace(before, after);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertInside(target, root) {
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(root);
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(`Refusing to modify path outside ${resolvedRoot}: ${resolvedTarget}`);
  }
}
