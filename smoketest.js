// Headless smoke test v2: stub DOM/canvas/AudioContext, load all game files,
// run frames with simulated input incl. motion buffer, render UI, catch runtime errors.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctxHandler = {
  get(target, prop) {
    if (prop in target) return target[prop];
    return (...args) => {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
        return { addColorStop() {} };
      if (prop === 'measureText') return { width: 10 };
      return undefined;
    };
  },
  set(target, prop, val) { target[prop] = val; return true; },
};
function makeCtx() { return new Proxy({ canvas: { width: 960, height: 540 } }, ctxHandler); }

// mock AudioContext
class FakeParam { constructor(){this.value=0;} setValueAtTime(){} exponentialRampToValueAtTime(){} linearRampToValueAtTime(){} }
class FakeNode { constructor(){this.gain=new FakeParam();this.frequency=new FakeParam();this.type='';} connect(){} start(){} stop(){} }
class FakeAudioCtx {
  constructor(){ this.currentTime=0; this.sampleRate=44100; this.state='running'; this.destination={}; }
  createGain(){return new FakeNode();}
  createOscillator(){return new FakeNode();}
  createBiquadFilter(){return new FakeNode();}
  createBufferSource(){return new FakeNode();}
  createBuffer(ch,n){ return { getChannelData: () => new Float32Array(n) }; }
  resume(){}
}

const listeners = {};
const timers = [];
const sandbox = {
  console,
  performance: { now: () => 1000 },
  requestAnimationFrame: () => 0,
  setInterval: () => { const id = timers.length; timers.push(id); return id; },
  clearInterval: () => {},
  setTimeout: () => 0,
  AudioContext: FakeAudioCtx,
  webkitAudioContext: FakeAudioCtx,
  document: { getElementById: () => ({ getContext: () => makeCtx(), width: 960, height: 540 }) },
  window: {},
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
};
sandbox.window.AudioContext = FakeAudioCtx;
sandbox.window.addEventListener = sandbox.addEventListener;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const files = ['input','audio','utils','characters','stages','fighter','ai','ui','game'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, 'js', f + '.js'), 'utf8');
  try { vm.runInContext(code, sandbox, { filename: f + '.js' }); }
  catch (e) { console.error('LOAD FAIL', f, e); process.exit(1); }
  for (const k of Object.keys(sandbox.window)) if (!(k in sandbox)) sandbox[k] = sandbox.window[k];
}
for (const k of Object.keys(sandbox.window)) sandbox[k] = sandbox.window[k];

const { Fighter, AI, CHARACTERS, STAGES, Input, Audio2, UI, U } = sandbox.window;
if (!sandbox.window.GAME) { console.error('GAME not exported'); process.exit(1); }
console.log('Loaded. Chars:', CHARACTERS.length, 'Stages:', STAGES.length, 'Audio2:', !!Audio2);

// Audio API surface
let errors = 0;
function safe(fn, label){ try { fn(); } catch(e){ errors++; console.error('ERR', label, e.message); } }
['hitLight','hitHeavy','hitSpecial','block','whiff','jump','special','fireball','ko','roundStart','fight','menuMove','menuSelect','menuBack','win']
  .forEach(s => safe(()=>Audio2.sfx[s](), 'sfx.'+s));
safe(()=>Audio2.music.play('dojo'), 'music.play');
safe(()=>Audio2.music.stop(), 'music.stop');
safe(()=>{ Audio2.toggleMusic(); Audio2.toggleSfx(); Audio2.toggleMusic(); Audio2.toggleSfx(); }, 'toggles');

// Motion-input + weak special
const f1 = new Fighter(CHARACTERS[0], 300, 1, 'P1');   // projectile char
const f2 = new Fighter(CHARACTERS[2], 660, -1, 'P2');
const g = { projectiles: [], effects: [], f1, f2 };
// simulate QCF motion buffer directly
['p1'].forEach(()=>{});
const mbuf = [];
// feed motion via Input.recordMotion is keyed on real key state; instead test checkQCF path by
// pushing a hand-made buffer through the public API isn't exposed — so exercise startAttack motion directly:
safe(()=>{ f1.meter = 0; const ok = f1.startAttack('special', { motion:true }); if(!ok) throw new Error('motion special should fire w/o meter'); if(!f1._specialWeak) throw new Error('weak flag not set'); }, 'motion-special-weak');
safe(()=>{ const hb = null; }, 'noop');
// full special with meter
const f3 = new Fighter(CHARACTERS[0], 300, 1, 'P1'); f3.meter = 100;
safe(()=>{ const ok = f3.startAttack('special', {}); if(!ok) throw new Error('meter special should fire'); if(f3._specialWeak) throw new Error('should be full power'); }, 'full-special');
// direct-key special w/o meter should fail
const f4 = new Fighter(CHARACTERS[0], 300, 1, 'P1'); f4.meter = 0;
safe(()=>{ const ok = f4.startAttack('special', {}); if(ok) throw new Error('no-meter direct special must not fire'); }, 'nofire-direct');

// weak hitbox damage lower than full
const fa = new Fighter(CHARACTERS[2], 300, 1, 'P1'); fa.meter=100; fa.startAttack('special',{});
fa.stateT = fa.attack.startup + 1;
const fullHb = fa.getHitBox();
const fb = new Fighter(CHARACTERS[2], 300, 1, 'P1'); fb.meter=0; fb.startAttack('special',{motion:true});
fb.stateT = fb.attack.startup + 1;
const weakHb = fb.getHitBox();
safe(()=>{ if(fullHb && weakHb && !(weakHb.dmg < fullHb.dmg)) throw new Error(`weak(${weakHb&&weakHb.dmg}) !< full(${fullHb&&fullHb.dmg})`); }, 'weak<full dmg');

// run a live loop of combat
const ai = new AI(f2, 0.9);
const A = new Fighter(CHARACTERS[3], 300, 1, 'P1');
const B = new Fighter(CHARACTERS[5], 660, -1, 'P2');
const g2 = { projectiles: [], effects: [], f1:A, f2:B };
const ai2 = new AI(B, 0.9);
for (let frame=0; frame<1500; frame++) {
  const it1 = { move:(frame%100<50?1:-1), up:frame%89===0, down:frame%7===0, light:frame%19===0, heavy:frame%41===0, special:frame%160===0, block:frame%29===0 };
  safe(()=>{ A.facing=A.x<=B.x?1:-1; B.facing=B.x<=A.x?1:-1; }, 'face');
  safe(()=>A.handleIntent(it1,g2), 'A.intent');
  safe(()=>{ const r=ai2.think(B,A,g2); B.handleIntent(r,g2); }, 'ai');
  safe(()=>A.update(g2), 'A.update');
  safe(()=>B.update(g2), 'B.update');
  safe(()=>{ for(const p of g2.projectiles)p.update(); g2.projectiles=g2.projectiles.filter(p=>!p.dead); }, 'proj');
  safe(()=>{ const hb=A.getHitBox(); if(hb&&!A.attackHasHit&&U.overlap(hb,B.bodyBox)){A.attackHasHit=true;B.takeHit(hb,A.facing,false);} }, 'melee');
  if (B.hp<=0){B.hp=B.maxHp;B.state='idle';B.attack=null;B.hitstun=0;B.koFall=0;}
  if (A.hp<=0){A.hp=A.maxHp;A.state='idle';A.attack=null;A.hitstun=0;}
  const ctx=makeCtx();
  safe(()=>A.draw(ctx),'A.draw'); safe(()=>B.draw(ctx),'B.draw');
  safe(()=>{for(const p of g2.projectiles)p.draw(ctx);},'projdraw');
}

// UI screens
const ctx=makeCtx();
safe(()=>UI.title(ctx,1),'UI.title');
safe(()=>UI.mode(ctx,1,0),'UI.mode');
safe(()=>UI.difficulty(ctx,1,1),'UI.difficulty');
safe(()=>UI.charSelect(ctx,1,{p1:0,p2:2},{p1:false,p2:false},false),'UI.charSelect');
safe(()=>UI.stageSelect(ctx,1,0),'UI.stageSelect');
safe(()=>UI.hud(ctx,A,B,1,88),'UI.hud');
safe(()=>UI.result(ctx,1,A.name,A.def),'UI.result');
safe(()=>UI.roundBanner(ctx,'第1回合','FIGHT!',0.5),'UI.banner');
safe(()=>UI.pauseOverlay(ctx,A,B,false),'UI.pauseOverlay');

console.log(errors===0 ? 'SMOKE v2 PASSED (audio+motion+1500 combat frames+UI)' : ('SMOKE v2 FAILED: '+errors+' errors'));
process.exit(errors===0?0:1);
