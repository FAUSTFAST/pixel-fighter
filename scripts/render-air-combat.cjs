// Original-game replay: actual jump / attack key edges, fixed approved PNG art.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const cases=[
  {kind:'light',title:'空中轻拳',note:'快速点拳 · 短硬直 / 小推开'},
  {kind:'medium',title:'空中中拳',note:'掌击 · 长硬直 / 跳入衔接'},
  {kind:'heavy',title:'空中重拳',note:'抬臂蓄力重击 · 空对空打落'},
  {kind:'lightKick',title:'空中轻脚',note:'屈腿短踢 · 短推开 / 试探'},
  {kind:'mediumKick',title:'空中中脚',note:'横踢 · 长持续 / 跳入衔接'},
  {kind:'heavyKick',title:'空中重脚',note:'收身重蹬 · 空对空吹飞 / 击倒'},
];
const out=path.join(root,'output/air-combat/replay');fonts();
const reactions={air:'空中受击',knockdown:'打落倒地',launch:'吹飞',heavy:'重击',head:'头部受击',body:'腹部受击'};
(async()=>{
  const full=nativeHarness(91),games=cases.map((test,index)=>index?nativeHarness(91,false):full);
  await full.s.DrawnAnimation.loading;
  for(const h of games){
    for(let i=0;i<100&&!Object.values(h.s.STAGE_ART).every(a=>a.ready);i++)await new Promise(resolve=>setTimeout(resolve,25));
    assert.ok(Object.values(h.s.STAGE_ART).every(a=>a.ready));
  }
  const events=[];
  for(const [index,h] of games.entries()){
    h.s.DrawnAnimation=full.s.DrawnAnimation;h.s.Settings={values:{shake:false}};
    const g=h.fight(1,.85,95);g.pve=false;g.training=false;g.stage=h.s.STAGES[0];g.cameraX=0;
    g.f1.x=360;g.f2.x=455;g.f1.hp=g.f1.maxHp=g.f2.hp=g.f2.maxHp=100;
    const take=g.f2.takeHit.bind(g.f2);
    g.f2.takeHit=(hit,...args)=>{const r=take(hit,...args);events.push({kind:cases[index].kind,frame:g.f1.stateT,damage:r.dmg,vy:g.f2.vy,reaction:g.f2.reaction});return r;};
  }
  fs.mkdirSync(path.join(out,'frames'),{recursive:true});
  const canvas=createCanvas(1440,810),ctx=canvas.getContext('2d');let frames=0;
  for(let frame=0;frame<120;frame++){
    for(const [index,h] of games.entries()){
      if(frame===4){h.key('w');h.key('ArrowUp');}
      if(frame===5){h.key('w',false);h.key('ArrowUp',false);}
      const key=h.s.Input.MAP.p1[cases[index].kind];
      if(frame===18)h.key(key);
      if(frame===19)h.key(key,false);
      h.tick();
      if(frame===18)assert.equal(h.g.f1.attack?.airNormal,true,'keyboard triggers independent air normal');
    }
    if(frame%2)continue;
    ctx.fillStyle='#101b2a';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font='bold 24px "Fight CJK"';ctx.fillStyle='#f6d8a0';ctx.fillText('空中拳脚 · 六套独立动作 / 真实接触 / 原画回放',18,30);
    ctx.font='16px "Fight CJK"';ctx.fillStyle='#bbcde0';ctx.fillText('真实键盘：双方起跳 → P1 出拳 / 脚 · 空对空受击 · 60 Hz 模拟 / 半速播放 · F'+frame,18,55);
    for(const [index,h] of games.entries()){
      const test=cases[index],x=index%3*480,y=88+Math.floor(index/3)*355;
      ctx.fillStyle='#ffd166';ctx.font='bold 20px "Fight CJK"';ctx.fillText(test.title,x+12,y);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(h.canvas,0,0,960,540,x,y+12,480,270);
      ctx.font='16px "Fight CJK"';ctx.fillStyle='#bbcde0';ctx.fillText(test.note,x+12,y+306);
      const b=h.g.f2;ctx.fillStyle=b.hp<100?'#82edb0':'#d6e5f0';ctx.fillText('对手 HP '+b.hp+' / 100 · '+(reactions[b.reaction]||'未受击'),x+12,y+330);
    }
    fs.writeFileSync(path.join(out,'frames',String(frames++).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
    if(frame===30)fs.writeFileSync(path.join(out,'preview.png'),canvas.toBuffer('image/png'));
  }
  assert.equal(events.length,6,'each demonstrated normal connects once');
  assert.ok(events.find(e=>e.kind==='heavy').vy>0,'heavy punch slams down');
  assert.ok(events.find(e=>e.kind==='heavyKick').vy<0,'heavy kick blows up and away');
  const result={passed:true,originalGameReplay:true,gameFrames:720,replayFrames:frames,halfSpeed:true,events};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
