// ============================================================
// game.js — 主控制器:状态机(标题→模式→难度→选人→选图→对战→结算)、
// 主循环、输入映射、碰撞结算、回合流程、特效。
// ============================================================
(function () {
  const ATTACK_STATES=window.ATTACK_STATES || ['light','heavy','special','uppercut','rush','tech','skill','super'];
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 540;
  ctx.imageSmoothingEnabled = false;

  const SCENE = { TITLE:'title', MODE:'mode', DIFF:'diff', CHAR:'char', STAGE:'stage', FIGHT:'fight', RESULT:'result' };

  const G = {
    scene: SCENE.TITLE,
    t: 0,                    // 全局时间(秒)
    pve: false,
    training:false,
    trainingOptions:{opponent:'dummy',p1:{hp:100,meter:300,drive:6,invincible:false},p2:{hp:128,meter:300,drive:6,invincible:false}},
    trainingResetT:0,
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
    cameraX: 0,
    hitstop: 0,            // 命中定格帧
    paused: false,
    combo: { P1: { count:0, timer:0 }, P2: { count:0, timer:0 } },
  };

  // ---------- 场景切换辅助 ----------
  function go(scene){ G.scene = scene; window.AppPanels?.sync(); }

  // ---------- 对战初始化 ----------
  function startFight() {
    const d1 = CHARACTERS[G.charSel.p1];
    const d2 = CHARACTERS[G.charSel.p2];
    G.f1 = new Fighter(d1, 300, 1, 'P1');
    G.f2 = new Fighter(d2, 660, -1, 'P2');G.f1.foe=G.f2;G.f2.foe=G.f1;
    G.f1._hpGhost = 1; G.f2._hpGhost = 1;
    G.ai = G.pve ? new AI(G.f2, G.difficulty) : null;
    G.stage = STAGES[G.stageSel];
    G.projectiles = []; G.effects = [];G.hitstop=0;G.shake=0;
    G.paused = false;
    G.round = 1; G.f1.wins = 0; G.f2.wins = 0;
    Audio2.music.play(STAGES[G.stageSel].id);   // 按地图播放背景音乐
    startRound();
    if(G.training){
      for(const [key,f] of [['p1',G.f1],['p2',G.f2]]){
        const o=G.trainingOptions[key];f.maxHp=f.hp=o.hp;f.meter=o.meter;f.drive=o.drive??6;f.burnout=f.drive===0;f.trainingInvincible=o.invincible;
      }
      G.roundTime=Infinity;G.roundState='fight';G.trainingResetT=0;
    }
    go(SCENE.FIGHT);
  }

  function startRound() {
    const s = STAGES[G.stageSel];
    Input.clearMotions();
    // 位置/血量重置
    resetFighter(G.f1, 300, 1);
    resetFighter(G.f2, 660, -1);
    G.projectiles = []; G.effects = [];
    G.combo.P1 = { count:0, timer:0 };
    G.combo.P2 = { count:0, timer:0 };
    G.cameraX=0;
    G.roundTime = 99;
    G.roundState = 'intro';
    G.roundTimer = 0;
    G.bannerT = 0; G.bannerText = '第 ' + G.round + ' 回合'; G.bannerSub = 'FIGHT!';
    Audio2.sfx.roundStart();
  }
  function resetFighter(f, x, facing){
    f.x=x; f.y=FIGHT_GROUND; f.vx=0; f.vy=0; f.facing=facing;
    f.hp=f.maxHp; f.meter=Math.min(f.meter,f.maxMeter); f.state='idle'; f.stateT=0;
    f.hitstun=0; f.blockstun=0; f.attack=null; f.attackHasHit=false; f.onGround=true; f.koFall=0;
    f.drive=6;f.burnout=false;f.driveRegenDelay=0;f.driveBoost=0;f.parrying=false;f.parryFrames=0;f.assistRoute=null;f.attackContact=false;f.repeatChain=0;f.juggleHits=0;
    f.invuln=0; f.pendingRush=false; f.bufferedAttack=null; f.attackConnected=false;
    f.blocking=false; f.crouching=false; f.comboHits=0; f.comboDamage=0; f.trail=[];
    f._hpGhost=1; f.flashT=0; f.armorLeft=0; f.counterTriggered=false; f.moveLabelT=0;
    f.walkPhase=0;f.stepPhase=0;f.gaitDirection=1;f.gaitMoving=false;f.gaitSettling=0;f.gaitSettleFrom=0;f.gaitSettleTo=0;f.gaitSettleDuration=8;f.drawnFrame=null; f.moveBlend=0; f.moveLean=0; f.airFrames=0; f.landingFrames=0;
    f.reaction=null;f.getupFrames=0;f.reactionDuration=20;f.animationFrame=0;f.grabbedBy=null;f.throwSequence=null;f.throwRotation=0;f.throwInputFrames=0;f.knockedDown=false;
  }

  // ---------- 采集玩家 intent ----------
  // 把"朝向后方的移动"转为格挡意图
  function applyBlock(f, it) {
    // 若正后退(远离对手)且没有攻击输入 -> 视为格挡姿态
    const away = -f.facing;
    if (it.move === away && !it.light && !it.heavy && !it.medium && !it.mediumKick && !it.lightKick && !it.heavyKick && !it.throw && !it.special && !it.up && f.onGround) {
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
    const f1 = G.f1, f2 = G.f2;
    // Controls and both players use the same facing for this entire simulation tick.
    if(G.hitstop<=0)faceEachOther(f1,f2);
    // 命中定格期间仍然采集方向和攻击，冻结结束后执行预输入。
    const intents = {};
    if (G.roundState === 'fight') {
      for (const [who, fighter] of [['p1', f1], ['p2', f2]]) {
        if (who === 'p2' && G.pve) continue;
        intents[who]=CombatControls.collect(fighter,CombatControls.read(who,fighter),who);
      }
    }
    if (G.hitstop > 0) { G.hitstop--; return; }

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
      updateCamera();
      updateProjectiles();
      updateGhost(f1); updateGhost(f2);
      return;
    }

    // 计时
    if(!G.training)G.roundTime -= dt;
    if (G.roundTime <= 0) { G.roundTime = 0; endRoundByTime(); return; }

    // 输入
    if (G.roundState === 'fight') {
      const p1s = f1.state, p2s = f2.state;
      f1.handleIntent(intents.p1, G);

      if (G.pve) {
        const ai = G.training && G.trainingOptions.opponent==='dummy' ? {move:0,up:false,down:false,block:false} : G.ai.think(f2, f1, G);
        applyBlock(f2, ai);
        f2.handleIntent(ai, G);
      } else {
        f2.handleIntent(intents.p2, G);
      }
      emitActionSound(f1, p1s);
      emitActionSound(f2, p2s);
    }

    const previousX1=f1.x,previousX2=f2.x;
    f1.update(G); f2.update(G);
    updateProjectiles();

    // 身体互推(防重叠)
    resolveBodies(f1, f2);
    f1.updateGait(f1.x-previousX1);
    f2.updateGait(f2.x-previousX2);
    updateCamera();

    // 近战命中结算
    resolveMelee(f1, f2);
    resolveMelee(f2, f1);

    // 飞行道具命中
    resolveProjectiles();

    // 受伤残影追赶
    updateGhost(f1); updateGhost(f2);
    updateCombos();

    // KO 判定
    if(G.training){
      if(f1.hp<=0||f2.hp<=0){
        if(++G.trainingResetT>=60)startFight();
      }else G.trainingResetT=0;
    }else if ((f1.hp<=0 || f2.hp<=0) && G.roundState==='fight') {
      G.roundState = 'done'; G.bannerT = 0; G.hitstop = 8; G.shake = 12;
      Audio2.sfx.ko();
      if (f1.hp<=0 && f2.hp<=0) { G.bannerText='双双倒下'; G.bannerSub='DOUBLE K.O.'; f1.wins++; f2.wins++; }
      else if (f2.hp<=0) { G.bannerText=f1.name+' 胜'; G.bannerSub='K.O.'; f1.wins++; }
      else { G.bannerText=f2.name+' 胜'; G.bannerSub='K.O.'; f2.wins++; }
    }

    if (G.shake > 0) G.shake *= 0.85;
  }

  function faceEachOther(a, b) {
    const lock = f => !f.onGround||f.attack||f.grabbedBy||f.throwSequence||f.blockstun>0||ATTACK_STATES.includes(f.state)||['hit','ko'].includes(f.state);
    const dx=b.x-a.x;
    // At a jump crossover, keep the previous facing until the bodies clearly pass.
    if(Math.abs(dx)<4)return;
    const direction=Math.sign(dx);
    if (!lock(a)) a.facing = direction;
    if (!lock(b)) b.facing = -direction;
  }

  // 检测本帧新进入的动作,播放对应起手音(挥空/跳跃/必杀)
  function emitActionSound(f, prevState) {
    if (f.state === prevState) return;
    if (f.state === 'jump') { Audio2.sfx.jump(); return; }
    if(f.attack?.category==='normal'||f.attackKind==='throw'){Audio2.sfx.whiff();return;}
    if(ATTACK_STATES.includes(f.state)){if(f.attack?.projectile)Audio2.sfx.fireball();else Audio2.sfx.special();}
  }

  function resolveBodies(a, b) {
    if(a.grabbedBy||b.grabbedBy)return;
    const ab = a.bodyBox, bb = b.bodyBox;
    if (U.overlap(ab, bb) && a.state!=='ko' && b.state!=='ko') {
      const direction=a.x<=b.x?1:-1;
      const overlap=(a.width+b.width)/2-Math.abs(a.x-b.x);
      if(overlap<=0)return;
      if(a.attack?.travelDistance&&a.facing===direction)a.attack.travelBlocked=true;
      if(b.attack?.travelDistance&&b.facing===-direction)b.attack.travelBlocked=true;
      // 完整分离并让场边另一侧承担余量，防止长突进把身体挤穿或推出舞台。
      const ax=a.x,bx=b.x;
      a.x=U.clamp(a.x-direction*overlap/2,-150,1110);
      b.x=U.clamp(b.x+direction*overlap/2,-150,1110);
      const remaining=overlap-Math.abs(a.x-ax)-Math.abs(b.x-bx);
      if(remaining>0){
        if(a.x===-150||a.x===1110)b.x=U.clamp(b.x+direction*remaining,-150,1110);
        else a.x=U.clamp(a.x-direction*remaining,-150,1110);
      }
    }
  }

  function resolveMelee(attacker, defender) {
    const hb = attacker.getHitBox();
    if (!hb) return;
    if (attacker.attackHasHit) return;
    const db = defender.bodyBox;
    if (!U.overlap(hb, db)) return;
    if (defender.state==='ko' || defender.invuln > 0 || defender.trainingInvincible) return;

    attacker.attackHasHit = true;
    const fromDir = attacker.facing;
    if(hb.grab && (!defender.onGround||defender.hitstun>0||defender.blockstun>0))return;
    if(hb.normalThrow){attacker.beginThrow(defender,G);return;}
    const blocked = !hb.grab && defender.blocking && defender.facing === -fromDir && defender.onGround && (hb.level!=='low'||defender.crouching) && (hb.level!=='overhead'||!defender.crouching);
    const res = defender.takeHit(hb, fromDir, blocked);

    if (res.countered) {
      attacker.takeHit({dmg:defender.attack.dmg,kb:10,hitstun:32,type:'special'},-fromDir,false);
      defender.meter=Math.min(defender.maxMeter,defender.meter+12);
      spawnHit(defender.x,defender.y-100,true,false);
      G.hitstop=10;G.shake=10;Audio2.sfx.hitSpecial();return;
    }
    if (res.ignored) return;
    attacker.attackConnected=!res.blocked&&!res.armored;attacker.attackContact=!res.armored;
    attacker.contactFrame = attacker.stateT;

    // 特效 + 定格 + 震屏 + 攒气
    const hx=U.clamp(hb.x+hb.w/2,Math.max(hb.x,db.x),Math.min(hb.x+hb.w,db.x+db.w));
    const hy=U.clamp(hb.y+hb.h/2,Math.max(hb.y,db.y),Math.min(hb.y+hb.h,db.y+db.h));
    spawnHit(hx, hy, hb.type!=='light', res.blocked);
    if(res.parried)G.effects.push({kind:'text',x:hx,y:hy,t:0,life:35,vy:-1,text:'PARRY',color:'#85bfff',size:22});
    else registerCombatText(attacker,hx,hy,res.dmg,res.blocked,false);
    if (!res.blocked) {
      attacker.meter = Math.min(attacker.maxMeter, attacker.meter + (attacker.attack.meterGain??6));
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
      if(p.dead||p.t<p.armFrames)continue;
      const target = p.owner === G.f1 ? G.f2 : G.f1;
      if (target.state==='ko' || target.invuln > 0 || target.trainingInvincible) continue;
      if (U.overlap(p.box, target.bodyBox)) {
        const dir = p.dir;
        const blocked=target.blocking&&target.facing===-dir&&target.onGround&&(p.level!=='low'||target.crouching);
        const res = target.takeHit({dmg:p.dmg,kb:p.kb,hitstun:p.hitstun,type:'special',projectile:true,knockdown:p.knockdown,level:p.level,reaction:p.reaction,blockstun:p.blockstun,scaleFloor:p.scaleFloor}, dir, blocked);
        if(res.ignored)continue;
        if(p.owner.attackId===p.attackId){p.owner.attackContact=true;p.owner.attackConnected=!res.blocked;p.owner.contactFrame=p.owner.stateT;}
        if(!res.blocked)p.owner.meter=Math.min(p.owner.maxMeter,p.owner.meter+(p.meterGain??10));
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
    const target = attacker === G.f1 ? G.f2 : G.f1;
    c.count = target.comboHits;
    c.timer = 90;
    G.effects.push({ kind:'text', x, y, vx:0.2*attacker.facing, vy:-1.5, t:0, life:46, text:`-${dmg}`, color:'#ffd166', size:22 });
    if (c.count >= 2) {
      G.effects.push({ kind:'text', x: attacker.x, y: attacker.y-205, vx:0, vy:-0.4, t:0, life:70, text:`${c.count} HIT · ${target.comboDamage} DMG`, color:'#ff5a8a', size:32 });
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

  // 镜头只横移，双方始终留在画面内；屏幕边界防止彼此无限拉开。
  function updateCamera(){
    const a=G.f1,b=G.f2,lo=-150,hi=1110,maxGap=740;
    a.x=U.clamp(a.x,lo,hi);b.x=U.clamp(b.x,lo,hi);
    if(Math.abs(a.x-b.x)>maxGap){
      const center=U.clamp((a.x+b.x)/2,lo+maxGap/2,hi-maxGap/2);
      const sign=a.x<b.x?-1:1;a.x=center+sign*maxGap/2;b.x=center-sign*maxGap/2;
    }
    const target=U.clamp((a.x+b.x)/2-480,-240,240);
    const delta=target-G.cameraX;
    if(Math.abs(delta)>12)G.cameraX+=(delta-Math.sign(delta)*12)*.10;
    // 大位移时仍保留两侧 90 像素空间。
    G.cameraX=U.clamp(G.cameraX,Math.max(-240,Math.max(a.x,b.x)-870),Math.min(240,Math.min(a.x,b.x)-90));
  }

  // ---------- 绘制战斗 ----------
  function drawFight() {
    ctx.save();
    if (window.Settings?.values.shake!==false && G.shake>0.5){ctx.translate(U.rand(-G.shake,G.shake),U.rand(-G.shake,G.shake));}
    G.stage.draw(ctx, G.t, G.cameraX);
    ctx.save();ctx.translate(-G.cameraX,0);

    // 角色(后于地面)
    const order = G.f1.x <= G.f2.x ? [G.f1,G.f2] : [G.f2,G.f1];
    order.forEach(f=>f.draw(ctx));

    // 飞行道具
    G.projectiles.forEach(p=>p.draw(ctx));

    // 命中特效
    drawEffects();
    ctx.restore();
    G.stage.drawForeground?.(ctx, G.t, G.cameraX);

    ctx.restore();

    // HUD(不随震屏)
    UI.hud(ctx,G.f1,G.f2,G.round,G.roundTime);
    if(G.training){
      ctx.fillStyle='#0b1525cc';ctx.fillRect(18,506,924,25);
      [G.f1,G.f2].forEach((f,i)=>{
        const mode=Input.MODES[i?'p2':'p1']==='modern'?'现代':'经典';
        const next=f.attackContact&&f.stateT-f.contactFrame<=10&&f.attack?.cancellable?'取消窗口':f.attack?'动作 '+f.stateT+'F':'自由行动';
        const target=i?G.f1:G.f2;
        U.text(ctx,mode+' · '+next+' · '+(f.drawnFrame?'绘制 '+f.drawnFrame+'/'+f.drawnFrameCount:'轨道 '+((f.animationFrame||0)+1)+'/60')+' · '+target.comboHits+' HIT / '+target.comboDamage+' DMG',i?928:32,523,11,i?'#efadc2':'#97d8ef',i?'right':'left');
      });
    }

    // banner
    if (G.roundState==='intro') UI.roundBanner(ctx, G.bannerText, G.bannerT>0.5?G.bannerSub:'', G.bannerT);
    if (G.roundState==='done') UI.roundBanner(ctx, G.bannerText, G.bannerSub, G.bannerT);

    // 调试:命中盒(默认关闭)
    if (window.DEBUG_HITBOX) {ctx.save();ctx.translate(-G.cameraX,0);drawHitboxes();ctx.restore();}
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
        if(up)G.modeSel=(G.modeSel+3)%4;
        if(down)G.modeSel=(G.modeSel+1)%4;
        window.AppPanels?.sync();
        if(enter)beginMode(['pvp','pve','training','settings'][G.modeSel]);
        break;
      case SCENE.MODE:
        if (up) G.modeSel=(G.modeSel+1)%2;
        if (down) G.modeSel=(G.modeSel+1)%2;
        if (esc) returnHome();
        if (enter){ G.pve = G.modeSel===1; go(G.pve?SCENE.DIFF:SCENE.CHAR); resetCharSelect(); }
        break;
      case SCENE.DIFF:
        if (up) G.diffSel=(G.diffSel+2)%3;
        if (down) G.diffSel=(G.diffSel+1)%3;
        if (esc) returnHome();
        if (enter){ G.difficulty=[0.6,0.85,1.0][G.diffSel]; resetCharSelect(); go(SCENE.CHAR); }
        break;
      case SCENE.CHAR:
        updateCharSelect(enter, esc);
        break;
      case SCENE.STAGE:
        if (left) G.stageSel=(G.stageSel+STAGES.length-1)%STAGES.length;
        if (right) G.stageSel=(G.stageSel+1)%STAGES.length;
        if (up) G.stageSel=G.stageSel>=3?G.stageSel-3:G.stageSel;
        if (down) G.stageSel=G.stageSel+3<STAGES.length?G.stageSel+3:G.stageSel;
        if (esc){ resetCharSelect(); go(SCENE.CHAR); }
        if (enter) startFight();
        break;
      case SCENE.RESULT:
        if (enter){ startFight(); }   // 用同角色同图再战
        if (esc){ returnHome(); }
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
      else go(G.pve?SCENE.DIFF:SCENE.TITLE);
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

  // ---------- 主循环：逻辑固定 60 Hz，渲染跟随屏幕刷新率 ----------
  const STEP = 1 / 60;
  let last = performance.now(), accumulator = 0;

  function clearCombatBuffer() {
    Input.clearMotions();
    if(G.f1){G.f1.bufferedAttack=null;G.f1.assistRoute=null;}
    if(G.f2){G.f2.bufferedAttack=null;G.f2.assistRoute=null;}
  }

  function step() {
    window.Gamepads?.poll();
    if(window.Settings?.isOpen || window.AppPanels?.isOpen){Input.endFrame();return;}
    if (!G.paused) G.t += STEP;
    if (Input.justPressed('m')) {
      const on = Audio2.toggleMusic();
      if (on) Audio2.music.play(G.scene===SCENE.FIGHT?G.stage.id:'menu');
      window.Settings?.saveAudio();
    }
    if (Input.justPressed('n')) {Audio2.toggleSfx();window.Settings?.saveAudio();}
    if (G.scene !== SCENE.FIGHT && G.scene !== SCENE.RESULT && Audio2.isMusicOn()) Audio2.music.play('menu');

    if (G.scene === SCENE.FIGHT) {
      if (Input.justPressed('p')) {
        G.paused = !G.paused;
        clearCombatBuffer();
        Audio2.sfx.menuSelect();
      }
      if (G.paused && Input.justPressed('Escape')) {
        returnHome();
      } else if (!G.paused) {
        updateFight(STEP);
        updateEffects();
      }
    } else updateMenus();
    Input.endFrame();
  }

  function loop(now) {
    accumulator += Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    while (accumulator + 1e-9 >= STEP) {
      step();
      accumulator -= STEP;
    }
    switch (G.scene) {
      case SCENE.FIGHT:
        drawFight();
        if (G.paused) UI.pauseOverlay(ctx, G.f1, G.f2, G.pve);
        break;
      case SCENE.TITLE: UI.title(ctx, G.t); break;
      case SCENE.MODE: UI.mode(ctx, G.t, G.modeSel); break;
      case SCENE.DIFF: UI.difficulty(ctx, G.t, G.diffSel); break;
      case SCENE.CHAR: UI.charSelect(ctx, G.t, G.charSel, G.charReady, G.pve); break;
      case SCENE.STAGE: UI.stageSelect(ctx, G.t, G.stageSel); break;
      case SCENE.RESULT: UI.result(ctx, G.t, G.winner.name, G.winner.def); break;
    }
    window.MotionGallery?.draw(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 调试开关
  window.GAME = G;
  function beginMode(mode){
    if(mode==='settings'){window.Settings?.open();return;}
    G.training=mode==='training';G.pve=mode!=='pvp';G.paused=false;Input.clear();resetCharSelect();
    if(G.training){startFight();window.Settings?.open();}
    else go(G.pve?SCENE.DIFF:SCENE.CHAR);
  }
  function returnHome(){
    Input.clear();clearCombatBuffer();G.training=false;G.pve=false;G.paused=false;
    G.projectiles=[];G.effects=[];G.f1=G.f2=G.ai=null;G.hitstop=0;G.shake=0;G.modeSel=0;
    go(SCENE.TITLE);Audio2.music.play('menu');
  }
  window.GameControl={beginMode,returnHome,
    setDifficulty(value){G.difficulty=[.6,.85,1].includes(value)?value:.85;G.diffSel=[.6,.85,1].indexOf(G.difficulty);if(G.f2&&G.pve)G.ai=new AI(G.f2,G.difficulty);},
    applyTraining(options){
      if(!G.training)return;
      const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.round(Math.max(min,Math.min(max,Number(v)))):fallback;
      const config={stage:number(options.stage,0,STAGES.length-1,G.stageSel),opponent:['dummy','0.6','0.85','1'].includes(String(options.opponent))?String(options.opponent):'dummy'};
      for(const who of ['p1','p2']){
        const o=options[who]||{};
        config[who]={character:number(o.character,0,CHARACTERS.length-1,G.charSel[who]),hp:number(o.hp,1,999,100),meter:number(o.meter,0,300,300),drive:number(o.drive,0,6,6),invincible:o.invincible===true};
      }
      G.charSel={p1:config.p1.character,p2:config.p2.character};G.stageSel=config.stage;
      G.trainingOptions=config;
      if(config.opponent!=='dummy')this.setDifficulty(Number(config.opponent));
      startFight();G.paused=!!window.Settings?.isOpen;
    }
  };

  // 切到其他窗口/标签页时暂停，避免玩家回来后发现角色已被打败。
  function pauseWhenUnfocused() {
    if (G.scene === SCENE.FIGHT) { G.paused = true; clearCombatBuffer(); }
  }
  window.addEventListener('blur', pauseWhenUnfocused);
  document.addEventListener?.('visibilitychange', () => {
    if (document.hidden) pauseWhenUnfocused();
  });
})();
