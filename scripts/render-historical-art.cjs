// Actual production game loop + native original PNGs, driven by keyboard events.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const out=path.join(root,'output/art-restoration/replay');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const runs=[nativeHarness(91),nativeHarness(91,false)];await runs[0].s.DrawnAnimation.loading;
 const art=runs[0].s.DrawnAnimation;assert.equal(art.status,'ready');runs[1].s.DrawnAnimation=art;
 for(const [i,h] of runs.entries()){
  h.fight(0,.85,420);h.g.pve=false;h.g.training=true;h.s.Settings={values:{shake:false}};
  h.g.f1.x=i?100:200;h.g.f2.x=i?700:620;h.fighter=i?h.g.f2:h.g.f1;h.previousFacing=h.fighter.facing;h.plant=null;
 }
 const schedules=[[[20,48,'d'],[74,102,'a'],[128,134,'d'],[154,160,'a']],[[20,48,'ArrowLeft'],[74,102,'ArrowRight'],[128,134,'ArrowLeft'],[154,320,'ArrowRight']]];
 const canvas=createCanvas(1120,460),ctx=canvas.getContext('2d');let worst=0,measured=0;
 const observations=[];
 for(let frame=0;frame<320;frame++){
  for(const [i,h] of runs.entries()){
   for(const [start,end,key] of schedules[i]){if(frame===start)h.key(key);if(frame===end)h.key(key,false);}
   h.tick();const f=h.fighter,a=f.sampleAnimation().animation,selected=art.selection(f.def,a);
   if(i===1&&f.x===840)h.key('ArrowRight',false);
   assert.equal(f.facing,h.previousFacing,'backwalk mirrored the fighter');
   assert.ok(['idle','walk','backwalk'].includes(selected.clip),'unexpected move while walking');
   // Independently measure actual sole pixels after world / camera constraints.
   if(f.gaitMoving&&selected.meta.support){
    const support=selected.meta.support,p=selected.sprite.canvas.getContext('2d').getImageData(0,0,selected.sprite.canvas.width,selected.sprite.canvas.height),xs=[];
    for(let x=support.left;x<=support.right;x++)if(p.data[(support.row*p.width+x)*4+3]>96)xs.push(selected.sprite.x+(x+.5)/2);
    assert.ok(xs.length);const foot=f.x+f.facing*4.2*xs.reduce((a,b)=>a+b,0)/xs.length;
    const key=selected.clip+':'+support.interval;
    if(h.plant&&h.plant.key===key&&selected.index>=h.plant.index){
     h.plant.low=Math.min(h.plant.low,foot);h.plant.high=Math.max(h.plant.high,foot);h.plant.index=selected.index;
     const drift=h.plant.high-h.plant.low;worst=Math.max(worst,drift);assert.ok(drift<4.3,'live sole drift '+drift);measured++;
    }else h.plant={key,index:selected.index,low:foot,high:foot};
   }else h.plant=null;
   observations.push({frame,side:i,clip:selected.clip,index:selected.index,x:f.x,facing:f.facing,gaitMoving:f.gaitMoving});
  }
  if(frame%2)continue;
  ctx.fillStyle='#101b2a';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f6d8a0';ctx.font='bold 23px "Fight CJK"';ctx.fillText('疾风 · B 版原始画风恢复 · 游戏实际运行回放',20,31);
  ctx.fillStyle='#a7bfd7';ctx.font='15px "Fight CJK"';ctx.fillText('60 Hz 游戏模拟 · 回放半速 · 原始固定像素帧 · 待机 / 前进 / 后退 / 启停 / 屏幕边缘',20,58);
  for(const [i,h] of runs.entries()){
   const x=i*560,f=h.fighter,sel=art.selection(f.def,f.sampleAnimation().animation),labels={idle:'待机',walk:'前进',backwalk:'后退'};
   ctx.fillStyle='#c4e5e5';ctx.font='bold 19px "Fight CJK"';ctx.fillText(i?'右侧疾风：后退始终面朝左':'左侧疾风：前进、后退和反复启停',x+20,88);
   ctx.drawImage(h.canvas,i?340:100,150,i?620:560,310,x,104,560,310);
   ctx.fillStyle='#d4e0ed';ctx.font='15px "Fight CJK"';ctx.fillText(`${labels[sel.clip]} · 朝向 ${f.facing>0?'→':'←'} · 游戏帧 ${frame} · x=${f.x.toFixed(1)}`,x+20,443);
  }
  fs.writeFileSync(path.join(out,'frames',String(frame/2).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 assert.equal(runs[1].fighter.x,840);assert.equal(runs[1].fighter.gaitMoving,false);
 const result={passed:true,gameFrames:320,replayFrames:160,source:'production game, original PNGs, keyboard events',rightFacing:runs[1].fighter.facing,rightBoundary:runs[1].fighter.x,measuredLiveSoleSamples:measured,maxLiveSoleDrift:+worst.toFixed(3)};
 fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(observations));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
