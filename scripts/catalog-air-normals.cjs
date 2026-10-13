// Six independent exposure sheets using complete, approved B-version drawings.
// No part extraction, resampling, deformation, interpolation or generated art.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createCanvas}=require('@napi-rs/canvas');
const {originalSprites}=require('./restore-historical-locomotion.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/characters/air-normals');
const reference=JSON.parse(fs.readFileSync(path.join(root,'assets/characters/art-restoration/roster-source.json')));
const timeline=[.08,.16,.24,.32,.45,.59,.70,.81,.92,1];
const palm={ryu:1,mei:2,tank:1,volt:2,kaze:2,sage:1};
// Whole-drawing registration keeps the crouched heavy kick's head / pelvis at
// the airborne stance height. These are native-pixel offsets, not limb edits.
const tuck={ryu:-9,mei:-8,tank:-13,volt:-12,kaze:-12,sage:-14};
const pose=(clip,index,y=0)=>({clip,index,x:0,y});
function exposures(id){
 return {
  airLightPunch:{band:[-48,-23],poses:[pose('jump',2),pose('airPunch',0),pose('airPunch',0),pose('airPunch',0),pose('airPunch',1),pose('airPunch',1),pose('airPunch',2),pose('airPunch',3),pose('jump',2),pose('jump',2)]},
  airMediumPunch:{band:[-52,-21],poses:[pose('jump',2),pose('cast',0),pose('throw',1),pose('cast',0),pose('cast',palm[id]),pose('cast',palm[id]),pose('cast',2===palm[id]?1:2),pose('airPunch',2),pose('airPunch',3),pose('jump',2)]},
  airHeavyPunch:{band:[-60,-20],poses:[pose('jump',2),pose('throw',1),pose('rise',1),pose('rise',1),pose('heavy',3),pose('heavy',4),pose('heavy',5),pose('airPunch',2),pose('airPunch',3),pose('jump',2)]},
  airLightKick:{band:[-45,-12],poses:[pose('jump',2),pose('airKick',0),pose('kick',1),pose('kick',2),pose('kick',2),pose('kick',3),pose('airKick',2),pose('airKick',3),pose('jump',2),pose('jump',2)]},
  airMediumKick:{band:[-48,-8],poses:[pose('jump',2),pose('airKick',0),pose('airKick',0),pose('airKick',0),pose('airKick',1),pose('airKick',1),pose('airKick',2),pose('airKick',2),pose('airKick',3),pose('jump',2)]},
  airHeavyKick:{band:[-38,-6],poses:[pose('jump',2),pose('airKick',0),pose('airKick',0),pose('lowKick',2,tuck[id]),pose('lowKick',3,tuck[id]),pose('lowKick',3,tuck[id]),pose('lowKick',2,tuck[id]),pose('airKick',2),pose('airKick',3),pose('jump',2)]},
 };
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const characters={};let frames=0;
 for(const [id,clips] of Object.entries(reference.characters)){
  const originals=await originalSprites({...reference,clips});characters[id]={};
  for(const [name,{band,poses}] of Object.entries(exposures(id))){
   const compact=poses.every(p=>{
    const sprite=originals[p.clip][p.index],x=96+(sprite.x+p.x)*2,y=144+(sprite.y+p.y)*2;
    return x>=0&&y>=0&&x+sprite.canvas.width<=192&&y+sprite.canvas.height<=160;
   });
   const W=compact?192:576,H=compact?160:480,OX=compact?96:288,OY=compact?144:304,columns=4;
   const canvas=createCanvas(W*columns,H*3),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
   const meta=poses.map((p,i)=>{
    const sprite=originals[p.clip][p.index],sx=i%columns*W,sy=Math.floor(i/columns)*H;
    const x=OX+Math.round((sprite.x+p.x)*2),y=OY+Math.round((sprite.y+p.y)*2);
    if(x<0||y<0||x+sprite.canvas.width>W||y+sprite.canvas.height>H)throw Error('Air drawing exceeds tile');
    ctx.drawImage(sprite.canvas,sx+x,sy+y);frames++;
    return {rect:[sx,sy,W,H],seed:(sy+y)*canvas.width+sx+x,root:sx+OX,ground:sy+OY,slot:i,
     historical:{clip:p.clip,index:p.index,x,y,width:sprite.canvas.width,height:sprite.canvas.height,offsetX:p.x,offsetY:p.y}};
   });
   const sheet=id+'-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),png=canvas.toBuffer('image/png');
   fs.writeFileSync(path.join(out,sheet+'.png'),png);
   characters[id][name]={owner:id,identity:clips.airPunch.identity,authored:true,scale:.5,sheet,
    sourceRoot:'assets/characters/air-normals/',historicalCommit:reference.commit,
    revision:crypto.createHash('sha256').update(png).digest('hex').slice(0,16),frames:meta,timeline,contactFrames:[4,5],strikeBand:band};
  }
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({identityVersion:reference.identityVersion,sourceCommit:reference.commit,characters},null,2)+'\n');
 console.log(JSON.stringify({characters:6,independentClips:36,exposures:frames,mode:'complete original pixel drawings; six explicit anticipation/contact/recovery sequences'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
