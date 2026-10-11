// Native production replay: identical keyboard movement, slower fixed PNG gait.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const baselineCommit='a23cec4709b0e54130b5124e5eb3f400dda99caa';
const sources={fighter:execFileSync('git',['show',baselineCommit+':js/fighter.js'],{cwd:root}).toString()};
const out=path.join(root,'output/walk-rate/replay');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const runs=[nativeHarness(91,true,sources),nativeHarness(91,false)];await runs[0].s.DrawnAnimation.loading;
 const art=runs[0].s.DrawnAnimation;assert.equal(art.status,'ready');runs[1].s.DrawnAnimation=art;
 for(const h of runs){const g=h.fight();g.pve=false;g.training=true;h.s.Settings={values:{shake:false}};
  g.f1=new h.s.Fighter(h.s.CHARACTERS[0],300,1,'P1');g.f2=new h.s.Fighter(h.s.CHARACTERS[1],660,-1,'P2');g.f1.foe=g.f2;g.f2.foe=g.f1;
 }
 const schedule=[[12,52,['d','ArrowLeft']],[76,126,['a','ArrowRight']],[154,164,['d','ArrowLeft']],[185,196,['a','ArrowRight']],[220,370,['a','ArrowRight']]];
 const canvas=createCanvas(960,820),ctx=canvas.getContext('2d');let count=0;const observations=[];
 for(let frame=0;frame<390;frame++){
  for(const h of runs){for(const [start,end,keys] of schedule)for(const key of keys){if(frame===start)h.key(key);if(frame===end)h.key(key,false);}h.tick();}
  for(const name of ['f1','f2']){assert.equal(runs[0].g[name].x,runs[1].g[name].x);assert.equal(runs[1].g[name].facing,name==='f1'?1:-1);}
  for(const [row,h] of runs.entries())for(const side of [0,1]){const f=side?h.g.f2:h.g.f1,sel=art.selection(f.def,f.sampleAnimation().animation);observations.push({frame,row,side,x:f.x,facing:f.facing,clip:sel.clip,index:sel.index});}
  if(frame%3)continue;
  ctx.fillStyle='#101b2a';ctx.fillRect(0,0,960,820);ctx.fillStyle='#f6d8a0';ctx.font='bold 22px "Fight CJK"';ctx.fillText('移动动画 0.75 倍 · 移动速度保持原值',16,30);
  ctx.fillStyle='#b9ccdf';ctx.font='14px "Fight CJK"';ctx.fillText('原版游戏 / 原始像素帧 · 60 Hz 模拟 · 正常速度回放 · 前进、后退、启停、边缘 · F'+frame,16,55);
  for(const [row,h] of runs.entries()){
   const top=80+row*360;ctx.fillStyle=row?'#8fe2b5':'#b6cee7';ctx.font='bold 18px "Fight CJK"';ctx.fillText(row?'调整后：步法 / 收步动画 0.75 倍':'调整前：步法 / 收步动画 1 倍',16,top);
   for(const side of [0,1]){const x=side*480,f=side?h.g.f2:h.g.f1,sel=art.selection(f.def,f.sampleAnimation().animation);ctx.drawImage(h.canvas,x,185,480,290,x,top+14,480,290);
    ctx.fillStyle='#d3e1ee';ctx.font='14px "Fight CJK"';ctx.fillText(f.def.name+' · '+({idle:'待机',walk:'前进',backwalk:'后退'}[sel.clip])+' · 动画格 '+sel.index+' · x='+f.x.toFixed(1),x+14,top+327);
   }
  }
  fs.writeFileSync(path.join(out,'frames',String(count++).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 // Both characters moving apart share a camera-relative edge; their absolute
 // x values depend on individual speeds. The real constraint is the 740 gap.
 assert.ok(Math.abs(runs[1].g.f2.x-runs[1].g.f1.x-740)<1e-7);assert.ok(!runs[1].g.f1.gaitMoving&&!runs[1].g.f2.gaitMoving);
 const result={passed:true,baselineCommit,gameFrames:390,replayFrames:count,animationRate:.75,movementRate:1,worldPositionsIdentical:true,rightFacing:-1,boundaries:[runs[1].g.f1.x,runs[1].g.f2.x]};
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'observations.json'),JSON.stringify(observations));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
