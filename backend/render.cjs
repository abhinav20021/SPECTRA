'use strict';
// The HTTP service and offline Studio share these task definitions and pixel readers.
const fs = require('node:fs');
const { live, skills, engine, decode } = require('../framework/runtime.cjs');
const families = Object.fromEntries(Object.entries(skills.families)
  .filter(([id]) => !id.startsWith('panel_'))
  .map(([id, def]) => [id, def.types]));

async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const { action, family, task, seed, difficulty } = input;
  if (action === 'catalog') return families;
  const decodeUrl = url => decode(Buffer.from(url.split(',')[1], 'base64'));
  if (action === 'fresh') return live.generate(family, task, difficulty, {
    encode: canvas => canvas.toDataURL('image/png'), decode: decodeUrl
  });
  if (action === 'fresh-baseline') return live.baseline(input.image, input.probe, decodeUrl);
  const scene = skills.create(family, seed, task, difficulty);
  const variants = [];
  for (const t of scene.tasks) {
    const png = t.canvas.toBuffer('image/png');
    const decoded = await decode(png);
    const pixels = family === 'charts' ? engine.verifyImage(decoded, task) : skills.pixelCheck(decoded, family, task, scene.prompt);
    const sourceKey = skills.sourceAnswer(family, task, t.rows);
    if (pixels.answer !== sourceKey || sourceKey !== t.key || JSON.stringify(pixels.readings) !== JSON.stringify(t.check.readings)) {
      throw Error('The source and encoded PNG disagree.');
    }
    const v = { variant: t.variant, key: sourceKey, image: 'data:image/png;base64,' + png.toString('base64'),
      evidence: { variant: t.variant, pngVerified: true, source: t.rows, pixels: pixels.readings, pixelAnswer: pixels.answer } };
    if (action === 'baseline') {
      const started = performance.now();
      v.baseline = skills.predict(decoded, scene.prompt);
      v.latencyMs = Math.round(performance.now() - started);
    }
    variants.push(v);
    decoded.width = 1;
    t.canvas.width = 1;
  }
  return { family, task, seed, difficulty, question: scene.prompt, choices: scene.choices || null, variants };
}
main().then(data => process.stdout.write(JSON.stringify(data))).catch(e => { console.error(e.message); process.exitCode = 1; });
