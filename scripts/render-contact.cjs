const fs=require('node:fs'),path=require('node:path');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const out=path.join(root,'output/contact');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const runs=[nativeHarness(82),nativeHarness(82,false),nativeHarness(82,false)];await runs[0].s.DrawnAnimation.loading;
 if(runs[0].s.DrawnAnimation.status!=='ready')throw Error('Art loading failed');
 for(const h of runs.slice(1))h.s.DrawnAnimation=runs[0].s.DrawnAnimation;
 for(const [i,h] of runs.entries()){
  const g=h.fight(0,.85,[400,112,194][i]);g.pve=false;g.f1.x=340;g.f2.x=340+[400,112,194][i];h.s.Settings={values:{shake:false}};
  h.hits=[];const take=g.f2.takeHit.bind(g.f2);g.f2.takeHit=(...a)=>{h.hits.push({t:g.f1.stateT,frame:h.frame,box:g.f1.getHitBox(),root:g.f1.x});return take(...a);};
 }
 const canvas=createCanvas(1110,470),ctx=canvas.getContext('2d');
 for(let frame=0;frame<110;frame++){
  for(const [i,h] of runs.entries()){
   h.frame=frame;
   if(i===0){if(frame===6)h.key('d');if(frame===49)h.key('d',false);if(frame===59)h.key('a');if(frame===99)h.key('a',false);}
   else {if(frame===12)h.key(i===1?'g':'f');if(frame===13)h.key(i===1?'g':'f',false);}
   h.tick();
  }
  ctx.fillStyle='#0e192a';ctx.fillRect(0,0,1110,470);ctx.textAlign='left';ctx.fillStyle='#f5d8a0';ctx.font='bold 23px "Fight CJK"';ctx.fillText('步法、身体发力与画面接触 · 游戏实测',18,30);
  ctx.fillStyle='#a5bfd9';ctx.font='14px "Fight CJK"';ctx.fillText(`F${frame} · 1/2 慢放 · 实战仍以 60 Hz 运行`,18,57);
  for(const [i,h] of runs.entries()){
   const x=i*370,f=h.g.f1;ctx.fillStyle=['#93dbe8','#a4e4ba','#e8c491'][i];ctx.font='bold 19px "Fight CJK"';ctx.fillText(['前进 12 帧 / 后退 16 帧','重拳：转胯 → 送肩 → 接触','轻拳够不到：保持空挥'][i],x+14,89);
   ctx.drawImage(h.canvas,205,155,400,305,x,110,370,282);
   ctx.fillStyle='#c7d8e7';ctx.font='15px "Fight CJK"';
   ctx.fillText(i===0?`实际步法：${f.drawnFrame??1} / ${f.drawnFrameCount??4}`:`伤害：${Math.round(h.g.f2.maxHp-h.g.f2.hp)} HP · 命中 ${h.hits.length} 次`,x+14,421);
   ctx.fillText(i===0?'步频随移动距离，停止后收脚':`角色实际蹬步：${(f.x-340).toFixed(1)} px`,x+14,450);
  }
  ctx.fillStyle='#37536c';ctx.fillRect(369,72,2,398);ctx.fillRect(739,72,2,398);
  fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 const result=runs.map((h,i)=>({case:['walk','heavy-contact','jab-whiff'][i],hits:h.hits.map(v=>({t:v.t,frame:v.frame,root:v.root})),damage:h.g.f2.maxHp-h.g.f2.hp,displacement:h.g.f1.x-340}));
 if(result[1].hits.length!==1||result[2].hits.length!==0)throw Error('Unexpected visible contact result '+JSON.stringify(result));
 fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({frames:110,out,result}));
})().catch(e=>{console.error(e);process.exitCode=1;});
