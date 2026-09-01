import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const targets = [
  'Asset_LogoMM.081e9f3265453426.glb',
  // The original CoastalWorld export was retained under this path during the
  // debranding pass. It is another flat title mesh, so neutralize it too.
  'Asset_DataBeach.e8c2b2cb65453426.glb',
].map((file) => path.join(projectRoot, 'reference', 'assets', file));

// Keep the original path and runtime lookup intact, but remove the old title mesh
// so the boot page can display the new Data B-each artwork instead.
const json = Buffer.from(JSON.stringify({
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [] }],
  nodes: [],
}), 'utf8');
const paddedLength = Math.ceil(json.length / 4) * 4;
const paddedJson = Buffer.concat([json, Buffer.alloc(paddedLength - json.length, 0x20)]);
const header = Buffer.alloc(12);
header.write('glTF', 0, 4, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + paddedJson.length, 8);
const chunkHeader = Buffer.alloc(8);
chunkHeader.writeUInt32LE(paddedJson.length, 0);
chunkHeader.writeUInt32LE(0x4e4f534a, 4); // JSON
for (const target of targets) {
  fs.writeFileSync(target, Buffer.concat([header, chunkHeader, paddedJson]));
  console.log(`Neutralized ${path.relative(projectRoot, target)} while preserving its runtime path.`);
}
