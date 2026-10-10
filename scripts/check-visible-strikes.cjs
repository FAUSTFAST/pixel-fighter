// Reproduce visible misses in the real pre-fix game; verify current damage and defenses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs'),{harness}=require('./gameplay-harness.cjs');
const fixtures=require('./fixtures/visible-strike-misses.json');
const sources=Object.fromEntries(['game','combat-spacing','arcade-animation'].map(name=>[name,execFileSync('git',['show',fixtures.baselineCommit+':js/'+name+'.js'],{cwd:root,maxBuffer:8*1024*1024}).toString()]));
const neutral=()=>({move:0,up:false,down:false,block:false});
function setup(h,art,test,mode='neutral'){
 const s=h.s,g=h.fight(),ci=s.CHARACTERS.findIndex(c=>c.id===test.character);g.pve=false;g.training=true;s.DrawnAnimation=art;
 g.f1=new s.Fighter(s.CHARACTERS[ci],400,test.facing,'P1');g.f2=new s.Fighter(s.CHARACTERS[(ci+1)%6],400+test.facing*test.distance,-test.facing,'P2');
 const a=g.f1,b=g.f2;a.foe=b;b.foe=a;
 if(test.airborne)for(const f of [a,b]){f.onGround=false;f.y=s.FIGHT_GROUND-70;f.vy=0;}
 s.CombatControls.collect=(f,i)=>i;s.CombatControls.read=(who)=>who==='p1'?neutral():{move:0,up:false,down:mode==='lowGuard',block:['guard','lowGuard'].includes(mode),parryHeld:mode==='parry'};
 if(mode==='invulnerable')b.invuln=300;if(mode==='trainingImmune')b.trainingInvincible=true;
 const events=[],take=b.takeHit.bind(b);b.takeHit=(box,...args)=>{const result=take(box,...args);events.push({frame:a.stateT,reaction:b.reaction,state:b.state,...result});return result;};
 assert.equal(a.startAttack(test.kind),true);return {g,a,b,events,move:a.attack};
}
function visibleOverlap(a,b,region,art){
 const paint=f=>{const c=createCanvas(Math.ceil(region.w)+4,Math.ceil(region.h)+4),x=c.getContext('2d');x.translate(f.x-region.x+2,f.y-region.y+2);x.scale(f.facing*4.2,4.2);art.draw(x,f.def,f.sampleAnimation().animation);return c.getContext('2d').getImageData(0,0,c.width,c.height);};
 const x=paint(a),y=paint(b);let count=0;for(let i=0;i<x.width*x.height;i++)if(x.data[i*4+3]>160&&y.data[i*4+3]>160)count++;return count;
}
(async()=>{
 const before=nativeHarness(53,true,sources),after=nativeHarness(53);await Promise.all([before.s.DrawnAnimation.loading,after.s.DrawnAnimation.loading]);
 assert.equal(before.s.DrawnAnimation.status,'ready');assert.equal(after.s.DrawnAnimation.status,'ready');
 const oldArt=before.s.DrawnAnimation,art=after.s.DrawnAnimation,old=harness(53,{sources}),current=harness(53);
 let reproduced=0,rescued=0;
 for(const test of fixtures.cases){
  const a=setup(old,oldArt,test);old.tick(test.frame);
  assert.ok(visibleOverlap(a.a,a.b,test.visibleRegion,oldArt)>=4,'baseline must really show contact: '+JSON.stringify(test));
  old.tick(a.move.startup+a.move.active+a.move.recovery-test.frame+1);assert.equal(a.events.length,0,'baseline must reproduce the missing hit');reproduced++;
  const b=setup(current,art,test);current.tick(b.move.startup+b.move.active+b.move.recovery+12);
  assert.equal(b.events.length,1,JSON.stringify(test));assert.ok(b.events[0].dmg>0);assert.ok(b.b.hp<b.b.maxHp);assert.ok(b.events[0].reaction);assert.equal(b.events[0].state,'hit');
  assert.ok(b.events[0].frame>=b.move.startup&&b.events[0].frame<b.move.startup+b.move.active,'only active frames deal damage');rescued++;
 }
 // Full old/new native-art comparison: every previous valid normal stays valid.
 let matches=0,preserved=0,newVisibleHits=0;
 for(const c of current.s.CHARACTERS)for(const kind of current.s.CombatRules.normals)for(const facing of [1,-1])for(const airborne of [false,true])for(const distance of [68,95,125,160,200,300]){
  const test={character:c.id,kind,facing,airborne,distance},a=setup(old,oldArt,test),b=setup(current,art,test);
  old.tick(a.move.startup+a.move.active+a.move.recovery+12);current.tick(b.move.startup+b.move.active+b.move.recovery+12);
  if(a.events.length){assert.equal(b.events.length,1,'lost previously valid contact: '+JSON.stringify(test));preserved++;}else if(b.events.length)newVisibleHits++;
  assert.ok(b.events.length<=1);if(distance===300)assert.equal(b.events.length,0,'distant strikes still whiff');matches++;
 }
 let defenseChecks=0;
 for(const c of current.s.CHARACTERS)for(const facing of [1,-1])for(const mode of ['guard','lowGuard','parry','invulnerable','trainingImmune']){
  const test={character:c.id,kind:mode==='lowGuard'?'lowKick':'light',facing,distance:68},b=setup(current,art,test,mode),hp=b.b.hp,x=b.b.x;
  current.tick(b.move.startup+b.move.active+b.move.recovery+12);
  assert.equal(b.b.hp,hp,'defense must prevent unblocked damage: '+c.id+'/'+mode);
  if(['invulnerable','trainingImmune'].includes(mode)){assert.equal(b.events.length,0);assert.equal(b.b.x,x);}
  else{assert.equal(b.events.length,1,c.id+'/'+mode);assert.ok(b.events[0].blocked);if(mode==='parry')assert.ok(b.events[0].parried);}
  defenseChecks++;
 }
 const result={passed:true,baselineCommit:fixtures.baselineCommit,reproducedVisibleMisses:reproduced,rescuedVisibleMisses:rescued,nativeComparisonMatches:matches,preservedPreviousHits:preserved,additionalVisibleHits:newVisibleHits,defenseChecks,checks:['actual raster contact reproduced before fix','active frames only','one damage event','all former valid hits','both sides and air normals','guard / low guard / parry / invulnerability / training immunity']};
 fs.mkdirSync(path.join(root,'output/contact-alignment'),{recursive:true});fs.writeFileSync(path.join(root,'output/contact-alignment/visible-strikes-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
