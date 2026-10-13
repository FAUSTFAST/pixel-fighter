// Native-pixel identity and visual independence, using actual approved PNGs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const {originalSprites}=require('./restore-historical-locomotion.cjs');
const reference=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/art-restoration/roster-source.json')));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/air-normals/manifest.json')));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
 fonts();const h=nativeHarness(91);await h.s.DrawnAnimation.loading;const art=h.s.DrawnAnimation;
 assert.equal(art.status,'ready');let checked=0;const signatures={};
 const overview=createCanvas(1440,1000),ctx=overview.getContext('2d');ctx.fillStyle='#243047';ctx.fillRect(0,0,1440,1000);ctx.imageSmoothingEnabled=false;
 for(const [row,def] of h.s.CHARACTERS.entries()){
  const originals=await originalSprites({...reference,clips:reference.characters[def.id]});signatures[def.id]=[];
  const clips=catalog.characters[def.id];assert.equal(Object.keys(clips).length,6);
  for(const [col,[name,clip]] of Object.entries(clips).entries()){
   assert.equal(clip.owner,def.id);assert.equal(clip.historicalCommit,reference.commit);assert.equal(clip.frames.length,10);
   assert.equal(clip.revision,hash(fs.readFileSync(path.join(root,clip.sourceRoot,clip.sheet+'.png'))).slice(0,16));
   for(const [i,meta] of clip.frames.entries()){
    const p=meta.historical,source=originals[p.clip][p.index],sprite=art.sprite(def.id,name,i),[sx,sy,w,hh]=meta.rect;
    const expected=createCanvas(w,hh),ex=expected.getContext('2d');ex.imageSmoothingEnabled=false;
    ex.drawImage(source.canvas,meta.root-sx+(source.x+p.offsetX)*2,meta.ground-sy+(source.y+p.offsetY)*2);
    const actual=sprite.canvas.getContext('2d').getImageData(0,0,w,hh).data;
    assert.ok(Buffer.from(actual).equals(Buffer.from(ex.getImageData(0,0,w,hh).data)),`${def.id}/${name}/${i}: original pixel identity`);checked++;
   }
   // Compare opaque cropped drawings, so transparent padding / registration
   // cannot make two identical contact poses appear artificially different.
   const sprite=art.sprite(def.id,name,4),pixels=sprite.canvas.getContext('2d').getImageData(0,0,sprite.canvas.width,sprite.canvas.height);
   let left=pixels.width,top=pixels.height,right=0,bottom=0;
   for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++)if(pixels.data[(y*pixels.width+x)*4+3]>96){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const cropped=sprite.canvas.getContext('2d').getImageData(left,top,right-left+1,bottom-top+1);
   signatures[def.id].push(hash(Buffer.from(cropped.data)));
   ctx.fillStyle='#ffe0a3';ctx.font='15px "Fight CJK"';ctx.fillText(def.name+' · '+{airLightPunch:'轻拳',airMediumPunch:'中拳',airHeavyPunch:'重拳',airLightKick:'轻脚',airMediumKick:'中脚',airHeavyKick:'重脚'}[name],col*240+12,row*165+23);
   ctx.drawImage(sprite.canvas,col*240+105+sprite.x*2,row*165+155+sprite.y*2,sprite.w*2,sprite.h*2);
  }
  assert.equal(new Set(signatures[def.id]).size,6,def.id+': six distinct actual contact drawings');
 }
 const out=path.join(root,'output/air-motion');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'independent.png'),overview.toBuffer('image/png'));
 const result={passed:true,characters:6,independentClips:36,nativePixelFrames:checked,distinctContactPoses:36,referenceCommit:reference.commit,proof:'Native PNG pixel identity, complete original drawings, cropped contact-pose hashes; no generated inbetweens or transformed body parts.'};
 fs.writeFileSync(path.join(out,'art-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
