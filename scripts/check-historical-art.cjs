// Independent pixel proof against the renderer and all PNGs in selected Git B.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs'),{Image}=require('@napi-rs/canvas');
const catalog=require('./effective-animation-catalog.cjs').effectiveCatalog();
const reference=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/art-restoration/roster-source.json')));
const checkpoint='4b986c26edfb686e1a48f52f50adcdefd52acd48';
const old=file=>execFileSync('git',['show',reference.commit+':'+file],{cwd:root,maxBuffer:16*1024*1024});
(async()=>{
 const native=nativeHarness(91);await native.s.DrawnAnimation.loading;const art=native.s.DrawnAnimation;assert.equal(art.status,'ready');
 const manifest=JSON.parse(old('assets/characters/animation-v7/manifest.json'));
 assert.deepEqual(reference.characters,manifest.characters);
 const code=old('js/arcade-animation.js').toString(),scope={window:{},document:{createElement:()=>createCanvas(1,1)}};
 vm.runInNewContext(code.slice(0,code.indexOf('  const loading=fetch('))+'window.isolate=isolate;})();',scope);
 let compared=0,drawings=0;const originalFiles=new Set();
 for(const [id,clips] of Object.entries(reference.characters)){
  const originals={},cache={};
  for(const [name,clip] of Object.entries(clips)){
   if(!cache[clip.sheet]){
    const filename=reference.sourceRoot+clip.sheet+'.png',data=fs.readFileSync(path.join(root,filename));
    assert.ok(data.equals(old(filename)),filename+' differs from B');
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),reference.sha256[clip.sheet+'.png']);originalFiles.add(filename);
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=path.join(root,filename);});
    const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    cache[clip.sheet]={width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
   }
   originals[name]=clip.frames.map(meta=>scope.window.isolate(cache[clip.sheet],meta,clip.scale));drawings+=clip.frames.length;
  }
  for(const [name,clip] of Object.entries(catalog.characters[id])){
   assert.equal(clip.historicalCommit,reference.commit);assert.equal(clip.sourceRoot,'assets/characters/art-restoration/');
   for(let i=0;i<clip.frames.length;i++){
    const meta=clip.frames[i],p=meta.historical,original=originals[p.clip][p.index],sprite=art.sprite(id,name,i),[sx,sy,w,h]=meta.rect;
    const expected=createCanvas(w,h),actual=createCanvas(w,h),ex=expected.getContext('2d'),ac=actual.getContext('2d');
    ex.imageSmoothingEnabled=ac.imageSmoothingEnabled=false;
    ex.drawImage(original.canvas,meta.root-sx+(original.x+p.offsetX)*2,meta.ground-sy+(original.y+p.offsetY)*2);
    ac.drawImage(sprite.canvas,meta.root-sx+sprite.x*2,meta.ground-sy+sprite.y*2);
    assert.ok(Buffer.from(ac.getImageData(0,0,w,h).data).equals(Buffer.from(ex.getImageData(0,0,w,h).data)),`${id}/${name}/${i}: changed historical pixels`);
    if(name==='idle'){assert.equal(p.offsetX,0);assert.equal(p.offsetY,0);}compared++;
   }
  }
 }
 const unchanged=['assets/characters/animation-v8/manifest.json','js/characters.js','js/fighter.js','js/input.js','js/controls.js','js/combat-rules.js','js/ai.js','js/ui.js','js/panels.js','js/stages.js','js/settings.js','js/strike-art.js','js/strike-motion.js','js/motion60.js'];
 for(const file of unchanged)assert.ok(fs.readFileSync(path.join(root,file)).equals(execFileSync('git',['show',checkpoint+':'+file],{cwd:root,maxBuffer:16*1024*1024})),file+' gameplay changed');
 // The separately authorized visible-contact fix changes only melee resolution
 // and its geometry. Protect all other mechanics and movement in these files.
 for(const [file,start,end] of [['js/game.js','  function resolveMelee(','  function updateProjectiles('],['js/combat-spacing.js','  function geometry(','  function travelAt(']]){
  const baseline=execFileSync('git',['show',checkpoint+':'+file],{cwd:root}).toString(),current=fs.readFileSync(path.join(root,file),'utf8');
  const outside=code=>{const a=code.indexOf(start),b=code.indexOf(end,a);assert.ok(a>=0&&b>a);return code.slice(0,a)+code.slice(b);};
  assert.equal(outside(current),outside(baseline),file+' changed outside visible contact');
 }
 assert.equal(execFileSync('git',['diff',checkpoint,'--name-only','--','assets/characters/animation-v7','assets/characters/animation-v8'],{cwd:root}).toString(),'');
 const result={passed:true,sourceCommit:reference.commit,characters:6,clips:132,comparedNativeFrames:compared,originalDrawings:drawings,originalSheets:originalFiles.size,unchangedModules:unchanged.length,limitedContactChanges:['resolveMelee','geometry'],proof:'pixel equality with Git B renderer and PNGs; unchanged combat parameters, movement, input and UI; authorized visible-contact fix only'};
 fs.mkdirSync(path.join(root,'output/art-restoration/full'),{recursive:true});fs.writeFileSync(path.join(root,'output/art-restoration/full/historical-art-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
