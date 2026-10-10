// Repack selected B-version drawings without painting, deformation or blending.
// Run with the bundled @napi-rs/canvas on NODE_PATH; original PNGs stay untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'assets/characters/art-restoration');
const sourceCatalog=JSON.parse(fs.readFileSync(path.join(directory,'ryu-source.json')));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
// The connected-component extraction and native-pixel scaling below are copied
// from aadfccb/js/arcade-animation.js. Preserve that version's isolated drawing.
function isolate(source,meta,scale){
 const RES=2,[sx,sy,w,h]=meta.rect,mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
 const seed=(Math.floor(meta.seed/source.width)-sy)*w+meta.seed%source.width-sx;
 let read=0,write=1;queue[0]=seed;mask[seed]=1;
 const alpha=p=>source.data[((sy+Math.floor(p/w))*source.width+sx+p%w)*4+3];
 const visit=p=>{if(!mask[p]&&alpha(p)>64){mask[p]=1;queue[write++]=p;}};
 while(read<write){const p=queue[read++],x=p%w,y=Math.floor(p/w);if(x)visit(p-1);if(x<w-1)visit(p+1);if(y)visit(p-w);if(y<h-1)visit(p+w);}
 const raw=createCanvas(w,h),context=raw.getContext('2d'),pixels=context.createImageData(w,h);
 for(let p=0;p<w*h;p++){
  const x=p%w,y=Math.floor(p/w),edge=mask[p]||(x&&mask[p-1])||(x<w-1&&mask[p+1])||(y&&mask[p-w])||(y<h-1&&mask[p+w]);
  if(!edge)continue;const offset=((sy+y)*source.width+sx+x)*4;
  for(let c=0;c<4;c++)pixels.data[p*4+c]=source.data[offset+c];
 }
 context.putImageData(pixels,0,0);
 const canvas=createCanvas(Math.max(1,Math.round(w*scale*RES)),Math.max(1,Math.round(h*scale*RES)));
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(raw,0,0,canvas.width,canvas.height);
 return {canvas,x:Math.round((sx-meta.root)*scale*RES)/RES,y:Math.round((sy-meta.ground)*scale*RES)/RES,w:canvas.width/RES,h:canvas.height/RES};
}
async function originalSprites(reference=sourceCatalog){
 const cache={},clips={};
 for(const [name,clip] of Object.entries(reference.clips)){
  if(!cache[clip.sheet]){
   const file=path.join(root,reference.sourceRoot,clip.sheet+'.png');
   if(hash(fs.readFileSync(file))!==reference.sha256[clip.sheet+'.png'])throw Error('Historical source changed: '+file);
   const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=file;});
   const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   cache[clip.sheet]={width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
  }
  clips[name]=clip.frames.map(meta=>isolate(cache[clip.sheet],meta,clip.scale));
 }
 return clips;
}
// Explicit support changes follow the feet in the eight historical drawings.
// A lifted / replanted foot starts a new interval; we do not stretch the legs
// to impose the newer generated gait's unrelated eight-exposure stance pattern.
const plants={walk:[[0,1,-1],[2,3,1],[4,9,-1],[10,13,1],[14,15,-1]],backwalk:[[0,1,-1],[2,3,1],[4,5,-1],[6,7,1],[8,9,-1],[10,13,-1],[14,15,1]]};
function support(sprite,side){
 const p=sprite.canvas.getContext('2d').getImageData(0,0,sprite.canvas.width,sprite.canvas.height);
 let row=-1;for(let y=Math.max(0,p.height-12);y<p.height;y++)for(let x=0;x<p.width;x++)if((sprite.x+(x+.5)/2)*side>0&&p.data[(y*p.width+x)*4+3]>96)row=y;
 if(row<0)throw Error('Historical sole missing');
 const xs=[];for(let x=0;x<p.width;x++)if((sprite.x+(x+.5)/2)*side>0&&p.data[(row*p.width+x)*4+3]>96)xs.push(x);
 const mean=xs.reduce((a,b)=>a+b,0)/xs.length;
 return {x:sprite.x+(mean+.5)/2,row,left:xs[0],right:xs.at(-1)};
}
function buildClip(name,sprites,idle){
 const records=[];function add(sprite,sourceClip,sourceIndex,offsetX=0,offsetY=0,plant){
  records.push({sprite,sourceClip,sourceIndex,offsetX,offsetY,plant});return records.length-1;
 }
 if(name==='idle')sprites.forEach((sprite,index)=>add(sprite,name,index));
 else{
  const dir=name==='walk'?1:-1;
  for(const [interval,[first,last,side]] of plants[name].entries()){
   const anchor=support(sprites[Math.floor(first/2)],side).x;
   for(let i=first;i<=last;i++){
    const sprite=sprites[Math.floor(i/2)],foot=support(sprite,side);
    const offsetX=Math.round((anchor-(i-first)*dir-foot.x)*2)/2;
    // Register the planted bottom texel on the floor. Whole drawings only.
    const offsetY=-(sprite.y+foot.row/2);
    add(sprite,name,Math.floor(i/2),offsetX,offsetY,{interval,side,left:foot.left,right:foot.right,row:foot.row});
   }
  }
 }
 const stopVariants=[];
 if(name!=='idle'){
  const neutral=add(idle[0],'idle',0);
  // Retain the exposed historical pose briefly, then return to its original
  // neutral drawing. There are no synthetic in-between body parts.
  for(let i=0;i<16;i++)stopVariants.push([i,i,neutral,neutral]);
 }
 const columns=8,canvas=createCanvas(columns*192,Math.ceil(records.length/columns)*160),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const frames=records.map((r,i)=>{
  const sx=i%columns*192,sy=Math.floor(i/columns)*160;
  const x=96+Math.round((r.sprite.x+r.offsetX)*2),y=144+Math.round((r.sprite.y+r.offsetY)*2);
  if(x<0||y<0||x+r.sprite.canvas.width>192||y+r.sprite.canvas.height>160)throw Error('Historical drawing outside fixed tile');
  ctx.drawImage(r.sprite.canvas,sx+x,sy+y);
  const meta={rect:[sx,sy,192,160],seed:(sy+y)*canvas.width+sx+x,root:sx+96,ground:sy+144,slot:i,
   historical:{clip:r.sourceClip,index:r.sourceIndex,x,y,width:r.sprite.canvas.width,height:r.sprite.canvas.height,offsetX:r.offsetX,offsetY:r.offsetY}};
  if(r.plant)meta.support={interval:r.plant.interval,side:r.plant.side,left:x+r.plant.left,right:x+r.plant.right,row:y+r.plant.row};
  return meta;
 });
 const sheet='ryu-'+name+'-b',png=canvas.toBuffer('image/png');fs.writeFileSync(path.join(directory,sheet+'.png'),png);
 return {owner:'ryu',identity:sourceCatalog.clips[name].identity,revision:hash(png).slice(0,16),sheet,sourceRoot:'assets/characters/art-restoration/',scale:.5,authored:true,frames,
  historicalCommit:sourceCatalog.commit,originalDrawings:sprites.length,...(name==='idle'?{breath:[0,0,1,2,3,3,2,1]}:{cycleFrames:16,direction:name==='walk'?1:-1,stopVariants})};
}
async function rebuild(){
 const originals=await originalSprites(),clips={};
 for(const name of ['idle','walk','backwalk'])clips[name]=buildClip(name,originals[name],originals.idle);
 const catalog={identityVersion:sourceCatalog.identityVersion,sourceCommit:sourceCatalog.commit,characters:{ryu:clips}};
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(catalog,null,2)+'\n');
 console.log(JSON.stringify({restored:'ryu idle/walk/backwalk',sourceCommit:sourceCatalog.commit,originalDrawings:20,mode:'unaltered historical pixels; fixed exposure and whole-drawing registration'}));
}
if(require.main===module){
 const complete=path.join(__dirname,'restore-historical-roster.cjs');
 (fs.existsSync(complete)?require(complete).rebuild():rebuild()).catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={originalSprites,support,sourceCatalog,buildClip};
