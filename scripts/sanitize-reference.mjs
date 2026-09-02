import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const referenceRoot = path.join(projectRoot, 'reference');
const assetsRoot = path.join(referenceRoot, 'assets');

const companyNumbers = {
  brigit: 1,
  aspiration: 2,
  aven: 3,
  bluevine: 4,
  greenwood: 5,
  till: 6,
  one: 7,
  pomelo: 8,
  zenda: 9,
  kikoff: 10,
  prosper: 11,
  possible: 12,
  lendingpoint: 13,
  island: 14,
  x1: 15,
  tempkey: 16,
};

const extraLogoNumbers = { albert: 1, clearly: 2, ellevest: 3, movo: 4, sable: 5 };
const oldToNewAsset = new Map();

function collectFiles(folder) {
  const result = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...collectFiles(full));
    else result.push(full);
  }
  return result;
}

function renamedAsset(name) {
  let next = name;
  const partnerMatch = name.match(/^partner-([a-z0-9]+)(-.+)$/i);
  if (partnerMatch) {
    const [, slug, suffix] = partnerMatch;
    const normalized = slug.toLowerCase();
    if (companyNumbers[normalized]) {
      next = `tech-company-${String(companyNumbers[normalized]).padStart(2, '0')}${suffix}`;
    } else if (extraLogoNumbers[normalized]) {
      next = `neutral-logo-${String(extraLogoNumbers[normalized]).padStart(2, '0')}${suffix}`;
    }
  }
  if (/^phone-partner-/i.test(next)) next = next.replace(/^phone-partner-/i, 'phone-tech-company-');
  return next;
}

// Rename branded asset filenames in two passes so no destination can collide.
for (const file of fs.readdirSync(assetsRoot)) {
  const next = renamedAsset(file);
  if (next !== file) oldToNewAsset.set(file, next);
}
for (const [oldName] of oldToNewAsset) {
  const oldPath = path.join(assetsRoot, oldName);
  const tmpPath = path.join(assetsRoot, `.__databeach_rename__${oldName}`);
  fs.renameSync(oldPath, tmpPath);
}
for (const [oldName, newName] of oldToNewAsset) {
  fs.renameSync(path.join(assetsRoot, `.__databeach_rename__${oldName}`), path.join(assetsRoot, newName));
}

const protectedKeys = new Set([
  'id', 'partner', 'partnerID', 'icon', 'item', 'script', 'scene', 'point', 'node', 'next',
  'opts', 'before', 'rewardCondition', 'unlockCondition', 'customPath', 'url', 'ctaUrl', 'video',
]);

const displayReplacements = [
  ['TECH COMPANY #12', 'TECH COMPANY #12'],
  ['Possible', 'TECH COMPANY #12'],
  ['TECH COMPANY #7', 'TECH COMPANY #7'],
  ['GreenFi', 'TECH COMPANY #2'],
  ['OnePay', 'TECH COMPANY #7'],
  ['InComm', 'TECH COMPANY #9'],
  ['LendingPoint', 'TECH COMPANY #13'],
  ['Bluevine', 'TECH COMPANY #4'],
  ['Greenwood', 'TECH COMPANY #5'],
  ['Brigit', 'TECH COMPANY #1'],
  ['Aspiration', 'TECH COMPANY #2'],
  ['Aven', 'TECH COMPANY #3'],
  ['Till', 'TECH COMPANY #6'],
  ['Pomelo', 'TECH COMPANY #8'],
  ['Kikoff', 'TECH COMPANY #10'],
  ['Prosper', 'TECH COMPANY #11'],
  ['TempKey', 'TECH COMPANY #16'],
  ['Data B-each', 'TECH COMPANY #14'],
];

function sanitizeDisplayText(input) {
  let text = input;
  text = text.replace(/Data B-each/gi, 'Data B-each');
  text = text.replace(/DataBeach/g, 'DataBeach');
  text = text.replace(/databeach/gi, 'databeach');
  text = text.replace(/databeach/gi, 'databeach');
  text = text.replace(/https:\/\/databeach(?:\.databeach\.com|\.com)/gi, 'https://databeach.local');
  text = text.replace(/TECH COMPANY #1/gi, 'TECH COMPANY #1');
  text = text.replace(/databeach\.com/gi, 'databeach.local');
  text = text.replace(/Databloons/gi, 'Databloons');
  for (const [from, to] of displayReplacements) {
    text = text.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'gi'), to);
  }
  const neutralTerms = [
    [/(mobile|digital) technology/gi, '$1 technology'],
    [/technology services/gi, 'technology services'],
    [/technology platform/gi, 'technology platform'],
    [/technology company/gi, 'technology company'],
    [/digital technology/gi, 'technology'],
    [/technology services/gi, 'digital services'],
    [/digital future/gi, 'digital future'],
    [/island adventure/gi, 'digital adventure'],
    [/digital system/gi, 'digital system'],
    [/digital wellbeing/gi, 'digital wellbeing'],
    [/\bdigital\b/gi, 'digital'],
    [/\bbig companies\b/gi, 'big companies'],
    [/\bbanks?\b/gi, 'companies'],
    [/\btechnology\b/gi, 'technology'],
    [/\bcredit cards?\b/gi, 'player cards'],
    [/\bdebit cards?\b/gi, 'player cards'],
    [/\bcredit\b/gi, 'progress'],
    [/\bloans?\b/gi, 'support'],
    [/\bFDIC-insured\b/gi, 'safety-certified'],
    [/\bFDIC\b/gi, 'safety-certified'],
    [/\bVisa\b/gi, 'Player Pass'],
    [/\bMastercard\b/gi, 'Player Pass'],
    [/\bHELOC\b/gi, 'home project plan'],
    [/\bNMLS\b\s*#?\d+/gi, 'project ID'],
    [/\bmoney\b/gi, 'points'],
  ];
  for (const [pattern, replacement] of neutralTerms) text = text.replace(pattern, replacement);
  return text;
}

function transformValues(value, key = '') {
  if (typeof value === 'string') return protectedKeys.has(key) ? value : sanitizeDisplayText(value);
  if (Array.isArray(value)) return value.map((item) => transformValues(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, transformValues(childValue, childKey)]));
  }
  return value;
}

function sanitizeBootHtml(input) {
  let text = input;
  text = text.replaceAll('?v=databeach-boot-1', '');
  text = text.replace(/<!--([\s\S]*?)-->/g, (_match, body) => `<!--${sanitizeDisplayText(body)}-->`);
  text = text.replace(/(<title>)([\s\S]*?)(<\/title>)/gi, (_match, start, body, end) => `${start}${sanitizeDisplayText(body)}${end}`);
  text = text.replace(/(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/gi, (_match, start, value, end) => `${start}${sanitizeDisplayText(value)}${end}`);
  text = text.replace(/(<link\b[^>]*\bhref=["'])([^"']*)(["'][^>]*>)/gi, (_match, start, value, end) => `${start}${sanitizeDisplayText(value)}${end}`);
  text = text.replace(/(<span class="(?:default|colored)">)([\s\S]*?)(<\/span>)/gi, (_match, start, body, end) => `${start}${sanitizeDisplayText(body)}${end}`);
  text = text.replace(/<svg class="logo"[\s\S]*?<\/svg>(?=<p class="preloader-counter">)/i, '<img class="logo" src="/assets/databeach-logo.png" alt="Data B-each">');

  const dataStart = "<script>window.__DATA=JSON.parse('";
  const start = text.indexOf(dataStart);
  const end = start >= 0 ? text.indexOf("')</script>", start) : -1;
  if (start >= 0 && end > start) {
    const raw = text.slice(start + dataStart.length, end);
    try {
      const parsed = JSON.parse(raw.replaceAll('\\\\"', '\\"'));
      let serialized = JSON.stringify(transformValues(parsed));
      serialized = serialized
        .replace(/databeach/gi, 'databeach')
        .replace(/databeach/gi, 'databeach')
        .replace(/databeach\.com/gi, 'databeach.local')
        .replace(/https:\/\/databeach(?:\.databeach\.com|\.com)/gi, 'https://databeach.local');
      const encoded = serialized.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
      text = `${text.slice(0, start + dataStart.length)}${encoded}${text.slice(end)}`;
    } catch {
      // Keep the boot data untouched if an upstream format changes.
    }
  }
  if (!text.includes('databeach-home-logo')) {
    const overlayScript = `<script>(function(){function mount(){var intro=document.querySelector('.page-intro'),old=document.querySelector('.databeach-home-logo');if(!intro){old&&old.remove();return}if(old)return;var img=document.createElement('img');img.className='databeach-home-logo';img.src='/assets/databeach-logo.png';img.alt='Data B-each';Object.assign(img.style,{position:'fixed',top:'17vh',left:'50%',transform:'translateX(-50%)',width:'min(84vw,620px)',height:'auto',zIndex:'4',pointerEvents:'none',filter:'drop-shadow(0 8px 0 rgba(31,44,96,.38))'});document.body.appendChild(img)}new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});mount()})();</script>`;
    text = text.replace(/<\/body>/i, `${overlayScript}</body>`);
  }
  return text;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// Give every partner a neutral, playful identity while preserving internal IDs and paths.
const partnerFile = path.join(assetsRoot, 'partners_en.json');
const partnerData = readJson(partnerFile);
for (const [id, record] of Object.entries(partnerData.partners)) {
  const number = companyNumbers[id];
  if (!number) continue;
  const label = `TECH COMPANY #${number}`;
  partnerData.partners[id] = {
    ...record,
    name: label,
    description: `<strong>${label}</strong> - A playful technology team building digital tools for curious explorers.`,
    url: null,
    hasForm: false,
    tags: ['Build', 'Explore', 'Create', 'Connect'],
    textA: `${label} builds playful tools that help people learn, create, and connect.`,
    video: null,
    textB: `Explore ${label} and try the activity.`,
    news: `${label} is an independent technology company.`,
    ctaText: 'Explore',
    ctaUrl: null,
  };
}
writeJson(partnerFile, partnerData);

for (const fileName of ['quests_en.json', 'dialogs_en.json', 'characters_en.json']) {
  const file = path.join(assetsRoot, fileName);
  writeJson(file, transformValues(readJson(file)));
}

const manifestFile = path.join(referenceRoot, 'manifest.webmanifest');
writeJson(manifestFile, {
  short_name: 'Data B-each',
  name: 'Data B-each - A Playful Island Adventure',
  description: 'Explore Data B-each, meet TECH COMPANY teams, and discover playful technology activities.',
  start_url: '/',
  background_color: '#081a3a',
  theme_color: '#16b9d4',
  orientation: 'portrait',
  icons: [
    { src: '/icons/icon_192.png?v=databeach', type: 'image/png', sizes: '192x192' },
    { src: '/icons/icon_512.png?v=databeach', type: 'image/png', sizes: '512x512' },
  ],
  display: 'fullscreen',
});

const urlsFile = path.join(referenceRoot, '_external', 'urls.json');
const urls = readJson(urlsFile);
urls.note = 'Generic third-party URLs retained for reference only. No partner-service URLs are included.';
urls.urls = urls.urls.filter((url) => !/island|bank|digital/i.test(url));
writeJson(urlsFile, urls);

const logicalMapFile = path.join(referenceRoot, '.gltf', 'logical-to-hashed.json');
if (fs.existsSync(logicalMapFile)) {
  let text = fs.readFileSync(logicalMapFile, 'utf8');
  for (const [oldName, newName] of oldToNewAsset) text = text.replaceAll(oldName, newName);
  text = sanitizeDisplayText(text);
  fs.writeFileSync(logicalMapFile, text, 'utf8');
}

const manifestPath = path.join(referenceRoot, 'MANIFEST.json');
if (fs.existsSync(manifestPath)) {
  const manifest = readJson(manifestPath);
  manifest.origin = 'https://databeach.local';
  manifest.reference = 'reference.html';
  manifest.entry = 'index.html';
  manifest.files = (manifest.files || [])
    .filter((entry) => !entry.local || fs.existsSync(path.join(referenceRoot, entry.local)))
    .map((entry) => {
      const next = { ...entry };
      next.url = String(next.url || '').replace(/https:\/\/databeach\.databeach\.com/gi, 'https://databeach.local');
      for (const [oldName, newName] of oldToNewAsset) {
        next.url = next.url.replaceAll(oldName, newName);
        next.local = String(next.local || '').replaceAll(oldName, newName);
      }
      return next;
    });
  if (!manifest.files.some((entry) => entry.local === 'index.html')) {
    manifest.files.push({
      url: 'https://databeach.local',
      local: 'index.html',
      bytes: fs.statSync(path.join(referenceRoot, 'index.html')).size,
      folder: 'index.html',
    });
  }
  manifest.hosted_files = manifest.files.length;
  let totalBytes = 0;
  for (const entry of manifest.files) {
    if (!entry.local) continue;
    const localPath = path.join(referenceRoot, entry.local);
    if (!fs.existsSync(localPath)) continue;
    entry.bytes = fs.statSync(localPath).size;
    totalBytes += entry.bytes;
  }
  manifest.hosted_bytes = totalBytes;
  writeJson(manifestPath, manifest);
}

// Rewrite textual references to renamed files and the game title across the reference collection.
const textExtensions = new Set(['.json', '.js', '.css', '.md', '.webmanifest', '.xmp', '.xml', '.txt', '.html']);
for (const file of collectFiles(referenceRoot)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  if ([partnerFile, manifestFile, urlsFile, logicalMapFile, manifestPath].includes(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  text = text.replaceAll('?v=databeach-boot-1', '');
  for (const [oldName, newName] of oldToNewAsset) text = text.replaceAll(oldName, newName);
  if (path.extname(file).toLowerCase() === '.html') text = sanitizeBootHtml(text);
  else {
    text = text.replace(/Data B-each/gi, 'Data B-each');
    text = text.replace(/DataBeach/g, 'DataBeach');
    text = text.replace(/databeach/gi, 'databeach');
    text = text.replace(/databeach/gi, 'databeach');
    text = text.replace(/TECH COMPANY #1/gi, 'TECH COMPANY #1');
    text = text.replace(/databeach\.com/gi, 'databeach.local');
    text = text.replace(/Databloons/gi, 'Databloons');
  }
  text = text.replaceAll('logo-databeach-hub', 'logo-databeach');
  text = text.replaceAll('logo-databeach', 'logo-databeach-wordmark');
  text = text.replaceAll('logo-island-island', 'logo-databeach-mark');
  text = text.replaceAll('logo-island-small', 'logo-databeach-small');
  fs.writeFileSync(file, text, 'utf8');
}

// README documents the runnable reference copy and its retained boot pages.
fs.writeFileSync(path.join(referenceRoot, 'README.md'), `# Data B-each reference collection

This folder contains the retained island, character, audio, model, interface assets, and replicated boot pages used for reference work on **Data B-each**. Serve this folder as a static site to run the local reference build.

## Layout

| Path | What it is |
| --- | --- |
| \`index.html\` | Local reference boot page |
| \`reference.html\` | Duplicate boot page for reference inspection |
| \`assets/\` | Neutralized locale data, bundles, models, audio, fonts, and image assets |
| \`assets/databeach-logo.png\` | New chunky pixel-cartoon Data B-each logo |
| \`icons/\` | Retained app icons for visual reference |
| \`oldBrowser/\` | Legacy fallback image |
| \`embedded/\` | Cursor SVGs retained for reference |
| \`vendors/draco/\` | Draco decoder files used by the retained model assets |
| \`share/share_en.png\` | Data B-each share graphic |
| \`.gltf/\` | Logical model names mapped to local files |
| \`_external/urls.json\` | Generic third-party URLs only |
| \`MANIFEST.json\` | Preserved asset inventory with neutral local paths |

Technology-partner logos were replaced with transparent placeholders and the 16 partner slots are labeled **TECH COMPANY #1** through **TECH COMPANY #16** in the locale data. The boot pages retain the original runtime structure while using the neutralized Data B-each copy and assets.
`, 'utf8');

// The bundle also carries inline SVG brand marks. Replace their paths with empty symbols.
const vendorBundle = path.join(assetsRoot, 'vendor.75f6e6ae65453426.js');
if (fs.existsSync(vendorBundle)) {
  let vendorText = fs.readFileSync(vendorBundle, 'utf8');
  vendorText = vendorText.replaceAll('?v=databeach-boot-1', '');
  const logoIds = {
    'logo-databeach-hub': 'logo-databeach',
    'logo-databeach': 'logo-databeach-wordmark',
    'logo-island-island': 'logo-databeach-mark',
    'logo-island-small': 'logo-databeach-small',
  };
  for (const [oldId, newId] of Object.entries(logoIds)) vendorText = vendorText.replaceAll(oldId, newId);
  vendorText = vendorText.replace(/Databloons/gi, 'Databloons');
  let inlineLogoCount = 0;
  vendorText = vendorText.replace(/("symbol":")<symbol id=\\\\"(logo-(?:partner|databeach)-[^"\\]+)\\\\"[\s\S]*?<\/symbol>(")/g, (_match, prefix, id, suffix) => {
    inlineLogoCount += 1;
    return `${prefix}<symbol id=\\\\"${id}\\\\" class=\\\\"neutral-logo\\\\" viewBox=\\\\"0 0 1 1\\\\"><rect width=\\\\"1\\\\" height=\\\\"1\\\\" fill=\\\\"none\\\\"/></symbol>${suffix}`;
  });
  vendorText = vendorText.replace(/<symbol id=\\\\"logo-databeach\\\\"[\s\S]*?<\/symbol>/, String.raw`<symbol id=\\"logo-databeach\\" class=\\"logo-image\\" viewBox=\\"0 0 2172 724\\"><image href=\\"/assets/databeach-logo.png\\" width=\\"2172\\" height=\\"724\\" preserveAspectRatio=\\"xMidYMid meet\\"></image></symbol>`);
  fs.writeFileSync(vendorBundle, vendorText, 'utf8');
  console.log(`Neutralized ${inlineLogoCount} inline SVG logo symbols.`);
}

console.log(`Sanitized ${oldToNewAsset.size} branded asset filenames and neutralized the reference collection.`);

// Re-apply the permanent character/accessory and retired-logo removals after a
// source sanitization pass so those assets cannot be restored by a rebuild.
await import('./remove-character-customization.mjs');
