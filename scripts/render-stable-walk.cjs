const fs=require('node:fs'),path=require('node:path');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const out=path.join(root,'output/stable-walk');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const runs=[nativeHarness(91),nativeHarness(91,false),nativeHarness(91,false)];await runs[0].s.DrawnAnimation.loading;
 if(runs[0].s.DrawnAnimation.status!=='ready')throw Error('Art failed to load');for(const h of runs.slice(1))h.s.DrawnAnimation=runs[0].s.DrawnAnimation;
 for(const [i,h] of runs.entries()){
  const g=h.fight(i===1?2:0,.85,i===2?68:380);g.pve=false;g.training=true;h.s.Settings={values:{shake:false}};
  g.f1.x=i===2?380:i===1?260:320;g.f2.x=i===2?448:i===1?560:700;h.hits=[];h.preHitMovement=0;
  const take=g.f2.takeHit.bind(g.f2);g.f2.takeHit=(...a)=>{h.hits.push({frame:h.frame,stateT:g.f1.stateT});return take(...a);};
 }
 const canvas=createCanvas(1110,474),ctx=canvas.getContext('2d');
 for(let frame=0;frame<108;frame++){
  const a=runs[0],b=runs[1],c=runs[2];
  if(frame===6){a.key('d');b.key('ArrowRight');}if(frame===38)a.key('d',false);if(frame===62)a.key('a');if(frame===90){a.key('a',false);b.key('ArrowRight',false);}
  if(frame===12)c.key('g');if(frame===13)c.key('g',false);
  for(const h of runs){h.frame=frame;h.tick();}if(!c.hits.length)c.preHitMovement=Math.max(c.preHitMovement,Math.abs(c.g.f2.x-448));
  ctx.fillStyle='#111c2d';ctx.fillRect(0,0,1110,474);ctx.textAlign='left';ctx.font='bold 24px "Fight CJK"';ctx.fillStyle='#f5d8a0';ctx.fillText('移动稳定性与攻击推挤修复 · 原版游戏实测',18,32);
  ctx.font='14px "Fight CJK"';ctx.fillStyle='#a7bfd7';ctx.fillText(`F${frame} / 108 · 1/2 慢放 · 同一待机原画生成步法`,18,60);
  for(const [i,h] of runs.entries()){
   const x=i*370,f=i===1?h.g.f2:h.g.f1;ctx.fillStyle=['#9be0c8','#acd9f3','#efcd96'][i];ctx.font='bold 19px "Fight CJK"';ctx.fillText(['前进 / 停止 / 后退：形象一致','右侧角色后退：始终面朝左','出招前不推人，命中后才后退'][i],x+12,91);
   const sx=[210,370,260][i];ctx.drawImage(h.canvas,sx,155,420,305,x,112,370,269);
   ctx.font='15px "Fight CJK"';ctx.fillStyle='#c9d9e7';
   if(i<2){ctx.fillText(`步法 ${f.drawnFrame??1} / ${f.drawnFrameCount??4} · 朝向 ${f.facing>0?'→':'←'}`,x+12,410);ctx.fillText(i===0?'头部、上身、胯部来自待机原画':'没有左右翻面或身体锚点跳动',x+12,445);}
   else{ctx.fillText(`命中前对手位移：${h.preHitMovement.toFixed(2)} px`,x+12,410);ctx.fillText(h.hits.length?`受击后正常后退 · 受到 ${h.g.f2.maxHp-h.g.f2.hp} HP 伤害`:'对手尚未受击 · 保持原位',x+12,445);}
  }
  ctx.fillStyle='#3a526b';ctx.fillRect(369,73,2,400);ctx.fillRect(739,73,2,400);
  fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 const result={frames:108,preHitMovement:runs[2].preHitMovement,hits:runs[2].hits,damage:runs[2].g.f2.maxHp-runs[2].g.f2.hp,rightFacing:runs[1].g.f2.facing};
 if(result.preHitMovement>1e-7||!result.hits.length||result.rightFacing!==-1)throw Error('Replay invariant failed '+JSON.stringify(result));
 fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
