// Render production Canvas assets and replay frames; requires @napi-rs/canvas.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const font='/System/Library/Fonts/STHeiti Medium.ttc';
if(fs.existsSync(font))for(const alias of ['Replay CJK','Courier New'])GlobalFonts.registerFromPath(font,alias);
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'output/jump-wave-test'));
fs.mkdirSync(path.join(out,'frames'),{recursive:true});
const pending=[],errors=[];
class LocalImage extends Image{
  set src(value){
    pending.push(new Promise((resolve,reject)=>{
      const loaded=this.onload,failed=this.onerror;
      this.onload=()=>{try{loaded?.();resolve();}catch(e){reject(e);}};
      this.onerror=e=>{failed?.(e);reject(e);};
      super.src=path.resolve(root,value.split('?')[0]);
    }).catch(e=>{errors.push(e.message);throw e;}));
  }
  get src(){return super.src;}
}
const s={console,Math,setTimeout,Image:LocalImage,
  document:{createElement(tag){if(tag!=='canvas')throw new Error(tag);return createCanvas(1,1);}},
  Audio2:{sfx:{jump(){}}},
  fetch:async file=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.resolve(root,file.split('?')[0]),'utf8'))}),
};
s.window=s;vm.createContext(s);
for(const file of ['utils','characters','styles','combat-rules','strike-art','strike-motion','combat-spacing','stages','arcade-animation','motion60','fighter','jump-wave-scenario'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),s,{filename:file+'.js'});
(async()=>{
  await s.DrawnAnimation.loading;await Promise.all(pending);
  if(s.DrawnAnimation.status!=='ready'||errors.length)throw new Error('Production art did not load: '+errors.join(', '));
  const runs=Object.fromEntries(['single','double'].map(m=>[m,s.JumpWaveScenario.simulate(m)]));
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(Object.fromEntries(Object.entries(s.JumpWaveScenario.cases).map(([k,c])=>[k,Object.fromEntries(['stand','single','double'].map(m=>[m,s.JumpWaveScenario.simulate(m,c.options).result]))])),null,2));
  const canvas=createCanvas(960,392),ctx=canvas.getContext('2d');
  for(let frame=0;frame<=150;frame+=2){
    ctx.fillStyle='#0c1727';ctx.fillRect(0,0,960,392);
    ctx.font='bold 24px "Replay CJK", sans-serif';ctx.fillStyle='#f3dfb4';ctx.textAlign='left';
    ctx.fillText('二段跳躲波测试 · 同一招式 / 同一首跳时机',20,34);
    ctx.font='14px "Replay CJK", sans-serif';ctx.fillStyle='#acbfd0';ctx.fillText(`铁拳 · 地裂震拳   |   F${frame} / 150   |   1/2 慢放   |   无无敌、无格挡`,20,60);
    ['single','double'].forEach((mode,i)=>{
      const r=runs[mode],snap=r.frames[frame],f=snap.defender,x=i*480;
      ctx.save();ctx.translate(x,76);ctx.scale(.5,.5);
      s.STAGES[0].draw(ctx,frame/60,0);f.draw(ctx);snap.attacker.draw(ctx);
      for(const p of snap.projectiles)p.draw(ctx);
      ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeStyle='#75e8df';const b=f.bodyBox;ctx.strokeRect(b.x,b.y,b.w,b.h);
      ctx.strokeStyle='#ffb57b';for(const p of snap.projectiles){const b=p.box;ctx.strokeRect(b.x,b.y,b.w,b.h);}ctx.setLineDash([]);
      ctx.fillStyle='#091523ed';ctx.fillRect(0,0,960,78);ctx.font='bold 26px "Replay CJK", sans-serif';ctx.textAlign='left';ctx.fillStyle=i?'#a0ebbc':'#e9c9ab';ctx.fillText(i?'二段跳':'单跳对照',24,32);
      ctx.font='21px "Replay CJK", sans-serif';ctx.fillStyle='#d6e4ec';ctx.fillText(`HP ${f.hp}/100 · 命中 ${snap.hits} 次`,24,63);
      ctx.fillStyle='#091523ed';ctx.fillRect(0,492,960,48);ctx.font='24px "Replay CJK", sans-serif';ctx.textAlign='center';
      ctx.fillStyle=snap.hits?'#f3a29a':snap.passed?'#a2ebbc':'#e8d8b8';
      ctx.fillText(snap.hits?'被波击中 · 扣血 19':snap.passed?'完整躲过 · 扣血 0':snap.events.at(-1)?.text||'准备',480,522);
      ctx.restore();
    });
    ctx.fillStyle='#60788a';ctx.fillRect(479,76,2,270);
    ctx.font='14px "Replay CJK", sans-serif';ctx.textAlign='left';ctx.fillStyle='#b0c5d6';
    ctx.fillText('F59 首跳 → F79 二段跳 → F110 波完整通过 → F121 落地',20,372);
    fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
  }
  console.log(JSON.stringify({frames:76,charactersReady:s.DrawnAnimation.charactersReady,results:Object.fromEntries(Object.entries(runs).map(([k,v])=>[k,v.result])),output:out}));
})().catch(e=>{console.error(e);process.exitCode=1;});
