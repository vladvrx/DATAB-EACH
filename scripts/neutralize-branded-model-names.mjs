import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reference = path.join(root, 'reference');
const assets = path.join(reference, 'assets');

const replacements = [
  ['Asset_AvenHouse', 'Asset_TechCompany03House'],
  ['Asset_BlueVineRibbon', 'Asset_TechCompany04Ribbon'],
  ['Asset_CarMovo', 'Asset_CarNeutral'],
  ['Asset_StandAspiration', 'Asset_StandTechCompany02'],
  ['Asset_StandAven', 'Asset_StandTechCompany03'],
  ['Asset_StandBluevine', 'Asset_StandTechCompany04'],
  ['Asset_StandBrigit', 'Asset_StandTechCompany01'],
  ['Asset_StandGreenwood', 'Asset_StandTechCompany05'],
  ['Asset_StandKikoff', 'Asset_StandTechCompany10'],
  ['Asset_StandLendingPoint', 'Asset_StandTechCompany13'],
  ['Asset_StandOne', 'Asset_StandTechCompany07'],
  ['Asset_StandPomelo', 'Asset_StandTechCompany08'],
  ['Asset_StandPossible', 'Asset_StandTechCompany12'],
  ['Asset_StandProsper', 'Asset_StandTechCompany11'],
  ['Asset_StandTill', 'Asset_StandTechCompany06'],
  ['Asset_StandX1', 'Asset_StandTechCompany15'],
  ['Asset_StandZenda', 'Asset_StandTechCompany09'],
  ['Asset_StandMovo', 'Asset_StandNeutral05'],
  ['Asset_StandCoastal', 'Asset_StandDataBeach'],
];

const mapping = new Map();
for (const oldName of fs.readdirSync(assets)) {
  let newName = oldName;
  for (const [from, to] of replacements) newName = newName.replace(from, to);
  if (newName !== oldName) mapping.set(oldName, newName);
}

for (const [oldName] of mapping) fs.renameSync(path.join(assets, oldName), path.join(assets, `.__databeach_model__${oldName}`));
for (const [oldName, newName] of mapping) fs.renameSync(path.join(assets, `.__databeach_model__${oldName}`), path.join(assets, newName));

const textExtensions = new Set(['.json', '.js', '.css', '.md', '.webmanifest', '.xmp', '.xml', '.txt', '.html']);
function walk(folder) {
  const files = [];
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}
for (const file of walk(reference)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  let text = fs.readFileSync(file, 'utf8');
  for (const [oldName, newName] of mapping) text = text.replaceAll(oldName, newName);
  for (const [oldName, newName] of replacements) text = text.replaceAll(oldName, newName);
  fs.writeFileSync(file, text, 'utf8');
}

console.log(`Neutralized ${mapping.size} branded model filenames.`);
