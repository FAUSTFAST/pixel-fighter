'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { minify } = require('terser');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/desktop');
const staged = path.join(output, 'app');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function prepare() {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?[^" ]*)?"\s*>\s*<\/script>/g)].map(match => match[1]);
  const styles = [...html.matchAll(/<link[^>]+href="([^"?]+)(?:\?[^" ]*)?"/g)].map(match => match[1]);
  if (scripts.length !== 24 || scripts.some(file => !/^js\/[\w-]+\.js$/.test(file))) throw new Error('Review changed HTML entry points before packaging');
  const manifests = ['animation-v8', 'art-restoration', 'air-normals'];
  const catalogs = await Promise.all(manifests.map(name => fs.readFile(path.join(root, 'assets/characters', name, 'manifest.json'), 'utf8').then(JSON.parse)));
  const assets = new Set(manifests.map(name => `assets/characters/${name}/manifest.json`));
  for (const [id, base] of Object.entries(catalogs[0].characters)) {
    const clips = { ...base, ...catalogs[1].characters[id], ...catalogs[2].characters[id] };
    for (const clip of Object.values(clips)) {
      const file = (clip.sourceRoot || 'assets/characters/animation-v8/') + clip.sheet + '.png';
      if (!/^assets\/characters\/[\w/-]+\.png$/.test(file)) throw new Error('Unsafe asset reference: ' + file);
      assets.add(file);
    }
    for (const suffix of ['-v2', '-movement-v3', '-combat-v4']) assets.add(`assets/characters/${id}${suffix}.png`);
  }
  // These are the actual IDs loaded by stages.js, including the three appended stages.
  for (const id of ['dojo', 'city', 'beach', 'volcano', 'station', 'snow', 'garden']) assets.add(`assets/stages/${id}-panorama-v3.png`);
  // Only the disposable staging directory is replaced. Never modify game source/assets.
  await fs.rm(staged, { recursive: true, force: true });
  const records = [];
  async function emit(relative, bytes) {
    const target = path.join(staged, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes);
  }
  for (const file of ['index.html', ...styles, ...scripts, ...assets]) {
    const bytes = await fs.readFile(path.join(root, file));
    let production = bytes;
    if (file.endsWith('.js')) {
      // Local identifier mangling is deliberately conservative: globals, property
      // names, original script order, floating point and game timing are preserved.
      const result = await minify(bytes.toString(), { compress: { passes: 2, unsafe: false }, mangle: { toplevel: false }, format: { comments: false }, sourceMap: false });
      if (!result.code) throw new Error('Empty production script: ' + file);
      production = Buffer.from(result.code);
    }
    await emit('public/' + file, production);
    records.push({ file, sourceSHA256: hash(bytes), packagedSHA256: hash(production), bytes: production.length });
  }
  for (const file of ['main.cjs', 'protocol.cjs']) {
    const result = await minify(await fs.readFile(path.join(__dirname, file), 'utf8'), { compress: true, mangle: true, format: { comments: false }, sourceMap: false });
    await emit(file, result.code);
  }
  await emit('package.json', JSON.stringify({ name: 'pixel-fighter', version: pkg.version, productName: 'Pixel Fighter', description: 'Offline 2D pixel fighting game', author: 'FAUSTFAST', main: 'main.cjs', private: true }));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const report = { version: pkg.version, commit, generatedAt: new Date().toISOString(), scripts, assets: [...assets].sort(), files: records };
  await fs.writeFile(path.join(output, 'resource-manifest.json'), JSON.stringify(report, null, 2));
  console.log(`Prepared ${scripts.length} scripts and ${assets.size} runtime assets in ${path.relative(root, staged)}`);
  return report;
}
if (require.main === module) prepare().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { prepare, root, output, staged, hash };
