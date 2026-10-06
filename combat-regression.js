// Deterministic gameplay checks; run with: node combat-regression.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness() {
  let now = 0, frame;
  const events = {};
  const scales = [];
  const ctx = new Proxy({ scale(x, y) { scales.push([x, y]); } }, {
    get: (target, key) => target[key] ?? (() => key.includes('Gradient') ? { addColorStop() {} } : undefined),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const addEventListener = (type, fn) => (events[type] ??= []).push(fn);
  const s = {
    console, Math, performance: { now: () => now }, addEventListener,
    document: { hidden: false, addEventListener, getElementById: () => ({ getContext: () => ctx }) },
    requestAnimationFrame: fn => { frame = fn; },
    Audio2: { sfx: new Proxy({}, { get: () => () => {} }), music: { play() {}, stop() {} }, isMusicOn: () => false, isSfxOn: () => false },
  };
  s.window = s;
  vm.createContext(s);
  for (const file of ['input','utils','characters','styles','stages','fighter','ai','ui','game']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'js', file + '.js'), 'utf8'), s, { filename: file + '.js' });
  }
  function key(k, down = true) {
    for (const fn of events[down ? 'keydown' : 'keyup'] || []) fn({ key: k, preventDefault() {} });
  }
  function tick(n = 1, hz = 60) { for (let i = 0; i < n; i++) { now += 1000 / hz; frame(now); } }
  function fight(distance = 76) {
    const g = s.GAME;
    Object.assign(g, { scene:'fight', roundState:'fight', paused:false, pve:false, roundTime:99, stage:s.STAGES[0], hitstop:0 });
    g.f1 = new s.Fighter(s.CHARACTERS[0], 300, 1, 'P1');
    g.f2 = new s.Fighter(s.CHARACTERS[2], 300 + distance, -1, 'P2');
    return g;
  }
  return { s, key, tick, fight, scales };
}

// Timing and input edges survive different monitor refresh rates.
for (const hz of [30, 60, 120, 144]) {
  const h = harness(), g = h.fight(400);
  h.tick(hz, hz);
  assert.ok(Math.abs(g.roundTime - 98) < 1e-6, `${hz} Hz simulation speed`);
}
{
  const h = harness(), g = h.fight(400);
  h.key('f'); h.tick(1, 144); h.key('f', false); h.tick(2, 144);
  assert.equal(g.f1.state, 'light', 'attack edge survives a render without a simulation step');
}

// A real hit can cancel; blocked and missed punches cannot.
{
  const h = harness(), g = h.fight();
  h.key('f'); h.tick(3); h.key('f', false);
  assert.equal(g.f2.hp, g.f2.maxHp - 6);
  assert.ok(g.hitstop > 0);
  h.key('g'); h.tick(); h.key('g', false);
  assert.equal(g.f1.bufferedAttack.kind, 'heavy', 'capture input during hitstop');
  h.tick(3);
  assert.equal(g.f1.state, 'heavy', 'cancel light recovery on hit');
  h.tick(7);
  assert.equal(g.f2.comboHits, 2, 'light to heavy is a true combo');
  h.key('d'); h.tick(); h.key('s'); h.tick(); h.key('g'); h.tick();
  h.key('g', false); h.key('d', false); h.key('s', false);
  h.tick(4);
  assert.equal(g.f1.state, 'uppercut', 'buffer simplified uppercut during heavy hitstop');
  h.tick(4);
  assert.equal(g.f2.comboHits, 3, 'heavy to uppercut connects');
  assert.ok(g.f2.comboDamage < 6 + 12 + 19, 'combo damage scales');
}
for (const blocked of [false, true]) {
  const h = harness(), g = h.fight(blocked ? 76 : 400);
  if (blocked) h.key('ArrowRight');
  h.key('f'); h.tick(3); h.key('f', false);
  assert.equal(g.f1.attackConnected, false);
  assert.equal(g.f1.startAttack('heavy'), false, 'no cancel on miss/block');
}

// Direction mirroring, return to neutral, and QCF priority.
for (const facing of [1, -1]) {
  const h = harness(), g = h.fight(400);
  if (facing < 0) { g.f1.x = 700; g.f2.x = 300; }
  const f = facing > 0 ? 'd' : 'a';
  h.key(f); h.tick(); h.key('s'); h.tick();
  h.key(f, false); h.key('s', false); h.tick(); h.key('g'); h.tick();
  assert.equal(g.f1.state, 'uppercut', 'simplified uppercut from neutral, both facings');
}
{
  const h = harness(), g = h.fight(400);
  h.key('s'); h.tick(); h.key('d'); h.tick(); h.key('s', false); h.tick(); h.key('g'); h.tick();
  assert.equal(g.f1.state, 'special', 'QCF+heavy does not become uppercut');
}
{
  const h = harness(), g = h.fight(400);
  h.key('d'); h.tick(); h.key('d', false); h.tick(); h.key('d'); h.tick(); h.key('f'); h.tick();
  assert.equal(g.f1.state, 'rush');
  const x = g.f1.x; h.tick(10);
  assert.ok(g.f1.x - x > 30, 'rush travels forward');
}
{
  const h = harness(), { Fighter, CHARACTERS } = h.s;
  const f = new Fighter(CHARACTERS[1], 300, 1, 'P1');
  f.meter = 100; f.startAttack('special');
  for (let i = 0; i < 20; i++) f.update({ projectiles: [] });
  assert.ok(f.x > 340, 'original character rush still moves');
  f.attack = null; f.state = 'jump'; f.onGround = false;
  assert.equal(f.startAttack('uppercut'), false, 'no repeat uppercuts in midair');
}
{
  const h = harness(), g = h.fight();
  g.f2.invuln = 8;
  h.key('f'); h.tick(3);
  assert.equal(g.f2.hp, g.f2.maxHp);
  assert.equal(g.f1.attackHasHit, false, 'invulnerability does not create a fake hit');
  assert.equal(g.combo.P1.count, 0);
}
// Held directions are valid starts, but a finished command cannot linger forever.
{
  const h = harness(), g = h.fight(550);
  h.key('d'); h.tick(60); h.key('s'); h.tick(); h.key('g'); h.tick();
  assert.equal(g.f1.state, 'uppercut', 'walking forward can lead into simplified DP');
}
{
  const h = harness(), g = h.fight(400);
  h.key('s'); h.tick(); h.key('d'); h.tick(); h.key('s', false); h.tick(25); h.key('g'); h.tick();
  assert.equal(g.f1.state, 'heavy', 'expired command does not replace a normal punch');
}
{
  const h = harness(), g = h.fight(400);
  g.f1.queueAttack('heavy');
  h.key('p'); h.tick(); h.key('p', false);
  assert.equal(g.f1.bufferedAttack, null, 'pause clears pending attacks');
  const time = g.roundTime; h.tick(60);
  assert.equal(g.roundTime, time, 'pause freezes simulation');
}
{
  const h = harness(), g = h.fight(400);
  const hit = { dmg:10, kb:0, hitstun:5, type:'light' };
  g.f2.takeHit(hit, 1, false);
  for (let i = 0; i < 6; i++) g.f2.update(g);
  g.f2.takeHit(hit, 1, false);
  assert.equal(g.f2.comboHits, 1, 'a recovered defender starts a new combo');
  assert.equal(g.f2.comboDamage, 10);
}
// Shortcut inputs work independently of facing, including P2.
for (const facing of [1, -1]) {
  const h = harness(), g = h.fight(400);
  if (facing < 0) { g.f1.x = 700; g.f2.x = 300; }
  h.key('s'); h.key('g'); h.tick();
  assert.equal(g.f1.state, 'uppercut', 'down+heavy shortcut works facing either side');
}
{
  const h = harness(), g = h.fight(400);
  h.key('ArrowDown'); h.key('k'); h.tick();
  assert.equal(g.f2.state, 'uppercut', 'P2 shortcut');
}
{
  const h = harness(), g = h.fight(400);
  assert.equal(g.f1.bodyBox.w, 68);
  assert.equal(g.f1.bodyBox.h, 168);
  h.tick();
  assert.ok(h.scales.some(([x, y]) => x === 4.2 && y === 4.2), 'combat sprite is exactly twice the previous scale');
  const x = g.f1.x;
  h.key('d'); h.tick(10);
  assert.ok(Math.abs(g.f1.x - x - g.f1.def.walk * 1.3 * 10) < 1e-6, '30 percent faster walking');
  h.key('w'); h.tick();
  assert.equal(g.f1.onGround, false);
  assert.ok(g.f1.vx > 3, 'jump starts with horizontal momentum');
  h.key('w', false); h.key('d', false); h.key('a'); h.tick(6);
  assert.ok(g.f1.vx < 0, 'air steering can reverse movement');
}
{
  const h = harness(), g = h.fight(400);
  g.f1.startAttack('light'); g.f1.stateT = g.f1.attack.startup;
  assert.equal(g.f1.getHitBox().w, g.f1.attack.hw * 2);
  assert.equal(g.f1.getHitBox().h, g.f1.attack.hh * 2);
}
// New normals use actual keyboard edges and grounded low attack rules.
{
  const h=harness(),g=h.fight(90);h.key('v');h.tick(5);
  assert.equal(g.f1.state,'lightKick');assert.ok(g.f2.hp<g.f2.maxHp);
}
{
  const h=harness(),g=h.fight(100);h.key('s');h.key('b');h.tick(20);
  assert.ok(g.f2.knockedDown,'crouching heavy kick knocks down');
}
for(const back of [false,true]){
  const h=harness(),g=h.fight(70);
  if(back)h.key('a');h.key('r');h.tick(40);
  assert.ok(g.f2.hp<g.f2.maxHp,'throw completes with damage');
  assert.equal(g.f2.grabbedBy,null);assert.equal(g.f1.throwSequence,null);
  assert.ok(back?g.f2.x<g.f1.x:g.f2.x>g.f1.x,'throw direction follows forward/back input');
}
{
  const h=harness(),g=h.fight(70);h.key('r');h.tick(7);
  assert.ok(g.f2.grabbedBy,'normal throw captures');
  h.key('o');h.tick(2);
  assert.equal(g.f2.grabbedBy,null);assert.equal(g.f2.hp,g.f2.maxHp,'throw escape prevents damage');
}
{
  const h=harness(),g=h.fight(70);h.key('f');h.key('v');h.tick(1);
  assert.equal(g.f1.state,'throw','LP+LK is a throw, not a punch');
}
{
  const h=harness(),g=h.fight(70);h.key('ArrowUp');h.key('r');h.tick(30);
  assert.equal(g.f2.hp,g.f2.maxHp,'jump avoids normal throw');
}
{
  const h=harness(),s=h.s;
  const owner=new s.Fighter(s.CHARACTERS[3],300,1,'P1');
  const wave=new s.Projectile(owner,1,owner.def.moves.special),initial=wave.y;
  wave.update();assert.notEqual(wave.y,initial,'electric projectile changes height');
  const fire=new s.Projectile(owner,1,s.CHARACTERS[5].moves.special);
  fire.y=460-fire.r-1;fire.vy=4;fire.update();
  assert.ok(!fire.dead&&fire.vy<0,'fire seed bounces once');
  fire.y=460-fire.r-1;fire.vy=4;fire.update();assert.ok(fire.dead,'second ground contact expires seed');
}
for(const crouch of [false,true]){
  const h=harness(),g=h.fight(100);
  h.key(crouch?'ArrowDown':'ArrowRight');h.key('s');h.key('v');h.tick(7);
  assert.equal(g.f1.attackConnected,!crouch,'low kick defeats standing guard and is blocked crouching');
}
{
  const h=harness(),g=h.fight(90);h.key('v');h.tick(5);
  assert.ok(g.f1.attackConnected);h.key('b');h.tick(5);
  assert.equal(g.f1.state,'heavyKick','light kick confirms into heavy kick');
}
console.log('Combat regressions passed: timing, combos, commands, kicks, low guard, kick cancels, knockdown, front/back throw, throw escape, jump avoidance, projectile paths.');
{
  const h=harness(),g=h.fight(400);h.s.Settings={isOpen:true,values:{shake:false}};
  const before=g.roundTime;h.key('v');h.tick(60);
  assert.equal(g.roundTime,before,'settings freezes the round clock');
  assert.equal(g.f1.state,'idle','settings absorbs combat input');
  h.s.Settings.isOpen=false;h.key('v',false);h.tick(10);
  assert.ok(g.roundTime<before,'round resumes after settings closes');
  assert.equal(g.f1.state,'idle','settings inputs do not leak into combat');
}
console.log('Settings integration passed: pause, input isolation and resume.');
