// Real keyboard / pad edges and the production 60 Hz fight loop.
const assert=require('node:assert/strict');
const {harness}=require('./gameplay-harness.cjs');
const neutral={move:0,up:false,down:false,block:false};
function setup(index=0,facing=1,who='p1',mode='classic'){
  const h=harness(71),g=h.fight(),s=h.s;g.pve=false;
  const f=new s.Fighter(s.CHARACTERS[index],facing>0?220:800,facing,who.toUpperCase());
  const foe=new s.Fighter(s.CHARACTERS[0],facing>0?800:220,-facing,'FOE');
  g.f1=who==='p1'?f:foe;g.f2=who==='p1'?foe:f;f.foe=foe;foe.foe=f;
  s.Input.MODES[who]=mode;
  return {h,g,s,f,foe,who};
}
function tap(t,kind='forward',pad=false){
  const {h,s,f,who}=t;
  const key=s.Input.MAP[who][f.facing*(kind==='forward'?1:-1)>0?'right':'left'];
  const set=on=>pad?s.Input.setGamepadKeys(on?[key]:[]):h.key(key,on);
  set(true);h.tick(2);set(false);h.tick(2);
  const start=f.x;set(true);h.tick();set(false);
  return start;
}
const distances=[];
for(let i=0;i<6;i++)for(const facing of [1,-1])for(const kind of ['forward','back']){
  const t=setup(i,facing),{h,f}=t,d=f.def.dashes[kind],start=tap(t,kind);
  assert.equal(f.dash?.kind,kind);assert.equal(f.stateT,1);
  for(let frame=1;frame<d.frames;frame++){
    const anim=t.s.Motion60.sample(f.def,'idle',0,{fighter:f});
    assert.equal(anim.name,kind==='forward'?'dashForward':'dashBack');
    assert.equal(anim.dashPhase,Math.min(1,f.stateT/d.travelEnd));
    assert.equal(f.canAct(),false);assert.equal(f.startAttack('light'),false);assert.equal(f.tryJump(1),false);
    h.tick();
  }
  assert.equal(f.dash,null);assert.equal(f.canAct(),true);
  assert.ok(Math.abs(f.x-start-facing*(kind==='forward'?1:-1)*d.travelDistance)<1e-7,`exact distance ${f.def.id}/${facing}/${kind}: ${f.x-start}`);
  const end=f.x;h.tick(30);assert.equal(f.x,end,'no post-dash drift / repeat');
  assert.equal(f.attackId,0);assert.equal(f.drive,6);assert.equal(f.driveBoost,0);
  distances.push({character:f.def.id,facing,kind,frames:d.frames,distance:Math.abs(end-start)});
}
// Neutral dash must not steal a quarter circle, dragon punch or charge attack.
for(const motion of ['quarter','uppercut','charge']){
  const t=setup(motion==='charge'?3:0),{h,f}=t;
  if(motion==='quarter'){
    h.key('s');h.tick();h.key('d');h.tick();h.key('s',false);
  }else if(motion==='uppercut'){
    h.key('d');h.tick();h.key('d',false);h.key('s');h.tick();h.key('d');
  }else{
    h.key('a');h.tick(35);h.key('a',false);h.key('d');
  }
  h.key('f');h.tick();assert.equal(f.dash,null);
  assert.equal(f.attackKind,motion==='quarter'?'special':motion==='uppercut'?'uppercut':'tech');
}
// A dash buffered during global hitstop begins after the freeze, once only.
{
  const t=setup(),{h,g,f}=t;g.hitstop=6;tap(t);assert.equal(f.dash,null);assert.ok(f.bufferedDash);
  h.tick(2);assert.equal(f.dash?.kind,'forward');h.tick(35);assert.equal(f.dash,null);
}
// Both players, modes, controller directions and remapped direction keys.
for(const who of ['p1','p2'])for(const mode of ['classic','modern'])for(const pad of [false,true]){
  const t=setup(0,who==='p1'?1:-1,who,mode);
  t.s.Input.MAP[who].right='9';t.s.Input.MAP[who].left='8';
  tap(t,'back',pad);assert.equal(t.f.dash?.kind,'back');
}
// A held direction (including OS key repeat) and long walking do not double tap.
{
  const t=setup(),{h,f}=t;h.key('d');h.tick(40);
  for(let i=0;i<20;i++){h.key('d');h.tick();assert.equal(f.dash,null);}
  h.key('d',false);h.tick();h.key('d');h.tick();assert.equal(f.dash,null);
}
// Diagonal movement, stale inputs, clearing focus and air taps never auto-dash.
for(const mode of ['diagonal','stale','clear','air']){
  const t=setup(),{h,f,s}=t;
  if(mode==='diagonal')h.key('s');
  if(mode==='air')f.tryJump(0);
  h.key('d');h.tick(2);h.key('d',false);h.tick(mode==='stale'?20:2);
  if(mode==='clear')s.Input.clear();
  h.key('d');h.tick();h.key('d',false);assert.equal(f.dash,null,mode);
  h.tick(70);assert.equal(f.dash,null,mode+' does not trigger later');
}
// Very fast keyboard taps are preserved even inside one display frame.
{
  const t=setup();t.h.key('d');t.h.key('d',false);t.h.key('d');t.h.tick();
  assert.equal(t.f.dash?.kind,'forward');
}
// Consumed second tap cannot become a fake first tap just by remaining held.
{
  const t=setup(),{h,f}=t;h.key('d');h.tick();h.key('d',false);h.tick();h.key('d');h.tick(12);
  h.key('d',false);h.tick();h.key('d');h.tick();h.key('d',false);
  h.tick(10);assert.equal(f.dash,null,'three taps trigger only one dash');
}
// The latest input wins, and only the last few recovery frames can buffer a dash.
for(const stun of [3,12]){
  const t=setup(),{h,f}=t;h.key('d');h.tick();h.key('d',false);h.tick();
  f.state='hit';f.hitstun=stun;
  h.key('d');h.tick();h.key('d',false);h.tick(stun);
  assert.equal(!!f.dash,stun===3,'six-frame recovery buffer');
}
{
  const t=setup(),{h,f}=t;tap(t);h.tick(f.def.dashes.forward.frames-5);
  h.key('f');h.tick();h.key('f',false);
  assert.ok(f.dash);assert.equal(f.attack,null);
  h.tick(4);assert.equal(f.attackKind,'light','attack buffered into first actionable frame');
}
{
  const t=setup(),{h,f}=t;h.key('d');h.tick();h.key('d',false);h.tick();h.key('d');h.key('f');h.tick();
  assert.equal(f.dash,null);assert.equal(f.attackKind,'light','attack has priority over dash');
}
// No blocking / air cancelling; facing and direction remain locked on crossover.
{
  const t=setup(),{h,f,foe}=t;tap(t);const facing=f.facing;
  foe.x=f.x-300;h.key('a');h.key('w');h.key('z');h.tick(3);
  assert.ok(f.dash);assert.equal(f.facing,facing);assert.equal(f.onGround,true);
  assert.equal(f.blocking,false);assert.equal(f.parrying,false);
}
// Wall / body collisions stop travel while preserving full recovery.
for(const obstacle of ['wall','body']){
  const t=setup(),{h,f,foe}=t;
  if(obstacle==='wall'){f.x=1080;foe.x=900;f.facing=-1;f.startDash('back');}
  else{foe.x=f.x+80;f.startDash('forward');}
  h.tick(8);assert.ok(f.dash?.travelBlocked);const stopped=f.x;
  h.tick(6);assert.equal(f.x,stopped);assert.equal(f.canAct(),false);
  if(obstacle==='body')assert.ok(foe.x-f.x>=f.width);
  h.tick(12);assert.equal(f.dash,null);
}
{
  const t=setup(),{h,f,foe}=t;f.x=100;foe.x=820;f.startDash('back');h.tick(8);
  assert.ok(f.dash.travelBlocked);assert.equal(foe.x,820);assert.equal(f.x,80);
  h.tick(7);assert.equal(f.x,80);assert.equal(f.canAct(),false);
}
// Simulation distances are independent of display refresh rate.
for(const hz of [30,60,120]){
  const t=setup(),start=tap(t);t.h.tick(60,hz);
  assert.equal(t.f.dash,null);assert.ok(Math.abs(t.f.x-start-136)<1e-7);
}
// Losing focus discards a queued dash without interrupting a committed action.
{
  const t=setup(),{f,s,h}=t;f.hitstun=3;f.state='hit';f.queueDash('back');s.Input.clear();h.tick(6);
  assert.equal(f.dash,null);f.startDash('forward');s.Input.clear();h.tick();assert.ok(f.dash);
}
// Burnout still permits ordinary dash, without spending drive or boosting attacks.
{
  const t=setup(),{h,f}=t;f.drive=0;f.burnout=true;tap(t);
  assert.ok(f.dash);assert.equal(f.driveBoost,0);assert.equal(f.burnout,true);
}
// Throw immunity includes command grabs, but not strikes or incoming waves.
for(const kind of ['back','forward']){
  const t=setup(),{f,g}=t;f.startDash(kind);
  const hp=f.hp,res=f.takeHit({grab:true,dmg:10,kb:5,hitstun:20,type:'heavy'},-1,false);
  assert.equal(!!res.ignored,kind==='back');assert.equal(f.hp<hp,kind==='forward');
  if(kind==='back'){t.foe.startAttack('throw');t.foe.beginThrow(f,g);assert.equal(!!f.grabbedBy,false);}
}
for(const attack of ['throw','commandThrow','light','wave']){
  const t=setup(),{h,f,foe,g,s}=t;f.x=-150;foe.x=-82;foe.facing=-1;
  if(attack==='commandThrow')foe.def=s.CHARACTERS[2];
  f.startDash('back');
  if(attack==='wave'){
    const p=new s.Projectile(foe,-1,foe.def.moves.special);p.x=f.x+24;p.y=f.y-100;p.vx=-2;g.projectiles.push(p);
  }else foe.startAttack(attack==='commandThrow'?'tech':attack);
  const hp=f.hp;h.tick(20);
  if(attack==='throw'||attack==='commandThrow'){
    assert.equal(f.hp,hp);assert.equal(!!f.grabbedBy,false);assert.equal(!!foe.throwSequence,false);
  }else{
    assert.ok(f.hp<hp,attack+' hits a backdash');assert.equal(f.dash,null,'hit interrupts travel');
  }
}
// Existing drive rush and contact cancel have priority over ordinary front dash.
{
  const t=setup(),{h,f}=t;h.key('z');tap(t);assert.equal(f.attackKind,'driveRush');assert.equal(f.dash,null);assert.ok(f.drive<5);
}
{
  const t=setup(),{f}=t;f.startAttack('medium');f.attackContact=true;f.contactFrame=0;
  tap(t);assert.equal(f.attackKind,'driveRush');assert.equal(f.dash,null);assert.ok(f.drive>=2.99&&f.drive<3.02);
}
// Resetting a round clears the committed dash and queued movement.
{
  const t=setup(),{g,h,f}=t;f.startDash('forward');f.queueDash('back');g.roundState='done';g.bannerT=3;h.tick();
  assert.equal(f.dash,null);assert.equal(f.bufferedDash,null);
}
// CPU uses committed, one-shot dashes with difficulty-specific cooldowns.
const aiTiers=[];
for(const [difficulty,cooldown] of [[.6,150],[.85,105],[1,75]]){
  for(const kind of ['forward','back']){
    const h=harness(71),g=h.fight(0,difficulty,kind==='forward'?600:160),f=g.f2,ai=g.ai;
    ai.chooseStrategy=()=>{ai.strategy=kind==='forward'?'approach':'bait';};
    ai.weighted=pool=>pool.find(c=>c.kind===(kind==='forward'?'dashForward':'dashBack'));
    const seen={x:g.f1.x,y:g.f1.y,onGround:true,attack:null,projectiles:[]};
    const it=ai.neutral(f,seen,g);assert.equal(it.dash,kind);assert.equal(ai.dashCd,cooldown);
    f.handleIntent(it,g);assert.equal(f.dash?.kind,kind);
    assert.equal(ai.neutral(f,seen,g).dash,undefined,'held AI intent does not repeat dash');
    h.tick(30);ai.decisionCd=ai.dashCd=0;
    let pool=[];ai.weighted=p=>{pool=p;return null;};
    ai.neutral(f,{...seen,projectiles:[{x:f.x-50}]},g);
    assert.ok(!pool.some(c=>c.kind.startsWith('dash')),'visible projectile suppresses neutral dash');
    aiTiers.push({difficulty:ai.level,kind,cooldown});
  }
}
console.log(JSON.stringify({passed:true,trajectories:distances.length,distances,aiTiers,input:'keyboard / pad / remapping / both modes / both players',combat:'buffers / commitments / collisions / throws / strikes / projectiles / burnout / Drive Rush'},null,2));
