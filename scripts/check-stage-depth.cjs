// Native panorama / mask proof plus actual keyboard-driven gameplay parity.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
const baselineCommit='17923fd97387b39d0da1f050894d0d626f5adf31';
const sources={stages:execFileSync('git',['show',baselineCommit+':js/stages.js'],{cwd:root}).toString()};
const bytes=file=>execFileSync('git',['show',baselineCommit+':'+file],{cwd:root,maxBuffer:24*1024*1024});
function energy(canvas,x,y,w=100,h=80){const p=canvas.getContext('2d').getImageData(x,y,w,h).data;let sum=0;for(let i=0;i<w*h-1;i++)for(let c=0;c<3;c++)sum+=Math.abs(p[i*4+c]-p[(i+1)*4+c]);return sum/(w*h*3);}
(async()=>{
 const old=nativeHarness(91,true,sources),current=nativeHarness(91,false);await old.s.DrawnAnimation.loading;current.s.DrawnAnimation=old.s.DrawnAnimation;
 const s=current.s,images=[];let cameraViews=0;
 const gameplay=['fighter','game','characters','input','controls','combat-rules','combat-spacing','arcade-animation','strike-motion','motion60','ai','ui','settings'];
 for(const name of gameplay)assert.ok(fs.readFileSync(path.join(root,'js',name+'.js')).equals(bytes('js/'+name+'.js')),'changed gameplay / character code: '+name);
 for(const stage of s.STAGES){const a=s.STAGE_ART[stage.id],p=a.depth.profile;assert.ok(a.ready&&a.depth);
  assert.ok(fs.readFileSync(path.join(root,'assets/stages',stage.id+'-panorama-v3.png')).equals(bytes('assets/stages/'+stage.id+'-panorama-v3.png')),'original panorama modified');
  for(const [layer,start] of [[a.depth.far,420],[a.depth.foreground,0]]){
   const data=layer.getContext('2d').getImageData(0,start,1440,layer===a.depth.far?80:500).data;
   for(let i=3;i<data.length;i+=4)assert.equal(data[i],0,'depth mask must not blur the combat floor / fighter area');
  }
  const focused=createCanvas(1440,540),fc=focused.getContext('2d');fc.drawImage(a.panorama,0,0);fc.drawImage(a.depth.far,0,0);
  const raw=energy(a.panorama,p.x-50,p.y-40),soft=energy(focused,p.x-50,p.y-40);assert.ok(soft<raw*.93,stage.id+': distant scene must actually lose high frequency detail');
  for(const camera of [-240,0,240]){const c=createCanvas(960,540),ctx=c.getContext('2d');stage.draw(ctx,3,camera);stage.drawForeground(ctx,3,camera);
   const data=ctx.getImageData(0,0,960,540).data;for(let i=3;i<data.length;i+=4)assert.equal(data[i],255,'uncovered panorama edge');cameraViews++;
  }
  const ctx=createCanvas(960,540).getContext('2d');ctx.globalAlpha=.61;ctx.translate(7,11);const transform=ctx.getTransform().toString(),alpha=ctx.globalAlpha;
  stage.draw(ctx,3,120);stage.drawForeground(ctx,3,120);assert.equal(ctx.globalAlpha,alpha);assert.equal(ctx.getTransform().toString(),transform);assert.equal(ctx.filter,'none');
  images.push({stage:stage.id,originalEdgeEnergy:+raw.toFixed(3),distantEdgeEnergy:+soft.toFixed(3)});
  assert.equal(stage.worldWidth,1440);assert.equal(stage.cameraMin,-240);assert.equal(stage.cameraMax,240);
 }
 // Exercise a real raster fallback with filter deliberately unavailable.
 const fallback={window:{},document:{createElement:()=>{const c=createCanvas(1,1),get=c.getContext.bind(c);c.getContext=type=>{const ctx=get(type);return new Proxy(ctx,{get:(t,k)=>k==='filter'?undefined:typeof t[k]==='function'?t[k].bind(t):t[k],set:(t,k,v)=>{t[k]=v;return true;}});};return c;}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'js/stage-depth.js'),'utf8'),fallback);
 const soft=fallback.window.StageDepth.prepare('city',s.STAGE_ART.city.panorama);assert.equal(soft.optics,'smooth-downsample');
 const composite=createCanvas(1440,540),cc=composite.getContext('2d');cc.drawImage(s.STAGE_ART.city.panorama,0,0);cc.drawImage(soft.far,0,0);
 assert.ok(energy(composite,685,105)<energy(s.STAGE_ART.city.panorama,685,105)*.93,'fallback must also produce genuine optical softness');
 // Measure camera displacement of actual snow rectangles, including wrapping.
 function weather(camera,front){const ctx=createCanvas(960,540).getContext('2d'),rects=[],fill=ctx.fillRect.bind(ctx);ctx.fillRect=function(x,y,w,h){if(w<=3&&h===w)rects.push({x:Math.round(x),alpha:this.globalAlpha});return fill(x,y,w,h);};const stage=s.STAGES.find(v=>v.id==='snow');front?stage.drawForeground(ctx,2,camera):stage.draw(ctx,2,camera);return rects;}
 let weatherSamples=0;for(const [front,alpha,rate] of [[false,.28,.28],[false,1,.7],[true,1,1.3]]){
  const a=weather(0,front).filter(r=>Math.abs(r.alpha-alpha)<1/255),b=weather(20,front).filter(r=>Math.abs(r.alpha-alpha)<1/255);assert.ok(a.length);assert.equal(a.length,b.length);
  for(let i=0;i<a.length;i++){const shift=(b[i].x-a[i].x+1120)%1120;assert.ok(Math.abs(shift-(1120-20*rate))<=1,'weather parallax must follow camera depth');weatherSamples++;}
 }
 for(const h of [old,current]){const g=h.fight();g.pve=false;g.training=true;h.s.Settings={values:{shake:false}};g.f1.x=350;g.f2.x=620;h.s.Input.MODES.p1='classic';}
 let gameplayFrames=0;
 for(let t=0;t<300;t++){
  for(const h of [old,current]){if(t===1)h.key('d');if(t===61)h.key('d',false);if(t===75)h.key('g');if(t===76)h.key('g',false);if(t===135)h.key('w');if(t===136)h.key('w',false);if(t===148)h.key('w');if(t===149)h.key('w',false);if(t===210)h.key('a');if(t===250)h.key('a',false);h.tick();}
  for(const who of ['f1','f2'])for(const field of ['x','y','vx','vy','hp','meter','drive','state','stateT','facing','onGround','jumpCount','comboHits','gaitMoving','stepPhase'])assert.equal(current.g[who][field],old.g[who][field],who+'/'+field+' changed due to scenery');
  assert.equal(current.g.cameraX,old.g.cameraX);gameplayFrames++;
 }
 assert.ok(current.g.f2.hp<10000,'exercise actual combat');
 const result={passed:true,baselineCommit,stages:7,cameraViews,weatherSamples,weatherRates:{far:.28,middle:.7,foreground:1.3},gameplayFrames,unchangedGameplayModules:gameplay.length,originalPanoramasUnchanged:true,combatFloorUnblurred:true,canvasFilterFallbackVerified:true,images};
 const out=path.join(root,'output/stage-depth');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'check-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
