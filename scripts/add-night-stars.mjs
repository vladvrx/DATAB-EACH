#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const vendorPath = path.join(projectRoot, "reference", "assets", "vendor.75f6e6ae65453426.js");

const anchor = 'skyColor=mix(skyColor,c.rgb*SKY_CLOUDS_MULT,alpha*waterProgress*step(0.01,cuv.y)*0.75*(1.-cuv.y));\\n#if defined(IS_BIOME_TESTLAB)';
const oldStars = 'skyColor=mix(skyColor,c.rgb*SKY_CLOUDS_MULT,alpha*waterProgress*step(0.01,cuv.y)*0.75*(1.-cuv.y));\\nfloat starBand=smoothstep(0.56,0.7,vUv.y);vec2 starGrid=vec2(vUv.x*150.,(vUv.y-0.5)*105.);vec2 starCell=floor(starGrid);vec2 starLocal=fract(starGrid)-0.5;float starSeed=fract(sin(dot(starCell,vec2(127.1,311.7)))*43758.5453);float starVisible=step(0.988,starSeed);float starSize=mix(0.055,0.16,fract(starSeed*19.13));float starCore=smoothstep(starSize,0.,length(starLocal));float starHalo=smoothstep(starSize*3.2,0.,length(starLocal))*0.22;float starTwinkle=0.82+0.18*sin(time*0.7+starSeed*6.28318);vec3 starColor=mix(vec3(0.62,0.78,1.),vec3(1.,0.93,0.74),fract(starSeed*9.7));skyColor+=starColor*(starCore+starHalo)*starVisible*starTwinkle*starBand*step(0.01,waterProgress);\\n#if defined(IS_BIOME_TESTLAB)';
const stars = 'skyColor=mix(skyColor,c.rgb*SKY_CLOUDS_MULT,alpha*waterProgress*step(0.01,cuv.y)*0.75*(1.-cuv.y));\\nfloat starBand=smoothstep(0.53,0.72,vUv.y);vec2 starGrid=vec2(vUv.x*150.,(vUv.y-0.5)*105.);vec2 starCell=floor(starGrid);vec2 starLocal=fract(starGrid)-0.5;float starSeed=fract(sin(dot(starCell,vec2(127.1,311.7)))*43758.5453);float starVisible=step(0.975,starSeed);float starSize=mix(0.06,0.18,fract(starSeed*19.13));float starCore=smoothstep(starSize,0.,length(starLocal));float starHalo=smoothstep(starSize*3.2,0.,length(starLocal))*0.24;float starTwinkle=0.82+0.18*sin(time*0.7+starSeed*6.28318);vec3 starColor=mix(vec3(0.62,0.78,1.),vec3(1.,0.93,0.74),fract(starSeed*9.7));skyColor+=starColor*(starCore+starHalo)*starVisible*starTwinkle*starBand*step(0.01,waterProgress);\\n#if defined(IS_BIOME_TESTLAB)';

const source = fs.readFileSync(vendorPath, "utf8");
if (source.includes(stars)) {
  console.log("Night stars already present.");
} else if (source.includes(oldStars)) {
  fs.writeFileSync(vendorPath, source.replace(oldStars, stars));
  console.log("Increased procedural star density.");
} else {
  if (!source.includes(anchor)) throw new Error("Could not locate the sky shader anchor");
  fs.writeFileSync(vendorPath, source.replace(anchor, stars));
  console.log("Added procedural stars to the sky shader.");
}
