// Verify the promised startup data against real hitboxes, spawns and authored poses.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {harness}=require('./gameplay-harness.cjs');
const root=path.resolve(__dirname,'..'),h=harness(),s=h.s;
const expected={
  ryu: [5,6,6,7,9,10,12,15,15,14,6,11,9,18,9,9,9],
  mei: [5,6,6,7,9,10,11,13,15,10,6,21,15,8,7,9,7],
  tank:[6,8,8,9,11,12,14,18,18,20,9,18,7,25,11,9,7],
  volt:[5,6,6,7,9,10,11,14,15,13,5,8,11,16,6,11,6],
  kaze:[6,7,7,8,9,10,13,15,15,18,7,12,11,21,7,8,9],
  sage:[6,7,7,8,9,10,14,16,15,20,8,16,21,24,9,11,12],
};
const keys=['light','lightKick','lowKick','medium','mediumKick','lowMediumKick','heavy','heavyKick','sweep',...s.CombatRules.specials,...s.CombatRules.supers];
let variants=0,preparationFrames=0;
const results=[];
for(const c of s.CHARACTERS){
  assert.deepEqual(Array.from(keys,k=>c.moves[k].startup),expected[c.id],c.id+' startup contract');
  assert.equal(c.moves.throw.startup,5);assert.equal(c.moves.driveRush.startup,1);assert.equal(c.moves.impact.startup,26);
  for(const kind of [...keys,'throw','impact'])for(const strength of (s.CombatRules.isSpecial(kind)?[1,2,3]:[2]))for(const od of (s.CombatRules.isSpecial(kind)?[false,true]:[false])){
    const f=new s.Fighter(c,400,1,'P1');f.meter=300;
    const g={projectiles:[]};assert.equal(f.startAttack(kind,{strength,od}),true);
    const m=f.attack,shots=[],boxes=[];
    assert.ok(!m.hitFrames||m.hitFrames[0]===m.startup);
    assert.ok(!m.shots||m.shots[0]===m.startup);
    for(let t=1;t<=m.startup+m.active+m.recovery;t++){
      const before=g.projectiles.length;f.update(g);
      if(g.projectiles.length>before)shots.push(t);
      if(f.getHitBox())boxes.push(t);
      if(t<m.startup){assert.equal(f.getHitBox(),null,'no early melee');assert.equal(g.projectiles.length,0,'no early projectile');preparationFrames++;}
    }
    if(m.projectile)assert.deepEqual(shots,Array.from(m.shots||[m.startup]),c.id+'/'+kind+' release times');
    else if(!m.counter){assert.equal(boxes[0],m.startup,c.id+'/'+kind+' first active frame');assert.equal(boxes.at(-1),m.startup+m.active-1);}
    assert.equal(f.attack,null,'same full active / recovery stages complete');
    if(od&&kind==='uppercut')assert.equal(m.invincible,m.startup+5,'OD startup protection follows actual startup');
    variants++;
  }
  results.push({character:c.id,startups:Object.fromEntries(keys.map(k=>[k,c.moves[k].startup]))});
}
// Read the real animation catalog and resource timing, without decoding PNGs.
s.__manifest=require('./effective-animation-catalog.cjs').effectiveCatalog();
s.__timing=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/animation-v7/attack-timing.json'),'utf8'));
const source=fs.readFileSync(path.join(root,'js/arcade-animation.js'),'utf8');
vm.runInContext(source.slice(0,source.indexOf('  const loading=fetch('))+`
  attackTiming=__timing;
  for(const [id,clips] of Object.entries(__manifest.characters)){
    for(const clip of Object.values(clips))clip.sprites=clip.frames.map(()=>({}));ready.set(id,clips);
  }
  window.DrawnAnimation={selection};
})();`,s);
let poseChecks=0;
for(const c of s.CHARACTERS)for(const kind of keys){
  const m=c.moves[kind];if(m.counter)continue;
  const poseAt=(t,air=false)=>s.DrawnAnimation.selection(c,s.Motion60.sample(c,m.pose,0,{attack:m,kind,attackT:t,fighter:{stateT:t,onGround:!air}}));
  const contact=poseAt(m.startup);
  assert.equal(contact.index,contact.data.timeline?4:3,'first active pose');
  const windup=new Set();
  for(let t=0;t<m.startup;t++){
    const prep=poseAt(t);assert.equal(prep.data.owner,c.id);assert.ok(prep.sprite);windup.add(prep.clip+':'+prep.index);
    if(prep.clip===contact.clip)assert.ok(prep.index<contact.index,'painted preparation precedes the contact drawing');
    if(s.CombatRules.isNormal(kind))assert.match(poseAt(t,true).clip,/^air(Punch|Kick)$/,'air preparation stays airborne');
    poseChecks++;
  }
  if(['heavy','heavyKick','special'].includes(kind)&&!m.launch)assert.ok(windup.size>=2,'heavy and cast moves visibly prepare before release');
}
// Actual keyboard input / game loop / refresh rates: sound and first hit agree.
for(const hz of [30,60,120])for(const [key,kind] of [['f','light'],['t','medium'],['g','heavy']]){
  const t=harness(),g=t.fight(0,.85,68);g.pve=false;
  const hits=[],sounds=[];t.s.Audio2.sfx=new Proxy({}, {get:(_,name)=>()=>{if(name==='whiff')sounds.push(g.f1.stateT);}});
  const take=g.f2.takeHit.bind(g.f2);g.f2.takeHit=(...args)=>{hits.push(g.f1.stateT);return take(...args);};
  t.key(key);t.tick(1,hz);t.key(key,false);t.tick(80,hz);
  assert.deepEqual(sounds,[g.f1.def.moves[kind].startup]);assert.equal(hits[0],g.f1.def.moves[kind].startup);
}
console.log(JSON.stringify({passed:true,variants,preparationFrames,poseChecks,refreshRates:[30,60,120],results},null,2));
