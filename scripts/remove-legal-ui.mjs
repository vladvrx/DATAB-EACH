#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const assetsDir = path.join(projectRoot, "reference", "assets");
const mainPath = path.join(assetsDir, "main.35e6243a65453426.js");
const vendorPath = path.join(assetsDir, "vendor.75f6e6ae65453426.js");
const htmlPaths = [
  path.join(projectRoot, "reference", "index.html"),
  path.join(projectRoot, "reference", "reference.html"),
];

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Could not uniquely patch ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let main = fs.readFileSync(mainPath, "utf8");
const footerStart = main.indexOf('u("footer",ct,[');
if (footerStart >= 0) {
  const nextMenuLayer = main.indexOf("d(o).$store.isMenuOpen?", footerStart);
  if (nextMenuLayer < 0) throw new Error("Could not find the end of the legal footer");
  const footer = main.slice(footerStart, nextMenuLayer);
  if (
    !footer.includes("menu.privacy") ||
    !footer.includes("menu.terms") ||
    !footer.includes("menu.cookies")
  ) {
    throw new Error("Refusing to remove an unexpected menu section");
  }
  main = main.slice(0, footerStart) + ']),' + main.slice(nextMenuLayer);
} else {
  main = replaceOnce(
    main,
    '["text","tabindex"]))]),d(o).$store.isMenuOpen?',
    '["text","tabindex"]))]),]),d(o).$store.isMenuOpen?',
    "legal footer parent closure",
  );
}
const headerMenuButton =
  ',p(k,{"aria-label":e.$l("arialabel.menu"),icon:"burger","bg-color":"bordered","icon-color":"white",tabindex:i.value?0:-1,onClick:s},null,8,["aria-label","tabindex"])';
if (main.includes(headerMenuButton)) {
  main = main.replace(headerMenuButton, "");
} else if (main.includes('icon:"burger"') || main.includes("arialabel.menu")) {
  throw new Error("Could not safely remove the header menu button");
}

fs.writeFileSync(mainPath, main);

let vendor = fs.readFileSync(vendorPath, "utf8");
const oneTrustPlugin = vendor.indexOf('["onetrust",function()');
if (oneTrustPlugin < 0) throw new Error("Could not locate the OneTrust plugin");

const initStart = vendor.indexOf("init:function(e){", oneTrustPlugin);
if (initStart >= 0) {
  const initEnd = vendor.indexOf(",setCategories:o,cookieSettingsText", initStart);
  if (initEnd < 0) throw new Error("Could not locate the end of OneTrust init");
  vendor = vendor.slice(0, initStart) + "init:function(){}" + vendor.slice(initEnd);
}

const hiddenButtonStart = vendor.indexOf(
  ',n=document.createElement("button");',
  oneTrustPlugin,
);
if (hiddenButtonStart >= 0) {
  const hiddenButtonEnd = vendor.indexOf(";let a=!1", hiddenButtonStart);
  if (hiddenButtonEnd < 0) throw new Error("Could not locate the OneTrust helper button end");
  vendor = vendor.slice(0, hiddenButtonStart) + vendor.slice(hiddenButtonEnd);
}

vendor = replaceOnce(
  vendor,
  'cookieSettingsText:_t("Cookie Settings")',
  'cookieSettingsText:_t("")',
  "cookie settings label",
);
vendor = replaceOnce(
  vendor,
  "e.autoInit&&u()",
  "e.autoInit&&0",
  "analytics auto initialization",
);
fs.writeFileSync(vendorPath, vendor);

const dataMarker = "window.__DATA=JSON.parse('";
for (const htmlPath of htmlPaths) {
  let html = fs.readFileSync(htmlPath, "utf8");
  const dataStart = html.indexOf(dataMarker) + dataMarker.length;
  const dataEnd = html.indexOf("')</script>", dataStart);
  if (dataStart < dataMarker.length || dataEnd < 0) {
    throw new Error(`Could not locate embedded page data in ${htmlPath}`);
  }

  const encodedData = html.slice(dataStart, dataEnd);
  const decodedData = Function(`"use strict";return '${encodedData}'`)();
  const pageData = JSON.parse(decodedData);

  delete pageData.site.cookies;
  if (pageData.site.menu) {
    pageData.site.menu = {
      islandlink: pageData.site.menu.islandlink,
    };
  }

  const json = JSON.stringify(pageData);
  const reencodedData = json.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  html = html.slice(0, dataStart) + reencodedData + html.slice(dataEnd);
  fs.writeFileSync(htmlPath, html);
}

console.log("Removed the legal footer, cookie controls, OneTrust loader, and tracker startup.");
