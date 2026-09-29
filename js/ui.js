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
      // 背景
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#1a0a2a'); g.addColorStop(1,'#0a0a14');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      // 动态光束
      ctx.save(); ctx.globalAlpha=0.15;
      for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#ff2a6a':'#2affd0';
        const a=t*0.3+i; ctx.fillRect(W/2, H/2, 3, 400);
        ctx.save();ctx.translate(W/2,H/2);ctx.rotate(a);ctx.fillRect(-1,-500,2,1000);ctx.restore();}
      ctx.restore();

      U.textOutline(ctx,'PIXEL FIGHTER', W/2, 180, 68, '#ffd166', '#7a2a00');
      U.textOutline(ctx,'像 素 格 斗', W/2, 240, 40, '#5ad2ff', '#0a2a4a');

      // 站两个预览小人对峙
      drawPreview(ctx, CHARACTERS[0], W/2-160, 400, 3.0, t*3, 'idle');
      ctx.save(); ctx.translate(W/2+160,0); ctx.scale(-1,1); // 镜像
      drawPreview(ctx, CHARACTERS[2], 0, 400, 3.0, t*3+1, 'idle'); ctx.restore();

      const blink = Math.sin(t*4)>-0.3;
      if(blink) U.textOutline(ctx,'按 Enter 开始', W/2, 480, 28, '#fff', '#000');
      U.text(ctx,'本地双人对战 · 电脑AI · 6 名角色 · 4 张地图', W/2, 520, 15, '#8899aa','center','normal');
    },

    // ---------- 模式选择 ----------
    mode(ctx, t, sel) {
      bg(ctx);
      U.textOutline(ctx,'选择模式', W/2, 120, 44, '#ffd166', '#7a2a00');
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

      hintBar(ctx, pve ? 'P1: A/D 选择 F 确认 · Enter 直接开始' : 'P1: A/D 选 F 确认 · P2: ←/→ 选 J 确认');
    },

    // ---------- 地图选择 ----------
    stageSelect(ctx, t, sel) {
      bg(ctx);
      U.textOutline(ctx,'选择地图', W/2, 70, 40, '#ffd166', '#7a2a00');
      const cols=2, cw=380, ch=180, gx=(W-cols*cw)/2, gy=120;
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
      // 血条
      healthBar(ctx, 30, 30, 380, f1, false);
      healthBar(ctx, W-30-380, 30, 380, f2, true);
      // 名字
      U.text(ctx, f1.name, 34, 24, 16, '#fff','left');
      U.text(ctx, f2.name, W-34, 24, 16, '#fff','right');
      // 能量槽
      meterBar(ctx, 30, 66, 300, f1, false);
      meterBar(ctx, W-30-300, 66, 300, f2, true);
      // 回合胜点(圆点)
      for(let i=0;i<2;i++){ctx.fillStyle=f1.wins>i?'#ffd166':'#333';
        ctx.beginPath();ctx.arc(420+i*18,36,6,0,7);ctx.fill();}
      for(let i=0;i<2;i++){ctx.fillStyle=f2.wins>i?'#ffd166':'#333';
        ctx.beginPath();ctx.arc(W-420-i*18,36,6,0,7);ctx.fill();}
      // 计时
      ctx.fillStyle='#000a'; U.rr(ctx,W/2-40,18,80,44,8);
      U.textOutline(ctx, Math.ceil(roundTime).toString(), W/2, 52, 32, '#fff','#000');
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
    const grd=pct>0.3?'#3adb5a':'#db3a3a';
    ctx.fillStyle=grd;
    if(flip)U.rr(ctx,x+w-hw,y,hw,22,3);else U.rr(ctx,x,y,hw,22,3);
  }
  function meterBar(ctx,x,y,w,f,flip){
    const pct=f.meter/f.maxMeter;
    ctx.fillStyle='#000';U.rr(ctx,x-1,y-1,w+2,12,3);
    ctx.fillStyle='#111a2a';U.rr(ctx,x,y,w,10,2);
    const mw=w*pct;
    ctx.fillStyle=pct>=0.5?'#5ad2ff':'#3a6a8a';
    if(flip)U.rr(ctx,x+w-mw,y,mw,10,2);else U.rr(ctx,x,y,mw,10,2);
    if(pct>=0.5){ctx.fillStyle='#fff';ctx.globalAlpha=0.5+0.5*Math.sin(performance.now()/150);
      const tx=flip?x+w-4:x; U.text(ctx,'必杀就绪',flip?x+w:x,y-2,10,'#5ad2ff',flip?'right':'left','bold');ctx.globalAlpha=1;}
  }

  // ---------- 暂停/出招表覆盖层 ----------
  UI.pauseOverlay = function(ctx, f1, f2, pve) {
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.74)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#141420'; U.rr(ctx,130,60,700,420,14);
    ctx.strokeStyle='#ffd166'; ctx.lineWidth=3; ctx.strokeRect(130,60,700,420);
    U.textOutline(ctx,'PAUSED / 暂停',W/2,110,36,'#ffd166','#7a2a00');

    // 上半区:双方角色与必杀
    pauseChar(ctx,180,135,f1,'P1','#5ad2ff');
    pauseChar(ctx,620,135,f2,pve?'AI':'P2','#ff5a8a');

    U.text(ctx,'基础操作 / COMMAND LIST',W/2,170,20,'#fff','center');
    const rows=[
      ['移动 / 跳跃 / 下蹲','方向键或 WASD'],
      ['轻拳 / 重拳','F/G 或 J/K'],
      ['直接必杀','H / L  半管气以上'],
      ['搓招必杀','↓ ↘ → + 拳  (面向左时镜像)'],
      ['格挡','向后按住方向键'],
      ['音乐 / 音效','M / N'],
    ];
    rows.forEach((r,i)=>{
      const y=215+i*28;
      U.text(ctx,r[0],310,y,15,'#99aabb','left','normal');
      U.text(ctx,r[1],500,y,15,'#ffd166','left','bold');
    });
    ctx.fillStyle='rgba(255,255,255,0.05)'; U.rr(ctx,235,390,490,42,8);
    U.text(ctx,'搓招无气也能放弱化必杀;有半管气则释放全力必杀。',W/2,416,15,'#ccd','center','normal');
    U.text(ctx,`音乐:${Audio2.isMusicOn()?'开':'关'}   音效:${Audio2.isSfxOn()?'开':'关'}`,W/2,455,15,'#5ad2ff','center','normal');
    U.text(ctx,'按 P 继续 · Esc 回标题',W/2,510,18,'#fff','center');
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
