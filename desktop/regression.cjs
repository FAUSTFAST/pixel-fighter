'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { nativeHarness, createCanvas } = require('../scripts/native-game-art.cjs');
const { harness } = require('../scripts/gameplay-harness.cjs');
const { staged, output } = require('./prepare.cjs');
function state(h) {
  return JSON.stringify({ fighters: [h.g.f1, h.g.f2].map(f => ({
    x: f.x, y: f.y, vx: f.vx, vy: f.vy, hp: f.hp, state: f.state,
    stateT: f.stateT, attackKind: f.attackKind, attack: f.attack,
    hitstun: f.hitstun, blockstun: f.blockstun, facing: f.facing,
    meter: f.meter, drive: f.drive, combo: f.combo, onGround: f.onGround,
    jumpsUsed: f.jumpsUsed, walkDistance: f.walkDistance, attackConnected: f.attackConnected
  })), projectiles: h.g.projectiles, hitstop: h.g.hitstop, time: h.g.roundTime },
  (key, value) => (key === 'owner' || key === 'foe') && value?.def ? value.def.id : value);
}
async function run() {
  const report = JSON.parse(fs.readFileSync(path.join(output, 'resource-manifest.json')));
  const sources = Object.fromEntries(report.scripts.map(file => [path.basename(file, '.js'), fs.readFileSync(path.join(staged, 'public', file), 'utf8')]));
  const nativeOriginal = nativeHarness(91), nativeProduced = nativeHarness(91, true, sources);
  await Promise.all([nativeOriginal.s.DrawnAnimation.loading, nativeProduced.s.DrawnAnimation.loading]);
  assert.equal(nativeOriginal.s.DrawnAnimation.status, 'ready'); assert.equal(nativeProduced.s.DrawnAnimation.status, 'ready');
  let sprites = 0, ticks = 0, stageViews = 0;
  const catalog = require('../scripts/effective-animation-catalog.cjs').effectiveCatalog();
  for (const [id, clips] of Object.entries(catalog.characters)) for (const [name, clip] of Object.entries(clips)) for (let i = 0; i < clip.frames.length; i++) {
    const a = nativeOriginal.s.DrawnAnimation.sprite(id, name, i), b = nativeProduced.s.DrawnAnimation.sprite(id, name, i);
    assert.ok(a.canvas.toBuffer('image/png').equals(b.canvas.toBuffer('image/png')), `${id}/${name}/${i}`);
    assert.deepEqual([a.x, a.y, a.w, a.h, a.flip], [b.x, b.y, b.w, b.h, b.flip]); sprites++;
  }
  for (let i = 0; i < nativeOriginal.s.STAGES.length; i++) for (const camera of [-240, 0, 240]) {
    const pictures = [nativeOriginal, nativeProduced].map(h => {
      const stage = h.s.STAGES[i]; assert.equal(h.s.STAGE_ART[stage.id].ready, true);
      const canvas = createCanvas(960, 540), ctx = canvas.getContext('2d');
      stage.draw(ctx, 3, camera); stage.drawForeground(ctx, 3, camera);
      return canvas.toBuffer('image/png');
    });
    assert.ok(pictures[0].equals(pictures[1]), `stage ${i}, camera ${camera}`); stageViews++;
  }
  // Keep native original-pixel collision; skip redundant full-screen rasterization
  // in the deterministic physics comparison (every sprite was checked above).
  const original = harness(91), produced = harness(91, { sources });
  original.s.DrawnAnimation = nativeOriginal.s.DrawnAnimation;
  produced.s.DrawnAnimation = nativeProduced.s.DrawnAnimation;
  for (let character = 0; character < 6; character++) for (const difficulty of [.6, .85, 1]) {
    for (const h of [original, produced]) {
      h.fight(character, difficulty, 190);
      h.g.f1 = new h.s.Fighter(h.s.CHARACTERS[character], 100, 1, 'P1');
      h.g.f1.foe = h.g.f2; h.g.f2.foe = h.g.f1;
      h.g.f1.hp = h.g.f1.maxHp = 10000;
    }
    for (let i = 0; i < 360; i++) {
      if (i % 45 === 0) for (const h of [original, produced]) h.g.f1.startAttack(['light', 'medium', 'heavy', 'lightKick', 'mediumKick', 'heavyKick', 'special', 'rush'][Math.floor(i / 45)]);
      for (const h of [original, produced]) {
        if (i === 10) h.key('d'); if (i === 35) h.key('d', false);
        if (i === 70 || i === 90) h.key('w'); if (i === 71 || i === 91) h.key('w', false);
        h.tick();
      }
      assert.equal(state(produced), state(original), `character ${character}, difficulty ${difficulty}, frame ${i}`); ticks++;
    }
  }
  const result = { passed: true, originalPixelSpritesCompared: sprites, stageViewsCompared: stageViews, deterministicCombatFrames: ticks, characters: 6, aiDifficulties: 3, note: 'Production minified scripts vs untouched source using original PNGs, real game loop/physics and seeded AI; not an OS launch test.' };
  fs.writeFileSync(path.join(output, 'production-regression.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
