// CPU behavior regression checks using the production 60 Hz game loop.
const assert=require('node:assert/strict');
const {harness}=require('./gameplay-harness.cjs');
const report=[];
for(const diff of [.6,.85,1])for(let index=0;index<6;index++){
  const h=harness(3400+index),g=h.fight(index,diff),cpu=g.f2;
  const actions=[],projectileFrames=[];let walked=0,jumps=0,maxCombo=0,lastId=0,farWalk=0,movement=0,farMovement=0;
  const movementKinds=new Set();
  for(let t=0;t<1800;t++){
    const dist=Math.abs(g.f1.x-cpu.x),beforeX=cpu.x;
    h.tick();
    if(Math.abs(cpu.x-beforeX)>.1&&!['hit','ko','grabbed'].includes(cpu.state)){
      movement++;if(dist>350)farMovement++;
      movementKinds.add(cpu.state==='jump'?'jump':cpu.attack?.travelDistance?'advance':'footwork');
    }
    if(cpu.state==='walk'&&Math.abs(cpu.vx)>.1){walked++;if(dist>350)farWalk++;}
    if(!cpu.onGround&&cpu.state==='jump')jumps++;
    if(cpu.attackId!==lastId){lastId=cpu.attackId;actions.push(cpu.attackKind);if(cpu.attack?.projectile&&cpu.attack.category!=='super')projectileFrames.push(g.ai.clock);}
    maxCombo=Math.max(maxCombo,g.f1.comboHits);
    assert.ok(cpu.meter>=0&&cpu.drive>=0&&Number.isFinite(cpu.x)&&Number.isFinite(cpu.y));
  }
  const unique=[...new Set(actions)];
  assert.ok(movement>30&&movementKinds.size>=2,`${cpu.def.id}/${diff} varies movement`);
  assert.ok(farMovement>10,`${cpu.def.id}/${diff} approaches from far distance`);
  assert.ok(unique.length>=3,`${cpu.def.id}/${diff} varies attacks: ${unique}`);
  for(let i=1;i<projectileFrames.length;i++)assert.ok(projectileFrames[i]-projectileFrames[i-1]>=g.ai.profile.projectileCd,`${cpu.def.id}/${diff} projectile cooldown`);
  report.push({character:cpu.def.id,difficulty:g.ai.level,walked,farWalk,movement,farMovement,jumps,attacks:actions.length,projectiles:projectileFrames.length,unique,maxCombo,damage:10000-g.f1.hp});
}
// Reaction tiers: a fresh threat is not visible until the configured delay.
for(const diff of [.6,.85,1]){
  const h=harness(9),g=h.fight(0,diff,150),ai=g.ai;
  g.f1.startAttack('heavy');
  for(let n=0;n<ai.reactionFrames;n++)assert.deepEqual(JSON.parse(JSON.stringify(ai.think(g.f2,g.f1,g))),{move:0,up:false,down:false,block:false});
  assert.ok(ai.observe(g.f2,g.f1,g),'threat becomes visible after reaction delay');
}
// Shots cannot resume until meaningful movement occurs, even if the cooldown expires.
{
  const h=harness(),g=h.fight(0,1),ai=g.ai;
  assert.ok(ai.shotAllowed(g.f2,g));ai.emit(g.f2,'special');
  ai.projectileCd=0;assert.equal(ai.shotAllowed(g.f2,g),false);
  ai.footwork=ai.profile.shotFootwork;assert.ok(ai.shotAllowed(g.f2,g));
  g.projectiles.push(new h.s.Projectile(g.f2,-1,g.f2.def.moves.special));assert.equal(ai.shotAllowed(g.f2,g),false);
}
// Confirm decisions consume the real cancel window and never cancel on block or miss.
for(const connected of [false,true]){
  const h=harness(33),g=h.fight(0,1,100),f=g.f2,ai=g.ai;
  assert.ok(f.startAttack('medium'));f.stateT=f.attack.startup;f.attackContact=connected;f.attackConnected=connected;f.contactFrame=f.stateT;
  const seen={x:g.f1.x,y:g.f1.y,onGround:true,hitstun:20,blockstun:0,hp:100};
  assert.equal(ai.confirm(f,seen,g),null);
  f.stateT+=5;
  const next=ai.confirm(f,seen,g);
  if(!connected)assert.equal(next,null);else if(next){assert.ok(f.canStartAttack(next.command));assert.ok(ai.affordable(f,next.command,next.commandOptions));}
  f.attackContact=true;f.attackConnected=false;assert.equal(ai.confirm(f,seen,g),null,'blocked attacks stop confirmation');
}
// Each difficulty and every character can execute an actual confirmed continuation.
let confirmations=0;
for(let index=0;index<6;index++){
  const h=harness(100+index),g=h.fight(index,1,130),f=g.f2,ai=g.ai;
  f.meter=300;assert.ok(f.startAttack('medium'));f.stateT=f.attack.startup;f.attackContact=f.attackConnected=true;f.contactFrame=f.stateT;
  const seen={x:g.f1.x,y:g.f1.y,onGround:true,hitstun:30,blockstun:0,hp:100};
  ai.confirm(f,seen,g);ai.confirmRoll=0;ai.confirmDelay=2;f.stateT=f.contactFrame+3;
  const next=ai.confirm(f,seen,g);assert.ok(next,`${f.def.id} confirm`);
  f.handleIntent(next,g);assert.equal(f.attackKind,next.command);assert.ok(f.meter>=0&&f.drive>=0);confirmations++;
}
// Empty resources, KO and active recovery do not create illegal queued attacks.
{
  const h=harness(),g=h.fight(0,1),f=g.f2,ai=g.ai;f.meter=0;f.drive=0;f.burnout=true;
  assert.equal(ai.affordable(f,'super'),false);assert.equal(ai.affordable(f,'driveRush'),false);assert.equal(ai.affordable(f,'tech',{od:true}),false);
  f.startKO(1);assert.equal(ai.think(f,g.f1,g).command,undefined);
}
// Difficulty changes reuse the same selection values in PvE and training.
{
  const h=harness(),g=h.fight();h.s.GameControl.setDifficulty(.6);assert.equal(g.ai.level,'easy');
  h.s.GameControl.setDifficulty(1);assert.equal(g.ai.level,'hard');
  for(let i=0;i<20;i++)g.ai.think(g.f2,g.f1,g);
  g.ai.projectileCd=90;g.roundState='done';g.bannerT=3;h.tick();
  assert.equal(g.ai.observations.length,0,'new round forgets old opponent observations');assert.equal(g.ai.projectileCd,0);
  h.s.GameControl.beginMode('training');h.s.GameControl.applyTraining({opponent:'0.85',stage:0,p1:{character:0},p2:{character:2}});
  assert.equal(g.ai.level,'normal');
}
// A reproducible incoming projectile measures defensive experience without input reading.
const defenseReport=[];
for(const diff of [.6,.85,1]){
  let avoided=0,blocked=0,airDodges=0;
  for(let seed=1;seed<=48;seed++){
    const h=harness(seed*71),g=h.fight(0,diff),s=h.s;
    g.f1=new s.Fighter(s.CHARACTERS[3],100,1,'P1');
    g.f2.hp=g.f2.maxHp=100;g.ai.decisionCd=1000;g.ai.intent={move:0,up:false,down:false,block:false};
    g.f1.startAttack('tech');
    for(let n=0;n<120;n++){
      const it=g.ai.think(g.f2,g.f1,g);g.f2.handleIntent(it,g);
      g.f1.update(g);g.f2.update(g);
      for(const p of g.projectiles){p.update();if(p.dead)continue;const res=p.hitTarget(g.f2);if(res?.blocked)blocked++;}
      g.projectiles=g.projectiles.filter(p=>!p.dead);
    }
    if(g.f2.hp===100){avoided++;if(g.f2.x<600)airDodges++;}
  }
  defenseReport.push({difficulty:diff,trials:48,avoided,blocked,airDodges});
}
assert.ok(defenseReport[1].avoided>defenseReport[0].avoided,'normal defends more consistently than easy');
assert.ok(defenseReport[2].avoided>defenseReport[1].avoided,'hard defends more consistently than normal');
console.log(JSON.stringify({result:'passed',confirmations,matchFrames:32400,defense: defenseReport,matches:report},null,2));
