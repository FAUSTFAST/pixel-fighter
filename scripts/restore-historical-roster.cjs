// Restore the complete accepted B art through fixed whole-drawing exposures.
// Neither current gameplay modules nor the current v8 assets are overwritten.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas}=require('@napi-rs/canvas');
const {originalSprites,support,buildClip}=require('./restore-historical-locomotion.cjs');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'assets/characters/art-restoration');
const reference=JSON.parse(fs.readFileSync(path.join(directory,'roster-source.json')));
const current=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/animation-v8/manifest.json')));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const normal=['jab','heavy','kick','lowKick'];
function candidates(sprite){return [-1,1].flatMap(side=>{try{return [{...support(sprite,side),x:sprite.x+(support(sprite,side).right+.5)/2,side}]}catch{return []}});}
function gaitRecords(name,sprites){
 const dir=name==='walk'?1:-1,records=[];let planted=null,interval=-1;
 for(let pose=0;pose<8;pose++){
  const sprite=sprites[pose],feet=candidates(sprite);if(!feet.length)throw Error('Historical feet missing');
  const lowest=Math.max(...feet.map(f=>f.row));
  let foot=feet.find(f=>f.side===planted?.side&&f.row>=lowest-1);
  let offset=foot&&planted?planted.anchor-(pose*2-planted.first)*dir-foot.x:Infinity;
  // Retain a foot only while it is actually grounded and registration stays
  // within a short weight transfer. A lifted / replanted foot starts an interval.
  if(!foot||Math.abs(offset)>2.5){
   foot=feet.filter(f=>f.row>=lowest-1).sort((a,b)=>(b.right-b.left)-(a.right-a.left))[0];
   planted={side:foot.side,anchor:foot.x,first:pose*2};interval++;offset=0;
  }
  for(let hold=0;hold<2;hold++)records.push({sprite,sourceClip:name,sourceIndex:pose,offsetX:Math.round((offset-hold*dir)*2)/2,offsetY:-(sprite.y+foot.row/2),support:{interval,side:foot.side,left:foot.left,right:foot.right,row:foot.row,measurement:'toe'}});
 }
 return records;
}
function exposureOrder(name,id){
 if(normal.includes(name))return [0,1,2,2,3,(['kick','lowKick'].includes(name)||id==='volt'&&name==='jab')?4:3,4,5,5,6,7,7];
 if(['jump','backjump'].includes(name))return [0,1,1,2,2,2,3,3];
 if(['airPunch','airKick','rise','rush'].includes(name))return [0,0,0,1,1,2,3,3];
 if(name==='cast')return [0,0,1,2,2,1,3,3];
 if(name==='throw')return [0,0,1,2,2,1,3,3];
 if(['fall','getup'].includes(name))return [0,1,1,2,2,3];
 return [0,1,2,3];
}
function pack(id,name,sprites,idle){
 // Volt's second original jab extends its fingers further: register the entire
 // drawing one local pixel back so its hand remains inside the unchanged box.
 const records=['walk','backwalk'].includes(name)?gaitRecords(name,sprites):exposureOrder(name,id).map((index,exposure)=>({sprite:sprites[index],sourceClip:name,sourceIndex:index,offsetX:normal.includes(name)&&[4,5].includes(exposure)?(id==='volt'&&name==='jab'&&exposure===5?-1:1):0,offsetY:0}));
 const stopVariants=[];
 if(['walk','backwalk'].includes(name)){
  const index=records.length;records.push({sprite:idle[0],sourceClip:'idle',sourceIndex:0,offsetX:0,offsetY:0});
  for(let i=0;i<16;i++)stopVariants.push([i,i,index,index]);
 }
 // Most clips fit the established tile. Exceptionally long swords / capes
 // receive extra transparent room; pixels, scale and world anchors stay intact.
 const fits=r=>{const x=96+(r.sprite.x+r.offsetX)*2,y=144+(r.sprite.y+r.offsetY)*2;return x>=0&&y>=0&&x+r.sprite.canvas.width<=192&&y+r.sprite.canvas.height<=160;};
 const compact=records.every(fits),W=compact?192:576,H=compact?160:480,OX=compact?96:288,OY=compact?144:304,columns=4;
 const canvas=createCanvas(columns*W,Math.ceil(records.length/columns)*H),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const frames=records.map((r,i)=>{
  const sx=i%columns*W,sy=Math.floor(i/columns)*H,x=OX+Math.round((r.sprite.x+r.offsetX)*2),y=OY+Math.round((r.sprite.y+r.offsetY)*2);
  if(x<0||y<0||x+r.sprite.canvas.width>W||y+r.sprite.canvas.height>H)throw Error('Drawing exceeds tile '+id+'/'+name);
  ctx.drawImage(r.sprite.canvas,sx+x,sy+y);
  const meta={rect:[sx,sy,W,H],seed:(sy+y)*canvas.width+sx+x,root:sx+OX,ground:sy+OY,slot:i,historical:{clip:r.sourceClip,index:r.sourceIndex,x,y,width:r.sprite.canvas.width,height:r.sprite.canvas.height,offsetX:r.offsetX,offsetY:r.offsetY}};
  if(r.support)meta.support={...r.support,left:x+r.support.left,right:x+r.support.right,row:y+r.support.row};
  return meta;
 });
 const sheet=id+'-'+name.toLowerCase()+'-b',png=canvas.toBuffer('image/png');fs.writeFileSync(path.join(directory,sheet+'.png'),png);
 const clip={owner:id,identity:reference.characters[id][name].identity,revision:hash(png).slice(0,16),sheet,sourceRoot:'assets/characters/art-restoration/',scale:.5,authored:true,frames,historicalCommit:reference.commit,originalDrawings:sprites.length};
 if(name==='idle')clip.breath=[0,0,1,2,3,3,2,1];
 if(stopVariants.length)Object.assign(clip,{cycleFrames:16,direction:name==='walk'?1:-1,stopVariants});
 if(normal.includes(name))Object.assign(clip,{timeline:current.characters[id][name].timeline,contactFrames:[4,5]});
 return clip;
}
async function rebuild(){
 const characters={};let drawings=0;
 for(const [id,clips] of Object.entries(reference.characters)){
  const originals=await originalSprites({...reference,clips});characters[id]={};
  for(const [name,sprites] of Object.entries(originals)){
   // Preserve the exact, already accepted Ryu locomotion outputs.
   characters[id][name]=id==='ryu'&&['idle','walk','backwalk'].includes(name)?buildClip(name,sprites,originals.idle):pack(id,name,sprites,originals.idle);
   drawings+=sprites.length;
  }
 }
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify({identityVersion:reference.identityVersion,sourceCommit:reference.commit,characters},null,2)+'\n');
 console.log(JSON.stringify({characters:6,clips:132,historicalDrawings:drawings,sourceCommit:reference.commit,mode:'original fixed pixels; current combat phase and locomotion timing'}));
}
module.exports={rebuild};
if(require.main===module)rebuild().catch(error=>{console.error(error);process.exitCode=1;});
