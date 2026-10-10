// Same keyboard inputs in real production games before / after the contact fix.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const baseline=require('./fixtures/visible-strike-misses.json').baselineCommit;
const sources=Object.fromEntries(['game','combat-spacing','arcade-animation'].map(name=>[name,execFileSync('git',['show',baseline+':js/'+name+'.js'],{cwd:root,maxBuffer:8*1024*1024}).toString()]));
const cases=[{character:0,kind:'lightKick',distance:160,keys:['v'],label:'疾风 · 轻脚 · 距离 160'},{character:2,kind:'lowKick',distance:200,keys:['s','v'],label:'铁拳 · 下轻脚 · 距离 200'},{character:4,kind:'heavy',distance:160,keys:['g'],label:'苍月 · 重斩 · 距离 160'}];
const out=path.join(root,'output/contact-alignment/replay');fs.mkdirSync(path.join(out,'frames'),{recursive:true});fonts();
(async()=>{
 const old=nativeHarness(53,true,sources),fixed=nativeHarness(53);
 const games=[cases.map((test,i)=>i===0?old:nativeHarness(53,false,sources)),cases.map((test,i)=>i===0?fixed:nativeHarness(53,false))];
 // Create all games before yielding, so their real stage images decode while
 // the two complete character catalogs load (no fallback background in replay).
 await Promise.all([old.s.DrawnAnimation.loading,fixed.s.DrawnAnimation.loading]);
 const events=[];
 for(const [row,list] of games.entries())for(const [index,h] of list.entries()){
  const test=cases[index],g=h.fight(),s=h.s;g.pve=false;g.training=true;s.DrawnAnimation=row?fixed.s.DrawnAnimation:old.s.DrawnAnimation;
  s.DEBUG_HITBOX=true;s.Settings={values:{shake:false}};s.Input.MODES.p1='classic';
  g.f1=new s.Fighter(s.CHARACTERS[test.character],400,1,'P1');g.f2=new s.Fighter(s.CHARACTERS[(test.character+1)%6],400+test.distance,-1,'P2');g.f1.foe=g.f2;g.f2.foe=g.f1;
  g.f1.maxHp=g.f1.hp=g.f2.maxHp=g.f2.hp=100;s.Input.clear();
  const hit=g.f2.takeHit.bind(g.f2);g.f2.takeHit=(box,...args)=>{const result=hit(box,...args);events.push({fixed:!!row,character:g.f1.def.id,kind:g.f1.attackKind,frame:g.f1.stateT,reaction:g.f2.reaction,...result});return result;};
 }
 const canvas=createCanvas(1080,760),ctx=canvas.getContext('2d');
 for(let frame=0;frame<90;frame++){
  for(const [row,list] of games.entries())for(const [index,h] of list.entries()){
   if(frame===8)for(const key of cases[index].keys)h.key(key);
   if(frame===9)for(const key of cases[index].keys)if(key!=='s')h.key(key,false);
   if(frame===50)h.key('s',false);
   h.tick();if(frame===8)assert.equal(h.g.f1.attackKind,cases[index].kind,'real keyboard must trigger the intended strike');
  }
  ctx.fillStyle='#101b2a';ctx.fillRect(0,0,1080,760);ctx.font='bold 22px "Fight CJK"';ctx.fillStyle='#f6d8a0';ctx.fillText('攻击接触漏判修复 · 相同输入 / 距离 · 原版游戏对照',16,28);
  ctx.font='14px "Fight CJK"';ctx.fillStyle='#bbd1e5';ctx.fillText('60 Hz 模拟 · 半速回放 · 红框：有效攻击范围 · 绿框：身体推挤范围 · F'+frame,16,52);
  for(const [row,list] of games.entries()){
   const y=75+row*340;ctx.font='bold 18px "Fight CJK"';ctx.fillStyle=row?'#82edb0':'#ffb49e';ctx.fillText(row?'修复后：真实接触触发受击 / 扣血':'修复前：碰到伸出的四肢，未触发受击',14,y);
   for(const [index,h] of list.entries()){
    const x=index*360;ctx.fillStyle='#d6e5f0';ctx.font='14px "Fight CJK"';ctx.fillText(cases[index].label,x+10,y+23);
    ctx.drawImage(h.canvas,250,135,480,360,x,y+30,360,270);
    const b=h.g.f2;ctx.fillStyle=row&&b.hp<100?'#82edb0':'#d6e5f0';ctx.fillText('对手 HP '+b.hp+'/100 · '+(b.hp<100?'已受击':'未受击'),x+12,y+322);
   }
  }
  fs.writeFileSync(path.join(out,'frames',String(frame).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 }
 for(let i=0;i<3;i++){assert.equal(games[0][i].g.f2.hp,100);assert.ok(games[1][i].g.f2.hp<100);}
 assert.equal(events.length,3);assert.ok(events.every(e=>e.fixed&&e.reaction));
 const result={passed:true,baselineCommit:baseline,gameFrames:540,videoFrames:90,cases,events};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;});
