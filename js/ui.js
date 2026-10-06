// ============================================================
// ui.js — 所有界面绘制:标题、模式选择、角色选择、地图选择、对战HUD、结算。
// 提供角色预览小人绘制(用与战斗相同的渲染器,idle 姿态)。
// ============================================================
(function () {
  const W = 960, H = 540;

  // 在指定位置画一个角色 idle 预览
  function drawPreview(ctx, def, x, y, scale, phase, state) {
    const pose = computePose(state || 'idle', 0, phase || 0, false);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawHumanoid(ctx, def.palette, pose, def.deco, state || 'idle', phase*0.1 || 0);
    ctx.restore();
  }

  const UI = {
    // ---------- 标题 ----------
    title(ctx, t) {
      STAGES[0].draw(ctx,t);
      const shade=ctx.createLinearGradient(0,0,0,H);
      shade.addColorStop(0,'#07122570');shade.addColorStop(.48,'#0a122740');shade.addColorStop(1,'#050916ed');
      ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
      drawPreview(ctx, CHARACTERS[0], 200, 510, 2.5, t*3, 'idle');
      ctx.save();ctx.translate(375,0);ctx.scale(-1,1);
      drawPreview(ctx, CHARACTERS[2], 0, 510, 2.5, t*3+1, 'idle');ctx.restore();
    },

    // ---------- 模式选择 ----------
    mode(ctx, t, sel) {
      bg(ctx);
      U.textOutline(ctx,'选择模式', W/2, 120, 44, '#f9deb1', '#322438');
      const modes = [
        {k:'pvp', name:'双人对战', desc:'P1 vs P2 · 同键盘'},
        {k:'pve', name:'挑战电脑', desc:'P1 vs AI'},
      ];
      modes.forEach((m,i)=>{
        const y = 220 + i*110, on = sel===i;
        panel(ctx, W/2-220, y, 440, 88, on);
        U.text(ctx, m.name, W/2, y+40, 30, on?'#ffd166':'#ccd', 'center');
        U.text(ctx, m.desc, W/2, y+68, 16, '#8899aa', 'center','normal');
      });
      hintBar(ctx,'W/S 或 ↑/↓ 选择 · Enter 确认 · Esc 返回');
    },

    // ---------- 难度选择 ----------
    difficulty(ctx, t, sel) {
      bg(ctx);
      U.textOutline(ctx,'选择难度', W/2, 120, 44, '#ffd166', '#7a2a00');
      const ds=[{n:'简单',d:'AI 反应慢'},{n:'普通',d:'均衡挑战'},{n:'困难',d:'AI 凶狠'}];
      ds.forEach((m,i)=>{const y=210+i*90,on=sel===i;
        panel(ctx,W/2-200,y,400,72,on);
        U.text(ctx,m.n,W/2-40,y+45,28,on?'#ffd166':'#ccd','center');
        U.text(ctx,m.d,W/2+90,y+45,16,'#8899aa','center','normal');});
      hintBar(ctx,'选择难度 · Enter 确认 · Esc 返回');
    },

    // ---------- 角色选择 ----------
    // sel: {p1:index, p2:index}, ready:{p1,p2}, pve:bool, phase
    charSelect(ctx, t, sel, ready, pve) {
      bg(ctx);
      U.textOutline(ctx,'选择角色', W/2, 70, 40, '#ffd166', '#7a2a00');

      // 6格网格
      const cols=3, cellW=150, cellH=120, gx=(W-cols*cellW)/2, gy=110;
      CHARACTERS.forEach((c,i)=>{
        const cx=gx+(i%cols)*cellW, cy=gy+Math.floor(i/cols)*cellH;
        const p1on=sel.p1===i, p2on=sel.p2===i;
        ctx.fillStyle = '#161622'; U.rr(ctx,cx+6,cy+6,cellW-12,cellH-12,8);
        // 选中框
        if(p1on){ctx.strokeStyle='#5ad2ff';ctx.lineWidth=4;ctx.strokeRect(cx+5,cy+5,cellW-10,cellH-10);}
        if(p2on){ctx.strokeStyle='#ff5a8a';ctx.lineWidth=4;ctx.strokeRect(cx+9,cy+9,cellW-18,cellH-18);}
        // 预览
        drawPreview(ctx, c, cx+cellW/2, cy+cellH-28, 1.7, t*2+i, 'idle');
        U.text(ctx, c.name, cx+cellW/2, cy+cellH-8, 15, '#ccd', 'center');
      });

      // 双方信息栏
      infoCard(ctx, 40, gy, CHARACTERS[sel.p1], '#5ad2ff', 'P1', ready.p1);
      infoCard(ctx, W-40-190, gy, CHARACTERS[sel.p2], '#ff5a8a', pve?'AI':'P2', ready.p2);

      hintBar(ctx, pve ? 'A/D 选人 · F 确认 · F2 切换经典 / 现代' : 'P1 A/D + F · P2 ←/→ + J · F2 切换操作模式');
    },

    // ---------- 地图选择 ----------
    stageSelect(ctx, t, sel) {
      bg(ctx);
      U.textOutline(ctx,'选择地图', W/2, 70, 40, '#ffd166', '#7a2a00');
      const cols=3, cw=290, ch=128, gx=(W-cols*cw)/2, gy=95;
      STAGES.forEach((s,i)=>{
        const cx=gx+(i%cols)*cw, cy=gy+Math.floor(i/cols)*ch;
        const on=sel===i;
        // 缩略图:把 stage 缩绘到小框
        ctx.save();
        ctx.beginPath(); ctx.rect(cx+10,cy+10,cw-30,ch-30); ctx.clip();
        ctx.translate(cx+10,cy+10); ctx.scale((cw-30)/960,(ch-30)/540);
        s.draw(ctx, t);
        ctx.restore();
        ctx.strokeStyle=on?'#ffd166':'#333'; ctx.lineWidth=on?5:2;
        ctx.strokeRect(cx+10,cy+10,cw-30,ch-30);
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(cx+10,cy+ch-40,cw-30,30);
        U.text(ctx,s.name,cx+cw/2-10,cy+ch-18,18,on?'#ffd166':'#ccd','center');
      });
      hintBar(ctx,'方向键选择 · Enter 开战 · Esc 返回');
    },

    // ---------- 对战 HUD ----------
    hud(ctx, f1, f2, round, roundTime) {
      const training=!Number.isFinite(roundTime);
      ctx.fillStyle='#0b1525dc';U.rr(ctx,18,12,408,94,5);U.rr(ctx,534,12,408,94,5);
      ctx.fillStyle='#88cde5';ctx.fillRect(18,12,3,94);ctx.fillStyle='#eea0b9';ctx.fillRect(939,12,3,94);
      U.text(ctx,'P1 '+(Input.MODES?.p1==='modern'?'M':'C'),32,32,9,'#88cde5','left');U.text(ctx,f1.name,72,33,17,'#eff4fa','left');
      U.text(ctx,(window.GAME?.pve?'CPU':'P2 '+(Input.MODES?.p2==='modern'?'M':'C')),928,32,9,'#eea0b9','right');U.text(ctx,f2.name,888,33,17,'#eff4fa','right');
      healthBar(ctx,32,44,378,f1,false);healthBar(ctx,550,44,378,f2,true);
      U.text(ctx,Math.ceil(f1.hp)+' / '+f1.maxHp,410,32,11,'#c8d5e4','right');
      U.text(ctx,Math.ceil(f2.hp)+' / '+f2.maxHp,550,32,11,'#c8d5e4','left');
      driveBar(ctx,32,73,280,f1,false);driveBar(ctx,648,73,280,f2,true);
      meterBar(ctx,32,94,280,f1,false);meterBar(ctx,648,94,280,f2,true);
      U.text(ctx,'SA '+Math.floor(f1.meter/100)+' / 3',410,97,11,'#8fd1e7','right');
      U.text(ctx,'SA '+Math.floor(f2.meter/100)+' / 3',550,97,11,'#8fd1e7','left');
      ctx.fillStyle='#101a2cec';U.rr(ctx,438,12,84,94,5);
      U.text(ctx,training?'TRAINING':'ROUND '+round,480,31,9,'#a5b9ce','center');
      U.textOutline(ctx,training?'∞':Math.ceil(roundTime).toString(),480, 70,36,'#ffe0a2','#111725');
      U.text(ctx,f1.burnout?'斗气耗尽':f1.drive.toFixed(1)+' DRIVE',410,80,9,f1.burnout?'#df9475':'#83e6b1','right');
      U.text(ctx,f2.burnout?'斗气耗尽':f2.drive.toFixed(1)+' DRIVE',550,80,9,f2.burnout?'#df9475':'#83e6b1','left');
      if(!training){
        for(let i=0;i<2;i++){
          ctx.fillStyle=f1.wins>i?'#88cde5':'#36445a';ctx.fillRect(449+i*12,87,7,5);
          ctx.fillStyle=f2.wins>i?'#eea0b9':'#36445a';ctx.fillRect(492+i*12,87,7,5);
        }
      }else{
        U.text(ctx,'无限时间',480,94,10,'#b6c5d8','center');
        if(f1.trainingInvincible)U.text(ctx,'无敌',324,97,10,'#edc781','left');
        if(f2.trainingInvincible)U.text(ctx,'无敌',636,97,10,'#edc781','right');
      }
    },

    roundBanner(ctx, text, sub, t) {
      const s = Math.min(1, t*3);
      ctx.save();
      ctx.globalAlpha = t>1.2 ? Math.max(0,1-(t-1.2)*2) : 1;
      const sc = 0.6 + s*0.4;
      ctx.translate(W/2,H/2-30); ctx.scale(sc,sc);
      U.textOutline(ctx,text,0,0,72,'#ffd166','#7a2a00');
      if(sub) U.textOutline(ctx,sub,0,50,30,'#fff','#000');
      ctx.restore();
    },

    // ---------- 结算 ----------
    result(ctx, t, winnerName, def, backToLabel) {
      const g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#2a1a0a');g.addColorStop(1,'#0a0a14');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      U.textOutline(ctx,'K.O.', W/2, 140, 90, '#ff3a3a','#000');
      U.textOutline(ctx, winnerName+' 获胜!', W/2, 220, 44, '#ffd166','#7a2a00');
      // 胜者摆 pose
      drawPreview(ctx, def, W/2, 440, 3.4, t*3, 'idle');
      const blink=Math.sin(t*4)>-0.3;
      if(blink) U.text(ctx,'Enter 再战 · Esc 回标题', W/2, 500, 22, '#fff','center');
    },
  };

  // ---- 小组件 ----
  function bg(ctx){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#121020');g.addColorStop(1,'#0a0a14');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
  function panel(ctx,x,y,w,h,on){ctx.fillStyle=on?'#2a2440':'#161622';U.rr(ctx,x,y,w,h,10);
    if(on){ctx.strokeStyle='#ffd166';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);}}
  function hintBar(ctx,txt){ctx.fillStyle='#000a';ctx.fillRect(0,H-34,W,34);
    U.text(ctx,txt,W/2,H-12,15,'#8899aa','center','normal');}

  function infoCard(ctx,x,y,def,color,tag,ready){
    ctx.fillStyle='#141420';U.rr(ctx,x,y,190,300,10);
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(x,y,190,300);
    ctx.fillStyle=color;U.rr(ctx,x,y,190,30,10);
    U.text(ctx,tag,x+12,y+22,18,'#0a0a14','left');
    U.text(ctx,ready?'✔ 已确认':'选择中…',x+180,y+22,14,'#0a0a14','right','normal');
    drawPreview(ctx,def,x+95,y+150,2.3,performance.now()/300,'idle');
    U.text(ctx,def.name,x+95,y+185,24,'#fff','center');
    U.text(ctx,def.title,x+95,y+206,13,'#99aabb','center','normal');
    // 属性条
    stat(ctx,x+18,y+228,'力',def.moves.heavy.dmg/16,color);
    stat(ctx,x+18,y+248,'速',def.walk/3.4,color);
    stat(ctx,x+18,y+268,'血',def.hp/128,color);
  }
  function stat(ctx,x,y,label,v,color){
    U.text(ctx,label,x,y+10,13,'#99aabb','left','normal');
    ctx.fillStyle='#333';U.rr(ctx,x+22,y,120,10,4);
    ctx.fillStyle=color;U.rr(ctx,x+22,y,120*U.clamp(v,0.1,1),10,4);
  }

  function healthBar(ctx,x,y,w,f,flip){
    const pct=f.hp/f.maxHp;
    ctx.fillStyle='#000';U.rr(ctx,x-2,y-2,w+4,26,4);
    ctx.fillStyle='#4a1010';U.rr(ctx,x,y,w,22,3);
    // 缓冲(受伤残影)
    const bw=w*U.clamp(f._hpGhost??pct,0,1);
    ctx.fillStyle='#ffcc55';
    if(flip)U.rr(ctx,x+w-bw,y,bw,22,3);else U.rr(ctx,x,y,bw,22,3);
    const hw=w*pct;
    const grd=pct>0.3?'#eac376':'#df6573';
    ctx.fillStyle=grd;
    if(flip)U.rr(ctx,x+w-hw,y,hw,22,3);else U.rr(ctx,x,y,hw,22,3);
  }
  function driveBar(ctx,x,y,w,f,flip){
    const cell=(w-10)/6;
    for(let i=0;i<6;i++){
      const xx=flip?x+w-cell-i*(cell+2):x+i*(cell+2);
      ctx.fillStyle='#273746';ctx.fillRect(xx,y,cell,5);
      ctx.fillStyle=f.burnout?'#c58560':'#73dfac';ctx.fillRect(xx,y,cell*U.clamp(f.drive-i,0,1),5);
    }
  }
  function meterBar(ctx,x,y,w,f,flip){
    const pct=U.clamp(f.meter/f.maxMeter,0,1);
    ctx.fillStyle='#081322';ctx.fillRect(x,y,w,8);ctx.fillStyle='#8cbbe8';
    ctx.fillRect(flip?x+w-w*pct:x,y,w*pct,8);
    ctx.fillStyle='#101c2f';for(let i=1;i<3;i++)ctx.fillRect(x+w*i/3-1,y,2,8);
    if(f.meter>=100)U.text(ctx,'SA'+Math.min(3,Math.floor(f.meter/100))+' 就绪',flip?x+w:x,y-3,9,'#bfd7ff',flip?'right':'left');
  }

  // ---------- 暂停/出招表覆盖层 ----------
  UI.pauseOverlay = function(ctx, f1, f2, pve) {
    ctx.save();ctx.fillStyle='rgba(3,7,18,.94)';ctx.fillRect(0,0,W,H);
    U.textOutline(ctx,'暂停 · 角色出招表',W/2,42,26,'#ffd166','#182032');
    const labelKey=k=>({' ':'空格',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[k]||k.toUpperCase());
    ['p1','p2'].forEach((who,i)=>U.text(ctx,CombatControls.describe(who),28+i*470,68,10,'#bdcce0','left','normal'));
    [f1,f2].forEach((f,index)=>{
      const x=28+index*470;
      ctx.fillStyle='#142033';U.rr(ctx,x,85,444,360,8);
      U.text(ctx,(index===0?'P1':pve?'AI':'P2')+' · '+f.name+'  '+(f.def.style||''),x+14,112,17,f.def.fxColor||'#fff','left');
      ['special','uppercut','rush','tech','skill','super1','super2','super','driveRush'].forEach((key,i)=>{
        const m=f.def.moves[key];if(!m)return;
        const y=136+i*34;
        U.text(ctx,m.name||key,x+14,y,13,'#f3d6a1','left');
        const binding=Input.MAP[index===0?'p1':'p2'];
        const command={lightKick:'轻脚 '+labelKey(binding.lightKick),heavyKick:'重脚 '+labelKey(binding.heavyKick),throw:labelKey(binding.light)+'+'+labelKey(binding.lightKick)+' / '+labelKey(binding.throw)}[key]||(m.command||'').replace('H或L',binding.special.toUpperCase());
        U.text(ctx,command,x+170,y,12,'#e3ecf7','left','normal');
        // 出招表短注解，详细攻略放在页内弹窗。
        const note=(m.detail||'').split('；')[0];
        U.text(ctx,note.slice(0,33),x+14,y+15,10,'#9db0c8','left','normal');
      });
    });
    U.text(ctx,'↓+脚打下段，需蹲防；↓+重脚扫腿击倒。后+投后摔；被抓7帧内按投拆投，指令投不可拆。',W/2,470,12,'#c8d3e0','center','normal');
    U.text(ctx,'必杀免费 · OD 2 格斗气 · SA 100 / 200 / 300 · P 继续 / Esc 回首页',W/2,495,14,'#ffd166','center');
    U.text(ctx,'F2 切换经典 / 现代 · 完整连段路线见「出招表」',W/2,520,12,'#91a5c0','center','normal');
    ctx.restore();
  };

  function pauseChar(ctx,x,y,f,tag,color){
    ctx.fillStyle='rgba(255,255,255,0.04)'; U.rr(ctx,x,y,160,145,10);
    ctx.strokeStyle=color; ctx.lineWidth=2; ctx.strokeRect(x,y,160,145);
    U.text(ctx,tag,x+10,y+22,15,color,'left');
    UI.drawPreview(ctx,f.def,x+80,y+78,1.55,performance.now()/250,'idle');
    U.text(ctx,f.name,x+80,y+103,21,'#fff','center');
    U.text(ctx,f.def.moves.special.projName || (f.def.moves.special.projectile?'飞行必杀':'突进必杀'),x+80,y+126,13,'#ffd166','center','normal');
  }

  UI.drawPreview = drawPreview;
  window.UI = UI;
})();
