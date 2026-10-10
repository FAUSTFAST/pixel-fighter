// Render the actual production game loop, original sprites and HUD to PNG frames.
// NODE_PATH=<bundled node_modules> node scripts/render-combo-balance.cjs
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const {harness}=require('./gameplay-harness.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/combo-balance');
fs.mkdirSync(path.join(out,'frames'),{recursive:true});
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Combo CJK');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Courier New');
const pending=[];
class LocalImage extends Image{
  set src(value){
    pending.push(new Promise((resolve,reject)=>{
      const loaded=this.onload;this.onload=()=>{try{loaded?.();resolve();}catch(e){reject(e);}};
      this.onerror=reject;super.src=path.resolve(root,value.split('?')[0]);
    }));
  }
  get src(){return super.src;}
}
function replay(good){
  const canvas=createCanvas(960,540),context=canvas.getContext('2d');
  const h=harness(41,{art:true,context,globals:{Image:LocalImage,setTimeout,
    fetch:async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'))})},
    document:{createElement:()=>createCanvas(1,1)}}),g=h.fight(2,.85,100),s=h.s;
  Object.assign(g,{pve:false,training:false});s.Settings={values:{shake:false}};
  g.f1.x=400;g.f2.x=500;g.f1.maxHp=g.f1.hp=g.f1.def.hp;g.f2.maxHp=g.f2.hp=g.f2.def.hp;
  const hits=[];let frame=0;
  const take=g.f2.takeHit.bind(g.f2);
  g.f2.takeHit=(hit,dir,blocked)=>{
    const res=take(hit,dir,blocked);
    if(!res.ignored)hits.push({frame,kind:hit.kind,damage:res.dmg,blocked:res.blocked,scale:g.f2.lastDamageScale,combo:g.f2.comboHits});
    return res;
  };
  s.CombatControls.collect=(f,it)=>it;
  s.CombatControls.read=who=>{
    const it={move:0,up:false,down:false,block:false};
    if(who==='p2')return {...it,block:hits.length>0};
    const f=g.f1;
    if(f.attackId===0)it.command=good?'medium':'light';
    else if(f.attackId===1&&f.attackContact&&(!good||f.stateT-f.contactFrame>=2))it.command='heavy';
    else if(good&&f.attackId===2&&f.attackContact&&f.stateT-f.contactFrame>=2)it.command='tech';
    return it;
  };
  return {h,g,s,canvas,hits,tick(){h.tick();frame++;}};
}
(async()=>{
  const runs=[replay(false),replay(true)];
  await Promise.all(runs.map(r=>r.s.DrawnAnimation.loading));await Promise.all(pending);
  if(runs.some(r=>r.s.DrawnAnimation.status!=='ready'))throw new Error('Original sprites failed to load');
  const canvas=createCanvas(960,478),ctx=canvas.getContext('2d');
  for(let frame=0;frame<150;frame++){
    runs.forEach(r=>r.tick());if(frame%2)continue;
    ctx.fillStyle='#0b1627';ctx.fillRect(0,0,960,478);ctx.textAlign='left';
    ctx.font='bold 24px "Combo CJK"';ctx.fillStyle='#f1d9a2';ctx.fillText('连招衔接实测 · 游戏原版判定与动画',20,32);
    ctx.font='14px "Combo CJK"';ctx.fillStyle='#a9bed4';ctx.fillText(`F${frame} / 150 · 1/2 慢放 · 对手从第一次受击后持续按后防御`,20,58);
    runs.forEach((r,i)=>{
      const x=i*480,f=r.g.f2,hit=r.hits.at(-1),blocked=r.hits.some(h=>h.blocked);
      ctx.fillStyle=i?'#9be5b9':'#f0b6ae';ctx.font='bold 18px "Combo CJK"';
      ctx.fillText(i?'接得上：中拳 → 重拳 → 螺旋掌':'接不上：轻拳 → 重拳',x+18,91);
      ctx.font='13px "Combo CJK"';ctx.fillStyle='#9fb5cd';
      ctx.fillText(i?'指定目标连段接快速必杀':'非指定取消，等收招后出重拳留有空隙',x+18,112);
      ctx.drawImage(r.canvas,x,124,480,270);
      ctx.fillStyle=i?'#98e9b5':'#f3b6aa';ctx.font='bold 18px "Combo CJK"';
      const text=i?(f.comboHits?`${f.comboHits} 连击 · 累计 ${f.comboDamage} 伤害`:'等待首招命中'):
        blocked?'重拳被防住 · 连段已中断':f.comboHits?'轻拳命中 · 重拳尚未连接':'等待首招命中';
      ctx.fillText(text,x+18,420);
      ctx.font='15px "Combo CJK"';ctx.fillStyle='#bacbe0';
      ctx.fillText(i?`修正：100% → 90% → 70%（三掌共用 70%）`:'对手恢复行动后正常格挡 · 后续扣血 0',x+18,448);
      if(hit&&!hit.blocked){ctx.font='12px "Combo CJK"';ctx.fillStyle='#95afc8';ctx.fillText(`最近命中 ${hit.damage} HP / 修正 ${Math.round(hit.scale*100)}%`,x+18,470);}
    });
    ctx.fillStyle='#53708c';ctx.fillRect(479,75,2,403);
    fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
  }
  const result=runs.map((r,i)=>({mode:i?'trueCombo':'brokenCombo',hits:r.hits,hp:r.g.f2.hp}));
  fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));
  const good=result[1].hits,bad=result[0].hits;
  if(good.length!==5||good.some(h=>h.blocked)||good.at(-1).combo!==5||bad.length!==2||!bad[1].blocked)throw new Error('Replay did not match the tested combo behavior');
  console.log(JSON.stringify({output:out,frames:75,result},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
