const fs=require('node:fs'),path=require('node:path');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const out=path.join(root,'output/drawn-frames');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const runs=[nativeHarness(91),nativeHarness(91,false),nativeHarness(91,false),nativeHarness(91,false)];
 await runs[0].s.DrawnAnimation.loading;
 if(runs[0].s.DrawnAnimation.status!=='ready')throw Error('Art failed to load');
 for(const h of runs.slice(1))h.s.DrawnAnimation=runs[0].s.DrawnAnimation;
 for(const [i,h] of runs.entries()){
  const g=h.fight(i===1?2:i===3?1:0,.85,125);g.pve=false;g.training=true;h.s.Settings={values:{shake:false}};
  g.f1.x=i===0?340:i===1?250:390;g.f2.x=i===0?720:i===1?480:515;
  if(i===3){g.f1=new h.s.Fighter(h.s.CHARACTERS[1],390,1,'P1');g.f1.foe=g.f2;g.f2.foe=g.f1;}
  h.hits=[];h.preHitMovement=0;const take=g.f2.takeHit.bind(g.f2);
  g.f2.takeHit=(...a)=>{h.hits.push({frame:h.frame,kind:g.f1.attackKind});return take(...a);};
 }
 const canvas=createCanvas(1080,734),ctx=canvas.getContext('2d');
 const positions=[];
 for(let frame=0;frame<144;frame++){
  const [a,b,c,d]=runs;
  if(frame===6){a.key('d');b.key('ArrowRight');}
  if(frame===48)a.key('d',false);if(frame===66)a.key('a');
  if(frame===108){a.key('a',false);b.key('ArrowRight',false);}
  if(frame===16){c.key('g');d.key('b');}if(frame===17){c.key('g',false);d.key('b',false);}
  if(frame===85){c.key('t');d.key('v');}if(frame===86){c.key('t',false);d.key('v',false);}
  for(const h of runs){h.frame=frame;h.tick();}
  for(const h of [c,d])if(!h.hits.length)h.preHitMovement=Math.max(h.preHitMovement,Math.abs(h.g.f2.x-515));
  ctx.fillStyle='#111c2d';ctx.fillRect(0,0,1080,734);ctx.textAlign='left';ctx.font='bold 24px "Fight CJK"';ctx.fillStyle='#f5d8a0';
  ctx.fillText('固定像素新帧 · 原版游戏键盘实测',18,31);ctx.font='14px "Fight CJK"';ctx.fillStyle='#a7bfd7';ctx.fillText(`第 ${frame+1} / 144 帧 · 1/2 慢放 · 逐帧绘制 · 无网格变形 / 无 AI 补帧`,18,57);
  for(const [i,h] of runs.entries()){
   const x=i%2*540,y=72+Math.floor(i/2)*330,f=i===1?h.g.f2:h.g.f1;
   ctx.fillStyle=['#9be0c8','#acd9f3','#efcd96','#e9b4df'][i];ctx.font='bold 19px "Fight CJK"';
   ctx.fillText(['前进 / 后退 / 停步：脚落地、胯肩随动','右侧后退：后脚先退，面向保持稳定','重拳 / 中拳：蹬地 → 转胯送肩 → 回收','重踢 / 轻踢：提膝 → 伸腿 → 屈膝收脚'][i],x+12,y+24);
   ctx.drawImage(h.canvas,[250,335,260,260][i],172,490,280,x+4,y+36,532,272);
   ctx.font='14px "Fight CJK"';ctx.fillStyle='#c9d9e7';
   ctx.fillText(i<2?`朝向 ${f.facing>0?'→':'←'} · ${f.gaitMoving?'迈步':f.gaitSettling?'依次收脚':'站稳'}`:`实际命中 ${h.hits.length} 次 · 命中前对手位移 ${h.preHitMovement.toFixed(2)} px`,x+12,y+325);
  }
  positions.push(runs.map((h,i)=>({x:(i===1?h.g.f2:h.g.f1).x,phase:(i===1?h.g.f2:h.g.f1).stepPhase})));
  ctx.fillStyle='#3a526b';ctx.fillRect(539,72,2,659);
  fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 const result={frames:144,rightFacing:runs[1].g.f2.facing,attacks:runs.slice(2).map(h=>({preHitMovement:h.preHitMovement,hits:h.hits}))};
 if(result.rightFacing!==-1||result.attacks.some(a=>a.preHitMovement>1e-7||!a.hits.length))throw Error(JSON.stringify(result));
 fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
