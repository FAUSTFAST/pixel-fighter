// Three simultaneous, real keyboard attacks with production combat and sprites.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const {harness}=require('./gameplay-harness.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/startup');
fs.mkdirSync(path.join(out,'frames'),{recursive:true});
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Startup CJK');
GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','Courier New');
const pending=[];
class LocalImage extends Image{
  set src(value){pending.push(new Promise((resolve,reject)=>{
    const loaded=this.onload;this.onload=()=>{try{loaded?.();resolve();}catch(e){reject(e);}};
    this.onerror=reject;super.src=path.resolve(root,value.split('?')[0]);
  }));}
  get src(){return super.src;}
}
function replay(kind,key,label,art){
  const canvas=createCanvas(960,540),h=harness(71,{art,context:canvas.getContext('2d'),
    globals:{Image:LocalImage,setTimeout,fetch:async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'))})},
    document:{createElement:()=>createCanvas(1,1)}}),g=h.fight(0,.85,100);
  g.pve=false;g.f1.x=400;g.f2.x=500;for(const f of [g.f1,g.f2])f.hp=f.maxHp=f.def.hp;
  h.s.Settings={values:{shake:false}};
  const hits=[],take=g.f2.takeHit.bind(g.f2);
  g.f2.takeHit=(...args)=>{hits.push({stateT:g.f1.stateT,damage:args[0].dmg});return take(...args);};
  return {h,g,canvas,kind,key,label,hits};
}
(async()=>{
  const runs=[replay('light','f','轻拳',true),replay('medium','t','中拳',false),replay('heavy','g','重拳',false)];
  await runs[0].h.s.DrawnAnimation.loading;await Promise.all(pending);
  if(runs[0].h.s.DrawnAnimation.status!=='ready')throw new Error('Original sprite resources failed to load');
  for(const r of runs.slice(1))r.h.s.DrawnAnimation=runs[0].h.s.DrawnAnimation;
  const canvas=createCanvas(960,478),ctx=canvas.getContext('2d');
  for(let frame=0;frame<72;frame++){
    for(const r of runs){if(frame===10)r.h.key(r.key);if(frame===11)r.h.key(r.key,false);r.h.tick();}
    ctx.fillStyle='#0b1627';ctx.fillRect(0,0,960,478);ctx.textAlign='left';
    ctx.font='bold 24px "Startup CJK"';ctx.fillStyle='#f1d9a2';ctx.fillText('前摇与动画实测 · 轻 / 中 / 重拳同时输入',20,32);
    ctx.font='14px "Startup CJK"';ctx.fillStyle='#a9bed4';ctx.fillText(`F${frame} / 72 · 1/3 慢放 · 实战仍为 60 Hz，出手姿势与命中帧同步`,20,58);
    runs.forEach((r,i)=>{
      const x=i*320,f=r.g.f1,m=f.def.moves[r.kind],attack=f.attack,t=f.stateT;
      ctx.fillStyle=['#9be5b9','#91d2f5','#edc38d'][i];ctx.font='bold 19px "Startup CJK"';ctx.fillText(`${r.label} · 起手 ${m.startup}F`,x+18,91);
      ctx.font='14px "Startup CJK"';ctx.fillStyle='#9fb5cd';ctx.fillText(`约 ${Math.round(m.startup*1000/60)} ms · 原版角色姿势`,x+18,112);
      ctx.drawImage(r.canvas,250,150,400,320,x,124,320,256);
      const phase=attack?(t<attack.startup?`前摇 ${t} / ${attack.startup}F`:t<attack.startup+attack.active?'有效帧 · 已出手':'收招 · 暂不可再次出招'):
        frame<10?'等待同帧输入':'动作完成';
      ctx.font='bold 17px "Startup CJK"';ctx.fillStyle=attack&&t<attack.startup?'#edd19e':'#98e9b5';ctx.fillText(phase,x+18,407);
      ctx.font='14px "Startup CJK"';ctx.fillStyle='#bacbe0';ctx.fillText(r.hits.length?`首次命中：动作第 ${r.hits[0].stateT}F`:'尚无攻击命中判定',x+18,435);
      ctx.fillText(`对手受到伤害 ${r.g.f2.maxHp-r.g.f2.hp} HP`,x+18,459);
    });
    ctx.fillStyle='#53708c';ctx.fillRect(319,75,2,403);ctx.fillRect(639,75,2,403);
    fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
  }
  const result=runs.map(r=>({kind:r.kind,startup:r.g.f1.def.moves[r.kind].startup,hits:r.hits,damage:r.g.f2.maxHp-r.g.f2.hp}));
  for(const r of result)if(r.hits.length!==1||r.hits[0].stateT!==r.startup)throw new Error('Replay does not agree with startup data');
  fs.writeFileSync(path.join(out,'replay-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({output:out,frames:72,result},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
