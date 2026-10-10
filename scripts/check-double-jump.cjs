// Focused checks against the current combat rules and real input edges.
// Run: node scripts/check-double-jump.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function harness() {
  let now = 0, frame, jumpSounds = 0;
  const events = {};
  const ctx = new Proxy({}, { get: (_, key) => () => key.includes('Gradient') ? {addColorStop(){}} : undefined });
  const addEventListener = (type, fn) => (events[type] ??= []).push(fn);
  const s = {
    console, Math, performance: {now: () => now}, addEventListener,
    document: {hidden:false, addEventListener, getElementById: () => ({getContext: () => ctx})},
    requestAnimationFrame: fn => {frame = fn;},
    Audio2: {sfx:new Proxy({jump(){jumpSounds++;}}, {get:(t,k) => t[k] || (() => {})}),
      music:{play(){},stop(){}}, isMusicOn: () => false, isSfxOn: () => false},
  };
  s.window = s; vm.createContext(s);
  for (const file of ['input','utils','characters','styles','stages','combat-rules','strike-art','strike-motion','combat-spacing','motion60','controls','fighter','ai','ui','game']) {
    vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),s,{filename:file+'.js'});
  }
  const g = s.GAME;
  Object.assign(g, {scene:'fight',roundState:'fight',paused:false,pve:false,roundTime:99,stage:s.STAGES[0],hitstop:0});
  g.f1 = new s.Fighter(s.CHARACTERS[0], 200, 1, 'P1');
  g.f2 = new s.Fighter(s.CHARACTERS[2], 850, -1, 'P2');
  return {s,g,ctx,sounds: () => jumpSounds,
    key(k,down=true){for(const fn of events[down?'keydown':'keyup'] || []) fn({key:k,preventDefault(){}});},
    tick(n=1,hz=60){for(let i=0;i<n;i++){now += 1000/hz;frame(now);}},
  };
}
const intent = (up=false,move=0) => ({up,move,down:false,block:false});
function land(f,g) {for(let i=0;!f.onGround && i<240;i++)f.update(g);assert.ok(f.onGround,'must land');}
let trajectories = 0;
for (const defIndex of [0,1,2,3,4,5]) for (const facing of [1,-1]) for (const timing of ['rising','apex','falling']) {
  const h=harness(),{s,g}=h,f=new s.Fighter(s.CHARACTERS[defIndex],400,facing,'P1');
  f.meter=150;f.drive=3;
  f.handleIntent(intent(true,facing),g);
  assert.equal(f.jumpsUsed,1);assert.equal(f.vy,-f.def.jump);
  if(timing==='rising')f.update(g);
  else {while(f.vy<0)f.update(g);if(timing==='falling')for(let i=0;i<8;i++)f.update(g);}
  const y=f.y, drive=f.drive;
  f.handleIntent(intent(true,-facing),g);
  assert.equal(f.y,y,'no teleport');assert.equal(f.jumpsUsed,2);
  assert.equal(f.vy,-f.def.jump*.8);assert.ok(f.vx*facing<0,'reverse direction');
  assert.equal(f.facing,facing,'keep aerial facing');assert.equal(f.airFrames,0);assert.equal(f.stateT,0);
  assert.equal(f.jumpDirection,-1);assert.ok(f.airJumpEffect);assert.equal(h.sounds(),2);
  assert.equal(f.meter,150);assert.equal(f.drive,drive,'jump is free');
  const vx=f.vx,vy=f.vy;
  f.handleIntent(intent(true),g);
  assert.equal(f.jumpsUsed,2);assert.equal(f.vy,vy);assert.equal(f.vx,vx);assert.equal(h.sounds(),2);
  f.draw(h.ctx); // Includes the second-jump ring and production animation sampler.
  while(!f.onGround){f.update(g);assert.ok(f.bodyBox.y>=0,'double jump stays within the vertical play area');}
  assert.equal(f.jumpsUsed,0);assert.equal(f.airJumpEffect,null);
  f.handleIntent(intent(true),g);assert.equal(f.jumpsUsed,1);assert.equal(h.sounds(),3);
  trajectories++;
}
// A neutral second jump keeps horizontal momentum and works immediately after takeoff.
{
  const h=harness(),f=h.g.f1;
  f.handleIntent(intent(true,1),h.g);const vx=f.vx;
  f.handleIntent(intent(true),h.g);assert.equal(f.vx,vx);assert.equal(f.jumpsUsed,2);
  for(let i=0;i<16;i++)f.update(h.g);assert.equal(f.airJumpEffect,null,'effect expires in flight');
}
// Keyboard repeat, rebinds, both control modes and both players use fresh presses.
for(const mode of ['classic','modern'])for(const who of ['p1','p2'])for(const hz of [30,60,120,144]){
  const h=harness(),f=who==='p1'?h.g.f1:h.g.f2,m=h.s.Input.MAP[who];h.s.Input.MODES[who]=mode;
  h.key(m.up);h.tick(3,hz);assert.equal(f.jumpsUsed,1);
  h.key(m.up);h.tick(3,hz);assert.equal(f.jumpsUsed,1,'held/repeat must not double jump');
  h.key(m.up,false);h.tick(3,hz);h.key(m.up);h.tick(3,hz);assert.equal(f.jumpsUsed,2);
  h.key(m.up,false);h.tick(3,hz);h.key(m.up);h.tick(3,hz);assert.equal(f.jumpsUsed,2,'no third jump');
}
{
  const h=harness();h.s.Input.MAP.p1.up=' ';h.key(' ');h.tick();h.key(' ',false);h.tick();h.key(' ');h.tick();
  assert.equal(h.g.f1.jumpsUsed,2,'custom jump binding');
}
for(const who of ['p1','p2']){
  const h=harness(),f=who==='p1'?h.g.f1:h.g.f2,k=h.s.Input.MAP[who].up;
  h.s.Input.setGamepadKeys([k]);h.tick();h.s.Input.setGamepadKeys([k]);h.tick();assert.equal(f.jumpsUsed,1);
  h.s.Input.setGamepadKeys([]);h.tick();h.s.Input.setGamepadKeys([k]);h.tick();assert.equal(f.jumpsUsed,2);
}
// Air attacks cannot be cancelled by jumping, but a finished air normal keeps the one remaining jump.
{
  const h=harness(),f=h.g.f1;
  f.handleIntent(intent(true),h.g);assert.ok(f.startAttack('light'));
  const vy=f.vy;f.handleIntent(intent(true),h.g);assert.equal(f.state,'light');assert.equal(f.vy,vy);
  while(f.attack)f.update(h.g);
  assert.equal(f.onGround,false);f.handleIntent(intent(true),h.g);assert.equal(f.jumpsUsed,2);
}
for(const state of ['hit','ko','grabbed']){
  const h=harness(),f=h.g.f1;f.handleIntent(intent(true),h.g);f.state=state;
  const vy=f.vy;f.handleIntent(intent(true),h.g);assert.equal(f.vy,vy);assert.equal(f.jumpsUsed,1);
}
for(const field of ['hitstun','blockstun','stunned','grabbedBy','throwSequence']){
  const h=harness(),f=h.g.f1;f.handleIntent(intent(true),h.g);f[field]=1;
  const vy=f.vy;f.handleIntent(intent(true),h.g);assert.equal(f.vy,vy);assert.equal(f.jumpsUsed,1,field+' prevents a jump');
}
{
  const h=harness(),f=h.g.f1;f.handleIntent(intent(true),h.g);
  f.takeHit({dmg:1,kb:1,hitstun:3,type:'light'},1,false);
  for(let i=0;i<5;i++)f.update(h.g);
  assert.equal(f.hitstun,0);assert.equal(f.state,'hit');f.handleIntent(intent(true),h.g);
  assert.equal(f.jumpsUsed,1,'cannot escape an air hit after hitstun expires');
  land(f,h.g);f.update(h.g);f.handleIntent(intent(true),h.g);assert.equal(f.jumpsUsed,1,'jump restored after recovery');
}
{
  const h=harness(),f=h.g.f1;assert.ok(f.startAttack('uppercut'));
  while(f.attack)f.update(h.g);
  if(!f.onGround){const vy=f.vy;f.handleIntent(intent(true),h.g);assert.equal(f.vy,vy);assert.equal(f.jumpsUsed,0);}
  // An airborne recovery from any move without a voluntary jump has no air jump.
  f.onGround=false;f.y=300;f.state='jump';f.vy=2;f.handleIntent(intent(true),h.g);assert.equal(f.vy,2);
}
// Round reset must restore the resource and clear the previous jump effect.
{
  const h=harness(),f=h.g.f1;f.handleIntent(intent(true),h.g);f.handleIntent(intent(true),h.g);
  h.g.roundState='done';h.g.bannerT=3;h.tick();
  assert.equal(f.jumpsUsed,0);assert.equal(f.jumpDirection,0);assert.equal(f.airJumpEffect,null);assert.ok(f.onGround);
}
{
  const h=harness();h.s.GameControl.beginMode('training');const old=h.g.f1;
  old.handleIntent(intent(true),h.g);old.handleIntent(intent(true),h.g);old.hp=0;old.startKO(1);
  h.g.trainingResetT=59;h.tick();assert.notEqual(h.g.f1,old);assert.equal(h.g.f1.jumpsUsed,0);
}
console.log(`Double jump checks passed: ${trajectories} character/direction/timing trajectories, keyboard and pad edges, refresh rates, attack/hit restrictions, landing and round/training resets.`);
