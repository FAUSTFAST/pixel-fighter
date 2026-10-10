// Regression gates for art continuity, right-side backwalk and pre-hit body shoves.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {nativeHarness,root}=require('./native-game-art.cjs'),{harness}=require('./gameplay-harness.cjs');
const neutral=()=>({move:0,up:false,down:false,block:false});
(async()=>{
 const native=nativeHarness(91);await native.s.DrawnAnimation.loading;const art=native.s.DrawnAnimation;assert.equal(art.status,'ready');
 const catalog=require('./effective-animation-catalog.cjs').effectiveCatalog();
 let poseChecks=0,movementRuns=0,stationaryAttackRuns=0,boundaryRuns=0,repeatedStops=0;
 for(const [id,clips] of Object.entries(catalog.characters)){
  for(const clip of ['walk','backwalk']){
   const d=clips[clip];assert.equal(d.authored,true);assert.equal(d.cycleFrames,16);assert.equal(d.stopVariants.length,16);
   const signatures=new Set();
   for(let index=0;index<16;index++){
    const sprite=art.sprite(id,clip,index);assert.ok(sprite);assert.equal(d.frames[index].root%192,96);assert.equal(d.frames[index].ground%160,144);
    signatures.add(sprite.canvas.toBuffer('image/png').toString('base64'));poseChecks++;
   }
   if(d.historicalCommit){
    assert.equal(d.originalDrawings,8,'B has eight original drawings, not sixteen invented poses');
    assert.equal(new Set(d.frames.slice(0,16).map(f=>f.historical.index)).size,8);
    assert.ok(signatures.size>=12,'distinct registered exposures of historical drawings');
   }else assert.ok(signatures.size>=12,'distinct fixed pixel drawings');
  }
 }
 for(let character=0;character<6;character++)for(const side of [0,1])for(const kind of ['forward','back'])for(const hz of [30,60,120]){
  const h=harness(91),g=h.fight(),s=h.s;g.pve=false;g.training=true;s.DrawnAnimation=art;
  g.f1=new s.Fighter(s.CHARACTERS[side===0?character:0],330,1,'P1');g.f2=new s.Fighter(s.CHARACTERS[side===1?character:0],630,-1,'P2');g.f1.foe=g.f2;g.f2.foe=g.f1;
  const f=side===0?g.f1:g.f2,foe=side===0?g.f2:g.f1,who=side===0?'p1':'p2',facing=f.facing,dir=facing*(kind==='back'?-1:1),key=s.Input.MAP[who][dir>0?'right':'left'];
  h.key(key);let previous=f.x;for(let t=0;t<Math.ceil(120*hz/60);t++){
   h.tick(1,hz);assert.equal(f.facing,facing,'movement must not flip facing');assert.ok((f.x-previous)*dir>=-1e-7,'world position reversed during a held direction');previous=f.x;
   const selected=art.selection(f.def,f.sampleAnimation().animation);assert.ok(selected.clip=== (kind==='back'?'backwalk':'walk')||selected.clip==='idle');
  }
  h.key(key,false);h.tick(Math.ceil(24*hz/60),hz);assert.equal(f.gaitMoving,false);assert.equal(f.gaitSettling,0);assert.equal(art.selection(f.def,f.sampleAnimation().animation).clip,'idle');
  if(kind==='back')assert.equal(foe.x,side===0?630:330,'backwalk must not drag a neutral opponent');movementRuns++;
 }
 // Both sides of every restored character, held at the screen boundary.
 for(let character=0;character<6;character++)for(const side of [0,1]){
  const h=harness(91),g=h.fight(0,.85,600),s=h.s;g.pve=false;s.DrawnAnimation=art;
  g.f1=new s.Fighter(s.CHARACTERS[side===0?character:0],side?100:260,1,'P1');
  g.f2=new s.Fighter(s.CHARACTERS[side===1?character:0],side?700:840,-1,'P2');g.f1.foe=g.f2;g.f2.foe=g.f1;
  const f=side?g.f2:g.f1,foe=side?g.f1:g.f2,dir=side?1:-1,foeX=foe.x;
  h.key(s.Input.MAP[side?'p2':'p1'][side?'right':'left']);let previous=f.x;
  for(let t=0;t<400;t++){h.tick();assert.equal(f.facing,side?-1:1);assert.ok((f.x-previous)*dir>=-1e-7);assert.equal(foe.x,foeX);assert.equal(art.selection(f.def,f.sampleAnimation().animation).data.historicalCommit,catalog.characters[f.def.id].idle.historicalCommit);previous=f.x;}
  assert.equal(f.x,side?840:100);assert.equal(f.gaitMoving,false);assert.equal(f.gaitSettling,0);boundaryRuns++;
 }
 // Repeated stop / start changes never choose another head or body source.
 for(let character=0;character<6;character++)for(const side of [0,1]){
  const h=harness(91),g=h.fight(0,.85,450);g.pve=false;g.f1.x=220;g.f2.x=670;h.s.DrawnAnimation=art;
  const replacement=new h.s.Fighter(h.s.CHARACTERS[character],side?670:220,side?-1:1,side?'P2':'P1');
  if(side)g.f2=replacement;else g.f1=replacement;g.f1.foe=g.f2;g.f2.foe=g.f1;
  const f=side?g.f2:g.f1,who=side?'p2':'p1';
  for(let i=0;i<32;i++){
   const dir=f.facing*(i%2?1:-1),key=h.s.Input.MAP[who][dir>0?'right':'left'];h.key(key);h.tick(4);h.key(key,false);h.tick(24);
   assert.equal(art.selection(f.def,f.sampleAnimation().animation).clip,'idle');assert.equal(f.facing,side?-1:1);repeatedStops++;
  }
 }
 // A no-damage defender must not be displaced by attack root movement, even
 // at touching distance and either wall. Includes normals, specials and supers.
 for(let character=0;character<6;character++)for(const facing of [1,-1])for(const edge of [false,true]){
  const h=harness(91),g=h.fight(),s=h.s;g.pve=false;g.training=true;s.CombatControls.collect=(f,i)=>i;s.CombatControls.read=neutral;
  for(const kind of [...s.CombatRules.normals,...s.CombatRules.specials,...s.CombatRules.supers,'impact']){
   const bx=edge?(facing>0?1110:-150):500,ax=bx-facing*68;
   g.f1=new s.Fighter(s.CHARACTERS[character],ax,facing,'P1');g.f2=new s.Fighter(s.CHARACTERS[0],bx,-facing,'P2');g.f1.foe=g.f2;g.f2.foe=g.f1;g.hitstop=0;g.projectiles=[];g.effects=[];
   g.f1.meter=300;g.f2.trainingInvincible=true;assert.equal(g.f1.startAttack(kind),true);
   const m=g.f1.attack;for(let t=0;t<m.startup+m.active+m.recovery+5;t++){
    h.tick();assert.ok(Math.abs(g.f2.x-bx)<1e-7,`${character}/${kind}/${facing}/${edge}: opponent moved without receiving a hit`);assert.equal(g.f2.state,'idle');assert.ok(Math.abs(g.f1.x-g.f2.x)>=68-1e-7);
   }
   stationaryAttackRuns++;
  }
 }
 // Real hit recoil remains active, with a visible reaction state.
 {
  const h=harness(91),g=h.fight(0,.85,68);g.pve=false;g.training=true;h.s.DrawnAnimation=art;h.s.CombatControls.collect=(f,i)=>i;h.s.CombatControls.read=neutral;
  const start=g.f2.x,hp=g.f2.hp;g.f1.startAttack('light');let hit=false,recoil=false;
  for(let t=0;t<40;t++){h.tick();if(g.f2.hp<hp)hit=true;if(g.f2.x!==start){assert.ok(hit,'no recoil before damage');recoil=true;}}
  assert.ok(hit&&recoil,'real hit should still produce knockback');
 }
 const result={passed:true,poseChecks,movementRuns,repeatedStops,boundaryRuns,stationaryAttackRuns,refreshRates:[30,60,120],checks:['fixed authored PNG poses and consistent costume identity','both sides and directions','all six characters at both screen boundaries','no displacement without hit','real knockback retained']};
 fs.mkdirSync(path.join(root,'output/stable-walk'),{recursive:true});fs.writeFileSync(path.join(root,'output/stable-walk/check-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
