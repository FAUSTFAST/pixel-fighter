// Production input, combat and authored sprites: front dash / corner backdash.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const {harness}=require('./gameplay-harness.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/dash');
fs.mkdirSync(path.join(out,'frames'),{recursive:true});
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Dash CJK');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Courier New');
const pending=[];
class LocalImage extends Image{
  set src(value){pending.push(new Promise((resolve,reject)=>{
    const loaded=this.onload;this.onload=()=>{try{loaded?.();resolve();}catch(e){reject(e);}};
    this.onerror=reject;super.src=path.resolve(root,value.split('?')[0]);
  }));}
  get src(){return super.src;}
}
function replay(back){
  const canvas=createCanvas(960,540),h=harness(71,{art:true,context:canvas.getContext('2d'),
    globals:{Image:LocalImage,setTimeout,fetch:async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'))})},
    document:{createElement:()=>createCanvas(1,1)}}),g=h.fight();
  g.pve=false;g.f1.x=back?-150:320;g.f2.x=back?-82:700;
  for(const f of [g.f1,g.f2])f.hp=f.maxHp=f.def.hp;
  h.s.Settings={values:{shake:false}};
  return {h,g,canvas,back,start:null,distance:0,dashes:0,immuneAt35:false};
}
(async()=>{
  const runs=[replay(false),replay(true)];
  await Promise.all(runs.map(r=>r.h.s.DrawnAnimation.loading));await Promise.all(pending);
  if(runs.some(r=>r.h.s.DrawnAnimation.status!=='ready'))throw new Error('Original sprites failed to load');
  const canvas=createCanvas(960,478),ctx=canvas.getContext('2d');
  for(let frame=0;frame<120;frame++){
    for(const r of runs){
      const {h,g}=r,key=r.back?'a':'d';
      if(frame===1)h.key(key);if(frame===3)h.key(key,false);
      if(frame===5){r.start=g.f1.x;h.key(key);if(r.back)h.key('o');}
      if(frame===6){h.key(key,false);h.key('o',false);}
      if(r.back){
        if(frame===60)h.key('a');if(frame===62)h.key('a',false);
        if(frame===64){h.key('a');h.key('j');}
        if(frame===65){h.key('a',false);h.key('j',false);}
      }
      const dash=g.f1.dash;h.tick();
      if(!dash&&g.f1.dash)r.dashes++;
      if(frame===35){r.immuneAt35=g.f1.hp===g.f1.maxHp&&!g.f1.grabbedBy;r.distance=g.f1.x-r.start;}
    }
    if(frame%2)continue;
    ctx.fillStyle='#0b1627';ctx.fillRect(0,0,960,478);ctx.textAlign='left';
    ctx.font='bold 24px "Dash CJK"';ctx.fillStyle='#f1d9a2';ctx.fillText('普通冲刺实测 · 游戏原版输入、判定与动画',20,32);
    ctx.font='14px "Dash CJK"';ctx.fillStyle='#a9bed4';ctx.fillText(`F${frame} / 120 · 1/2 慢放 · 前冲免费接近，后撤避投但仍受打击`,20,58);
    runs.forEach((r,i)=>{
      const x=i*480,f=r.g.f1;
      ctx.fillStyle=i?'#9be5b9':'#91d2f5';ctx.font='bold 18px "Dash CJK"';
      ctx.fillText(i?'墙角后撤步：先躲投，再测试轻拳':'普通前冲：D → 松开 → D',x+18,91);
      ctx.font='13px "Dash CJK"';ctx.fillStyle='#9fb5cd';
      ctx.fillText(i?'墙角不能后移，投技免疫仍然有效':'19F 动作 · 13F 位移 · 原创距离 136 px',x+18,112);
      ctx.drawImage(r.canvas,x,124,480,270);
      ctx.font='bold 18px "Dash CJK"';ctx.fillStyle=f.hp<f.maxHp?'#f0b6ae':'#98e9b5';
      const text=i?(f.hp<f.maxHp?'轻拳命中 · 后撤步被打断':frame>60?'第二次后撤 · 测试打击判定':frame>12?'对手投技落空 · 受到伤害 0':'后撤与对手投技同时开始'):
        f.dash?`前冲 ${f.stateT}F · 剩余 ${f.dash.frames-f.stateT}F`:
          frame>24?'前冲完成 · 位移 136 px':'等待双击方向';
      ctx.fillText(text,x+18,420);
      ctx.font='15px "Dash CJK"';ctx.fillStyle='#bacbe0';
      ctx.fillText(i?`累计受伤 ${f.maxHp-f.hp} HP · 普通冲刺不提供打击无敌`:'斗气消耗 0 · 收招后才能出招、跳跃或防御',x+18,448);
    });
    ctx.fillStyle='#53708c';ctx.fillRect(479,75,2,403);
    fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
  }
  const result=runs.map(r=>({kind:r.back?'back':'forward',distance:r.distance,dashes:r.dashes,hp:r.g.f1.hp,avoidedThrow:r.immuneAt35}));
  if(Math.abs(result[0].distance-136)>1e-7||result[0].dashes!==1||!result[1].avoidedThrow||result[1].dashes!==2||result[1].hp>=runs[1].g.f1.maxHp)throw new Error('Replay disagrees with dash rules');
  fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({output:out,frames:60,result},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
