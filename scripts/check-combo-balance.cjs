// Frame relationships and damage regression checks in the production game loop.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness}=require('./gameplay-harness.cjs');
const neutral=()=>({move:0,up:false,down:false,block:false});
function setup(index=0,defender=0,distance=100,corner=false,facing=1){
  const h=harness(41),g=h.fight(defender,.85,distance),s=h.s;
  g.pve=false;g.training=true;
  g.f1=new s.Fighter(s.CHARACTERS[index],corner?(facing>0?1110-distance:-150+distance):400,facing,'P1');
  g.f2=new s.Fighter(s.CHARACTERS[defender],g.f1.x+facing*distance,-facing,'P2');
  g.f1.foe=g.f2;g.f2.foe=g.f1;
  for(const f of [g.f1,g.f2]){f.hp=f.maxHp=10000;f.meter=300;}
  const hits=[],actions=[];let frame=0;
  for(const f of [g.f1,g.f2]){
    const take=f.takeHit.bind(f),start=f.startAttack.bind(f);
    f.takeHit=(hit,dir,blocked)=>{
      const res=take(hit,dir,blocked);
      if(!res.ignored)hits.push({frame,target:f.label,kind:hit.kind,blocked:res.blocked,damage:res.dmg,scale:f.lastDamageScale,combo:f.comboHits,moves:f.comboMoves});
      return res;
    };
    f.startAttack=(kind,opts)=>{const ok=start(kind,opts);if(ok)actions.push({frame,player:f.label,kind,id:f.attackId});return ok;};
  }
  let input=()=>neutral();
  s.CombatControls.collect=(f,it)=>it;
  s.CombatControls.read=(who,f)=>({...neutral(),...input(who,f,frame)});
  return {h,g,s,hits,actions,setInput(fn){input=fn;},tick(n=1){for(let i=0;i<n;i++){h.tick();frame++;}},get frame(){return frame;}};
}
const spam=[];
// Every matchup, both corner orientations and center stage. Attack input is
// offered on EVERY frame, including hitstop, more aggressively than a keyboard.
for(let i=0;i<6;i++)for(let j=0;j<6;j++)for(const [corner,facing] of [[false,1],[true,1],[true,-1]]){
  const t=setup(i,j,68,corner,facing),{g}=t;
  t.setInput(who=>who==='p1'?{command:'light'}:neutral());
  let free=0,maxCombo=0;
  for(let n=0;n<400;n++){t.tick();if(g.f2.comboHits&&g.f2.canAct())free++;maxCombo=Math.max(maxCombo,g.f2.comboHits);}
  assert.ok(free>20,`${g.f1.def.id}/${g.f2.def.id} must regain control`);
  assert.ok(maxCombo<=3,`${g.f1.def.id}: unending jab combo ${maxCombo}`);
  if(corner)assert.ok(Math.abs(g.f2.x-g.f1.x)>100,'corner recoil pushes attacker away');
  spam.push({attacker:g.f1.def.id,defender:g.f2.def.id,corner,facing,maxCombo,free});
}
// Switching between the three light buttons cannot bypass the chain limit.
for(let index=0;index<6;index++){
  const t=setup(index,0,68,true),f=t.g.f1,cycle=['light','lightKick','lowKick'];
  t.setInput(who=>who==='p1'?{command:cycle[f.attackId%3]}:neutral());
  t.tick(400);assert.ok(Math.max(...t.hits.map(h=>h.combo))<=3,'alternating lights remain finite');
}
// After being hit, hold back. After blocking, buffer a fast jab to take the turn.
const reversals=[];
for(let index=0;index<6;index++){
  const t=setup(index,0,68,true);
  t.setInput(who=>who==='p1'?{command:'light'}:{block:true,command:t.hits.some(h=>h.target==='P2'&&h.blocked)?'light':undefined});
  t.tick(180);
  assert.ok(t.hits.some(h=>h.target==='P2'&&h.blocked),`${index} can guard after hitstun`);
  assert.ok(t.hits.some(h=>h.target==='P1'&&!h.blocked),`${index} guard then jab counterattack`);
  reversals.push(t.g.f1.def.id);
}
function pair(first,next,{cancel=false,index=0,options={},firstOptions={},frames=150}={}){
  const t=setup(index),f=t.g.f1;let issued=false;
  t.setInput(who=>{
    if(who==='p2')return {block:t.hits.some(h=>h.target==='P2'),down:['lowKick','lowMediumKick','sweep'].includes(next)};
    if(f.attackId===0)return {command:first,commandOptions:firstOptions};
    if(!issued&&(cancel?f.attackContact:!f.attack)){
      // Keep the buffered request until it actually starts; illegal cancellation
      // attempts consequently fall through to a link after recovery.
      if(f.attackKind===next&&f.attackId>1)issued=true;
      return {command:next,commandOptions:options};
    }
    return neutral();
  });
  for(let n=0;n<frames;n++){t.tick();if(f.attackId>=2)issued=true;}
  return t;
}
const target=pair('medium','heavy',{cancel:true});
assert.deepEqual(target.hits.filter(h=>h.target==='P2').map(h=>[h.kind,h.blocked,h.combo]),[['medium',false,1],['heavy',false,2]],'designated medium > heavy target combo');
const link=pair('medium','light');
assert.deepEqual(link.hits.map(h=>[h.kind,h.blocked,h.combo]),[['medium',false,1],['light',false,2]],'+5 medium links into 5F jab');
const badLink=pair('medium','medium');
assert.deepEqual(badLink.hits.map(h=>[h.kind,h.blocked]),[['medium',false],['medium',true]],'+5 cannot link a 7F medium');
const badCancel=pair('light','heavy',{cancel:true});
assert.deepEqual(badCancel.hits.map(h=>[h.kind,h.blocked]),[['light',false],['heavy',true]],'unspecified light > heavy cannot cancel and is blockable');
const slowCancel=pair('light','rush',{cancel:true,index:1});
assert.ok(slowCancel.hits.some(h=>h.kind==='rush'&&h.blocked),'legal cancel into slow overhead is not a true combo');
const fastCancel=pair('light','uppercut',{cancel:true});
assert.ok(fastCancel.hits.some(h=>h.kind==='uppercut'&&!h.blocked&&h.combo>1),'fast special can combo');
for(const [index,kind] of [[0,'tech'],[1,'special']])for(const strength of [1,2,3]){
  const t=pair(kind,'light',{index,firstOptions:{strength}});
  assert.ok(t.hits.some(h=>h.kind==='light'&&h.blocked),`${kind} > jab cannot loop into the same advancing special for free`);
  const od=pair(kind,'light',{index,firstOptions:{strength,od:true}});
  assert.ok(od.hits.some(h=>h.kind==='light'&&!h.blocked&&h.combo===4),'OD spends resources to enable a normal followup');
  assert.ok(od.g.f1.drive<5,'OD extension costs Drive');
  const loop=setup(index,0,68,true),a=loop.g.f1;
  loop.setInput(who=>who==='p2'?{block:loop.hits.length>0}:{command:!a.attack?(a.attackKind===kind?'light':kind):a.attackKind==='light'?kind:undefined,commandOptions:{strength}});
  loop.tick(500);
  assert.ok(Math.max(...loop.hits.filter(h=>!h.blocked).map(h=>h.combo))<=3,'weak / medium / heavy resource-free loops are blockable');
}
// Keep the advertised Assist routes playable under the new frame data. The
// opponent holds guard after the first hit, so gaps cannot hide as fresh hits.
const assists=[];
for(let index=0;index<6;index++)for(const button of ['light','medium','heavy'])for(const corner of [false,true]){
  const t=setup(index,0,100,corner),f=t.g.f1,route=f.def.assistCombos[button];let done=false;
  t.setInput(who=>who==='p2'?{block:t.hits.length>0}:neutral());
  for(let n=0;n<250;n++){
    if(!done){if(f.assistRoute?.index>=route.length)done=true;else f.queueAssist(button);}
    t.tick();
  }
  const expected=Array.from(route,e=>typeof e==='string'?e:e.kind);
  assert.ok(done,`${f.def.id}/${button}: Assist finishes`);
  assert.deepEqual(t.actions.filter(a=>a.player==='P1').map(a=>a.kind),expected);
  const received=t.hits.filter(h=>h.target==='P2');
  received.forEach((hit,i)=>{assert.equal(hit.blocked,false,`${f.def.id}/${button}: no defensive gap`);assert.equal(hit.combo,i+1,`${f.def.id}/${button}: uninterrupted combo`);});
  assert.ok(received.length>=2&&f.drive>=0&&f.meter>=0);
  assists.push({character:f.def.id,button,corner,hits:received.length,damage:t.g.f2.comboDamage});
}
// No normal can repeatedly link into itself on an early hit.
let selfLinks=0;
for(let index=0;index<6;index++)for(const kind of ['light','lightKick','lowKick','medium','mediumKick','lowMediumKick','heavy','heavyKick']){
  const t=pair(kind,kind,{index});
  const second=t.hits.filter(h=>h.target==='P2')[1];
  if(second)assert.ok(second.blocked,`${index}/${kind} recovery loop must have a defensive gap`);
  else assert.ok(t.actions.some(a=>a.kind===kind&&a.id===2),'second attack occurs but can whiff from pushback');
  selfLinks++;
}
// Frame advantage +4 from Drive Rush creates an otherwise impossible link.
{
  const t=setup(),f=t.g.f1;f.driveBoost=90;
  let issued=false;
  t.setInput(who=>who==='p2'?{block:t.hits.length>0}:!f.attackId?{command:'light'}:!issued&&!f.attack?{command:'medium'}:neutral());
  for(let n=0;n<150;n++){t.tick();if(f.attackId===2)issued=true;}
  assert.ok(t.hits.some(h=>h.kind==='medium'&&!h.blocked&&h.combo===2),'boosted +7 jab links 7F medium');
}
// Data-level damage fixtures: preserve move identity across hits and shots.
const damage=setup(),{g,s}=damage,f=g.f2,owner=g.f1;
function hit(id,cfg={}){return f.takeHit({owner,attackId:id,kind:'fixture',dmg:100,hitstun:30,kb:0,type:'heavy',...cfg},1,false);}
function fresh(){f.endCombo();f.hp=10000;}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);}
fresh();const regular=[];
for(let n=1;n<=12;n++){hit(n);regular.push(f.lastDamageScale);}
[1,1,.8,.7,.6,.5,.4,.3,.2,.1,.1,.1].forEach((v,i)=>near(regular[i],v));
fresh();const lights=[];
for(let n=1;n<=4;n++){hit(n,{lightStarter:true});lights.push(f.lastDamageScale);}
[1,.9,.8,.7].forEach((v,i)=>near(lights[i],v));
fresh();hit(1,{starterScaling:.2});hit(2);near(f.lastDamageScale,.8);hit(3);near(f.lastDamageScale,.6);
fresh();hit(1);hit(2,{damagePenalty:.1});near(f.lastDamageScale,.9);hit(3);near(f.lastDamageScale,.7);
fresh();hit(1);hit(2,{damagePenalty:.15});near(f.lastDamageScale,.85);hit(3);near(f.lastDamageScale,.65);
// A single three-hit move occupies one scaling slot, even between other moves.
fresh();hit(1,{lightStarter:true});for(let n=0;n<3;n++)hit(2,{dmg:10});
assert.equal(f.comboHits,4);assert.equal(f.comboMoves,2);assert.equal(f.comboDamage,127);near(f.lastDamageScale,.9);
hit(3,{dmg:10});near(f.lastDamageScale,.8);
// Every production multihit / multishot move shares its instance's scaling.
let multiMoves=0;
for(const c of s.CHARACTERS)for(const [kind,m] of Object.entries(c.moves)){
  const count=m.hitFrames?.length||m.shots?.length||1;if(count<2)continue;
  fresh();hit(1,{lightStarter:true});
  for(let n=0;n<count;n++)hit(2,{dmg:m.dmg,scaleFloor:m.saLevel?[0,.3,.4,.5][m.saLevel]:undefined});
  assert.equal(f.comboMoves,2,`${c.id}/${kind} uses one slot`);near(f.lastDamageScale,.9);multiMoves++;
}
for(const floor of [.3,.4,.5]){
  fresh();for(let n=1;n<=16;n++)hit(n,{lightStarter:true});
  const before=f.comboDamage;hit(17,{scaleFloor:floor});hit(17,{scaleFloor:floor});
  near(f.lastDamageScale,floor);assert.equal(f.comboDamage-before,floor*200);
}
// The boundary frame is still a combo; one actionable frame resets the scale.
fresh();hit(1,{lightStarter:true,hitstun:4});for(let n=0;n<4;n++)f.update(g);
hit(2);assert.equal(f.comboHits,2);near(f.lastDamageScale,.9);
for(let n=0;n<31;n++)f.update(g);hit(3);assert.equal(f.comboHits,1);near(f.lastDamageScale,1);
hit(4,{});f.takeHit({dmg:0,hitstun:10,kb:0,type:'light'},1,true);hit(5);assert.equal(f.comboHits,1);
// Melee and projectile paths really provide stable attack instance metadata.
{
  const t=setup(),a=t.g.f1;a.startAttack('tech');a.stateT=a.attack.startup;
  const hb=a.getHitBox();assert.equal(hb.owner,a);assert.equal(hb.attackId,a.attackId);
  a.attack=null;a.state='idle';a.startAttack('super1');
  const p1=new t.s.Projectile(a,1,a.attack),p2=new t.s.Projectile(a,1,a.attack);
  for(const p of [p1,p2]){p.x=t.g.f2.x;p.y=380;p.hitTarget(t.g.f2);}
  assert.equal(t.g.f2.comboHits,2);assert.equal(t.g.f2.comboMoves,1);near(t.g.f2.lastDamageScale,1);
}
// Whiff, expired windows, resource limits and chain limits use the same gates.
for(let index=0;index<6;index++){
  const t=setup(index),a=t.g.f1;
  a.startAttack('light');assert.equal(a.canStartAttack('uppercut'),false,'no whiff cancel');
  a.stateT=a.attack.startup;a.attackContact=true;a.contactFrame=a.stateT;
  assert.equal(a.canStartAttack('light'),true);a.repeatChain=3;
  for(const kind of s.CombatRules.lights)assert.equal(a.canStartAttack(kind),false,'shared light-chain cap');
  a.stateT+=9;assert.equal(a.canStartAttack('uppercut'),false,'expired normal window');
}
// A grounded knockdown is protected until a wakeup input opportunity, while
// an airborne launch can still be juggled before landing.
{
  const t=setup(),d=t.g.f2;
  d.takeHit({owner:t.g.f1,attackId:1,dmg:10,kb:0,hitstun:20,type:'heavy',knockdown:true},1,false);
  let airHit=false;
  for(let n=0;n<90;n++){
    if(!d.onGround&&!airHit){const res=d.takeHit({owner:t.g.f1,attackId:2,dmg:2,kb:0,hitstun:20,type:'heavy',knockdown:true},1,false);assert.equal(res.ignored,undefined);airHit=true;}
    d.update(t.g);
    if(d.onGround&&d.getupFrames>0){
      assert.ok(d.invuln>0);assert.equal(d.comboActive,false);
      const hp=d.hp,res=d.takeHit({dmg:10,kb:0,hitstun:20,type:'heavy'},1,false);
      assert.equal(res.ignored,true);assert.equal(d.hp,hp);
    }
    if(d.canAct())break;
  }
  assert.ok(airHit&&d.canAct());
  d.handleIntent({...neutral(),block:true},t.g);d.update(t.g);
  assert.equal(d.invuln,0);assert.equal(d.blocking,true,'guard is available when wakeup protection ends');
}
const report={result:'passed',spamMatchups:spam.length,spamFrames:spam.length*400,maxJabCombo:Math.max(...spam.map(r=>r.maxCombo)),guardThenCounter:reversals,selfLinks,multiMoves,assists,
  examples:{target:target.hits,link:link.hits,badLink:badLink.hits,badCancel:badCancel.hits,slowCancel:slowCancel.hits,fastCancel:fastCancel.hits},damage:{regular,lights},spam};
const out=path.resolve(__dirname,'../output/combo-balance');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,spam:undefined},null,2));
