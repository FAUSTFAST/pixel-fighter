// ============================================================
// game.js — 主控制器:状态机(标题→模式→难度→选人→选图→对战→结算)、
// 主循环、输入映射、碰撞结算、回合流程、特效。
// ============================================================
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540;
  ctx.imageSmoothingEnabled = false;

  const SCENE = { TITLE:'title', MODE:'mode', DIFF:'diff', CHAR:'char', STAGE:'stage', FIGHT:'fight', RESULT:'result' };

  const G = {
    scene: SCENE.TITLE,
    t: 0,                    // 全局时间(秒)
    pve: false,
    difficulty: 0.85,
    modeSel: 0, diffSel: 1,
    charSel: { p1: 0, p2: 2 },
    charReady: { p1: false, p2: false },
    stageSel: 0,
    stage: null,
    f1: null, f2: null,
    ai: null,
    projectiles: [],
    effects: [],           // 命中特效
    round: 1,
    roundTime: 99,
    roundState: 'intro',   // intro / fight / ko / done
    roundTimer: 0,
    bannerT: 0, bannerText:'', bannerSub:'',
    winner: null,
    shake: 0,
    hitstop: 0,            // 命中定格帧
    paused: false,
    combo: { P1: { count:0, timer:0 }, P2: { count:0, timer:0 } },
  };

  // ---------- 场景切换辅助 ----------
  function go(scene){ G.scene = scene; }

  // ---------- 对战初始化 ----------
  function startFight() {
    const d1 = CHARACTERS[G.charSel.p1];
    const d2 = CHARACTERS[G.charSel.p2];
    G.f1 = new Fighter(d1, 300, 1, 'P1');
    G.f2 = new Fighter(d2, 660, -1, 'P2');
    G.f1._hpGhost = 1; G.f2._hpGhost = 1;
    G.ai = G.pve ? new AI(G.f2, G.difficulty) : null;
    G.stage = STAGES[G.stageSel];
    G.projectiles = []; G.effects = [];
    G.paused = false;
    G.round = 1; G.f1.wins = 0; G.f2.wins = 0;
    Audio2.music.play(STAGES[G.stageSel].id);   // 按地图播放背景音乐
    startRound();
    go(SCENE.FIGHT);
  }

  function startRound() {
    const s = STAGES[G.stageSel];
    // 位置/血量重置
    resetFighter(G.f1, 300, 1);
    resetFighter(G.f2, 660, -1);
    G.projectiles = []; G.effects = [];
    G.combo.P1 = { count:0, timer:0 };
    G.combo.P2 = { count:0, timer:0 };
    G.roundTime = 99;
    G.roundState = 'intro';
    G.roundTimer = 0;
    G.bannerT = 0; G.bannerText = '第 ' + G.round + ' 回合'; G.bannerSub = 'FIGHT!';
    Audio2.sfx.roundStart();
  }
  function resetFighter(f, x, facing){
    f.x=x; f.y=FIGHT_GROUND; f.vx=0; f.vy=0; f.facing=facing;
    f.hp=f.maxHp; f.meter=Math.min(f.meter,30); f.state='idle'; f.stateT=0;
    f.hitstun=0; f.blockstun=0; f.attack=null; f.onGround=true; f.koFall=0;
    f._hpGhost=1; f.flashT=0;
  }

  // ---------- 采集玩家 intent ----------
  function readIntent(mapKey) {
    const m = Input.MAP[mapKey];
    const it = { move:0, up:false, down:false, light:false, heavy:false, special:false, block:false };
    if (Input.isDown(m.left)) it.move -= 1;
    if (Input.isDown(m.right)) it.move += 1;
    it.up = Input.justPressed(m.up);
    it.down = Input.isDown(m.down);
    it.light = Input.justPressed(m.light);
    it.heavy = Input.justPressed(m.heavy);
    it.special = Input.justPressed(m.special);
    return it;
  }

  // 把"朝向后方的移动"转为格挡意图
  function applyBlock(f, it) {
    // 若正后退(远离对手)且没有攻击输入 -> 视为格挡姿态
    const away = -f.facing;
    if (it.move === away && !it.light && !it.heavy && !it.special && !it.up && f.onGround) {
      it.block = true;
    }
    return it;
  }

  // ---------- 命中特效 ----------
  function spawnHit(x, y, big, blocked) {
    G.effects.push({ x, y, t: 0, life: big?16:12, big, blocked });
  }

  // ---------- 战斗更新 ----------
  function updateFight(dt) {
    // 命中定格
    if (G.hitstop > 0) { G.hitstop--; return; }

    const f1 = G.f1, f2 = G.f2;

    // 朝向:始终面向对手(非攻击/受击时)
    faceEachOther(f1, f2);

    // banner / round 状态
    if (G.roundState === 'intro') {
      G.bannerT += dt;
      if (G.bannerT > 1.6) { G.roundState = 'fight'; Audio2.sfx.fight(); }
      // intro 期间也画,但不接受操作
      return;
    }
    if (G.roundState === 'done') {
      G.bannerT += dt;
      if (G.bannerT > 2.2) {
        // 进入下一回合或结算
        const need = 2;
        if (f1.wins >= need || f2.wins >= need) {
          G.winner = f1.wins > f2.wins ? f1 : f2;
          go(SCENE.RESULT); G.t = 0;
          Audio2.music.stop(); Audio2.sfx.win();
        } else {
          G.round++; startRound();
        }
      }
      // 让角色物理继续跑一点(倒地)
      f1.update(G); f2.update(G);
      updateProjectiles();
      updateGhost(f1); updateGhost(f2);
      return;
    }

    // 计时
    G.roundTime -= dt;
    if (G.roundTime <= 0) { G.roundTime = 0; endRoundByTime(); return; }

    // 输入
    if (G.roundState === 'fight') {
      const p1s = f1.state, p2s = f2.state;
      // 记录方向缓冲用于搓招识别
      Input.recordMotion('p1');
      if (!G.pve) Input.recordMotion('p2');

      let i1 = applyBlock(f1, readIntent('p1'));
      // 搓招:↓↘→ + 轻/重拳 触发必杀(无气则弱化版)
      if ((i1.light || i1.heavy) && f1.canAct() && Input.checkQCF('p1', f1.facing)) {
        if (f1.startAttack('special', { motion: true })) { i1.light = i1.heavy = false; }
      }
      f1.handleIntent(i1, G);

      if (G.pve) {
        const ai = G.ai.think(f2, f1, G);
        applyBlock(f2, ai);
        f2.handleIntent(ai, G);
      } else {
        let i2 = applyBlock(f2, readIntent('p2'));
        if ((i2.light || i2.heavy) && f2.canAct() && Input.checkQCF('p2', f2.facing)) {
          if (f2.startAttack('special', { motion: true })) { i2.light = i2.heavy = false; }
        }
        f2.handleIntent(i2, G);
      }
      emitActionSound(f1, p1s);
      emitActionSound(f2, p2s);
    }

    f1.update(G); f2.update(G);
    updateProjectiles();

    // 身体互推(防重叠)
    resolveBodies(f1, f2);

    // 近战命中结算
    resolveMelee(f1, f2);
    resolveMelee(f2, f1);

    // 飞行道具命中
    resolveProjectiles();

    // 受伤残影追赶
    updateGhost(f1); updateGhost(f2);
    updateCombos();

    // KO 判定
    if ((f1.hp<=0 || f2.hp<=0) && G.roundState==='fight') {
      G.roundState = 'done'; G.bannerT = 0; G.hitstop = 8; G.shake = 12;
      Audio2.sfx.ko();
      if (f1.hp<=0 && f2.hp<=0) { G.bannerText='双双倒下'; G.bannerSub='DOUBLE K.O.'; f1.wins++; f2.wins++; }
      else if (f2.hp<=0) { G.bannerText=f1.name+' 胜'; G.bannerSub='K.O.'; f1.wins++; }
      else { G.bannerText=f2.name+' 胜'; G.bannerSub='K.O.'; f2.wins++; }
    }

    if (G.shake > 0) G.shake *= 0.85;
  }

  function faceEachOther(a, b) {
    const lock = (f) => ['light','heavy','special','hit','ko'].includes(f.state);
    if (!lock(a)) a.facing = a.x <= b.x ? 1 : -1;
    if (!lock(b)) b.facing = b.x <= a.x ? 1 : -1;
  }

  // 检测本帧新进入的动作,播放对应起手音(挥空/跳跃/必杀)
  function emitActionSound(f, prevState) {
    if (f.state === prevState) return;
    if (f.state === 'jump') { Audio2.sfx.jump(); return; }
    if (f.state === 'special') {
      if (f.def.moves.special.projectile) Audio2.sfx.fireball();
      else Audio2.sfx.special();
      return;
    }
    if (f.state === 'light' || f.state === 'heavy') { Audio2.sfx.whiff(); return; }
  }

  function resolveBodies(a, b) {
    const ab = a.bodyBox, bb = b.bodyBox;
    if (U.overlap(ab, bb) && a.state!=='ko' && b.state!=='ko') {
      const overlap = (ab.x+ab.w/2 < bb.x+bb.w/2)
        ? (ab.x+ab.w) - bb.x
        : -( (bb.x+bb.w) - ab.x );
      const push = overlap/2;
      a.x -= push*0.5; b.x += push*0.5;
    }
  }

  function resolveMelee(attacker, defender) {
    if (attacker.attackHasHit && !attacker.attack?.projectile) {
      // 已命中过则跳过(单段攻击)
    }
    const hb = attacker.getHitBox();
    if (!hb) return;
    if (attacker.attackHasHit) return;
    const db = defender.bodyBox;
    if (!U.overlap(hb, db)) return;
    if (defender.state==='ko') return;

    attacker.attackHasHit = true;
    const fromDir = attacker.facing;
    const blocked = defender.blocking && defender.facing === -fromDir && defender.onGround;
    const res = defender.takeHit(hb, fromDir, blocked);

    // 特效 + 定格 + 震屏 + 攒气
    const hx = hb.x + hb.w/2, hy = hb.y + hb.h/2;
    spawnHit(hx, hy, hb.type!=='light', res.blocked);
    registerCombatText(attacker, hx, hy, res.dmg, res.blocked, attacker.attackKind === 'special' && attacker._specialWeak);
    if (!res.blocked) {
      attacker.meter = Math.min(attacker.maxMeter, attacker.meter + (attacker.attack.meterGain||6));
      G.hitstop = hb.type==='special'?10:(hb.type==='heavy'?6:3);
      G.shake = hb.type==='special'?14:(hb.type==='heavy'?8:4);
      if (hb.type==='special') Audio2.sfx.hitSpecial();
      else if (hb.type==='heavy') Audio2.sfx.hitHeavy();
      else Audio2.sfx.hitLight();
    } else {
      G.hitstop = 3; G.shake = 3;
      Audio2.sfx.block();
    }
  }

  function updateProjectiles() {
    for (const p of G.projectiles) p.update();
    G.projectiles = G.projectiles.filter(p=>!p.dead);
  }
  function resolveProjectiles() {
    for (const p of G.projectiles) {
      if (p.dead) continue;
      const target = p.owner === G.f1 ? G.f2 : G.f1;
      if (target.state==='ko') continue;
      if (U.overlap(p.box, target.bodyBox)) {
        const dir = p.dir;
        const blocked = target.blocking && target.facing === -dir && target.onGround;
        const res = target.takeHit({dmg:p.dmg,kb:p.kb,hitstun:p.hitstun,type:'special'}, dir, blocked);
        spawnHit(p.x, p.y, true, res.blocked);
        registerCombatText(p.owner, p.x, p.y, res.dmg, res.blocked, p.weak);
        G.hitstop = 6; G.shake = 10;
        if (res.blocked) Audio2.sfx.block(); else Audio2.sfx.hitSpecial();
        p.dead = true;
      }
      // 飞行道具对撞消解
      for (const q of G.projectiles) {
        if (q!==p && !q.dead && q.owner!==p.owner && U.overlap(p.box,q.box)) {
          p.dead=true; q.dead=true; spawnHit((p.x+q.x)/2,(p.y+q.y)/2,true,true);
          Audio2.sfx.block();
        }
      }
    }
    G.projectiles = G.projectiles.filter(p=>!p.dead);
  }

  function updateGhost(f){
    const pct = f.hp/f.maxHp;
    if (f._hpGhost===undefined) f._hpGhost=pct;
    if (f._hpGhost>pct) f._hpGhost = Math.max(pct, f._hpGhost - 0.012);
    else f._hpGhost = pct;
  }

  function updateCombos(){
    for (const k of ['P1','P2']) {
      const c = G.combo[k];
      if (c.timer > 0) c.timer--;
      else c.count = 0;
    }
  }

  function registerCombatText(attacker, x, y, dmg, blocked, weak) {
    if (blocked) {
      G.effects.push({ kind:'text', x, y, vx:0, vy:-1.2, t:0, life:42, text:'BLOCK', color:'#7ad0ff', size:22 });
      return;
    }
    const c = G.combo[attacker.label] || G.combo.P1;
    c.count += 1;
    c.timer = 90;
    G.effects.push({ kind:'text', x, y, vx:0.2*attacker.facing, vy:-1.5, t:0, life:46, text:`-${dmg}`, color:'#ffd166', size:22 });
    if (c.count >= 2) {
      G.effects.push({ kind:'text', x: attacker.x, y: attacker.y-100, vx:0, vy:-0.4, t:0, life:70, text:`${c.count} HIT`, color:'#ff5a8a', size:32 });
    }
    if (weak) {
      G.effects.push({ kind:'text', x, y:y+24, vx:0, vy:-0.9, t:0, life:52, text:'WEAK SPECIAL', color:'#b7ff5a', size:16 });
    }
  }

  function endRoundByTime() {
    const f1=G.f1,f2=G.f2;
    G.roundState='done'; G.bannerT=0;
    if (f1.hp>f2.hp){G.bannerText=f1.name+' 胜';f1.wins++;}
    else if (f2.hp>f1.hp){G.bannerText=f2.name+' 胜';f2.wins++;}
    else {G.bannerText='平局';f1.wins++;f2.wins++;}
    G.bannerSub='TIME UP';
  }

  // ---------- 绘制战斗 ----------
  function drawFight() {
    ctx.save();
    if (G.shake>0.5){ctx.translate(U.rand(-G.shake,G.shake),U.rand(-G.shake,G.shake));}
    G.stage.draw(ctx, G.t);

    // 角色(后于地面)
    const order = G.f1.x <= G.f2.x ? [G.f1,G.f2] : [G.f2,G.f1];
    order.forEach(f=>f.draw(ctx));

    // 飞行道具
    G.projectiles.forEach(p=>p.draw(ctx));

    // 命中特效
    drawEffects();

    ctx.restore();

    // HUD(不随震屏)
    UI.hud(ctx, G.f1, G.f2, G.round, G.roundTime);

    // banner
    if (G.roundState==='intro') UI.roundBanner(ctx, G.bannerText, G.roundTimer>0.5?G.bannerSub:'', G.bannerT);
    if (G.roundState==='done') UI.roundBanner(ctx, G.bannerText, G.bannerSub, G.bannerT);

    // 调试:命中盒(默认关闭)
    if (window.DEBUG_HITBOX) drawHitboxes();
  }

  function drawEffects() {
    for (const e of G.effects) {
      if (e.kind === 'text') {
        const p = e.t/e.life;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1-p);
        const y = e.y + e.vy * e.t;
        const x = e.x + (e.vx||0) * e.t;
        U.textOutline(ctx, e.text, x, y, e.size || 20, e.color || '#fff', '#000');
        ctx.restore();
        continue;
      }
      const p = e.t/e.life;
      ctx.save();
      ctx.globalAlpha = 1-p;
      if (e.blocked) {
        ctx.strokeStyle='#7ad0ff'; ctx.lineWidth=3;
        for(let i=0;i<6;i++){const a=i/6*6.28; const r=6+p*18;
          ctx.beginPath();ctx.moveTo(e.x+Math.cos(a)*4,e.y+Math.sin(a)*4);
          ctx.lineTo(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);ctx.stroke();}
      } else {
        // 星爆
        const r=(e.big?26:16)*(0.4+p*1.2);
        ctx.fillStyle = e.big?'#fff2a0':'#ffffff';
        ctx.beginPath();
        for(let i=0;i<10;i++){const a=i/10*6.28; const rr=i%2?r:r*0.45;
          ctx.lineTo(e.x+Math.cos(a)*rr, e.y+Math.sin(a)*rr);}
        ctx.closePath();ctx.fill();
        ctx.fillStyle=e.big?'#ff8a2a':'#ffcc44';
        ctx.beginPath();ctx.arc(e.x,e.y,r*0.4,0,7);ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawHitboxes(){
    [G.f1,G.f2].forEach(f=>{
      ctx.strokeStyle='#0f0';ctx.strokeRect(f.bodyBox.x,f.bodyBox.y,f.bodyBox.w,f.bodyBox.h);
      const hb=f.getHitBox(); if(hb){ctx.strokeStyle='#f00';ctx.strokeRect(hb.x,hb.y,hb.w,hb.h);}
    });
  }

  function updateEffects(){
    for(const e of G.effects) e.t++;
    G.effects = G.effects.filter(e=>e.t<e.life);
  }

  // ---------- 菜单输入 ----------
  function updateMenus() {
    const enter = Input.justPressed('Enter');
    const esc = Input.justPressed('Escape');
    // 菜单方向键先只 peek,不要提前消费;否则角色选择界面拿不到 A/D/方向键
    const up = Input.peekPressed('w')||Input.peekPressed('ArrowUp');
    const down = Input.peekPressed('s')||Input.peekPressed('ArrowDown');
    const left = Input.peekPressed('a')||Input.peekPressed('ArrowLeft');
    const right = Input.peekPressed('d')||Input.peekPressed('ArrowRight');
    // 确认键(选人界面用 F/J)
    const confirmKey = Input.peekPressed('f')||Input.peekPressed('j');
    // 通用菜单音
    if (up||down||left||right||confirmKey) Audio2.sfx.menuMove();
    if (enter) Audio2.sfx.menuSelect();
    if (esc) Audio2.sfx.menuBack();

    switch(G.scene){
      case SCENE.TITLE:
        if (enter) go(SCENE.MODE);
        break;
      case SCENE.MODE:
        if (up) G.modeSel=(G.modeSel+1)%2;
        if (down) G.modeSel=(G.modeSel+1)%2;
        if (esc) go(SCENE.TITLE);
        if (enter){ G.pve = G.modeSel===1; go(G.pve?SCENE.DIFF:SCENE.CHAR); resetCharSelect(); }
        break;
      case SCENE.DIFF:
        if (up) G.diffSel=(G.diffSel+2)%3;
        if (down) G.diffSel=(G.diffSel+1)%3;
        if (esc) go(SCENE.MODE);
        if (enter){ G.difficulty=[0.6,0.85,1.0][G.diffSel]; resetCharSelect(); go(SCENE.CHAR); }
        break;
      case SCENE.CHAR:
        updateCharSelect(enter, esc);
        break;
      case SCENE.STAGE:
        if (left) G.stageSel=(G.stageSel+STAGES.length-1)%STAGES.length;
        if (right) G.stageSel=(G.stageSel+1)%STAGES.length;
        if (up) G.stageSel=(G.stageSel+STAGES.length-2)%STAGES.length;
        if (down) G.stageSel=(G.stageSel+2)%STAGES.length;
        if (esc){ resetCharSelect(); go(SCENE.CHAR); }
        if (enter) startFight();
        break;
      case SCENE.RESULT:
        if (enter){ startFight(); }   // 用同角色同图再战
        if (esc){ go(SCENE.TITLE); }
        break;
    }
  }

  function resetCharSelect(){ G.charReady={p1:false,p2:false}; }

  function updateCharSelect(enter, esc){
    // P1 用 A/D + F 确认
    if (!G.charReady.p1){
      if (Input.justPressed('a')) G.charSel.p1=(G.charSel.p1+CHARACTERS.length-1)%CHARACTERS.length;
      if (Input.justPressed('d')) G.charSel.p1=(G.charSel.p1+1)%CHARACTERS.length;
      if (Input.justPressed('w')) G.charSel.p1=(G.charSel.p1+CHARACTERS.length-3)%CHARACTERS.length;
      if (Input.justPressed('s')) G.charSel.p1=(G.charSel.p1+3)%CHARACTERS.length;
      if (Input.justPressed('f')) G.charReady.p1=true;
    } else if (Input.justPressed('f')) { /* 已确认,不动 */ }

    if (G.pve){
      // AI 随机/或固定 p2,自动 ready
      G.charReady.p2 = true;
    } else if (!G.charReady.p2){
      if (Input.justPressed('ArrowLeft')) G.charSel.p2=(G.charSel.p2+CHARACTERS.length-1)%CHARACTERS.length;
      if (Input.justPressed('ArrowRight')) G.charSel.p2=(G.charSel.p2+1)%CHARACTERS.length;
      if (Input.justPressed('ArrowUp')) G.charSel.p2=(G.charSel.p2+CHARACTERS.length-3)%CHARACTERS.length;
      if (Input.justPressed('ArrowDown')) G.charSel.p2=(G.charSel.p2+3)%CHARACTERS.length;
      if (Input.justPressed('j')) G.charReady.p2=true;
    }

    if (esc){
      if (G.charReady.p2 && !G.pve) G.charReady.p2=false;
      else if (G.charReady.p1) G.charReady.p1=false;
      else go(G.pve?SCENE.DIFF:SCENE.MODE);
      return;
    }

    // PVE 下 Enter 直接开始;双方 ready 后进入选图
    const bothReady = G.charReady.p1 && G.charReady.p2;
    if (bothReady && (enter || true)) {
      // 需要一个确认动作进入选图;这里在双方 ready 后自动进选图
      go(SCENE.STAGE);
    }
    if (G.pve && enter && !G.charReady.p1){ G.charReady.p1=true; }
  }

  // ---------- 主循环 ----------
  let last = performance.now();
  function loop(now) {
    let dt = (now - last)/1000; last = now;
    dt = Math.min(dt, 1/30);       // 防止卡顿跳变
    G.t += dt;

    // 全局音频开关:M 切换音乐,N 切换音效
    if (Input.justPressed('m')) { const on = Audio2.toggleMusic(); if (on && G.scene!==SCENE.FIGHT) Audio2.music.play('menu'); }
    if (Input.justPressed('n')) Audio2.toggleSfx();

    // 非战斗场景播放菜单音乐
    if (G.scene !== SCENE.FIGHT && G.scene !== SCENE.RESULT) {
      if (Audio2.isMusicOn()) Audio2.music.play('menu');
    }

    if (G.scene === SCENE.FIGHT) {
      if (Input.justPressed('p')) { G.paused = !G.paused; Audio2.sfx.menuSelect(); }
      if (G.paused && Input.justPressed('Escape')) { G.paused = false; Audio2.music.play('menu'); go(SCENE.TITLE); }
      // 以固定步长推进战斗(60fps 逻辑);暂停时只重画当前画面
      if (!G.paused) {
        updateFight(1/60);
        updateEffects();
      }
      drawFight();
      if (G.paused) UI.pauseOverlay(ctx, G.f1, G.f2, G.pve);
    } else {
      switch(G.scene){
        case SCENE.TITLE: UI.title(ctx, G.t); break;
        case SCENE.MODE: UI.mode(ctx, G.t, G.modeSel); break;
        case SCENE.DIFF: UI.difficulty(ctx, G.t, G.diffSel); break;
        case SCENE.CHAR: UI.charSelect(ctx, G.t, G.charSel, G.charReady, G.pve); break;
        case SCENE.STAGE: UI.stageSelect(ctx, G.t, G.stageSel); break;
        case SCENE.RESULT: UI.result(ctx, G.t, G.winner.name, G.winner.def); break;
      }
      updateMenus();
    }

    Input.endFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 调试开关
  window.GAME = G;
})();
