// Verify native original-art masks, camera anchoring and real gameplay parity.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
const baselineCommit='27da2e1a91f7d90086bc90ba8e7e0b632400a21a';
const sources={stages:execFileSync('git',['show',baselineCommit+':js/stages.js'],{cwd:root}).toString()};
const out=path.join(root,'output/neon-sign');fs.mkdirSync(out,{recursive:true});
function draw(h,index,t,camera){const c=createCanvas(960,540),ctx=c.getContext('2d');h.s.STAGES[index].draw(ctx,t,camera);h.s.STAGES[index].drawForeground(ctx,t,camera);return c;}
(async()=>{
 const old=nativeHarness(91,true,sources),now=nativeHarness(91,false);await old.s.DrawnAnimation.loading;now.s.DrawnAnimation=old.s.DrawnAnimation;
 const panels=now.s.STAGE_ART.city.neon;assert.equal(panels.length,5);let sampledPixels=0,litPixels=0;
 for(const p of panels){const raw=now.s.STAGE_ART.city.panorama.getContext('2d').getImageData(p.x,p.y,p.w,p.h).data,light=p.light.getContext('2d').getImageData(0,0,p.w,p.h).data,dim=p.dim.getContext('2d').getImageData(0,0,p.w,p.h).data;let lit=0;
  for(let i=0;i<raw.length;i+=4){sampledPixels++;assert.equal(light[i+3],dim[i+3]);assert.equal(dim[i]+dim[i+1]+dim[i+2],0);
   if(!light[i+3])continue;lit++;litPixels++;for(let k=0;k<3;k++)assert.ok(Math.abs(light[i+k]-raw[i+k])<=Math.ceil(255/light[i+3]),'source color must remain native (alpha rounding only)');
  }
  assert.ok(lit>p.w*p.h*.25,'mask must contain original illuminated lettering / tubes');
 }
 let identicalOtherMapViews=0,cityViews=0,changedCityPixels=0;
 for(const camera of [-240,0,240])for(const t of [0,1.7,5,8])for(let index=0;index<7;index++){
  const a=draw(old,index,t,camera),b=draw(now,index,t,camera),before=a.getContext('2d').getImageData(0,0,960,540).data,after=b.getContext('2d').getImageData(0,0,960,540).data;
  if(index!==1){assert.deepEqual(after,before,'other map altered');identicalOtherMapViews++;continue;}
  const allowed=[...panels.map(p=>[p.x-240-camera,p.y,p.w,p.h]),[683-camera,173,91,52],[690-camera,397,65,2]];
  let changes=0;for(let i=0;i<before.length;i+=4){assert.equal(after[i+3],255);if(before[i]===after[i]&&before[i+1]===after[i+1]&&before[i+2]===after[i+2])continue;
   const x=(i/4)%960,y=Math.floor(i/4/960);assert.ok(allowed.some(([l,top,w,h])=>x>=l&&x<l+w&&y>=top&&y<top+h),'changed pixel outside original signs / removed overlay at '+x+','+y);changes++;
  }
  assert.ok(changes>500);changedCityPixels+=changes;cityViews++;
  if(camera===0&&t===0){fs.writeFileSync(path.join(out,'before.png'),a.toBuffer('image/png'));fs.writeFileSync(path.join(out,'after.png'),b.toBuffer('image/png'));}
 }
 // Inspect actual sign draw calls; rain and spectators cannot fake animation.
 const animationSamples=[];for(const t of [0,1.7,3.4,5.1,6.8,8.5]){
  const ctx=createCanvas(960,540).getContext('2d'),calls=[],original=ctx.drawImage.bind(ctx);ctx.drawImage=function(img,...args){if(panels.some(p=>p.light===img||p.dim===img))calls.push([args,this.globalAlpha,this.globalCompositeOperation]);return original(img,...args);};
  now.s.STAGES[1].draw(ctx,t,0);animationSamples.push(JSON.stringify(calls));
 }
 assert.equal(new Set(animationSamples).size,6,'native sign must genuinely animate');
 // Exact panel translation with the rigid building, at both camera limits.
 for(const camera of [-240,0,240]){
  const ctx=createCanvas(960,540).getContext('2d'),calls=[],original=ctx.drawImage.bind(ctx);ctx.drawImage=function(img,...args){const p=panels.find(p=>p.dim===img);if(p){const m=this.getTransform();calls.push({x:args[0]+m.e,y:args[1]+m.f,p});}return original(img,...args);};
  const alpha=ctx.globalAlpha,transform=ctx.getTransform().toString();now.s.STAGES[1].draw(ctx,3,camera);assert.equal(ctx.globalAlpha,alpha);assert.equal(ctx.getTransform().toString(),transform);assert.equal(ctx.globalCompositeOperation,'source-over');assert.equal(ctx.filter,'none');
  assert.equal(calls.length,5);for(const c of calls){assert.equal(c.x,c.p.x-240-camera);assert.equal(c.y,c.p.y);}
 }
 const files=['fighter','game','characters','input','controls','combat-rules','combat-spacing','arcade-animation','strike-art','strike-motion','motion60','ai','ui','settings','stage-depth'];
 for(const f of files)assert.ok(fs.readFileSync(path.join(root,'js',f+'.js')).equals(execFileSync('git',['show',baselineCommit+':js/'+f+'.js'],{cwd:root})),f+' changed');
 for(const stage of now.s.STAGES)assert.ok(fs.readFileSync(path.join(root,'assets/stages/'+stage.id+'-panorama-v3.png')).equals(execFileSync('git',['show',baselineCommit+':assets/stages/'+stage.id+'-panorama-v3.png'],{cwd:root,maxBuffer:24*1024*1024})),'original panorama modified');
 for(const h of [old,now]){const g=h.fight();g.pve=false;g.training=true;g.stage=h.s.STAGES[1];g.f1.x=350;g.f2.x=620;h.s.Settings={values:{shake:false}};h.s.Input.MODES.p1='classic';}
 for(let t=0;t<360;t++){
  for(const h of [old,now]){if(t===1)h.key('d');if(t===61)h.key('d',false);if(t===75)h.key('g');if(t===76)h.key('g',false);if(t===135)h.key('w');if(t===136)h.key('w',false);if(t===148)h.key('w');if(t===149)h.key('w',false);if(t===210)h.key('a');if(t===250)h.key('a',false);h.tick();}
  for(const who of ['f1','f2'])for(const field of ['x','y','vx','vy','hp','meter','drive','state','stateT','facing','onGround','jumpCount','comboHits','gaitMoving','stepPhase','drawnFrame'])assert.equal(now.g[who][field],old.g[who][field],who+'/'+field+' changed');assert.equal(now.g.cameraX,old.g.cameraX);
 }
 assert.ok(now.g.f2.hp<10000,'exercise actual hit');
 const result={passed:true,baselineCommit,sampledPixels,litPixels,cityViews,changedCityPixels,identicalOtherMapViews,signAnimationSamples:6,rigidCameraAnchoring:true,gameplayFrames:360,unchangedModules:files.length,originalPanoramasUnchanged:true};
 fs.writeFileSync(path.join(out,'check-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
