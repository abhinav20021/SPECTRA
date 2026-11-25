'use strict';
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const {createCanvas, loadImage, GlobalFonts} = require('@napi-rs/canvas');
const {hash, ensure} = require('./core.cjs');

const dist = path.resolve(__dirname, '../dist');
const font = fs.readFileSync(path.join(dist, 'fonts/inter-latin.woff2'));
ensure(GlobalFonts.register(font, 'VTF Benchmark'), 'Could not register the bundled benchmark font.');
// Inject the two browser APIs used by the shared renderer into local bindings.
// Keeping the native JS built-ins avoids a cross-context lookup for every pixel.
const studio = {VTF_RENDER_FONT:'"VTF Benchmark"'};
const document = {createElement: () => createCanvas(1,1)};
const sources = ['engine.js','skills.js'].map(file => fs.readFileSync(path.join(dist,file),'utf8'));
for (const source of sources) vm.compileFunction(source,['window','document'])(studio,document);
const panelSources = ['panel-scene.js','panel-inspection.js'].map(file => fs.readFileSync(path.join(dist,file),'utf8'));
for (const source of panelSources) vm.compileFunction(source,['window','document'])(studio,document);
const engine = studio.VTF, skills = studio.PanelInspection.register(studio.VisualSkills);
const generatorVersion = hash(JSON.stringify([sources,hash(font),require('@napi-rs/canvas/package.json').version]));
const panelVersion = hash(JSON.stringify([generatorVersion,...panelSources]));
const revisionFor = families => families.some(f=>Object.hasOwn(studio.PanelScene.families,f)) ? panelVersion : generatorVersion;
async function decode(png) {
  // Check IHDR before allocating the decoding surface.
  ensure(png.length >= 24 && png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) &&
    png.readUInt32BE(16) === engine.W && png.readUInt32BE(20) === engine.H, 'Unexpected PNG format or dimensions.');
  const img = await loadImage(png);
  const canvas = createCanvas(img.width,img.height);
  canvas.getContext('2d').drawImage(img,0,0);
  return canvas;
}
module.exports = {skills,engine,generatorVersion,revisionFor,decode};
