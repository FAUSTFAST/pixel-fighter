// Six characters in actual production matches, plus native exposure reference.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const out=path.join(root,'output/art-restoration/full');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const runs=[nativeHarness(191),nativeHarness(191,false),nativeHarness(191,false)];await runs[0].s.DrawnAnimation.loading;
 const art=runs[0].s.DrawnAnimation;assert.equal(art.status,'ready');for(const h of runs.slice(1))h.s.DrawnAnimation=art;
 const events=[];let frame=0,measured=0,maxSoleDrift=0;
 function reset(h,index,distance=200){
  const g=h.fight(index*2+1,.85,distance);g.pve=false;g.training=true;h.s.Settings={values:{shake:false}};
  g.f1=new h.s.Fighter(h.s.CHARACTERS[index*2],380,1,'P1');g.f2=new h.s.Fighter(h.s.CHARACTERS[index*2+1],380+distance,-1,'P2');
  g.f1.foe=g.f2;g.f2.foe=g.f1;g.f1.meter=g.f2.meter=300;g.f1.hp=g.f1.maxHp=g.f2.hp=g.f2.maxHp=10000;
  h.s.Input.clear();h.plants=[null,null];
  for(const f of [g.f1,g.f2]){const hit=f.takeHit.bind(f);f.takeHit=(...a)=>{events.push({frame,character:f.def.id,kind:f.foe.attackKind,blocked:f.blocking});return hit(...a);};}
 }
 runs.forEach((h,i)=>reset(h,i));
 const canvas=createCanvas(1080,470),ctx=canvas.getContext('2d'),observations=[];
 const action=(h,f,kind)=>{const ok=f.startAttack(kind);events.push({frame,character:f.def.id,command:kind,accepted:ok});};
 for(frame=0;frame<720;frame++){
  for(const [i,h] of runs.entries()){
   const g=h.g,s=h.s;
   if([140,280,420,570].includes(frame))reset(h,i,frame===280?110:68);
   const a=g.f1,b=g.f2;
   if(frame===12){h.key('d');h.key('ArrowLeft');}if(frame===32){h.key('d',false);h.key('ArrowLeft',false);}
   if(frame===56){h.key('a');h.key('ArrowRight');}if(frame===74){h.key('a',false);h.key('ArrowRight',false);}
   if(frame===92)action(h,a,'heavy');
   if(frame===144)action(h,a,'light');if(frame===174)action(h,b,'heavy');
   if(frame===220){h.key('ArrowRight');action(h,a,'heavy');}if(frame===240)h.key('ArrowRight',false);
   if(frame===282){assert.ok(a.tryJump(1));assert.ok(b.tryJump(-1));}
   if(frame===294){assert.ok(a.tryJump(-1));assert.ok(b.tryJump(1));assert.equal(a.jumpsUsed,2);assert.equal(b.jumpsUsed,2);}
   if(frame===312){action(h,a,'light');action(h,b,'heavyKick');}
   if(frame===424)action(h,a,'heavyKick');if(frame===470)action(h,b,'sweep');
   if(frame===520)action(h,a,'throw');
   if(frame===574)action(h,a,'special');if(frame===626)action(h,b,'super1');
   h.tick();
   for(const [side,f] of [a,b].entries()){
    const selected=art.selection(f.def,f.sampleAnimation().animation);assert.equal(selected.data.historicalCommit,'aadfccb3140210730936c185ad2fc82647404dd1');
    if(frame<140)assert.equal(f.facing,side?-1:1);
    if(f.gaitMoving&&selected.meta.support){
     const support=selected.meta.support,p=selected.sprite.canvas.getContext('2d').getImageData(0,0,selected.sprite.canvas.width,selected.sprite.canvas.height),xs=[];
     for(let x=support.left;x<=support.right;x++)if(p.data[(support.row*p.width+x)*4+3]>96)xs.push(selected.sprite.x+(x+.5)/2);
     assert.ok(xs.length);const sole=f.x+f.facing*4.2*(support.measurement==='toe'?Math.max(...xs):xs.reduce((a,b)=>a+b,0)/xs.length),key=selected.clip+':'+support.interval,plant=h.plants[side];
     if(plant&&plant.key===key&&selected.index>=plant.index){plant.low=Math.min(plant.low,sole);plant.high=Math.max(plant.high,sole);plant.index=selected.index;maxSoleDrift=Math.max(maxSoleDrift,plant.high-plant.low);assert.ok(plant.high-plant.low<4.3,JSON.stringify({character:f.def.id,frame,key,index:selected.index,drift:plant.high-plant.low,x:f.x,phase:f.stepPhase}));measured++;}
     else h.plants[side]={key,index:selected.index,low:sole,high:sole};
    }else h.plants[side]=null;
    observations.push({frame,character:f.def.id,clip:selected.clip,index:selected.index});
   }
  }
  if(frame%3)continue;
  ctx.fillStyle='#101b2a';ctx.fillRect(0,0,1080,470);ctx.fillStyle='#f6d8a0';ctx.font='bold 22px "Fight CJK"';ctx.fillText('六名角色 · B 版原画完整接入 · 游戏实际运行',16,28);
  ctx.fillStyle='#a7bfd7';ctx.font='14px "Fight CJK"';const chapter=frame<140?'前进 / 后退 / 启停 / 远距离挥空':frame<280?'近身拳击 / 格挡 / 受击':frame<420?'双侧二段跳 / 空中攻击':frame<570?'踢击 / 扫腿 / 投技':'发波 / 超必杀';ctx.fillText(`60 Hz 模拟 · 半速回放 · ${chapter} · F${frame}`,16,53);
  for(const [i,h] of runs.entries()){
   const x=i*360;ctx.font='bold 17px "Fight CJK"';ctx.fillStyle='#c4e5e5';ctx.fillText(h.g.f1.name+'  /  '+h.g.f2.name,x+12,79);
   ctx.drawImage(h.canvas,250,20,450,450,x,87,360,360);
   ctx.font='12px "Fight CJK"';ctx.fillStyle='#d4e0ed';ctx.fillText(`${art.selection(h.g.f1.def,h.g.f1.sampleAnimation().animation).label} / ${art.selection(h.g.f2.def,h.g.f2.sampleAnimation().animation).label}`,x+12,465);
  }
  fs.writeFileSync(path.join(out,'frames',String(frame/3).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 assert.ok(events.filter(e=>e.kind).length>10,'actual match hits required');
 const result={passed:true,gameFrames:720,replayFrames:240,characters:6,matches:3,actualHits:events.filter(e=>e.kind).length,measuredSoleSamples:measured,maxLiveSoleDrift:+maxSoleDrift.toFixed(3),events};
 fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(observations));
 const names=['idle','walk','guard','crouch','jab','heavy','kick','lowKick','cast','jump','fall'];
 const roster=createCanvas(names.length*240,6*220+40),rc=roster.getContext('2d');rc.fillStyle='#243342';rc.fillRect(0,0,roster.width,roster.height);rc.imageSmoothingEnabled=false;rc.font='16px "Fight CJK"';rc.fillStyle='white';
 for(const [ci,c] of runs[0].s.CHARACTERS.entries())for(const [ni,name] of names.entries()){
  const index=['walk'].includes(name)?4:['jab','heavy','kick','lowKick'].includes(name)?4:name==='cast'?3:name==='jump'?4:0,sprite=art.sprite(c.id,name,index),x=105+ni*240,y=220+ci*220;
  rc.drawImage(sprite.canvas,x+sprite.x*3.2,y+sprite.y*3.2,sprite.w*3.2,sprite.h*3.2);rc.fillText(c.name+' '+name,x-70,y+18);
 }
 fs.writeFileSync(path.join(out,'restored-roster.png'),roster.toBuffer('image/png'));console.log(JSON.stringify({...result,events:undefined}));
})().catch(error=>{console.error(error);process.exitCode=1;});
