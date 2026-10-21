// Original 60 Hz game-loop replay, shipped PNGs, and production move-demo inputs.
// Neither the simulation nor the authored art is interpolated for this capture.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events'),{createHash}=require('node:crypto');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const {harness}=require('./gameplay-harness.cjs');
const {loadImage,GlobalFonts}=require('@napi-rs/canvas');
const out=path.resolve(root,process.env.PIXEL_FX_OUTPUT||'output/special-fx-detail');
const keys=['special','uppercut','rush','tech','skill','super1','super2','super'];
const highlights=[['special','super2'],['tech','super'],['special','super2'],['special','super'],['special','super2'],['skill','super']];
const heroes=['super2','super','super2','super','super2','skill'];
const identity=['风纹与旋镖','花瓣与绯刃','岩屑与重击','电弧与雷域','月牙与刀光','火舌与焰印'];
const sha=value=>createHash('sha256').update(value).digest('hex');
function text(ctx,value,x,y,size,color='#eee5d0'){
 ctx.fillStyle=color;ctx.font=`bold ${size}px "Fight CJK"`;ctx.textAlign='left';ctx.fillText(value,x,y);
}
function sampledHarness(art,sources={}){
 // Skip only the screen compositor in non-video cases. Every collision tick,
 // authored PNG contact mask, hitstop, movement and projectile still executes.
 const canvas=createCanvas(960,540),native=canvas.getContext('2d'),methods=new Map();let raster=false;
 const context=new Proxy({}, {
  get(_target,key){
   const value=native[key];if(typeof value!=='function')return value;
   if(!methods.has(key))methods.set(key,(...args)=>raster||String(key).startsWith('create')||key==='measureText'?value.apply(native,args):undefined);
   return methods.get(key);
  },
  set(_target,key,value){if(raster)native[key]=value;return true;}
 });
 const h=harness(91,{sources,context,document:{createElement:()=>createCanvas(1,1)}});
 Object.assign(h.s,{DrawnAnimation:art.s.DrawnAnimation,STAGE_ART:art.s.STAGE_ART,STAGES:art.s.STAGES,
  URLSearchParams,location:{search:'?moveDemo=1'},parent:{}});
 h.s.document.documentElement={classList:{add(){}}};
 h.s.Audio2.setMusicOn=()=>{};h.s.Audio2.setSfxOn=()=>{};
 h.s.Settings={values:{shake:false}};
 vm.runInContext(fs.readFileSync(path.join(root,'js/move-demo.js'),'utf8'),h.s,{filename:'move-demo.js'});
 return {...h,canvas,session:h.s.MoveDemoSession,
  tickFrame(draw=false){raster=draw;try{h.tick();}finally{raster=false;}},
  render(){raster=true;try{h.tick(1,Infinity);}finally{raster=false;}}
 };
}
function activeCenter(h){
 const {g}=h,p=g.projectiles.find(p=>p.owner===g.f1&&p.t>=p.armFrames);
 if(p)return {x:p.x-g.cameraX,y:p.y};
 const f=g.f1,m=f.attack,box=h.s.CombatSpacing.geometry(m,f.width,f.stateT,false);
 return {x:f.x+f.facing*(box.near+box.far)/2-g.cameraX,y:f.y+box.y};
}
function hitCenter(h){
 const e=h.g.effects.find(e=>e.specialStyle===h.g.f1.def.id&&e.t>=3&&e.t<e.life);
 return e?{x:e.x-h.g.cameraX,y:e.y}:null;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});fonts();
 GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','monospace');
 const art=nativeHarness(91);await art.s.DrawnAnimation.loading;assert.equal(art.s.DrawnAnimation.status,'ready');
 for(let i=0;i<200&&!Object.values(art.s.STAGE_ART).every(a=>a.ready);i++)await new Promise(r=>setTimeout(r,20));
 assert.ok(Object.values(art.s.STAGE_ART).every(a=>a.ready),'original stage PNGs ready');
 const h=sampledHarness(art),baselineDir=path.resolve(root,process.env.PIXEL_FX_BASELINE_DIR||path.join(out,'baseline'));
 const baselineFiles=['fighter','motion60','game'].map(name=>[name,path.join(baselineDir,name+'.js')]);
 const baselineSource=Object.fromEntries(baselineFiles.filter(([,file])=>fs.existsSync(file)).map(([name,file])=>[name,fs.readFileSync(file,'utf8')]));
 assert.ok(!Object.keys(baselineSource).length||Object.keys(baselineSource).length===3,'comparison baseline must contain all three source files');
 const before=Object.keys(baselineSource).length?sampledHarness(art,baselineSource):null;
 const board=createCanvas(3200,1668),bc=board.getContext('2d'),cover=createCanvas(1440,624),cc=cover.getContext('2d');
 const detail=before?createCanvas(1440,1516):null,dc=detail?.getContext('2d');
 for(const ctx of [bc,cc,dc].filter(Boolean)){ctx.fillStyle='#111e2b';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=false;}
 if(dc){text(dc,'同一引擎、同一帧 · 原始像素放大 ×2',14,26,20);for(const [i,label] of ['此前 · 出招','现在 · 出招','此前 · 命中','现在 · 命中'].entries())text(dc,label,i*360+12,56,15,'#a8becd');}
 const canvas=createCanvas(960,540),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 const video=path.join(out,'Pixel-Fighter-Special-FX-Detail.mp4'),ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
 const encoder=spawn(ffmpeg,['-y','-f','rawvideo','-pixel_format','rgba','-video_size','960x540','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',video],{stdio:['pipe','ignore','pipe']});
 const errors=[];let failed;encoder.stderr.on('data',d=>errors.push(d.toString()));encoder.on('error',e=>{failed=e;});encoder.stdin.on('error',e=>{failed=e;});const finished=once(encoder,'close');
 let frames=0;const cases=[];
 function compose(sample,c,m){
  ctx.drawImage(sample.canvas,0,0);ctx.fillStyle='#101d2beb';ctx.fillRect(0,478,960,62);ctx.fillStyle=c.fxColor;ctx.fillRect(22,491,3,31);
  text(ctx,`${c.name} · ${m.name}`,38,501,18,c.fxColor);
  text(ctx,`${identity[sample.s.CHARACTERS.findIndex(def=>def.id===c.id)]}   /   原版引擎回放 · 60 Hz · 无补帧`,38,524,13,'#c0cbd7');
 }
 async function emit(){if(failed)throw failed;if(!encoder.stdin.write(canvas.data()))await once(encoder.stdin,'drain');frames++;}
 function capture(sample,c,m){sample.render();compose(sample,c,m);return Buffer.from(canvas.toBuffer('image/png'));}
 async function detailCrop(buffer,center,column,row){
  const image=await loadImage(buffer),sx=Math.max(0,Math.min(780,Math.round(center.x-90))),sy=Math.max(0,Math.min(378,Math.round(center.y-50)));
  dc.drawImage(image,sx,sy,180,100,column*360,64+row*242+28,360,200);
 }
 try{
  for(let index=0;index<6;index++)for(const [ki,kind] of keys.entries()){
   const c=h.s.CHARACTERS[index],m=c.moves[kind],facing=ki%2?-1:1,include=highlights[index].includes(kind);
   h.session.select(c.id,kind,{facing});if(before)before.session.select(c.id,kind,{facing});
   let selected=null,contact=null,previousActive=null,previousHit=null,activeCrop=null,contactCrop=null,target;
   const hits=[],duration=240;let time=0;
   for(time=0;time<duration;time++){
    h.tickFrame(include&&time<126);if(before)before.tickFrame();
    if(time===0){
     target=h.g.f2;const take=target.takeHit.bind(target);
     target.takeHit=(hit,...args)=>{const result=take(hit,...args);if(!result.ignored&&!result.countered)hits.push({frame:time,damage:result.dmg,blocked:!!result.blocked});return result;};
    }
    const {g}=h,f=g.f1;
    const active=m.projectile?g.projectiles.some(p=>p.owner===f&&p.t>=(p.armFrames?p.armFrames+3:6)):
     f.attack&&f.stateT>=f.attack.startup+2&&f.stateT<f.attack.startup+f.attack.active&&(!m.counter||f.counterTriggered);
    if(!selected&&active){
     selected=capture(h,c,m);activeCrop=activeCenter(h);
     if(before&&kind===heroes[index])previousActive=capture(before,c,m);
    }
    const center=hitCenter(h);
    if(!contact&&center){
     contact=capture(h,c,m);contactCrop=center;
     if(before&&kind===heroes[index])previousHit=capture(before,c,m);
    }
    if(include&&time<126){compose(h,c,m);await emit();}
   }
   assert.ok(selected,`${c.id}/${kind}: active art snapshot not observed`);
   assert.ok(hits.some(hit=>hit.damage>0&&!hit.blocked),`${c.id}/${kind}: replay must include a real damaging contact`);
   assert.ok(contact,`${c.id}/${kind}: confirmed impact not captured`);
   const snapshot=h.session.snapshot();assert.equal(snapshot.hits,hits.filter(hit=>!hit.blocked&&hit.damage>0).length,'demo hit count matches real collisions');
   const image=await loadImage(selected),cellX=ki*400,cellY=index*278;
   text(bc,`${c.name} · ${m.name}`,cellX+10,cellY+24,17,c.fxColor);bc.drawImage(image,cellX,cellY+36,400,225);
   if(kind===heroes[index]){
    const cx=index%3*480,cy=Math.floor(index/3)*312;text(cc,`${c.name} · ${identity[index]}`,cx+12,cy+26,18,c.fxColor);cc.drawImage(image,cx,cy+38,480,270);
    if(dc){
     text(dc,`${c.name} · ${m.name}`,12,64+index*242+21,16,c.fxColor);
     await detailCrop(previousActive,activeCrop,0,index);await detailCrop(selected,activeCrop,1,index);
     await detailCrop(previousHit,contactCrop,2,index);await detailCrop(contact,contactCrop,3,index);
    }
   }
   fs.writeFileSync(path.join(out,`${c.id}-${kind}.png`),selected);fs.writeFileSync(path.join(out,`${c.id}-${kind}-contact.png`),contact);
   cases.push({character:c.id,move:kind,name:m.name,facing,frames:duration,hits,video:include,videoFrames:include?126:0});
   console.log(`Replayed ${c.id}/${kind}: ${hits.length} real contacts`);
  }
  encoder.stdin.end();const [code]=await finished;if(code!==0)throw Error(errors.join('').slice(-3000));
  fs.writeFileSync(path.join(out,'all-moves.png'),board.toBuffer('image/png'));fs.writeFileSync(path.join(out,'overview.png'),cover.toBuffer('image/png'));
  if(detail)fs.writeFileSync(path.join(out,'before-after.png'),detail.toBuffer('image/png'));
  const report={passed:true,video,width:960,height:540,fps:60,videoFrames:frames,seconds:frames/60,sound:false,
   interpolated:false,simulationHz:60,originalPNG:true,scenarios:'Production MoveDemoSession: real counter strike, real anti-air jump, and real walk into armed traps.',
   baseline:before?{directory:baselineDir,hashes:Object.fromEntries(Object.entries(baselineSource).map(([name,source])=>[name+'.js',sha(source)]))}:null,
   sourceHashes:Object.fromEntries(['fighter','motion60','game','move-demo'].map(name=>[name+'.js',sha(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'))])),cases};
  fs.writeFileSync(path.join(out,'replay-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({video,seconds:frames/60,cases:cases.length,beforeAfter:!!detail}));
 }catch(error){encoder.stdin.destroy();encoder.kill();throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
