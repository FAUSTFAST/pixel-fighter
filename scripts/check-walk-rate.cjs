// Compare actual keyboard-driven game movement and native soles to the released
// version. User chose slower drawings with unchanged world speed, accepting slip.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./gameplay-harness.cjs'),{nativeHarness,root}=require('./native-game-art.cjs');
const baselineCommit='a23cec4709b0e54130b5124e5eb3f400dda99caa';
const sources={fighter:execFileSync('git',['show',baselineCommit+':js/fighter.js'],{cwd:root}).toString()};
(async()=>{
 const native=nativeHarness(91);await native.s.DrawnAnimation.loading;const art=native.s.DrawnAnimation;assert.equal(art.status,'ready');
 let movementRuns=0,worldPositionChecks=0,maxLiveSoleDrift=0,soleSamples=0;const soleRuns=[];
 for(let character=0;character<6;character++)for(const side of [0,1])for(const backward of [false,true])for(const hz of [30,60,120,144]){
  const runs=[harness(91,{sources}),harness(91)],totals=[0,0];
  for(const h of runs){const g=h.fight();g.pve=false;h.s.DrawnAnimation=art;
   g.f1=new h.s.Fighter(h.s.CHARACTERS[side?0:character],250,1,'P1');g.f2=new h.s.Fighter(h.s.CHARACTERS[side?character:0],710,-1,'P2');g.f1.foe=g.f2;g.f2.foe=g.f1;
   h.f=side?g.f2:g.f1;h.key(h.s.Input.MAP[side?'p2':'p1'][(h.f.facing*(backward?-1:1))>0?'right':'left']);
  }
  let plant=null,worst=0;
  for(let frame=0;frame<Math.ceil(180*hz/60);frame++){
   for(const [i,h] of runs.entries()){const previous=h.f.stepPhase;h.tick(1,hz);if(h.f.gaitMoving)totals[i]+=(h.f.stepPhase-previous+Math.PI*2)%(Math.PI*2);}
   const old=runs[0].f,f=runs[1].f;
   for(const key of ['x','y','vx','vy','facing','state','onGround'])assert.equal(f[key],old[key],'world movement changed: '+key);worldPositionChecks++;
   assert.ok(Math.abs(totals[1]-totals[0]*.75)<1e-8,'actual gait cycle must advance at 0.75 of released version');
   assert.equal(f.facing,side?-1:1);
   const sel=art.selection(f.def,f.sampleAnimation().animation);
   if(!f.gaitMoving||!sel.meta.support){plant=null;continue;}
   const support=sel.meta.support,sprite=sel.sprite,p=sprite.canvas.getContext('2d').getImageData(0,0,sprite.canvas.width,sprite.canvas.height),xs=[];
   for(let x=support.left;x<=support.right;x++)if(p.data[(support.row*p.width+x)*4+3]>96)xs.push(sprite.x+(x+.5)/2);
   assert.ok(xs.length,'support foot must use real opaque original PNG pixels');
   const sole=support.measurement==='toe'?Math.max(...xs):xs.reduce((a,b)=>a+b,0)/xs.length;
   const world=f.x+f.facing*sole*4.2,key=sel.clip+':'+support.interval;
   if(plant&&plant.key===key&&sel.index>=plant.index){plant.low=Math.min(plant.low,world);plant.high=Math.max(plant.high,world);plant.index=sel.index;worst=Math.max(worst,plant.high-plant.low);soleSamples++;}
   else plant={key,index:sel.index,low:world,high:world};
  }
  assert.ok(totals[0]>Math.PI*2,'exercise a full original gait cycle');
  maxLiveSoleDrift=Math.max(maxLiveSoleDrift,worst);soleRuns.push({character:runs[1].f.def.id,side,backward,hz,maxLiveSoleDrift:+worst.toFixed(3)});movementRuns++;
  for(const h of runs){h.s.Input.clear();h.tick(Math.ceil(40*hz/60),hz);assert.equal(h.f.gaitMoving,false);assert.equal(h.f.gaitSettling,0);assert.equal(art.selection(h.f.def,h.f.sampleAnimation().animation).clip,'idle');}
 }
 const result={passed:true,baselineCommit,animationRate:.75,movementRate:1,movementRuns,worldPositionChecks,soleSamples,maxLiveSoleDrift:+maxLiveSoleDrift.toFixed(3),footPlanting:'Intentional user-approved drift: drawings slowed without slowing world movement; no foot locks, frame warps or art edits.',soleRuns};
 const out=path.join(root,'output/walk-rate');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'check-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,soleRuns:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1;});
