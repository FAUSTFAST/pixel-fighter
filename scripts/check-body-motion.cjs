// Fixed drawing proof and independently measured support soles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
(async()=>{
 const h=nativeHarness();await h.s.DrawnAnimation.loading;const art=h.s.DrawnAnimation;assert.equal(art.status,'ready');assert.equal(h.s.BodyMotion,undefined);
 const m=require('./effective-animation-catalog.cjs').effectiveCatalog();
 let rawFrameChecks=0,plantedRuns=0,maxSoleDrift=0;
 for(const c of h.s.CHARACTERS)for(const [name,clip] of Object.entries(m.characters[c.id])){
  assert.equal(clip.authored,true);
  for(let i=0;i<clip.frames.length;i++){
   const sprite=art.sprite(c.id,name,i);assert.ok(sprite);
   assert.ok(sprite.canvas.width>20&&sprite.canvas.height>20);rawFrameChecks++;
  }
  // Production selection + production collision must return the very same PNG
  // object for every logical frame, without any transformed copy or blend.
  for(let i=0;i<60;i++){
   const f=new h.s.Fighter(c,400,1,'P1');
   if(['walk','backwalk'].includes(name)){f.gaitMoving=true;f.gaitDirection=name==='walk'?1:-1;f.stepPhase=i/60*Math.PI*2;f.moveBlend=1;f.state='walk';}
   else if(['jab','heavy','kick','lowKick'].includes(name)){f.startAttack({jab:'light',heavy:'heavy',kick:'heavyKick',lowKick:'sweep'}[name]);f.stateT=i/60*(f.attack.startup+f.attack.active+f.attack.recovery);}
   else continue;
   const a=f.sampleAnimation().animation,selected=art.selection(c,a);assert.equal(art.collisionSprite(f),selected.sprite);assert.equal(selected.sprite,art.sprite(c.id,selected.clip,selected.index));
  }
 }
 function sole(sprite,side){
  const p=sprite.canvas.getContext('2d').getImageData(0,0,sprite.canvas.width,sprite.canvas.height);let sum=0,n=0;
  // Sample the bottom contact row only. Higher rows include the changing shin
  // silhouette and are not the planted sole (especially on the rear boot).
  for(let y=0;y<p.height;y++){const yy=sprite.y+(y+.5)/2;if(yy<0||yy>.5)continue;
   for(let x=0;x<p.width;x++){const xx=sprite.x+(x+.5)/2;if(xx*side<3||p.data[(y*p.width+x)*4+3]<96)continue;sum+=xx;n++;}
  }
  assert.ok(n>0,'support sole must visibly touch the floor');return sum/n;
 }
 // B's original foot lifts occur at different times than the newer drawings.
 // Measure each actual planted interval and its native PNG sole, preserving
 // the same 4.2-world-pixel exposure bound rather than imposing another gait.
 for(const c of h.s.CHARACTERS)for(const name of ['walk','backwalk']){
  const clip=m.characters[c.id][name],dir=name==='walk'?1:-1;
  const intervals=new Set(clip.frames.slice(0,16).map(f=>f.support.interval));
  for(const interval of intervals){
   const positions=[];
   for(let i=0;i<16;i++){
    const meta=clip.frames[i];if(meta.support.interval!==interval)continue;
    const sprite=art.sprite(c.id,name,i),p=sprite.canvas.getContext('2d').getImageData(0,0,sprite.canvas.width,sprite.canvas.height);
    const xs=[];const {left,right,row}=meta.support;
    assert.equal(row,meta.ground-meta.rect[1],'planted native pixels must meet the floor');
    for(let x=left;x<=right;x++)if(p.data[(row*p.width+x)*4+3]>96)xs.push(sprite.x+(x+.5)/2);
    assert.ok(xs.length>0,'original boot sole must remain opaque');
    const soleX=meta.support.measurement==='toe'?Math.max(...xs):xs.reduce((a,b)=>a+b,0)/xs.length;
    for(const hold of [0,.25,.5,.75])positions.push((i+hold)/16*c.stride*dir+soleX*4.2);
   }
   const drift=Math.max(...positions)-Math.min(...positions);assert.ok(drift<4.3,`${c.id}/${name}/${interval}: historical sole drift ${drift}`);
   maxSoleDrift=Math.max(maxSoleDrift,drift);plantedRuns++;
  }
 }
 const result={passed:true,rawFrameChecks,plantedRuns,maxSoleDrift:+maxSoleDrift.toFixed(3),rendering:'exact PNG identity, no runtime deformed copies',note:'Sixteen discrete exposures are 4.2 world pixels; Every character reuses eight verified B-version drawings per direction.'};
 fs.mkdirSync(path.join(root,'output/drawn-frames'),{recursive:true});fs.writeFileSync(path.join(root,'output/drawn-frames/check-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
