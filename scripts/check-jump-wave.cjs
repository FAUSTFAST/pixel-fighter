// Same scenario used by the animated replay; no browser or game mocks for combat.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),s={console,Math,document:{},Audio2:{sfx:{jump(){}}}};
s.window=s;vm.createContext(s);
for(const file of ['utils','characters','styles','combat-rules','strike-art','strike-motion','combat-spacing','fighter','jump-wave-scenario'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),s,{filename:file+'.js'});
const summaries={};
for(const [name,test]of Object.entries(s.JumpWaveScenario.cases)){
  const runs=Object.fromEntries(['stand','single','double'].map(mode=>[mode,s.JumpWaveScenario.simulate(mode,test.options)]));
  summaries[name]=Object.fromEntries(Object.entries(runs).map(([mode,r])=>[mode,r.result]));
  for(const [mode,r]of Object.entries(runs)){
    assert.equal(r.result.spawned,1,'one real projectile is emitted');assert.equal(r.result.invincible,false);
    assert.ok(r.result.grounded,'replay includes landing');
    assert.equal(r.result.jumps,mode==='stand'?0:mode==='single'?1:2);
    assert.equal(r.frames.length,151);
    assert.ok(r.frames.every(f=>!f.defender.blocking&&!f.defender.invuln&&!f.defender.trainingInvincible),'no hidden defense');
    if(r.result.hits)assert.equal(r.result.damage,r.frames[0].attacker.def.moves[r.settings.move].dmg);
  }
  assert.equal(runs.stand.result.hits,1);assert.equal(runs.single.result.hits,1);
  if(name==='ground'){
    const d=runs.double;
    assert.equal(d.result.hits,0);assert.equal(d.result.damage,0);assert.equal(d.result.hp,100);assert.ok(d.result.passed);
    assert.ok(Math.abs(d.result.clearance-46.2)<1e-6);
    const events=d.events;assert.ok(events.find(e=>e.type==='second').frame<events.find(e=>e.type==='pass').frame);
    assert.ok(events.find(e=>e.type==='pass').frame<events.find(e=>e.type==='land').frame);
    // Only the second jump differs before its input frame.
    for(let i=0;i<d.settings.secondJump;i++){
      assert.equal(d.frames[i].defender.y,runs.single.frames[i].defender.y);
      assert.equal(d.frames[i].defender.hp,runs.single.frames[i].defender.hp);
    }
    assert.equal(d.frames[113].passed,true);assert.equal(d.frames[124].defender.onGround,true);
  }else{assert.equal(runs.double.result.hits,1);assert.equal(runs.double.result.damage,17);}
}
// Projectile hit extraction preserves invulnerability, arming, guard and contact.
{
  const attacker=new s.Fighter(s.CHARACTERS[2],400,-1,'P2'),target=new s.Fighter(s.CHARACTERS[0],300,1,'P1');
  assert.ok(attacker.startAttack('special'));
  const make=()=>{const p=new s.Projectile(attacker,-1,{...attacker.attack,armFrames:2});p.x=300;p.y=420;return p;};
  const p=make();assert.equal(p.hitTarget(target),null);p.t=2;
  target.invuln=1;assert.equal(p.hitTarget(target),null);target.invuln=0;
  target.trainingInvincible=true;assert.equal(p.hitTarget(target),null);target.trainingInvincible=false;
  target.blocking=true;target.crouching=true;const block=p.hitTarget(target);
  assert.equal(block.blocked,true);assert.equal(target.hp,100);assert.ok(p.dead);assert.equal(attacker.attackConnected,false);
  assert.equal(p.hitTarget(target),null,'consumed projectile cannot hit twice');
  target.blocking=false;target.blockstun=0;const q=make();q.t=2;
  assert.equal(q.hitTarget(target).dmg,19);assert.ok(attacker.attackContact);assert.ok(attacker.attackConnected);
}
for(const file of ['jump-wave-replay','fighter','game'])new vm.Script(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'));
console.log(JSON.stringify({result:'passed',cases:summaries},null,2));
