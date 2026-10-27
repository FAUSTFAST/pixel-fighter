'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, staged, output, hash } = require('../prepare.cjs');
const { resolveRequest, CSP } = require('../protocol.cjs');
test('private protocol confines all requests to public assets', () => {
  const dir = path.join(staged, 'public');
  assert.equal(resolveRequest('pf-game://game/', dir), path.join(dir, 'index.html'));
  assert.equal(resolveRequest('pf-game://game/js/game.js?v=1', dir), path.join(dir, 'js/game.js'));
  for (const url of ['https://game/', 'file:///etc/passwd', 'pf-game://other/', 'pf-game://user@game/', 'pf-game://game/%2f..%2fmain.cjs', 'pf-game://game/%5c..%5cmain.cjs', 'pf-game://game/%00']) assert.equal(resolveRequest(url, dir), null, url);
  assert.ok(!CSP.includes('unsafe-eval'));
});
test('staging preserves exact HTML, CSS, PNGs and complete manifest dependency closure', () => {
  const report = JSON.parse(fs.readFileSync(path.join(output, 'resource-manifest.json')));
  const expected = ['main.cjs', 'protocol.cjs', 'package.json', ...report.files.map(entry => 'public/' + entry.file)].sort();
  const actual = fs.readdirSync(staged, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => path.relative(staged, path.join(entry.parentPath || entry.path, entry.name)).replaceAll('\\', '/')).sort();
  assert.deepEqual(actual, expected);
  for (const entry of report.files) {
    const source = fs.readFileSync(path.join(root, entry.file)), produced = fs.readFileSync(path.join(staged, 'public', entry.file));
    assert.equal(hash(source), entry.sourceSHA256, entry.file + ' source untouched');
    assert.equal(hash(produced), entry.packagedSHA256);
    if (!entry.file.endsWith('.js')) assert.ok(source.equals(produced), entry.file);
    else { new vm.Script(produced.toString(), { filename: entry.file }); assert.ok(!produced.includes('sourceMappingURL=')); }
  }
  const catalogs = ['animation-v8', 'art-restoration', 'air-normals'].map(name => JSON.parse(fs.readFileSync(path.join(staged, 'public/assets/characters', name, 'manifest.json'))));
  for (const [id, base] of Object.entries(catalogs[0].characters)) for (const clip of Object.values({ ...base, ...catalogs[1].characters[id], ...catalogs[2].characters[id] })) {
    assert.ok(fs.existsSync(path.join(staged, 'public', clip.sourceRoot || 'assets/characters/animation-v8/', clip.sheet + '.png')));
  }
  assert.equal(report.assets.length, 197);
  assert.ok(report.assets.includes('assets/audio/break-of-dawn-v1.mp3'));
  assert.ok(!actual.some(file => /(?:\.map$|\.git\/|review\.png|drawings\.json|reference\/|scripts\/|\.md$|node_modules\/)/.test(file)));
  for (const file of ['index.html', ...report.scripts, 'css/ui.css']) {
    const text = fs.readFileSync(path.join(staged, 'public', file), 'utf8');
    assert.ok(!/(?:src|href)\s*=\s*["']https?:|(?:fetch|importScripts)\s*\(\s*["']https?:|url\(\s*["']?https?:/.test(text), file + ' offline');
  }
});
