// Fixed drawing proof and independently measured support soles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
(async()=>{
 const h=nativeHarness();await h.s.DrawnAnimation.loading;const art=h.s.DrawnAnimation;assert.equal(art.status,'ready');assert.equal(h.s.BodyMotion,undefined);
 const m=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/animation-v8/manifest.json')));
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
 for(const c of h.s.CHARACTERS)for(const name of ['walk','backwalk'])for(const half of [0,1]){
  const dir=name==='walk'?1:-1,side=half===0?-dir:dir,positions=[];
  for(let i=half*8;i<half*8+8;i++)for(const hold of [0,.25,.5,.75]){
   const p=(i+hold)/16,sprite=art.selection(c,{name,phase:p}).sprite;
   positions.push(p*c.stride*dir+sole(sprite,side)*4.2);
  }
  const drift=Math.max(...positions)-Math.min(...positions);assert.ok(drift<4.3,`${c.id}/${name}: sole drift ${drift}`);maxSoleDrift=Math.max(maxSoleDrift,drift);plantedRuns++;
 }
 const result={passed:true,rawFrameChecks,plantedRuns,maxSoleDrift:+maxSoleDrift.toFixed(3),rendering:'exact PNG identity, no runtime deformed copies',note:'Discrete 16-pose exposure steps are 4.2 world pixels.'};
 fs.mkdirSync(path.join(root,'output/drawn-frames'),{recursive:true});fs.writeFileSync(path.join(root,'output/drawn-frames/check-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
