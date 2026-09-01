export type DumpFolder = {
  name: string;
  path: string;
  mapsTo: string;
  inHostedTotal: boolean;
  summary: string;
};

export const DUMP_FOLDERS: DumpFolder[] = [
  {
    name: "assets",
    path: "three-rescue-2026-09-01/assets",
    mapsTo: "/assets/ on the live origin",
    inHostedTotal: true,
    summary:
      "This is the game. 1,294 hosted files, 29.69 MiB: 12 audio files, 339 GLBs, terrain PNGs, WebP/AVIF sets, vendor/main/webgl JS, fonts, locale JSON, and hashed sprites.",
  },
  {
    name: "icons",
    path: "three-rescue-2026-09-01/icons",
    mapsTo: "/icons/ plus /favicon.ico",
    inHostedTotal: true,
    summary:
      "PWA and favicon set: favicon_dark.svg, favicon_light.svg, icon_180.png, icon_192.png, icon_512.png, and favicon.ico. About 0.43 MiB.",
  },
  {
    name: "oldBrowser",
    path: "three-rescue-2026-09-01/oldBrowser",
    mapsTo: "/oldBrowser/oldBrowser.jpg",
    inHostedTotal: true,
    summary: "One JPEG (56 KB) shown when the device or browser is too old.",
  },
  {
    name: "embedded",
    path: "three-rescue-2026-09-01/embedded",
    mapsTo: "data: URLs inside the HTML/CSS, not separate hosted files",
    inHostedTotal: false,
    summary:
      "Inline SVGs and other data-URLs pulled out of index.html. They already sit inside the 150,450-byte HTML document. Counting them again would double-count.",
  },
  {
    name: "_external",
    path: "three-rescue-2026-09-01/_external",
    mapsTo: "other domains, not coastalworld.merci-michel.com",
    inHostedTotal: false,
    summary:
      "Cookie Law (cdn.cookielaw.org), Google Tag Manager, reCAPTCHA, YouTube embeds/thumbnails, coastalbank.com legal pages, and merci-michel.com. Those are not part of the 31.53 MiB game payload.",
  },
  {
    name: "MANIFEST.json",
    path: "three-rescue-2026-09-01/MANIFEST.json",
    mapsTo: "dump index written by the rescue tool, not a game URL",
    inHostedTotal: false,
    summary:
      "A listing of what the dump captured. The live game has no file at this path. The game’s own $manifest is a JS mapping from /blender/Exports/* names onto hashed /assets/* files.",
  },
  {
    name: ".gltf",
    path: "three-rescue-2026-09-01/.gltf",
    mapsTo: "logical /blender/Exports/*.glb names — not a hosted folder",
    inHostedTotal: false,
    summary:
      "The JS bundles mention 386 /blender/Exports/ keys (GLBs, scene JSON, splatting PNGs, AO bins). Requesting those URLs returns the SPA HTML fallback (150,450 bytes), not a model. Real meshes are hashed .glb files under /assets/.",
  },
];

export const MISSING_FROM_DUMP_LIST = [
  {
    path: "/vendors/draco/draco_decoder.js",
    bytes: 705939,
    why: "JS Draco fallback. Browsers with WASM skip this and load the .wasm instead.",
  },
  {
    path: "/vendors/draco/draco_decoder.wasm",
    bytes: 280793,
    why: "WASM Draco decoder used in a current browser.",
  },
  {
    path: "/vendors/draco/draco_wasm_wrapper.js",
    bytes: 59024,
    why: "Wrapper that loads the WASM decoder.",
  },
  {
    path: "/share/share_en.png",
    bytes: 231084,
    why: "Open Graph / Twitter share image. Not referenced from the boot JS graph.",
  },
  {
    path: "/",
    bytes: 150450,
    why: "index.html. 150,450 bytes uncompressed, ~32 KB gzipped.",
  },
  {
    path: "/favicon.ico",
    bytes: 31835,
    why: "Root favicon. May live under icons/ in the dump, or may be missing.",
  },
  {
    path: "/manifest.webmanifest",
    bytes: 660,
    why: "PWA manifest listing icon_192 and icon_512.",
  },
  {
    path: "/sitemap.xml",
    bytes: 340,
    why: "Points at coastalworld.com, not extra game assets.",
  },
  {
    path: "/robots.txt",
    bytes: 23,
    why: "Allow-all robots file.",
  },
];

export const RUNTIME_JSON = [
  "/assets/fintechs_en.json",
  "/assets/characters_en.json",
  "/assets/dialogs_en.json",
  "/assets/items_en.json",
  "/assets/quests_en.json",
];
